#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "${ROOT_DIR}"

ALERT_SAMPLE_FILE="${ALERT_SAMPLE_FILE:-}"
ALERT_OUTPUT_FILE="${ALERT_OUTPUT_FILE:-docs/ops/evidence/database-ha-alerts-latest.json}"
ALERT_NOTIFICATION_TARGET="${ALERT_NOTIFICATION_TARGET:-ops-oncall}"

if [[ -z "${ALERT_SAMPLE_FILE}" ]]; then
  printf '[db-ha-alerts] ALERT_SAMPLE_FILE is required\n' >&2
  exit 1
fi

if [[ ! -f "${ALERT_SAMPLE_FILE}" ]]; then
  printf '[db-ha-alerts] sample file not found: %s\n' "${ALERT_SAMPLE_FILE}" >&2
  exit 1
fi

mkdir -p "$(dirname "${ALERT_OUTPUT_FILE}")"

# Alert policy baseline with explicit 10s interval and dedupe controls:
# - warn: lag >= 5s for 3 consecutive samples @10s interval
# - critical: lag >= 30s for 2 consecutive samples @10s interval
# - critical: replication stopped >= 60s (6 consecutive samples @10s interval)
# dedupe: suppress repeated alerts for the same severity/rule until recovery is observed.
NOTIFICATION_TARGET="${ALERT_NOTIFICATION_TARGET}" ALERT_SAMPLE_FILE="${ALERT_SAMPLE_FILE}" ALERT_OUTPUT_FILE="${ALERT_OUTPUT_FILE}" node <<'NODE'
const fs = require("node:fs");

const samplePath = process.env.ALERT_SAMPLE_FILE;
const outputPath = process.env.ALERT_OUTPUT_FILE;
const notificationTarget = process.env.NOTIFICATION_TARGET || "ops-oncall";

const warnRule = "warn: lag >= 5s for 3 consecutive samples @10s interval";
const criticalLagRule = "critical: lag >= 30s for 2 consecutive samples @10s interval";
const criticalStoppedRule = "critical: replication stopped >= 60s";

const sampleIntervalSeconds = 10;
const warnThreshold = 5;
const warnConsecutiveRequired = 3;
const criticalThreshold = 30;
const criticalConsecutiveRequired = 2;
const stoppedConsecutiveRequired = 6;

const lines = fs
  .readFileSync(samplePath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

let warnCount = 0;
let criticalLagCount = 0;
let stoppedCount = 0;

let warnActive = false;
let criticalLagActive = false;
let criticalStoppedActive = false;

const alerts = [];

for (const line of lines) {
  const sample = JSON.parse(line);
  const lagRaw = sample.lag_seconds;
  const lagCandidate =
    lagRaw === undefined || lagRaw === null || lagRaw === ""
      ? 0
      : Number(lagRaw);
  const lag = Number.isFinite(lagCandidate) ? lagCandidate : 0;

  const runningRaw = sample.replication_running;
  const running =
    runningRaw === undefined || runningRaw === null
      ? true
      : runningRaw === true ||
        runningRaw === "true" ||
        runningRaw === 1 ||
        runningRaw === "1";

  if (lag >= warnThreshold) {
    warnCount += 1;
  } else {
    warnCount = 0;
    warnActive = false;
  }

  if (lag >= criticalThreshold) {
    criticalLagCount += 1;
  } else {
    criticalLagCount = 0;
    criticalLagActive = false;
  }

  if (!running) {
    stoppedCount += 1;
  } else {
    stoppedCount = 0;
    criticalStoppedActive = false;
  }

  if (warnCount >= warnConsecutiveRequired && !warnActive) {
    warnActive = true;
    alerts.push({
      severity: "warn",
      triggered_at: sample.ts,
      rule: warnRule,
      context: {
        lag_seconds: lag,
        consecutive_samples: warnCount,
        sample_interval_seconds: sampleIntervalSeconds,
        notification_target: notificationTarget,
      },
    });
  }

  if (criticalLagCount >= criticalConsecutiveRequired && !criticalLagActive) {
    criticalLagActive = true;
    alerts.push({
      severity: "critical",
      triggered_at: sample.ts,
      rule: criticalLagRule,
      context: {
        lag_seconds: lag,
        consecutive_samples: criticalLagCount,
        sample_interval_seconds: sampleIntervalSeconds,
        notification_target: notificationTarget,
      },
    });
  }

  if (stoppedCount >= stoppedConsecutiveRequired && !criticalStoppedActive) {
    criticalStoppedActive = true;
    alerts.push({
      severity: "critical",
      triggered_at: sample.ts,
      rule: criticalStoppedRule,
      context: {
        replication_running: false,
        consecutive_samples: stoppedCount,
        duration_seconds: stoppedCount * sampleIntervalSeconds,
        sample_interval_seconds: sampleIntervalSeconds,
        notification_target: notificationTarget,
      },
    });
  }
}

const payload = {
  generated_at: new Date().toISOString(),
  sample_interval_seconds: sampleIntervalSeconds,
  dedupe: "severity+rule de-duplication until recovery",
  alerts,
};

fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`[db-ha-alerts] wrote alert output: ${outputPath}`);
NODE
