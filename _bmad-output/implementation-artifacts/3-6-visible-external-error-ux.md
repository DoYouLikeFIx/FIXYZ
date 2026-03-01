# Story 3.6: Visible External Error UX

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an order user,
I want understandable external-failure messages,
So that I know whether to retry, wait, or contact support.

## Acceptance Criteria

1. Given external failure code mapping When FE/MOB receives error Then action-oriented message is displayed.
2. Given ambiguous unknown external state When shown to user Then recovery guidance avoids false completion claims.
3. Given same error code on FE and MOB When rendered Then parity of UX semantics is maintained.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add test coverage for AC 1
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add test coverage for AC 2
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add test coverage for AC 3

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 3.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 3.2.

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
- Completion note: Epic 3 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.6)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 3.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/3-6-visible-external-error-ux.md
