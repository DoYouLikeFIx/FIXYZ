#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUILD_ID="${EDGE_VALIDATION_BUILD_ID:-local}"
OUTPUT_DIR="${EDGE_VALIDATION_OUTPUT_DIR:-${ROOT_DIR}/_bmad-output/test-artifacts/epic-10/${BUILD_ID}/story-10-4}"
EDGE_VALIDATOR_PATH="${EDGE_VALIDATOR_PATH:-${ROOT_DIR}/docker/nginx/scripts/validate-edge-gateway.sh}"
EDGE_LOG_PATH="${OUTPUT_DIR}/edge-gateway-validation.log"
EDGE_SUMMARY_PATH="${OUTPUT_DIR}/edge-summary.json"

relative_output_path() {
  local target_path="$1"
  if [[ "${target_path}" == "${OUTPUT_DIR}"/* ]]; then
    printf '%s' "${target_path#"${OUTPUT_DIR}/"}"
    return
  fi
  printf '%s' "${target_path}"
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

main() {
  mkdir -p "${OUTPUT_DIR}"

  local status="passed"
  local message="Edge gateway validation passed."

  if ! bash "${EDGE_VALIDATOR_PATH}" >"${EDGE_LOG_PATH}" 2>&1; then
    status="failed"
    message="Edge gateway validation failed."
    cat "${EDGE_LOG_PATH}" >&2 || true
  fi

  cat >"${EDGE_SUMMARY_PATH}" <<EOF
{
  "storyId": "10.4",
  "criterion": "edge-validation",
  "status": "$(json_escape "${status}")",
  "message": "$(json_escape "${message}")",
  "evidence": {
    "logPath": "$(json_escape "$(relative_output_path "${EDGE_LOG_PATH}")")"
  }
}
EOF

  if [[ "${status}" != "passed" ]]; then
    exit 1
  fi
}

main "$@"
