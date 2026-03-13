# Story 1.12: FE Web Google Authenticator Enrollment & Login MFA Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want browser registration and login flows that include Google Authenticator setup and TOTP verification,
so that the web experience matches the MFA requirement cleanly.

## Acceptance Criteria

1. Given a newly registered user or `MFA_ENROLLMENT_REQUIRED` state, when the browser enters MFA setup, then it renders QR, manual entry key guidance, expiry information, and first-code confirmation UX.
2. Given the web login experience, when valid password and current TOTP are submitted, then the user enters the protected route flow without bypassing the MFA step.
3. Given invalid TOTP, required enrollment, or MFA throttle responses, when the browser receives the backend code, then it maps the response to deterministic next-action guidance without leaking sensitive details.
4. Given session expiry or explicit logout after MFA rollout, when the user returns to login, then the browser re-enters the password plus TOTP flow while preserving safe return-to navigation.

## Tasks / Subtasks

- [x] Add web MFA enrollment entry and QR/bootstrap presentation flow (AC: 1)
  - [x] Render manual-entry fallback and expiry guidance
- [x] Extend login UI with TOTP capture and submission behavior (AC: 2)
  - [x] Prevent private-route entry until MFA succeeds
- [x] Map MFA-specific backend codes into consistent browser guidance (AC: 3)
  - [x] Handle invalid-code, enrollment-required, and throttle states deterministically
- [x] Align logout/session-expiry return path with password+TOTP login (AC: 4)
  - [x] Preserve safe `returnTo` behavior after re-auth
- [x] Add UI and integration coverage for enroll, confirm, login, and session-expiry flows (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.3, Story 1.6, Story 1.11.
- Story 1.11 fixed the backend MFA contract and evidence baseline. This story is the FE lane that consumes that contract; do not redesign MFA semantics.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only while Story 1.11 remains `done` or the MFA API contract is explicitly reconfirmed unchanged.

### Technical Requirements

- Browser must support QR display plus manual key fallback.
- TOTP submission must never persist raw code beyond transient form state.
- MFA-required states must not dead-end the user.
- MFA request/response rules are fixed by Story 1.11 and `channels/api-spec.md`:
  - `POST /api/v1/auth/login` returns pre-auth `loginToken`, `nextAction`, `totpEnrolled`, and `expiresAt`
  - `POST /api/v1/auth/otp/verify` completes login MFA for already-enrolled users
  - `POST /api/v1/members/me/totp/enroll` and `POST /api/v1/members/me/totp/confirm` drive first-time enrollment confirmation
- After successful `POST /api/v1/auth/otp/verify` or `POST /api/v1/members/me/totp/confirm`, the browser must re-fetch `GET /api/v1/auth/csrf` before the next non-GET request because `changeSessionId()` invalidates the previous CSRF token.
- Raw Spring Security CSRF `403 Forbidden` responses must be handled as token-refresh-and-retry guidance, not as MFA business-error mapping.
- Deterministic MFA error mapping must cover `AUTH-009`, `AUTH-010`, `AUTH-011`, `AUTH-018`, and `RATE-001`.

### Architecture Compliance

- Preserve FE route-guard conventions and standardized error mapping.
- Reuse existing auth store/session bootstrap behavior where possible.

### Testing Requirements

- Cover enrollment bootstrap UX, first-code confirmation, login MFA success/failure, throttle handling, and session-expiry re-entry.
- Cover post-auth CSRF token refresh after MFA success and one-time retry behavior on raw CSRF `403`.

### Story Completion Status

- Status set to `done`.
- Completion note: Web MFA rollout shipped on top of the delivered Epic 1 web auth flow, and its contract now serves as an upstream dependency for Story 1.15.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.12)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `pnpm --dir FE type-check`
- `pnpm --dir FE test`

### Completion Notes List

- Implemented password-first plus TOTP-second web login flow with pending MFA state, route guards, and safe protected-route restoration.
- Added browser TOTP enrollment bootstrap/confirm UX with rendered QR display, manual-entry fallback, expiry countdown, and post-auth CSRF refresh handling.
- Preserved safe `redirect` recovery across TOTP enrollment re-entry, expired enrollment recovery, and bare enrollment-route reloads.
- Added backend-contract E2E coverage for FE login MFA, enrollment confirm, CSRF refresh, and one-time raw `403` retry behavior.
- Updated unit and integration coverage for login MFA, enrollment confirm, password recovery coexistence, and session-expiry re-entry; FE type-check and test suites pass.

### File List

- FE/src/api/authApi.ts
- FE/src/components/auth/LoginMfaForm.tsx
- FE/src/components/auth/TotpEnrollmentForm.tsx
- FE/src/hooks/auth/useLoginPageController.ts
- FE/src/hooks/auth/usePublicOnlyRouteGuard.ts
- FE/src/hooks/auth/useRegisterPageController.ts
- FE/src/hooks/auth/useTotpEnrollmentPageController.ts
- FE/src/hooks/auth/useTotpHelpers.ts
- FE/src/index.css
- FE/src/lib/auth-errors.ts
- FE/src/lib/axios.ts
- FE/src/pages/LoginPage.tsx
- FE/src/pages/TotpEnrollmentPage.tsx
- FE/src/router/AppRouter.tsx
- FE/src/router/PendingMfaRoute.tsx
- FE/src/router/PublicOnlyRoute.tsx
- FE/src/router/navigation.ts
- FE/src/store/useAuthStore.ts
- FE/src/types/api.ts
- FE/src/types/auth.ts
- FE/package.json
- FE/pnpm-lock.yaml
- FE/tests/integration/App.test.tsx
- FE/tests/integration/auth-contract.e2e.test.ts
- FE/tests/integration/password-recovery.test.tsx
- FE/tests/unit/api/authApi.test.ts
- _bmad-output/implementation-artifacts/1-12-fe-web-google-authenticator-enrollment-and-login-mfa-flow.md

### Change Log

- 2026-03-12: Implemented FE web Google Authenticator enrollment/login MFA flow, updated route-guard behavior, and added passing unit/integration coverage.
