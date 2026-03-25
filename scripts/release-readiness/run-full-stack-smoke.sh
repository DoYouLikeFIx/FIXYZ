#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${SMOKE_COMPOSE_FILE:-${ROOT_DIR}/docker-compose.yml}"
OUTPUT_DIR="${SMOKE_OUTPUT_DIR:-${ROOT_DIR}/_bmad-output/test-artifacts/epic-10/${SMOKE_BUILD_ID:-local}/story-10-4}"
EDGE_BASE_URL="${EDGE_BASE_URL:-https://127.0.0.1}"
MANDATORY_API_PATH="${SMOKE_MANDATORY_API_PATH:-/api/v1/auth/csrf}"
API_DOCS_URL="${SMOKE_API_DOCS_URL:-http://127.0.0.1:8080/v3/api-docs}"
SWAGGER_UI_URL="${SMOKE_SWAGGER_UI_URL:-http://127.0.0.1:8080/swagger-ui/index.html}"
OBSERVABILITY_VALIDATOR_PATH="${OBSERVABILITY_VALIDATOR_PATH:-${ROOT_DIR}/scripts/observability/validate-observability-stack.sh}"
SMOKE_START_TIMEOUT_SECONDS="${SMOKE_START_TIMEOUT_SECONDS:-120}"
SMOKE_STACK_READY_TIMEOUT_SECONDS="${SMOKE_STACK_READY_TIMEOUT_SECONDS:-300}"
SMOKE_POLL_INTERVAL_SECONDS="${SMOKE_POLL_INTERVAL_SECONDS:-2}"
SKIP_COMPOSE_UP="${SKIP_COMPOSE_UP:-0}"
REQUIRED_SERVICES=(
  "channel-service"
  "corebank-service"
  "fep-gateway"
  "fep-simulator"
  "edge-gateway"
  "prometheus"
  "grafana"
)
COMPOSE_ENV=()

SCRIPT_STATUS="failed"
FINAL_MESSAGE=""
STACK_BOOT_STATUS="pending"
HEALTH_STATUS="pending"
MANDATORY_API_STATUS="pending"
DOCS_STATUS="pending"
OBSERVABILITY_STATUS="pending"
MANDATORY_API_DURATION_MS="-1"
MANDATORY_API_HTTP_STATUS="0"

COLD_START_REPORT_PATH="${OUTPUT_DIR}/cold-start-timing.json"
SMOKE_SUMMARY_PATH="${OUTPUT_DIR}/smoke-summary.json"
DOCS_SUMMARY_PATH="${OUTPUT_DIR}/docs-summary.json"
OBSERVABILITY_LOG_PATH="${OUTPUT_DIR}/observability-validation.log"
COMPOSE_UP_LOG_PATH="${OUTPUT_DIR}/compose-up.log"

STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
COMPLETED_AT=""

if [[ -n "${COMPOSE_PROFILES:-}" ]]; then
  COMPOSE_ENV+=("COMPOSE_PROFILES=${COMPOSE_PROFILES}")
fi
for required_env in VAULT_DEV_ROOT_TOKEN_ID INTERNAL_SECRET_BOOTSTRAP INTERNAL_SECRET; do
  if [[ -n "${!required_env:-}" ]]; then
    COMPOSE_ENV+=("${required_env}=${!required_env}")
  fi
done

append_compose_profile() {
  local profile="$1"
  local existing="${COMPOSE_PROFILES:-}"

  if [[ -n "${existing}" ]]; then
    case ",${existing}," in
      *",${profile},"*) return ;;
      *) existing="${existing},${profile}" ;;
    esac
  else
    existing="${profile}"
  fi

  COMPOSE_PROFILES="${existing}"
  local updated=()
  local inserted=0
  for entry in "${COMPOSE_ENV[@]}"; do
    if [[ "${entry}" == COMPOSE_PROFILES=* ]]; then
      updated+=("COMPOSE_PROFILES=${COMPOSE_PROFILES}")
      inserted=1
    else
      updated+=("${entry}")
    fi
  done
  if [[ "${inserted}" == "0" ]]; then
    updated+=("COMPOSE_PROFILES=${COMPOSE_PROFILES}")
  fi
  COMPOSE_ENV=("${updated[@]}")
}

fail() {
  FINAL_MESSAGE="$1"
  echo "full-stack smoke failed: $1" >&2
  exit 1
}

