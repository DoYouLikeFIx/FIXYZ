# Story 9.3: [INT/CH] Recovery Scheduler Integration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a reliability owner,
I want orchestrated recovery for EXECUTING/UNKNOWN orders,
So that stuck orders eventually converge and operators can inspect recovery evidence.

> **Architecture Note:** Story `6.4` implemented the scheduler, requery, retry-budget, and durable manual-recovery baseline. Story `9.3` closes the integrated Epic 9 contract by aligning recovery outcomes with normalized channel end states and making recovery attempts queryable through the admin audit surface.

## Acceptance Criteria

1. Given `EXECUTING` session crosses the configured recovery timeout or `REQUERYING` backlog is eligible When `OrderSessionRecoveryScheduler` runs Then the recovery cycle transitions or reprocesses the session through the canonical recovery flow.
2. Given external requery returns terminal result When reconciliation succeeds Then the order closes with normalized channel state such as `COMPLETED` or `CANCELED`, preserving canonical execution metadata.
3. Given repeated unresolved, rejected, or transport-failing recovery attempts When the effective retry budget is exhausted Then the order is escalated and a durable manual recovery queue entry is created.
4. Given recovery attempts execute When audit/query workflows run Then the attempts are recorded as canonical `ORDER_RECOVERY` audit entries queryable through `/api/v1/admin/audit-logs`, while escalated sessions remain visible via durable manual-recovery queue persistence.

## Tasks / Subtasks

- [x] Reuse the existing scheduler-driven recovery orchestration for timeout and requery backlog handling (AC: 1)
  - [x] Keep automated coverage for scheduler invocation, timeout transition, and backlog traversal
- [x] Freeze recovery convergence into normalized channel end states (AC: 2)
  - [x] Keep automated coverage for `COMPLETED` and `CANCELED` reconciliation paths
- [x] Preserve retry-budget escalation into durable manual recovery handling (AC: 3)
  - [x] Keep automated coverage for rejected/unresolved/error retry exhaustion and queue publication behavior
- [x] Make recovery attempts queryable through canonical admin-audit filtering (AC: 4)
  - [x] Record `ORDER_SESSION_RECOVERY_ATTEMPT` audit entries and expose them through canonical `ORDER_RECOVERY` admin-audit queries

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 9.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 9.1, Story 6.4.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Story `6.4` is the recovery-engine baseline; Story `9.3` closes the integrated Epic 9 recovery contract on top of that existing scheduler/manual-queue implementation.
- `OrderSessionRecoveryScheduler` and `OrderSessionRecoveryService` are the canonical channel recovery path for timed-out `EXECUTING` and eligible `REQUERYING` sessions.
- Terminal recovery reconciliation must preserve the normalized channel state contract introduced by Story `9.2`.
- Recovery attempt evidence is queryable through canonical `ORDER_RECOVERY` admin-audit filtering backed by `ORDER_SESSION_RECOVERY_ATTEMPT` audit entries.
- Escalation must remain durable through `manual_recovery_queue_entries`, not in-memory best-effort state.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep recovery orchestration and its audit evidence in the channel backend so operations can query one canonical surface without downstream-specific branching.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Cover timeout transition, requery convergence, rejected/unresolved escalation, and durable manual queue publication.
- Cover canonical admin-audit queryability for recovery attempts through `ORDER_RECOVERY`.

### Story Completion Status

- Status set to `done`.
- Completion note: Story 9.3 recovery scheduling behavior was already implemented from Story `6.4`; on 2026-03-23 the integrated Epic 9 artifact was realigned, canonical `ORDER_RECOVERY` audit queryability was added, and targeted scheduler/audit/manual-queue regressions passed.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 9, Story 9.3)
- `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `.\gradlew.bat :channel-service:test --tests "com.fix.channel.service.AdminAuditActionMapperTest" --tests "com.fix.channel.service.OrderSessionRecoveryServiceTest" --tests "com.fix.channel.service.OrderSessionRecoverySchedulerTest" --tests "com.fix.channel.integration.AdminSessionAuditIntegrationTest" --tests "com.fix.channel.service.ManualRecoveryQueueServiceTest" --tests "com.fix.channel.migration.ChannelFlywayMigrationTest"`
- `_bmad-output/implementation-artifacts/tests/test-summary.md` Round 9 QA Automate Update (Story 9.3)

### Completion Notes List

- Story contract was realigned from a duplicate-ready scaffold to the implemented scheduler/manual-recovery baseline already delivered through Story `6.4`.
- Recovery convergence is now explicitly tied to normalized channel end states used by Epic 9.
- Recovery attempt evidence is now queryable through canonical `ORDER_RECOVERY` admin-audit filtering instead of implicit raw audit-log inspection.
- Targeted scheduler, audit-query, manual-queue, and migration regressions were re-run and remain green.
- Story 9.3 is closed as `done` based on implemented recovery behavior plus targeted audit/queryability evidence.

### File List

- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryScheduler.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- BE/channel-service/src/main/java/com/fix/channel/service/ManualRecoveryQueueService.java
- BE/channel-service/src/main/java/com/fix/channel/service/AdminAuditActionMapper.java
- BE/channel-service/src/test/java/com/fix/channel/service/AdminAuditActionMapperTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoveryServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoverySchedulerTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/ManualRecoveryQueueServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/AdminSessionAuditIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/migration/ChannelFlywayMigrationTest.java
- _bmad-output/implementation-artifacts/9-3-recovery-scheduler-integration.md
- _bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
