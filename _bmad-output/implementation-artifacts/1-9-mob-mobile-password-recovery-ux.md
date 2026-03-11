# Story 1.9: MOB Mobile Password Recovery UX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a locked-out or forgetful mobile user,
I want a native password recovery request/reset flow,
so that I can regain access on mobile without relying on inconsistent web-only behavior.

## Acceptance Criteria

1. Given the mobile login screen or a dedicated native recovery entry, when the user opens password recovery, then the app provides a native forgot-password submit experience instead of only inline guidance.
2. Given `POST /api/v1/auth/password/forgot`, when the user submits any normalized email and the request is not rejected by CSRF or rate limiting, then the app shows the same accepted guidance for known and unknown accounts and does not disclose eligibility.
3. Given the recovery contract advertises `challengeMayBeRequired=true` or the flow requires challenge bootstrap, when the app calls `POST /api/v1/auth/password/forgot/challenge`, then the challenge token, type, and TTL are handled in transient app state and the follow-up forgot submit preserves the original email payload semantics.
4. Given a CSRF failure on forgot, challenge, or reset submit, when the app receives raw `403 Forbidden`, then it refreshes CSRF once, retries once with identical payload, and if the second attempt still fails shows terminal error UX.
5. Given the app receives a valid recovery token through the supported mobile handoff, when the user opens the reset-password screen and submits a new password, then the app calls `POST /api/v1/auth/password/reset`, handles `204 No Content`, and routes the user back to login with deterministic success guidance.
6. Given invalid, expired, consumed, same-password, rate-limited, or stale-session outcomes, when the app receives `AUTH-012` through `AUTH-016` or an unknown recovery error, then field/global guidance is mapped deterministically, `Retry-After` guidance is shown where applicable, and stale-session handling returns the user to the login route without back-stack corruption.

## Tasks / Subtasks

- [x] Add native mobile recovery routes and entry points (AC: 1, 5)
  - [x] Add a forgot-password screen reachable from the login screen and a reset-password screen reachable from the supported token handoff owned by the current app shell
  - [x] Extend the custom auth navigation state instead of introducing a second navigation framework
  - [x] Preserve deterministic return-to-login behavior after success or terminal failure
- [x] Implement mobile recovery API client contract on top of the existing auth/network stack (AC: 2, 3, 4, 5)
  - [x] Extend `MOB/src/api/auth-api.ts` with JSON-body recovery endpoints while leaving login/register form submissions unchanged
  - [x] Reuse `CsrfTokenManager` and current unsafe-method header injection for forgot, challenge, and reset submits
  - [x] Keep recovery challenge token and reset token in transient view-model/navigation state only
- [x] Implement native forgot-password UX and challenge step handling (AC: 1, 2, 3)
  - [x] Reuse current auth scaffolding, form field patterns, and banner treatments
  - [x] Submit email, show fixed accepted copy, and support optional challenge bootstrap/submit without eligibility disclosure
  - [x] Surface challenge TTL/type without hardcoding a provider SDK dependency beyond the backend contract
- [x] Implement native reset-password UX and post-success handoff (AC: 4, 5, 6)
  - [x] Validate the new password against the shared password policy before submit
  - [x] On `204`, clear recovery state and route the user back to the login screen with deterministic success guidance
  - [x] Map `AUTH-012` through `AUTH-016` and unknown errors to mobile-specific field/global guidance
- [x] Add mobile regression coverage and targeted live smoke coverage for the recovery surface (AC: 1, 2, 3, 4, 5, 6)
  - [x] Expand unit/e2e coverage around view models, app-state behavior, and error mapping
  - [x] Extend Maestro coverage beyond the current guidance panel into forgot, challenge, reset, terminal CSRF UX, deep-link handoff, and targeted live smoke on accepted forgot, challenge bootstrap, invalid reset, and optional env-backed reset success

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.10`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` uses historical numbering and must not override canonical story ID ownership.
- Story 1.7 already fixed the backend contract and evidence baseline. This story is the MOB lane that consumes that contract; do not redesign the recovery semantics.
- Execution gate: keep this story `ready-for-dev`, but do not move implementation to `in-progress` until Story 1.7 exits `review` or the recovery API contract is explicitly reconfirmed unchanged.
- Current shipped mobile surface only provides login-screen guidance. This story introduces the missing dedicated native recovery screens and submit flow.

### Technical Requirements

