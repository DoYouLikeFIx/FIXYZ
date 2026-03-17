# Story 7.2: [CH] Notification Persistence APIs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a notification user,
I want persisted notification history and read-state APIs,
So that missed events can be recovered.

## Acceptance Criteria

1. Given order terminal event When notification pipeline runs Then notification is persisted before/with dispatch.
2. Given list API request When pagination params applied Then ordered notifications are returned.
3. Given read-mark request When notification id belongs to user Then read status is updated.
4. Given unauthorized notification access When validation fails Then request is denied.

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
- Depends on: Story 7.1.

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

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 7.

### Completion Notes List

- Persisted notification read contract added (`read_at`) with member/id cursor index.
- List API moved to session-owned member scope and retains ordered cursor pagination semantics.
- Read-mark API added with ownership enforcement and read timestamp persistence.
- Stream API heartbeat SSE contract restored to preserve existing session-stream clients.
- AC coverage added at service and API levels including unauthorized and ownership-mismatch paths.

### File List

- /Users/yeongjae/fixyz/BE/channel-domain/src/main/java/com/fix/channel/entity/Notification.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/resources/db/migration/V15__add_notification_read_contract_columns.sql
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/repository/NotificationRepository.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/vo/NotificationItemVo.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/dto/response/NotificationItemResponse.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/dto/request/NotificationStreamRequest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/ChannelScaffoldService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/OrderExecutionServiceTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/ChannelScaffoldNotificationServiceTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/controller/NotificationControllerContractTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthSessionIntegrationTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/resources/mockito-extensions/org.mockito.plugins.MockMaker
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-2-notification-persistence-apis.md

## Change Log

- 2026-03-17: Implemented AC1-AC4, restored `/api/v1/notifications/stream` SSE heartbeat contract, and added API-level read authorization/ownership tests.
