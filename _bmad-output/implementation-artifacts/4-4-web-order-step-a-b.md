# Story 4.4: [FE] Web Order Step A/B

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want step-based order input and clear authorization guidance,
So that order setup is clear and only risky orders interrupt me with extra verification.

## Acceptance Criteria

1. Given the step A web order form, when the user submits valid symbol and quantity, then the order-session initiation API is called successfully.
2. Given invalid form data, when validation runs, then client-side and server-side errors are shown clearly.
3. Given a transition after initiation, when the response indicates `challengeRequired=true`, then the step-up input UI becomes active with reason and explanation.
4. Given a transition after initiation, when the response indicates `challengeRequired=false` and status `AUTHED`, then the UI skips directly to confirmation or execution step.
5. Given an API or network failure, when the initiation request fails, then the user receives retry guidance.

## Tasks / Subtasks

- [ ] Implement step A order entry and initiation request flow (AC: 1)
  - [ ] Capture symbol and quantity inputs with validated submission behavior
- [ ] Implement client and server validation error rendering (AC: 2)
  - [ ] Keep invalid input states actionable without losing form context
- [ ] Implement authorization-guidance branching after initiation (AC: 3, 4)
  - [ ] Show reason text for challenge-required cases
  - [ ] Skip cleanly to confirm for already `AUTHED` sessions
- [ ] Implement retry guidance for initiation failure states (AC: 5)
  - [ ] Preserve enough context for safe resubmission
- [ ] Add FE coverage for form validation, challenge-required branch, auto-authorized branch, and error handling (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.1, Story 2.4.

### Technical Requirements

- The browser must surface `challengeRequired` and `authorizationReason` without inventing local policy.
- Form state must remain stable across validation and initiation failure paths.
- Auto-authorized and challenge-required flows must diverge only where needed.

### Architecture Compliance

- Preserve FE route and state-management conventions.
- Treat the backend authorization decision as source of truth.
- Keep error semantics aligned with the standardized auth and order error model.

### Testing Requirements

- Cover valid initiation, invalid form, challenge-required branch, auto-authorized branch, and initiation failure guidance.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated for web Step A/B order initiation and authorization guidance.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.4)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold regenerated for FE Step A/B order initiation flow.

### File List

- _bmad-output/implementation-artifacts/4-4-web-order-step-a-b.md
