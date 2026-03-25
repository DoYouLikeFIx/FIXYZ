#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_ID="${ROLLBACK_REHEARSAL_BUILD_ID:-local}"
OUTPUT_DIR="${ROLLBACK_REHEARSAL_OUTPUT_DIR:-${ROOT_DIR}/_bmad-output/test-artifacts/epic-10/${BUILD_ID}/story-10-4}"
COMPOSE_FILE="${ROLLBACK_REHEARSAL_COMPOSE_FILE:-${ROOT_DIR}/docker-compose.yml}"
RUNBOOK_PATH="${ROOT_DIR}/docs/ops/full-stack-smoke-rehearsal-runbook.md"
CHECKLIST_TEMPLATE_PATH="${ROOT_DIR}/docs/ops/release-go-no-go-checklist-template.md"
SMOKE_SUMMARY_PATH="${ROLLBACK_REHEARSAL_SMOKE_SUMMARY_PATH:-${OUTPUT_DIR}/smoke-summary.json}"
SESSION_ISOLATION_SUMMARY_PATH="${ROLLBACK_REHEARSAL_SESSION_SUMMARY_PATH:-${OUTPUT_DIR}/session-isolation-summary.json}"
EDGE_SUMMARY_PATH="${ROLLBACK_REHEARSAL_EDGE_SUMMARY_PATH:-${OUTPUT_DIR}/edge-summary.json}"
ROLLBACK_SUMMARY_PATH="${OUTPUT_DIR}/rollback-rehearsal-summary.json"
GO_NO_GO_SUMMARY_PATH="${OUTPUT_DIR}/go-no-go-summary.json"
GO_NO_GO_MARKDOWN_PATH="${OUTPUT_DIR}/go-no-go-summary.md"
ROLLBACK_REHEARSAL_MODE="${ROLLBACK_REHEARSAL_MODE:-simulate}"
ROLLBACK_REHEARSAL_CONFIRM_EXECUTE="${ROLLBACK_REHEARSAL_CONFIRM_EXECUTE:-0}"
ROLLBACK_REHEARSAL_OPERATOR="${ROLLBACK_REHEARSAL_OPERATOR:-release-manager}"
ROLLBACK_REHEARSAL_CHANGE_REF="${ROLLBACK_REHEARSAL_CHANGE_REF:-CRQ-10.4}"
ROLLBACK_REHEARSAL_OWNER="${ROLLBACK_REHEARSAL_OWNER:-platform-oncall}"
ROLLBACK_REHEARSAL_TARGET_SERVICES="${ROLLBACK_REHEARSAL_TARGET_SERVICES:-edge-gateway channel-service corebank-service fep-gateway fep-simulator prometheus grafana}"
COMPOSE_ENV=()

STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
COMPLETED_AT=""
ROLLBACK_STATUS="failed"
GO_NO_GO_DECISION="no-go"
FINAL_MESSAGE=""
SMOKE_STATUS="unknown"
SESSION_STATUS="unknown"
EDGE_STATUS="unknown"
ROLLBACK_ACTION="not-run"
ROLLBACK_COMMAND=""
BLOCKERS=()

if [[ -n "${COMPOSE_PROFILES:-}" ]]; then
  COMPOSE_ENV+=("COMPOSE_PROFILES=${COMPOSE_PROFILES}")
fi
for required_env in VAULT_DEV_ROOT_TOKEN_ID INTERNAL_SECRET_BOOTSTRAP INTERNAL_SECRET; do
  if [[ -n "${!required_env:-}" ]]; then
    COMPOSE_ENV+=("${required_env}=${!required_env}")
  fi
done

