# Story 1.14: BE MFA Recovery, Rebind & Session Invalidation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a device-lost or authenticator-reset user,
I want secure MFA recovery and rebind controls,
so that I can regain access without weakening account security.

## Acceptance Criteria

1. Given an authenticated password-confirmed member or approved recovery proof, when MFA rebind is initiated, then the existing authenticator secret is terminalized before a fresh enrollment bootstrap contract is issued.
2. Given a valid MFA recovery or rebind completion, when the new TOTP secret is confirmed, then all active sessions are invalidated, prior trusted-session markers are cleared, and only the newly enrolled authenticator remains active.
3. Given invalid, expired, consumed, or replayed MFA recovery proof, when the backend rejects the request, then no secret rotation occurs and deterministic recovery error codes are returned.
4. Given MFA recovery and rebind activity, when security events are recorded, then initiation, completion, failure, and terminalization are auditable without exposing raw secret material.

## Tasks / Subtasks

- [ ] Define MFA recovery and rebind entry conditions (AC: 1)
  - [ ] Support authenticated password-confirmed and approved recovery-proof paths
- [ ] Implement old-secret terminalization before re-enrollment bootstrap issuance (AC: 1, 2)
  - [ ] Invalidate active sessions and trusted-session metadata on success
- [ ] Add deterministic rejection handling for invalid or replayed recovery proof (AC: 3)
  - [ ] Prevent partial secret rotation on failed attempts
- [ ] Emit audit/security events for MFA recovery lifecycle (AC: 4)
  - [ ] Exclude raw TOTP secret and raw recovery material from logs/events
- [ ] Add backend test coverage for recovery success, replay failure, secret terminalization, and session invalidation (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.7, Story 1.10, Story 1.11, Story 0.8.

### Technical Requirements

- Recovery or rebind proof must be single-use and time-bounded.
- Existing authenticator secret must be terminalized before the new enrollment becomes active.
- Session invalidation must cover server session state and any trusted-session marker used by later order authorization.

### Architecture Compliance

- Reuse canonical recovery and session invalidation conventions from baseline Epic 1.
- Keep secret-storage ownership in the approved secret-management lane.

### Testing Requirements

- Validate recovery initiation, rebind completion, replay rejection, session invalidation, and audit-event emission.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: MFA recovery and rebind backend scaffold added to close the mandatory login-MFA support loop.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.14)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Added as follow-on Epic 1 MFA rollout scope after baseline story restoration.

### Completion Notes List

- Story scaffold created for backend MFA recovery, rebind, and session invalidation behavior.

### File List

- _bmad-output/implementation-artifacts/1-14-be-mfa-recovery-rebind-and-session-invalidation.md
