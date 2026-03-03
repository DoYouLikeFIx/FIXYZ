# Story 0.5: Collaboration Webhook Notifications (MatterMost + Jira + GitHub)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a delivery team,
I want Jira and GitHub webhook events delivered to MatterMost,
so that release/quality state is visible in real time without manual polling.

## Acceptance Criteria

1. Given GitHub webhook events (`pull_request`, `workflow_run`), when GitHub Actions workflow posts to MatterMost incoming webhook, then MatterMost receives standardized notifications with repository, actor, link, and result.
2. Given Jira webhook events for issue lifecycle transitions, when Jira Automation rule sends transition event to MatterMost webhook, then MatterMost receives issue key, summary, previous/new status, and assignee context.
3. Given webhook secrets and integration endpoints, when runtime configuration is applied, then credentials are managed only via GitHub Secrets and Jira secured webhook settings (no hardcoding).
4. Given duplicate delivery or retry from source systems, when normalized dedupe key `source + source_project + target_channel + event_type + entity_id + normalized_target_status + normalized_actor` (`null`/missing -> `_`) or source event id (`delivery_id`/equivalent) repeats within source suppression window (`GitHub=10m`, `Jira=10m`), then duplicated user-visible posts are suppressed.
5. Given direct integration architecture (no central relay), when dedupe state is persisted, then source-specific dedupe contract is explicit and auditable (`GitHub`: Actions cache key `mm-dedupe-{dedupe_hash}-{window_bucket_10m}` where `window_bucket_10m=floor(event_epoch/600)`; `Jira`: entity/property `mm_last_hash` + `mm_last_ts` with 10-minute timestamp comparison).
6. Given outbound posting failure to MatterMost, when network timeout or non-2xx response occurs, then source retry policy executes with bounded retries (`max_attempts=3`) using source-specific backoff contract (`GitHub`: `2s`,`5s` + jitter `±20%`; `Jira`: fixed `2s`,`5s` without jitter due platform limits), per-source+per-entity ordering guard, and final failure visibility in run/audit logs.
7. Given reliability validation runbook execution, when duplicate and failure scenarios are replayed, then evidence artifacts are saved with reproducible naming under `docs/ops/webhook-validation/<YYYYMMDD>/` plus CI/Jira artifact retention configuration (`>=90 days`) and index metadata.

## Tasks / Subtasks

- [x] Implement GitHub Actions -> MatterMost notification workflow (AC: 1)
  - [x] Support PR lifecycle and workflow result event triggers
  - [x] Normalize message template (repo, actor, event, URL, result)
- [x] Implement Jira Automation -> MatterMost notification rule set (AC: 2)
  - [x] Support Story/Epic transition events
  - [x] Normalize message template (issue key, summary, status change, assignee)
- [x] Implement secure configuration management for webhook integration (AC: 3)
  - [x] Manage webhook URL/token only via GitHub Secrets and Jira secured settings
  - [x] Prevent sensitive token/URL leaks in logs
- [x] Implement idempotency and anti-spam controls (AC: 4)
  - [x] Implement dedupe key normalization: `source + source_project + target_channel + event_type + entity_id + normalized_target_status + normalized_actor` (`null`/missing -> `_`)
  - [x] Prefer source event unique id (`delivery_id`/equivalent) when available; fallback to normalized hash key
  - [x] Set suppression window to 10 minutes per source (GitHub/Jira) and document rationale
  - [x] Suppress duplicate visible posts while keeping audit trace
- [x] Define source-specific dedupe state contract (AC: 5)
  - [x] GitHub: document cache-key contract `mm-dedupe-{dedupe_hash}-{window_bucket_10m}` and bucket computation rule (`floor(event_epoch/600)`) for 10-minute suppression
  - [x] Jira: document entity/property-based dedupe state (`mm_last_hash`, `mm_last_ts`) and 10-minute timestamp comparison rule
  - [x] Ensure dedupe state contract is auditable from workflow/audit logs
- [x] Implement source-level retry/observability for posting failures (AC: 6)
  - [x] Configure bounded retries (`max_attempts=3`) with source-specific backoff (`GitHub`: `2s`,`5s` + jitter `±20%`; `Jira`: fixed `2s`,`5s`, no jitter)
  - [x] Define per-source+per-entity ordering guard (cross-source total ordering is out of scope)
  - [x] Configure Jira automation failure visibility and audit trail with explicit platform-limited retry semantics
  - [x] Define deterministic verification rule: GitHub retries assert delay range; Jira retries assert fixed delay sequence
- [x] Add validation runbook for GitHub/Jira flows, duplicate suppression, and failure recovery (AC: 7)
  - [x] Include replay scenarios: duplicate webhook event, timeout, 429/5xx response, webhook URL misconfiguration
  - [x] Save artifacts in `docs/ops/webhook-validation/<YYYYMMDD>/` using fixed naming (`github-*.log`, `jira-*.json`, `payload-*.json`)
  - [x] Configure artifact retention enforcement (`retention-days: 90` for GitHub artifacts, Jira automation audit/export retention policy) and document owner

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 0 (`0.1`~`0.10`).
- Depends on Story 0.2 (CI foundation and quality-gate context).
- Scope is collaboration visibility automation only; no product-domain feature logic.
- Approach decision: Option 1 finalized (`GitHub Actions + Jira Automation` direct delivery to MatterMost), no central relay service in this story.

### Technical Requirements

- Event sources:
  - GitHub webhook events via GitHub Actions: PR lifecycle + workflow result.
  - Jira webhook events via Jira Automation: issue transition for Story/Epic tracking.
- Delivery:
  - MatterMost message format must be standardized and link-rich.
