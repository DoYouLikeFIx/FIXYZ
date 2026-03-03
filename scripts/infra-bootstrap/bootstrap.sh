#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

BOOTSTRAP_ENV="${BOOTSTRAP_ENV:-dev}"
BOOTSTRAP_DRY_RUN="${BOOTSTRAP_DRY_RUN:-0}"
BOOTSTRAP_AUTOROLLBACK="${BOOTSTRAP_AUTOROLLBACK:-0}"
BOOTSTRAP_SKIP_RUNTIME_VALIDATION="${BOOTSTRAP_SKIP_RUNTIME_VALIDATION:-0}"
BOOTSTRAP_OUTPUT_DIR="${BOOTSTRAP_OUTPUT_DIR:-${ROOT_DIR}/scripts/infra-bootstrap/output}"
BOOTSTRAP_REPORT_PATH="${BOOTSTRAP_REPORT_PATH:-${BOOTSTRAP_OUTPUT_DIR}/bootstrap-report.json}"
BOOTSTRAP_PARITY_REPORT_PATH="${BOOTSTRAP_PARITY_REPORT_PATH:-${BOOTSTRAP_OUTPUT_DIR}/parity-report.json}"
BOOTSTRAP_MATRIX_PATH="${BOOTSTRAP_MATRIX_PATH:-${ROOT_DIR}/scripts/infra-bootstrap/component-matrix.yaml}"
MAIN_COMPOSE_FILE="${MAIN_COMPOSE_FILE:-docker-compose.yml}"
VAULT_COMPOSE_FILE="${VAULT_COMPOSE_FILE:-docker-compose.vault.yml}"
VAULT_CONTAINER_NAME="${VAULT_CONTAINER_NAME:-vault}"
SIMULATE_FAILURE_STEP="${SIMULATE_FAILURE_STEP:-}"

declare -a CREATED_RESOURCES=()
declare -a COMPONENT_ROWS=()
declare -a PREEXISTING_CONTAINERS=()
CURRENT_STEP="initialization"
OVERALL_STATUS="running"
ROLLBACK_STATUS="not-needed"

log() {
  printf '[infra-bootstrap] %s\n' "$*"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

record_component() {
  local component="$1"
  local status="$2"
  local detail="$3"
  COMPONENT_ROWS+=("${component}|${status}|${detail}")
}

run_or_note() {
  if [[ "${BOOTSTRAP_DRY_RUN}" == "1" ]]; then
    log "DRY-RUN: $*"
    return 0
  fi

  "$@"
}

maybe_fail() {
  local step_name="$1"
  if [[ -n "${SIMULATE_FAILURE_STEP}" && "${SIMULATE_FAILURE_STEP}" == "${step_name}" ]]; then
    log "Simulated failure requested at step: ${step_name}"
    return 1
  fi
}

matrix_required_components_by_type() {
  local target_type="$1"

  awk -v target_env="${BOOTSTRAP_ENV}" -v target_type="${target_type}" '
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
      if (component_type == target_type && required == "true") {
        print component
      }
      next
    }
  ' "${BOOTSTRAP_MATRIX_PATH}"
}

container_exists() {
  local container_name="$1"
  docker ps -a --format '{{.Names}}' | grep -Fxq "${container_name}"
}

record_preexisting_container() {
  local container_name="$1"

  if [[ "${BOOTSTRAP_DRY_RUN}" == "1" ]]; then
    return
  fi

  if container_exists "${container_name}"; then
    PREEXISTING_CONTAINERS+=("${container_name}")
  fi
}

was_preexisting_container() {
  local container_name="$1"

  for existing in "${PREEXISTING_CONTAINERS[@]-}"; do
    if [[ "${existing}" == "${container_name}" ]]; then
      return 0
    fi
  done

  return 1
}

