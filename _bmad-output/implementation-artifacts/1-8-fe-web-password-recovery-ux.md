# Story 1.8: FE Web Password Recovery UX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a locked-out or forgetful web user,
I want a browser-based password recovery request/reset flow,
so that I can regain access from the login experience without revealing whether my account exists.

## Acceptance Criteria

1. Given the web login screen or a dedicated public recovery entry, when the user opens password recovery, then the browser provides a dedicated forgot-password submit experience instead of only inline guidance.
2. Given `POST /api/v1/auth/password/forgot`, when the user submits any normalized email and the request is not rejected by CSRF or rate limiting, then the UI shows the same accepted guidance for known and unknown accounts and does not disclose eligibility.
3. Given the recovery lane exposes challenge bootstrap capability or the flow otherwise enters the challenge branch, when the browser calls `POST /api/v1/auth/password/forgot/challenge`, then the challenge token, type, and TTL are handled in UI state and the follow-up forgot submit preserves the original email payload semantics, without treating `challengeMayBeRequired=true` as proof that the current forgot submit is already challenge-gated.
4. Given a CSRF failure on forgot, challenge, or reset submit, when the browser receives raw `403 Forbidden`, then it re-fetches CSRF once, retries once with identical payload, and if the second attempt still fails shows terminal error UX.
5. Given the browser receives a valid recovery token through the supported web handoff, when the user opens the reset-password experience and submits a new password, then the browser calls `POST /api/v1/auth/password/reset`, handles `204 No Content`, and returns the user to login with deterministic success guidance.
6. Given invalid, expired, consumed, same-password, rate-limited, or stale-session outcomes, when the browser receives `AUTH-012` through `AUTH-016` or an unknown recovery error, then user-facing guidance is mapped deterministically, `Retry-After` guidance is shown where applicable, and unknown cases preserve visible support correlation context.

## Tasks / Subtasks

- [x] Add public FE recovery routes and entry points (AC: 1, 5)
  - [x] Add a forgot-password page reachable from `/login` and a dedicated public recovery entry within the existing auth router
  - [x] Add a reset-password page reachable from a supported token-bearing public entry owned by the FE router
  - [x] Preserve `PublicOnlyRoute` semantics so authenticated users are not pushed into a broken recovery loop
- [x] Implement FE recovery API client contract on top of the existing auth client stack (AC: 2, 3, 4, 5)
  - [x] Extend `FE/src/api/authApi.ts` with JSON-body recovery endpoints while leaving login/register form submissions unchanged
  - [x] Reuse `FE/src/lib/axios.ts` CSRF bootstrap and one-refresh/one-retry behavior for forgot, challenge, and reset submits
  - [x] Keep recovery challenge token and reset token in transient route/controller state only
- [x] Implement web forgot-password UX and challenge step handling (AC: 1, 2, 3)
  - [x] Reuse the existing auth frame/look-and-feel instead of introducing a second auth design system
  - [x] Submit email, show fixed accepted copy, and support optional challenge bootstrap/submit without eligibility disclosure
  - [x] Surface challenge TTL/type without hardcoding a provider-specific dependency beyond the backend contract
- [x] Implement web reset-password UX and post-success handoff (AC: 4, 5, 6)
  - [x] Validate new password against the shared password policy before submit
  - [x] On `204`, route back to `/login` with a deterministic success banner and cleared recovery state
  - [x] Map `AUTH-012` through `AUTH-016` and unknown errors to clear next actions
