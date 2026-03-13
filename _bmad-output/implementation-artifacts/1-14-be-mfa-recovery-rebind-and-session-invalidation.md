# Story 1.14: BE MFA Recovery, Rebind & Session Invalidation

Status: done

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

- [x] Define MFA recovery and rebind entry conditions (AC: 1)
  - [x] Support authenticated password-confirmed and approved recovery-proof paths
- [x] Implement old-secret terminalization before re-enrollment bootstrap issuance (AC: 1, 2)
  - [x] Invalidate active sessions and trusted-session metadata on success
- [x] Add deterministic rejection handling for invalid or replayed recovery proof (AC: 3)
  - [x] Prevent partial secret rotation on failed attempts
- [x] Emit audit/security events for MFA recovery lifecycle (AC: 4)
  - [x] Exclude raw TOTP secret and raw recovery material from logs/events
- [x] Add backend test coverage for recovery success, replay failure, secret terminalization, and session invalidation (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.7, Story 1.10, Story 1.11, Story 0.8.

### Technical Requirements

- Recovery or rebind proof must be single-use and time-bounded.
- Existing authenticator secret must be terminalized before the new enrollment becomes active.
- Session invalidation must cover server session state and any trusted-session marker used by later order authorization.
- Canonical endpoint contract:
  - Authenticated path: `POST /api/v1/members/me/totp/rebind { currentPassword }`
  - Recovery-proof path: `POST /api/v1/auth/mfa-recovery/rebind { recoveryProof }`
  - Confirm path: `POST /api/v1/auth/mfa-recovery/rebind/confirm { rebindToken, enrollmentToken, otpCode }`
- Password-reset continuation may issue `X-MFA-Recovery-Proof` with `X-MFA-Recovery-Proof-Expires-In: 600`; clients must keep the proof only in volatile memory.
- Deterministic recovery error codes are fixed as `AUTH-019` (invalid/expired proof), `AUTH-020` (consumed/replayed proof), and `AUTH-021` (recovery required with `recoveryUrl`).
- Successful confirm must invalidate all Spring Session rows for the principal, write stale-session markers, clear `AUTH_LAST_MFA_VERIFIED_AT`, and clear any future trusted-session marker namespace if present.

### Architecture Compliance

- Reuse canonical recovery and session invalidation conventions from baseline Epic 1.
- Keep secret-storage ownership in the approved secret-management lane.

### Testing Requirements

- Validate recovery initiation, rebind completion, replay rejection, session invalidation, and audit-event emission.
- Cover both bootstrap entry modes (authenticated password-confirmed path and recovery-proof path) plus confirm success/failure token consumption.

### Story Completion Status

- Status set to `done`.
- Completion note: Backend MFA recovery, rebind, terminalization, and stale-session invalidation shipped with passing contract and integration coverage.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.14)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `./gradlew --no-daemon :channel-service:test --tests com.fix.channel.integration.ChannelPasswordRecoveryIntegrationTest --tests com.fix.channel.contract.ChannelOpenApiCompatibilityTest`
- `./gradlew --no-daemon :core-common:test :channel-domain:test :channel-service:test`

### Completion Notes List

- Raised rebind confirmation session invalidation to a required synchronous step before pending-secret promotion so failed invalidation aborts completion instead of being swallowed after commit.
- Extended trusted-session cleanup to remove both `ch:trusted-session:{email}` and `ch:trusted-session:{email}:*` markers through Redis `SCAN`, matching the architecture note and Story 1.14 completion expectations.
- Normalized rebind bootstrap errors to the canonical contract: `AUTH-026` for current-password mismatch, `AUTH-009` plus `enrollUrl` for missing TOTP enrollment on the authenticated path, and disclosure-safe `AUTH-019` for stale recovery-proof bootstrap attempts.
- Added integration coverage for canonical error responses, trusted-session namespace cleanup, and the failure path that blocks confirmation when session invalidation is unavailable.
- Sanitized unexpected confirmation failures to the canonical internal-error contract and added backend-side error-code resolution coverage so `AUTH-026` remains guarded in CI.

### File List

- BE/channel-service/src/main/java/com/fix/channel/service/ChannelSessionInvalidationService.java
- BE/channel-service/src/main/java/com/fix/channel/exception/GlobalExceptionHandler.java
- BE/channel-service/src/main/java/com/fix/channel/service/MfaRecoveryService.java
- BE/channel-service/src/test/java/com/fix/channel/contract/ChannelOpenApiCompatibilityTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelPasswordRecoveryIntegrationTest.java
- BE/core-common/src/main/java/com/fix/common/error/ErrorCode.java
- BE/core-common/src/test/java/com/fix/common/error/CoreCommonContractTest.java
- docs/contracts/auth-error-standardization.json
- _bmad-output/implementation-artifacts/1-14-be-mfa-recovery-rebind-and-session-invalidation.md

### Change Log

- 2026-03-13: Aligned backend MFA recovery/rebind follow-up with the architecture contract by making session invalidation blocking, clearing trusted-session namespaces, standardizing canonical error codes, and rerunning BE verification.
