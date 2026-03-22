#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

PARITY_ENV="${PARITY_ENV:-dev}"
PARITY_SKIP_DOCKER="${PARITY_SKIP_DOCKER:-0}"
PARITY_REPORT_PATH="${PARITY_REPORT_PATH:-${ROOT_DIR}/scripts/infra-bootstrap/output/parity-report.json}"
PARITY_MATRIX_PATH="${PARITY_MATRIX_PATH:-${ROOT_DIR}/scripts/infra-bootstrap/component-matrix.yaml}"
PARITY_MAIN_COMPOSE_FILE="${PARITY_MAIN_COMPOSE_FILE:-docker-compose.yml}"
PARITY_VAULT_COMPOSE_FILE="${PARITY_VAULT_COMPOSE_FILE:-docker-compose.vault.yml}"
PARITY_INDUCED_MISMATCH_COMPONENT="${PARITY_INDUCED_MISMATCH_COMPONENT:-}"

missing_components=()
misaligned_components=()
PARITY_STATUS="PASS"

log() {
  printf '[bootstrap-parity] %s\n' "$*"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

mark_missing() {
  missing_components+=("$1")
  PARITY_STATUS="FAIL"
}

mark_misaligned() {
  misaligned_components+=("$1")
  PARITY_STATUS="FAIL"
}

env_has_component() {
  local target_component="$1"

  awk -v target_env="${PARITY_ENV}" -v target_component="${target_component}" '
    $1 == "dependency_graph:" { in_env = 0 }
    $1 == "-" && $2 == "environment:" {
      in_env = ($3 == target_env)
      next
    }
    in_env && $1 == "-" && $2 == "component:" {
      component = $3
      gsub(/"/, "", component)
      if (component == target_component) {
        found = 1
      }
      next
    }
    END {
      exit(found ? 0 : 1)
    }
  ' "${PARITY_MATRIX_PATH}"
}

matrix_components_by_type() {
  local target_type="$1"
  local required_filter="${2:-any}"

  awk -v target_env="${PARITY_ENV}" -v target_type="${target_type}" -v required_filter="${required_filter}" '
    $1 == "dependency_graph:" { in_env = 0 }
    $1 == "-" && $2 == "environment:" {
      in_env = ($3 == target_env)
      next
    }
    in_env && $1 == "-" && $2 == "component:" {
      component = $3
      gsub(/"/, "", component)
      component_type = ""
      required = "false"
      next
    }
    in_env && $1 == "type:" {
      component_type = $2
      gsub(/"/, "", component_type)
      next
    }
    in_env && $1 == "bootstrap_required:" {
      required = $2
      gsub(/"/, "", required)
      if (component_type == target_type) {
        if (required_filter == "any" || required == required_filter) {
          print component
        }
      }
      next
    }
  ' "${PARITY_MATRIX_PATH}"
}

check_required_file() {
  local file_path="$1"
  local component_name="$2"
  if [[ ! -f "${file_path}" ]]; then
    mark_missing "${component_name}"
  fi
}

check_required_pattern() {
  local file_path="$1"
  local pattern="$2"
  local component_name="$3"

  if [[ ! -f "${file_path}" ]]; then
    mark_missing "${component_name}"
    return
  fi

  if ! grep -Fq "${pattern}" "${file_path}"; then
    mark_misaligned "${component_name}"
  fi
}

container_exists() {
  local name="$1"
  docker ps -a --format '{{.Names}}' | grep -Fxq "${name}"
}

container_state() {
  local name="$1"
  docker inspect -f '{{.State.Status}}' "${name}" 2>/dev/null || printf 'missing\n'
}

container_health() {
  local name="$1"
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "${name}" 2>/dev/null || printf 'none\n'
}

container_exit_code() {
  local name="$1"
  docker inspect -f '{{.State.ExitCode}}' "${name}" 2>/dev/null || printf '1\n'
}

check_required_runtime_resources() {
  local component_name

  while IFS= read -r component_name; do
    [[ -n "${component_name}" ]] || continue

    if ! container_exists "${component_name}"; then
      mark_missing "compose/${component_name}"
      continue
    fi

    local state
    state="$(container_state "${component_name}")"

    case "${component_name}" in
      vault)
        if [[ "${state}" != "running" ]]; then
          mark_misaligned "compose/${component_name}-state"
          continue
        fi

        local health
        health="$(container_health "${component_name}")"
        if [[ "${health}" != "none" && "${health}" != "healthy" ]]; then
          mark_misaligned "compose/${component_name}-health"
        fi
        ;;
      vault-init)
        if [[ "${state}" == "running" ]]; then
          continue
        fi
        if [[ "${state}" == "exited" ]]; then
          if [[ "$(container_exit_code "${component_name}")" != "0" ]]; then
            mark_misaligned "compose/${component_name}-exit"
          fi
          continue
        fi
        mark_misaligned "compose/${component_name}-state"
        ;;
      *)
        if [[ "${state}" != "running" ]]; then
          mark_misaligned "compose/${component_name}-state"
        fi
        ;;
    esac
  done < <(matrix_components_by_type "compose-service" "true")
}

check_optional_runtime_health() {
  local component_name

  while IFS= read -r component_name; do
    [[ -n "${component_name}" ]] || continue

    if ! container_exists "${component_name}"; then
      continue
    fi

    local state
    state="$(container_state "${component_name}")"
    local health
    health="$(container_health "${component_name}")"

    if [[ "${state}" == "exited" && "$(container_exit_code "${component_name}")" != "0" ]]; then
      mark_misaligned "compose/${component_name}-exit"
      continue
    fi

    if [[ "${health}" == "unhealthy" ]]; then
      mark_misaligned "compose/${component_name}-health"
    fi
  done < <(matrix_components_by_type "compose-service" "false")
}

check_docker_baseline() {
  if [[ "${PARITY_SKIP_DOCKER}" == "1" ]]; then
    log "Skipping docker runtime checks (PARITY_SKIP_DOCKER=1)"
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    mark_missing "docker-cli"
    return
  fi

  local network_name
  while IFS= read -r network_name; do
    [[ -n "${network_name}" ]] || continue
    if ! docker network inspect "${network_name}" >/dev/null 2>&1; then
      mark_missing "network/${network_name}"
    fi
  done < <(matrix_components_by_type "docker-network" "true")

  local volume_name
  while IFS= read -r volume_name; do
    [[ -n "${volume_name}" ]] || continue
    if ! docker volume inspect "${volume_name}" >/dev/null 2>&1; then
      mark_missing "volume/${volume_name}"
    fi
  done < <(matrix_components_by_type "docker-volume" "true")

  check_required_runtime_resources
  check_optional_runtime_health
}

write_report() {
  mkdir -p "$(dirname "${PARITY_REPORT_PATH}")"

  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "environment": "%s",\n' "$(json_escape "${PARITY_ENV}")"
    printf '  "PARITY_STATUS": "%s",\n' "$(json_escape "${PARITY_STATUS}")"

    printf '  "missing_components": ['
    for i in "${!missing_components[@]}"; do
      printf '"%s"' "$(json_escape "${missing_components[$i]}")"
      if [[ "$i" -lt "$((${#missing_components[@]} - 1))" ]]; then
        printf ','
      fi
    done
    printf '],\n'

    printf '  "misaligned_components": ['
    for i in "${!misaligned_components[@]}"; do
      printf '"%s"' "$(json_escape "${misaligned_components[$i]}")"
      if [[ "$i" -lt "$((${#misaligned_components[@]} - 1))" ]]; then
        printf ','
      fi
    done
    printf ']\n'
    printf '}\n'
  } >"${PARITY_REPORT_PATH}"

  log "Wrote parity report: ${PARITY_REPORT_PATH}"
}

main() {
  check_required_file "${PARITY_MATRIX_PATH}" "matrix/component-matrix"
  check_required_file "scripts/infra-bootstrap/bootstrap.sh" "script/bootstrap"
  check_required_file "scripts/infra-bootstrap/validate-nginx-vault.sh" "script/validate-nginx-vault"
  check_required_file "docs/ops/infrastructure-bootstrap-runbook.md" "docs/infrastructure-bootstrap-runbook"

  check_required_pattern "${PARITY_MAIN_COMPOSE_FILE}" "edge-gateway:" "compose/edge-gateway"
  check_required_pattern "docker/vault/policies/runtime-internal-secret.hcl" 'capabilities = ["read"]' "vault-policy/runtime-read"
  check_required_pattern "docker/vault/policies/ci-docs-publish.hcl" 'capabilities = ["read"]' "vault-policy/ci-read"

  if env_has_component "vault-init"; then
    check_required_pattern "${PARITY_MAIN_COMPOSE_FILE}" "vault-init:" "compose/vault-init"
    check_required_pattern "${PARITY_VAULT_COMPOSE_FILE}" "vault-init:" "compose-vault/vault-init"
  fi

  if env_has_component "external-vault-endpoint"; then
    check_required_file "docs/ops/vault-external-operations.md" "docs/vault-external-operations"
    check_required_file "scripts/vault/validate-nonlocal-profile.sh" "script/validate-nonlocal-profile"
    check_required_pattern "${PARITY_MATRIX_PATH}" "component: external-vault-endpoint" "matrix/external-vault-endpoint"
  fi

  if [[ -n "${PARITY_INDUCED_MISMATCH_COMPONENT}" ]]; then
    mark_misaligned "induced/${PARITY_INDUCED_MISMATCH_COMPONENT}"
  fi

  check_docker_baseline
  write_report

  if [[ "${PARITY_STATUS}" != "PASS" ]]; then
    log "Parity check failed"
    exit 1
  fi

  log "Parity check passed"
}

main "$@"