- Recovery endpoints and client rules are fixed by Story 1.7:
  - `POST /api/v1/auth/password/forgot`
  - `POST /api/v1/auth/password/forgot/challenge`
  - `POST /api/v1/auth/password/reset`
- Request/response rules that the app must honor:
  - Recovery endpoints use JSON request bodies.
  - Forgot success is always fixed `202 Accepted` for CSRF-valid, non-rate-limited requests.
  - Challenge bootstrap success is fixed `200 OK` with `challengeToken`, `challengeType`, and `challengeTtlSeconds=300`.
  - Reset success is bare `204 No Content`.
  - CSRF failure is raw `403 Forbidden`, not the application envelope.
  - On CSRF `403`, MOB behavior is fixed: one CSRF refresh and one retry with identical payload only.
- UX rules that must remain deterministic:
  - Known and unknown emails must render the same accepted recovery result.
  - Reset-token invalid/expired/consumed/same-password/rate-limited outcomes must align with `AUTH-012` through `AUTH-015`.
  - Post-reset stale-session follow-up must align with `AUTH-016` and reuse the existing mobile re-auth route semantics.
- Security hygiene:
  - Do not persist the raw reset token or challenge token to keychain, async storage, launch arguments, analytics payloads, or logs.
  - Do not infer account existence from timing, copy, route choice, or CTA differences.
  - If a token entry path is added, keep it transient and route-local; no background persistence.

### Architecture Compliance

- Reuse the existing mobile auth architecture:
  - `useAuthFlowViewModel -> screen/view model hooks -> mobile-auth-service -> auth-api -> HttpClient/CsrfTokenManager`
- Keep mobile auth behavior aligned with the server session-cookie model:
  - do not introduce bearer-token handling or a second auth transport
  - reuse `CsrfTokenManager` instead of manual per-screen header logic
  - preserve the custom auth navigation state in `auth-navigation.ts`
- Mobile-specific guardrails:
  - app resume / foreground transitions must not destroy in-progress recovery state unexpectedly
  - successful reset must return the app to the login route without back-stack corruption
  - stale-session follow-up after reset must reuse the existing re-auth handling path
- Concrete mobile handoff and deep-link shapes are channel-owned implementation details; this story requires only a supported recovery-token ingress into the reset screen.
- If the implementation accepts reset tokens from OS handoff, keep the plumbing minimal and internal to the current app shell. Do not introduce a large navigation or linking refactor.

### Library / Framework Requirements

- Follow the MOB repo baseline already installed in `MOB/package.json`:
  - `react`: `19.2.3`
  - `react-native`: `0.84.0`
  - `@react-native-cookies/cookies`: `^6.2.1`
  - `react-native-keychain`: `^10.0.0`
  - `react-native-launch-arguments`: `^4.1.1` (tests only; do not use as production recovery state)
- Guardrail:
  - this is not a package-upgrade or navigation-framework migration story
  - prefer existing React Native and app-shell primitives over adding new form or routing libraries

### File Structure Requirements

- Expected touched areas:
  - `MOB/src/screens/auth/**`
  - `MOB/src/auth/**`
  - `MOB/src/api/auth-api.ts`
  - `MOB/src/navigation/auth-navigation.ts`
  - `MOB/src/network/csrf.ts`
  - `MOB/src/types/**`
  - `MOB/tests/**`
  - `MOB/e2e/maestro/auth/**`
  - `MOB/e2e/maestro/auth-live/**`
- Recommended additions:
  - dedicated `ForgotPasswordScreen` and `ResetPasswordScreen`
  - recovery-focused view-model hooks or flow-state extensions that mirror the existing MVVM split
  - minimal token-entry plumbing located near the app/auth shell instead of spread across screens
- Reuse before adding:
  - `AuthScaffold`, `AuthField`, shared auth styles
  - `useAuthFlowViewModel` / `mobile-auth-service` orchestration patterns
  - `resolveAuthErrorPresentation` and existing re-auth semantics

### Testing Requirements

- Required mobile checks:
  - forgot-password screen is reachable from login and renders the expected native fields
  - known vs unknown email submits show identical accepted copy for non-rate-limited, CSRF-valid requests
  - challenge bootstrap captures token/type/ttl and resubmits forgot with the original email unchanged
  - raw CSRF `403` triggers exactly one refresh and one retry
  - reset screen with valid token submits `newPassword` and returns to login success guidance on `204`
  - `AUTH-012`, `AUTH-013`, `AUTH-014`, `AUTH-015`, and unknown errors map to stable mobile guidance
  - stale pre-reset session follow-up surfaces `AUTH-016` re-auth navigation without back-stack corruption
