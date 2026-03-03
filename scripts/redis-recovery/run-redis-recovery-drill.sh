#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

REDIS_RECOVERY_MODE="${REDIS_RECOVERY_MODE:-simulate}"
REDIS_RECOVERY_COMPOSE_FILE="${REDIS_RECOVERY_COMPOSE_FILE:-docker-compose.yml}"
REDIS_RECOVERY_CONFIRM_LIVE="${REDIS_RECOVERY_CONFIRM_LIVE:-0}"
ORDER_SESSION_TTL_SECONDS="${ORDER_SESSION_TTL_SECONDS:-600}"
MYSQL_USER_VALUE="${MYSQL_USER:-fix}"
MYSQL_PASSWORD_VALUE="${MYSQL_PASSWORD:-fix}"

RECOVERY_SECONDS_MAX=60
SUCCESS_QUORUM_PERCENT=100
STUCK_STATE_BUFFER_SECONDS=60
# TTL + 60 guardrail required by the story.
STUCK_STATE_THRESHOLD_SECONDS="$((ORDER_SESSION_TTL_SECONDS + STUCK_STATE_BUFFER_SECONDS))"

RECOVERY_DURATION_FORMULA="RECOVERY_DURATION = t(all required probes green) - t(redis restart start)"
CURRENT_DATE="$(date +%Y%m%d)"
REDIS_RECOVERY_OUTPUT_DIR="${REDIS_RECOVERY_OUTPUT_DIR:-docs/ops/redis-recovery/${CURRENT_DATE}}"
REDIS_RECOVERY_RUN_ID="${REDIS_RECOVERY_RUN_ID:-$(date -u +"%Y%m%dT%H%M%SZ")}"
SUMMARY_FILE="${REDIS_RECOVERY_OUTPUT_DIR}/summary-${REDIS_RECOVERY_RUN_ID}.json"
LATEST_SUMMARY_FILE="${REDIS_RECOVERY_OUTPUT_DIR}/latest-summary.json"
LOG_FILE="${REDIS_RECOVERY_OUTPUT_DIR}/drill-${REDIS_RECOVERY_RUN_ID}.log"
INDEX_FILE="${REDIS_RECOVERY_OUTPUT_DIR}/index.json"
PROBE_RESULTS_FILE="$(mktemp)"

REQUIRED_PROBE_NAMES=(
  "channel-health"
  "corebank-health"
  "fep-gateway-health"
  "fep-simulator-health"
  "auth-smoke"
  "session-smoke"
  "order-smoke"
)

REQUIRED_PROBE_URLS=(
  "http://channel-service:8080/actuator/health"
  "http://corebank-service:8081/actuator/health"
  "http://fep-gateway:8083/actuator/health"
  "http://fep-simulator:8082/actuator/health"
  "http://channel-service:8080/api/v1/ping"
  "http://fep-gateway:8083/api/v1/ping"
  "http://corebank-service:8081/api/v1/ping"
)

OUTAGE_PROBE_NAMES=(
  "auth-outage"
  "session-outage"
  "order-outage"
)

OUTAGE_PROBE_URLS=(
  "http://channel-service:8080/api/v1/errors/boom"
  "http://fep-gateway:8083/api/v1/errors/boom"
  "http://corebank-service:8081/api/v1/errors/boom"
)

mkdir -p "${REDIS_RECOVERY_OUTPUT_DIR}"
touch "${LOG_FILE}"

cleanup() {
  rm -f "${PROBE_RESULTS_FILE}"
}
trap cleanup EXIT

log() {
  printf '[redis-recovery] %s\n' "$*" | tee -a "${LOG_FILE}" >&2
}

iso_now() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

iso_offset_seconds() {
  local offset_seconds="$1"
  node -e '
const offset = Number(process.argv[1]);
const now = Date.now() + offset * 1000;
const iso = new Date(now).toISOString().replace(".000Z", "Z");
console.log(iso);
' -- "${offset_seconds}"
}

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

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    log "ERROR: required command not found: ${command_name}"
    exit 1
  fi
}

append_probe_result() {
  local phase="$1"
  local name="$2"
  local url="$3"
  local status="$4"
  local expected="$5"
  local pass="$6"
  local detail="$7"

  local compact_detail
  compact_detail="$(printf '%s' "${detail}" | tr '\r\n\t' ' ' | cut -c1-240)"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${phase}" "${name}" "${url}" "${status}" "${expected}" "${pass}" "${compact_detail}" >>"${PROBE_RESULTS_FILE}"
}

