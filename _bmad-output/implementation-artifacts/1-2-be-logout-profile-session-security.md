# Story 1.2: BE Logout, Profile, and Session Security

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want to manage profile and logout safely,
so that account access remains under my control.

## Acceptance Criteria

1. Given valid authenticated session, when logout API is called, then session is deleted server-side and cookie is expired.
2. Given profile/password update request, when validation passes, then account profile is updated with audit trail.
3. Given expired or invalidated session, when protected endpoint is called, then API returns authentication-required error.
4. Given session timeout policy, when inactivity exceeds threshold, then session is treated as expired.

## Tasks / Subtasks

- [ ] Implement explicit logout endpoint and session invalidation (AC: 1)
  - [ ] Invalidate server session and expire cookie immediately
  - [ ] Ensure subsequent request with old cookie is rejected
- [ ] Implement profile read/update and password update flow (AC: 2)
  - [ ] Apply validation and secure password-change flow
  - [ ] Persist audit trail entries for profile/security updates
- [ ] Enforce protected-route auth error normalization (AC: 3)
  - [ ] Ensure 401 behavior is deterministic for invalidated/expired sessions
- [ ] Enforce session timeout handling path (AC: 4)
  - [ ] Validate TTL-based expiry path and client-visible behavior contract
- [ ] Add integration tests for logout/profile/session expiry behavior (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.9`); use it only for technical constraints, not story ID mapping.

- Depends on Story 1.1 auth/session issuance.
- This story owns account-control safety behavior (logout + profile/password + expiry semantics).
- Supplemental detailed artifact maps similar concerns under different split; keep this plan’s Story 1.2 numbering as source of truth.

### Technical Requirements

- Session invalidation must be immediate and observable on next protected request.
- Profile/password mutations require audit logging and validation guardrails.
- Session expiry behavior must align with security requirements and predictable UX redirect paths.
- Error responses must preserve standardized global format.

### Architecture Compliance

- Keep auth/session logic within channel-service security/auth modules.
- Respect Spring Session Redis semantics; do not implement token blacklist patterns that architecture has already deprecated.
- Keep CSRF/session hardening aligned with architecture and login-flow decisions.

### Library / Framework Requirements

- Latest references (2026-02-25):
  - Spring Security: `7.0.3`
  - Spring Session Redis: `4.0.2`
- Guardrail:
  - Maintain compatibility with architecture-pinned Spring Boot 3.4.x track.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/auth/**`
  - `BE/channel-service/src/main/**/member/**`
  - `BE/channel-service/src/main/**/security/**`
  - `BE/channel-service/src/main/**/audit/**`
  - `BE/channel-service/src/test/**`
- Keep audit/event schema interactions consistent with existing event models.

### Testing Requirements

- Required checks:
  - Logout invalidates session immediately and expires cookie.
  - Protected API with old/expired session yields auth-required error.
  - Profile/password update validation and success/failure cases.
  - Audit record assertions for privileged security mutations.

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
  - [ ] Logout invalidation is atomic (server session delete + cookie expiry) and evidenced in one flow.
  - [ ] Old cookie replay after logout/expiry returns deterministic auth-required contract (401 path evidence attached).
  - [ ] Profile/password update validation evidence attached with required audit-trail persistence proof.
  - [ ] Session timeout path evidence attached for inactivity-expired behavior on protected endpoints.

- Execution reference:
  - Run Epic 1 focused checklist: `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.

### Previous Story Intelligence

- From Story 1.1:
  - Reuse existing auth/session primitives; do not duplicate login/session logic.
  - Preserve one-session policy semantics when implementing invalidation paths.

### Git Intelligence Summary

- Recent repository history is artifact-first and module-structure-heavy.
- Keep changes isolated and traceable to auth/session security behavior to avoid cross-lane churn.

### Latest Tech Information

- Auth/session version refresh included from official metadata.
- No prerelease adoption recommended for this story.

### Project Context Reference

- `project-context.md` not found in repository scan.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.2)
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- https://repo1.maven.org/maven2/org/springframework/security/spring-security-config/maven-metadata.xml
- https://repo1.maven.org/maven2/org/springframework/session/spring-session-data-redis/maven-metadata.xml

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated via create-story workflow instructions with Epic 1 artifact synthesis.

### Completion Notes List

- Added previous-story intelligence and session-expiry security guardrails.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/1-2-be-logout-profile-session-security.md
