# Story 9.1: [BE][INT/CH] Execution Orchestration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an integration owner,
I want a single FEP-routed order execution flow via `OrderExecutionService`,
So that all sell orders are consistently routed to KRX via FEP Gateway.

> **Architecture Note:** All sell orders are routed to KRX via `fep-gateway:8083` (QuickFIX/J FIX 4.2). There is no corebank-direct execution path in the securities domain.

## Acceptance Criteria

1. Given AUTHED order session When execute command is issued Then `OrderExecutionService` initiates the single FEP-routed execution path and preserves the canonical `clOrdId`.
2. Given FEP-routed execution completes with a confirmed downstream result When the channel response is returned Then order session state is persisted deterministically as terminal `COMPLETED` with canonical execution metadata.
3. Given downstream failure or degraded sync outcome When execution cannot close normally Then the channel assigns `REQUERYING`, `ESCALATED`, or `FAILED` according to canonical failure handling and preserves recovery context when required.
4. Given orchestration logic update When automated execution tests run Then success and degraded recovery paths remain green.

## Tasks / Subtasks

- [x] Implement the single `OrderExecutionService` orchestration path for AUTHED sessions (AC: 1)
  - [x] Preserve canonical `clOrdId` and route only through the FEP-routed execute flow
- [x] Implement deterministic terminal completion handling for confirmed downstream outcomes (AC: 2)
  - [x] Add automated coverage for canonical completion response and persisted execution metadata
- [x] Implement degraded-path handling for `REQUERYING`, `ESCALATED`, and `FAILED` outcomes (AC: 3)
  - [x] Add automated coverage for failed sync, timeout/unavailability, and failure-state assignment
- [x] Protect orchestration behavior with regression tests (AC: 4)
  - [x] Keep happy-path and degraded-path execution tests green

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 9.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 4.3, Story 5.2, Story 5.3, Story 3.2.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- `OrderExecutionService` is the canonical channel-side orchestrator; do not introduce an alternate corebank-direct execution branch.
- `externalSyncStatus=CONFIRMED` completes the session as terminal `COMPLETED` with execution metadata preserved.
- `externalSyncStatus=FAILED` transitions the session to `REQUERYING` with recovery context preserved for follow-on reconciliation.
- Timeout/unavailability or other non-confirmed degraded outcomes may transition to `ESCALATED`, while non-recoverable execution failures may transition to `FAILED`, following the existing error-envelope and recovery contracts.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Cover canonical completion, failed-sync `REQUERYING`, timeout/unavailability `ESCALATED`, and non-recoverable `FAILED` handling.
- Keep controller-boundary and service-level orchestration tests aligned on the same state-transition expectations.

### Story Completion Status

- Status set to `done`.
- Completion note: Single-path FEP execution orchestration is implemented, acceptance-criteria coverage is in place, and targeted QA regression passed on 2026-03-23.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 9, Story 9.1)
- `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `.\gradlew.bat :channel-service:test --tests "com.fix.channel.service.OrderExecutionServiceTest" --tests "com.fix.channel.controller.ChannelErrorContractTest"`
- `_bmad-output/implementation-artifacts/tests/test-summary.md` Round 9 QA Automate Update (Story 9.1)

### Completion Notes List

- Story contract was realigned from branch-based wording to the single FEP-routed `OrderExecutionService` flow defined by canonical Epic 9.
- Recovery-state expectations now explicitly map degraded outcomes to `REQUERYING`, `ESCALATED`, or `FAILED`.
- Focused service-level and controller-boundary orchestration tests were re-run and remain green.
- Story 9.1 is closed as `done` based on implemented orchestration behavior plus targeted QA evidence.

### File List

- BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderExecutionServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- _bmad-output/implementation-artifacts/9-1-execution-orchestration.md
- _bmad-output/implementation-artifacts/tests/test-summary.md
