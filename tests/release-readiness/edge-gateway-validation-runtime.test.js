"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runBashScript } = require("../helpers/bash-script-test-utils");

const repoRoot = path.resolve(__dirname, "..", "..");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { encoding: "utf8", mode: 0o755 });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

test("edge gateway validation script writes passed structured evidence", () => {
  const tempDir = makeTempDir("edge-validation-pass-");
  const outputDir = path.join(tempDir, "output");
  const validatorPath = path.join(tempDir, "mock-edge-validator.sh");
  writeExecutable(validatorPath, "#!/usr/bin/env bash\nset -euo pipefail\necho edge validation ok\n");

  const result = runBashScript(repoRoot, "scripts/release-readiness/run-edge-gateway-validation.sh", {
    env: {
      EDGE_VALIDATION_OUTPUT_DIR: outputDir,
      EDGE_VALIDATOR_PATH: validatorPath,
    },
  });

  assert.equal(result.status, 0, `edge validation wrapper failed: ${result.stderr}\n${result.stdout}`);

  const summary = loadJson(path.join(outputDir, "edge-summary.json"));
  assert.equal(summary.status, "passed");
  assert.equal(summary.evidence.logPath, "edge-gateway-validation.log");
});

test("edge gateway validation script writes failed structured evidence when validator fails", () => {
  const tempDir = makeTempDir("edge-validation-fail-");
  const outputDir = path.join(tempDir, "output");
  const validatorPath = path.join(tempDir, "mock-edge-validator.sh");
  writeExecutable(validatorPath, "#!/usr/bin/env bash\nset -euo pipefail\necho edge validation failed >&2\nexit 1\n");

  const result = runBashScript(repoRoot, "scripts/release-readiness/run-edge-gateway-validation.sh", {
    env: {
      EDGE_VALIDATION_OUTPUT_DIR: outputDir,
      EDGE_VALIDATOR_PATH: validatorPath,
    },
  });

  assert.equal(result.status, 1, "edge validation wrapper should fail when validator fails");

  const summary = loadJson(path.join(outputDir, "edge-summary.json"));
  assert.equal(summary.status, "failed");
  assert.equal(summary.evidence.logPath, "edge-gateway-validation.log");
});
