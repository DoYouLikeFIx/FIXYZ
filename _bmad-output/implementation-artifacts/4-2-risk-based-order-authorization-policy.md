# Story 4.2: [BE][CH] Risk-Based Order Authorization Policy

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated order initiator,
I want the system to require extra verification only when order risk warrants it,
So that UX friction is reduced without weakening high-risk order protection.

## Acceptance Criteria

1. Given a low-risk order context with trusted session signals and fresh login MFA, when authorization policy runs, then the session auto-advances to `AUTHED` without additional step-up.
2. Given an elevated-risk order context such as stale login MFA, new device or network, sensitive order amount, or security-event recency, when authorization policy runs, then additional TOTP step-up is required before execution can proceed.
3. Given required step-up verification inside the allowed time window, when the verify endpoint is called with a valid code, then verification succeeds and the session can advance.
4. Given duplicate rapid verify attempts, when debounce policy applies, then the request is throttled without attempt over-consumption.
5. Given TOTP replay in the same window, when replay is detected, then the request is rejected deterministically.
6. Given max attempts exceeded on a required step-up challenge, when further verify is attempted, then the session is failed and execution is blocked.

## Tasks / Subtasks

- [ ] Implement policy evaluation for low-risk versus elevated-risk contexts (AC: 1, 2)
  - [ ] Consume login MFA freshness, device or network continuity, and order-risk inputs
- [ ] Implement conditional TOTP verify path for challenge-required sessions (AC: 3)
  - [ ] Prevent verify flow from running on already authorized or terminal sessions
- [ ] Implement debounce and replay-prevention logic (AC: 4, 5)
  - [ ] Ensure repeated submits do not consume attempts incorrectly
- [ ] Implement max-attempt exhaustion behavior and failure transition (AC: 6)
  - [ ] Block downstream execution after session failure
- [ ] Add automated coverage for low-risk bypass, challenge-required path, debounce, replay rejection, and max-attempt exhaustion (AC: 1, 2, 3, 4, 5, 6)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.1, Story 1.2.

### Technical Requirements

- This story owns risk-based decisioning, not universal per-order OTP.
- TOTP step-up must remain conditional and time-bounded.
- Replay prevention, debounce, and attempt exhaustion must all be auditable and deterministic.

### Architecture Compliance

- Use Vault-backed TOTP verification and architecture-defined Redis key patterns.
- Preserve session-state transition boundaries rather than allowing direct execution bypass.
- Keep authorization policy server-owned; clients consume decisions but do not author them.

### Testing Requirements

- Cover low-risk auto-authorization, elevated-risk challenge, successful verify, debounce throttling, replay rejection, and attempt exhaustion.
- Include negative-path verification for already terminal or already `AUTHED` sessions.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated for conditional step-up policy rather than always-on per-order OTP.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold regenerated for risk-based order authorization and conditional step-up behavior.

### File List

- _bmad-output/implementation-artifacts/4-2-risk-based-order-authorization-policy.md