- Test infrastructure expectations:
  - extend unit coverage around recovery state, auth error mapping, and `CsrfTokenManager` usage
  - expand Maestro flows beyond the current guidance-only scenario
  - keep at least one live-backend mobile path for recovery once the full UX exists
- Review evidence expectations:
  - add story-specific mobile evidence under `_bmad-output/implementation-artifacts/tests/` if closeout needs screenshots or Maestro transcripts

### Quinn Reinforcement Checks

- Numbering gate:
  - `story_key`, filename, and sprint-status key must remain `1-9-mob-mobile-password-recovery-ux`.
- Anti-enumeration gate:
  - identical copy, CTA state, and route behavior for known vs unknown email submits unless the request is rate-limited or CSRF-rejected.
- CSRF gate:
  - exactly one refresh and one retry for forgot/challenge/reset submits; no silent infinite retry loops.
- Token-hygiene gate:
  - reset token and challenge token remain transient and never land in keychain, cookie mirrors, launch arguments, or persisted logs.
- Navigation gate:
  - success and `AUTH-016` flows must return to login cleanly without corrupting the custom auth/app stack state.
- Regression gate:
  - existing login/register/auth bootstrap/app-resume behavior from Story 1.4 must continue to pass.

### Previous Story Intelligence

- From Story 1.7:
  - current evidence proves backend contract parity and that the shipped mobile surface stops at login guidance only
  - the backend-advertised CSRF header name must be honored, not hard-coded
  - challenge replay rejection currently surfaces `AUTH-012`
- From Story 1.6:
  - recovery code semantics and one-refresh/one-retry CSRF behavior are already standardized for FE/MOB
- From the current mobile auth flow:
  - auth transitions, app-resume revalidation, and re-auth routing already live in `useAuthFlowViewModel` and `auth-navigation.ts`; recovery should extend those patterns instead of bypassing them

### Git Intelligence Summary

- Recent auth commits normalized the lane around email-first terminology and password-recovery documentation.
- Keep this story email-centric and avoid introducing legacy username wording anywhere in mobile copy, tests, or token handoff handling.

### Latest Tech Information

- No stack uplift is required for this story.
- Use the currently installed mobile baseline from `MOB/package.json` and existing repo conventions as the implementation target.

### Project Context Reference

- `project-context.md` not found in repository scan.
- Context derived from canonical planning artifacts, Story 1.7 evidence, and the shipped mobile auth implementation.

### Story Completion Status

- Status set to `done`.
- Completion note: Mobile password recovery screens, submit flow, and terminal error guidance were implemented and the story is closed as done with Epic 1.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.9)
- `_bmad-output/planning-artifacts/prd.md` (FR-57~61)
- `_bmad-output/planning-artifacts/channels/api-spec.md` (Password Recovery Addendum)
- `_bmad-output/planning-artifacts/channels/login_flow.md` (Password Recovery Flow Addendum)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/1-4-mob-mobile-auth-flow.md`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`
- `_bmad-output/implementation-artifacts/1-7-be-password-forgot-reset-api.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `MOB/src/api/auth-api.ts`
- `MOB/src/network/csrf.ts`
- `MOB/src/auth/use-auth-flow-view-model.ts`
- `MOB/src/navigation/auth-navigation.ts`
- `MOB/e2e/maestro/auth-live/04-password-recovery-request-live-be.yaml`

## Change Log

- 2026-03-10: Implemented mobile password recovery screens, deep-link handoff preservation, dev-only QA reset input mode, deterministic stale-state cleanup, and mobile regression plus targeted live smoke coverage.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Implementation Plan

- Extend the current auth navigation state and flow view model with native forgot/reset routes instead of introducing a new navigation framework.
- Add recovery request, challenge, and reset calls to the mobile auth/network stack while preserving centralized CSRF refresh-and-retry handling.
- Build dedicated native forgot/reset screens and view models that keep challenge/reset tokens transient and route success back to the existing login surface.
- Add mobile unit, e2e, and Maestro coverage for recovery entry, challenge bootstrap, reset completion, terminal CSRF UX, deep-link handoff, and deterministic recovery error handling, while keeping live reset success env-backed because a real recovery token is required.

### Debug Log References

- `npm --prefix MOB run lint`
- `npm --prefix MOB test -- auth-flow-view-model.test.ts mobile-password-recovery.e2e.test.ts`
- `npm --prefix MOB run typecheck`
- `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer MOB/scripts/run-maestro-auth-suite.sh MOB/e2e/maestro/auth/12-password-recovery-terminal-403.yaml`
- `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer MOB/scripts/run-maestro-auth-suite.sh MOB/e2e/maestro/auth/13-password-recovery-challenge-terminal-403.yaml`
- `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer MOB/scripts/run-maestro-auth-suite.sh MOB/e2e/maestro/auth/14-password-reset-terminal-403.yaml`
- `LIVE_API_BASE_URL=http://127.0.0.1:8080 LIVE_EMAIL=<unique_email> DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer MOB/scripts/run-maestro-auth-suite.sh MOB/e2e/maestro/auth-live/06-password-recovery-challenge-live-be.yaml`