write_report() {
  mkdir -p "$(dirname "${BOOTSTRAP_REPORT_PATH}")"

  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "environment": "%s",\n' "$(json_escape "${BOOTSTRAP_ENV}")"
    printf '  "current_step": "%s",\n' "$(json_escape "${CURRENT_STEP}")"
    printf '  "overall_status": "%s",\n' "$(json_escape "${OVERALL_STATUS}")"
    printf '  "rollback_status": "%s",\n' "$(json_escape "${ROLLBACK_STATUS}")"
    printf '  "dry_run": %s,\n' "$([[ "${BOOTSTRAP_DRY_RUN}" == "1" ]] && echo true || echo false)"
    printf '  "runtime_validation_skipped": %s,\n' "$([[ "${BOOTSTRAP_SKIP_RUNTIME_VALIDATION}" == "1" ]] && echo true || echo false)"
    printf '  "components": [\n'

    local row_count="${#COMPONENT_ROWS[@]}"
    local i=0
    for row in "${COMPONENT_ROWS[@]}"; do
      i=$((i + 1))
      IFS='|' read -r component status detail <<<"${row}"
      printf '    {"component":"%s","status":"%s","detail":"%s"}' \
        "$(json_escape "${component}")" \
        "$(json_escape "${status}")" \
        "$(json_escape "${detail}")"
      if [[ "${i}" -lt "${row_count}" ]]; then
        printf ','
      fi
      printf '\n'
    done

    printf '  ],\n'
    printf '  "outputs": {\n'
    printf '    "bootstrap_report": "%s",\n' "$(json_escape "${BOOTSTRAP_REPORT_PATH}")"
    printf '    "parity_report": "%s"\n' "$(json_escape "${BOOTSTRAP_PARITY_REPORT_PATH}")"
    printf '  }\n'
    printf '}\n'
  } >"${BOOTSTRAP_REPORT_PATH}"

  log "Wrote report: ${BOOTSTRAP_REPORT_PATH}"
}

rollback_created_resources() {
  if [[ "${BOOTSTRAP_AUTOROLLBACK}" != "1" ]]; then
    log "Auto rollback disabled. Deterministic re-run is supported by idempotent provisioning."
    return 0
  fi

  local rollback_failed=0

  log "Rolling back resources created in this run"
  for ((idx=${#CREATED_RESOURCES[@]} - 1; idx >= 0; idx--)); do
    IFS=':' read -r resource_kind resource_name <<<"${CREATED_RESOURCES[idx]}"

    case "${resource_kind}" in
      container)
        if ! run_or_note docker rm -f "${resource_name}" >/dev/null; then
          rollback_failed=1
          log "Rollback failed for container/${resource_name}"
        fi
        ;;
      network)
        if ! run_or_note docker network rm "${resource_name}" >/dev/null; then
          rollback_failed=1
          log "Rollback failed for network/${resource_name}"
        fi
        ;;
      volume)
        if ! run_or_note docker volume rm "${resource_name}" >/dev/null; then
          rollback_failed=1
          log "Rollback failed for volume/${resource_name}"
        fi
        ;;
      *)
        rollback_failed=1
        log "Unknown rollback resource type: ${resource_kind}:${resource_name}"
        ;;
    esac
  done

  return "${rollback_failed}"
}

on_error() {
  local exit_code="$?"

  OVERALL_STATUS="failed"
  log "Failure in step: ${CURRENT_STEP}"

  if rollback_created_resources; then
    ROLLBACK_STATUS="success"
  else
    ROLLBACK_STATUS="failed"
    OVERALL_STATUS="failed-with-rollback-errors"
  fi

  write_report
  exit "${exit_code}"
}

trap on_error ERR

require_prerequisites() {
  [[ -f "${BOOTSTRAP_MATRIX_PATH}" ]] || {
    log "Missing component matrix: ${BOOTSTRAP_MATRIX_PATH}"
    exit 1
  }

  if [[ "${BOOTSTRAP_DRY_RUN}" == "1" ]]; then
    log "Dry-run mode enabled; command execution prerequisites are not required"
    return
  fi

  command -v docker >/dev/null 2>&1 || {
    log "docker command is required"
    exit 1
  }

  docker compose version >/dev/null 2>&1 || {
    log "docker compose plugin is required"
    exit 1
  }
}

ensure_network() {
  local network_name="$1"
  CURRENT_STEP="ensure-network-${network_name}"

  if [[ "${BOOTSTRAP_DRY_RUN}" != "1" ]] && docker network inspect "${network_name}" >/dev/null 2>&1; then
    record_component "network/${network_name}" "already-present" "network already exists"
    return
  fi

  run_or_note docker network create "${network_name}" >/dev/null
  CREATED_RESOURCES+=("network:${network_name}")
  record_component "network/${network_name}" "provisioned" "network created"
}

ensure_volume() {
  local volume_name="$1"
  CURRENT_STEP="ensure-volume-${volume_name}"

  if [[ "${BOOTSTRAP_DRY_RUN}" != "1" ]] && docker volume inspect "${volume_name}" >/dev/null 2>&1; then
    record_component "volume/${volume_name}" "already-present" "volume already exists"
    return
  fi

  run_or_note docker volume create "${volume_name}" >/dev/null
  CREATED_RESOURCES+=("volume:${volume_name}")
  record_component "volume/${volume_name}" "provisioned" "volume created"
}

