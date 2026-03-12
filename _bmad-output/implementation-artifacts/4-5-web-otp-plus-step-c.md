# Story 4.5: [FE] Web Conditional Step-Up + Step C

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want conditional additional verification and order execution result screens,
So that I can complete order execution with clear status feedback.

## Acceptance Criteria

1. Given a required step-up challenge, when valid TOTP submission succeeds, then the UI transitions to confirmation or execution step.
2. Given a low-risk order where no challenge is required, when the session is already `AUTHED`, then the UI enters confirmation or execution step directly and shows that extra verification was not required.
3. Given step-up failure cases, when the code is invalid, expired, replayed, or throttled, then mapped error guidance is displayed.
4. Given execution in progress, when status polling or SSE updates arrive, then the result screen reflects the final order state.
5. Given a final state response, when FILLED, REJECTED, or FAILED is returned, then ClOrdID and failure reason are rendered conditionally.

## Tasks / Subtasks

- [ ] Implement conditional step-up submission flow on web (AC: 1, 2)
  - [ ] Support both challenge-required and already-authorized session entry points
- [ ] Map TOTP and policy failure states into user guidance (AC: 3)
  - [ ] Include replay, expiry, and throttle handling without ambiguous messaging
- [ ] Implement processing and final-result rendering (AC: 4, 5)
  - [ ] Keep result screen synchronized with order state updates
- [ ] Add FE coverage for successful step-up, bypass path, failure mapping, and result rendering (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.2, Story 4.3, Story 4.4.

### Technical Requirements

- Step-up is conditional, not mandatory for every order.
- Result rendering must work for both auto-authorized and step-up-authorized sessions.
- FE should not imply that OTP occurred when the session was already `AUTHED`.

### Architecture Compliance

- Preserve the canonical order-session FSM and status-response contracts.
- Consume backend error codes directly for deterministic guidance.
- Keep result-flow state aligned with downstream execution ownership.

### Testing Requirements

- Cover step-up success, bypass path, invalid or expired code, replay or throttle path, processing state, and final result rendering.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated for web conditional step-up and Step C behavior.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.5)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold regenerated for FE conditional step-up and execution-result flow.

### File List

- _bmad-output/implementation-artifacts/4-5-web-otp-plus-step-c.md
