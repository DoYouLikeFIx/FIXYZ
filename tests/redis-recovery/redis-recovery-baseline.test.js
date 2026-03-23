"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

const composePath = path.join(repoRoot, "docker-compose.yml");
const drillScriptPath = path.join(
  repoRoot,
  "scripts",
  "redis-recovery",
  "run-redis-recovery-drill.sh",
);
const runbookPath = path.join(repoRoot, "docs", "ops", "redis-recovery-runbook.md");
const recoveryDocsRoot = path.join(repoRoot, "docs", "ops", "redis-recovery");
const recoveryDocsReadmePath = path.join(recoveryDocsRoot, "README.md");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function toBashPath(filePath) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
}

function normalizeEnvValue(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return toBashPath(value);
  }
  return value.replace(/\\/g, "/");
}

function quoteForBash(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function mustInclude(text, needle) {
  assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

function runBashScript(scriptPath, env = {}) {
  const envAssignments = Object.entries(env)
    .map(([key, value]) => `${key}=${quoteForBash(normalizeEnvValue(value))}`);
  const command = [
    ...envAssignments,
    quoteForBash("/bin/bash"),
    quoteForBash(toBashPath(scriptPath)),
  ].join(" ");

  return spawnSync("bash", ["-lc", command], {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("Redis recovery baseline assets exist for script + docs + indexed evidence root", () => {
  for (const filePath of [
    composePath,
    drillScriptPath,
    runbookPath,
    recoveryDocsRoot,
    recoveryDocsReadmePath,
  ]) {
    assert.ok(fs.existsSync(filePath), `missing redis recovery asset: ${filePath}`);
  }
});

test("Compose defines redis recovery probe runner in compose-network context", () => {
  const compose = readText(composePath);

  mustInclude(compose, "redis-recovery-probe:");
  mustInclude(compose, "profiles:");
  mustInclude(compose, "ops-drills");
  mustInclude(compose, "image: curlimages/curl");
  mustInclude(compose, "fix-net");
});

test("Redis recovery drill script encodes NFR-R3 formulas, quorum, and stuck-state guardrail", () => {
  const script = readText(drillScriptPath);

  mustInclude(script, "RECOVERY_DURATION = t(all required probes green) - t(redis restart start)");
  mustInclude(script, "RECOVERY_SECONDS_MAX=60");
  mustInclude(script, "SUCCESS_QUORUM_PERCENT=100");
  mustInclude(script, "ORDER_SESSION_TTL_SECONDS");
  mustInclude(script, "TTL + 60");
  mustInclude(script, "channel-health");
  mustInclude(script, "corebank-health");
  mustInclude(script, "fep-gateway-health");
  mustInclude(script, "fep-simulator-health");
  mustInclude(script, "auth-smoke");
  mustInclude(script, "session-smoke");
  mustInclude(script, "order-smoke");
  mustInclude(script, "docker compose --profile ops-drills up -d redis-recovery-probe");
  mustInclude(script, "docker compose --profile ops-drills exec -T redis-recovery-probe");
  mustInclude(script, "REDIS_RECOVERY_CONFIRM_LIVE");
});

test("Simulation mode emits timestamped summary + index with 100 percent pass quorum", () => {
  const tempDir = makeTempDir("redis-recovery-");
  const result = runBashScript(drillScriptPath, {
    REDIS_RECOVERY_MODE: "simulate",
    REDIS_RECOVERY_OUTPUT_DIR: tempDir,
  });

  assert.equal(result.status, 0, `simulate drill failed: ${result.stderr}\n${result.stdout}`);

  const latestSummaryPath = path.join(tempDir, "latest-summary.json");
  const indexPath = path.join(tempDir, "index.json");
  assert.ok(fs.existsSync(latestSummaryPath), `missing latest summary: ${latestSummaryPath}`);
  assert.ok(fs.existsSync(indexPath), `missing index file: ${indexPath}`);

  const summary = JSON.parse(fs.readFileSync(latestSummaryPath, "utf8"));
  assert.equal(
    summary.measurement_formula.recovery_duration,
    "RECOVERY_DURATION = t(all required probes green) - t(redis restart start)",
  );
  assert.equal(summary.thresholds.recovery_seconds_max, 60);
  assert.equal(summary.success_quorum_percent, 100);
  assert.equal(summary.pass.success_quorum, true);
  assert.ok(summary.measured.recovery_seconds <= 60);
  assert.equal(summary.internal_probe_context, "compose-network");
  assert.equal(summary.stuck_state.threshold_seconds, 660);
  assert.equal(summary.stuck_state.breach_count, 0);
  assert.ok(Array.isArray(summary.required_probes));
  assert.ok(summary.required_probes.length >= 7, "expected health + smoke probes");
});

test("Live mode requires explicit confirmation guard to prevent accidental restarts", () => {
  const result = runBashScript(drillScriptPath, {
    REDIS_RECOVERY_MODE: "live",
    REDIS_RECOVERY_CONFIRM_LIVE: "",
  });

  assert.notEqual(result.status, 0, "live mode should fail without explicit confirmation");
  assert.match(result.stdout + result.stderr, /REDIS_RECOVERY_CONFIRM_LIVE=1/);
});

test("Invalid mode fails fast with explicit mode guidance", () => {
  const result = runBashScript(drillScriptPath, {
    REDIS_RECOVERY_MODE: "invalid-mode",
  });

  assert.notEqual(result.status, 0, "invalid mode should fail");
  assert.match(result.stdout + result.stderr, /REDIS_RECOVERY_MODE/);
  assert.match(result.stdout + result.stderr, /simulate\|live/);
});

test("Simulation respects TTL override and updates stuck-state threshold", () => {
  const tempDir = makeTempDir("redis-recovery-ttl-");
  const result = runBashScript(drillScriptPath, {
    REDIS_RECOVERY_MODE: "simulate",
    REDIS_RECOVERY_OUTPUT_DIR: tempDir,
    ORDER_SESSION_TTL_SECONDS: "900",
  });

  assert.equal(result.status, 0, `simulate drill failed: ${result.stderr}\n${result.stdout}`);

  const latestSummaryPath = path.join(tempDir, "latest-summary.json");
  const summary = JSON.parse(fs.readFileSync(latestSummaryPath, "utf8"));

  assert.equal(summary.stuck_state.ttl_seconds, 900);
  assert.equal(summary.stuck_state.threshold_seconds, 960);
  assert.equal(summary.pass.stuck_state, true);
});

test("Index keeps a single run entry when run_id is reused", () => {
  const tempDir = makeTempDir("redis-recovery-index-");
  const runId = "20260303T140000Z";

  const first = runBashScript(drillScriptPath, {
    REDIS_RECOVERY_MODE: "simulate",
    REDIS_RECOVERY_OUTPUT_DIR: tempDir,
    REDIS_RECOVERY_RUN_ID: runId,
  });
  assert.equal(first.status, 0, `first simulate drill failed: ${first.stderr}\n${first.stdout}`);

  const second = runBashScript(drillScriptPath, {
    REDIS_RECOVERY_MODE: "simulate",
    REDIS_RECOVERY_OUTPUT_DIR: tempDir,
    REDIS_RECOVERY_RUN_ID: runId,
  });
  assert.equal(second.status, 0, `second simulate drill failed: ${second.stderr}\n${second.stdout}`);

  const indexPath = path.join(tempDir, "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const matchingRuns = index.runs.filter((item) => item.run_id === runId);

  assert.equal(matchingRuns.length, 1, "duplicate run_id entries should be deduplicated");
  assert.match(matchingRuns[0].summary_file, new RegExp(`summary-${runId}\\.json$`));
});

test("Runbook defines restart procedure, failure signatures, and escalation matrix", () => {
  const runbook = readText(runbookPath);

  mustInclude(runbook, "docker compose restart redis");
  mustInclude(runbook, "compose network context");
  mustInclude(runbook, "60 seconds");
  mustInclude(runbook, "100% pass");
  mustInclude(runbook, "TTL + 60s");
  mustInclude(runbook, "Failure signatures");
  mustInclude(runbook, "Escalation path");
  mustInclude(runbook, "runbook-only rehearsal");
});
