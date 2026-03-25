"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { runAsyncBashScript, runBashScript } = require("../helpers/bash-script-test-utils");

const repoRoot = path.resolve(__dirname, "..", "..");
const composeEnv = {
  COMPOSE_PROFILES: "observability",
  VAULT_DEV_ROOT_TOKEN_ID: "observability-root-token",
  INTERNAL_SECRET_BOOTSTRAP: "observability-bootstrap-secret",
  INTERNAL_SECRET: "observability-runtime-secret",
};

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: options.timeout ?? 30000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) },
  });
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ status: 124, stdout, stderr: `${stderr}\nTimed out` });
    }, options.timeout ?? 30000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ status: code, stdout, stderr });
    });
  });
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents, { encoding: "utf8", mode: 0o755 });
}

function createPrometheusPayload(value, labels = {}) {
  return JSON.stringify({
    status: "success",
    data: {
      resultType: "vector",
      result: value === null
        ? []
        : [{
            metric: labels,
            value: [Math.floor(Date.now() / 1000), String(value)],
          }],
    },
  });
}

async function startMockPrometheusServer(queryHandler) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (url.pathname === "/-/healthy") {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ok");
      return;
    }

    if (url.pathname !== "/api/v1/query") {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }

    const query = url.searchParams.get("query") ?? "";
    const payload = queryHandler(query);

    response.writeHead(200, { "content-type": "application/json" });
    response.end(payload);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

test("docker compose config succeeds with observability additions", () => {
  const result = run("docker", ["compose", "-f", "docker-compose.yml", "config"], {
    env: composeEnv,
  });

  assert.equal(result.status, 0, `docker compose config failed: ${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /prometheus:/);
  assert.match(result.stdout, /grafana:/);
});

test("validation script passes in static mode", () => {
  const result = runBashScript(repoRoot, "scripts/observability/validate-observability-stack.sh", {
    env: { ...composeEnv, OBSERVABILITY_SKIP_RUNTIME: "1" },
  });

  assert.equal(result.status, 0, `static validation failed: ${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /Static observability checks passed/);
});

test("generator emits valid monitoring descriptor JSON", () => {
  const result = run("node", ["scripts/observability/generate-monitoring-panels.mjs", "--json"]);

  assert.equal(result.status, 0, `generator failed: ${result.stderr}\n${result.stdout}`);
  const descriptors = JSON.parse(result.stdout.trim());
  const keys = descriptors.map((descriptor) => descriptor.key);

  assert.deepEqual(keys, ["executionVolume", "pendingSessions", "marketDataIngest"]);
  assert.equal(descriptors[0].mode, "link");
  assert.match(descriptors[0].linkUrl, /^http:\/\/127\.0\.0\.1:3000\//);
  assert.doesNotMatch(descriptors[0].linkUrl, /viewPanel=/);
  assert.match(descriptors[0].drillDown.grafanaUrl, /viewPanel=101/);
  assert.equal(descriptors[0].embedUrl, undefined);
});

test("generator derives freshness from Prometheus health and event timestamps", async () => {
  const checkedAt = "2026-03-24T09:20:00.000Z";
  const executionEpoch = Date.parse("2026-03-24T09:19:30.000Z") / 1000;
  const pendingEpoch = Date.parse("2026-03-24T09:15:00.000Z") / 1000;
  const server = await startMockPrometheusServer((query) => {
    if (query.includes('up{job="channel-service"}')) {
      return createPrometheusPayload(1, { job: "channel-service" });
    }
    if (query.includes('up{job="fep-gateway"}')) {
      return createPrometheusPayload(0, { job: "fep-gateway" });
    }
    if (query.includes("channel_order_execution_last_completed_epoch_seconds")) {
      return createPrometheusPayload(executionEpoch);
    }
    if (query.includes("channel_order_sessions_recovery_backlog_last_updated_epoch_seconds")) {
      return createPrometheusPayload(pendingEpoch);
    }
    if (query.includes("fep_marketdata_snapshots_last_persisted_epoch_seconds")) {
      return createPrometheusPayload(null);
    }
    return createPrometheusPayload(null);
  });

  try {
    const result = await runAsync("node", ["scripts/observability/generate-monitoring-panels.mjs", "--json"], {
      env: {
        OBSERVABILITY_PROMETHEUS_BASE_URL: server.baseUrl,
        OBSERVABILITY_LAST_UPDATED_AT: checkedAt,
      },
    });

    assert.equal(result.status, 0, `generator failed: ${result.stderr}\n${result.stdout}`);
    const descriptors = JSON.parse(result.stdout.trim());

    assert.equal(descriptors[0].freshness.status, "live");
    assert.equal(descriptors[0].freshness.lastUpdatedAt, "2026-03-24T09:19:30.000Z");
    assert.match(descriptors[0].freshness.statusMessage, /healthy/);

    assert.equal(descriptors[1].freshness.status, "stale");
    assert.equal(descriptors[1].freshness.lastUpdatedAt, "2026-03-24T09:15:00.000Z");
    assert.match(descriptors[1].freshness.statusMessage, /stale/);

    assert.equal(descriptors[2].freshness.status, "unavailable");
    assert.equal(descriptors[2].freshness.lastUpdatedAt, checkedAt);
    assert.match(descriptors[2].freshness.statusMessage, /target unavailable/);
  } finally {
    await server.close();
  }
});

test("generator can upsert FE env files idempotently", () => {
  const tempDir = makeTempDir("observability-env-");
  const envFile = path.join(tempDir, ".env.local");

  let result = run("node", ["scripts/observability/generate-monitoring-panels.mjs", "--write-env-file", envFile]);
  assert.equal(result.status, 0, `first env-file write failed: ${result.stderr}\n${result.stdout}`);

  result = run("node", ["scripts/observability/generate-monitoring-panels.mjs", "--write-env-file", envFile], {
    env: { OBSERVABILITY_LAST_UPDATED_AT: "2026-03-24T00:00:00.000Z" },
  });
  assert.equal(result.status, 0, `second env-file write failed: ${result.stderr}\n${result.stdout}`);

  const contents = fs.readFileSync(envFile, "utf8");
  const matches = contents.match(/^VITE_ADMIN_MONITORING_PANELS_JSON=/gm) || [];

  assert.equal(matches.length, 1, `expected exactly one monitoring env line, got ${matches.length}`);
  assert.match(contents, /ops-monitoring-overview/);
});

test("runtime validation exercises reprovision and provisioning checks", async () => {
  const tempDir = makeTempDir("observability-runtime-mocks-");
  const binDir = path.join(tempDir, "bin");
  const dockerLog = path.join(tempDir, "docker.log");
  const curlLog = path.join(tempDir, "curl.log");
  fs.mkdirSync(binDir, { recursive: true });

  writeExecutable(path.join(binDir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_DOCKER_LOG"
exit 0
`);

  writeExecutable(path.join(binDir, "curl"), `#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_CURL_LOG"
last_arg=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o|-w|-u|-H|-X|--data-urlencode)
      shift 2
      ;;
    -s|-S|-f|-fsS|-T|-G)
      shift 1
      ;;
    *)
      last_arg="$1"
      shift 1
      ;;
  esac
done
case "$last_arg" in
  *"/-/healthy")
    exit 0
    ;;
  *"/api/health")
    printf '{"database":"ok"}'
    exit 0
    ;;
  *"/api/v1/query"*)
    printf '{"status":"success","data":{"result":[{"metric":{"job":"channel-service"},"value":[0,"1"]},{"metric":{"job":"corebank-service"},"value":[0,"1"]},{"metric":{"job":"fep-gateway"},"value":[0,"1"]},{"metric":{"job":"fep-simulator"},"value":[0,"1"]}]}}'
    exit 0
    ;;
  *"http://127.0.0.1:8080/actuator/prometheus")
    printf '404'
    exit 0
    ;;
  *"/api/datasources/uid/prometheus")
    printf '{"uid":"prometheus"}'
    exit 0
    ;;
  *"/api/dashboards/uid/ops-monitoring-overview")
    printf '{"dashboard":{"uid":"ops-monitoring-overview","panels":[{"id":101},{"id":102},{"id":103},{"id":201},{"id":202},{"id":203}]}}'
    exit 0
    ;;
  *)
    printf '{}'
    exit 0
    ;;
