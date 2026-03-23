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
  "12-4-admin-access-control-path-for-dmz-operations.md",
);
const qaSummaryPath = path.join(
  repoRoot,
  "_bmad-output",
  "implementation-artifacts",
  "12-4-admin-access-control-path-for-dmz-operations-test-summary.md",
);
const adminAccessPath = path.join(repoRoot, "docs", "ops", "dmz-admin-access.md");
const abuseResponsePath = path.join(repoRoot, "docs", "ops", "dmz-abuse-response.md");
const drillGovernancePath = path.join(repoRoot, "docs", "ops", "dmz-drill-governance.md");
const releaseChecklistPath = path.join(repoRoot, "docs", "ops", "dmz-release-checklist-template.md");
const vaultFoundationPath = path.join(repoRoot, "docs", "ops", "vault-secrets-foundation.md");

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

function extractBulletListAfterLine(text, marker) {
  const pattern = new RegExp(`${escapeRegex(marker)}\\n\\n((?:- .*\\n)+)`, "m");
  const match = text.match(pattern);
  assert.ok(match, `missing bullet list after marker: ${marker}`);
  return match[1]
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => line.replace(/^- /, "").replace(/^`|`$/g, ""));
}

test("DMZ admin access doc keeps Story 12.4 documentation-only, canonical field names, and external-vault rules explicit", () => {
  const adminAccess = readText(adminAccessPath);

  mustInclude(adminAccess, "This document is planning-only. No Epic 12 DMZ administration access path is currently active in this repository.");
  mustInclude(adminAccess, "Story 12.4 outputs are planning artifacts and root regression coverage only.");
  mustInclude(adminAccess, "Future runtime work must update this document, `docs/ops/dmz-abuse-response.md`, `docs/ops/dmz-drill-governance.md`, and `docs/ops/dmz-release-checklist-template.md` in the same change.");
  mustInclude(adminAccess, "- Maximum TTL: 30 minutes");
  mustInclude(adminAccess, "- requester identity");
  mustInclude(adminAccess, "- ticket id");
  mustInclude(adminAccess, "- requested scope");
  mustInclude(adminAccess, "- requested TTL");
  mustInclude(adminAccess, "- target environment");
  mustInclude(adminAccess, "Emergency break-glass is allowed only with after-the-fact review recorded within 24 hours.");
  mustInclude(adminAccess, "a human `SEC` operator authenticated through the existing Story 7.5 admin control surface");
  mustInclude(adminAccess, "approved automation or CI authenticated with a reviewed workload identity");
  mustInclude(adminAccess, "Canonical audit and evidence field names use snake_case");
  mustInclude(adminAccess, "- correlation_id");
  mustInclude(adminAccess, "- ticket_id");
  mustInclude(adminAccess, "- source_identity");
  mustInclude(adminAccess, "- lease_id");
  mustInclude(adminAccess, "- approved_by");
  mustInclude(adminAccess, "- bootstrap_identity_type");
  mustInclude(adminAccess, "- operator_surface");
  mustInclude(adminAccess, "- `requester`");
  mustInclude(adminAccess, "- `lease_id`");
  mustInclude(adminAccess, "- `issued_at`");
  mustInclude(adminAccess, "- `expires_at`");
  mustInclude(adminAccess, "- `approved_by`");
  mustInclude(adminAccess, "- `environment`");
  mustInclude(adminAccess, "- `scope`");
  mustInclude(adminAccess, "Story 0.13 is the upstream gate: non-local `issue`, `inspect`, and `revoke` flows must use the external Vault contract from `docs/ops/vault-external-operations.md` and cannot be satisfied by the local bootstrap in `docs/ops/vault-secrets-foundation.md`.");
  mustInclude(adminAccess, "`issue` uses the bootstrap identity above and must not require a previously issued DMZ lease.");
  mustInclude(adminAccess, "issued DMZ leases must never carry `dmz:access:issue`");
  mustMatch(
    adminAccess,
    /Common response envelope fields for every privileged operator response:[\s\S]*- `bootstrap_identity_type`[\s\S]*- `operator_surface`[\s\S]*- `listener_scope`/,
  );
  mustMatch(
    adminAccess,
    /Request-bound fields when the operation required them:[\s\S]*- `requester`[\s\S]*- `ticket_id`[\s\S]*- `approved_by`/,
  );
  mustMatch(
    adminAccess,
    /Operation-specific minimum fields:[\s\S]*- `issue`:[\s\S]*- `lease_id`[\s\S]*- `inspect`:[\s\S]*- `lease_id`[\s\S]*- `requester`[\s\S]*- `revoke`:[\s\S]*- `lease_id`[\s\S]*- `revoked_at`[\s\S]*- `revocation_reason`/,
  );
  mustInclude(adminAccess, "- issuance record must include `requester`, `approved_by`, `environment`, `scope`, `lease_id`, `issued_at`, and `expires_at`.");
  mustInclude(adminAccess, "- expiry confirmation must prove auto-revocation within 60 seconds of TTL expiry.");
  mustInclude(adminAccess, "- manual revocation confirmation, when the emergency path is used, must include `lease_id`, `actor`, `revoked_at`, and `revocation_reason`.");
  mustInclude(adminAccess, "- post-expiry or post-revocation denial sample proving deterministic `403 DMZ_ACCESS_DENIED`");
  mustInclude(adminAccess, "- audit query sample proving the mandatory fields above under the same canonical snake_case names");
});

