# Story 7.3: [FE] Web Notification Center

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want real-time notification center with reconnection behavior,
So that order results are visible even across brief disconnections.

## Acceptance Criteria

1. Given authenticated web session When app mounts provider Then single SSE connection is established.
2. Given SSE disconnect When retry policy executes Then bounded retries occur before fallback.
3. Given missed-event window When reconnection succeeds Then fallback list API backfills notifications.
4. Given no notifications When feed renders Then empty state message is shown.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 7.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 7.1, Story 7.2.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.

### Story Completion Status

- Status set to `done`.
- Completion note: Epic 7 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.3)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 7.
- `pnpm test -- tests/unit/api/notificationApi.test.ts`
- `pnpm test -- tests/integration/App.test.tsx`
- `pnpm exec playwright test e2e/notification-center.spec.ts --reporter=list`
- `pnpm exec playwright test e2e/live/notification-center-live.spec.ts --reporter=list`

### Completion Notes List

- Extended `NotificationProvider` to keep a unified SSE connection and maintain in-app notification feed state.
- Added reconnect backfill flow by hydrating `GET /api/v1/notifications` after reconnect open.
- Added notification read action wiring to `PATCH /api/v1/notifications/{notificationId}/read` and reflected read state in UI.
- Added notification center rendering in protected layout with deterministic empty-state guidance.
- Validated with FE type-check and integration suite (`App.test.tsx`) including reconnect/backfill/read/empty-state scenarios.
- Auto-fixed code-review findings: feed resilience fallback, mark-read failure guidance, and unavailable-feed UX guidance.
- Added FE notification API unit coverage for list pagination defaults, cursor-based backfill query forwarding, and canonical mark-read patch path.
- Re-ran FE automated QA verification after API test additions with full green test outcome.
- Added Playwright notification-center UI flow coverage for authenticated entry, live stream event rendering, and mark-as-read interaction.
- Added Playwright reconnect-failure recovery flow coverage proving `Refresh feed` restores notification list after reconnect-triggered hydration failure.
- Added live-folder backend smoke E2E for notification center auth boundary checks (`/api/v1/notifications`, `/api/v1/notifications/stream`).
- Extended live-folder smoke with authenticated login flow to verify notification center renders on real `/portfolio` navigation.

### File List

- FE/src/api/notificationApi.ts
- FE/src/context/notification-context.ts
- FE/src/context/NotificationContext.tsx
- FE/src/hooks/auth/useProtectedSession.ts
- FE/src/components/layout/ProtectedLayout.tsx
- FE/src/index.css
- FE/tests/integration/App.test.tsx
- FE/tests/unit/api/notificationApi.test.ts
- FE/e2e/notification-center.spec.ts
- FE/e2e/live/notification-center-live.spec.ts
- _bmad-output/implementation-artifacts/7-3-web-notification-center.md

### Change Log

- 2026-03-17: Implemented AC1-AC4 for web notification center with single SSE stream usage, bounded reconnect/backfill hydration, read-state sync action, empty-state UI, and integration test coverage.
- 2026-03-17: Applied code-review autofixes (high/medium): robust notification feed fallback, explicit read-action failure guidance, feed-unavailable recovery action, and additional integration coverage.
- 2026-03-17: Added QA-focused FE notification API unit tests and re-validated notification center integration flows for story 7.3.
- 2026-03-17: Added Playwright E2E coverage for notification center user flow and validated UI-level stream/update/read behavior.
- 2026-03-17: Added reconnect-failure refresh-recovery E2E and live backend smoke E2E coverage for notification center hardening.
- 2026-03-17: Extended live smoke coverage with real-login notification center render verification (env-gated).

## Senior Developer Review (AI)

### Review Date

- 2026-03-17

### Outcome

- Approve

### Summary

- Verified AC coverage against implementation and tests.
- Auto-fixed all identified high/medium findings from adversarial review.
- Re-ran FE validation (`type-check`, `tests/integration/App.test.tsx`) successfully.

### Action Items

- [x] [HIGH] Resolve live-update contract fragility by adding resilient feed refresh path when SSE event payloads are unavailable.
- [x] [HIGH] Add explicit user-facing error handling for `mark as read` failures.
- [x] [MEDIUM] Prevent hydration failures from being shown as false empty-state; expose feed-unavailable guidance.
- [x] [MEDIUM] Provide actionable fallback UX (`Refresh feed`) for notification feed recovery.
