# Story 8.7: [AC] Ledger Integrity Observability & Alerting

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operations owner,
I want ledger integrity run, backlog, and alert signals exposed,
So that unresolved accounting risks are visible before release and during operations.

## Acceptance Criteria

1. Given stored integrity runs and reconciliation cases When operations summary query executes Then latest run result, unresolved anomaly counts, repair-pending counts, and latest failed identifiers are returned.
2. Given integrity check or reconciliation outcomes change When metrics are emitted Then latest run status, unresolved backlog, critical anomaly count, and stale-last-run indicators are observable.
3. Given configured thresholds are breached When alert evaluation runs Then a structured alert or event is emitted with run id and traceable identifiers.
4. Given non-operator or public caller When integrity observability data is requested Then access is denied and only internal/admin surfaces are exposed.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 8.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 5.6, Story 5.8, Story 8.3.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep observability outputs read-only, PII-safe, and aligned with internal/admin usage.
- Avoid introducing repair execution or public UI concerns outside required observability boundaries.

### Architecture Compliance

- Follow architecture-defined observability, security, and internal boundary conventions.
- Reuse existing correlation, metrics, and alerting patterns instead of creating bespoke pipelines.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure authorization, threshold edge cases, stale-run scenarios, and metrics publication paths are covered.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 8 ledger integrity observability scope prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 8, Story 8.7)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/5-6-ledger-integrity.md`
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 8.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/8-7-ledger-integrity-observability-and-alerting.md
