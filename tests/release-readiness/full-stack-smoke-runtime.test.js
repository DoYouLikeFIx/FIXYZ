"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const { runBashScript } = require("../helpers/bash-script-test-utils");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { encoding: "utf8", mode: 0o755 });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function setupMockTooling(tempDir) {
  const binDir = path.join(tempDir, "bin");
  const dockerLog = path.join(tempDir, "docker.log");
  const curlLog = path.join(tempDir, "curl.log");
  const validatorLog = path.join(tempDir, "validator.log");
  const validatorPath = path.join(tempDir, "mock-observability-validator.sh");
  fs.mkdirSync(binDir, { recursive: true });

  writeExecutable(path.join(binDir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
if [ "$1" = "compose" ] && [ "$2" = "version" ]; then
  exit 0
fi
if [ "$1" = "inspect" ]; then
  printf 'healthy'
  exit 0
fi

last_arg=""
subcommand=""
skip_next=0
for arg in "$@"; do
  if [ "$skip_next" = "1" ]; then
    skip_next=0
    continue
  fi
  case "$arg" in
    compose)
      ;;
    -f)
      skip_next=1
      ;;
    up|ps)
      subcommand="$arg"
      ;;
    *)
      last_arg="$arg"
      ;;
  esac
done

case "$subcommand" in
  up)
    exit 0
    ;;
  ps)
    printf 'container-%s\\n' "$last_arg"
    exit 0
    ;;
esac

exit 0
`);

  writeExecutable(path.join(binDir, "curl"), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_CURL_LOG"
output_file=""
write_format=""
url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o|-w|-D|-c|-b|-u|-H|-X)
      if [ "$1" = "-o" ]; then
        output_file="$2"
      elif [ "$1" = "-w" ]; then
        write_format="$2"
      fi
      shift 2
      ;;
    -s|-S|-f|-fsS|-k)
      shift 1
      ;;
    *)
      url="$1"
      shift 1
      ;;
  esac
done

status="200"
body='{}'
case "$url" in
  *"/api/v1/auth/csrf")
    status="\${MOCK_AUTH_CSRF_STATUS:-200}"
    body='{"token":"csrf-token","headerName":"X-CSRF-TOKEN"}'
    ;;
  *"/v3/api-docs")
    body='{"openapi":"3.0.1"}'
    ;;
  *"/swagger-ui/index.html")
    body='<html><title>Swagger UI</title></html>'
    ;;
esac

if [ -n "$output_file" ]; then
  printf '%s' "$body" > "$output_file"
fi
if [ -n "$write_format" ]; then
  printf '%s' "$status"
fi
exit 0
`);

  writeExecutable(validatorPath, `#!/usr/bin/env bash
set -euo pipefail
printf 'validator invoked\\n' >> "$MOCK_VALIDATOR_LOG"
printf 'Runtime observability checks passed\\n'
`);

  return { binDir, dockerLog, curlLog, validatorLog, validatorPath };
}