fail() {
  FINAL_MESSAGE="$1"
  add_blocker "$1"
  echo "rollback rehearsal failed: $1" >&2
  exit 1
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

resolve_json_parser() {
  if command -v python >/dev/null 2>&1; then
    command -v python
    return
  fi
  if command -v python.exe >/dev/null 2>&1; then
    command -v python.exe
    return
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi
  if command -v node.exe >/dev/null 2>&1; then
    command -v node.exe
    return
  fi

  fail "json parser runtime is not available"
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

extract_status() {
  local path="$1"
  local parser
  local status
  parser="$(resolve_json_parser)"
  status="$(
    "${parser}" -c "import json, sys
payload = json.load(sys.stdin)
status = payload.get('status', '')
if not isinstance(status, str) or not status.strip():
    raise SystemExit(2)
sys.stdout.write(status.strip())" < "${path}" 2>/dev/null
  )"
  if [[ -z "${status}" ]]; then
    fail "unable to parse status from ${path}"
  fi
  printf '%s' "${status}"
}

add_blocker() {
  local blocker="$1"
  local existing
  for existing in "${BLOCKERS[@]}"; do
    if [[ "${existing}" == "${blocker}" ]]; then
      return
    fi
  done
  BLOCKERS+=("${blocker}")
}

render_blockers_json() {
  if [[ ${#BLOCKERS[@]} -eq 0 ]]; then
    printf '[]'
    return
  fi

  local rendered="["
  local index
  for index in "${!BLOCKERS[@]}"; do
    if [[ "${index}" -gt 0 ]]; then
      rendered+=", "
    fi
    rendered+="\"$(json_escape "${BLOCKERS[${index}]}")\""
  done
  rendered+="]"
  printf '%s' "${rendered}"
}

render_service_steps_json() {
  local services=()
  read -r -a services <<<"${ROLLBACK_REHEARSAL_TARGET_SERVICES}"
  local rendered="["
  local index
  for index in "${!services[@]}"; do
    if [[ "${index}" -gt 0 ]]; then
      rendered+=", "
    fi
    rendered+="{\"service\":\"$(json_escape "${services[${index}]}")\",\"action\":\"reapply-compose\"}"
  done
  rendered+="]"
  printf '%s' "${rendered}"
}

emit_reports() {
  mkdir -p "${OUTPUT_DIR}"
  COMPLETED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  cat >"${ROLLBACK_SUMMARY_PATH}" <<EOF
{
  "storyId": "10.4",
  "criterion": "AC3",
  "startedAt": "$(json_escape "${STARTED_AT}")",
  "completedAt": "$(json_escape "${COMPLETED_AT}")",
  "status": "$(json_escape "${ROLLBACK_STATUS}")",
  "mode": "$(json_escape "${ROLLBACK_REHEARSAL_MODE}")",
  "operator": "$(json_escape "${ROLLBACK_REHEARSAL_OPERATOR}")",
  "changeRef": "$(json_escape "${ROLLBACK_REHEARSAL_CHANGE_REF}")",
  "rollbackOwner": "$(json_escape "${ROLLBACK_REHEARSAL_OWNER}")",
  "recoveryStrategy": "deterministic re-run",
  "sourceChecks": {
    "smoke": "$(json_escape "${SMOKE_STATUS}")",
    "edge": "$(json_escape "${EDGE_STATUS}")",
    "sessionIsolation": "$(json_escape "${SESSION_STATUS}")"
  },
  "rollbackAction": "$(json_escape "${ROLLBACK_ACTION}")",
  "rollbackCommand": "$(json_escape "${ROLLBACK_COMMAND}")",
  "serviceSteps": $(render_service_steps_json),
  "message": "$(json_escape "${FINAL_MESSAGE}")",
  "evidence": {
    "smokeSummaryPath": "$(json_escape "${SMOKE_SUMMARY_PATH}")",
    "sessionIsolationSummaryPath": "$(json_escape "${SESSION_ISOLATION_SUMMARY_PATH}")",
    "runbookPath": "$(json_escape "${RUNBOOK_PATH}")",
    "checklistTemplatePath": "$(json_escape "${CHECKLIST_TEMPLATE_PATH}")"
  }
}
EOF

  cat >"${GO_NO_GO_SUMMARY_PATH}" <<EOF
{
  "storyId": "10.4",
  "criterion": "AC4",
  "startedAt": "$(json_escape "${STARTED_AT}")",
  "completedAt": "$(json_escape "${COMPLETED_AT}")",
  "decision": "$(json_escape "${GO_NO_GO_DECISION}")",
  "releaseReady": $(if [[ "${GO_NO_GO_DECISION}" == "go" ]]; then echo "true"; else echo "false"; fi),
  "operator": "$(json_escape "${ROLLBACK_REHEARSAL_OPERATOR}")",
  "changeRef": "$(json_escape "${ROLLBACK_REHEARSAL_CHANGE_REF}")",
  "checks": {
    "smoke": "$(json_escape "${SMOKE_STATUS}")",
    "edge": "$(json_escape "${EDGE_STATUS}")",
    "sessionIsolation": "$(json_escape "${SESSION_STATUS}")",
    "rollbackRehearsal": "$(json_escape "${ROLLBACK_STATUS}")"
  },
  "blockers": $(render_blockers_json),
  "linkedEvidence": {
    "smokeSummaryPath": "$(json_escape "${SMOKE_SUMMARY_PATH}")",
    "edgeSummaryPath": "$(json_escape "${EDGE_SUMMARY_PATH}")",
    "sessionIsolationSummaryPath": "$(json_escape "${SESSION_ISOLATION_SUMMARY_PATH}")",
    "rollbackSummaryPath": "$(json_escape "${ROLLBACK_SUMMARY_PATH}")",
    "runbookPath": "$(json_escape "${RUNBOOK_PATH}")",
    "checklistTemplatePath": "$(json_escape "${CHECKLIST_TEMPLATE_PATH}")"
  }
}
EOF

  cat >"${GO_NO_GO_MARKDOWN_PATH}" <<EOF
# Story 10.4 Go/No-Go Summary

- Decision: ${GO_NO_GO_DECISION}
- Operator: ${ROLLBACK_REHEARSAL_OPERATOR}
- Change Ref: ${ROLLBACK_REHEARSAL_CHANGE_REF}
- Rollback Owner: ${ROLLBACK_REHEARSAL_OWNER}
- Smoke: ${SMOKE_STATUS}
- Edge Validation: ${EDGE_STATUS}
- Session Isolation: ${SESSION_STATUS}
- Rollback Rehearsal: ${ROLLBACK_STATUS}
- Rollback Action: ${ROLLBACK_ACTION}
- Runbook: ${RUNBOOK_PATH}
- Checklist Template: ${CHECKLIST_TEMPLATE_PATH}

## Blockers
EOF

  if [[ ${#BLOCKERS[@]} -eq 0 ]]; then
    printf '%s\n' '- none' >>"${GO_NO_GO_MARKDOWN_PATH}"
  else
    local blocker
    for blocker in "${BLOCKERS[@]}"; do
      printf '%s\n' "- ${blocker}" >>"${GO_NO_GO_MARKDOWN_PATH}"
    done
  fi
}

trap emit_reports EXIT

main() {
  [[ -f "${RUNBOOK_PATH}" ]] || fail "missing rehearsal runbook: ${RUNBOOK_PATH}"
  [[ -f "${CHECKLIST_TEMPLATE_PATH}" ]] || fail "missing checklist template: ${CHECKLIST_TEMPLATE_PATH}"
  if [[ -f "${SMOKE_SUMMARY_PATH}" ]]; then
    SMOKE_STATUS="$(extract_status "${SMOKE_SUMMARY_PATH}")"
  else
    SMOKE_STATUS="missing"
    add_blocker "Smoke summary is missing."
  fi
  if [[ -f "${EDGE_SUMMARY_PATH}" ]]; then
    EDGE_STATUS="$(extract_status "${EDGE_SUMMARY_PATH}")"
  else
    EDGE_STATUS="missing"
    add_blocker "Edge validation summary is missing."
  fi
  if [[ -f "${SESSION_ISOLATION_SUMMARY_PATH}" ]]; then
    SESSION_STATUS="$(extract_status "${SESSION_ISOLATION_SUMMARY_PATH}")"
  else
    SESSION_STATUS="missing"
    add_blocker "Session isolation summary is missing."
  fi

  case "${ROLLBACK_REHEARSAL_MODE}" in
    simulate)
      ROLLBACK_ACTION="simulated"
      ROLLBACK_COMMAND="simulate deterministic re-run for ${ROLLBACK_REHEARSAL_TARGET_SERVICES}"
      ROLLBACK_STATUS="passed"
      ;;
    execute)
      [[ "${ROLLBACK_REHEARSAL_CONFIRM_EXECUTE}" == "1" ]] || fail "ROLLBACK_REHEARSAL_CONFIRM_EXECUTE=1 is required for execute mode"
      ROLLBACK_COMMAND="docker compose -f ${COMPOSE_FILE} up -d ${ROLLBACK_REHEARSAL_TARGET_SERVICES}"
      if ! compose_cmd up -d ${ROLLBACK_REHEARSAL_TARGET_SERVICES} >/dev/null; then
        ROLLBACK_ACTION="execution-failed"
        fail "docker compose rollback re-apply failed"
      fi
      ROLLBACK_ACTION="executed"
      ROLLBACK_STATUS="passed"
      ;;
    *)
      fail "unsupported rollback rehearsal mode: ${ROLLBACK_REHEARSAL_MODE}"
      ;;
  esac

  if [[ "${SMOKE_STATUS}" != "passed" ]]; then
    add_blocker "Smoke summary is ${SMOKE_STATUS}."
  fi
  if [[ "${EDGE_STATUS}" != "passed" ]]; then
    add_blocker "Edge validation summary is ${EDGE_STATUS}."
  fi
  if [[ "${SESSION_STATUS}" != "passed" ]]; then
    add_blocker "Session isolation summary is ${SESSION_STATUS}."
  fi
  if [[ "${ROLLBACK_STATUS}" != "passed" ]]; then
    add_blocker "Rollback rehearsal is ${ROLLBACK_STATUS}."
  fi

  if [[ ${#BLOCKERS[@]} -eq 0 ]]; then
    GO_NO_GO_DECISION="go"
    FINAL_MESSAGE="Rollback rehearsal completed and release checklist can be marked go."
  else
    GO_NO_GO_DECISION="no-go"
    FINAL_MESSAGE="Rollback rehearsal completed, but one or more release blockers remain."
  fi

  echo "Rollback rehearsal completed with decision: ${GO_NO_GO_DECISION}"
}

main "$@"
