"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const storyPath = path.join(
  repoRoot,
  "_bmad-output",
  "implementation-artifacts",
  "12-5-dmz-security-drill-and-evidence-gate.md",
);
const sprintStatusPath = path.join(
  repoRoot,
  "_bmad-output",
  "implementation-artifacts",
  "sprint-status.yaml",
);
const story015Path = path.join(
  repoRoot,
  "_bmad-output",
  "implementation-artifacts",
  "0-15-mobile-edge-parity-and-physical-device-transport-hardening.md",
);
const governancePath = path.join(repoRoot, "docs", "ops", "dmz-drill-governance.md");
const evidenceReadmePath = path.join(repoRoot, "docs", "ops", "evidence", "dmz", "README.md");
const releaseChecklistPath = path.join(repoRoot, "docs", "ops", "dmz-release-checklist-template.md");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
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

test("Story 12.5 story record keeps done-state metadata, docs-only scope, and tracked regression coverage explicit", () => {
  const story = readText(storyPath);

  mustInclude(story, "Status: done");
  mustInclude(story, "- Status set to `done`.");
  assert.doesNotMatch(story, /Status: blocked|Status: review/);
  assert.doesNotMatch(story, /^- \[ \]/m);
  mustInclude(story, "Repository-local drill automation was intentionally removed; this story defines the governance and evidence baseline that any future automation must satisfy after reviewed runtime re-entry exists.");
  mustInclude(story, "Story 10.1 and Story 10.4 remain supporting release-readiness anchors for CI and smoke/rehearsal evidence, but they do not replace the required DMZ `live-external` evidence defined here.");
  mustInclude(story, "No repository-local drill workflow change is required for the current Story 12.5 governance baseline.");
  mustInclude(story, "Add root regression coverage in `tests/edge-gateway/dmz-drill-evidence-gate.test.js`.");
  mustInclude(story, "`node --check tests/edge-gateway/dmz-drill-evidence-gate.test.js`");
  mustInclude(story, "`node --test tests/edge-gateway/dmz-drill-evidence-gate.test.js`");
  mustInclude(story, "`npm.cmd run test:edge-gateway`");
  mustInclude(story, "/Users/yeongjae/fixyz/tests/edge-gateway/dmz-drill-evidence-gate.test.js");
});

test("DMZ drill governance doc locks the Story 12.5 scenario catalog, live-external gate, and lineage rules", () => {
  const governance = readText(governancePath);

  mustInclude(governance, "This document is the active Story 12.5 governance baseline for Epic 12 DMZ promotion evidence.");
  mustInclude(governance, "No repository-local DMZ drill automation is currently active in this repository, but any operator-run or future automated drill must follow this contract exactly.");
  mustHaveTableRow(governance, [
    "Scenario",
    "Owner",
    "Intended cadence",
    "Primary prerequisite story",
    "Promotion role",
    "Notes",
  ]);
  mustHaveTableRow(governance, [
    "`route-method-deny`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 12.2",
    "required",
    "Confirms deterministic deny behavior for disallowed methods and internal namespaces.",
  ]);
  mustHaveTableRow(governance, [
    "`stale-secret-rejection`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 12.3",
    "required",
    "Validates stale credential or secret-rotation rejection.",
  ]);
  mustHaveTableRow(governance, [
    "`admin-credential-ttl-expiry`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 12.4",
    "required",
    "Requires TTL expiry, auto-revocation, and post-expiry deterministic denial proof.",
  ]);
  mustHaveTableRow(governance, [
    "`canonical-public-edge-route-behavior`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 12.6",
    "required",
    "Must show the Story 12.6 canonical public route inventory is exercised through the public edge rather than direct service reachability.",
  ]);
  mustHaveTableRow(governance, [
    "`edge-mode-client-parity`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 0.15",
    "required",
    "Must show edge-mode client validation through the same target environment that is under release review.",
  ]);
  mustInclude(governance, "This DMZ gate complements Story 10.1 acceptance CI evidence and Story 10.4 smoke/rehearsal evidence. Those release-readiness anchors remain required, but neither can substitute for required DMZ drill evidence.");
  mustInclude(governance, "Only required scenarios recorded as `execution_mode = live-external` from the same target environment under review may satisfy the promotion gate.");
  mustInclude(governance, "`planning-review` artifacts may support procedure review, checklist drafting, and dry-run preparation, but they can never satisfy promotion evidence.");
  mustInclude(governance, "The first promotion review after Stories 12.6 and 0.15 are complete must link at least one full successful same-environment `live-external` drill set from the last 7 days.");
  mustInclude(governance, "Rolling last four weekly same-environment drill sets must remain retained and linked, using the latest non-superseded drill set for each review window.");
  mustInclude(governance, "Promotion evidence must come from the same target environment that is being assessed for release readiness.");
  mustInclude(governance, "Any superseding drill set must use the same `review_window_id` as the drill set it replaces.");
  mustInclude(governance, "Only `live-external` can be used for release-promotion evidence.");
  mustInclude(governance, "`story_12_6_route_reference`");
  mustInclude(governance, "`story_0_15_edge_mode_reference`");
  mustInclude(governance, "Repository-local workflow automation is optional future follow-on scope; Story 12.5 itself is satisfied by the governance and evidence contract even when execution remains operator-run.");
});

