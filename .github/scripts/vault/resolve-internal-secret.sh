#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
DEFAULT_PROTECTED_WORKFLOWS_FILE="${REPO_ROOT}/.github/vault-protected-workflows.txt"
PROTECTED_BRANCH_REGEX='^(main|release/.+)$'

EXIT_OIDC=10
EXIT_JWT_LOGIN=11
EXIT_TLS_TRUST=12
EXIT_HOSTNAME_SAN=13
EXIT_TIMEOUT_UNREACHABLE=14
EXIT_KV_READ=15
EXIT_ALLOWLIST=16
EXIT_DEPENDENCY=17
EXIT_EXPORT=18
EXIT_CONFIG=19

RESOLUTION_EXIT_CODE=""
RESOLUTION_ERROR_CODE=""
RESOLUTION_ERROR_MESSAGE=""

log() {
  printf '[vault-gha] %s\n' "$*"
}

url_encode() {
  local raw_value="$1"
  local encoded=""
  local character=""
  local index=0

  while [[ ${index} -lt ${#raw_value} ]]; do
    character="${raw_value:index:1}"
    case "${character}" in
      [a-zA-Z0-9.~_-])
        encoded+="${character}"
        ;;
      *)
        printf -v encoded '%s%%%02X' "${encoded}" "'${character}"
        ;;
    esac
    index=$((index + 1))
  done

  printf '%s\n' "${encoded}"
}

emit_resolution_error() {
  local error_code="$1"
  shift

  printf 'VAULT_RESOLUTION_ERROR:%s %s\n' "${error_code}" "$*" >&2
}

append_github_env() {
  local line="$1"
  local github_env="${GITHUB_ENV:-}"

  if [[ -z "${github_env}" ]]; then
    fail_resolution "${EXIT_EXPORT}" "EXPORT" "GITHUB_ENV is required for workflow secret export"
  fi

  printf '%s\n' "${line}" >> "${github_env}"
}

append_github_env_var() {
  local name="$1"
  local value="$2"
  local github_env="${GITHUB_ENV:-}"

  if [[ -z "${github_env}" ]]; then
    fail_resolution "${EXIT_EXPORT}" "EXPORT" "GITHUB_ENV is required for workflow secret export"
  fi

  if [[ "${value}" == *$'\n'* || "${value}" == *$'\r'* ]]; then
    local delimiter="EOF_$(date +%s%N)_$RANDOM"
    {
      printf '%s<<%s\n' "${name}" "${delimiter}"
      printf '%s\n' "${value}"
      printf '%s\n' "${delimiter}"
    } >> "${github_env}"
    return
  fi

  printf '%s=%s\n' "${name}" "${value}" >> "${github_env}"
}

mask_secret_value() {
  local secret_value="$1"
  local secret_line=""

  if [[ "${secret_value}" == *$'\n'* || "${secret_value}" == *$'\r'* ]]; then
    while IFS= read -r secret_line || [[ -n "${secret_line}" ]]; do
      [[ -n "${secret_line}" ]] || continue
      printf '::add-mask::%s\n' "${secret_line}"
    done <<< "${secret_value}"
    return
  fi

  printf '::add-mask::%s\n' "${secret_value}"
}

fail_resolution() {
  local exit_code="$1"
  local error_code="$2"
  shift 2

  emit_resolution_error "${error_code}" "$*"
  exit "${exit_code}"
}

clear_resolution_failure() {
  RESOLUTION_EXIT_CODE=""
  RESOLUTION_ERROR_CODE=""
  RESOLUTION_ERROR_MESSAGE=""
}

record_resolution_failure() {
  RESOLUTION_EXIT_CODE="$1"
  RESOLUTION_ERROR_CODE="$2"
  shift 2
  RESOLUTION_ERROR_MESSAGE="$*"
  return 1
}

running_in_github_actions() {
  [[ "${GITHUB_ACTIONS:-}" == "true" ]]
}

protected_workflows_file() {
  if ! running_in_github_actions && [[ -n "${VAULT_PROTECTED_WORKFLOWS_FILE:-}" ]]; then
    printf '%s\n' "${VAULT_PROTECTED_WORKFLOWS_FILE}"
    return
  fi

  printf '%s\n' "${DEFAULT_PROTECTED_WORKFLOWS_FILE}"
}

is_allowlisted_workflow() {
  local workflow_path="${1:-}"
  local allowlist_file
  allowlist_file="$(protected_workflows_file)"

  if [[ -z "${workflow_path}" || ! -f "${allowlist_file}" ]]; then
    return 1
  fi

  grep -Ev '^[[:space:]]*(#|$)' "${allowlist_file}" | grep -Fxq "${workflow_path}"
}

is_protected_branch() {
  local ref_name="${GITHUB_REF_NAME:-}"

  [[ -n "${ref_name}" && "${ref_name}" =~ ${PROTECTED_BRANCH_REGEX} ]]
}

workflow_policy_valid() {
  local workflow_entry="$1"

  command -v ruby >/dev/null 2>&1 \
    || fail_resolution "${EXIT_DEPENDENCY}" "DEPENDENCY" "Missing required command: ruby"

  ruby - "$workflow_entry" <<'RUBY'
require "shellwords"
require "yaml"

workflow_path = ARGV[0]
resolver_path = ".github/scripts/vault/resolve-internal-secret.sh"

raw_yaml = File.read(workflow_path)
document = YAML.safe_load(raw_yaml, permitted_classes: [], aliases: true) || {}
jobs = document["jobs"]
global_permissions = document["permissions"].is_a?(Hash) ? document["permissions"] : {}

def resolver_invocation?(run_block, resolver_path)
  run_block.to_s.each_line.any? do |line|
    stripped = line.strip
    next false if stripped.empty? || stripped.start_with?("#")

    tokens =
      begin
        Shellwords.shellsplit(stripped)
      rescue ArgumentError
        stripped.split(/\s+/)
      end

    while tokens.any? && tokens[0].match?(/\A[A-Za-z_][A-Za-z0-9_]*=/)
      tokens.shift
    end

    next false if tokens.empty?

    first = tokens[0].sub(%r{\A\./}, "")
    second = tokens[1]&.sub(%r{\A\./}, "")

    first == resolver_path || (
      ["bash", "sh", ".", "source"].include?(first) && second == resolver_path
    )
  end
end

valid =
  jobs.is_a?(Hash) && jobs.any? do |_job_name, job|
    next false unless job.is_a?(Hash)

    permissions =
      if job["permissions"].is_a?(Hash)
        job["permissions"]
      else
        global_permissions
      end

    next false unless permissions.is_a?(Hash)
    next false unless permissions["id-token"].to_s == "write"

    steps = job["steps"]
    next false unless steps.is_a?(Array)

    steps.any? do |step|
      step.is_a?(Hash) && step["run"].is_a?(String) && resolver_invocation?(step["run"], resolver_path)
    end
  end

exit(valid ? 0 : 1)
RUBY
}

validate_allowlist_entries() {
  local allowlist_file
  allowlist_file="$(protected_workflows_file)"

  if [[ ! -f "${allowlist_file}" ]]; then
    fail_resolution "${EXIT_ALLOWLIST}" "ALLOWLIST" "Protected workflow allowlist file is missing: ${allowlist_file}"
  fi

  local entry_count=0
  while IFS= read -r workflow_entry; do
    [[ -n "${workflow_entry}" ]] || continue
    entry_count=$((entry_count + 1))
    [[ -f "${workflow_entry}" ]] || fail_resolution "${EXIT_ALLOWLIST}" "ALLOWLIST" "Allowlist entry does not exist: ${workflow_entry}"
    workflow_policy_valid "${workflow_entry}" \
      || fail_resolution "${EXIT_ALLOWLIST}" "ALLOWLIST" "Allowlisted workflow must request id-token: write and invoke the Vault resolver in the same job: ${workflow_entry}"
  done < <(grep -Ev '^[[:space:]]*(#|$)' "${allowlist_file}")

  if [[ ${entry_count} -eq 0 ]]; then
    fail_resolution "${EXIT_ALLOWLIST}" "ALLOWLIST" "Protected workflow allowlist file is empty: ${allowlist_file}"
  fi
}

mark_degraded() {
  append_github_env "VAULT_SECRET_MODE=degraded"
  log "${1:-controlled degraded mode enabled}"
}

require_command() {
  local command_name="$1"
  command -v "${command_name}" >/dev/null 2>&1 || record_resolution_failure "${EXIT_DEPENDENCY}" "DEPENDENCY" "Missing required command: ${command_name}"
}

build_oidc_request_url() {
  local base_url="${ACTIONS_ID_TOKEN_REQUEST_URL:-}"
  local audience="${VAULT_OIDC_AUDIENCE:-https://github.com/${GITHUB_REPOSITORY_OWNER:-unknown}}"
  local encoded_audience
  encoded_audience="$(url_encode "${audience}")"

  if [[ "${base_url}" == *\?* ]]; then
    printf '%s&audience=%s\n' "${base_url}" "${encoded_audience}"
  else
    printf '%s?audience=%s\n' "${base_url}" "${encoded_audience}"
  fi
}

resolve_current_workflow_path() {
  if ! running_in_github_actions && [[ -n "${VAULT_WORKFLOW_PATH:-}" ]]; then
    printf '%s\n' "${VAULT_WORKFLOW_PATH}"
    return 0
  fi

  local workflow_ref="${GITHUB_WORKFLOW_REF:-}"
  if [[ -z "${workflow_ref}" ]]; then
    return 1
  fi

  local workflow_path="${workflow_ref%@*}"
  workflow_path="${workflow_path#*/}"
  workflow_path="${workflow_path#*/}"

  if [[ -z "${workflow_path}" || "${workflow_path}" == "${workflow_ref%@*}" ]]; then
    return 1
  fi

  if running_in_github_actions && [[ "${workflow_path}" != .github/workflows/* ]]; then
    return 1
  fi

  printf '%s\n' "${workflow_path}"
}

classify_vault_error() {
  local stderr_text="$1"
  local default_code="$2"
  local default_label="$3"

  case "${stderr_text}" in
    *"certificate is valid for"*|*"hostname mismatch"*|*"doesn't contain any IP SANs"*|*"not valid for the requested host"*)
      printf '13 HOSTNAME_SAN\n'
      ;;
    *"certificate signed by unknown authority"*|*"x509:"*|*"tls:"*)
      printf '12 TLS_TRUST\n'
      ;;
    *"timed out"*|*"timeout"*|*"connection refused"*|*"context deadline exceeded"*|*"no such host"*|*"network is unreachable"*|*"EOF"*)
      printf '14 TIMEOUT_UNREACHABLE\n'
      ;;
    *)
      printf '%s %s\n' "${default_code}" "${default_label}"
      ;;
  esac
}

resolve_from_vault() {
  clear_resolution_failure

  cleanup_temp_files() {
    rm -f "${oidc_stderr_file}" "${vault_login_stderr_file}" "${kv_read_stderr_file}"
  }

  local curl_args=(
    -sSfL
    -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}"
  )

  local oidc_stderr_file
  local vault_login_stderr_file
  local kv_read_stderr_file
  oidc_stderr_file="$(mktemp)"
  vault_login_stderr_file="$(mktemp)"
  kv_read_stderr_file="$(mktemp)"

  local oidc_response
  set +e
  oidc_response="$(
    curl "${curl_args[@]}" "$(build_oidc_request_url)" 2>"${oidc_stderr_file}"
  )"
  local oidc_status=$?
  set -e
  if [[ ${oidc_status} -ne 0 ]]; then
    record_resolution_failure "${EXIT_OIDC}" "OIDC" "$(cat "${oidc_stderr_file}")"
    cleanup_temp_files
    return 1
  fi

  local oidc_jwt
  set +e
  oidc_jwt="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["value"])' <<< "${oidc_response}" 2>"${oidc_stderr_file}")"
  oidc_status=$?
  set -e
  if [[ ${oidc_status} -ne 0 || -z "${oidc_jwt}" ]]; then
    record_resolution_failure "${EXIT_OIDC}" "OIDC" "Unable to parse GitHub OIDC token response"
    cleanup_temp_files
    return 1
  fi

  local vault_token
  set +e
  vault_token="$(
    vault write -field=token \
      auth/jwt/login \
      role="${VAULT_JWT_ROLE:-ci-docs-publish}" \
      jwt="${oidc_jwt}" \
      2>"${vault_login_stderr_file}"
  )"
  local vault_login_status=$?
  set -e
  if [[ ${vault_login_status} -ne 0 || -z "${vault_token}" ]]; then
    local login_classification
    login_classification="$(classify_vault_error "$(cat "${vault_login_stderr_file}")" "${EXIT_JWT_LOGIN}" JWT_LOGIN)"
    record_resolution_failure "${login_classification%% *}" "${login_classification#* }" "$(cat "${vault_login_stderr_file}")"
    cleanup_temp_files
    return 1
  fi

  local internal_secret
  set +e
  internal_secret="$(
    VAULT_TOKEN="${vault_token}" \
      vault kv get -field=value "${VAULT_SECRET_PATH:-secret/fix/shared/core-services/internal-secret}" \
      2>"${kv_read_stderr_file}"
  )"
  local kv_read_status=$?
  set -e
  if [[ ${kv_read_status} -ne 0 ]]; then
    local kv_classification
    kv_classification="$(classify_vault_error "$(cat "${kv_read_stderr_file}")" "${EXIT_KV_READ}" KV_READ)"
    record_resolution_failure "${kv_classification%% *}" "${kv_classification#* }" "$(cat "${kv_read_stderr_file}")"
    cleanup_temp_files
    return 1
  fi

  if [[ -z "${internal_secret}" ]]; then
    record_resolution_failure "${EXIT_KV_READ}" "KV_READ" "Vault secret path returned an empty value"
    cleanup_temp_files
    return 1
  fi

  mask_secret_value "${internal_secret}"
  append_github_env_var "INTERNAL_SECRET" "${internal_secret}"
  append_github_env "VAULT_SECRET_MODE=vault"
  cleanup_temp_files
  unset internal_secret vault_token oidc_jwt oidc_response
  clear_resolution_failure
}

handle_resolution_failure() {
  local protected_flow="$1"

  if [[ -z "${RESOLUTION_EXIT_CODE}" || -z "${RESOLUTION_ERROR_CODE}" ]]; then
    fail_resolution "${EXIT_CONFIG}" "CONFIG" "Vault resolution failed without a classified error"
  fi

  if [[ "${protected_flow}" == "true" ]]; then
    fail_resolution "${RESOLUTION_EXIT_CODE}" "${RESOLUTION_ERROR_CODE}" "${RESOLUTION_ERROR_MESSAGE}"
  fi

  emit_resolution_error "${RESOLUTION_ERROR_CODE}" "${RESOLUTION_ERROR_MESSAGE}"
  mark_degraded "Vault resolution failed outside protected flow; continuing in degraded mode"
}

main() {
  if [[ -n "${ACT:-}" ]]; then
    mark_degraded "act runner detected; skipping Vault resolution"
    return
  fi

  local protected_branch="false"
  if is_protected_branch; then
    protected_branch="true"
  fi

  local current_workflow_path=""
  if ! current_workflow_path="$(resolve_current_workflow_path 2>/dev/null)"; then
    current_workflow_path=""
  fi

  if [[ "${protected_branch}" == "true" ]]; then
    validate_allowlist_entries
  fi

  local allowlisted_workflow="false"
  if is_allowlisted_workflow "${current_workflow_path}"; then
    allowlisted_workflow="true"
  fi

  local protected_flow="false"
  if [[ "${protected_branch}" == "true" ]]; then
    if [[ -z "${current_workflow_path}" ]]; then
      fail_resolution "${EXIT_ALLOWLIST}" "ALLOWLIST" "Protected branch Vault resolution requires a detectable workflow path"
    fi
    if [[ "${allowlisted_workflow}" != "true" ]]; then
      fail_resolution "${EXIT_ALLOWLIST}" "ALLOWLIST" "Workflow path is not allowlisted: ${current_workflow_path}"
    fi
    protected_flow="true"
  fi

  if [[ -z "${VAULT_ADDR:-}" ]]; then
    if [[ "${protected_flow}" == "true" ]]; then
      fail_resolution "${EXIT_CONFIG}" "CONFIG" "Protected workflow requires VAULT_ADDR"
    fi
    mark_degraded "Vault not configured for non-protected flow"
    return
  fi

  if [[ "${VAULT_ADDR}" != https://* ]]; then
    if [[ "${protected_flow}" == "true" ]]; then
      fail_resolution 12 "TLS_TRUST" "Protected workflow requires an https:// VAULT_ADDR"
    fi
    mark_degraded "Vault endpoint is not TLS protected; staying in degraded mode"
    return
  fi

  if [[ -z "${VAULT_CACERT:-}" ]]; then
    if [[ "${protected_flow}" == "true" ]]; then
      fail_resolution "${EXIT_TLS_TRUST}" "TLS_TRUST" "Protected workflow requires VAULT_CACERT"
    fi
    mark_degraded "Vault CA trust bundle is unavailable for non-protected flow"
    return
  fi

  if [[ ! -r "${VAULT_CACERT}" ]]; then
    if [[ "${protected_flow}" == "true" ]]; then
      fail_resolution "${EXIT_TLS_TRUST}" "TLS_TRUST" "Protected workflow requires a readable VAULT_CACERT file"
    fi
    mark_degraded "Vault CA trust bundle is unreadable for non-protected flow"
    return
  fi

  if [[ -z "${ACTIONS_ID_TOKEN_REQUEST_TOKEN:-}" || -z "${ACTIONS_ID_TOKEN_REQUEST_URL:-}" ]]; then
    if [[ "${protected_flow}" == "true" ]]; then
      fail_resolution "${EXIT_OIDC}" "OIDC" "Protected workflow requires GitHub OIDC request metadata"
    fi
    mark_degraded "OIDC request metadata is unavailable for non-protected flow"
    return
  fi

  export VAULT_ADDR
  if ! require_command curl; then
    handle_resolution_failure "${protected_flow}"
    return
  fi
  if ! require_command python3; then
    handle_resolution_failure "${protected_flow}"
    return
  fi
  if ! require_command vault; then
    handle_resolution_failure "${protected_flow}"
    return
  fi

  if ! resolve_from_vault; then
    handle_resolution_failure "${protected_flow}"
    return
  fi

  log "Resolved INTERNAL_SECRET from Vault"
}

main "$@"
