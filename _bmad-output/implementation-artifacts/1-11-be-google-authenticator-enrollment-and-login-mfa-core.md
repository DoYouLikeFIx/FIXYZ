# Story 1.11: BE Google Authenticator Enrollment & Login MFA Core

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a registered user,
I want Google Authenticator enrollment and TOTP-based login MFA,
so that every authenticated login requires a second factor before access is granted.

## Acceptance Criteria

1. Given a newly registered member or password-verified member without TOTP enabled, when MFA enrollment is initiated, then the backend returns a bounded bootstrap contract and stores the raw secret only in the approved secret store.
2. Given a valid first TOTP confirmation, when enrollment is completed, then `totp_enabled=true`, `totp_enrolled_at` is recorded, the bootstrap token is consumed, and only then may the first authenticated session be issued.
3. Given any login attempt, when the password phase succeeds but TOTP is missing, invalid, or enrollment is incomplete, then no authenticated session is issued and a deterministic MFA error or next-action contract is returned.
4. Given a login attempt with valid password and current TOTP through the dedicated MFA verify step, when authentication succeeds, then a Redis-backed session cookie is issued and the session stores MFA proof metadata for downstream authorization policy.
5. Given repeated invalid TOTP attempts during login, when threshold is exceeded, then the MFA verification path returns deterministic throttle or lock guidance without issuing a session.

## Tasks / Subtasks

- [x] Implement enrollment bootstrap endpoint and secret-store write path for password-verified pre-auth onboarding (AC: 1)
  - [x] Return `qrUri`, `manualEntryKey`, `enrollmentToken`, and expiry metadata
  - [x] Prevent raw secret persistence in DB and Redis
- [x] Implement first-code confirmation and enrollment activation flow (AC: 2)
  - [x] Persist `totp_enabled` and `totp_enrolled_at` only after successful confirmation
- [x] Extend login flow with password + TOTP verification ordering (AC: 3, 4)
  - [x] Return short-lived `loginToken` + `nextAction` from the password step; password-only session issuance is forbidden
  - [x] Implement dedicated `/api/v1/auth/otp/verify` session-issuing path for already-enrolled users
  - [x] Reject incomplete MFA enrollment without issuing authenticated session
  - [x] Allow first successful enrollment confirmation to finish the first authenticated login for non-enrolled users while still forbidding service use before that point
  - [x] Store MFA proof metadata in the server session
- [x] Apply MFA verification abuse controls (AC: 5)
  - [x] Reuse lockout/rate-limit conventions without weakening existing login protections
- [x] Add automated integration coverage for enroll, confirm, login success/failure, and throttle paths (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.1, Story 1.2, Story 1.5, Story 0.8.

### Technical Requirements

- Google Authenticator-compatible RFC 6238 TOTP.
- Raw TOTP secret must live only in the approved secret store.
- Password verification must return only a short-lived pre-auth `loginToken` until MFA is completed.
- Every successful authenticated login must satisfy both password and current TOTP verification.
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

- Status set to `done`.
- Completion note: Implementation and closeout verification completed on 2026-03-12, fixing the MFA backend contract for FE and MOB consumers.

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
- Closeout recorded after backend MFA contract, verification path, and enrollment flow shipped.

### Completion Notes List

- Backend Google Authenticator enrollment and login MFA rollout implemented and verified.

### File List

- _bmad-output/implementation-artifacts/1-11-be-google-authenticator-enrollment-and-login-mfa-core.md