json_bool() {
  local value="$1"
  if [[ "${value}" == "true" ]]; then
    printf 'true'
  else
    printf 'false'
  fi
}

probe_via_compose_network() {
  local url="$1"
  local response

  # Internal probe command contract:
  # docker compose --profile ops-drills run --rm redis-recovery-probe
  response="$(
    docker compose -f "${REDIS_RECOVERY_COMPOSE_FILE}" --profile ops-drills run --rm redis-recovery-probe \
      sh -lc "status=\$(curl -sS -o /tmp/redis-recovery-body -w '%{http_code}' '${url}' || true); printf '%s\n' \"\${status}\"; cat /tmp/redis-recovery-body 2>/dev/null || true"
  )"

  printf '%s\n' "${response}"
}

probe_expect_status() {
  local phase="$1"
  local name="$2"
  local url="$3"
  local expected_status="$4"
  local require_normalized_body="$5"

  local response status body pass detail
  response="$(probe_via_compose_network "${url}")"
  status="$(printf '%s\n' "${response}" | head -n1 | tr -d '\r')"
  body="$(printf '%s\n' "${response}" | tail -n +2)"
  pass="false"
  detail="status=${status}, expected=${expected_status}"

  if [[ "${status}" == "${expected_status}" ]]; then
    pass="true"
  fi

  if [[ "${require_normalized_body}" == "true" ]]; then
    if printf '%s' "${body}" | grep -q '"code"' \
      && printf '%s' "${body}" | grep -q '"message"' \
      && printf '%s' "${body}" | grep -q '"path"'; then
      if [[ "${pass}" == "true" ]]; then
        detail="normalized=true, status=${status}"
      fi
    else
      pass="false"
      detail="normalized=false, status=${status}"
    fi
  fi

  append_probe_result "${phase}" "${name}" "${url}" "${status}" "${expected_status}" "${pass}" "${detail}"

  if [[ "${pass}" == "true" ]]; then
    return 0
  fi
  return 1
}

quick_status_ok() {
  local url="$1"
  local response status

  response="$(probe_via_compose_network "${url}")"
  status="$(printf '%s\n' "${response}" | head -n1 | tr -d '\r')"
  [[ "${status}" == "200" ]]
}

collect_stuck_state_breach_count_live() {
  local query breach_count
  query="SELECT COUNT(*) FROM order_session WHERE status IN ('PENDING','PROCESSING','EXECUTING','UNKNOWN','AUTH_PENDING','OTP_PENDING') AND TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) > ${STUCK_STATE_THRESHOLD_SECONDS};"

  breach_count="$(
    docker compose -f "${REDIS_RECOVERY_COMPOSE_FILE}" exec -T mysql \
      sh -lc "mysql -N -u${MYSQL_USER_VALUE} -p${MYSQL_PASSWORD_VALUE} channel_db -e \"${query}\"" 2>/dev/null \
      | tr -d '\r'
  )"

  if [[ -z "${breach_count}" ]]; then
    echo "-1"
    return
  fi

  echo "${breach_count}"
}

required_probes_json() {
  node - <<'NODE'
const probes = [
  "channel-health",
  "corebank-health",
  "fep-gateway-health",
  "fep-simulator-health",
  "auth-smoke",
  "session-smoke",
  "order-smoke",
];
console.log(JSON.stringify(probes));
NODE
}