- [x] Add FE regression coverage and targeted live smoke coverage for the recovery surface (AC: 1, 2, 3, 4, 5, 6)
  - [x] Expand unit/integration coverage around controllers, route guards, and error mapping
  - [x] Extend Playwright coverage beyond the current guidance panel into forgot, challenge, reset, stale challenge cleanup, and terminal CSRF guidance, with live smoke on accepted forgot, challenge bootstrap, invalid reset, and optional env-backed reset success

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.10`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` uses historical numbering and must not override canonical story ID ownership.
- Story 1.7 already fixed the backend contract and evidence baseline. This story is the FE lane that consumes that contract; do not redesign the recovery semantics.
- Execution gate: keep this story `ready-for-dev`, but do not move implementation to `in-progress` until Story 1.7 exits `review` or the recovery API contract is explicitly reconfirmed unchanged.
- Current shipped FE surface only provides login-form guidance plus direct contract checks. This story introduces the missing dedicated recovery pages and submit flow on top of that existing baseline.

### Technical Requirements

- Recovery endpoints and client rules are fixed by Story 1.7:
  - `POST /api/v1/auth/password/forgot`
  - `POST /api/v1/auth/password/forgot/challenge`
  - `POST /api/v1/auth/password/reset`
- Request/response rules that the FE must honor:
  - Recovery endpoints use JSON request bodies.
  - Forgot success is always fixed `202 Accepted` for CSRF-valid, non-rate-limited requests.
  - Challenge bootstrap success is fixed `200 OK` with `challengeToken`, `challengeType`, and `challengeTtlSeconds=300`.
  - `challengeMayBeRequired=true` is capability discovery only and must not be treated as the active challenge-gated state for the current forgot submit.
  - Reset success is bare `204 No Content`.
  - CSRF failure is raw `403 Forbidden`, not the application envelope.
  - On CSRF `403`, FE behavior is fixed: one CSRF re-fetch and one retry with identical payload only.
- UX rules that must remain deterministic:
  - Known and unknown emails must render the same accepted recovery result.
  - Reset-token invalid/expired/consumed/same-password/rate-limited outcomes must align with `AUTH-012` through `AUTH-015`.
  - Post-reset stale-session follow-up must align with `AUTH-016` and reuse the existing re-auth guidance semantics.
- Security hygiene:
  - Do not persist the raw reset token or challenge token to `localStorage`, `sessionStorage`, analytics payloads, or logs.
  - Do not infer account existence from timing, copy, route choice, or CTA differences.
  - Do not add provider-specific captcha libraries unless the contract actually requires one; keep challenge rendering contract-driven.

### Architecture Compliance

- Reuse the existing FE auth architecture:
  - `pages -> hooks/auth/*PageController -> api/authApi.ts -> lib/axios.ts -> zustand auth store`
- Keep browser auth behavior aligned with the server session-cookie model:
  - never read the HttpOnly session cookie directly
  - reuse `/api/v1/auth/csrf` bootstrap instead of creating a second CSRF channel
  - keep re-auth behavior centralized through the existing auth store and route guards
- Public recovery pages must stay within the existing React Router structure and must not bypass `PublicOnlyRoute` / redirect helpers.
- Concrete FE path names and query-param shapes are channel-owned implementation details; this story requires a public recovery entry and a token-bearing reset entry, not specific URL strings.
- Password reset success must hand control back to the normal login flow instead of creating a parallel authenticated entry path.

### Library / Framework Requirements

- Follow the FE repo baseline already installed in `FE/package.json`:
  - `react`: `^19.2.0`
  - `react-router-dom`: `^7.13.1`
  - `axios`: `^1.13.2`
  - `zustand`: `^5.0.11`
- Guardrail:
  - this is not a package-upgrade story
  - prefer existing browser and React primitives over adding new form, router, or captcha libraries

### File Structure Requirements

- Expected touched areas:
  - `FE/src/pages/**`
  - `FE/src/components/auth/**`
  - `FE/src/hooks/auth/**`
  - `FE/src/api/authApi.ts`
  - `FE/src/lib/axios.ts`
  - `FE/src/lib/auth-errors.ts`
  - `FE/src/router/**`
  - `FE/tests/**`
  - `FE/e2e/auth-recovery.spec.ts`
