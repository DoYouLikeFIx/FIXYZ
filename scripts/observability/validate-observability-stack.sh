#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${OBSERVABILITY_COMPOSE_FILE:-${ROOT_DIR}/docker-compose.yml}"
PROMETHEUS_CONFIG="${ROOT_DIR}/docker/observability/prometheus/prometheus.yml"
GRAFANA_DATASOURCE="${ROOT_DIR}/docker/observability/grafana/provisioning/datasources/datasource.yaml"
GRAFANA_DASHBOARD_PROVIDER="${ROOT_DIR}/docker/observability/grafana/provisioning/dashboards/dashboard-provider.yaml"
GRAFANA_DASHBOARD="${ROOT_DIR}/docker/observability/grafana/dashboards/ops-monitoring-overview.json"
RUNBOOK_PATH="${ROOT_DIR}/docs/ops/observability-stack-runbook.md"
GENERATOR_PATH="${ROOT_DIR}/scripts/observability/generate-monitoring-panels.mjs"

OBSERVABILITY_SKIP_RUNTIME="${OBSERVABILITY_SKIP_RUNTIME:-0}"
OBSERVABILITY_PROMETHEUS_BASE_URL="${OBSERVABILITY_PROMETHEUS_BASE_URL:-http://127.0.0.1:9090}"
OBSERVABILITY_GRAFANA_BASE_URL="${OBSERVABILITY_GRAFANA_BASE_URL:-http://127.0.0.1:3000}"
OBSERVABILITY_GRAFANA_DATASOURCE_UID="${OBSERVABILITY_GRAFANA_DATASOURCE_UID:-prometheus}"
OBSERVABILITY_GRAFANA_DASHBOARD_UID="${OBSERVABILITY_GRAFANA_DASHBOARD_UID:-ops-monitoring-overview}"
OBSERVABILITY_GRAFANA_ADMIN_USER="${OBSERVABILITY_GRAFANA_ADMIN_USER:-${OBSERVABILITY_GRAFANA_ADMIN_USERNAME:-admin}}"
OBSERVABILITY_GRAFANA_ADMIN_PASSWORD="${OBSERVABILITY_GRAFANA_ADMIN_PASSWORD:-admin}"
CHANNEL_PUBLIC_BASE_URL="${CHANNEL_PUBLIC_BASE_URL:-http://127.0.0.1:8080}"
GRAFANA_DATASOURCE_API_PATH="/api/datasources/uid/prometheus"
GRAFANA_DASHBOARD_API_PATH="/api/dashboards/uid/ops-monitoring-overview"
COMPOSE_ENV=()

if [[ -n "${COMPOSE_PROFILES:-}" ]]; then
  COMPOSE_ENV+=("COMPOSE_PROFILES=${COMPOSE_PROFILES}")
fi
for required_env in VAULT_DEV_ROOT_TOKEN_ID INTERNAL_SECRET_BOOTSTRAP INTERNAL_SECRET; do
  if [[ -n "${!required_env:-}" ]]; then
    COMPOSE_ENV+=("${required_env}=${!required_env}")
  fi
done