write_summary() {
  local mode="$1"
  local restart_start_ts="$2"
  local all_green_ts="$3"
  local outage_start_ts="$4"
  local outage_end_ts="$5"
  local recovery_seconds="$6"
  local stuck_breach_count="$7"
  local success_quorum_actual="$8"
  local required_probe_passes="$9"
  local required_probe_total="${10}"

  local pass_recovery_target pass_quorum pass_stuck pass_overall
  pass_recovery_target="false"
  pass_quorum="false"
  pass_stuck="false"
  pass_overall="false"

  if [[ "${recovery_seconds}" -le "${RECOVERY_SECONDS_MAX}" ]]; then
    pass_recovery_target="true"
  fi

  if [[ "${success_quorum_actual}" -ge "${SUCCESS_QUORUM_PERCENT}" ]]; then
    pass_quorum="true"
  fi

  if [[ "${stuck_breach_count}" -eq 0 ]]; then
    pass_stuck="true"
  fi

  if [[ "${pass_recovery_target}" == "true" && "${pass_quorum}" == "true" && "${pass_stuck}" == "true" ]]; then
    pass_overall="true"
  fi

  REQUIRED_PROBES_JSON="$(required_probes_json)"

  MODE="${mode}" \
  RUN_ID="${REDIS_RECOVERY_RUN_ID}" \
  SUMMARY_FILE_PATH="${SUMMARY_FILE}" \
  PROBE_RESULTS_FILE_PATH="${PROBE_RESULTS_FILE}" \
  REQUIRED_PROBES_JSON="${REQUIRED_PROBES_JSON}" \
  GENERATED_AT="$(iso_now)" \
  RESTART_START_TS="${restart_start_ts}" \
  ALL_GREEN_TS="${all_green_ts}" \
  OUTAGE_START_TS="${outage_start_ts}" \
  OUTAGE_END_TS="${outage_end_ts}" \
  RECOVERY_SECONDS_VALUE="${recovery_seconds}" \
  RECOVERY_SECONDS_MAX_VALUE="${RECOVERY_SECONDS_MAX}" \
  SUCCESS_QUORUM_TARGET="${SUCCESS_QUORUM_PERCENT}" \
  SUCCESS_QUORUM_ACTUAL="${success_quorum_actual}" \
  REQUIRED_PROBE_PASSES="${required_probe_passes}" \
  REQUIRED_PROBE_TOTAL="${required_probe_total}" \
  ORDER_SESSION_TTL_VALUE="${ORDER_SESSION_TTL_SECONDS}" \
  STUCK_THRESHOLD_SECONDS="${STUCK_STATE_THRESHOLD_SECONDS}" \
  STUCK_BREACH_COUNT="${stuck_breach_count}" \
  PASS_RECOVERY_TARGET="$(json_bool "${pass_recovery_target}")" \
  PASS_QUORUM="$(json_bool "${pass_quorum}")" \
  PASS_STUCK="$(json_bool "${pass_stuck}")" \
  PASS_OVERALL="$(json_bool "${pass_overall}")" \
  RECOVERY_DURATION_FORMULA_VALUE="${RECOVERY_DURATION_FORMULA}" \
  node - <<'NODE'
const fs = require("node:fs");

const summaryFile = process.env.SUMMARY_FILE_PATH;
const requiredProbes = JSON.parse(process.env.REQUIRED_PROBES_JSON);
const probeLines = fs.existsSync(process.env.PROBE_RESULTS_FILE_PATH)
  ? fs.readFileSync(process.env.PROBE_RESULTS_FILE_PATH, "utf8").split("\n").filter(Boolean)
  : [];

const probes = probeLines.map((line) => {
  const [phase, name, url, status, expected_status, pass, detail] = line.split("\t");
  return {
    phase,
    name,
    url,
    status,
    expected_status,
    pass: pass === "true",
    detail,
  };
});

const summary = {
  generated_at: process.env.GENERATED_AT,
  run_id: process.env.RUN_ID,
  mode: process.env.MODE,
  internal_probe_context: "compose-network",
  measurement_formula: {
    recovery_duration: process.env.RECOVERY_DURATION_FORMULA_VALUE,
  },
  thresholds: {
    recovery_seconds_max: Number(process.env.RECOVERY_SECONDS_MAX_VALUE),
    success_quorum_percent: Number(process.env.SUCCESS_QUORUM_TARGET),
    order_session_ttl_seconds: Number(process.env.ORDER_SESSION_TTL_VALUE),
    stuck_state_threshold_seconds: Number(process.env.STUCK_THRESHOLD_SECONDS),
  },
  timestamps: {
    redis_restart_start: process.env.RESTART_START_TS,
    all_required_probes_green: process.env.ALL_GREEN_TS,
    outage_window_start: process.env.OUTAGE_START_TS,
    outage_window_end: process.env.OUTAGE_END_TS,
  },
  measured: {
    recovery_seconds: Number(process.env.RECOVERY_SECONDS_VALUE),
    required_probe_passes: Number(process.env.REQUIRED_PROBE_PASSES),
    required_probe_total: Number(process.env.REQUIRED_PROBE_TOTAL),
  },
  success_quorum_percent: Number(process.env.SUCCESS_QUORUM_ACTUAL),
  required_probes: requiredProbes,
  probe_results: probes,
  stuck_state: {
    ttl_seconds: Number(process.env.ORDER_SESSION_TTL_VALUE),
    threshold_seconds: Number(process.env.STUCK_THRESHOLD_SECONDS),
    breach_count: Number(process.env.STUCK_BREACH_COUNT),
  },
  pass: {
    recovery_target: process.env.PASS_RECOVERY_TARGET === "true",
    success_quorum: process.env.PASS_QUORUM === "true",
    stuck_state: process.env.PASS_STUCK === "true",
    overall: process.env.PASS_OVERALL === "true",
  },
};

fs.writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`);
NODE

  cp "${SUMMARY_FILE}" "${LATEST_SUMMARY_FILE}"
}

update_index() {
  SUMMARY_FILE_PATH="${SUMMARY_FILE}" \
  LOG_FILE_PATH="${LOG_FILE}" \
  INDEX_FILE_PATH="${INDEX_FILE}" \
  RUN_ID="${REDIS_RECOVERY_RUN_ID}" \
  MODE="${REDIS_RECOVERY_MODE}" \
  GENERATED_AT="$(iso_now)" \
  node - <<'NODE'
const fs = require("node:fs");

const indexFile = process.env.INDEX_FILE_PATH;
const summaryFile = process.env.SUMMARY_FILE_PATH;
const logFile = process.env.LOG_FILE_PATH;

let index = {
  generated_at: process.env.GENERATED_AT,
  runs: [],
};

if (fs.existsSync(indexFile)) {
  try {
    const parsed = JSON.parse(fs.readFileSync(indexFile, "utf8"));
    if (parsed && Array.isArray(parsed.runs)) {
      index = parsed;
    }
  } catch {
    // Keep default structure when existing file is malformed.
  }
}

index.generated_at = process.env.GENERATED_AT;
index.runs = index.runs.filter((entry) => entry.run_id !== process.env.RUN_ID);
index.runs.push({
  run_id: process.env.RUN_ID,
  mode: process.env.MODE,
  summary_file: summaryFile,
  log_file: logFile,
  generated_at: process.env.GENERATED_AT,
});

fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`);
NODE
}