- Recommended additions:
  - dedicated `PasswordRecoveryPage` and `PasswordResetPage`
  - page controllers that mirror the existing login/register controller pattern
  - recovery-focused UI components that reuse `AuthFrame` styling rather than creating unrelated layout code
- Reuse before adding:
  - `useLoginPageController` redirect semantics
  - `getAuthErrorMessage` / auth error mapping patterns
  - `fetchCsrfToken` and axios retry hooks

### Testing Requirements

- Required FE checks:
  - direct route to forgot-password is reachable while logged out
  - known vs unknown email submits show identical accepted copy for non-rate-limited, CSRF-valid requests
  - challenge bootstrap captures token/type/ttl and resubmits forgot with the original email unchanged
  - raw CSRF `403` triggers exactly one re-fetch and one retry
  - reset route with valid token submits `newPassword` and returns to login success guidance on `204`
  - `AUTH-012`, `AUTH-013`, `AUTH-014`, `AUTH-015`, and unknown errors map to stable FE guidance
  - stale pre-reset session follow-up surfaces `AUTH-016` re-auth guidance without redirect loops
- Test infrastructure expectations:
  - extend `FE/tests/integration/App.test.tsx` or focused recovery page tests for route/controller behavior
  - extend `FE/tests/unit/lib/auth-errors.test.ts` if recovery-code mapping changes
  - expand `FE/e2e/auth-recovery.spec.ts` beyond the current guidance panel and direct API checks
- Review evidence expectations:
  - add story-specific FE evidence under `_bmad-output/implementation-artifacts/tests/` if closeout needs screenshots or flow transcripts

### Quinn Reinforcement Checks

- Numbering gate:
  - `story_key`, filename, and sprint-status key must remain `1-8-fe-web-password-recovery-ux`.
- Anti-enumeration gate:
  - identical copy, CTA state, and route behavior for known vs unknown email submits unless the request is rate-limited or CSRF-rejected.
- CSRF gate:
  - exactly one re-fetch and one retry for forgot/challenge/reset submits; no silent infinite retry loops.
- Token-hygiene gate:
  - reset token and challenge token remain transient and never land in persistent browser storage, logs, or error telemetry.
- Error-semantics gate:
  - `AUTH-012` -> request reset again
  - `AUTH-013` -> request a new link
  - `AUTH-014` -> show retry-later guidance with `Retry-After`
  - `AUTH-015` -> ask for a different password
  - `AUTH-016` -> re-authenticate
- Regression gate:
  - existing `/login`, `/register`, redirect-preservation, and auth error behavior from Story 1.3 must continue to pass.

### Previous Story Intelligence

- From Story 1.7:
  - FE evidence already proves the current login guidance panel and direct contract checks; build on that instead of replacing it.
  - the backend-advertised CSRF header name must be honored, not hard-coded
  - challenge replay rejection currently surfaces `AUTH-012`
- From Story 1.6:
  - recovery code semantics and one-refresh/one-retry CSRF behavior are already standardized for FE/MOB
- From the current FE auth flow:
  - login/register navigation and redirect handling already live in page controllers; recovery should follow the same controller pattern

### Git Intelligence Summary

- Recent auth commits normalized the lane around email-first terminology and password-recovery documentation.
- Keep this story email-centric and avoid introducing legacy username wording anywhere in FE copy, tests, or route params.

### Latest Tech Information

- No stack uplift is required for this story.
- Use the currently installed FE baseline from `FE/package.json` and existing repo conventions as the implementation target.

### Project Context Reference

- `project-context.md` not found in repository scan.
- Context derived from canonical planning artifacts, Story 1.7 evidence, and the shipped FE auth implementation.

### Story Completion Status

