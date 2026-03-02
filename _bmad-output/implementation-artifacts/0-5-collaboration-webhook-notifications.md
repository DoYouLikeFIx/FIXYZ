# Story 0.5: Collaboration Webhook Notifications (MatterMost + Jira + GitHub)

Status: ready-for-dev

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

- [ ] Implement GitHub Actions -> MatterMost notification workflow (AC: 1)
  - [ ] Support PR lifecycle and workflow result event triggers
  - [ ] Normalize message template (repo, actor, event, URL, result)
- [ ] Implement Jira Automation -> MatterMost notification rule set (AC: 2)
  - [ ] Support Story/Epic transition events
  - [ ] Normalize message template (issue key, summary, status change, assignee)
- [ ] Implement secure configuration management for webhook integration (AC: 3)
  - [ ] Manage webhook URL/token only via GitHub Secrets and Jira secured settings
  - [ ] Prevent sensitive token/URL leaks in logs
- [ ] Implement idempotency and anti-spam controls (AC: 4)
  - [ ] Implement dedupe key normalization: `source + source_project + target_channel + event_type + entity_id + normalized_target_status + normalized_actor` (`null`/missing -> `_`)
  - [ ] Prefer source event unique id (`delivery_id`/equivalent) when available; fallback to normalized hash key
  - [ ] Set suppression window to 10 minutes per source (GitHub/Jira) and document rationale
  - [ ] Suppress duplicate visible posts while keeping audit trace
- [ ] Define source-specific dedupe state contract (AC: 5)
  - [ ] GitHub: document cache-key contract `mm-dedupe-{dedupe_hash}-{window_bucket_10m}` and bucket computation rule (`floor(event_epoch/600)`) for 10-minute suppression
  - [ ] Jira: document entity/property-based dedupe state (`mm_last_hash`, `mm_last_ts`) and 10-minute timestamp comparison rule
  - [ ] Ensure dedupe state contract is auditable from workflow/audit logs
- [ ] Implement source-level retry/observability for posting failures (AC: 6)
  - [ ] Configure bounded retries (`max_attempts=3`) with source-specific backoff (`GitHub`: `2s`,`5s` + jitter `±20%`; `Jira`: fixed `2s`,`5s`, no jitter)
  - [ ] Define per-source+per-entity ordering guard (cross-source total ordering is out of scope)
  - [ ] Configure Jira automation failure visibility and audit trail with explicit platform-limited retry semantics
  - [ ] Define deterministic verification rule: GitHub retries assert delay range; Jira retries assert fixed delay sequence
- [ ] Add validation runbook for GitHub/Jira flows, duplicate suppression, and failure recovery (AC: 7)
  - [ ] Include replay scenarios: duplicate webhook event, timeout, 429/5xx response, webhook URL misconfiguration
  - [ ] Save artifacts in `docs/ops/webhook-validation/<YYYYMMDD>/` using fixed naming (`github-*.log`, `jira-*.json`, `payload-*.json`)
  - [ ] Configure artifact retention enforcement (`retention-days: 90` for GitHub artifacts, Jira automation audit/export retention policy) and document owner

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 0 (`0.1`~`0.5`).
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

- Story generated from canonical Epic 0 update and party-mode review criteria.

### Completion Notes List

- Added webhook security, idempotency, and retry/observability controls as explicit gates.
- Locked implementation decision to Option 1 (direct tool integration, no central relay).

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-5-collaboration-webhook-notifications.md
