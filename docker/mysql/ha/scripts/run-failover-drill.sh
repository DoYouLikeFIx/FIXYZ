#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "${ROOT_DIR}"

FAILOVER_DRILL_MODE="${FAILOVER_DRILL_MODE:-simulate}"
FAILOVER_EVIDENCE_FILE="${FAILOVER_EVIDENCE_FILE:-docs/ops/evidence/database-ha-failover-drill-latest.json}"

RTO_FORMULA="RTO = t(all required probes green) - t(failover start)"
RPO_FORMULA="RPO = t(last committed transaction before outage) - t(last recovered committed transaction after failover)"

diff_seconds() {
  local start_ts="$1"
  local end_ts="$2"

  node -e '
const start = Date.parse(process.argv[1]);
const end = Date.parse(process.argv[2]);
if (!Number.isFinite(start) || !Number.isFinite(end)) {
  process.exit(1);
}
const diff = Math.round((end - start) / 1000);
if (diff < 0) {
  process.exit(1);
}
console.log(String(diff));
' "${start_ts}" "${end_ts}"
}

write_evidence() {
  local failover_start_ts="$1"
  local probes_green_ts="$2"
  local last_committed_before_outage_ts="$3"
  local last_recovered_after_failover_ts="$4"
  local mode="$5"

  local rto_seconds rpo_seconds
  rto_seconds="$(diff_seconds "${failover_start_ts}" "${probes_green_ts}")"
  rpo_seconds="$(diff_seconds "${last_committed_before_outage_ts}" "${last_recovered_after_failover_ts}")"

  mkdir -p "$(dirname "${FAILOVER_EVIDENCE_FILE}")"

  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "mode": "%s",\n' "${mode}"
    printf '  "measurement_formula": {\n'
    printf '    "rto": "%s",\n' "${RTO_FORMULA}"
    printf '    "rpo": "%s"\n' "${RPO_FORMULA}"
    printf '  },\n'
    printf '  "thresholds": {\n'
    printf '    "rto_seconds_max": 300,\n'
    printf '    "rpo_seconds_max": 60\n'
    printf '  },\n'
    printf '  "timestamps": {\n'
    printf '    "failover_start": "%s",\n' "${failover_start_ts}"
    printf '    "all_required_probes_green": "%s",\n' "${probes_green_ts}"
    printf '    "last_committed_transaction_before_outage": "%s",\n' "${last_committed_before_outage_ts}"
    printf '    "last_recovered_committed_transaction_after_failover": "%s"\n' "${last_recovered_after_failover_ts}"
    printf '  },\n'
    printf '  "measured": {\n'
    printf '    "rto_seconds": %s,\n' "${rto_seconds}"
    printf '    "rpo_seconds": %s\n' "${rpo_seconds}"
    printf '  },\n'
    printf '  "pass": {\n'
    printf '    "rto": %s,\n' "$([[ "${rto_seconds}" -le 300 ]] && echo true || echo false)"
    printf '    "rpo": %s\n' "$([[ "${rpo_seconds}" -le 60 ]] && echo true || echo false)"
    printf '  },\n'
    printf '  "required_probes": ["mysql-primary-write", "mysql-replica-read", "channel-service-health"]\n'
    printf '}\n'
  } >"${FAILOVER_EVIDENCE_FILE}"

  printf '[db-ha-failover] wrote evidence: %s\n' "${FAILOVER_EVIDENCE_FILE}"
}

run_simulation() {
  local failover_start_ts="2026-03-03T10:00:00Z"
  local probes_green_ts="2026-03-03T10:03:40Z"
  local last_committed_before_outage_ts="2026-03-03T09:59:35Z"
  local last_recovered_after_failover_ts="2026-03-03T10:00:15Z"

  write_evidence \
    "${failover_start_ts}" \
    "${probes_green_ts}" \
    "${last_committed_before_outage_ts}" \
    "${last_recovered_after_failover_ts}" \
    "simulate"
}

run_live() {
  local failover_start_ts="${FAILOVER_START_TS:-}"
  local probes_green_ts="${PROBES_GREEN_TS:-}"
  local last_committed_before_outage_ts="${LAST_COMMITTED_BEFORE_OUTAGE_TS:-}"
  local last_recovered_after_failover_ts="${LAST_RECOVERED_COMMITTED_AFTER_FAILOVER_TS:-}"

  if [[ -z "${failover_start_ts}" || -z "${probes_green_ts}" || -z "${last_committed_before_outage_ts}" || -z "${last_recovered_after_failover_ts}" ]]; then
    printf '[db-ha-failover] live mode requires FAILOVER_START_TS, PROBES_GREEN_TS, LAST_COMMITTED_BEFORE_OUTAGE_TS, LAST_RECOVERED_COMMITTED_AFTER_FAILOVER_TS\n' >&2
    exit 1
  fi

  write_evidence \
    "${failover_start_ts}" \
    "${probes_green_ts}" \
    "${last_committed_before_outage_ts}" \
    "${last_recovered_after_failover_ts}" \
    "live"
}

main() {
  case "${FAILOVER_DRILL_MODE}" in
    simulate)
      run_simulation
      ;;
    live)
      run_live
      ;;
    *)
      printf '[db-ha-failover] invalid FAILOVER_DRILL_MODE: %s (use simulate|live)\n' "${FAILOVER_DRILL_MODE}" >&2
      exit 1
      ;;
  esac
}

main "$@"
