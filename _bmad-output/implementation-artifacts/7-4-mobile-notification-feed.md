# Story 7.4: [MOB] Mobile Notification Feed

Status: done

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

- [x] [AI-Review][High] AC1 실시간 알림 계약 미충족: SSE stream이 heartbeat만 반환해 실제 notification 이벤트가 전달되지 않음 (BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java:54)
- [x] [AI-Review][Medium] 읽음 처리 실패 롤백이 stale snapshot 기반으로 동작해 동시 수신된 신규 알림 상태를 덮어쓸 수 있음 (MOB/src/notification/use-notification-feed-view-model.ts:240)
- [x] [AI-Review][Medium] AC1 테스트가 실제 백엔드 SSE payload 계약(heartbeat only)을 검증하지 않아 계약 불일치가 테스트에서 누락됨 (MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx:675)
- [x] [AI-Review][Medium] 스토리 File List 대비 워크스페이스 실제 변경 범위가 확장(BE/FE 상위 변경 존재)되어 리뷰/배포 추적 투명성이 낮음 (git status --porcelain at repo root)

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
- Completion note: Senior Developer Review (AI) follow-up actions were remediated and re-validated in targeted MOB/BE test scope.

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
- `./gradlew :channel-service:test --tests 'com.fix.channel.controller.NotificationControllerContractTest' --tests 'com.fix.channel.service.ChannelScaffoldNotificationServiceTest' --console=plain`
- `npm run test -- tests/unit/api/notification-api.test.ts`
- `npm run test -- tests/unit/order/AuthenticatedHomeScreen.test.tsx`

### Completion Notes List

- Added MOB notification API client for list/read endpoints and canonical stream URL resolution.
- Implemented mobile notification feed view-model with SSE lifecycle handling, bounded reconnect retries, and missed-notification synchronization on reconnect.
- Added in-app notification feed UI section on authenticated home with live list rendering, read action, and retry guidance banner.
- Extended mobile test coverage for AC1-AC4: live update intake, reconnect sync, read-state reflection, and retry-threshold guidance.
- Updated mobile runtime/navigation wiring so notification API is available in authenticated app flow.
- Refactored backend notification stream endpoint to open SSE emitters and publish notification events for live-feed contract compliance.
- Hardened mobile read-failure rollback to use deterministic pre-update snapshot and avoid dropping concurrently received notifications.
- Added contract-aware notification stream test coverage for heartbeat payload handling and standard SSE message framing.
- Added mobile notification API unit coverage for list pagination defaults/overrides, mark-read PATCH contract, and stream URL normalization.

### File List

- /Users/yeongjae/fixyz/MOB/src/api/notification-api.ts
- /Users/yeongjae/fixyz/MOB/src/notification/use-notification-feed-view-model.ts
- /Users/yeongjae/fixyz/MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- /Users/yeongjae/fixyz/MOB/src/navigation/AppNavigator.tsx
- /Users/yeongjae/fixyz/MOB/src/auth/create-mobile-auth-runtime.ts
- /Users/yeongjae/fixyz/MOB/App.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/api/notification-api.test.ts
- /Users/yeongjae/fixyz/MOB/tests/unit/auth/AppNavigator.mfa-recovery.test.tsx
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/ChannelScaffoldService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/controller/NotificationControllerContractTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthSessionIntegrationTest.java
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-4-mobile-notification-feed.md

## Change Log

- 2026-03-17: Implemented AC1-AC4 for mobile notification feed, including live stream intake, reconnect backfill sync, read-state API wiring, retry guidance UI, and automated unit coverage.
- 2026-03-17: Senior Developer Review (AI) completed with Changes Requested; story moved to in-progress and review follow-ups added.
- 2026-03-17: Resolved review follow-ups by implementing backend SSE live emission, hardening mobile rollback safety, expanding contract-aware tests, and re-validating with focused MOB/BE test runs.
- 2026-03-17: Added QA-focused notification API unit tests and re-ran mobile notification feed regression tests for story 7.4 verification.
- 2026-03-17: Follow-up verification completed; story status promoted to done and review gate closed.

## Senior Developer Review (AI)

### Review Date

- 2026-03-17

### Outcome

- Approve

### Summary

- Verified previously requested follow-ups were implemented and validated in focused MOB/BE regression scope.
- AC1-AC4 are satisfied with live stream event emission contract, reconnect synchronization, read-state reflection, and retry guidance behavior.
- Story documentation and review checklist are now aligned with completion status.

### Findings

1. No blocking findings remain for this story scope.

### Action Items

- [x] [High] Deliver real notification SSE event emission contract from backend stream path used by MOB, then add an integration verification (contract-level) proving mobile feed receives live order outcome events.
- [x] [Medium] Refactor read-failure rollback to patch only target notification item or re-fetch authoritative list on failure to avoid stale snapshot overwrite.
- [x] [Medium] Add contract-aware test case covering heartbeat payload + actual notification payload framing against channel stream semantics.
- [x] [Medium] Align review branch hygiene/documentation so non-story BE/FE dirty state is isolated or explicitly tracked during story review.
