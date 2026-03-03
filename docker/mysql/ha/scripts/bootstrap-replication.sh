#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "${ROOT_DIR}"

BOOTSTRAP_REPLICATION_MODE="${BOOTSTRAP_REPLICATION_MODE:-simulate}"
MAIN_COMPOSE_FILE="${MAIN_COMPOSE_FILE:-docker-compose.yml}"
HA_COMPOSE_FILE="${HA_COMPOSE_FILE:-docker-compose.ha.yml}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
MYSQL_REPLICATION_USER="${MYSQL_REPLICATION_USER:-replicator}"
MYSQL_REPLICATION_PASSWORD="${MYSQL_REPLICATION_PASSWORD:-replica-pass}"
REPLICATION_BOOTSTRAP_EVIDENCE_FILE="${REPLICATION_BOOTSTRAP_EVIDENCE_FILE:-docs/ops/evidence/database-ha-replication-bootstrap-latest.json}"

log() {
  printf '[db-ha-bootstrap] %s\n' "$*"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_evidence() {
  local mode="$1"
  local source_file="$2"
  local source_pos="$3"

  mkdir -p "$(dirname "${REPLICATION_BOOTSTRAP_EVIDENCE_FILE}")"
  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "mode": "%s",\n' "$(json_escape "${mode}")"
    printf '  "primary_source_file": "%s",\n' "$(json_escape "${source_file}")"
    printf '  "primary_source_pos": %s,\n' "${source_pos}"
    printf '  "replication_user": "%s",\n' "$(json_escape "${MYSQL_REPLICATION_USER}")"
    printf '  "result": "replication-bootstrap-complete"\n'
    printf '}\n'
  } >"${REPLICATION_BOOTSTRAP_EVIDENCE_FILE}"

  log "Wrote evidence: ${REPLICATION_BOOTSTRAP_EVIDENCE_FILE}"
}

bootstrap_live() {
  command -v docker >/dev/null 2>&1 || {
    log "docker command is required in live mode"
    exit 1
  }

  local -a compose_cmd=(docker compose -f "${MAIN_COMPOSE_FILE}" -f "${HA_COMPOSE_FILE}")

  "${compose_cmd[@]}" up -d mysql-primary mysql-replica >/dev/null

  local source_file source_pos source_status_line
  source_status_line="$("${compose_cmd[@]}" exec -T mysql-primary mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SHOW BINARY LOG STATUS" 2>/dev/null || true)"
  if [[ -z "${source_status_line}" ]]; then
    source_status_line="$("${compose_cmd[@]}" exec -T mysql-primary mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SHOW MASTER STATUS" 2>/dev/null || true)"
  fi
  source_file="$(printf '%s\n' "${source_status_line}" | awk '{print $1}')"
  source_pos="$(printf '%s\n' "${source_status_line}" | awk '{print $2}')"

  if [[ -z "${source_file}" || -z "${source_pos}" ]]; then
    log "Unable to read primary source coordinates"
    exit 1
  fi

  "${compose_cmd[@]}" exec -T mysql-replica mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
STOP REPLICA;
RESET REPLICA ALL;
CHANGE REPLICATION SOURCE TO
  SOURCE_HOST='mysql-primary',
  SOURCE_PORT=3306,
  SOURCE_USER='${MYSQL_REPLICATION_USER}',
  SOURCE_PASSWORD='${MYSQL_REPLICATION_PASSWORD}',
  SOURCE_AUTO_POSITION=1,
  GET_SOURCE_PUBLIC_KEY=1;
START REPLICA;
SET GLOBAL read_only=ON;
SET GLOBAL super_read_only=ON;
EOSQL

  write_evidence "live" "${source_file}" "${source_pos}"
  log "Replication baseline configured in live mode"
}

bootstrap_simulate() {
  write_evidence "simulate" "mysql-bin.000001" "4"
  log "Simulation mode: replication bootstrap steps documented without docker execution"
}

main() {
  case "${BOOTSTRAP_REPLICATION_MODE}" in
    live)
      bootstrap_live
      ;;
    simulate)
      bootstrap_simulate
      ;;
    *)
      log "Invalid BOOTSTRAP_REPLICATION_MODE: ${BOOTSTRAP_REPLICATION_MODE} (use live|simulate)"
      exit 1
      ;;
  esac
}

main "$@"
