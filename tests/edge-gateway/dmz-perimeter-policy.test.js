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

const storyOwnedPaths = new Set([
  "docs/ops/dmz-route-policy.md",
  "tests/edge-gateway/dmz-network-segmentation.test.js",
  "tests/edge-gateway/dmz-perimeter-policy.test.js",
  "_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md",
  "_bmad-output/implementation-artifacts/sprint-status.yaml",
]);

const publicRouteMatrixRows = [
  ["`/health/channel`", "`GET`", "none", "none", "Public edge health probe"],
  ["`/api/v1/auth/csrf`", "`GET`", "none", "none", "CSRF bootstrap"],
  ["`/api/v1/auth/register`", "`POST`", "none", "required", "Public registration"],
  ["`/api/v1/auth/login`", "`POST`", "none", "required", "Public login"],
  ["`/api/v1/auth/session`", "`GET`", "authenticated session", "none", "Session status check"],
  ["`/api/v1/auth/logout`", "`POST`", "authenticated session", "required", "Authenticated logout"],
  ["`/api/v1/auth/otp/verify`", "`POST`", "none", "required", "Login OTP verify"],
  ["`/api/v1/auth/password/forgot`", "`POST`", "none", "required", "Password recovery start"],
  ["`/api/v1/auth/password/forgot/challenge`", "`POST`", "none", "required", "Password recovery challenge bootstrap"],
  ["`/api/v1/auth/password/forgot/challenge/fail-closed`", "`POST`", "none", "required", "Client fail-closed telemetry"],
  ["`/api/v1/auth/password/reset`", "`POST`", "none", "required", "Password reset continuation"],
  ["`/api/v1/auth/mfa-recovery/rebind`", "`POST`", "none", "required", "Recovery TOTP rebind bootstrap"],
  ["`/api/v1/auth/mfa-recovery/rebind/confirm`", "`POST`", "none", "required", "Recovery TOTP rebind confirm"],
  ["`/api/v1/members/me/totp/enroll`", "`POST`", "authenticated session", "required", "Authenticated TOTP enroll"],
  ["`/api/v1/members/me/totp/confirm`", "`POST`", "authenticated session", "required", "Authenticated TOTP confirm"],
  ["`/api/v1/members/me/totp/rebind`", "`POST`", "authenticated session", "required", "Authenticated TOTP rebind bootstrap"],
  ["`/api/v1/orders/sessions`", "`POST`", "authenticated session", "required", "Order session create"],
  ["`/api/v1/orders/sessions/{orderSessionId}`", "`GET`", "authenticated session", "none", "Order session status"],
  ["`/api/v1/orders/sessions/{orderSessionId}/otp/verify`", "`POST`", "authenticated session", "required", "Order session OTP verify"],
  ["`/api/v1/orders/sessions/{orderSessionId}/extend`", "`POST`", "authenticated session", "required", "Order session extend"],
  ["`/api/v1/orders/sessions/{orderSessionId}/execute`", "`POST`", "authenticated session", "required", "Execute order"],
  ["`/api/v1/notifications`", "`GET`", "authenticated session", "none", "Notification list"],
  ["`/api/v1/notifications/{notificationId}/read`", "`PATCH`", "authenticated session", "required", "Notification read"],
  ["`/api/v1/notifications/stream`", "`GET`", "authenticated session", "none", "Notification stream"],
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

test("Story 12.2 captures a concrete historical review-time worktree snapshot and requires live overlap when unrelated changes are present", () => {
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
    const currentHistoricalOverlap = currentUnrelatedLines.filter((line) => snapshotBlock.includes(line));
    const snapshotHistoricalOverlap = snapshotBlock.filter((line) => currentUnrelatedLines.includes(line));

    assert.ok(
      currentHistoricalOverlap.length > 0,
      "expected at least one live unrelated change to overlap the historical snapshot",
    );
    assert.deepEqual(currentHistoricalOverlap, snapshotHistoricalOverlap);

    for (const line of currentUnrelatedLines) {
      assert.match(line, /^[ MADRCU?!]{2} /);
    }
  }
});

