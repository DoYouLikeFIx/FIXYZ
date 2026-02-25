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
4. Given duplicate delivery or retry from source systems, when identical event context is detected by workflow/automation guard conditions, then duplicated user-visible spam is suppressed.
5. Given outbound posting failure to MatterMost, when network or API error occurs during source-side delivery, then source workflow/automation retry policy is applied and failure is observable in run/audit logs.

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
  - [ ] Add guard conditions to skip repeated context notifications within configured window
  - [ ] Suppress duplicate visible posts while keeping audit trace
- [ ] Implement source-level retry/observability for posting failures (AC: 5)
  - [ ] Configure GitHub Actions retry/failure reporting path
  - [ ] Configure Jira automation failure visibility and audit trail
- [ ] Add validation runbook for GitHub/Jira flows, duplicate suppression, and failure recovery

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
  - Source-side guard conditions and retry policy on post failures.
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
  - `docs/**` or `README.md` for runbook/secret setup

### Testing Requirements

- Required checks:
  - GitHub PR/CI events map to expected MatterMost payload format.
  - Jira status transition events map to expected MatterMost payload format.
  - Duplicate delivery does not produce duplicate user-visible posts under configured guard window.
  - Post failure path is visible in GitHub/Jira run/audit logs with retry evidence.
  - Secret values are never printed in logs.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Security gate:
  - Validate no webhook secret/token leakage in logs or committed files.
- Idempotency gate:
  - Validate duplicate deliveries are suppressed via source-side guard conditions.
- Reliability gate:
  - Validate source workflow/automation retry behavior and failure observability under simulated outages.
- Evidence gate:
  - Attach event replay logs/tests for GitHub, Jira, duplicate, and failure scenarios.

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