test("DMZ evidence README locks file naming, summary fields, live-external-only promotion semantics, and retention rules", () => {
  const evidenceReadme = readText(evidenceReadmePath);

  mustInclude(evidenceReadme, "This directory defines the active Story 12.5 evidence contract for Epic 12 DMZ drill sets.");
  mustInclude(evidenceReadme, "`docs/ops/evidence/dmz/<YYYYMMDD>/<drill_set_id>/`");
  mustInclude(evidenceReadme, "`dmz-<scenario>-<drill_set_id>-<YYYYMMDDTHHMMSSZ>.json`");
  mustInclude(evidenceReadme, "`summary-index-<drill_set_id>-<YYYYMMDDTHHMMSSZ>.json`");
  for (const field of [
    "`drill_set_id`",
    "`review_window_id`",
    "`scenario_id`",
    "`execution_mode`",
    "`environment`",
    "`control_state`",
    "`prerequisite_story`",
    "`artifact_reference`",
    "`story_12_6_route_reference`",
    "`story_0_15_edge_mode_reference`",
  ]) {
    mustInclude(evidenceReadme, `- ${field}`);
  }
  mustInclude(evidenceReadme, "For `abuse-rate-limit` evidence, the summary must also record:");
  mustInclude(evidenceReadme, "- `enforcement_layer`");
  mustInclude(evidenceReadme, "- `limit_key_type`");
  mustInclude(evidenceReadme, "- `source_identity`");
  mustInclude(evidenceReadme, "- `source_identity_origin`");
  mustInclude(evidenceReadme, "Missing scenarios, mixed environments, or mixed execution modes invalidate the drill set.");
  mustInclude(evidenceReadme, "Scenario retries must create a new `drill_set_id`.");
  mustInclude(evidenceReadme, "- `planning-review`: documentation-only review, checklist rehearsal, or dry-run validation;");
  mustInclude(evidenceReadme, "- `live-external`: the scenario ran against the canonical public edge from the same target environment under release review; this is the only promotion-valid execution mode.");
  mustInclude(evidenceReadme, "Promotion-linked `summary-index.json` files are valid only when every required scenario row uses `execution_mode = live-external`.");
  mustInclude(evidenceReadme, "Retain at least 35 days of evidence to cover a rolling four-week governance window.");
  mustInclude(evidenceReadme, "The first promotion after Stories 12.6 and 0.15 are complete must link at least one successful same-environment `live-external` drill set from the last 7 days.");
  mustInclude(evidenceReadme, "Any promotion-linked drill set must preserve explicit `story_12_6_route_reference` and `story_0_15_edge_mode_reference` linkage so reviewers can verify that canonical public routes and edge-mode clients were actually exercised.");
});

test("DMZ release checklist template locks release anchors, scenario coverage, and blocking gate rules", () => {
  const releaseChecklist = readText(releaseChecklistPath);

  mustInclude(releaseChecklist, "- linked Story 10.1 acceptance CI gate evidence");
  mustInclude(releaseChecklist, "- linked Story 10.4 smoke and rehearsal evidence");
  mustInclude(releaseChecklist, "- execution mode (`live-external` only for promotion evidence)");
  mustInclude(releaseChecklist, "- `story_12_6_route_reference`");
  mustInclude(releaseChecklist, "- `story_0_15_edge_mode_reference`");
  for (const scenario of [
    "`blocked-direct-internal-access`",
    "`route-method-deny`",
    "`abuse-rate-limit`",
    "`trusted-proxy-untrusted-spoof-rejected`",
    "`trusted-proxy-malformed-chain-fallback`",
    "`trusted-proxy-rightmost-hop-selection`",
    "`stale-secret-rejection`",
    "`admin-credential-ttl-expiry`",
    "`canonical-public-edge-route-behavior`",
    "`edge-mode-client-parity`",
  ]) {
    mustInclude(releaseChecklist, `- ${scenario}`);
  }
  mustInclude(releaseChecklist, "- The first promotion review after Stories 12.6 and 0.15 are complete requires at least one successful same-environment `live-external` drill set from the last 7 days.");
  mustInclude(releaseChecklist, "- Any execution mode other than `live-external` blocks promotion evidence.");
  mustInclude(releaseChecklist, "- Promotion drill evidence older than 7 days blocks promotion.");
  mustInclude(releaseChecklist, "- Missing rerun lineage when a superseding drill set exists in the same review window blocks promotion.");
  mustInclude(releaseChecklist, "- Rolling-history rows that skip a weekly governance window or reference a superseded set instead of the latest non-superseded set for that week block promotion.");
  mustInclude(releaseChecklist, "- Story 10.1 and Story 10.4 evidence remain required release-readiness anchors, but neither can substitute for the DMZ drill set.");
  mustInclude(releaseChecklist, "- `planning-review` or historical baseline artifacts may support preparation, but they cannot be linked as promotion-satisfying drill evidence.");
});

test("Sprint ledger and prerequisite stories reflect Story 12.5 completion and Story 0.15 done-state", () => {
  const story = readText(storyPath);
  const sprintStatus = readText(sprintStatusPath);
  const story015 = readText(story015Path);

  mustInclude(story015, "Status: done");
  mustInclude(story015, "- Status set to `done`.");
  mustInclude(sprintStatus, "epic-0: done");
  mustInclude(sprintStatus, "0-15-mobile-edge-parity-and-physical-device-transport-hardening: done");
  mustInclude(sprintStatus, "epic-12: done");
  mustInclude(sprintStatus, "12-5-dmz-security-drill-and-evidence-gate: done");
  mustInclude(sprintStatus, "Story 12.5 is no longer blocked because Stories 12.6 and 0.15 are done, and its governance/evidence baseline plus regression coverage are now complete.");
  mustInclude(sprintStatus, "Epic 12 core story sequence is complete; actual release promotion still requires fresh same-environment `live-external` drill evidence at execution time.");
  assert.doesNotMatch(sprintStatus, /12-5-dmz-security-drill-and-evidence-gate: blocked|0-15-mobile-edge-parity-and-physical-device-transport-hardening: review/);
});