esac
`);

  const checkedAt = "2026-03-24T09:30:00.000Z";
  const executionEpoch = Date.parse("2026-03-24T09:29:50.000Z") / 1000;
  const pendingEpoch = Date.parse("2026-03-24T09:24:00.000Z") / 1000;
  const marketDataEpoch = Date.parse("2026-03-24T09:26:00.000Z") / 1000;
  const server = await startMockPrometheusServer((query) => {
    if (query.includes('up{job="channel-service"}') || query.includes('up{job="fep-gateway"}')) {
      return createPrometheusPayload(1);
    }
    if (query.includes("channel_order_execution_last_completed_epoch_seconds")) {
      return createPrometheusPayload(executionEpoch);
    }
    if (query.includes("channel_order_sessions_recovery_backlog_last_updated_epoch_seconds")) {
      return createPrometheusPayload(pendingEpoch);
    }
    if (query.includes("fep_marketdata_snapshots_last_persisted_epoch_seconds")) {
      return createPrometheusPayload(marketDataEpoch);
    }
    return createPrometheusPayload(null);
  });

  try {
    const result = await runAsyncBashScript(repoRoot, "scripts/observability/validate-observability-stack.sh", {
      timeout: 120000,
      env: {
        ...composeEnv,
        MOCK_DOCKER_LOG: dockerLog,
        MOCK_CURL_LOG: curlLog,
        OBSERVABILITY_PROMETHEUS_BASE_URL: server.baseUrl,
        OBSERVABILITY_GRAFANA_BASE_URL: "http://127.0.0.1:13000",
        OBSERVABILITY_LAST_UPDATED_AT: checkedAt,
      },
      prependPathEntries: [binDir],
    });

    assert.equal(result.status, 0, `runtime validation failed: ${result.stderr}\n${result.stdout}`);
    assert.match(result.stdout, /Reprovisioning Prometheus and Grafana/);
    assert.match(result.stdout, /Runtime observability checks passed/);

    const dockerCalls = fs.readFileSync(dockerLog, "utf8");
    assert.match(dockerCalls, /up -d prometheus grafana/);
    assert.match(dockerCalls, /up -d --force-recreate prometheus grafana/);

    const curlCalls = fs.readFileSync(curlLog, "utf8");
    assert.match(curlCalls, /\/api\/datasources\/uid\/prometheus/);
    assert.match(curlCalls, /\/api\/dashboards\/uid\/ops-monitoring-overview/);
  } finally {
    await server.close();
  }
});
