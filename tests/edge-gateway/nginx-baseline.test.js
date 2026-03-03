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

test("Edge gateway ADR exists and records Nginx decision context", () => {
  assert.ok(fs.existsSync(adrPath), `missing ADR: ${adrPath}`);
  const adr = readText(adrPath);
  mustInclude(adr, "Nginx");
  mustInclude(adr, "Alternatives");
  mustInclude(adr, "Trade-offs");
});

test("Nginx edge template defines required upstreams and routing", () => {
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
  mustInclude(conf, "location = /health/corebank");
  mustInclude(conf, "location = /health/fep-gateway");
  mustInclude(conf, "location = /health/fep-simulator");
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
});

test("Nginx edge template blocks internal/admin routes and supports SSE proxy behavior", () => {
  assert.ok(fs.existsSync(edgeConfPath), `missing edge conf: ${edgeConfPath}`);
  const conf = readText(edgeConfPath);

  mustInclude(conf, "location ~* ^/(internal|admin)/");
  mustInclude(conf, "return 403");
  mustInclude(conf, "location /api/v1/channel/notifications/stream");
  mustInclude(conf, "proxy_http_version 1.1");
  mustInclude(conf, "proxy_buffering off");
  mustInclude(conf, "proxy_read_timeout 3600s");
});

test("Edge gateway validation script exists and covers AC5 checks", () => {
  assert.ok(fs.existsSync(validateScriptPath), `missing validation script: ${validateScriptPath}`);
  const script = readText(validateScriptPath);

  mustInclude(script, "nginx -t");
  mustInclude(script, "Route smoke checks");
  mustInclude(script, "Security-header verification");
  mustInclude(script, "TLS certificate chain and expiry");
  mustInclude(script, "SSE/EventStream");
  mustInclude(script, "Unhealthy upstream behavior");
});
