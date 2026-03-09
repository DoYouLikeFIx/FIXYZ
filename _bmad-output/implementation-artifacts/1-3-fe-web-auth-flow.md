# Story 1.3: FE Web Auth Flow

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want intuitive login/register/private navigation,
so that authenticated routes behave predictably.

## Acceptance Criteria

1. Given login and register screens, when valid credentials are submitted, then user is navigated to protected area.
2. Given unauthenticated access to private route, when route guard runs, then user is redirected to login.
3. Given server-auth error, when response arrives, then standardized UX error message is shown.
4. Given session expiration notification event, when web receives it, then user sees re-auth guidance.

## Tasks / Subtasks

- [x] Implement login/register screens and submission flow (AC: 1)
  - [x] Integrate with auth APIs using shared client
  - [x] Persist authenticated member state via approved global store pattern
- [x] Implement private-route guard and navigation rules (AC: 2)
  - [x] Redirect unauthenticated users to `/login`
  - [x] Preserve predictable post-auth navigation behavior
- [x] Implement standardized auth error UX (AC: 3)
  - [x] Map backend auth error codes to user-facing messages
  - [x] Prevent duplicate/conflicting error surfaces
- [x] Implement session-expiry event handling and re-auth guidance (AC: 4)
  - [x] Handle SSE/session expiry warning and 401 fallback paths
  - [x] Ensure cleanup/reconnect strategy for event stream
