"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const composePath = path.join(repoRoot, "docker-compose.yml");
const edgeTemplatePath = path.join(repoRoot, "docker", "nginx", "templates", "fixyz-edge.conf.template");
const dmzDocPath = path.join(repoRoot, "docs", "ops", "dmz-network-mapping.md");
const architecturePath = path.join(repoRoot, "_bmad-output", "planning-artifacts", "architecture.md");
const prdPath = path.join(repoRoot, "_bmad-output", "planning-artifacts", "prd.md");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function mustInclude(text, needle) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(text, new RegExp(escaped));
}

function mustMatch(text, pattern, message) {
  assert.match(text, pattern, message);
}

function extractServiceBlock(compose, serviceName, nextServiceName) {
  const blockPattern = new RegExp(
    `\\n  ${serviceName}:([\\s\\S]*?)\\n  ${nextServiceName}:`,
    "m",
  );
  const match = compose.match(blockPattern);
  assert.ok(match, `unable to extract compose block for ${serviceName}`);
  return match[1];
}

function extractServiceBlockBeforeTopLevelSection(compose, serviceName, nextSectionName) {
  const blockPattern = new RegExp(
    `\\n  ${serviceName}:([\\s\\S]*?)\\n${nextSectionName}:`,
    "m",
  );
  const match = compose.match(blockPattern);
  assert.ok(match, `unable to extract compose block for ${serviceName}`);
  return match[1];
}

test("DMZ mapping documents the active baseline host exposure and edge-visible exceptions", () => {
  const compose = readText(composePath);
  const edgeTemplate = readText(edgeTemplatePath);
  const dmzDoc = readText(dmzDocPath);
  const redisProbeBlock = extractServiceBlock(compose, "redis-recovery-probe", "vault");
  const vaultBlock = extractServiceBlock(compose, "vault", "vault-init");
  const vaultInitBlock = extractServiceBlock(compose, "vault-init", "corebank-service");
  const corebankBlock = extractServiceBlock(compose, "corebank-service", "fep-gateway");
  const fepGatewayBlock = extractServiceBlock(compose, "fep-gateway", "fep-simulator");
  const fepSimulatorBlock = extractServiceBlock(compose, "fep-simulator", "channel-service");
  const channelBlock = extractServiceBlock(compose, "channel-service", "edge-gateway");
  const edgeGatewayBlock = extractServiceBlockBeforeTopLevelSection(compose, "edge-gateway", "volumes");

  mustMatch(channelBlock, /ports:\s*\n\s*-\s*"8080:8080"/);
  mustMatch(edgeGatewayBlock, /ports:\s*\n\s*-\s*"80:80"\s*\n\s*-\s*"443:443"/);

  for (const block of [
    redisProbeBlock,
    vaultBlock,
    vaultInitBlock,
    corebankBlock,
    fepGatewayBlock,
    fepSimulatorBlock,
  ]) {
    assert.doesNotMatch(block, /\n\s*ports:\s*\n/);
  }

  mustInclude(dmzDoc, "- Host-exposed services:");
  mustInclude(dmzDoc, "- `channel-service:8080`");
  mustInclude(dmzDoc, "- `edge-gateway:80/443`");
  mustInclude(dmzDoc, "- Always-on services without direct host port exposure:");
  mustInclude(dmzDoc, "- Profile-scoped baseline services without direct host port exposure:");

  for (const serviceName of [
    "corebank-service",
    "fep-gateway",
    "fep-simulator",
    "mysql",
    "redis",
    "vault",
    "vault-init",
    "redis-recovery-probe",
  ]) {
    mustInclude(dmzDoc, `- \`${serviceName}\``);
  }

  for (const exceptionPath of [
    "/health/corebank",
    "/health/fep-gateway",
    "/health/fep-simulator",
    "/api/v1/corebank/*",
    "/api/v1/fep/gateway/*",
    "/api/v1/fep/simulator/*",
    "/_edge/upstream-probe",
    "/api/v1/channel/*",
  ]) {
    mustInclude(dmzDoc, `| \`${exceptionPath}\` |`);
  }

  mustInclude(edgeTemplate, "location = /health/corebank");
  mustInclude(edgeTemplate, "location = /health/fep-gateway");
  mustInclude(edgeTemplate, "location = /health/fep-simulator");
  mustInclude(edgeTemplate, "location /api/v1/channel/");
  mustInclude(edgeTemplate, "location /api/v1/corebank/");
  mustInclude(edgeTemplate, "location /api/v1/fep/gateway/");
  mustInclude(edgeTemplate, "location /api/v1/fep/simulator/");
  mustInclude(edgeTemplate, "location = /_edge/upstream-probe");
});