test("full-stack smoke script emits success evidence for cold-start, docs, and observability checks", () => {
  const tempDir = makeTempDir("full-stack-smoke-success-");
  const outputDir = path.join(tempDir, "output");
  const { binDir, dockerLog, curlLog, validatorLog, validatorPath } = setupMockTooling(tempDir);

  const result = runBashScript(repoRoot, "scripts/release-readiness/run-full-stack-smoke.sh", {
    timeout: 30000,
    prependPathEntries: [binDir],
    env: {
      SMOKE_OUTPUT_DIR: outputDir,
      SMOKE_START_TIMEOUT_SECONDS: "5",
      MOCK_DOCKER_LOG: dockerLog,
      MOCK_CURL_LOG: curlLog,
      MOCK_VALIDATOR_LOG: validatorLog,
      OBSERVABILITY_VALIDATOR_PATH: validatorPath,
      INTERNAL_SECRET: "smoke-secret",
    },
  });

  assert.equal(result.status, 0, `smoke script failed: ${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /Cold-start smoke checks passed/);

  const coldStartReport = loadJson(path.join(outputDir, "cold-start-timing.json"));
  const docsReport = loadJson(path.join(outputDir, "docs-summary.json"));
  const smokeSummary = loadJson(path.join(outputDir, "smoke-summary.json"));

  assert.equal(coldStartReport.status, "passed");
  assert.equal(coldStartReport.firstMandatoryApi.httpStatus, 200);
  assert.equal(coldStartReport.firstMandatoryApi.withinTarget, true);
  assert.equal(docsReport.status, "passed");
  assert.equal(smokeSummary.status, "passed");
  assert.equal(smokeSummary.scenarios[0].evidencePath, "cold-start-timing.json");
  assert.equal(smokeSummary.scenarios[1].evidencePath, "docs-summary.json");
  assert.equal(smokeSummary.checks.composeUpLog, "compose-up.log");
  assert.deepEqual(smokeSummary.scenarios.map((scenario) => scenario.id), [
    "E10-SMOKE-001",
    "E10-SMOKE-002",
    "E10-OBS-001",
    "E10-OBS-002",
  ]);
  assert.ok(fs.existsSync(path.join(outputDir, "observability-validation.log")));

  const dockerCalls = fs.readFileSync(dockerLog, "utf8");
  assert.match(dockerCalls, /compose version/);
  assert.match(dockerCalls, /compose -f .* up -d mysql mysql-grant-repair redis corebank-service fep-gateway fep-simulator channel-service edge-gateway prometheus grafana/);
  assert.match(dockerCalls, /compose -f .* ps -q channel-service/);
  assert.match(dockerCalls, /inspect -f/);

  const curlCalls = fs.readFileSync(curlLog, "utf8");
  assert.match(curlCalls, /api\/v1\/auth\/csrf/);
  assert.match(curlCalls, /v3\/api-docs/);
  assert.match(curlCalls, /swagger-ui\/index\.html/);

  const validatorCalls = fs.readFileSync(validatorLog, "utf8");
  assert.match(validatorCalls, /validator invoked/);
});

test("full-stack smoke script writes failed evidence when mandatory API misses the cold-start target", () => {
  const tempDir = makeTempDir("full-stack-smoke-timeout-");
  const outputDir = path.join(tempDir, "output");
  const { binDir, validatorPath } = setupMockTooling(tempDir);

  const result = runBashScript(repoRoot, "scripts/release-readiness/run-full-stack-smoke.sh", {
    timeout: 30000,
    prependPathEntries: [binDir],
    env: {
      SMOKE_OUTPUT_DIR: outputDir,
      SMOKE_START_TIMEOUT_SECONDS: "1",
      SMOKE_POLL_INTERVAL_SECONDS: "0",
      MOCK_DOCKER_LOG: path.join(tempDir, "docker.log"),
      MOCK_CURL_LOG: path.join(tempDir, "curl.log"),
      MOCK_VALIDATOR_LOG: path.join(tempDir, "validator.log"),
      OBSERVABILITY_VALIDATOR_PATH: validatorPath,
      MOCK_AUTH_CSRF_STATUS: "503",
      INTERNAL_SECRET: "smoke-secret",
    },
  });

  assert.equal(result.status, 0, "smoke script should emit failed evidence without aborting the workflow");

  const coldStartReport = loadJson(path.join(outputDir, "cold-start-timing.json"));
  const smokeSummary = loadJson(path.join(outputDir, "smoke-summary.json"));

  assert.equal(coldStartReport.status, "failed");
  assert.equal(coldStartReport.firstMandatoryApi.httpStatus, 503);
  assert.equal(coldStartReport.firstMandatoryApi.withinTarget, false);
  assert.equal(smokeSummary.status, "failed");
  assert.equal(smokeSummary.scenarios[0].status, "failed");
  assert.equal(smokeSummary.checks.mandatoryApi, "failed");
});