bootstrap_vault_foundation() {
  CURRENT_STEP="vault-bootstrap"
  maybe_fail "vault-bootstrap"

  local -a bootstrap_services=()
  while IFS= read -r service_name; do
    [[ -n "${service_name}" ]] || continue
    bootstrap_services+=("${service_name}")
    record_preexisting_container "${service_name}"
  done < <(matrix_required_components_by_type "compose-service")

  if [[ "${#bootstrap_services[@]}" -eq 0 ]]; then
    log "No required compose services found in matrix for env=${BOOTSTRAP_ENV}"
    return
  fi

  run_or_note docker compose -f "${VAULT_COMPOSE_FILE}" up -d "${bootstrap_services[@]}"

  for service_name in "${bootstrap_services[@]}"; do
    if [[ "${BOOTSTRAP_DRY_RUN}" == "1" ]]; then
      CREATED_RESOURCES+=("container:${service_name}")
      record_component "compose/${service_name}" "provisioned" "service would be started by bootstrap"
      continue
    fi

    if ! was_preexisting_container "${service_name}"; then
      CREATED_RESOURCES+=("container:${service_name}")
      record_component "compose/${service_name}" "provisioned" "service started by bootstrap"
    else
      record_component "compose/${service_name}" "already-present" "service existed before bootstrap"
    fi
  done
}

validate_nginx_vault_integration() {
  CURRENT_STEP="validate-nginx-vault"
  maybe_fail "validate-nginx-vault"

  local validation_mode="full"
  if [[ "${BOOTSTRAP_SKIP_RUNTIME_VALIDATION}" == "1" ]]; then
    validation_mode="static"
  fi

  BOOTSTRAP_SKIP_RUNTIME_VALIDATION="${BOOTSTRAP_SKIP_RUNTIME_VALIDATION}" \
    MAIN_COMPOSE_FILE="${MAIN_COMPOSE_FILE}" \
    VAULT_COMPOSE_FILE="${VAULT_COMPOSE_FILE}" \
    EDGE_COMPOSE_FILE="${MAIN_COMPOSE_FILE}" \
    VAULT_CONTAINER_NAME="${VAULT_CONTAINER_NAME}" \
    ./scripts/infra-bootstrap/validate-nginx-vault.sh

  record_component "validation/nginx-vault" "provisioned" "integration validation (${validation_mode}) passed"
}

run_parity_check() {
  CURRENT_STEP="parity-check"
  maybe_fail "parity-check"

  local parity_skip_docker="${PARITY_SKIP_DOCKER:-0}"
  if [[ "${BOOTSTRAP_DRY_RUN}" == "1" ]]; then
    parity_skip_docker="1"
  fi

  PARITY_ENV="${BOOTSTRAP_ENV}" \
    PARITY_SKIP_DOCKER="${parity_skip_docker}" \
    PARITY_REPORT_PATH="${BOOTSTRAP_PARITY_REPORT_PATH}" \
    PARITY_MATRIX_PATH="${BOOTSTRAP_MATRIX_PATH}" \
    PARITY_MAIN_COMPOSE_FILE="${MAIN_COMPOSE_FILE}" \
    PARITY_VAULT_COMPOSE_FILE="${VAULT_COMPOSE_FILE}" \
    ./scripts/infra-bootstrap/check-parity.sh

  record_component "validation/parity" "provisioned" "parity check passed"
}

main() {
  mkdir -p "${BOOTSTRAP_OUTPUT_DIR}"

  require_prerequisites

  while IFS= read -r network_name; do
    [[ -n "${network_name}" ]] || continue
    ensure_network "${network_name}"
  done < <(matrix_required_components_by_type "docker-network")

  while IFS= read -r volume_name; do
    [[ -n "${volume_name}" ]] || continue
    ensure_volume "${volume_name}"
  done < <(matrix_required_components_by_type "docker-volume")

  bootstrap_vault_foundation
  validate_nginx_vault_integration
  run_parity_check

  OVERALL_STATUS="success"
  ROLLBACK_STATUS="not-needed"
  write_report

  log "Bootstrap completed successfully"
  log "Report: ${BOOTSTRAP_REPORT_PATH}"
  log "Parity: ${BOOTSTRAP_PARITY_REPORT_PATH}"
}

main "$@"
