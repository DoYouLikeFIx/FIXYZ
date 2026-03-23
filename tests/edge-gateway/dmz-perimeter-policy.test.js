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
  "12-2-edge-perimeter-policy-hardening.md",
);
const edgeTemplatePath = path.join(repoRoot, "docker", "nginx", "templates", "fixyz-edge.conf.template");
const routePolicyPath = path.join(repoRoot, "docs", "ops", "dmz-route-policy.md");
const trustedProxiesPath = path.join(repoRoot, "docs", "ops", "dmz-trusted-proxies.md");
const abuseResponsePath = path.join(repoRoot, "docs", "ops", "dmz-abuse-response.md");
const adminAccessPath = path.join(repoRoot, "docs", "ops", "dmz-admin-access.md");
const drillGovernancePath = path.join(repoRoot, "docs", "ops", "dmz-drill-governance.md");
const sharedQaSummaryPath = path.join(repoRoot, "_bmad-output", "implementation-artifacts", "tests", "test-summary.md");
const storyQaSummaryPath = path.join(
  repoRoot,
  "_bmad-output",
  "implementation-artifacts",
  "tests",
  "story-12-2-edge-perimeter-policy-hardening-summary.md",
);

const storyOwnedPaths = new Set([
  "docs/ops/dmz-route-policy.md",
  "tests/edge-gateway/dmz-network-segmentation.test.js",
  "tests/edge-gateway/dmz-perimeter-policy.test.js",
  "_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md",
  "_bmad-output/implementation-artifacts/sprint-status.yaml",
  "_bmad-output/implementation-artifacts/tests/story-12-2-edge-perimeter-policy-hardening-summary.md",
]);

const publicRouteMatrixRows = [
  ["`/health/channel`", "`GET`", "none", "none", "Health probe through edge"],
  ["`/api/v1/auth/register`", "`POST`", "none", "required", "Public registration"],
  ["`/api/v1/auth/csrf`", "`GET`", "none", "none", "CSRF bootstrap"],
  ["`/api/v1/auth/login`", "`POST`", "none", "required", "Public login"],
  ["`/api/v1/auth/logout`", "`POST`", "authenticated session", "required", "Authenticated logout"],
  ["`/api/v1/auth/session`", "`GET`", "authenticated session", "none", "Session status check"],
  ["`/api/v1/orders/sessions`", "`POST`", "authenticated session", "required", "Order session create"],
  ["`/api/v1/orders/sessions/{orderSessionId}/otp`", "`POST`", "authenticated session", "required", "OTP verify"],
  ["`/api/v1/orders/sessions/{orderSessionId}/execute`", "`POST`", "authenticated session", "required", "Execute order"],
  ["`/api/v1/orders/sessions/{orderSessionId}/cancel`", "`POST`", "authenticated session", "required", "Session cancel"],
  ["`/api/v1/orders/sessions/{orderSessionId}`", "`GET`", "authenticated session", "none", "Session status polling"],
  ["`/api/v1/orders`", "`GET`", "authenticated session", "none", "Order history list"],
  ["`/api/v1/orders/cb-status`", "`GET`", "authenticated session", "none", "Circuit-breaker status poll after reconnect"],
  ["`/api/v1/notifications/stream`", "`GET`", "authenticated session", "none", "Notification stream"],
  ["`/api/v1/notifications`", "`GET`", "authenticated session", "none", "Notification list"],
];

const unrelatedReviewSnapshotLines = [
  " M BE",
  " M FE",
  " M MOB",
  " M _bmad-output/implementation-artifacts/9-5-integrated-final-state-and-retry-ux.md",
  " M _bmad-output/implementation-artifacts/9-6-integrated-final-state-and-retry-ux.md",
  " M docs/contracts/external-order-error-ux.json",
  "?? _bmad-output/implementation-artifacts/11-5-be-fe-be-mob-compact-flows.md",
  "?? _bmad-output/implementation-artifacts/11-5-fe-mob-actual-runtime-flows.md",
  "?? _bmad-output/implementation-artifacts/11-5-market-ticker-e2e-and-videos.md",
  "?? _bmad-output/implementation-artifacts/media/",
];

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

function extractFencedCodeBlockAfterHeading(text, heading) {
  const fence = "```";
  const blockPattern = new RegExp(
    `${escapeRegex(heading)}[\\s\\S]*?${escapeRegex(fence)}(?:text)?\\n([\\s\\S]*?)\\n${escapeRegex(fence)}`,
    "m",
  );
  const match = text.match(blockPattern);
  assert.ok(match, `missing fenced code block after heading: ${heading}`);
  return match[1];
}