- [x] Add FE tests for route guard + auth error + expiry guidance (AC: 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.9`); use it only for technical constraints, not story ID mapping.

- Depends on Story 1.1 + 1.2 + 0.3.
- Focus is auth UX flow and guarded navigation, not order UX.
- Standardization across FE and MOB begins here and is completed in Story 1.6.

### Technical Requirements

- Route protection:
  - Private routes must block unauthenticated access deterministically.
- Auth state:
  - Use architecture-approved global auth state pattern (Zustand-based flow indicated in architecture artifact).
- Error UX:
  - Use consistent auth error mapping and user guidance.
- Session expiry:
  - Support expiry warning and re-auth route behavior with resilient fallback.

### Architecture Compliance

- Keep FE auth behavior aligned with server session-cookie model.
- Do not rely on reading HttpOnly cookie directly in browser JS.
- Follow architecture notes on centralized interceptor and auth store responsibilities.

### Library / Framework Requirements

- Latest FE auth ecosystem snapshot (2026-02-25):
  - `react-router-dom`: `7.13.1`
  - `zustand`: `5.0.11`
  - `react`: `19.2.4`
- Guardrail:
  - Preserve compatibility with existing FE scaffold and current lane package strategy.

### File Structure Requirements

- Expected touched areas:
  - `FE/src/pages/Login*`
  - `FE/src/pages/Register*`
  - `FE/src/router/**` or `FE/src/App.*`
  - `FE/src/components/PrivateRoute*`
  - `FE/src/store/useAuthStore*`
  - `FE/src/lib/axios*`
  - `FE/src/test/**` or equivalent
- Keep auth flow logic centralized; avoid per-page duplicated guard logic.

### Testing Requirements

- Required checks:
  - Valid login/register flow navigates correctly.
  - Unauthenticated private-route access redirects to login.
  - Auth errors render standardized UX messages.
  - Session-expiry warning/401 behavior triggers re-auth guidance.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify 'story_key ↔ filename ↔ sprint-status key' are identical before moving status from 'ready-for-dev' to 'in-progress'.
  - Reject implementation start if key mismatch is detected between canonical Epic 1 numbering (`epics.md`) and supplemental Epic artifact.
- FE/MOB session consistency gate:
  - Validate same behavior matrix for FE and MOB on: valid session, expired session, invalidated-by-new-login, logout-after-call, app/browser resume.
  - Validate same user-facing semantics for re-auth guidance and fallback handling (401 + session-expiry event paths).
- Lockout/rate-limit boundary gate:
  - Add boundary tests for `N-1`, `N`, `N+1` attempts (IP limit and account lockout separately).
  - Validate cooldown/reset behavior and ensure locked account remains denied even with correct credentials until admin unlock.
  - Validate security event persistence on lockout with correlation key for traceability.
- Quality risk severity gate:
  - Any P0/P1 defect in auth/session/security behavior blocks status transition to `review`.
  - Any accepted P2 defect must include issue ID, owner, and due date in QA evidence.
- Evidence gate for review handoff:
  - Attach automated test evidence for this story and impacted Epic 1 regression scenarios.
  - Attach negative-path replay result for `N-1`, `N`, `N+1` boundaries and session expiry paths.
  - Attach one correlation sample linking client-visible error to server-side security event/log.
- Party review resolution status (2026-02-25):
  - [x] Private-route redirect loop prevention evidence attached (no infinite redirect/retry behavior).
  - [x] Auth error mapping evidence attached showing single consistent UX surface per backend code.
  - [x] Session-expiry event + 401 fallback evidence attached with deterministic re-auth guidance.
  - [x] FE behavior parity evidence recorded against shared Epic 1 session behavior matrix.

- Execution reference:
  - Run Epic 1 focused checklist: `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.

### Previous Story Intelligence

- From Story 1.2:
  - Logout and expiry semantics are server-authoritative.
  - FE must consume these states, not reinterpret them with custom client-only policies.

### Git Intelligence Summary

- FE lane is submodule-based and recently scaffolded.
- Keep auth-flow changes local to FE lane and avoid BE/MOB coupling in this story.

### Latest Tech Information

- FE auth stack versions refreshed via npm dist-tags.
- No unstable package line required for this story.

### Project Context Reference

- `project-context.md` not found in repository scan.

### Story Completion Status

- Status moved to `review`.
- Completion note: FE auth flow implementation completed and QA automation evidence attached for Story 1.3 review handoff.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.3)
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- https://registry.npmjs.org/react-router-dom
- https://registry.npmjs.org/zustand
- https://registry.npmjs.org/react

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `pnpm test`
- `npm test`
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`

### Completion Notes List

- Implemented BrowserRouter auth flow with login/register pages, protected `/portfolio` routing, redirect preservation, and Zustand-backed member session state.
- Added shared auth client support for CSRF bootstrap/retry handling, centralized auth error mapping, and interceptor-based re-auth state handling for session-cookie flows.
- Added session-expiry EventSource warning UI with keep-alive refresh, deterministic login redirect fallback, and reconnect-safe stream cleanup behavior.
- Added FE unit and integration coverage for login/register success, private-route redirects, standardized auth errors, and session-expiry guidance/fallback behavior.
- QA pass added auth service contract coverage for session fetch, CSRF refresh, and register-side token reset.
- QA pass attached Story 1.3 automation evidence and published `_bmad-output/implementation-artifacts/tests/test-summary.md`.
- QA follow-up pass recorded FE/MOB parity and Story 1.5 ownership in `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.
- QA follow-up pass added FE traceId/auth-guardrail contract assertions and MOB auth-code preservation coverage.

### File List

- FE/package.json
- FE/pnpm-lock.yaml
- FE/tests/integration/App.test.tsx
- FE/src/App.tsx
- FE/src/components/auth/AuthFrame.tsx
- FE/src/components/layout/ProtectedLayout.tsx
- FE/src/hooks/useAuth.ts
- FE/src/hooks/useSessionExpiry.ts
- FE/src/index.css
- FE/tests/unit/lib/axios.test.ts
- FE/tests/unit/lib/auth-errors.test.ts
- FE/src/lib/auth-errors.ts
- FE/tests/unit/api/authApi.test.ts
- FE/src/lib/auth.ts
- FE/src/lib/axios.ts
- FE/src/pages/LoginPage.tsx
- FE/src/pages/PortfolioPage.tsx
- FE/src/pages/RegisterPage.tsx
- FE/src/router/AppRouter.tsx
- FE/src/router/PrivateRoute.tsx
- FE/src/router/PublicOnlyRoute.tsx
- FE/src/router/navigation.ts
- FE/tests/unit/store/useAuthStore.test.ts
- FE/src/store/useAuthStore.ts
- FE/src/types/api.ts
- FE/src/types/auth.ts
- MOB/tests/unit/network/errors.test.ts
- _bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md
- _bmad-output/implementation-artifacts/tests/test-summary.md

## Change Log

- 2026-03-07: Implemented FE auth flow, protected routing, CSRF/session handling, and validation coverage for Story 1.3; story moved to `review`.
- 2026-03-07: QA automation pass added redirect-loop, auth-error, session-expiry reconnect, and auth service coverage; published Story 1.3 test summary.
- 2026-03-07: Epic 1 QA reinforcement checklist created; FE/MOB parity matrix and Story 1.5 lockout/correlation ownership linked for Story 1.3 review handoff.
- 2026-03-08: FE auth UI refinement regression pass revalidated inline login/register errors, independent password toggles, clickable register submit validation path, and localized 403 refresh copy.
- 2026-03-08: FE QA rerun revalidated restored auth-gated `/portfolio` access and protected portfolio interaction after preview rollback.

## QA Results

### Reviewer

- Codex (QA automation), 2026-03-08

### Gate Decision

- PASS (Story 1.3 FE scope revalidated after auth UI refinements and restored auth-gated protected portfolio flow; shared Epic 1 reinforcement evidence remains linked)

### Acceptance Criteria Validation

1. AC1 (login/register success routes to protected area): PASS
   - Evidence: successful login, post-register login, preserved redirect-target coverage, and protected portfolio interaction regression coverage in `FE/tests/integration/App.test.tsx`; auth service request flow in `FE/tests/unit/api/authApi.test.ts`
2. AC2 (private-route guard redirects anonymous users): PASS
   - Evidence: anonymous `/portfolio` access redirects to `/login`, and authenticated auth-page redirect loops are sanitized in `FE/tests/integration/App.test.tsx`
3. AC3 (standardized auth error UX): PASS
   - Evidence: canonical backend error-code mapping in `FE/tests/unit/lib/auth-errors.test.ts`, localized forbidden-refresh guidance in `FE/tests/unit/lib/axios.test.ts`, and single inline login/register error surface coverage in `FE/tests/integration/App.test.tsx`
4. AC4 (session-expiry warning + re-auth guidance): PASS
   - Evidence: warning banner display, extend-session success, re-auth fallback, EventSource reconnect, and reconnect cleanup coverage in `FE/tests/integration/App.test.tsx`

### Executed Verification

- `cd FE && pnpm test -- --run` -> PASS (8 files, 40 tests)
- `cd FE && pnpm build` -> PASS
- `cd FE && pnpm type-check` -> PASS
- `cd FE && pnpm lint` -> PASS
- Shared MOB parity evidence remains the 2026-03-07 `cd MOB && npm test` pass (8 files, 27 tests); no MOB code changed in this rerun

### Shared Evidence References

- Shared Epic 1 FE/MOB session behavior matrix is recorded in `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.
- Story `1.5` ownership for lockout `N-1` / `N` / `N+1`, cooldown/reset, and security-event persistence is linked explicitly in the shared checklist.
- Correlation contract sample linking FE-visible auth copy to backend code + `traceId` capture is recorded in the shared checklist with Story `1.5` and Epic `8.x` ownership references.
- This rerun adds FE evidence for inline validation messaging, independent register password toggles, localized 403 refresh guidance, and restored protected portfolio interaction without changing the prior FE/MOB parity ownership map.
