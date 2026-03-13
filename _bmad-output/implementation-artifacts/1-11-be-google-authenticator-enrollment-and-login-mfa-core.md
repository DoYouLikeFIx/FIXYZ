# Story 1.11: BE Google Authenticator Enrollment & Login MFA Core

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a registered user,
I want Google Authenticator enrollment and TOTP-based login MFA,
so that account access requires a second factor before privileged actions.

## Acceptance Criteria

1. Given a newly registered member or authenticated member without TOTP enabled, when MFA enrollment is initiated, then the backend returns a bounded bootstrap contract and stores the raw secret only in the approved secret store.
2. Given a valid first TOTP confirmation, when enrollment is completed, then `totp_enabled=true`, `totp_enrolled_at` is recorded, and the bootstrap token is consumed.
3. Given a login attempt for a member that requires MFA, when password is correct but TOTP is missing, invalid, or enrollment is incomplete, then no authenticated session is issued and a deterministic MFA error is returned.
4. Given a login attempt with valid password and current TOTP, when authentication succeeds, then a Redis-backed session cookie is issued and the session stores MFA proof metadata for downstream authorization policy.
5. Given repeated invalid TOTP attempts during login, when threshold is exceeded, then the MFA verification path returns deterministic throttle or lock guidance without issuing a session.

## Tasks / Subtasks

- [ ] Implement enrollment bootstrap endpoint and secret-store write path (AC: 1)
  - [ ] Return `qrUri`, `manualEntryKey`, `enrollmentToken`, and expiry metadata
  - [ ] Prevent raw secret persistence in DB and Redis
- [ ] Implement first-code confirmation and enrollment activation flow (AC: 2)
  - [ ] Persist `totp_enabled` and `totp_enrolled_at` only after successful confirmation
- [ ] Extend login flow with password + TOTP verification ordering (AC: 3, 4)
  - [ ] Reject incomplete MFA enrollment without issuing authenticated session
  - [ ] Store MFA proof metadata in the server session
- [ ] Apply MFA verification abuse controls (AC: 5)
  - [ ] Reuse lockout/rate-limit conventions without weakening existing login protections
- [ ] Add automated integration coverage for enroll, confirm, login success/failure, and throttle paths (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.1, Story 1.2, Story 1.5, Story 0.8.

### Technical Requirements

- Google Authenticator-compatible RFC 6238 TOTP.
- Raw TOTP secret must live only in the approved secret store.
- No authenticated session may be issued before both password and TOTP checks pass.
- Session must store MFA proof metadata for downstream order-authorization policy.

### Architecture Compliance

- Keep auth and session ownership in channel-service auth/security layers.
- Preserve standardized error envelope and correlation-id propagation.
- Reuse existing Spring Session Redis contract instead of introducing token-based side channels.

### Testing Requirements

- Validate enroll bootstrap, first confirmation, successful MFA login, invalid TOTP, incomplete enrollment, and throttle/lock behavior.
- Cover negative paths for secret-store failure and stale enrollment token handling.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Follow-on MFA backend scope added without replacing delivered Epic 1 baseline stories.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.11)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Added as follow-on Epic 1 MFA rollout scope after baseline story restoration.

### Completion Notes List

- Story scaffold created for backend Google Authenticator enrollment and login MFA rollout.

### File List

- _bmad-output/implementation-artifacts/1-11-be-google-authenticator-enrollment-and-login-mfa-core.md
