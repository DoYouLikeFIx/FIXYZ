"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const edgeConfPath = path.join(repoRoot, "docker", "nginx", "templates", "fixyz-edge.conf.template");

function readConf() {
  return fs.readFileSync(edgeConfPath, "utf8");
}

test("edge config documents 200 health check routes for all upstreams", () => {
  const conf = readConf();

  for (const route of [
    "location = /health/channel",
    "location = /health/corebank",
    "location = /health/fep-gateway",
    "location = /health/fep-simulator",
  ]) {
    assert.match(conf, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("edge config enforces blocked internal/admin access with 403", () => {
  const conf = readConf();
  assert.match(conf, /location ~\* \^\/\(internal\|admin\)\//);
  assert.match(conf, /return 403/);
});

test("edge config defines deterministic upstream failure with 503", () => {
  const conf = readConf();
  assert.match(conf, /error_page 502 503 504 = @upstream_failure/);
  assert.match(conf, /location @upstream_failure/);
  assert.match(conf, /return 503 '\{"error":"EDGE_UPSTREAM_UNAVAILABLE","status":503\}'/);
});

test("edge config defines explicit allowlist fallback with 404 for unknown routes", () => {
  const conf = readConf();
  assert.match(conf, /location \/ \{/);
  assert.match(conf, /return 404 '\{"error":"EDGE_ROUTE_NOT_ALLOWED","status":404\}'/);
});