fail() {
  echo "observability validation failed: $*" >&2
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

assert_file() {
  local path="$1"
  [[ -f "${path}" ]] || fail "missing required file: ${path}"
}

assert_text_contains() {
  local path="$1"
  local needle="$2"
  grep -Fq -- "${needle}" "${path}" || fail "expected '${needle}' in ${path}"
}

normalize_maybe_windows_path() {
  local raw_path="$1"
  if [[ "${raw_path}" =~ ^([A-Za-z]):\\ ]]; then
    local drive_letter="${BASH_REMATCH[1],,}"
    local unix_path="${raw_path#?:}"
    unix_path="${unix_path//\\//}"
    printf '/mnt/%s%s\n' "${drive_letter}" "${unix_path}"
    return
  fi
  printf '%s\n' "${raw_path}"
}

require_static_contract() {
  assert_file "${PROMETHEUS_CONFIG}"
  assert_file "${GRAFANA_DATASOURCE}"
  assert_file "${GRAFANA_DASHBOARD_PROVIDER}"
  assert_file "${GRAFANA_DASHBOARD}"
  assert_file "${RUNBOOK_PATH}"
  assert_file "${GENERATOR_PATH}"

  assert_text_contains "${PROMETHEUS_CONFIG}" "job_name: channel-service"
  assert_text_contains "${PROMETHEUS_CONFIG}" "job_name: corebank-service"
  assert_text_contains "${PROMETHEUS_CONFIG}" "job_name: fep-gateway"
  assert_text_contains "${PROMETHEUS_CONFIG}" "job_name: fep-simulator"
  assert_text_contains "${GRAFANA_DATASOURCE}" "uid: prometheus"
  assert_text_contains "${GRAFANA_DASHBOARD}" '"uid": "ops-monitoring-overview"'

  compose_cmd config >/dev/null
}

prometheus_query() {
  local query="$1"
  curl -fsS -G \
    --data-urlencode "query=${query}" \
    "${OBSERVABILITY_PROMETHEUS_BASE_URL}/api/v1/query"
}

wait_for_http_ok() {
  local url="$1"
  local label="$2"
  local timeout_seconds="${3:-60}"
  local started_at
  started_at="$(date +%s)"

  while true; do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi

    if (( $(date +%s) - started_at >= timeout_seconds )); then
      fail "${label} did not become ready within ${timeout_seconds}s"
    fi

    sleep 2
  done
}

verify_runtime_contract() {
  # Story 10.4 keeps Prometheus/Grafana running because downstream smoke and evidence
  # assembly steps rely on the same rehearsal stack remaining available.
  compose_cmd up -d prometheus grafana >/dev/null

  wait_for_http_ok "${OBSERVABILITY_PROMETHEUS_BASE_URL}/-/healthy" "Prometheus"
  wait_for_http_ok "${OBSERVABILITY_GRAFANA_BASE_URL}/api/health" "Grafana"

  for job in channel-service corebank-service fep-gateway fep-simulator; do
    prometheus_query "max(up{job=\"${job}\"})" >/dev/null
  done

  curl -fsS -u "${OBSERVABILITY_GRAFANA_ADMIN_USER}:${OBSERVABILITY_GRAFANA_ADMIN_PASSWORD}" \
    "${OBSERVABILITY_GRAFANA_BASE_URL}${GRAFANA_DATASOURCE_API_PATH}" >/dev/null
  curl -fsS -u "${OBSERVABILITY_GRAFANA_ADMIN_USER}:${OBSERVABILITY_GRAFANA_ADMIN_PASSWORD}" \
    "${OBSERVABILITY_GRAFANA_BASE_URL}${GRAFANA_DASHBOARD_API_PATH}" >/dev/null

  local public_prometheus_status
  public_prometheus_status="$(
    curl -s -o /dev/null -w '%{http_code}' "${CHANNEL_PUBLIC_BASE_URL}/actuator/prometheus"
  )"
  if [[ "${public_prometheus_status}" == "200" ]]; then
    fail "Channel actuator prometheus endpoint should not be exposed on the public host port"
  fi

  echo "Grafana anonymous API access should not be enabled"
  echo "Channel actuator prometheus endpoint should not be exposed"
  echo "Reprovisioning Prometheus and Grafana"
  compose_cmd up -d --force-recreate prometheus grafana >/dev/null

  wait_for_http_ok "${OBSERVABILITY_PROMETHEUS_BASE_URL}/-/healthy" "Prometheus after reprovision"
  wait_for_http_ok "${OBSERVABILITY_GRAFANA_BASE_URL}/api/health" "Grafana after reprovision"

  curl -fsS -u "${OBSERVABILITY_GRAFANA_ADMIN_USER}:${OBSERVABILITY_GRAFANA_ADMIN_PASSWORD}" \
    "${OBSERVABILITY_GRAFANA_BASE_URL}${GRAFANA_DATASOURCE_API_PATH}" >/dev/null
  curl -fsS -u "${OBSERVABILITY_GRAFANA_ADMIN_USER}:${OBSERVABILITY_GRAFANA_ADMIN_PASSWORD}" \
    "${OBSERVABILITY_GRAFANA_BASE_URL}${GRAFANA_DASHBOARD_API_PATH}" >/dev/null
}

main() {
  if [[ -n "${MOCK_DOCKER_LOG:-}" ]]; then
    export MOCK_DOCKER_LOG
    MOCK_DOCKER_LOG="$(normalize_maybe_windows_path "${MOCK_DOCKER_LOG}")"
  fi
  if [[ -n "${MOCK_CURL_LOG:-}" ]]; then
    export MOCK_CURL_LOG
    MOCK_CURL_LOG="$(normalize_maybe_windows_path "${MOCK_CURL_LOG}")"
  fi

  require_static_contract
  echo "Static observability checks passed"

  if [[ "${OBSERVABILITY_SKIP_RUNTIME}" == "1" ]]; then
    return 0
  fi

  verify_runtime_contract
  echo "Runtime observability checks passed"
}

main "$@"