test("DMZ abuse response doc keeps the shared Story 12.4 schema, approval rules, and expiry evidence explicit", () => {
  const abuseResponse = readText(abuseResponsePath);

  mustInclude(abuseResponse, "The operator interface may be exposed as CLI or API, but it must implement the same audited contract and accept:");
  mustInclude(abuseResponse, "- requester");
  mustInclude(abuseResponse, "- `approved_by` or linked emergency-review record when the deny action or manual revoke path requires secondary approval");
  mustInclude(abuseResponse, "- source_identity");
  mustInclude(abuseResponse, "- ticket_id");
  mustInclude(abuseResponse, "- correlation_id");
  mustInclude(abuseResponse, "- lease_id");
  mustInclude(abuseResponse, "- approved_by");
  mustInclude(abuseResponse, "- bootstrap_identity_type");
  mustInclude(abuseResponse, "- operator_surface");
  mustInclude(abuseResponse, "Production deny writes and manual deny revocations require `approved_by` distinct from `requester` unless an emergency break-glass review is recorded within 24 hours.");
  mustInclude(abuseResponse, "Common response envelope fields inherited from Story 12.4 and required in deny-management responses:");
  mustInclude(abuseResponse, "- `status`");
  mustInclude(abuseResponse, "- `actor`");
  mustInclude(abuseResponse, "- `environment`");
  mustInclude(abuseResponse, "- `scope`");
  mustInclude(abuseResponse, "- `bootstrap_identity_type`");
  mustInclude(abuseResponse, "- `operator_surface`");
  mustInclude(abuseResponse, "- `listener_scope`");
  mustInclude(abuseResponse, "When the request required them, deny-management responses and evidence must also preserve `requester`, `ticket_id`, and `approved_by`.");
  mustInclude(abuseResponse, "When a response returns or mutates a time-bounded operator record, it must also preserve `issued_at` and `expires_at`.");
  mustInclude(abuseResponse, "Deny-management credentials must never carry `dmz:access:issue`.");
  mustInclude(abuseResponse, "`listener_scope` for this operator surface must remain the private Story 12.4 control-plane surface rather than `public-edge`.");
  mustInclude(abuseResponse, "- expiry confirmation record proving auto-expiry within 60 seconds of TTL completion");
  mustInclude(abuseResponse, "- post-expiry denial sample proving deterministic `403 DMZ_ACCESS_DENIED`");
});

test("Drill governance and release checklist keep admin-credential-ttl-expiry evidence explicit and canonical", () => {
  const drillGovernance = readText(drillGovernancePath);
  const releaseChecklist = readText(releaseChecklistPath);

  mustInclude(drillGovernance, "`admin-credential-ttl-expiry`");
  mustInclude(drillGovernance, "Scenario-specific minimum evidence:");
  mustMatch(
    drillGovernance,
    /`admin-credential-ttl-expiry`: linked evidence proving `requester`, `approved_by` or a linked emergency-review record, `environment`, `scope`, `lease_id`, `issued_at`, `expires_at`, expiry confirmation or explicit revocation result,[\s\S]*`bootstrap_identity_type`, `operator_surface`, and `listener_scope`\./,
  );
  mustInclude(drillGovernance, "auto-revocation within 60 seconds of TTL expiry");
  mustInclude(drillGovernance, "post-expiry denial sample proving deterministic `403 DMZ_ACCESS_DENIED`");
  mustInclude(releaseChecklist, "`admin-credential-ttl-expiry`");
  mustInclude(releaseChecklist, "For the `admin-credential-ttl-expiry` scenario, linked evidence must prove:");
  mustInclude(releaseChecklist, "- `requester`");
  mustInclude(releaseChecklist, "- `approved_by` or linked emergency-review record");
  mustInclude(releaseChecklist, "- `environment`");
  mustInclude(releaseChecklist, "- `scope`");
  mustInclude(releaseChecklist, "- `lease_id`");
  mustInclude(releaseChecklist, "- `issued_at`");
  mustInclude(releaseChecklist, "- `expires_at`");
  mustInclude(releaseChecklist, "- expiry confirmation or explicit revocation result");
  mustInclude(releaseChecklist, "- auto-revocation within 60 seconds of TTL expiry");
  mustInclude(releaseChecklist, "- post-expiry denial sample proving deterministic `403 DMZ_ACCESS_DENIED`");
  mustInclude(releaseChecklist, "- `status`");
  mustInclude(releaseChecklist, "- `actor`");
  mustInclude(releaseChecklist, "- `bootstrap_identity_type`");
  mustInclude(releaseChecklist, "- `operator_surface`");
  mustInclude(releaseChecklist, "- `listener_scope`");
  assert.doesNotMatch(releaseChecklist, /bootstrap identity type|operator surface/);
});