- Status set to `done`.
- Completion note: FE password recovery routes, submit flow, and recovery-state UX were implemented and the story is closed as done with Epic 1.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.8)
- `_bmad-output/planning-artifacts/prd.md` (FR-57~61)
- `_bmad-output/planning-artifacts/channels/api-spec.md` (Password Recovery Addendum)
- `_bmad-output/planning-artifacts/channels/login_flow.md` (Password Recovery Flow Addendum)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/1-3-fe-web-auth-flow.md`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`
- `_bmad-output/implementation-artifacts/1-7-be-password-forgot-reset-api.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `FE/src/api/authApi.ts`
- `FE/src/lib/axios.ts`
- `FE/src/hooks/auth/useLoginPageController.ts`
- `FE/e2e/auth-recovery.spec.ts`

## Change Log

- 2026-03-10: Implemented web password recovery routes, challenge/reset UX, recovery error handling, deterministic stale-state cleanup, and FE regression plus targeted live smoke coverage.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Implementation Plan

- Extend the existing auth router and login controller with dedicated forgot/reset recovery entry points that preserve `PublicOnlyRoute` behavior.
- Add recovery request, challenge, and reset contracts to the FE auth API/client stack while keeping CSRF retry semantics centralized in `lib/axios.ts`.
- Build controller-driven forgot/reset pages and components that keep recovery tokens transient, reuse the current auth frame, and return success through the normal login flow.
- Cover the flow with unit, integration, and Playwright regression/live tests for accepted-copy parity, challenge bootstrap, reset success handoff, and recovery error mapping.
- Add targeted live smoke for accepted forgot, challenge bootstrap, and invalid reset, while keeping live reset-success available as an env-backed optional path because a real recovery token is required.

### Debug Log References

- `pnpm --dir FE lint`
- `pnpm --dir FE test -- password-recovery.test.tsx`
- `pnpm --dir FE exec tsc -b --noEmit`
- `pnpm --dir FE exec playwright test FE/e2e/auth-recovery.spec.ts`
- `LIVE_API_BASE_URL=http://127.0.0.1:8080 pnpm --dir FE exec playwright test FE/e2e/live/auth-live.spec.ts`

### Completion Notes List

- Added dedicated forgot/reset routes, pages, and controller-driven challenge handling while preserving the existing public auth routing semantics.
- Kept reset and challenge tokens transient by scrubbing the web handoff token into route state and avoiding persistent browser storage.
- Fixed stale challenge replay cleanup, latest-token replacement in the same SPA session, and `AUTH-016` reauth routing back to login.
- Added FE unit, integration, and Playwright coverage for recovery routing, accepted-copy parity, challenge replay, terminal second-`403` guidance, reset success handoff, and deterministic recovery error mapping.
- Added live smoke coverage for accepted forgot, challenge bootstrap, and invalid reset, plus an optional env-backed live reset-success path when a real token is available.

### File List

- FE/src/types/auth.ts
- FE/src/lib/axios.ts
- FE/src/lib/auth-errors.ts
- FE/src/lib/schemas/auth.schema.ts
- FE/src/api/authApi.ts
- FE/src/router/navigation.ts
- FE/src/router/AppRouter.tsx
- FE/src/hooks/auth/useLoginPageController.ts
- FE/src/components/auth/LoginForm.tsx
- FE/src/components/auth/ForgotPasswordForm.tsx
- FE/src/components/auth/PasswordResetForm.tsx
- FE/src/hooks/auth/useForgotPasswordPageController.ts
- FE/src/hooks/auth/useResetPasswordPageController.ts
- FE/src/pages/ForgotPasswordPage.tsx
- FE/src/pages/PasswordResetPage.tsx
- FE/src/index.css
- FE/tests/unit/api/authApi.test.ts
- FE/tests/unit/lib/axios.test.ts
- FE/tests/unit/lib/auth-errors.test.ts
- FE/tests/integration/App.test.tsx
- FE/tests/integration/password-recovery.test.tsx
- FE/tests/unit/hooks/auth/useAppBootstrap.test.tsx
- FE/e2e/auth-recovery.spec.ts
- FE/e2e/live/auth-live.spec.ts
- FE/README.md
- _bmad-output/implementation-artifacts/1-8-fe-web-password-recovery-ux.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
