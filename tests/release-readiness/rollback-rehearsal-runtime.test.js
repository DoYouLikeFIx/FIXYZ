"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function toBashPath(filePath) {
  if (process.platform !== "win32") {
    return filePath;
  }

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
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildBashCommand(scriptPath, options = {}) {
  const statements = [];

  for (const [name, value] of Object.entries(options.env || {})) {
    statements.push(`export ${name}=${quoteForBash(normalizeEnvValue(value))}`);
  }

  if ((options.prependPathEntries || []).length > 0) {
    const prepended = options.prependPathEntries.map((entry) => toBashPath(entry)).join(":");
    statements.push(`export PATH=${quoteForBash(`${prepended}:`)}"$PATH"`);
  }

  statements.push(`bash ${quoteForBash(toBashPath(path.join(repoRoot, scriptPath)))}`);
  return statements.join("; ");
}

function runBashScript(scriptPath, options = {}) {
  return spawnSync("bash", ["-lc", buildBashCommand(scriptPath, options)], {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: "utf8",
    timeout: options.timeout ?? 30000,
    maxBuffer: 1024 * 1024,
  });
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { encoding: "utf8", mode: 0o755 });
}

test("rollback rehearsal simulate mode writes passed rollback summary and go decision", () => {
  const tempDir = makeTempDir("rollback-rehearsal-simulate-");
  const outputDir = path.join(tempDir, "output");
  const smokeSummaryPath = path.join(tempDir, "smoke-summary.json");
  const sessionSummaryPath = path.join(tempDir, "session-isolation-summary.json");

  writeJson(smokeSummaryPath, { status: "passed" });
  writeJson(sessionSummaryPath, { status: "passed" });

  const result = runBashScript("scripts/release-readiness/run-rollback-rehearsal.sh", {
    env: {
      ROLLBACK_REHEARSAL_OUTPUT_DIR: outputDir,
      ROLLBACK_REHEARSAL_SMOKE_SUMMARY_PATH: smokeSummaryPath,
      ROLLBACK_REHEARSAL_SESSION_SUMMARY_PATH: sessionSummaryPath,
      ROLLBACK_REHEARSAL_MODE: "simulate",
      ROLLBACK_REHEARSAL_OPERATOR: "release-manager-a",
      ROLLBACK_REHEARSAL_CHANGE_REF: "CRQ-104",
      ROLLBACK_REHEARSAL_OWNER: "platform-oncall-a",
    },
  });

  assert.equal(result.status, 0, `rollback rehearsal failed: ${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /decision: go/);

  const rollbackSummary = loadJson(path.join(outputDir, "rollback-rehearsal-summary.json"));
  const goNoGoSummary = loadJson(path.join(outputDir, "go-no-go-summary.json"));

  assert.equal(rollbackSummary.status, "passed");
  assert.equal(rollbackSummary.mode, "simulate");
  assert.equal(rollbackSummary.rollbackAction, "simulated");
  assert.equal(goNoGoSummary.decision, "go");
  assert.equal(goNoGoSummary.releaseReady, true);
  assert.deepEqual(goNoGoSummary.blockers, []);
});

test("rollback rehearsal keeps release at no-go when linked smoke evidence is failed", () => {
  const tempDir = makeTempDir("rollback-rehearsal-no-go-");
  const outputDir = path.join(tempDir, "output");
  const smokeSummaryPath = path.join(tempDir, "smoke-summary.json");
  const sessionSummaryPath = path.join(tempDir, "session-isolation-summary.json");

  writeJson(smokeSummaryPath, { status: "failed" });
  writeJson(sessionSummaryPath, { status: "passed" });

  const result = runBashScript("scripts/release-readiness/run-rollback-rehearsal.sh", {
    env: {
      ROLLBACK_REHEARSAL_OUTPUT_DIR: outputDir,
      ROLLBACK_REHEARSAL_SMOKE_SUMMARY_PATH: smokeSummaryPath,
      ROLLBACK_REHEARSAL_SESSION_SUMMARY_PATH: sessionSummaryPath,
      ROLLBACK_REHEARSAL_MODE: "simulate",
    },
  });

  assert.equal(result.status, 0, `rollback rehearsal should still emit evidence for no-go: ${result.stderr}\n${result.stdout}`);

  const goNoGoSummary = loadJson(path.join(outputDir, "go-no-go-summary.json"));
  assert.equal(goNoGoSummary.decision, "no-go");
  assert.equal(goNoGoSummary.releaseReady, false);
  assert.match(goNoGoSummary.blockers.join("\n"), /Smoke summary is failed/);
});

test("rollback rehearsal execute mode runs docker compose re-apply when confirmed", () => {
  const tempDir = makeTempDir("rollback-rehearsal-execute-");
  const outputDir = path.join(tempDir, "output");
  const smokeSummaryPath = path.join(tempDir, "smoke-summary.json");
  const sessionSummaryPath = path.join(tempDir, "session-isolation-summary.json");
  const binDir = path.join(tempDir, "bin");
  const dockerLog = path.join(tempDir, "docker.log");

  fs.mkdirSync(binDir, { recursive: true });
  writeJson(smokeSummaryPath, { status: "passed" });
  writeJson(sessionSummaryPath, { status: "passed" });
  writeExecutable(path.join(binDir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then
  exit 0
fi
exit 0
`);

  const result = runBashScript("scripts/release-readiness/run-rollback-rehearsal.sh", {
    prependPathEntries: [binDir],
    env: {
      ROLLBACK_REHEARSAL_OUTPUT_DIR: outputDir,
      ROLLBACK_REHEARSAL_SMOKE_SUMMARY_PATH: smokeSummaryPath,
      ROLLBACK_REHEARSAL_SESSION_SUMMARY_PATH: sessionSummaryPath,
      ROLLBACK_REHEARSAL_MODE: "execute",
      ROLLBACK_REHEARSAL_CONFIRM_EXECUTE: "1",
      MOCK_DOCKER_LOG: dockerLog,
    },
  });

  assert.equal(result.status, 0, `execute-mode rollback rehearsal failed: ${result.stderr}\n${result.stdout}`);

  const rollbackSummary = loadJson(path.join(outputDir, "rollback-rehearsal-summary.json"));
  assert.equal(rollbackSummary.rollbackAction, "executed");

  const dockerCalls = fs.readFileSync(dockerLog, "utf8");
  assert.match(dockerCalls, /compose version/);
  assert.match(dockerCalls, /compose -f .* up -d edge-gateway channel-service corebank-service fep-gateway fep-simulator prometheus grafana/);
});
