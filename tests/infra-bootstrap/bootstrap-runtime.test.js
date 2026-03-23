"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

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

function runBashScript(scriptPath, env = {}) {
  const envAssignments = Object.entries(env)
    .map(([key, value]) => `${key}=${quoteForBash(normalizeEnvValue(value))}`);
  const command = [
    ...envAssignments,
    quoteForBash("/bin/bash"),
    quoteForBash(toBashPath(path.join(repoRoot, scriptPath))),
  ].join(" ");

  return spawnSync("bash", ["-lc", command], {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("bootstrap dry-run succeeds and emits machine-checkable reports", () => {
  const outputDir = makeTempDir("infra-bootstrap-success-");
  const result = runBashScript("scripts/infra-bootstrap/bootstrap.sh", {
    BOOTSTRAP_DRY_RUN: "1",
    BOOTSTRAP_SKIP_RUNTIME_VALIDATION: "1",
    PARITY_SKIP_DOCKER: "1",
    BOOTSTRAP_OUTPUT_DIR: outputDir,
  });

  assert.equal(result.status, 0, `bootstrap failed: ${result.stderr}\n${result.stdout}`);

  const bootstrapReportPath = path.join(outputDir, "bootstrap-report.json");
  const parityReportPath = path.join(outputDir, "parity-report.json");

  assert.ok(fs.existsSync(bootstrapReportPath), "bootstrap report was not generated");
  assert.ok(fs.existsSync(parityReportPath), "parity report was not generated");

  const bootstrapReport = loadJson(bootstrapReportPath);
  const parityReport = loadJson(parityReportPath);

  assert.equal(bootstrapReport.overall_status, "success");
  assert.equal(bootstrapReport.dry_run, true);
  assert.equal(parityReport.PARITY_STATUS, "PASS");
  assert.match(result.stdout, /Bootstrap completed successfully/);
});

test("bootstrap simulated partial failure writes failed report and exits non-zero", () => {
  const outputDir = makeTempDir("infra-bootstrap-failure-");
  const result = runBashScript("scripts/infra-bootstrap/bootstrap.sh", {
    BOOTSTRAP_DRY_RUN: "1",
    BOOTSTRAP_SKIP_RUNTIME_VALIDATION: "1",
    BOOTSTRAP_AUTOROLLBACK: "1",
    SIMULATE_FAILURE_STEP: "parity-check",
    BOOTSTRAP_OUTPUT_DIR: outputDir,
  });

  assert.notEqual(result.status, 0, "bootstrap should fail for simulated failure step");

  const bootstrapReportPath = path.join(outputDir, "bootstrap-report.json");
  assert.ok(fs.existsSync(bootstrapReportPath), "failed run did not emit bootstrap report");

  const bootstrapReport = loadJson(bootstrapReportPath);
  assert.equal(bootstrapReport.overall_status, "failed");
  assert.match(result.stdout, /Rolling back resources created in this run/);
  assert.match(result.stdout, /Failure in step: parity-check/);
});

test("integration validator passes static contract checks in skip-runtime mode", () => {
  const result = runBashScript("scripts/infra-bootstrap/validate-nginx-vault.sh", {
    BOOTSTRAP_SKIP_RUNTIME_VALIDATION: "1",
  });

  assert.equal(result.status, 0, `validation script failed: ${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /Static integration checks passed/);
});

test("parity script generates PASS report in static parity mode", () => {
  const outputDir = makeTempDir("infra-bootstrap-parity-");
  const parityReportPath = path.join(outputDir, "parity-report.json");

  const result = runBashScript("scripts/infra-bootstrap/check-parity.sh", {
    PARITY_SKIP_DOCKER: "1",
    PARITY_REPORT_PATH: parityReportPath,
  });

  assert.equal(result.status, 0, `parity script failed: ${result.stderr}\n${result.stdout}`);
  assert.ok(fs.existsSync(parityReportPath), "parity report was not generated");

  const parityReport = loadJson(parityReportPath);
  assert.equal(parityReport.PARITY_STATUS, "PASS");
  assert.deepEqual(parityReport.missing_components, []);
  assert.deepEqual(parityReport.misaligned_components, []);
});

test("parity script fails and reports induced mismatch scenario", () => {
  const outputDir = makeTempDir("infra-bootstrap-parity-mismatch-");
  const parityReportPath = path.join(outputDir, "parity-report.json");

  const result = runBashScript("scripts/infra-bootstrap/check-parity.sh", {
    PARITY_SKIP_DOCKER: "1",
    PARITY_INDUCED_MISMATCH_COMPONENT: "edge-gateway",
    PARITY_REPORT_PATH: parityReportPath,
  });

  assert.notEqual(result.status, 0, "parity script should fail for induced mismatch");
  assert.ok(fs.existsSync(parityReportPath), "parity report was not generated");

  const parityReport = loadJson(parityReportPath);
  assert.equal(parityReport.PARITY_STATUS, "FAIL");
  assert.match(parityReport.misaligned_components.join(","), /induced\/edge-gateway/);
});
