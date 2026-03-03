#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "${ROOT_DIR}"

REPLICATION_HEALTH_MODE="${REPLICATION_HEALTH_MODE:-simulate}"
MAIN_COMPOSE_FILE="${MAIN_COMPOSE_FILE:-docker-compose.yml}"
HA_COMPOSE_FILE="${HA_COMPOSE_FILE:-docker-compose.ha.yml}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
REPLICATION_HEALTH_OUTPUT_FILE="${REPLICATION_HEALTH_OUTPUT_FILE:-}"

log() {
  printf '[db-ha-health] %s\n' "$*" >&2
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

emit_json() {
  local replication_state="$1"
  local lag_seconds="$2"
  local io_running="$3"
  local sql_running="$4"

  {
    printf '{\n'
    printf '  "captured_at": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "replication_state": "%s",\n' "$(json_escape "${replication_state}")"
    printf '  "lag_seconds": %s,\n' "${lag_seconds}"
    printf '  "replica_io_running": "%s",\n' "$(json_escape "${io_running}")"
    printf '  "replica_sql_running": "%s"\n' "$(json_escape "${sql_running}")"
    printf '}\n'
  }
}

collect_live() {
  command -v docker >/dev/null 2>&1 || {
    log "docker command is required in live mode"
    exit 1
  }

  local -a compose_cmd=(docker compose -f "${MAIN_COMPOSE_FILE}" -f "${HA_COMPOSE_FILE}")
  local status_text
  status_text="$("${compose_cmd[@]}" exec -T mysql-replica mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "SHOW REPLICA STATUS\\G")"

  local io_running sql_running lag_seconds
  io_running="$(printf '%s\n' "${status_text}" | awk -F': ' '/Replica_IO_Running|Slave_IO_Running/ {print $2; exit}')"
  sql_running="$(printf '%s\n' "${status_text}" | awk -F': ' '/Replica_SQL_Running|Slave_SQL_Running/ {print $2; exit}')"
  lag_seconds="$(printf '%s\n' "${status_text}" | awk -F': ' '/Seconds_Behind_Source|Seconds_Behind_Master/ {print $2; exit}')"

  io_running="${io_running:-No}"
  sql_running="${sql_running:-No}"
  lag_seconds="${lag_seconds:-0}"
  if [[ "${lag_seconds}" == "NULL" ]]; then
    lag_seconds="0"
  fi

  local replication_state="degraded"
  if [[ "${io_running}" == "Yes" && "${sql_running}" == "Yes" ]]; then
    replication_state="running"
  fi

  emit_json "${replication_state}" "${lag_seconds}" "${io_running}" "${sql_running}"
}

collect_simulate() {
  emit_json "running" "2" "Yes" "Yes"
}

main() {
  local payload
  case "${REPLICATION_HEALTH_MODE}" in
    live)
      payload="$(collect_live)"
      ;;
    simulate)
      payload="$(collect_simulate)"
      ;;
    *)
      log "Invalid REPLICATION_HEALTH_MODE: ${REPLICATION_HEALTH_MODE} (use live|simulate)"
      exit 1
      ;;
  esac

  printf '%s\n' "${payload}"
  if [[ -n "${REPLICATION_HEALTH_OUTPUT_FILE}" ]]; then
    mkdir -p "$(dirname "${REPLICATION_HEALTH_OUTPUT_FILE}")"
    printf '%s\n' "${payload}" >"${REPLICATION_HEALTH_OUTPUT_FILE}"
    log "Wrote health output: ${REPLICATION_HEALTH_OUTPUT_FILE}"
  fi
}

main "$@"