test("DMZ mapping documents target zones, explicit lane decisions, and future rollback triggers", () => {
  const dmzDoc = readText(dmzDocPath);

  mustInclude(dmzDoc, "## Target DMZ Design");
  mustInclude(dmzDoc, "| Edge zone | `edge-gateway` | `80/443` only | External clients -> `edge-gateway`; `edge-gateway` -> `channel-service` |");
  mustInclude(dmzDoc, "| Application zone | `channel-service` | None directly on host | `edge-gateway` -> `channel-service`; `channel-service` -> `corebank-service`, `mysql`, `redis`, Vault boundary |");
  mustInclude(dmzDoc, "| Core private zone | `corebank-service`, `fep-gateway`, `fep-simulator`, `mysql`, `redis`, `vault`, `vault-init`, `redis-recovery-probe` | None | `channel-service` -> private dependencies; `corebank-service` -> `fep-gateway`; `fep-gateway` -> `fep-simulator`; profile-scoped drill/bootstrap traffic stays private-only |");
  mustInclude(dmzDoc, "## Canonical Lane Reconciliation");
  mustInclude(dmzDoc, "| Edge zone | `external-net` |");
  mustInclude(dmzDoc, "| Application zone | `external-net` and `core-net` |");
  mustInclude(dmzDoc, "| Core private zone | `core-net`, `gateway-net`, and `fep-net` |");
  mustInclude(dmzDoc, "The `edge` and `application` review zones intentionally share `external-net`;");
  mustInclude(dmzDoc, "Epic 12 intentionally collapses `core-net`, `gateway-net`, and `fep-net` into one `core-private` review zone");
  mustInclude(dmzDoc, "## Future Implementation Requirements");
  mustInclude(dmzDoc, "`channel-service` or any private service is reachable on an unintended direct host port");
  mustInclude(dmzDoc, "`edge-gateway` cannot reach `channel-service` for approved public routes or `/health/channel`");
  mustInclude(dmzDoc, "any required private dependency flow (`channel-service` -> `corebank-service`/`mysql`/`redis`/Vault boundary, `corebank-service` -> `fep-gateway`, `fep-gateway` -> `fep-simulator`) fails validation");
  mustInclude(dmzDoc, "Story 0.13 external-Vault assumptions for non-local environments are missing, stale, or contradicted by the runtime change");
  mustInclude(dmzDoc, "Rollback action: remove the reviewed DMZ overlay or replacement manifest from deployment, restore the plain Story 0.7 runtime invocation, and confirm the baseline host exposure and edge route inventory match this document again.");
});

test("Architecture and PRD keep Story 12.1 governance and future runtime boundaries explicit", () => {
  const architecture = readText(architecturePath);
  const prd = readText(prdPath);

  mustMatch(
    architecture,
    /Story 12\.1[\s\S]*canonical DMZ design package[\s\S]*verification points[\s\S]*rollback triggers/i,
  );
  mustMatch(
    architecture,
    /fix-net[\s\S]*not itself a canonical lane-collapse decision/i,
  );
  mustMatch(
    architecture,
    /Edge zone[\s\S]*external-net[\s\S]*Application zone[\s\S]*external-net[\s\S]*core-net[\s\S]*Core private zone[\s\S]*core-net[\s\S]*gateway-net[\s\S]*fep-net/i,
  );

  mustMatch(
    prd,
    /Story 12\.1[\s\S]*future DMZ lane model[\s\S]*Story 0\.7[\s\S]*active runtime baseline/i,
  );
  mustMatch(
    prd,
    /four-lane network snippet[\s\S]*future hardened target[\s\S]*currently shipped compose topology/i,
  );
  mustMatch(
    prd,
    /rollback triggers[\s\S]*verification points[\s\S]*docs\/ops\/dmz-network-mapping\.md/i,
  );
});
