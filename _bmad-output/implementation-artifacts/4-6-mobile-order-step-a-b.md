# Story 4.6: [MOB] Mobile Order Step A/B

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want order input and authorization guidance on mobile,
So that I can initiate orders with the same risk-aware behavior as web.

## Acceptance Criteria

1. Given the step A mobile order form, when submission succeeds, then an order session is created and step B is shown.
2. Given invalid symbol or quantity input, when validation fails, then contextual error indicators are displayed.
3. Given a challenge-required session, when the user navigates to the step-up step, then remaining session context is preserved.
4. Given an auto-authorized session, when the API returns `challengeRequired=false`, then the app skips directly to confirmation.
5. Given navigation interruption, when the user returns, then state-restoration logic preserves flow continuity.

## Tasks / Subtasks

- [ ] Implement mobile step A order entry and initiation flow (AC: 1)
  - [ ] Preserve mobile-safe form and submission behavior
- [ ] Implement contextual validation error handling for symbol and quantity inputs (AC: 2)
  - [ ] Avoid losing in-progress order context during correction
- [ ] Implement authorization-branch handling for challenge-required and auto-authorized sessions (AC: 3, 4)
  - [ ] Preserve remaining-session context when entering step-up
- [ ] Implement interruption and return-state restoration (AC: 5)
  - [ ] Support back-stack, background, and resume continuity
- [ ] Add mobile coverage for initiation, validation, branch handling, and state restoration (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.1, Story 2.5.

### Technical Requirements

- Mobile flow must preserve the same semantics as web even if the navigation model differs.
- Challenge-required and auto-authorized branches must remain explicit in client state.
- Interruption handling must restore the correct session state rather than inventing a new one.

### Architecture Compliance

- Preserve mobile navigation and session-bootstrap conventions.
- Use backend response fields as the only source for authorization guidance.
- Keep FE and MOB semantic parity for challenge-required and auto-authorized behavior.

### Testing Requirements

- Cover valid initiation, invalid input, challenge-required branch, bypass branch, and resume or restore continuity.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated for mobile Step A/B order initiation flow.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.6)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold regenerated for mobile Step A/B order initiation flow.

### File List

- _bmad-output/implementation-artifacts/4-6-mobile-order-step-a-b.md
