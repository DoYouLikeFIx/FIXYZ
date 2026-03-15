# Story 4.2: [BE][CH] Risk-Based Order Authorization Policy

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated order initiator,
I want the system to require extra verification only when order risk warrants it,
So that UX friction is reduced without weakening high-risk order protection.

## Acceptance Criteria

1. Given a low-risk order context with trusted session signals and an active trusted auth-session window, when authorization policy runs, then the session auto-advances to `AUTHED` without additional step-up.
2. Given an elevated-risk order context such as an expired trusted auth-session window, login-context mismatch, sensitive order amount, or security-event recency, when authorization policy runs, then additional TOTP step-up is required before execution can proceed.
3. Given required step-up verification inside the allowed time window, when the verify endpoint is called with a valid code, then verification succeeds and the session can advance.
4. Given duplicate rapid verify attempts, when debounce policy applies, then the request is throttled without attempt over-consumption.
5. Given TOTP replay in the same window, when replay is detected, then the request is rejected deterministically.
6. Given max attempts exceeded on a required step-up challenge, when further verify is attempted, then the session is failed and execution is blocked.

## Tasks / Subtasks

- [x] Preserve the create-time risk classification contract inherited from Story 4.1 (AC: 1, 2)
  - [x] Keep low-risk trusted-session bypass and elevated-risk challenge-required creation semantics covered for large orders, login-context mismatches, and recent security events
- [x] Enforce conditional TOTP verify only for active `PENDING_NEW` sessions where `challengeRequired=true` (AC: 3, 6)
  - [x] Reject verify attempts for `AUTHED`, `FAILED`, `EXPIRED`, and other non-step-up states with deterministic session-state errors
- [x] Apply debounce before attempt consumption on the verify endpoint (AC: 4)
  - [x] Return `429 RATE-001` for rapid duplicate submits without decrementing remaining attempts
- [x] Detect same-window TOTP replay deterministically (AC: 5)
  - [x] Preserve the documented replay error contract and audit evidence
- [x] Enforce max-attempt exhaustion and terminal failure transition (AC: 6)
  - [x] Block downstream execution for any non-`AUTHED` session after exhaustion
- [x] Add automated coverage for success, mismatch, debounce, replay, third-failure exhaustion, and fourth-attempt-after-failure behavior (AC: 3, 4, 5, 6)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.1, Story 1.2.

### Technical Requirements

- Story 4.1 remains the owner of the create-time authorization decision contract; this story hardens verify-time enforcement and policy invariants without redefining the session-create response.
- This story owns risk-based step-up enforcement, not universal per-order OTP.
- The default low-risk bypass window is a trusted auth-session window (60 minutes), not an immediate post-login-only MFA proof.
- The verify endpoint must only run for active `PENDING_NEW` sessions where `challengeRequired=true`.
- TOTP step-up must remain conditional and time-bounded.
- Debounce must apply before attempt consumption so rapid duplicates do not burn retries.
- Replay prevention, debounce, and attempt exhaustion must all be auditable and deterministic.
- Post-MVP discussion items to capture but not implement in this story:
  - mobile-specific trusted device/app continuity
  - invalidation rules for reinstall, secure-storage wipe, trust-binding rotate/revoke, and session-family mismatch
  - soft-signal treatment for mobile network change/background-resume
  - Step C local biometric/app-PIN confirmation
  - device-keystore/FIDO-backed transaction assertions
  - see `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/post-mvp-mobile-order-trust-hardening.md`

### Architecture Compliance

- Use Vault-backed TOTP verification and architecture-defined Redis key patterns.
- Preserve session-state transition boundaries rather than allowing direct execution bypass.
- Keep authorization policy server-owned; clients consume decisions but do not author them.

### Testing Requirements

- Preserve regression coverage for low-risk auto-authorization and elevated-risk challenge-required session creation semantics owned by Story 4.1.
- Cover successful verify, mismatch, debounce throttling, replay rejection, attempt exhaustion, and post-failure state-guard behavior.
- Include negative-path verification for already terminal or already `AUTHED` sessions.