test("Vault foundation runbook keeps Story 12.4 out of the local bootstrap baseline", () => {
  const vaultFoundation = readText(vaultFoundationPath);

  mustInclude(vaultFoundation, "Story `12.4` DMZ privileged operator access is not satisfied by this local bootstrap baseline.");
  mustInclude(vaultFoundation, "Non-local `issue`, `inspect`, and `revoke` flows must follow `docs/ops/vault-external-operations.md` and `docs/ops/dmz-admin-access.md`.");
});

test("Story 12.4 story record keeps downstream-proof work explicit, portable, and state-consistent", () => {
  const story = readText(storyPath);
  const changedRoundList = extractBulletListAfterLine(story, "Changed during this implementation round:");
  const sharedSuiteList = extractBulletListAfterLine(story, "Shared-suite unblocker outside Story 12.4 ownership:");

  assert.doesNotMatch(story, /\/Users\/yeongjae\/fixyz\//);
  mustInclude(story, "Status: done");
  mustInclude(story, "- Status set to `done`.");
  assert.doesNotMatch(story, /ready-for-dev|Status: in-progress|Status set to `in-progress`\./);
  assert.doesNotMatch(story, /^- \[ \]/m);
  mustInclude(story, "Align `docs/ops/dmz-abuse-response.md` to the shared Story 12.4 operator envelope, scope taxonomy, and private-listener rules");
  mustInclude(story, "Sync `docs/ops/dmz-drill-governance.md` and `docs/ops/dmz-release-checklist-template.md` so the `admin-credential-ttl-expiry` dependency remains explicit in downstream evidence requirements");
  mustInclude(story, "Verify `admin-credential-ttl-expiry` remains mapped to Story 12.4 in drill governance and release evidence templates.");
  mustInclude(story, "Verify this story remains documentation-only and repository-root-only until a later runtime implementation story is approved.");
  assert.deepEqual(changedRoundList, [
    "_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations.md",
    "_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations-test-summary.md",
    "_bmad-output/implementation-artifacts/sprint-status.yaml",
    "docs/ops/dmz-abuse-response.md",
    "docs/ops/dmz-admin-access.md",
    "docs/ops/dmz-drill-governance.md",
    "docs/ops/dmz-release-checklist-template.md",
    "docs/ops/vault-secrets-foundation.md",
    "tests/edge-gateway/dmz-admin-access.test.js",
  ]);
  assert.deepEqual(sharedSuiteList, [
    "_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md",
  ]);
});

test("Story 12.4 keeps QA evidence in a tracked story-owned summary", () => {
  const qaSummary = readText(qaSummaryPath);

  assert.doesNotMatch(qaSummary, /\/Users\/yeongjae\/fixyz\//);
  mustInclude(qaSummary, "Story 12.4: Admin Access Control Path for DMZ Operations");
  mustInclude(qaSummary, "`tests/edge-gateway/dmz-admin-access.test.js`");
  mustInclude(qaSummary, "`node --check tests/edge-gateway/dmz-admin-access.test.js`");
  mustInclude(qaSummary, "`node --test tests/edge-gateway/dmz-admin-access.test.js`");
  mustInclude(qaSummary, "`npm run test:edge-gateway`");
  mustInclude(qaSummary, "_bmad-output/implementation-artifacts/tests/**");
  assertTrackedByGit("tests/edge-gateway/dmz-admin-access.test.js");
  assertTrackedByGit("_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations-test-summary.md");
});
