"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const assemblerPath = path.join(repoRoot, "scripts", "release-readiness", "assemble-story-10-4-evidence.mjs");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runAssembler(outputDir, extraEnv = {}) {
  return spawnSync("node", [assemblerPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      STORY_10_4_OUTPUT_DIR: outputDir,
      STORY_10_4_BUILD_ID: "test-build",
      ...extraEnv,
    },
    encoding: "utf8",
    timeout: 30000,
  });
}

function writePassingEvidence(outputDir) {
  writeJson(path.join(outputDir, "cold-start-timing.json"), {
    status: "passed",
    firstMandatoryApi: {
      durationMs: 84211,
      withinTarget: true,
    },
  });

  writeJson(path.join(outputDir, "docs-summary.json"), {
    status: "passed",
  });

  writeJson(path.join(outputDir, "edge-summary.json"), {
    status: "passed",
  });

  writeJson(path.join(outputDir, "smoke-summary.json"), {
    status: "passed",
    scenarios: [
      { id: "E10-SMOKE-001", status: "passed", evidencePath: path.join(outputDir, "cold-start-timing.json") },
      { id: "E10-SMOKE-002", status: "passed", evidencePath: path.join(outputDir, "docs-summary.json") },
      { id: "E10-OBS-001", status: "passed", evidencePath: path.join(outputDir, "observability-validation.log") },
      { id: "E10-OBS-002", status: "passed", evidencePath: path.join(outputDir, "observability-validation.log") },
    ],
  });

  writeJson(path.join(outputDir, "session-isolation-summary.json"), {
    status: "passed",
  });

  writeJson(path.join(outputDir, "rollback-rehearsal-summary.json"), {
    status: "passed",
  });

  writeJson(path.join(outputDir, "go-no-go-summary.json"), {
    decision: "go",
    releaseReady: true,
    blockers: [],
  });

  fs.writeFileSync(path.join(outputDir, "observability-validation.log"), "targets UP\ngrafana reachable\n");
}

test("story 10.4 evidence assembler writes passed matrix summary when all evidence is green", () => {
  const tempDir = makeTempDir("story-10-4-evidence-pass-");
  writePassingEvidence(tempDir);

  const result = runAssembler(tempDir);
  assert.equal(result.status, 0, `assembler failed: ${result.stderr}\n${result.stdout}`);

  const summary = readJson(path.join(tempDir, "matrix-summary.json"));
  const markdown = fs.readFileSync(path.join(tempDir, "matrix-summary.md"), "utf8");

  assert.equal(summary.overallResult, "PASSED");
  assert.equal(summary.goNoGo.decision, "go");
  assert.equal(summary.goNoGo.releaseReady, true);
  assert.equal(summary.scenarios.length, 6);
  assert.ok(summary.scenarios.every((scenario) => scenario.result === "PASSED"));
  assert.equal(summary.edge.status, "PASSED");
  assert.match(markdown, /Story 10\.4 Full-Stack Smoke\/Rehearsal Summary/);
  assert.match(markdown, /E10-SESSION-001/);
});

test("story 10.4 evidence assembler fails closed when evidence is missing or go-no-go stays no-go", () => {
  const tempDir = makeTempDir("story-10-4-evidence-fail-");
  writePassingEvidence(tempDir);
  fs.rmSync(path.join(tempDir, "session-isolation-summary.json"));
  writeJson(path.join(tempDir, "go-no-go-summary.json"), {
    decision: "no-go",
    releaseReady: false,
    blockers: ["Rollback rehearsal is pending."],
  });

  const result = runAssembler(tempDir);
  assert.equal(result.status, 1, "assembler should fail when release evidence is incomplete");

  const summary = readJson(path.join(tempDir, "matrix-summary.json"));
  assert.equal(summary.overallResult, "FAILED");
  assert.equal(summary.goNoGo.decision, "no-go");
  assert.match(summary.goNoGo.blockers.join("\n"), /Rollback rehearsal is pending/);

  const sessionScenario = summary.scenarios.find((scenario) => scenario.scenarioId === "E10-SESSION-001");
  assert.equal(sessionScenario.result, "MISSING");
});

test("story 10.4 evidence assembler fails when go decision is inconsistent with releaseReady false", () => {
  const tempDir = makeTempDir("story-10-4-evidence-release-ready-");
  writePassingEvidence(tempDir);
  writeJson(path.join(tempDir, "go-no-go-summary.json"), {
    decision: "go",
    releaseReady: false,
    blockers: [],
  });

  const result = runAssembler(tempDir);
  assert.equal(result.status, 1, "assembler should fail when releaseReady is false");
  assert.match(result.stderr, /Story 10\.4 evidence gate failed/);

  const summary = readJson(path.join(tempDir, "matrix-summary.json"));
  assert.equal(summary.overallResult, "FAILED");
  assert.equal(summary.goNoGo.decision, "go");
  assert.equal(summary.goNoGo.releaseReady, false);
});
