# Story 4.7: [MOB] Mobile Conditional Step-Up + Step C

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want conditional additional verification and order execution result flow on mobile,
So that the complete order execution experience is parity with web.

## Acceptance Criteria

1. Given required step-up on mobile, when a valid code is entered, then the app transitions to confirmation or execution.
2. Given a low-risk session already authorized, when the step-up screen is not required, then the app transitions directly to confirmation or execution.
3. Given step-up or execution errors, when a response is received, then the user sees mapped action guidance.
4. Given a final result response, when FILLED, REJECTED, or FAILED is returned, then ClOrdID and failure reasons are rendered.
5. Given an app background or foreground cycle, when the session resumes, then the current order status is recovered.

## Tasks / Subtasks

- [ ] Implement mobile conditional step-up flow and bypass path (AC: 1, 2)
  - [ ] Support already-authorized sessions without unnecessary extra screens
- [ ] Map mobile step-up and execution errors into native guidance (AC: 3)
  - [ ] Keep action guidance aligned with FE semantics
- [ ] Implement final-result rendering for success and failure outcomes (AC: 4)
  - [ ] Surface ClOrdID and failure reason conditionally
- [ ] Implement background or foreground recovery for in-progress sessions (AC: 5)
  - [ ] Restore state without back-stack corruption
- [ ] Add mobile coverage for step-up success, bypass, error guidance, final result, and resume behavior (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.2, Story 4.3, Story 4.6.

### Technical Requirements

- Mobile should support both challenge-required and already-authorized flows cleanly.
- Error mapping must preserve deterministic semantics across clients.
- Resume behavior must query or restore the real order-session state, not cached assumptions.

### Architecture Compliance

- Preserve the canonical order-session FSM on mobile.
- Consume backend order-session and error contracts directly.
- Align final-result semantics with the same downstream execution states used by web.

### Testing Requirements

- Cover step-up success, bypass, mobile-specific error rendering, final result states, and resume or recovery behavior.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated for mobile conditional step-up and Step C behavior.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.7)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold regenerated for mobile conditional step-up and execution-result flow.

### File List

- _bmad-output/implementation-artifacts/4-7-mobile-otp-plus-step-c.md