function gitStatusShortLines() {
  const output = childProcess.execFileSync("git", ["status", "--short"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trimEnd();

  if (!output) {
    return [];
  }

  return output.split(/\r?\n/);
}

function unrelatedGitStatusLines() {
  return gitStatusShortLines().filter((line) => !storyOwnedPaths.has(line.slice(3).trim()));
}

test("Story 12.2 stays documentation-only and root-project-only", () => {
  const story = readText(storyPath);

  mustMatch(story, /documentation-only story/i);
  mustMatch(story, /Story 0\.7 remains the active ingress\/runtime baseline until a separate reviewed Epic 12 runtime change is approved\./);
  mustMatch(story, /Story 12\.2 implementation must stay in the repository root \(`docs\/\*\*`, `tests\/\*\*`, `_bmad-output\/\*\*`\); `BE`, `FE`, and `MOB` are reference-only inputs for this story\./);

  for (const changedPath of [
    "docs/ops/dmz-route-policy.md",
    "tests/edge-gateway/dmz-network-segmentation.test.js",
    "tests/edge-gateway/dmz-perimeter-policy.test.js",
    "_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md",
    "_bmad-output/implementation-artifacts/sprint-status.yaml",
    "_bmad-output/implementation-artifacts/tests/story-12-2-edge-perimeter-policy-hardening-summary.md",
  ]) {
    mustInclude(story, changedPath);
  }

  for (const validatedPath of [
    "docs/ops/dmz-trusted-proxies.md",
    "docs/ops/dmz-abuse-response.md",
    "docs/ops/dmz-admin-access.md",
    "docs/ops/dmz-drill-governance.md",
    "docker/nginx/templates/fixyz-edge.conf.template",
    "BE/**",
    "FE/**",
    "MOB/**",
  ]) {
    mustInclude(story, validatedPath);
  }
});

test("Story 12.2 captures a concrete review-time worktree snapshot and compares it to live unrelated changes when present", () => {
  const story = readText(storyPath);
  const snapshotBlock = extractFencedCodeBlockAfterHeading(story, "### Review-Time Worktree Snapshot")
    .split(/\r?\n/)
    .filter(Boolean);
  const currentUnrelatedLines = unrelatedGitStatusLines();

  mustInclude(story, "### Review-Time Worktree Snapshot");
  mustMatch(story, /Snapshot captured on `2026-03-24` from `git status --short`/);
  mustMatch(story, /Historical audit note only/i);
  assert.deepEqual(snapshotBlock, unrelatedReviewSnapshotLines);

  if (currentUnrelatedLines.length > 0) {
    assert.deepEqual(snapshotBlock, currentUnrelatedLines);
  }
});

test("DMZ route policy anchors the hardened contract to the current edge baseline without changing runtime", () => {
  const edgeTemplate = readText(edgeTemplatePath);
  const routePolicy = readText(routePolicyPath);

  mustInclude(routePolicy, "This is a target-state design document only.");
  mustInclude(routePolicy, "The active runtime baseline remains Story 0.7.");
  mustHaveTableRow(routePolicy, [
    "Route Prefix",
    "Allowed Methods",
    "Auth Requirement",
    "CSRF Requirement",
    "Notes",
  ]);
  mustInclude(routePolicy, "The active Story 0.7 channel-service scaffold currently exposes only this subset of direct public controller paths:");
  mustInclude(routePolicy, "`POST /api/v1/auth/otp/verify`");
  mustInclude(routePolicy, "`GET /api/v1/notifications/stream`");
  mustInclude(routePolicy, "`/api/v1/channel/*` is a baseline-only edge alias, not a canonical product API path.");
  mustInclude(routePolicy, "Future hardened public-edge policy must remove and deny `/api/v1/channel/*` by default.");
  mustInclude(routePolicy, "current edge does not expose canonical auth namespace");
  mustInclude(routePolicy, "current edge does not expose canonical order namespace");
  mustInclude(routePolicy, "canonical path missing on edge baseline");
  mustInclude(routePolicy, "`404 EDGE_ROUTE_NOT_ALLOWED`");
  mustInclude(routePolicy, "`404 EDGE_METHOD_NOT_ALLOWED`");
  mustInclude(routePolicy, "`403 EDGE_INTERNAL_NAMESPACE_DENIED`");
  mustInclude(routePolicy, "`403`, stable error code `EDGE_DMZ_TEMP_DENY`");
  mustInclude(routePolicy, "`429`, `Retry-After: 60`, stable error code `EDGE_RATE_LIMITED`");
  mustInclude(routePolicy, "percent-decode unreserved characters exactly once before route matching");
  mustInclude(routePolicy, "Encoded slash or backslash characters (`%2F`, `%5C`, case-insensitive) are rejected before allowlist evaluation with `404 EDGE_ROUTE_NOT_ALLOWED`.");
  mustInclude(routePolicy, "Public edge must continue to deny `/api/v1/admin/`, `/ops/dmz/*`, and any equivalent privileged namespace on the `public-edge` listener.");
  mustMatch(routePolicy, /`HEAD` is not implicitly allowed by a `GET` entry on the `public-edge` contract\./);
  mustMatch(routePolicy, /`OPTIONS` is not implicitly allowed on allowlisted paths\./);
  mustMatch(routePolicy, /Unknown routes: `60 req\/min\/source_identity` with `burst 20`\./);
  mustMatch(routePolicy, /Sensitive routes .* `20 req\/min\/source_identity` with `burst 5`\./);
  mustMatch(routePolicy, /Temporary deny window: apply 10-minute block when the same normalized `source_identity` triggers 5 or more rate-limit violations within 5 minutes\./);
  mustMatch(routePolicy, /Edge-generated deny\/rate-limit decisions must be written to structured logs or evidence records with `enforcement_layer`, `limit_key_type`, `request_id`, and `source_identity`/);
  for (const row of publicRouteMatrixRows) {
    mustHaveTableRow(routePolicy, row);
  }

  mustInclude(edgeTemplate, "location /api/v1/channel/notifications/stream");
  mustInclude(edgeTemplate, "location /api/v1/channel/");
  mustInclude(edgeTemplate, "location /api/v1/corebank/");
  mustInclude(edgeTemplate, "location /api/v1/fep/gateway/");
  mustInclude(edgeTemplate, "location /api/v1/fep/simulator/");
  mustInclude(edgeTemplate, "return 404 '{\"error\":\"EDGE_ROUTE_NOT_ALLOWED\",\"status\":404}'");
  assert.doesNotMatch(edgeTemplate, /location\s+(?:=|\^~|~\*|~)?\s*(?:\^)?\/api\/v1\/auth(?:\/|\b)/);
  assert.doesNotMatch(edgeTemplate, /location\s+(?:=|\^~|~\*|~)?\s*(?:\^)?\/api\/v1\/orders(?:\/|\b)/);
  assert.doesNotMatch(edgeTemplate, /location\s+(?:=|\^~|~\*|~)?\s*(?:\^)?\/api\/v1\/notifications(?:\/|\b)/);
});

test("Trusted proxy and abuse-response docs keep Story 12.2 operator and drill contracts explicit", () => {
  const trustedProxies = readText(trustedProxiesPath);
  const abuseResponse = readText(abuseResponsePath);
  const adminAccess = readText(adminAccessPath);
  const drillGovernance = readText(drillGovernancePath);

  mustInclude(trustedProxies, "`EDGE_TRUSTED_PROXY_CIDR_1`");
  mustInclude(trustedProxies, "`EDGE_TRUSTED_PROXY_CIDR_2`");
  mustInclude(trustedProxies, "Default-safe posture remains loopback only unless a reviewed deployment change says otherwise.");
  mustInclude(trustedProxies, "Starting from the right-most hop, select the first address that is not itself in the trusted CIDR set.");
  mustInclude(trustedProxies, "If every hop is trusted, fall back to the left-most valid hop.");
  mustInclude(trustedProxies, "Persist both `source_identity` and `source_identity_origin` (`remote_addr` or `x_forwarded_for`) in audit evidence.");

  mustInclude(abuseResponse, "The operator interface may be exposed as CLI or API, but it must implement the same audited contract and accept:");
  mustInclude(abuseResponse, "`dmz:access:deny:read`");
  mustInclude(abuseResponse, "`dmz:access:deny:write`");
  mustInclude(abuseResponse, "- `apply`");
  mustInclude(abuseResponse, "- `list`");
  mustInclude(abuseResponse, "- `revoke`");
  mustInclude(abuseResponse, "- `expire-sweep`");
  mustInclude(abuseResponse, "duplicate requests with the same `(target, reason, ticket-id, idempotency-key)` tuple must return the existing deny record instead of creating a second record");
  mustInclude(abuseResponse, "`deny_record_id`");
  mustInclude(abuseResponse, "`source_identity_origin`");
  mustInclude(abuseResponse, "`listener_scope` for this operator surface must remain the private Story 12.4 control-plane surface rather than `public-edge`.");

  mustInclude(adminAccess, "Story 12.2 deny management uses `apply`, `list`, `revoke`, and `expire-sweep`");
  mustInclude(adminAccess, "`dmz:access:deny:read`, `dmz:access:deny:write`");

  for (const scenario of [
    "route-method-deny",
    "abuse-rate-limit",
    "trusted-proxy-untrusted-spoof-rejected",
    "trusted-proxy-malformed-chain-fallback",
    "trusted-proxy-rightmost-hop-selection",
  ]) {
    mustInclude(drillGovernance, `\`${scenario}\``);
  }

  mustMatch(
    drillGovernance,
    /\| `route-method-deny` \| Story 12\.2 \|[\s\S]*\| `abuse-rate-limit` \| Story 12\.2 \|[\s\S]*\| `trusted-proxy-rightmost-hop-selection` \| Story 12\.2 \|/m,
  );
});

test("Story 12.2 QA reporting lives in a dedicated summary artifact", () => {
  const sharedQaSummary = readText(sharedQaSummaryPath);
  const storyQaSummary = readText(storyQaSummaryPath);

  assert.doesNotMatch(sharedQaSummary, /Story 12\.2: Edge Perimeter Policy Hardening/);
  mustInclude(storyQaSummary, "# Story 12.2 Test Automation Summary");
  mustInclude(storyQaSummary, "Story 12.2: Edge Perimeter Policy Hardening");
  mustInclude(storyQaSummary, "Acceptance criteria: `4/4` guarded by root `edge-gateway` contract tests.");
  mustInclude(storyQaSummary, "`node --test /Users/yeongjae/fixyz/tests/edge-gateway/dmz-perimeter-policy.test.js`");
});
