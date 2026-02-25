# Story 1.3: FE Web Auth Flow

Status: ready-for-dev

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

- [ ] Implement login/register screens and submission flow (AC: 1)
  - [ ] Integrate with auth APIs using shared client
  - [ ] Persist authenticated member state via approved global store pattern
- [ ] Implement private-route guard and navigation rules (AC: 2)
  - [ ] Redirect unauthenticated users to `/login`
  - [ ] Preserve predictable post-auth navigation behavior
- [ ] Implement standardized auth error UX (AC: 3)
  - [ ] Map backend auth error codes to user-facing messages
  - [ ] Prevent duplicate/conflicting error surfaces
- [ ] Implement session-expiry event handling and re-auth guidance (AC: 4)
  - [ ] Handle SSE/session expiry warning and 401 fallback paths
  - [ ] Ensure cleanup/reconnect strategy for event stream
- [ ] Add FE tests for route guard + auth error + expiry guidance (AC: 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.9`); use it only for technical constraints, not story ID mapping.

- Depends on Story 1.1 + 1.2 + 0.3.
- Focus is auth UX flow and guarded navigation, not transfer UX.
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
  - [ ] Private-route redirect loop prevention evidence attached (no infinite redirect/retry behavior).
  - [ ] Auth error mapping evidence attached showing single consistent UX surface per backend code.
  - [ ] Session-expiry event + 401 fallback evidence attached with deterministic re-auth guidance.
  - [ ] FE behavior parity evidence recorded against shared Epic 1 session behavior matrix.

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

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

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

- Generated via create-story workflow instructions with Epic 1 artifact synthesis.

### Completion Notes List

- Added explicit FE auth-state and route-guard guardrails for implementation.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/1-3-fe-web-auth-flow.md