normalize_compose_file_for_docker_host() {
  local raw_path="$1"
  if [[ "${raw_path}" =~ ^/mnt/([A-Za-z])/(.*)$ ]]; then
    local drive_letter="${BASH_REMATCH[1]^}"
    local windows_path="${BASH_REMATCH[2]//\//\\}"
    printf '%s:\\%s\n' "${drive_letter}" "${windows_path}"
    return
  fi
  printf '%s\n' "${raw_path}"
}

resolve_docker_cli() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    command -v docker
    return
  fi

  if command -v docker.exe >/dev/null 2>&1 && docker.exe compose version >/dev/null 2>&1; then
    command -v docker.exe
    return
  fi

  fail "docker compose CLI is not available"
}

compose_cmd() {
  local docker_cli
  local compose_file_arg

  docker_cli="$(resolve_docker_cli)"
  compose_file_arg="${COMPOSE_FILE}"
  if [[ "${docker_cli}" == *.exe ]]; then
    compose_file_arg="$(normalize_compose_file_for_docker_host "${COMPOSE_FILE}")"
  fi

  if [[ ${#COMPOSE_ENV[@]} -gt 0 ]]; then
    env "${COMPOSE_ENV[@]}" "${docker_cli}" compose -f "${compose_file_arg}" "$@"
  else
    "${docker_cli}" compose -f "${compose_file_arg}" "$@"
  fi
}

docker_cmd() {
  local docker_cli
  docker_cli="$(resolve_docker_cli)"
  "${docker_cli}" "$@"
}

assert_file() {
  local path="$1"
  [[ -f "${path}" ]] || fail "missing required file: ${path}"
}

now_ms() {
  date +%s%3N
}

json_escape() {
  local value="${1:-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "${value}"
}

relative_output_path() {
  local target_path="$1"
  if [[ "${target_path}" == "${OUTPUT_DIR}"/* ]]; then
    printf '%s' "${target_path#"${OUTPUT_DIR}/"}"
    return
  fi
  printf '%s' "${target_path}"
}

http_status() {
  local url="$1"
  local body_path="$2"
  curl -k -sS -o "${body_path}" -w '%{http_code}' "${url}"
}

wait_for_mandatory_api() {
  local deadline_seconds="${SMOKE_START_TIMEOUT_SECONDS}"
  local start_ms
  local current_ms
  local deadline_ms
  local body_path="${OUTPUT_DIR}/mandatory-api-response.json"
  local url="${EDGE_BASE_URL}${MANDATORY_API_PATH}"

  start_ms="$(now_ms)"
  deadline_ms="$((start_ms + (deadline_seconds * 1000)))"

  while true; do
    MANDATORY_API_HTTP_STATUS="$(http_status "${url}" "${body_path}")"
    if [[ "${MANDATORY_API_HTTP_STATUS}" == "200" ]]; then
      current_ms="$(now_ms)"
      MANDATORY_API_DURATION_MS="$((current_ms - start_ms))"
      if (( MANDATORY_API_DURATION_MS > deadline_seconds * 1000 )); then
        MANDATORY_API_STATUS="failed"
        fail "mandatory API exceeded ${deadline_seconds}s target (${MANDATORY_API_DURATION_MS}ms)"
      fi
      MANDATORY_API_STATUS="passed"
      return
    fi

    current_ms="$(now_ms)"
    if (( current_ms >= deadline_ms )); then
      MANDATORY_API_DURATION_MS="$((current_ms - start_ms))"
      MANDATORY_API_STATUS="failed"
      fail "mandatory API did not return 200 within ${deadline_seconds}s (last status ${MANDATORY_API_HTTP_STATUS})"
    fi

    sleep "${SMOKE_POLL_INTERVAL_SECONDS}"
  done
}

check_service_health() {
  local service
  local container_id
  local health_status

  for service in "${REQUIRED_SERVICES[@]}"; do
    container_id="$(compose_cmd ps -q "${service}" | tail -n1)"
    if [[ -z "${container_id}" ]]; then
      HEALTH_STATUS="failed"
      fail "service ${service} is not running"
    fi
    health_status="$(docker_cmd inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
    if [[ "${health_status}" != "healthy" && "${health_status}" != "running" ]]; then
      HEALTH_STATUS="failed"
      fail "service ${service} is not healthy (status=${health_status})"
    fi
  done

  HEALTH_STATUS="passed"
}

wait_for_required_services() {
  local start_ms
  local current_ms
  local deadline_ms

  start_ms="$(now_ms)"
  deadline_ms="$((start_ms + (SMOKE_STACK_READY_TIMEOUT_SECONDS * 1000)))"

  while true; do
    local all_ready="1"
    local service
    local container_id
    local health_status

    for service in "${REQUIRED_SERVICES[@]}"; do
      container_id="$(compose_cmd ps -q "${service}" | tail -n1)"
      if [[ -z "${container_id}" ]]; then
        all_ready="0"
        break
      fi
      health_status="$(docker_cmd inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}")"
      if [[ "${health_status}" != "healthy" && "${health_status}" != "running" ]]; then
        all_ready="0"
        break
      fi
    done

    if [[ "${all_ready}" == "1" ]]; then
      HEALTH_STATUS="passed"
      return
    fi

    current_ms="$(now_ms)"
    if (( current_ms >= deadline_ms )); then
      STACK_BOOT_STATUS="failed"
      HEALTH_STATUS="failed"
      fail "required services did not become healthy within ${SMOKE_STACK_READY_TIMEOUT_SECONDS}s"
    fi

    sleep "${SMOKE_POLL_INTERVAL_SECONDS}"
  done
}

check_docs_endpoints() {
  local api_docs_body="${OUTPUT_DIR}/api-docs.json"
  local swagger_ui_body="${OUTPUT_DIR}/swagger-ui.html"
  local api_docs_status
  local swagger_status

  api_docs_status="$(http_status "${API_DOCS_URL}" "${api_docs_body}")"
  if [[ "${api_docs_status}" != "200" ]]; then
    DOCS_STATUS="failed"
    fail "API docs endpoint returned ${api_docs_status}"
  fi
  if ! grep -q '"openapi"' "${api_docs_body}"; then
    DOCS_STATUS="failed"
    fail "API docs response missing openapi field"
  fi

  swagger_status="$(http_status "${SWAGGER_UI_URL}" "${swagger_ui_body}")"
  if [[ "${swagger_status}" != "200" ]]; then
    DOCS_STATUS="failed"
    fail "Swagger UI endpoint returned ${swagger_status}"
  fi
  if ! grep -Eqi 'Swagger UI|swagger-ui' "${swagger_ui_body}"; then
    DOCS_STATUS="failed"
    fail "Swagger UI response missing expected marker"
  fi

  DOCS_STATUS="passed"
}

run_observability_validation() {
  assert_file "${OBSERVABILITY_VALIDATOR_PATH}"
  if ! OBSERVABILITY_COMPOSE_FILE="${COMPOSE_FILE}" "${OBSERVABILITY_VALIDATOR_PATH}" >"${OBSERVABILITY_LOG_PATH}" 2>&1; then
    OBSERVABILITY_STATUS="failed"
    cat "${OBSERVABILITY_LOG_PATH}" >&2 || true
    fail "observability validator failed"
  fi

  OBSERVABILITY_STATUS="passed"
}

emit_reports() {
  COMPLETED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  mkdir -p "${OUTPUT_DIR}"

  cat >"${COLD_START_REPORT_PATH}" <<EOF
{
  "startedAt": "$(json_escape "${STARTED_AT}")",
  "completedAt": "$(json_escape "${COMPLETED_AT}")",
  "firstMandatoryApi": {
    "route": "$(json_escape "${MANDATORY_API_PATH}")",
    "httpStatus": ${MANDATORY_API_HTTP_STATUS},
    "durationMs": ${MANDATORY_API_DURATION_MS},
    "targetMs": $((SMOKE_START_TIMEOUT_SECONDS * 1000)),
    "withinTarget": $(if [[ "${MANDATORY_API_DURATION_MS}" -ge 0 && "${MANDATORY_API_DURATION_MS}" -le $((SMOKE_START_TIMEOUT_SECONDS * 1000)) && "${MANDATORY_API_STATUS}" == "passed" ]]; then echo "true"; else echo "false"; fi)
  },
  "status": "$(json_escape "${MANDATORY_API_STATUS}")",
  "message": "$(json_escape "${FINAL_MESSAGE}")"
}
EOF

  cat >"${DOCS_SUMMARY_PATH}" <<EOF
{
  "apiDocsUrl": "$(json_escape "${API_DOCS_URL}")",
  "swaggerUiUrl": "$(json_escape "${SWAGGER_UI_URL}")",
  "status": "$(json_escape "${DOCS_STATUS}")",
  "message": "$(json_escape "$(if [[ "${DOCS_STATUS}" == "passed" ]]; then echo "Critical API/docs endpoints responded correctly."; else echo "${FINAL_MESSAGE}"; fi)")"
}
EOF

  cat >"${SMOKE_SUMMARY_PATH}" <<EOF
{
  "storyId": "10.4",
  "startedAt": "$(json_escape "${STARTED_AT}")",
  "completedAt": "$(json_escape "${COMPLETED_AT}")",
  "status": "$(json_escape "${SCRIPT_STATUS}")",
  "message": "$(json_escape "${FINAL_MESSAGE}")",
  "scenarios": [
    {
      "id": "E10-SMOKE-001",
      "status": "$(if [[ "${MANDATORY_API_STATUS}" == "passed" && "${HEALTH_STATUS}" == "passed" ]]; then echo "passed"; else echo "failed"; fi)",
      "evidencePath": "$(json_escape "$(relative_output_path "${COLD_START_REPORT_PATH}")")"
    },
    {
      "id": "E10-SMOKE-002",
      "status": "$(if [[ "${DOCS_STATUS}" == "passed" ]]; then echo "passed"; else echo "failed"; fi)",
      "evidencePath": "$(json_escape "$(relative_output_path "${DOCS_SUMMARY_PATH}")")"
    },
    {
      "id": "E10-OBS-001",
      "status": "$(if [[ "${OBSERVABILITY_STATUS}" == "passed" ]]; then echo "passed"; else echo "failed"; fi)",
      "evidencePath": "$(json_escape "$(relative_output_path "${OBSERVABILITY_LOG_PATH}")")"
    },
    {
      "id": "E10-OBS-002",
      "status": "$(if [[ "${OBSERVABILITY_STATUS}" == "passed" ]]; then echo "passed"; else echo "failed"; fi)",
      "evidencePath": "$(json_escape "$(relative_output_path "${OBSERVABILITY_LOG_PATH}")")"
    }
  ],
  "checks": {
    "stackBoot": "$(json_escape "${STACK_BOOT_STATUS}")",
    "health": "$(json_escape "${HEALTH_STATUS}")",
    "mandatoryApi": "$(json_escape "${MANDATORY_API_STATUS}")",
    "docs": "$(json_escape "${DOCS_STATUS}")",
    "observability": "$(json_escape "${OBSERVABILITY_STATUS}")",
    "composeUpLog": "$(json_escape "$(relative_output_path "${COMPOSE_UP_LOG_PATH}")")"
  }
}
EOF
}

on_exit() {
  if [[ -z "${FINAL_MESSAGE}" ]]; then
    if [[ "${SCRIPT_STATUS}" == "passed" ]]; then
      FINAL_MESSAGE="Full-stack smoke checks completed."
    else
      FINAL_MESSAGE="Full-stack smoke checks failed."
    fi
  fi
  emit_reports
}

trap on_exit EXIT

main() {
  mkdir -p "${OUTPUT_DIR}"
  assert_file "${COMPOSE_FILE}"
  append_compose_profile "observability"

  if [[ "${SKIP_COMPOSE_UP}" != "1" ]]; then
    if ! compose_cmd up -d \
      mysql \
      mysql-grant-repair \
      redis \
      corebank-service \
      fep-gateway \
      fep-simulator \
      channel-service \
      edge-gateway \
      prometheus \
      grafana >"${COMPOSE_UP_LOG_PATH}" 2>&1; then
      STACK_BOOT_STATUS="failed"
      cat "${COMPOSE_UP_LOG_PATH}" >&2 || true
      fail "docker compose up failed"
    fi
  fi
  STACK_BOOT_STATUS="passed"

  wait_for_required_services
  wait_for_mandatory_api
  check_service_health
  check_docs_endpoints
  run_observability_validation

  SCRIPT_STATUS="passed"
  FINAL_MESSAGE="Cold-start smoke checks passed."
  echo "Cold-start smoke checks passed"
}

main "$@"
