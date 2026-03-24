# Story 6.4: [FEP] UNKNOWN Requery Scheduler

Status: done

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
- The scheduler ops surface must expose running/idle state, last-run summary, and pending recovery visibility for operators.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Validate the scheduler state/last-run visibility contract if the ops surface is enabled for this lane.

### Story Completion Status

- Status set to `done`.
- Completion note: UNKNOWN recovery now converges via cursor-based requery scanning, local retry-threshold enforcement, durable manual-recovery queue persistence, and terminal `CANCELED` reconciliation.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `cd /Users/yeongjae/fixyz/BE && ./gradlew :channel-domain:test --tests com.fix.channel.entity.OrderSessionStateMachineTest :channel-service:test --tests com.fix.channel.client.CorebankClientTest --tests com.fix.channel.service.OrderSessionRecoveryServiceTest --tests com.fix.channel.service.ManualRecoveryQueueServiceTest --tests com.fix.channel.service.OrderSessionServiceTest --no-daemon`
- `cd /Users/yeongjae/fixyz/BE && ./gradlew :channel-service:test --tests com.fix.channel.service.OrderExecutionServiceTest --tests com.fix.channel.service.OrderSessionRecoverySchedulerTest --tests com.fix.channel.controller.ChannelErrorContractTest --tests com.fix.channel.integration.OrderSessionIntegrationTest --tests com.fix.channel.serialization.OrderSessionResponseSerializationTest --no-daemon`

### Completion Notes List

- Added channel-side recovery orchestration for UNKNOWN/timeout execution outcomes via `OrderSessionRecoveryService` and `OrderSessionRecoveryScheduler`.
- Added Redis/local fallback recovery lock (`ch:recovery-lock:{sessionId}`) and attempt tracking store (`ch:recovery-attempt:{sessionId}`) to make periodic requery idempotent and bounded.
- Implemented `EXECUTING -> REQUERYING` transition handling and REQUERYING batch processing to reconcile sessions toward `COMPLETED` or `ESCALATED`.
- Added `CorebankClient.requeryOrder(...)` and `OrderRequeryResult` to consume the existing corebank requery contract with attemptCount propagation.
- Added automated coverage for AC1-AC4 in domain/client/service/scheduler tests, including convergence and metrics assertions.
- Applied adversarial review fixes so fresh `UNKNOWN` execution outcomes enter `REQUERYING`, detached JPA writes reload managed entities, and REQUERYING backlog traversal now uses an `(updatedAt, orderSessionId)` cursor instead of growing `NOT IN (...)` exclusions.
- Enforced retry exhaustion locally with `max(localAttemptCount, upstreamAttemptCount)` semantics, and escalated repeated `requeryOrder(...)` transport failures once the scheduler-side retry threshold is exhausted.
- Added terminal `CANCELED` recovery convergence with `canceledAt` propagation from corebank requery responses through the order-session state machine and serialized API contract.
- Replaced the in-memory manual-recovery fallback with a durable `manual_recovery_queue_entries` table plus best-effort Redis publication retries so queue handoff survives Redis outages and process restarts.
- Expanded regression coverage for `UNKNOWN` entry into requery, `PENDING`/`MALFORMED` retry exhaustion, repeated requery exceptions, `CANCELED` reconciliation, durable manual queue publishing, and cursor-based backlog scanning.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java
- BE/channel-domain/src/test/java/com/fix/channel/entity/OrderSessionStateMachineTest.java
- BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java
- BE/channel-service/src/main/java/com/fix/channel/entity/ManualRecoveryQueueEntry.java
- BE/channel-service/src/main/java/com/fix/channel/repository/ManualRecoveryQueueEntryRepository.java
- BE/channel-service/src/main/java/com/fix/channel/repository/OrderSessionRepository.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryAttemptStore.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryLockService.java
- BE/channel-service/src/main/java/com/fix/channel/service/ManualRecoveryQueueService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryScheduler.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderRequeryResult.java
- BE/channel-service/src/main/java/db/migration/V18__add_order_session_executing_started_at_column.java
- BE/channel-service/src/main/java/db/migration/V19__add_manual_recovery_queue_table_and_requery_cursor_index.java
- BE/channel-service/src/main/resources/application.yml
- BE/channel-service/src/test/java/com/fix/channel/client/CorebankClientTest.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/ManualRecoveryQueueServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderExecutionServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoverySchedulerTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoveryServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-4-unknown-requery-scheduler.md
- _bmad-output/implementation-artifacts/tests/test-summary.md

## Change Log

- 2026-03-18: Implemented Story 6.4 UNKNOWN requery scheduler flow (EXECUTING timeout transition, periodic requery reconciliation, manual escalation threshold handling, and recovery metrics) with full channel-domain/channel-service automated coverage.
- 2026-03-18: Addressed adversarial review follow-ups for AC2/AC3 convergence semantics, manual recovery queue handoff, timeout cutoff source-of-truth, and REQUERYING backlog traversal.
- 2026-03-19: Added durable manual-recovery queue persistence/retry publishing, local retry-limit enforcement for response and transport failures, `CANCELED` requery convergence, and cursor-based backlog pagination with expanded regression coverage.
