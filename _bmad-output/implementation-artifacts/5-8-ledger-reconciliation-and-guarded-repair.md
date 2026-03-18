# Story 5.8: [AC] Ledger Reconciliation & Guarded Repair

Status: ready-for-dev

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

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add test coverage for AC 1
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add test coverage for AC 2
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add test coverage for AC 3
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add test coverage for AC 4

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

- Status set to `ready-for-dev`.
- Completion note: Epic 5 follow-up reconciliation and guarded repair scope prepared from canonical planning artifact.

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

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/5-8-ledger-reconciliation-and-guarded-repair.md
