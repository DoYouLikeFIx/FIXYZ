# Story 1.13: MOB Mobile Google Authenticator Enrollment & Login MFA Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want native Google Authenticator enrollment and login MFA parity with web,
so that the mobile client follows the same second-factor rules.

## Acceptance Criteria

1. Given a newly registered user or `MFA_ENROLLMENT_REQUIRED` state, when the mobile app enters MFA setup, then it shows QR or secure manual-entry/deep-link enrollment guidance plus first-code confirmation.
2. Given the mobile login experience, when valid password and current TOTP are submitted, then the authenticated app stack is entered only after MFA succeeds.
3. Given invalid TOTP, required enrollment, or MFA throttle responses, when the app receives the backend code, then it maps field/global guidance deterministically and avoids back-stack corruption.
4. Given app resume or session expiry after MFA rollout, when the app rechecks session state, then stale sessions route back into the password plus TOTP login flow safely.

## Tasks / Subtasks

- [x] Add mobile MFA enrollment entry and QR/manual-entry guidance flow (AC: 1)
  - [x] Support native-first enrollment guidance without leaking secret material into persistent storage
- [x] Extend mobile login UI with password + TOTP sequencing (AC: 2)
  - [x] Block authenticated stack entry until MFA succeeds
- [x] Map MFA-specific backend codes into native field/global guidance (AC: 3)
  - [x] Keep navigation stack consistent on invalid-code or throttle paths
- [x] Align resume/session-expiry handling with password+TOTP re-auth (AC: 4)
  - [x] Ensure stale sessions clear sensitive screen state safely
- [x] Add mobile test coverage for enrollment, login MFA, error mapping, and resume flows (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.4, Story 1.6, Story 1.11.
- Story 1.11 fixed the backend MFA contract and evidence baseline. This story is the MOB lane that consumes that contract; do not redesign MFA semantics.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only while Story 1.11 remains `done` or the MFA API contract is explicitly reconfirmed unchanged.

### Technical Requirements

- Native client must not persist raw TOTP secret or raw verification codes.
- Shared MFA request/response rules are fixed by Story 1.11 and `channels/api-spec.md`; mobile must consume the same `loginToken`, `nextAction`, enrollment, confirmation, and error-code contract as FE.
- Enrollment delivery contract for this story is `qrUri` plus `manualEntryKey` fallback. Secure deep-link handoff is optional platform-specific UX sugar only if capability and security review allow it, and it must not block story delivery or alter the backend payload.
- Resume logic must always defer to server session truth.
- Deterministic MFA error mapping must cover `AUTH-009`, `AUTH-010`, `AUTH-011`, `AUTH-018`, and `RATE-001` without corrupting the auth navigation stack.

### Architecture Compliance

- Preserve mobile auth stack boundaries and existing session bootstrap rules.
- Keep error semantics aligned with FE even when the interaction model differs.

### Testing Requirements

- Cover enrollment setup, first confirmation, login MFA success/failure, throttle handling, and stale-session resume behavior.
- Cover navigation-stack preservation on invalid-code, expired-token, and throttle responses, plus parity with the shared FE MFA state matrix.

### Story Completion Status

- Status set to `done`.
- Completion note: Mobile MFA rollout shipped on top of the delivered Epic 1 mobile auth flow, and its contract now serves as an upstream dependency for Story 1.15.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.13)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `npm --prefix MOB run typecheck`
- `npm --prefix MOB test`

### Completion Notes List

- Implemented mobile password-first plus TOTP-second auth sequencing with pending MFA navigation state, dedicated MFA/enrollment screens, and deterministic error handling.
- Added native enrollment bootstrap/confirm handling with QR URI/manual key guidance, expiry countdowns, safe restart paths, and shared contract parity with FE.
- Stabilized enrollment bootstrap failure handling so the screen stops after one failed attempt and retries only on explicit user action.
- Added backend-driven mobile E2E coverage for MFA throttle handling and resume-triggered stale-session reauth routing.
- Updated mobile API/service/view-model/e2e coverage for login MFA, enrollment confirmation, and re-auth-on-resume behavior; mobile type-check and test suites pass.

### File List

- MOB/src/api/auth-api.ts
- MOB/src/auth/auth-errors.ts
- MOB/src/auth/auth-flow-view-model.ts
- MOB/src/auth/mobile-auth-service.ts
- MOB/src/auth/use-auth-flow-view-model.ts
- MOB/src/auth/use-expiry-countdown.ts
- MOB/src/auth/use-login-view-model.ts
- MOB/src/auth/use-register-view-model.ts
- MOB/src/navigation/AppNavigator.tsx
- MOB/src/navigation/auth-navigation.ts
- MOB/src/network/errors.ts
- MOB/src/network/types.ts
- MOB/src/screens/auth/LoginMfaScreen.tsx
- MOB/src/screens/auth/LoginScreen.tsx
- MOB/src/screens/auth/RegisterScreen.tsx
- MOB/src/screens/auth/TotpEnrollmentScreen.tsx
- MOB/src/types/auth.ts
- MOB/src/types/auth-ui.ts
- MOB/tests/e2e/mobile-auth-flow.e2e.test.ts
- MOB/tests/mocks/react-native.ts
- MOB/tests/unit/api/auth-api.test.ts
- MOB/tests/unit/auth/auth-flow-view-model.test.ts
- MOB/tests/unit/auth/mobile-auth-service.test.ts
- MOB/tests/unit/auth/TotpEnrollmentScreen.test.tsx
- _bmad-output/implementation-artifacts/1-13-mob-mobile-google-authenticator-enrollment-and-login-mfa-flow.md

### Change Log

- 2026-03-12: Implemented mobile Google Authenticator enrollment/login MFA flow, added dedicated MFA screens and parity tests, and verified the updated auth stack end to end.
