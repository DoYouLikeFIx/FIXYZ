"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const storyPath = path.join(
  repoRoot,
  "_bmad-output",
  "implementation-artifacts",
  "12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness.md",
);
const qaSummaryPath = path.join(
  repoRoot,
  "_bmad-output",
  "implementation-artifacts",
  "12-3-service-boundary-trust-hardening-test-summary.md",
);
const trustHardeningPath = path.join(repoRoot, "docs", "ops", "dmz-trust-hardening.md");
const adrPath = path.join(repoRoot, "docs", "ops", "adr", "adr-0003-service-boundary-mtls-readiness.md");
const pocPlanPath = path.join(repoRoot, "docs", "ops", "dmz-mtls-poc-plan.md");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function assertTrackedByGit(relativePath) {
  childProcess.execFileSync("git", ["ls-files", "--error-unmatch", relativePath], {
    cwd: repoRoot,
    stdio: "ignore",
  });
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mustInclude(text, needle) {
  assert.match(text, new RegExp(escapeRegex(needle)));
}

function mustMatch(text, pattern, message) {
  assert.match(text, pattern, message);
}

function mustHaveTableRow(text, cells) {
  const pattern = new RegExp(`\\|\\s*${cells.map(escapeRegex).join("\\s*\\|\\s*")}\\s*\\|`);
  assert.match(text, pattern);
}

function extractSectionAfterHeading(text, heading) {
  const pattern = new RegExp(`${escapeRegex(heading)}\\n\\n([\\s\\S]*?)(?=\\n(?:### |## |# )|$)`);
  const match = text.match(pattern);
  assert.ok(match, `missing section after heading: ${heading}`);
  return match[1].trimEnd();
}

function extractBulletListAfterHeading(text, heading) {
  return extractSectionAfterHeading(text, heading)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

function extractIndentedBulletListAfterLine(text, marker) {
  const pattern = new RegExp(`${escapeRegex(marker)}\\n((?:  - .*\\n)+)`, "m");
  const match = text.match(pattern);
  assert.ok(match, `missing indented bullet list after marker: ${marker}`);
  return match[1]
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => line.replace(/^  - /, "").replace(/^`|`$/g, ""));
}

test("Story 12.3 stays documentation-only and names exact output artifacts", () => {
  const story = readText(storyPath);

  mustMatch(story, /This story is documentation-only\./);
  mustMatch(story, /Epic 12 remains documentation-only until a separate reviewed runtime change reintroduces service-boundary trust controls\./);
  mustMatch(story, /The ADR and PoC outputs for Story 12\.3 are planning artifacts only\./);
  mustInclude(story, "docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md");
  mustInclude(story, "docs/ops/dmz-mtls-poc-plan.md");
  mustInclude(story, "tests/edge-gateway/dmz-trust-hardening.test.js");
  mustInclude(story, "docs/ops/vault-external-operations.md");
  mustInclude(story, "docs/ops/dmz-drill-governance.md");
  mustInclude(story, "any newly introduced Epic 12 runtime overlay or drill automation");
});

test("DMZ trust-hardening doc carries Story 0.13 constraints forward explicitly", () => {
  const trustHardening = readText(trustHardeningPath);

  mustInclude(trustHardening, "## Documentation-Only Boundary");
  mustInclude(trustHardening, "Story 12.3 outputs are documentation artifacts and root regression coverage only.");
  mustHaveTableRow(trustHardening, [
    "`local/dev`",
    "local compose-owned Vault bootstrap or other reviewed local-only equivalent",
    "local/dev bootstrap path may use `docker-compose.vault.yml`",
    "`vault` and `vault-init` are allowed only for local/dev bootstrap",
    "non-local transport hardening does not relax future staging/prod requirements",
  ]);
  mustHaveTableRow(trustHardening, [
    "`staging/prod`",
    "external Vault only",
    "deploy-time pre-start retrieval plus environment injection only for boot-path secrets",
    "`vault` and `vault-init` must be disabled; enabling them is a fail-closed deployment error",
    "TLS required, CA trust required, hostname/SAN verification required, plaintext `http://` forbidden",
  ]);
  mustInclude(trustHardening, "Non-local profiles must not silently fall back to localhost Vault defaults or other local-only secret sources.");
  mustInclude(trustHardening, "Vault role/policy bootstrap for non-local use remains operator/IaC owned rather than app-runtime owned.");
  mustInclude(trustHardening, "The current `channel-service` TOTP Vault secret store remains a business-flow Vault client");
  mustInclude(trustHardening, "Story 12.3 evidence expectations must preserve correlation-id traceability");
  mustInclude(trustHardening, "tests/edge-gateway/dmz-trust-hardening.test.js");
  mustInclude(trustHardening, "release-promotion evidence remains deferred to Story 12.5 after runtime controls exist");
  mustInclude(trustHardening, "Future runtime work must update this document, the Story 12.3 artifact, `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md`, and `docs/ops/dmz-mtls-poc-plan.md` in the same change.");
  mustInclude(trustHardening, "## Pair-Specific Story 0.13 Posture Mapping");
  mustHaveTableRow(trustHardening, [
    "`channel-service` -> `corebank-service`",
    "may use compose-bootstrap internal secrets sourced through `docker-compose.vault.yml`; local-only Vault services are permitted only for local/dev bootstrap",
    "external-Vault-only secret source, deploy-time pre-start retrieval plus environment injection for boot-path secret material, TLS/CA-trust/hostname verification required",
    "fail closed if local `vault`/`vault-init` are enabled, if injected boot-path secret material is missing/invalid, or if the trust transport preconditions above are not met",
  ]);
  mustHaveTableRow(trustHardening, [
    "`corebank-service` -> `fep-gateway`",
    "may use the same local/dev compose-bootstrap secret path as the rest of the internal service chain",
    "external-Vault-only secret source, deploy-time pre-start retrieval plus environment injection for boot-path secret material, TLS/CA-trust/hostname verification required",
    "fail closed if the pair attempts to reuse local-only fallbacks or localhost Vault defaults in non-local environments",
  ]);
  mustHaveTableRow(trustHardening, [
    "`fep-gateway` -> `fep-simulator` control plane",
    "may use local/dev compose-bootstrap secret material only while the simulator remains part of the local/dev bootstrap topology",
    "external-Vault-only secret source, deploy-time pre-start retrieval plus environment injection for boot-path secret material, TLS/CA-trust/hostname verification required",
    "must not special-case the simulator control plane as a non-local local-Vault exception; non-local hardened mode still fails closed on local-Vault dependence, missing injected secrets, or broken trust transport validation",
  ]);
});

test("DMZ trust-hardening doc locks the actual rotation, availability, and stale-secret contract values", () => {
  const trustHardening = readText(trustHardeningPath);

  mustInclude(trustHardening, "- Dual-secret overlap window: 15 minutes");
  mustInclude(trustHardening, "- Old-secret invalidation deadline: within 10 minutes after the 15-minute overlap window closes");
  mustInclude(trustHardening, "- total valid requests counted toward availability SLO: `500`");
  mustInclude(trustHardening, "- `channel-service` -> `corebank-service`: `200`");
  mustInclude(trustHardening, "- `corebank-service` -> `fep-gateway`: `150`");
  mustInclude(trustHardening, "- `fep-gateway` -> `fep-simulator` control plane: `150`");
  mustInclude(trustHardening, "- explicit start timestamp (`rotation write acknowledged`)");
  mustInclude(trustHardening, "- explicit success timestamp (`all required probes green on new secret`)");
  mustInclude(trustHardening, "- `5xx <= 0.5%`");
  mustInclude(trustHardening, "- no continuous outage over 30 seconds");
  mustInclude(trustHardening, "- denominator: all valid scheduled requests in the workload profile");
  mustInclude(trustHardening, "- numerator: valid requests that end in transport failure, timeout, or HTTP `5xx`");
  mustInclude(trustHardening, "- excluded from numerator/denominator: planned stale-secret negative probes used to verify rejection behavior");
  mustInclude(trustHardening, "- health probes for all affected services");
  mustInclude(trustHardening, "- one stale-secret negative probe per service pair after invalidation");
  mustInclude(trustHardening, "- Rotation ownership: operator-initiated, documented runbook, no hidden ad hoc shell flow");
  mustHaveTableRow(trustHardening, [
    "`channel-service` -> `corebank-service`",
    "`401`",
    "`CORE-9401`",
    "`category=STALE_INTERNAL_SECRET`, `correlationId`, `servicePair`",
  ]);
  mustHaveTableRow(trustHardening, [
    "`corebank-service` -> `fep-gateway`",
    "`401`",
    "`FEP-9401`",
    "`category=STALE_INTERNAL_SECRET`, `correlationId`, `servicePair`",
  ]);
  mustHaveTableRow(trustHardening, [
    "`fep-gateway` -> `fep-simulator` control plane",
    "`401`",
    "`FEP-9401`",
    "`category=STALE_INTERNAL_SECRET`, `correlationId`, `servicePair`",
  ]);
  mustInclude(trustHardening, "- audit event reference");
  mustInclude(trustHardening, "The stale-secret matrix above is the Epic 12 hardened-mode target contract.");
  mustInclude(trustHardening, "- stale-secret rejection sample schema");
  mustInclude(trustHardening, "- validation drill summary schema");
  mustInclude(
    trustHardening,
    "Story 12.5 owns drill-governance and release-promotion evidence after the runtime trust controls exist; Story 12.3 remains the design-package prerequisite.",
  );
});

test("ADR and PoC plan define the fixed-pair mTLS readiness package without activating runtime", () => {
  const adr = readText(adrPath);
  const pocPlan = readText(pocPlanPath);
  const adrNonGoals = extractBulletListAfterHeading(adr, "## Non-Goals");
  const pocDeferredItems = extractBulletListAfterHeading(pocPlan, "## Deferred Items");

  mustInclude(adr, "- Status: Proposed");
  mustInclude(adr, "Epic 12 is currently documentation-only.");
  mustInclude(adr, "Initial readiness scope: fixed proof-of-concept pair `channel-service` -> `corebank-service`");
  mustInclude(adr, "Certificate ownership: operator or platform PKI process, not ad hoc app-runtime bootstrap");
  mustInclude(adr, "the Story 12.3 stale-secret rejection contract remains required until a later reviewed runtime change explicitly supersedes the internal-secret control for a given service pair");
  assert.deepEqual(adrNonGoals, [
    "No runtime mTLS rollout in this story",
    "No new Epic 12 service-boundary runtime overlay in this repository",
    "No certificate-issuance automation or PKI bootstrap implementation in this story",
    "No service-mesh adoption decision in this story",
    "No expansion of the PoC scope beyond `channel-service` -> `corebank-service`",
    "No release-gate drill evidence; Story 12.5 owns promotion evidence after runtime controls exist",
  ]);

  mustInclude(pocPlan, "This document is planning-only. No Story 12.3 mTLS proof-of-concept runtime asset is currently active in this repository.");
  mustInclude(pocPlan, "- `channel-service` -> `corebank-service`");
  mustInclude(pocPlan, "Story 12.3 PoC output is a planning package only.");
  mustInclude(pocPlan, "deploy-time pre-start retrieval plus environment injection");
  mustInclude(pocPlan, "non-local profiles fail closed if local `vault` or `vault-init` services are enabled");
  mustInclude(pocPlan, "each failure mode must map to auditable evidence and preserve correlation-id traceability");
  assert.deepEqual(pocDeferredItems, [
    "`corebank-service` -> `fep-gateway`",
    "`fep-gateway` -> `fep-simulator`",
    "service-mesh adoption or sidecar-based trust distribution",
    "fleet-wide certificate lifecycle automation",
    "Story 12.5 release-promotion evidence packaging",
  ]);
  mustInclude(pocPlan, "Story 12.5 release-promotion evidence packaging");
});

test("Story 12.3 story record keeps portable file traceability and tracked QA evidence", () => {
  const story = readText(storyPath);
  const expectedChangedFiles = [
    "docs/ops/dmz-trust-hardening.md",
    "docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md",
    "docs/ops/dmz-mtls-poc-plan.md",
    "tests/edge-gateway/dmz-trust-hardening.test.js",
    "tests/edge-gateway/dmz-perimeter-policy.test.js",
    "_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md",
    "_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness.md",
    "_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md",
  ];
  const changedRoundList = extractIndentedBulletListAfterLine(story, "- Changed during this readiness-hardening round:");
  const fileList = extractBulletListAfterHeading(story, "### File List");

  assert.doesNotMatch(story, /\/Users\/yeongjae\/fixyz\//);
  mustInclude(story, "Status: done");
  assert.doesNotMatch(story, /^- \[ \]/m);
  mustInclude(story, "`node --check tests/edge-gateway/dmz-trust-hardening.test.js`");
  mustInclude(story, "`node --test tests/edge-gateway/dmz-trust-hardening.test.js`");
  mustInclude(story, "`node --test tests/edge-gateway/dmz-perimeter-policy.test.js`");
  mustInclude(story, "`npm run test:edge-gateway`");
  mustInclude(story, "_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md");
  for (const trackedPath of [
    "docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md",
    "docs/ops/dmz-mtls-poc-plan.md",
    "tests/edge-gateway/dmz-trust-hardening.test.js",
    "_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md",
  ]) {
    assertTrackedByGit(trackedPath);
  }
  assert.deepEqual(changedRoundList, expectedChangedFiles);
  assert.deepEqual(fileList, [
    "_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness.md",
    "docs/ops/dmz-trust-hardening.md",
    "docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md",
    "docs/ops/dmz-mtls-poc-plan.md",
    "tests/edge-gateway/dmz-trust-hardening.test.js",
    "tests/edge-gateway/dmz-perimeter-policy.test.js",
    "_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md",
    "_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md",
  ]);
  assert.doesNotMatch(
    story,
    /_bmad-output\/implementation-artifacts\/tests\/(?:story-12-3-service-boundary-trust-hardening-summary|test-summary)\.md/,
  );
});

test("Story 12.3 keeps QA evidence in a tracked story-owned summary", () => {
  const qaSummary = readText(qaSummaryPath);

  assert.doesNotMatch(qaSummary, /\/Users\/yeongjae\/fixyz\//);
  mustInclude(qaSummary, "Story 12.3: Service Boundary Trust Hardening (Secret Rotation + mTLS Readiness)");
  mustInclude(qaSummary, "`tests/edge-gateway/dmz-trust-hardening.test.js`");
  mustInclude(qaSummary, "`node --check tests/edge-gateway/dmz-trust-hardening.test.js`");
  mustInclude(qaSummary, "`node --test tests/edge-gateway/dmz-perimeter-policy.test.js`");
  mustInclude(qaSummary, "_bmad-output/implementation-artifacts/tests/**");
});
