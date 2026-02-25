# Story 1.4: MOB Mobile Auth Flow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want native auth flow parity with web,
so that account access rules stay consistent across clients.

## Acceptance Criteria

1. Given mobile login/register screens, when valid form is submitted, then user enters authenticated app stack.
2. Given invalid or expired session, when protected API is called, then mobile routes user to re-auth flow.
3. Given auth API validation error, when response is returned, then field-level or global message is shown.
4. Given device app resume, when session state is checked, then stale sessions are rejected deterministically.

## Tasks / Subtasks

- [ ] Implement mobile login/register flow parity with web contract (AC: 1)
  - [ ] Wire auth endpoints and navigation stack transitions
- [ ] Implement protected-route/session invalidation handling (AC: 2)
  - [ ] On auth-required response, route to re-auth flow deterministically
- [ ] Implement standardized mobile auth error UX (AC: 3)
  - [ ] Support field-level and global error surfaces by code type
- [ ] Implement app-resume session check behavior (AC: 4)
  - [ ] Revalidate session/auth state on resume and clear stale auth state
- [ ] Add mobile tests for auth stack transitions and stale-session handling

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.9`); use it only for technical constraints, not story ID mapping.

- Depends on Story 1.1, 1.2, and 0.4 mobile scaffold.
- Objective is parity with web auth semantics, not identical UI implementation.
- Keep mobile-specific lifecycle handling (background/resume) explicit.

### Technical Requirements

- Session semantics must mirror server-auth model used by web.
- Re-auth flow must be deterministic for expired/invalid sessions.
- Mobile auth state should survive app lifecycle safely while honoring server invalidation.
- Error handling must align with shared backend auth code semantics.

### Architecture Compliance

- Use centralized mobile network/auth layers from foundation scaffold.
- Keep secure storage and token/session handling policy compliant with mobile security baseline.
- Avoid custom auth branches that diverge from FE semantics unless required by platform lifecycle.

### Library / Framework Requirements

- Latest mobile ecosystem snapshot (2026-02-25):
  - `react-native`: `0.84.0`
  - `react`: `19.2.4`
- Guardrail:
  - Keep React/RN compatibility aligned with selected RN release.

### File Structure Requirements

- Expected touched areas:
  - `MOB/src/screens/auth/**`
  - `MOB/src/navigation/**`
  - `MOB/src/network/**`
  - `MOB/src/store/**`
  - `MOB/src/security/**`
- Avoid duplicating auth/session checks in multiple screen components.

### Testing Requirements

- Required checks:
  - Login/register success transitions into authenticated app stack.
  - Expired/invalid session routes to re-auth.
  - Auth validation errors map to expected field/global messages.
  - App resume revalidates stale auth state reliably.

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
  - [ ] App resume/background revalidation evidence attached for deterministic stale-session rejection.
  - [ ] Re-auth navigation evidence attached (no loop/back-stack corruption on auth-required response).
  - [ ] Field/global auth error rendering evidence attached and aligned with backend code semantics.
  - [ ] MOB behavior parity evidence recorded against FE baseline session matrix.

- Execution reference:
  - Run Epic 1 focused checklist: `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.

### Previous Story Intelligence

- From Story 1.3:
  - Preserve cross-client semantics for auth error and session expiry handling.
  - Keep differences limited to platform lifecycle and navigation mechanics.

### Git Intelligence Summary

- MOB lane is recently integrated as submodule.
- Keep changes narrowly scoped and avoid cross-repo pattern drift.

### Latest Tech Information

- RN/React versions refreshed via npm metadata.
- Use stable, compatible versions for auth foundation work.

### Project Context Reference

- `project-context.md` not found in repository scan.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- https://registry.npmjs.org/react-native
- https://registry.npmjs.org/react

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated via create-story workflow instructions with Epic 1 artifact synthesis.

### Completion Notes List

- Added lifecycle/session revalidation guardrails specific to mobile.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/1-4-mob-mobile-auth-flow.md
