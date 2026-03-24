"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const nginxRoot = path.join(repoRoot, "docker", "nginx");
const edgeConfPath = path.join(nginxRoot, "templates", "fixyz-edge.conf.template");
const adrPath = path.join(
  repoRoot,
  "docs",
  "ops",
  "adr",
  "adr-0001-edge-gateway-nginx.md",
);
const validateScriptPath = path.join(nginxRoot, "scripts", "validate-edge-gateway.sh");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function mustInclude(text, needle) {
  assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const canonicalExactRoutes = [
  "location = /api/v1/auth/csrf",
  "location = /api/v1/auth/register",
  "location = /api/v1/auth/login",
  "location = /api/v1/auth/session",
  "location = /api/v1/auth/logout",
  "location = /api/v1/auth/otp/verify",
  "location = /api/v1/auth/password/forgot",
  "location = /api/v1/auth/password/forgot/challenge",
  "location = /api/v1/auth/password/forgot/challenge/fail-closed",
  "location = /api/v1/auth/password/reset",
  "location = /api/v1/auth/mfa-recovery/rebind",
  "location = /api/v1/auth/mfa-recovery/rebind/confirm",
  "location = /api/v1/members/me/totp/enroll",
  "location = /api/v1/members/me/totp/confirm",
  "location = /api/v1/members/me/totp/rebind",
  "location = /api/v1/orders/sessions",
  "location = /api/v1/notifications",
  "location = /api/v1/notifications/stream",
];

const canonicalRegexRoutes = [
  "location ~ ^/api/v1/orders/sessions/[^/]+$",
  "location ~ ^/api/v1/orders/sessions/[^/]+/otp/verify$",
  "location ~ ^/api/v1/orders/sessions/[^/]+/extend$",
  "location ~ ^/api/v1/orders/sessions/[^/]+/execute$",
  "location ~ ^/api/v1/notifications/[^/]+/read$",
];

test("Edge gateway ADR exists and records Nginx decision context", () => {
  assert.ok(fs.existsSync(adrPath), `missing ADR: ${adrPath}`);
  const adr = readText(adrPath);
  mustInclude(adr, "Nginx");
  mustInclude(adr, "Alternatives");
  mustInclude(adr, "Trade-offs");
});

test("Nginx edge template defines required upstreams and the Story 12.6 canonical route allowlist", () => {
  assert.ok(fs.existsSync(edgeConfPath), `missing edge conf: ${edgeConfPath}`);
  const conf = readText(edgeConfPath);

  for (const upstreamName of [
    "upstream channel_service",
    "upstream corebank_service",
    "upstream fep_gateway",
    "upstream fep_simulator",
  ]) {
    mustInclude(conf, upstreamName);
  }

  mustInclude(conf, "location = /health/channel");
  for (const route of canonicalExactRoutes) {
    mustInclude(conf, route);
  }
  for (const route of canonicalRegexRoutes) {
    mustInclude(conf, route);
  }
});

test("Nginx edge template enforces TLS + security headers + deterministic failures", () => {
  assert.ok(fs.existsSync(edgeConfPath), `missing edge conf: ${edgeConfPath}`);
  const conf = readText(edgeConfPath);

  mustInclude(conf, "listen 443 ssl");
  mustInclude(conf, "return 301 https://$host$request_uri");
  mustInclude(conf, "add_header Strict-Transport-Security");
  mustInclude(conf, "add_header X-Content-Type-Options");
  mustInclude(conf, "add_header X-Frame-Options");
  mustInclude(conf, "proxy_next_upstream off");
  mustInclude(conf, "error_page 502 503 504 = @upstream_failure");
  mustInclude(conf, "log_format edge_json");
  mustInclude(conf, "EDGE_ROUTE_NOT_ALLOWED");
  mustInclude(conf, "EDGE_METHOD_NOT_ALLOWED");
  mustInclude(conf, "EDGE_INTERNAL_NAMESPACE_DENIED");
});

test("Nginx edge template denies legacy/internal surfaces and preserves SSE proxy behavior", () => {
  assert.ok(fs.existsSync(edgeConfPath), `missing edge conf: ${edgeConfPath}`);
  const conf = readText(edgeConfPath);

  mustInclude(conf, "location = /health/corebank");
  mustInclude(conf, "location = /health/fep-gateway");
  mustInclude(conf, "location = /health/fep-simulator");
  mustInclude(conf, "location = /health/channel");
  mustInclude(conf, "if ($request_method != GET)");
  mustInclude(conf, "location ^~ /api/v1/channel/");
  mustInclude(conf, "location ^~ /api/v1/corebank/");
  mustInclude(conf, "location ^~ /api/v1/fep/");
  mustInclude(conf, "location ^~ /_edge/");
  mustInclude(conf, "location ^~ /internal/");
  mustInclude(conf, "location ^~ /admin/");
  mustInclude(conf, "location = /api/v1/notifications/stream");
  mustInclude(conf, "proxy_http_version 1.1");
  mustInclude(conf, "proxy_buffering off");
  mustInclude(conf, "proxy_read_timeout 3600s");
});

test("Edge gateway validation script exists and covers Story 12.6 canonical and deny checks", () => {
  assert.ok(fs.existsSync(validateScriptPath), `missing validation script: ${validateScriptPath}`);
  const script = readText(validateScriptPath);

  mustInclude(script, "nginx -t");
  mustInclude(script, "Route smoke checks");
  mustInclude(script, "Missing required environment variable ${required_env} for docker compose bootstrap");
  mustInclude(script, "assert_runtime_proxy_contract");
  mustInclude(script, "Set-Cookie: SESSION=");
  mustInclude(script, "X-Correlation-Id:");
  mustInclude(script, "traceparent:");
  mustInclude(script, "/api/v1/auth/csrf");
  mustInclude(script, "/health/corebank");
  mustInclude(script, "/health/fep-gateway");
  mustInclude(script, "/health/fep-simulator");
  mustInclude(script, "/health/channel");
  mustInclude(script, "/api/v1/corebank/example");
  mustInclude(script, "/api/v1/fep/example");
  mustInclude(script, "/_edge/example");
  mustInclude(script, "/internal/example");
  mustInclude(script, "/api/v1/admin/example");
  mustInclude(script, "/ops/dmz/example");
  mustInclude(script, "EDGE_INTERNAL_NAMESPACE_DENIED");
  mustInclude(script, "EDGE_METHOD_NOT_ALLOWED");
  mustInclude(script, "/api/v1/channel/notifications/stream");
  mustInclude(script, "/api/v1/auth/register");
  mustInclude(script, "/api/v1/auth/password/reset");
  mustInclude(script, "/api/v1/members/me/totp/rebind");
  mustInclude(script, "/api/v1/orders/sessions/example");
  mustInclude(script, "/api/v1/orders/sessions/example/extend");
  mustInclude(script, "/api/v1/orders/sessions/example/execute");
  mustInclude(script, "/api/v1/notifications/example/read");
  mustInclude(script, "/api/v1/notifications/stream");
  mustInclude(script, "Security-header verification");
  mustInclude(script, "TLS certificate chain and expiry");
  mustInclude(script, "SSE/EventStream");
  mustInclude(script, "Unhealthy upstream behavior");
  mustInclude(script, "/%ZZ");
  mustInclude(script, "400 Bad Request");
  mustInclude(script, "need_channel_service_restart=1");
  mustInclude(script, "stop channel-service");
});
