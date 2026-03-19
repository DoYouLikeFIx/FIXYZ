# Story 5.6: [AC] Ledger Integrity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a finance correctness owner,
I want ledger invariant checks and repair visibility,
So that accounting integrity can be continuously verified.

## Acceptance Criteria

1. Given completed order set When integrity query runs Then debit/credit(+adjustment) invariants hold.
2. Given detected mismatch When integrity check fails Then anomaly is reported with traceable identifiers.
3. Given scheduled integrity job When executed Then summary metrics are stored for operations.
4. Given release gate When ledger integrity test fails Then build is blocked.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 5.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 5.2, Story 5.3.

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
- Completion note: Ledger integrity run/anomaly persistence, scheduled execution, and release-gate regression coverage are already implemented in `corebank-service`; the story artifact was aligned to the delivered Epic 5 baseline on 2026-03-20.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.6)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md` (채널계 API 명세)
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 5.
- 2026-03-20: story artifact alignment pass confirmed the existing ledger-integrity implementation anchors in service, migration, scheduler, and integration-test coverage.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Ledger integrity run/anomaly persistence is implemented via `LedgerIntegrityService` and the tracking schema introduced in `V7__add_ledger_integrity_tracking.sql`.
- Scheduled integrity execution and failure-tolerant orchestration are implemented via `LedgerIntegrityScheduler` with dedicated scheduler coverage.
- Automated verification anchors already exist for Flyway schema creation, stored integrity-run persistence, anomaly capture, and release-gate style regression coverage.
- 2026-03-20: story artifact status aligned from `ready-for-dev` to `done` to match the delivered Epic 5 implementation already present in code and tracker evidence.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/5-6-ledger-integrity.md
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerIntegrityService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerIntegrityScheduler.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/repository/LedgerIntegrityQueryRepositoryImpl.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/db/migration/V7__add_ledger_integrity_tracking.sql
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/LedgerIntegrityIntegrationTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/service/LedgerIntegritySchedulerTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/migration/CoreFlywayMigrationTest.java