### Story Completion Status

- Status set to `review`.
- Completion note: Implementation is complete and the story remains in `review` with direct QA evidence for both create-time policy decisions and verify-path hardening.

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
- `./gradlew :channel-service:test --tests com.fix.channel.integration.OrderSessionIntegrationTest`
- `./gradlew :channel-service:test --tests com.fix.channel.service.OrderSessionServiceTest`
- `./gradlew :channel-service:test --tests com.fix.channel.service.OrderSessionExpirySchedulerTest`
- `./gradlew --no-daemon :channel-service:test --tests com.fix.channel.service.OrderSessionServiceTest.shouldAutoAuthorizeLowRiskSessionWhenTrustedAuthSessionWindowIsFresh --tests com.fix.channel.service.OrderSessionServiceTest.shouldCreatePendingNewSessionWithTtlMetadata --tests com.fix.channel.service.OrderSessionServiceTest.shouldExtendActiveSessionEvenWhenTrustedAuthWindowIsStale --tests com.fix.channel.service.OrderSessionServiceTest.shouldRequireStepUpWhenLoginContextChangesEvenForLowRiskOrder --tests com.fix.channel.service.OrderSessionServiceTest.shouldRequireStepUpWhenRecentSecurityEventExists --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldAutoAuthorizeLowRiskOrderWhenTrustedAuthSessionWindowIsFresh --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldRequireStepUpWhenRequestDeviceContextDiffersFromLogin --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldAllowPendingSessionSuccessMarkerReplayWithinTotpWindow --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldReturnOrd009ForAlreadyAuthorizedSessionEvenWhenSuccessMarkerExists --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldThrottleRapidDuplicateVerifyWithoutConsumingAttempts --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldRejectSameWindowTotpReplayAcrossPendingOrderSessions`

### Completion Notes List

- Story scaffold updated to focus on verify-path hardening, deterministic replay or debounce behavior, and terminal failure enforcement for conditional step-up.
- Current MVP remains on the shared trusted-session + login-context continuity model; mobile-specific trust hardening and local transaction confirmation are documented as post-MVP TODO only.
- Enforced verify-time guards so only challenge-required `PENDING_NEW` sessions can consume TOTP verification; already-`AUTHED`, expired, and terminal sessions now fail with deterministic session-state errors.
- Claimed the replay guard before authorization completion so same-window TOTP reuse is rejected deterministically while rapid duplicate submits are throttled without burning attempts.
- Added backend regression coverage for no-challenge verify rejection, member-wide same-window replay, and max-attempt exhaustion after the third failure.
- Preserved create-time risk-policy evidence for stale trusted-session windows alongside large-order, login-context mismatch, and recent-security-event triggers.

### File List

Changed Files:
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java
- _bmad-output/implementation-artifacts/4-2-risk-based-order-authorization-policy.md

Verification References:
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionExpirySchedulerTest.java

### Change Log

- 2026-03-15: Implemented verify-path hardening for conditional step-up, including deterministic state guards, replay or debounce enforcement, and targeted backend regression coverage.

## QA Results

### Reviewer

- Quinn (QA Engineer), 2026-03-15

### Gate Decision

- PASS

### Acceptance Criteria Validation

1. AC1 (low-risk auto-authorization): PASS
   - Evidence: `OrderSessionServiceTest.shouldAutoAuthorizeLowRiskSessionWhenTrustedAuthSessionWindowIsFresh` and `OrderSessionIntegrationTest.shouldAutoAuthorizeLowRiskOrderWhenTrustedAuthSessionWindowIsFresh` were rerun and directly verify low-risk `AUTHED` creation plus trusted-session reason mapping.