- Reliability:
  - Source-side dedupe state contract and retry policy on post failures.
  - Retry policy must include bounded attempts and per-source+per-entity ordering guard; jitter is GitHub-only and Jira uses fixed delays due platform limits.
- Security:
  - Secrets only in GitHub Secrets and Jira secured webhook configuration, zero hardcoded credentials.

### Architecture Compliance

- Keep integration isolated to CI/ops/collaboration boundary.
- Do not introduce a new relay microservice or BE domain coupling in this story.
- Keep logs structured and scrubbed for sensitive values.

### File Structure Requirements

- Expected touched areas:
  - `.github/workflows/**` (GitHub -> MatterMost notification workflow)
  - Jira automation rule configuration artifacts/export notes
  - `docs/ops/webhook-validation/**` (reliability evidence artifacts)
  - `docs/**` or `README.md` for runbook/secret setup

### Testing Requirements

- Required checks:
  - GitHub PR/CI events map to expected MatterMost payload format.
  - Jira status transition events map to expected MatterMost payload format.
  - Duplicate delivery does not produce duplicate user-visible posts under source-specific 10-minute suppression windows.
  - Dedupe normalization rules are validated in fixtures/logs (`null`/missing -> `_`, source event id precedence, fallback hash behavior).
  - Source-specific dedupe state behavior (`10m` suppression window) is test-verified for GitHub and Jira flows.
  - Post failure path is visible in GitHub/Jira run/audit logs with bounded retry evidence (`max_attempts=3`).
  - Failure simulation suite covers timeout and non-2xx scenarios with deterministic expected outcomes (`GitHub`: jitter range checks, `Jira`: fixed delay checks), plus per-source+per-entity ordering checks.
  - Evidence artifacts are indexed under `docs/ops/webhook-validation/<YYYYMMDD>/` and retention enforcement (`>=90 days`) is verifiable from CI/Jira settings.
  - Secret values are never printed in logs.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Security gate:
  - Validate no webhook secret/token leakage in logs or committed files.
- Idempotency gate:
  - Validate duplicate deliveries are suppressed via explicit normalized dedupe key + source event id precedence + source-specific dedupe state + 10-minute window.
- Reliability gate:
  - Validate bounded retry (`max_attempts=3`), source-specific backoff rules, per-source+per-entity ordering, and failure observability under simulated outages.
- Evidence gate:
  - Attach event replay logs/tests for GitHub, Jira, duplicate, timeout, and non-2xx failure scenarios under `docs/ops/webhook-validation/<YYYYMMDD>/` with fixed naming and retention metadata.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Collaboration webhook integration story prepared with delivery, security, and reliability guardrails.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.5)
- `_bmad-output/implementation-artifacts/0-2-be-test-ci-foundation.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `npm run lint:collab-webhook`
- `npm run test:collab-webhook`
- `npm test`
- `GITHUB_EVENT_PATH=<tmpfile> GITHUB_EVENT_NAME=pull_request GITHUB_REPOSITORY=DoYouLikeFix/FIXYZ GITHUB_ACTOR=yeongjae MATTERMOST_CHANNEL_KEY=fix-delivery node .github/scripts/collab-webhook/build-github-payload.js`

### Completion Notes List

- Implemented root-level GitHub workflow `collaboration-webhook-notifications.yml` for `pull_request` and `workflow_run` events with standardized MatterMost payload generation.
- Added source-aware dedupe contract with normalized key fallback, source event id precedence, and GitHub cache key contract `mm-dedupe-{dedupe_hash}-{window_bucket_10m}`.
- Added bounded retry sender with source-specific policy (`GitHub` jitter `+-20%`, `Jira` fixed delays), plus structured failure observability logs.
- Added Jira automation integration artifacts and setup guide documenting issue transition mapping, issue property dedupe state (`mm_last_hash`, `mm_last_ts`), fixed retry semantics, and secure webhook variable usage.
- Added reliability runbook and dated evidence bundle under `docs/ops/webhook-validation/20260303/` with fixed naming and retention metadata (`>=90 days`).
- Added unit tests validating message normalization, dedupe behavior, retry schedules, and deterministic delay contract checks.

### File List

- .github/scripts/collab-webhook/README.md
- .github/scripts/collab-webhook/build-github-payload.js
- .github/scripts/collab-webhook/build-jira-payload.js
- .github/scripts/collab-webhook/notification-utils.js
- .github/scripts/collab-webhook/post-to-mattermost.js
- .github/scripts/collab-webhook/retry-utils.js
- .github/workflows/collaboration-webhook-notifications.yml
- docs/ops/collaboration-webhook-notifications.md
- docs/ops/jira/mattermost-automation-rule-template.json
- docs/ops/jira/mattermost-automation-setup.md
- docs/ops/webhook-validation/README.md
- docs/ops/webhook-validation/20260303/github-duplicate.log
- docs/ops/webhook-validation/20260303/github-timeout.log
- docs/ops/webhook-validation/20260303/index.json
- docs/ops/webhook-validation/20260303/index.md
- docs/ops/webhook-validation/20260303/jira-duplicate.json
- docs/ops/webhook-validation/20260303/jira-failure-429.json
- docs/ops/webhook-validation/20260303/payload-github-pr-opened.json
- docs/ops/webhook-validation/20260303/payload-jira-transition.json
- package.json
- tests/collab-webhook/notification-utils.test.js
- tests/collab-webhook/retry-utils.test.js
- _bmad-output/implementation-artifacts/0-5-collaboration-webhook-notifications.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-03-03: Implemented Story 0.5 direct GitHub/Jira -> MatterMost notification flow with secure secret handling, dedupe/retry contracts, validation artifacts, and automated tests.
