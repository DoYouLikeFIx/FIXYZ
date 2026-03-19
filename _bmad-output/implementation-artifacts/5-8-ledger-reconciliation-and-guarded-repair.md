# Story 5.8: [AC] Ledger Reconciliation & Guarded Repair

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a finance correctness owner,
I want detected ledger anomalies to move through reconciliation and guarded repair,
So that canonical accounting state can be investigated and corrected without ad hoc SQL edits.

## Acceptance Criteria

1. Given stored integrity anomalies When reconciliation case is created Then traceable identifiers and initial case state are persisted.
2. Given a reconciliation case When operator triage occurs Then state transitions, actor, reason, and timestamps are recorded.
3. Given an approved repairable case When guarded repair executes Then only supported repair types are allowed and original execution/journal/ledger history is not destructively overwritten.
4. Given the same repair request or a post-repair rerun When repair key and rerun evidence are processed Then duplicate adjustment is not created and the case is linked as `RESOLVED` or `REOPENED`.

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
- Depends on: Story 5.6.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep repair behavior auditable and constrained to guarded reconciliation paths.
- Avoid destructive overwrite of canonical execution, journal, or ledger history.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Preserve canonical ledger truth and prefer append-only adjustment or deterministic rebuild patterns for repair semantics.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure triage transitions, duplicate repair suppression, rerun linkage, and authorization/error flows are covered.

### Story Completion Status

- Status set to `done`.
- Completion note: Reconciliation case lifecycle, guarded repair execution, rerun linkage, and duplicate-repair suppression are already implemented on the internal ledger-integrity boundary; the story artifact was aligned to the delivered Epic 5 baseline on 2026-03-20.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.8)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/5-6-ledger-integrity.md`
- `_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 5.
- 2026-03-20: story artifact alignment pass confirmed the existing reconciliation, repair, migration, contract, and integration-test anchors already present in `corebank-service`.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Internal reconciliation case create/transition flows are implemented through `LedgerReconciliationService` and the `/internal/v1/ledger-integrity/**` controller surface.
- Guarded repair and rerun flows are implemented through `LedgerRepairService`, including repair-key dedupe, rerun-run linkage, and canonical `RESOLVED` / `REOPENED` outcomes.
- Automated verification anchors already exist for Flyway schema creation, committed OpenAPI/internal contract coverage, reconciliation lifecycle assertions, and guarded repair/rerun integration tests.
- 2026-03-20: story artifact status aligned from `ready-for-dev` to `done` to match the delivered Epic 5 implementation already present in code and tracker evidence.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/5-8-ledger-reconciliation-and-guarded-repair.md
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/controller/InternalCorebankController.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerReconciliationService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerRepairService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/db/migration/V8__add_ledger_reconciliation_cases.sql
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/db/migration/V9__add_ledger_reconciliation_repairs.sql
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/db/migration/V10__enforce_ledger_reconciliation_case_uniqueness.sql
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/LedgerReconciliationIntegrationTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/LedgerRepairIntegrationTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/contract/CorebankOpenApiCompatibilityTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/migration/CoreFlywayMigrationTest.java