run_simulation() {
  local restart_start_ts all_green_ts outage_start_ts outage_end_ts recovery_seconds
  local required_probe_total required_probe_passes success_quorum_actual stuck_breach_count

  log "Running simulation mode"

  restart_start_ts="$(iso_offset_seconds -42)"
  outage_start_ts="$(iso_offset_seconds -40)"
  outage_end_ts="$(iso_offset_seconds -30)"
  all_green_ts="$(iso_offset_seconds 0)"
  recovery_seconds="$(diff_seconds "${restart_start_ts}" "${all_green_ts}")"

  append_probe_result "outage" "auth-outage" "${OUTAGE_PROBE_URLS[0]}" "400" "400" "true" "normalized=true, deterministic BAD_REQUEST"
  append_probe_result "outage" "session-outage" "${OUTAGE_PROBE_URLS[1]}" "400" "400" "true" "normalized=true, deterministic BAD_REQUEST"
  append_probe_result "outage" "order-outage" "${OUTAGE_PROBE_URLS[2]}" "400" "400" "true" "normalized=true, deterministic BAD_REQUEST"

  append_probe_result "recovery" "channel-health" "${REQUIRED_PROBE_URLS[0]}" "200" "200" "true" "health green"
  append_probe_result "recovery" "corebank-health" "${REQUIRED_PROBE_URLS[1]}" "200" "200" "true" "health green"
  append_probe_result "recovery" "fep-gateway-health" "${REQUIRED_PROBE_URLS[2]}" "200" "200" "true" "health green"
  append_probe_result "recovery" "fep-simulator-health" "${REQUIRED_PROBE_URLS[3]}" "200" "200" "true" "health green"
  append_probe_result "recovery" "auth-smoke" "${REQUIRED_PROBE_URLS[4]}" "200" "200" "true" "smoke green"
  append_probe_result "recovery" "session-smoke" "${REQUIRED_PROBE_URLS[5]}" "200" "200" "true" "smoke green"
  append_probe_result "recovery" "order-smoke" "${REQUIRED_PROBE_URLS[6]}" "200" "200" "true" "smoke green"

  required_probe_total="${#REQUIRED_PROBE_NAMES[@]}"
  required_probe_passes="${required_probe_total}"
  success_quorum_actual=100
  stuck_breach_count=0

  write_summary \
    "simulate" \
    "${restart_start_ts}" \
    "${all_green_ts}" \
    "${outage_start_ts}" \
    "${outage_end_ts}" \
    "${recovery_seconds}" \
    "${stuck_breach_count}" \
    "${success_quorum_actual}" \
    "${required_probe_passes}" \
    "${required_probe_total}"
}

