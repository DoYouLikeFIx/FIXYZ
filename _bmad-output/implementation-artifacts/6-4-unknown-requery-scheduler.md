# Story 6.4: [FEP] UNKNOWN Requery Scheduler

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a recovery engine,
I want periodic requery for unknown outcomes,
So that ambiguous orders can converge to terminal states.

## Acceptance Criteria

1. Given order in UNKNOWN/EXECUTING timeout state When scheduler runs Then status requery is executed with backoff policy.
2. Given requery returns accepted/completed When reconciliation runs Then order state converges to terminal success.
3. Given requery repeatedly unknown/failing When threshold exceeded Then order is escalated to manual recovery queue.
4. Given scheduler cycle execution When metrics collected Then attempt and convergence counters are recorded.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 6.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 3.4, Story 6.2, Story 4.3.

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

- Status set to `ready-for-dev`.
- Completion note: Epic 6 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `cd C:\Users\SSAFY\FIXYZ\BE; .\gradlew.bat :channel-domain:test --tests com.fix.channel.entity.OrderSessionStateMachineTest :channel-service:test --tests com.fix.channel.client.CorebankClientTest --tests com.fix.channel.service.OrderSessionRecoveryServiceTest --tests com.fix.channel.service.OrderSessionRecoverySchedulerTest --tests com.fix.channel.service.OrderSessionExpirySchedulerTest --no-daemon`
- `cd C:\Users\SSAFY\FIXYZ\BE; .\gradlew.bat :channel-domain:test :channel-service:test --no-daemon`

### Completion Notes List

- Added channel-side recovery orchestration for UNKNOWN/timeout execution outcomes via `OrderSessionRecoveryService` and `OrderSessionRecoveryScheduler`.
- Added Redis/local fallback recovery lock (`ch:recovery-lock:{sessionId}`) and attempt tracking store (`ch:recovery-attempt:{sessionId}`) to make periodic requery idempotent and bounded.
- Implemented `EXECUTING -> REQUERYING` transition handling and REQUERYING batch processing to reconcile sessions toward `COMPLETED` or `ESCALATED`.
- Added `CorebankClient.requeryOrder(...)` and `OrderRequeryResult` to consume the existing corebank requery contract with attemptCount propagation.
- Added automated coverage for AC1-AC4 in domain/client/service/scheduler tests, including convergence and metrics assertions.
- Applied first adversarial review fixes: terminal success now accepts `ACCEPTED`/`COMPLETED`, manual recovery queue enqueue added on escalation, timeout basis aligned with `executing_started_at` (with fallback), and REQUERYING batch traversal switched to page-based scanning.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java
- BE/channel-domain/src/test/java/com/fix/channel/entity/OrderSessionStateMachineTest.java
- BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java
- BE/channel-service/src/main/java/com/fix/channel/repository/OrderSessionRepository.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryAttemptStore.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryLockService.java
- BE/channel-service/src/main/java/com/fix/channel/service/ManualRecoveryQueueService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryScheduler.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderRequeryResult.java
- BE/channel-service/src/main/java/db/migration/V18__add_order_session_executing_started_at_column.java
- BE/channel-service/src/main/resources/application-test.yml
- BE/channel-service/src/main/resources/application.yml
- BE/channel-service/src/test/java/com/fix/channel/client/CorebankClientTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoverySchedulerTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoveryServiceTest.java
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-4-unknown-requery-scheduler.md

## Change Log

- 2026-03-18: Implemented Story 6.4 UNKNOWN requery scheduler flow (EXECUTING timeout transition, periodic requery reconciliation, manual escalation threshold handling, and recovery metrics) with full channel-domain/channel-service automated coverage.
- 2026-03-18: Addressed adversarial review follow-ups for AC2/AC3 convergence semantics, manual recovery queue handoff, timeout cutoff source-of-truth, and REQUERYING backlog traversal.
