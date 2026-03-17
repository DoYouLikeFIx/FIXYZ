# Story 7.4: [MOB] Mobile Notification Feed

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want in-app notification feed and reconnection,
So that order outcomes remain visible on mobile.

## Acceptance Criteria

1. Given active mobile session When notification module starts Then live updates are received and stored in UI state.
2. Given app network loss/recovery When connection is restored Then missed notifications are synchronized.
3. Given notification read action When user marks as read Then read state is reflected in app and backend.
4. Given repeated disconnects When retry threshold exceeded Then user sees retry guidance.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

### Review Follow-ups (AI)

- [ ] [AI-Review][High] AC1 실시간 알림 계약 미충족: SSE stream이 heartbeat만 반환해 실제 notification 이벤트가 전달되지 않음 (BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java:54)
- [ ] [AI-Review][Medium] 읽음 처리 실패 롤백이 stale snapshot 기반으로 동작해 동시 수신된 신규 알림 상태를 덮어쓸 수 있음 (MOB/src/notification/use-notification-feed-view-model.ts:240)
- [ ] [AI-Review][Medium] AC1 테스트가 실제 백엔드 SSE payload 계약(heartbeat only)을 검증하지 않아 계약 불일치가 테스트에서 누락됨 (MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx:675)
- [ ] [AI-Review][Medium] 스토리 File List 대비 워크스페이스 실제 변경 범위가 확장(BE/FE 상위 변경 존재)되어 리뷰/배포 추적 투명성이 낮음 (git status --porcelain at repo root)

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

- Status set to `in-progress`.
- Completion note: Senior Developer Review (AI) raised follow-up actions before review completion.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `npx vitest run tests/unit/order/AuthenticatedHomeScreen.test.tsx tests/unit/auth/AppNavigator.mfa-recovery.test.tsx --reporter=verbose`
- `npm run typecheck`
- `npm run lint`

### Completion Notes List

- Added MOB notification API client for list/read endpoints and canonical stream URL resolution.
- Implemented mobile notification feed view-model with SSE lifecycle handling, bounded reconnect retries, and missed-notification synchronization on reconnect.
- Added in-app notification feed UI section on authenticated home with live list rendering, read action, and retry guidance banner.
- Extended mobile test coverage for AC1-AC4: live update intake, reconnect sync, read-state reflection, and retry-threshold guidance.
- Updated mobile runtime/navigation wiring so notification API is available in authenticated app flow.

### File List

- /Users/yeongjae/fixyz/MOB/src/api/notification-api.ts
- /Users/yeongjae/fixyz/MOB/src/notification/use-notification-feed-view-model.ts
- /Users/yeongjae/fixyz/MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- /Users/yeongjae/fixyz/MOB/src/navigation/AppNavigator.tsx
- /Users/yeongjae/fixyz/MOB/src/auth/create-mobile-auth-runtime.ts
- /Users/yeongjae/fixyz/MOB/App.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/auth/AppNavigator.mfa-recovery.test.tsx
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-4-mobile-notification-feed.md

## Change Log

- 2026-03-17: Implemented AC1-AC4 for mobile notification feed, including live stream intake, reconnect backfill sync, read-state API wiring, retry guidance UI, and automated unit coverage.
- 2026-03-17: Senior Developer Review (AI) completed with Changes Requested; story moved to in-progress and review follow-ups added.

## Senior Developer Review (AI)

### Review Date

- 2026-03-17

### Outcome

- Changes Requested

### Summary

- Git vs Story discrepancy detected (workspace-level): root repository contains additional BE/FE dirty state beyond this MOB story scope.
- AC2, AC3, AC4 are functionally implemented in MOB lane with passing focused tests.
- AC1 is only partially satisfied at system level due to backend stream contract returning heartbeat-only payload.

### Findings

1. [High] AC1 not fully implemented end-to-end. Notification stream endpoint currently returns static heartbeat payload only (`event:heartbeat\\ndata:ok\\n\\n`) and does not push notification events, so live update guarantee cannot be validated in integrated runtime.
  - Evidence: BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java:54
2. [Medium] `markAsRead` rollback uses closure snapshot (`currentSnapshot = items`) before async request, which can overwrite newer feed updates on failure and cause lost local state.
  - Evidence: MOB/src/notification/use-notification-feed-view-model.ts:240
3. [Medium] Notification feed tests validate synthetic `notification` event dispatch from test double, but do not assert compatibility with current backend SSE stream contract.
  - Evidence: MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx:675
4. [Medium] Story-scoped file audit is not fully aligned with current workspace dirty state (additional BE/FE root-level changes present), reducing traceability for this review cycle.
  - Evidence: `git status --porcelain` at repo root

### Action Items

- [ ] [High] Deliver real notification SSE event emission contract from backend stream path used by MOB, then add an integration verification (contract-level) proving mobile feed receives live order outcome events.
- [ ] [Medium] Refactor read-failure rollback to patch only target notification item or re-fetch authoritative list on failure to avoid stale snapshot overwrite.
- [ ] [Medium] Add contract-aware test case covering heartbeat payload + actual notification payload framing against channel stream semantics.
- [ ] [Medium] Align review branch hygiene/documentation so non-story BE/FE dirty state is isolated or explicitly tracked during story review.
