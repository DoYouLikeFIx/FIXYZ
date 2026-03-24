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

test("edge config keeps /health/channel public and moves internal health probes under deny-only locations", () => {
  const conf = readConf();

  assert.match(conf, /location = \/health\/channel/);
  assert.match(conf, /if \(\$request_method != GET\)/);
  assert.match(conf, /return 404 '\{"error":"EDGE_METHOD_NOT_ALLOWED","status":404,"request_id":"\$request_id"\}'/);
  assert.match(conf, /proxy_pass http:\/\/channel_service\/actuator\/health;/);
  assert.match(conf, /location = \/health\/corebank/);
  assert.match(conf, /location = \/health\/fep-gateway/);
  assert.match(conf, /location = \/health\/fep-simulator/);
  assert.doesNotMatch(conf, /proxy_pass http:\/\/corebank_service\/actuator\/health;/);
  assert.doesNotMatch(conf, /proxy_pass http:\/\/fep_gateway\/actuator\/health;/);
  assert.doesNotMatch(conf, /proxy_pass http:\/\/fep_simulator\/actuator\/health;/);
});

test("edge config defines deterministic internal namespace and method deny contracts", () => {
  const conf = readConf();
  assert.match(conf, /EDGE_INTERNAL_NAMESPACE_DENIED/);
  assert.match(conf, /EDGE_METHOD_NOT_ALLOWED/);
  assert.match(conf, /location \^~ \/api\/v1\/corebank\//);
  assert.match(conf, /location \^~ \/api\/v1\/fep\//);
  assert.match(conf, /location \^~ \/_edge\//);
  assert.match(conf, /location \^~ \/internal\//);
  assert.match(conf, /location \^~ \/admin\//);
});

test("edge config defines deterministic upstream failure with 503", () => {
  const conf = readConf();
  assert.match(conf, /error_page 502 503 504 = @upstream_failure/);
  assert.match(conf, /location @upstream_failure/);
  assert.match(conf, /return 503 '\{"error":"EDGE_UPSTREAM_UNAVAILABLE","status":503,"request_id":"\$request_id"\}'/);
});

test("edge config defines explicit allowlist fallback with 404 for unknown routes", () => {
  const conf = readConf();
  assert.match(conf, /location \/ \{/);
  assert.match(conf, /return 404 '\{"error":"EDGE_ROUTE_NOT_ALLOWED","status":404,"request_id":"\$request_id"\}'/);
});

test("edge config exposes canonical Story 12.6 routes and denies the legacy alias", () => {
  const conf = readConf();

  for (const route of [
    "location = /api/v1/auth/csrf",
    "location = /api/v1/auth/login",
    "location = /api/v1/auth/password/reset",
    "location = /api/v1/members/me/totp/rebind",
    "location = /api/v1/orders/sessions",
    "location ~ ^/api/v1/orders/sessions/[^/]+/otp/verify$",
    "location = /api/v1/notifications",
    "location ~ ^/api/v1/notifications/[^/]+/read$",
    "location = /api/v1/notifications/stream",
  ]) {
    assert.match(conf, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(conf, /location \^~ \/api\/v1\/channel\//);
  assert.doesNotMatch(conf, /location \/api\/v1\/channel\/notifications\/stream \{\s*proxy_pass http:\/\/channel_service;/);
});
