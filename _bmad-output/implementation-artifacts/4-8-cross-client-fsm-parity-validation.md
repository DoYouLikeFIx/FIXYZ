# Story 4.8: [FE/MOB] Cross-Client Authorization FSM Parity Validation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a product quality owner,
I want FE and MOB FSM behavior parity,
So that one client does not diverge from core order rules.

## Acceptance Criteria

1. Given the same scenario input sequence, when it runs on FE and MOB, then state transitions are equivalent.
2. Given the same backend error codes, when they are rendered on both clients, then severity and action semantics are aligned.
3. Given the regression suite, when CI runs, then parity checks pass.

## Tasks / Subtasks

- [ ] Define the canonical scenario matrix for FE and MOB authorization-state parity (AC: 1)
  - [ ] Include challenge-required, auto-authorized, expired, and failed-session paths
- [ ] Implement cross-client validation for shared error-code semantics (AC: 2)
  - [ ] Verify aligned next actions for the same backend outcome
- [ ] Add CI-parity regression coverage for the canonical FSM flow (AC: 3)
  - [ ] Fail the regression gate when web and mobile diverge in state or guidance

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.5, Story 4.7.

### Technical Requirements

- FE and MOB may differ in layout, but they must preserve the same state meaning and next-action guidance.
- Parity coverage should include both low-risk bypass and elevated-risk step-up scenarios.
- Regression checks must remain cheap enough to run continuously.

### Architecture Compliance

- Use the canonical Epic 4 FSM as the parity source of truth.
- Keep error semantics tied to backend codes rather than client-specific reinterpretation.
- Preserve deterministic result-state handling across both clients.

### Testing Requirements

- Cover the shared scenario matrix, shared error-code semantics, and CI regression enforcement.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated for FE and MOB authorization FSM parity validation.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.8)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold regenerated for FE and MOB authorization-state parity validation.

### File List

- _bmad-output/implementation-artifacts/4-8-cross-client-fsm-parity-validation.md