run_live() {
  local restart_start_ts all_green_ts outage_start_ts outage_end_ts recovery_seconds
  local required_probe_total required_probe_passes success_quorum_actual stuck_breach_count
  local attempt deadline_epoch now_epoch all_green outage_pass

  if [[ "${REDIS_RECOVERY_CONFIRM_LIVE}" != "1" ]]; then
    log "ERROR: live mode requires REDIS_RECOVERY_CONFIRM_LIVE=1 to avoid accidental restarts."
    exit 1
  fi

  require_command docker
  require_command node

  if [[ ! -f "${REDIS_RECOVERY_COMPOSE_FILE}" ]]; then
    log "ERROR: compose file not found: ${REDIS_RECOVERY_COMPOSE_FILE}"
    exit 1
  fi

  log "Restarting redis using compose file: ${REDIS_RECOVERY_COMPOSE_FILE}"
  restart_start_ts="$(iso_now)"
  docker compose -f "${REDIS_RECOVERY_COMPOSE_FILE}" restart redis >>"${LOG_FILE}" 2>&1

  outage_start_ts="$(iso_now)"
  outage_pass="true"
  for idx in "${!OUTAGE_PROBE_NAMES[@]}"; do
    if ! probe_expect_status "outage" "${OUTAGE_PROBE_NAMES[$idx]}" "${OUTAGE_PROBE_URLS[$idx]}" "400" "true"; then
      outage_pass="false"
    fi
  done
  outage_end_ts="$(iso_now)"

  required_probe_total="${#REQUIRED_PROBE_NAMES[@]}"
  required_probe_passes=0
  all_green="false"

  deadline_epoch="$(( $(date +%s) + RECOVERY_SECONDS_MAX ))"
  for attempt in $(seq 1 "${RECOVERY_SECONDS_MAX}"); do
    local_all_green="true"
    for idx in "${!REQUIRED_PROBE_NAMES[@]}"; do
      if ! quick_status_ok "${REQUIRED_PROBE_URLS[$idx]}"; then
        local_all_green="false"
        break
      fi
    done

    if [[ "${local_all_green}" == "true" ]]; then
      all_green="true"
      break
    fi

    now_epoch="$(date +%s)"
    if [[ "${now_epoch}" -ge "${deadline_epoch}" ]]; then
      break
    fi
    sleep 1
  done

  all_green_ts="$(iso_now)"
  for idx in "${!REQUIRED_PROBE_NAMES[@]}"; do
    if probe_expect_status "recovery" "${REQUIRED_PROBE_NAMES[$idx]}" "${REQUIRED_PROBE_URLS[$idx]}" "200" "false"; then
      required_probe_passes="$((required_probe_passes + 1))"
    fi
  done

  if [[ "${required_probe_total}" -gt 0 ]]; then
    success_quorum_actual="$(( required_probe_passes * 100 / required_probe_total ))"
  else
    success_quorum_actual=0
  fi

  recovery_seconds="$(diff_seconds "${restart_start_ts}" "${all_green_ts}")"
  stuck_breach_count="$(collect_stuck_state_breach_count_live)"

  if [[ "${outage_pass}" != "true" ]]; then
    log "Outage normalization checks failed"
  fi
  if [[ "${all_green}" != "true" ]]; then
    log "Required probes did not become green within ${RECOVERY_SECONDS_MAX}s"
  fi

  write_summary \
    "live" \
    "${restart_start_ts}" \
    "${all_green_ts}" \
    "${outage_start_ts}" \
    "${outage_end_ts}" \
    "${recovery_seconds}" \
    "${stuck_breach_count}" \
    "${success_quorum_actual}" \
    "${required_probe_passes}" \
    "${required_probe_total}"
}

main() {
  case "${REDIS_RECOVERY_MODE}" in
    simulate)
      run_simulation
      ;;
    live)
      run_live
      ;;
    *)
      log "ERROR: invalid REDIS_RECOVERY_MODE=${REDIS_RECOVERY_MODE} (use simulate|live)"
      exit 1
      ;;
  esac

  update_index
  log "Summary: ${SUMMARY_FILE}"
  log "Latest summary: ${LATEST_SUMMARY_FILE}"
  log "Index: ${INDEX_FILE}"
}

main "$@"