### Completion Notes List

- Added native forgot/reset screens and auth-route transitions on top of the existing auth MVVM and custom navigation stack.
- Implemented recovery endpoints plus one-refresh/one-retry CSRF handling in the mobile HTTP client without persisting challenge or reset tokens.
- Preserved cold-start deep-link reset handoff across bootstrap, and limited the Maestro plaintext-password hook to dev builds only.
- Added mobile unit, e2e, and Maestro recovery coverage for challenge bootstrap, terminal second-`403` UX, reset success handoff, deep-link handoff, and the manual token-entry flow.
- Added live smoke coverage for accepted forgot, challenge bootstrap, invalid reset, and an optional env-backed reset-success deep-link flow.

### File List

- MOB/src/types/auth.ts
- MOB/src/types/auth-ui.ts
- MOB/src/network/types.ts
- MOB/src/network/errors.ts
- MOB/src/network/csrf.ts
- MOB/src/network/http-client.ts
- MOB/src/api/auth-api.ts
- MOB/src/navigation/auth-navigation.ts
- MOB/src/auth/mobile-auth-service.ts
- MOB/src/auth/auth-errors.ts
- MOB/src/auth/form-validation.ts
- MOB/src/auth/auth-flow-view-model.ts
- MOB/src/auth/password-reset-handoff.ts
- MOB/src/auth/use-auth-flow-view-model.ts
- MOB/src/auth/use-forgot-password-view-model.ts
- MOB/src/auth/use-reset-password-view-model.ts
- MOB/src/config/runtime-options.ts
- MOB/src/navigation/AppNavigator.tsx
- MOB/src/screens/auth/LoginScreen.tsx
- MOB/src/screens/auth/ForgotPasswordScreen.tsx
- MOB/src/screens/auth/ResetPasswordScreen.tsx
- MOB/src/index.ts
- MOB/scripts/mock-auth-server.mjs
- MOB/scripts/run-maestro-auth-suite.sh
- MOB/README.md
- MOB/ios/FIXYZMob/Info.plist
- MOB/android/app/src/main/AndroidManifest.xml
- MOB/tests/unit/api/auth-api.test.ts
- MOB/tests/unit/network/csrf.test.ts
- MOB/tests/unit/network/http-client.test.ts
- MOB/tests/unit/auth/auth-errors.test.ts
- MOB/tests/unit/auth/form-validation.test.ts
- MOB/tests/unit/navigation/auth-navigation.test.ts
- MOB/tests/unit/auth/auth-flow-view-model.test.ts
- MOB/tests/unit/auth/mobile-auth-service.test.ts
- MOB/tests/e2e/mobile-password-recovery.e2e.test.ts
- MOB/e2e/maestro/auth/08-password-recovery-request.yaml
- MOB/e2e/maestro/auth/09-password-reset-manual-token.yaml
- MOB/e2e/maestro/auth/10-password-reset-success.yaml
- MOB/e2e/maestro/auth/11-password-reset-deeplink-handoff.yaml
- MOB/e2e/maestro/auth/12-password-recovery-terminal-403.yaml
- MOB/e2e/maestro/auth/13-password-recovery-challenge-terminal-403.yaml
- MOB/e2e/maestro/auth/14-password-reset-terminal-403.yaml
- MOB/e2e/maestro/auth-live/04-password-recovery-request-live-be.yaml
- MOB/e2e/maestro/auth-live/05-password-reset-invalid-token-live-be.yaml
- MOB/e2e/maestro/auth-live/06-password-recovery-challenge-live-be.yaml
- MOB/e2e/maestro/auth-live/07-password-reset-success-live-be.yaml
- _bmad-output/implementation-artifacts/1-9-mob-mobile-password-recovery-ux.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