test("DMZ route policy documents the active Story 12.6 public-edge contract and the deterministic deny surface", () => {
  const edgeTemplate = readText(edgeTemplatePath);
  const routePolicy = readText(routePolicyPath);

  mustInclude(routePolicy, "Story 12.6 activates the canonical public-edge route contract in the current `edge-gateway` runtime.");
  mustInclude(routePolicy, "Local/dev host exposure from Story 0.7 still exists for convenience, but that path is outside the reviewed public ingress contract.");
  mustInclude(routePolicy, "`/health/channel` is the only public edge-owned health path.");
  mustInclude(routePolicy, "The active runtime scope today is limited to the allowlisted route surface, deterministic method deny, internal-namespace deny, `request_id` propagation in edge-generated responses, and upstream-failure handling.");
  mustInclude(routePolicy, "The normalization, trusted-proxy, rate-limit, and temporary-deny controls documented below remain planned hardening requirements and are not yet enforced by the shipped edge configuration.");
  mustHaveTableRow(routePolicy, [
    "Route Prefix",
    "Allowed Methods",
    "Auth Requirement",
    "CSRF Requirement",
    "Notes",
  ]);

  for (const row of publicRouteMatrixRows) {
    mustHaveTableRow(routePolicy, row);
  }

  for (const deniedPath of [
    "/health/corebank",
    "/health/fep-gateway",
    "/health/fep-simulator",
    "/api/v1/corebank/",
    "/api/v1/fep/",
    "/_edge/",
    "/internal/",
    "/admin/",
    "/api/v1/admin/",
    "/ops/dmz/",
  ]) {
    mustInclude(routePolicy, `- \`${deniedPath}\``);
  }

  mustInclude(routePolicy, "Legacy `/api/v1/channel/*` edge aliases are not part of the active allowlist.");
  mustInclude(routePolicy, "Temporary retention requires a reviewed migration contract with exact descendant mappings, synchronized docs/tests, and a cutoff plan.");
  mustInclude(routePolicy, "The remaining sections capture Story 12.2/12.4 design requirements for later hardening work.");
  mustInclude(routePolicy, "They are not active runtime guarantees in the shipped Story 12.6 edge configuration.");
  mustInclude(routePolicy, "`404 EDGE_ROUTE_NOT_ALLOWED`");
  mustInclude(routePolicy, "`404 EDGE_METHOD_NOT_ALLOWED`");
  mustInclude(routePolicy, "`403 EDGE_INTERNAL_NAMESPACE_DENIED`");
  mustInclude(routePolicy, "percent-decode unreserved characters exactly once before route matching");
  mustInclude(routePolicy, "malformed percent-encoding is rejected by the current Nginx parser with native `400 Bad Request`");
  mustInclude(routePolicy, "Encoded slash or backslash characters (`%2F`, `%5C`, case-insensitive) are rejected before allowlist evaluation with `404 EDGE_ROUTE_NOT_ALLOWED`.");
  mustMatch(routePolicy, /`HEAD` is not implicitly allowed by a `GET` entry on the `public-edge` contract\./);
  mustMatch(routePolicy, /`OPTIONS` is not implicitly allowed on allowlisted paths\./);
  mustMatch(routePolicy, /Unknown routes: `60 req\/min\/source_identity` with `burst 20`\./);
  mustMatch(routePolicy, /Sensitive routes .* `20 req\/min\/source_identity` with `burst 5`\./);
  mustMatch(routePolicy, /Temporary deny window: apply 10-minute block when the same normalized `source_identity` triggers 5 or more rate-limit violations within 5 minutes\./);
  mustMatch(routePolicy, /Edge-generated deny\/rate-limit decisions must be written to structured logs or evidence records with `enforcement_layer`, `limit_key_type`, `request_id`, and `source_identity`/);
  mustInclude(routePolicy, "Public edge must continue to deny `/api/v1/admin/`, `/ops/dmz/*`, and any equivalent privileged namespace on the `public-edge` listener.");
  mustInclude(routePolicy, "Malformed percent-encoding currently returns the native Nginx `400 Bad Request` response before the FIXYZ route contract is reached.");

  for (const route of [
    "location = /api/v1/auth/csrf",
    "location = /api/v1/auth/login",
    "location = /api/v1/auth/password/reset",
    "location = /api/v1/members/me/totp/rebind",
    "location = /api/v1/orders/sessions",
    "location ~ ^/api/v1/orders/sessions/[^/]+/otp/verify$",
    "location ~ ^/api/v1/orders/sessions/[^/]+/extend$",
    "location ~ ^/api/v1/orders/sessions/[^/]+/execute$",
    "location = /api/v1/notifications",
    "location ~ ^/api/v1/notifications/[^/]+/read$",
    "location = /api/v1/notifications/stream",
  ]) {
    mustInclude(edgeTemplate, route);
  }

  mustInclude(edgeTemplate, "location = /health/corebank");
  mustInclude(edgeTemplate, "location = /health/fep-gateway");
  mustInclude(edgeTemplate, "location = /health/fep-simulator");
  mustInclude(edgeTemplate, "location ^~ /api/v1/channel/");
  mustInclude(edgeTemplate, "location ^~ /api/v1/corebank/");
  mustInclude(edgeTemplate, "location ^~ /api/v1/fep/");
  mustInclude(edgeTemplate, "location ^~ /_edge/");
  mustInclude(edgeTemplate, "location ^~ /internal/");
  mustInclude(edgeTemplate, "location ^~ /admin/");
  mustInclude(edgeTemplate, "EDGE_ROUTE_NOT_ALLOWED");
  mustInclude(edgeTemplate, "EDGE_METHOD_NOT_ALLOWED");
  mustInclude(edgeTemplate, "EDGE_INTERNAL_NAMESPACE_DENIED");
  assert.doesNotMatch(edgeTemplate, /location \/api\/v1\/channel\/notifications\/stream \{\s*proxy_pass http:\/\/channel_service;/);
  assert.doesNotMatch(edgeTemplate, /proxy_pass http:\/\/corebank_service\/actuator\/health;/);
  assert.doesNotMatch(edgeTemplate, /proxy_pass http:\/\/fep_gateway\/actuator\/health;/);
  assert.doesNotMatch(edgeTemplate, /proxy_pass http:\/\/fep_simulator\/actuator\/health;/);
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

  mustHaveTableRow(drillGovernance, [
    "`route-method-deny`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 12.2",
    "required",
    "Confirms deterministic deny behavior for disallowed methods and internal namespaces.",
  ]);
  mustHaveTableRow(drillGovernance, [
    "`abuse-rate-limit`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 12.2",
    "required",
    "Confirms perimeter abuse controls and evidence fields from `docs/ops/dmz-abuse-response.md`.",
  ]);
  mustHaveTableRow(drillGovernance, [
    "`trusted-proxy-rightmost-hop-selection`",
    "`SEC`",
    "weekly minimum + release review",
    "Story 12.2",
    "required",
    "Separate right-most-hop selection scenario.",
  ]);
});

test("Story 12.2 keeps QA evidence inside tracked story artifacts", () => {
  const story = readText(storyPath);

  assert.doesNotMatch(
    story,
    /_bmad-output\/implementation-artifacts\/tests\/story-12-2-edge-perimeter-policy-hardening-summary\.md/,
  );
  mustInclude(story, "`node --test tests/edge-gateway/dmz-perimeter-policy.test.js`");
  mustInclude(story, "`npm run test:edge-gateway`");
  mustInclude(story, "QA evidence remains in this tracked story artifact and the root `edge-gateway` regression suite.");
});