2. AC2 (elevated-risk step-up requirement): PASS
   - Evidence: `OrderSessionServiceTest.shouldCreatePendingNewSessionWithTtlMetadata`, `OrderSessionServiceTest.shouldExtendActiveSessionEvenWhenTrustedAuthWindowIsStale`, `OrderSessionServiceTest.shouldRequireStepUpWhenLoginContextChangesEvenForLowRiskOrder`, `OrderSessionServiceTest.shouldRequireStepUpWhenRecentSecurityEventExists`, and `OrderSessionIntegrationTest.shouldRequireStepUpWhenRequestDeviceContextDiffersFromLogin` were rerun and together verify elevated-risk creation for large orders, expired trusted-session windows, login-context mismatches, and recent security events.
3. AC3 (valid verify advances session): PASS
   - Evidence: successful verify flow remains covered, and the same-session same-window idempotency regression in `OrderSessionIntegrationTest` now explicitly guards the documented success-marker precedence for the pending-session race window. Already-`AUTHED` retries remain intentionally governed by `ORD-009` per the API contract.
4. AC4 (debounce without extra attempt burn): PASS
   - Evidence: rapid duplicate verify still returns `RATE-001` while preserving remaining attempts, and the rejection now persists both audit-log and security-event evidence.
5. AC5 (deterministic same-window replay rejection): PASS
   - Evidence: cross-session same-window replay remains blocked with `AUTH-011`, and the rejection now persists both audit-log and security-event evidence.
6. AC6 (attempt exhaustion fails session and blocks execute): PASS
   - Evidence: third-failure exhaustion and post-failure verify/execute guards remain covered.

### Executed Verification

- `./gradlew --no-daemon :channel-service:test --tests com.fix.channel.service.OrderSessionServiceTest --tests com.fix.channel.integration.OrderSessionIntegrationTest`
- `./gradlew --no-daemon :channel-service:test --tests com.fix.channel.service.OrderSessionServiceTest.shouldAutoAuthorizeLowRiskSessionWhenTrustedAuthSessionWindowIsFresh --tests com.fix.channel.service.OrderSessionServiceTest.shouldCreatePendingNewSessionWithTtlMetadata --tests com.fix.channel.service.OrderSessionServiceTest.shouldExtendActiveSessionEvenWhenTrustedAuthWindowIsStale --tests com.fix.channel.service.OrderSessionServiceTest.shouldRequireStepUpWhenLoginContextChangesEvenForLowRiskOrder --tests com.fix.channel.service.OrderSessionServiceTest.shouldRequireStepUpWhenRecentSecurityEventExists --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldAutoAuthorizeLowRiskOrderWhenTrustedAuthSessionWindowIsFresh --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldRequireStepUpWhenRequestDeviceContextDiffersFromLogin --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldAllowPendingSessionSuccessMarkerReplayWithinTotpWindow --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldReturnOrd009ForAlreadyAuthorizedSessionEvenWhenSuccessMarkerExists --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldThrottleRapidDuplicateVerifyWithoutConsumingAttempts --tests com.fix.channel.integration.OrderSessionIntegrationTest.shouldRejectSameWindowTotpReplayAcrossPendingOrderSessions`
- `LIVE_API_BASE_URL=http://127.0.0.1:8080 pnpm exec playwright test e2e/live/order-session-live.spec.ts`
- `LIVE_API_BASE_URL=http://127.0.0.1:8080 pnpm exec vitest run tests/e2e/mobile-order-live.e2e.test.ts`

### Findings

- None.

### Notes

- QA remediation restored the documented pending-session OTP success-idempotency path so success-marker precedence no longer falls through to `AUTH-011` when the current order session still presents the same-window success marker.
- Replay and debounce rejection paths now emit explicit audit-log and security-event records, closing the story's remaining evidence gap.
- Create-time policy evidence is now explicit in the QA record rather than inferred from unchanged upstream coverage.
- BE-FE and BE-MOB live order-session lanes were rerun successfully on `2026-03-16`, confirming the repaired auth/login challenge contract plus funded-account provisioning in the current local stack.
