#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

BOOTSTRAP_SKIP_RUNTIME_VALIDATION="${BOOTSTRAP_SKIP_RUNTIME_VALIDATION:-0}"
BOOTSTRAP_VALIDATION_MODE="${BOOTSTRAP_VALIDATION_MODE:-}"
MAIN_COMPOSE_FILE="${MAIN_COMPOSE_FILE:-docker-compose.yml}"
VAULT_COMPOSE_FILE="${VAULT_COMPOSE_FILE:-docker-compose.vault.yml}"
EDGE_COMPOSE_FILE="${EDGE_COMPOSE_FILE:-${MAIN_COMPOSE_FILE}}"
VAULT_CONTAINER_NAME="${VAULT_CONTAINER_NAME:-vault}"
VAULT_INTERNAL_SECRET_PATH="${VAULT_INTERNAL_SECRET_PATH:-secret/fix/shared/core-services/internal-secret}"
SKIP_COMPOSE_UP="${SKIP_COMPOSE_UP:-0}"
DEPLOY_ENV="${DEPLOY_ENV:-${BOOTSTRAP_ENV:-dev}}"

RUNTIME_POLICY_PATH="docker/vault/policies/runtime-internal-secret.hcl"
CI_POLICY_PATH="docker/vault/policies/ci-docs-publish.hcl"
READ_SCRIPT_PATH="./docker/vault/scripts/read-internal-secret.sh"
EDGE_VALIDATE_SCRIPT_PATH="./docker/nginx/scripts/validate-edge-gateway.sh"
NONLOCAL_VALIDATE_SCRIPT_PATH="./scripts/vault/validate-nonlocal-profile.sh"

log() {
  printf '[bootstrap-validate] %s\n' "$*"
}

require_file() {
  local file_path="$1"
  if [[ ! -f "${file_path}" ]]; then
    log "Missing required file: ${file_path}"
    exit 1
  fi
}

require_pattern() {
  local file_path="$1"
  local pattern="$2"
  local reason="$3"
  if ! grep -Fq "${pattern}" "${file_path}"; then
    log "Missing expected pattern (${reason}) in ${file_path}: ${pattern}"
    exit 1
  fi
}

require_pattern_in_any_file() {
  local pattern="$1"
  local reason="$2"
  shift 2
  local file_path
  local searched_files="$*"

  for file_path in "$@"; do
    if grep -Fq "${pattern}" "${file_path}"; then
      return 0
    fi
  done

  log "Missing expected pattern (${reason}) in any of [${searched_files}]: ${pattern}"
  exit 1
}

resolve_validation_mode() {
  if [[ -n "${BOOTSTRAP_VALIDATION_MODE}" ]]; then
    case "${BOOTSTRAP_VALIDATION_MODE}" in
      static|full)
        printf '%s\n' "${BOOTSTRAP_VALIDATION_MODE}"
        return
        ;;
      *)
        log "Invalid BOOTSTRAP_VALIDATION_MODE: ${BOOTSTRAP_VALIDATION_MODE} (use static|full)"
        exit 1
        ;;
    esac
  fi

  if [[ "${BOOTSTRAP_SKIP_RUNTIME_VALIDATION}" == "1" ]]; then
    printf 'static\n'
  else
    printf 'full\n'
  fi
}

load_approle_from_container_if_available() {
  if [[ -n "${VAULT_RUNTIME_ROLE_ID:-}" && -n "${VAULT_RUNTIME_SECRET_ID:-}" ]]; then
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    return
  fi

  if ! docker ps --format '{{.Names}}' | grep -Fxq "${VAULT_CONTAINER_NAME}"; then
    return
  fi

  if [[ -z "${VAULT_RUNTIME_ROLE_ID:-}" ]]; then
    VAULT_RUNTIME_ROLE_ID="$(docker exec "${VAULT_CONTAINER_NAME}" sh -lc 'cat /vault/file/runtime-role-id 2>/dev/null || true')"
    export VAULT_RUNTIME_ROLE_ID
  fi

  if [[ -z "${VAULT_RUNTIME_SECRET_ID:-}" ]]; then
    VAULT_RUNTIME_SECRET_ID="$(docker exec "${VAULT_CONTAINER_NAME}" sh -lc 'cat /vault/file/runtime-secret-id 2>/dev/null || true')"
    export VAULT_RUNTIME_SECRET_ID
  fi
}

is_nonlocal_environment() {
  case "${DEPLOY_ENV}" in
    staging|stage|prod|production|preprod|uat)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

main() {
  local validation_mode
  validation_mode="$(resolve_validation_mode)"

  require_file "${RUNTIME_POLICY_PATH}"
  require_file "${CI_POLICY_PATH}"
  require_file "${READ_SCRIPT_PATH}"
  require_file "${EDGE_VALIDATE_SCRIPT_PATH}"
  require_file "${NONLOCAL_VALIDATE_SCRIPT_PATH}"
  require_file "${MAIN_COMPOSE_FILE}"
  require_file "${VAULT_COMPOSE_FILE}"
  require_file "${EDGE_COMPOSE_FILE}"

  require_pattern "${RUNTIME_POLICY_PATH}" 'capabilities = ["read"]' 'runtime least privilege'
  require_pattern "${CI_POLICY_PATH}" 'capabilities = ["read"]' 'ci least privilege'
  require_pattern "${EDGE_COMPOSE_FILE}" 'edge-gateway:' 'edge service declared'
  require_pattern_in_any_file \
    'INTERNAL_SECRET: ${INTERNAL_SECRET:?INTERNAL_SECRET must be provided from Vault}' \
    'fail-fast runtime secret' \
    "${MAIN_COMPOSE_FILE}" \
    "${EDGE_COMPOSE_FILE}"
  require_pattern "${VAULT_COMPOSE_FILE}" 'vault-init:' 'vault bootstrap compose includes init'

  VALIDATE_NONLOCAL_ENV="${DEPLOY_ENV}" \
    VALIDATE_NONLOCAL_ENABLED_PROFILES="${COMPOSE_PROFILES:-${DOCKER_COMPOSE_PROFILES:-}}" \
    bash "${NONLOCAL_VALIDATE_SCRIPT_PATH}"

  if [[ "${validation_mode}" == "static" ]]; then
    log "Static integration checks passed (runtime checks skipped by configuration)."
    return
  fi

  if is_nonlocal_environment; then
    log "Non-local integration checks passed (external Vault runtime validation is operator-owned)."
    return
  fi

  command -v docker >/dev/null 2>&1 || {
    log "docker command is required for full runtime validation"
    exit 1
  }

  SKIP_COMPOSE_UP="${SKIP_COMPOSE_UP}" EDGE_COMPOSE_FILE="${EDGE_COMPOSE_FILE}" "${EDGE_VALIDATE_SCRIPT_PATH}"

  load_approle_from_container_if_available

  local resolved_secret=""
  set +e
  resolved_secret="$(VAULT_INTERNAL_SECRET_PATH="${VAULT_INTERNAL_SECRET_PATH}" "${READ_SCRIPT_PATH}" 2>/dev/null)"
  local read_exit_code=$?
  set -e

  if [[ ${read_exit_code} -ne 0 || -z "${resolved_secret}" ]]; then
    log "Vault integration runtime check failed: unable to read ${VAULT_INTERNAL_SECRET_PATH}"
    exit 1
  fi

  log "Full runtime integration check passed: edge validation + Vault secret retrieval succeeded"
}

main "$@"
