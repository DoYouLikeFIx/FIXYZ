# Story 1.1: BE Registration and Login Session

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new or returning user,
I want to register and log in with secure session issuance,
so that I can access protected features safely.

## Acceptance Criteria

1. Given valid registration payload, when sign-up is requested, then member is created with default role and secure password hash.
2. Given valid login credentials, when authentication succeeds, then Redis-backed session cookie is issued with secure attributes.
3. Given duplicate login from the same account, when a second session is established, then previous session is invalidated by policy.
4. Given invalid credentials, when login fails, then normalized authentication error is returned.

## Tasks / Subtasks

- [ ] Implement registration endpoint and member creation policy (AC: 1)
  - [ ] Enforce role defaulting and password hashing policy
  - [ ] Return normalized success contract for register result
- [ ] Implement login endpoint with Spring Session Redis issuance (AC: 2)
  - [ ] Issue `JSESSIONID` with secure cookie attributes
  - [ ] Store and refresh authenticated session state in Redis
- [ ] Enforce single active session policy per account (AC: 3)
  - [ ] Expire prior active session on re-login
  - [ ] Return deterministic behavior for old/new session usage
- [ ] Normalize authentication error responses (AC: 4)
  - [ ] Unify invalid credentials/non-existent account response semantics
  - [ ] Ensure consistent global error envelope
- [ ] Add integration coverage for register/login/session baseline (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.9`); use it only for technical constraints, not story ID mapping.

- Epic 1 foundation story for all subsequent auth stories.
- Canonical tracking for this planning set is `epics.md` Story 1.1.
- Additional detailed artifact exists (`epic-1-user-authentication-and-account-access.md`) and should be treated as supplemental constraints, not replacement of current story numbering.

### Technical Requirements

- Session model:
  - Spring Session Redis with sliding TTL semantics.
  - Secure cookie attributes (`HttpOnly`, `Secure`, `SameSite`) must follow profile policy.
- Auth policy:
  - Strong password hashing (BCrypt, architecture baseline indicates cost-hardening path).
  - Login failure responses must avoid account enumeration leaks.
- Session invalidation:
  - New login should invalidate prior session per account policy.

### Architecture Compliance

- Keep auth/session handling in channel service auth/security layers.
- Preserve standardized error envelope and correlation-id propagation patterns.
- Use architecture-defined Redis key and session conventions; do not reintroduce JWT refresh token flows (deprecated in architecture decisions).

### Library / Framework Requirements

- Latest auth-related ecosystem snapshot (2026-02-25):
  - Spring Security config: `7.0.3`
  - Spring Session Redis: `4.0.2`
  - Spring Boot latest in architecture line: `3.4.13`
- Guardrail:
  - Follow architecture-pinned Spring Boot/Security compatibility matrix for foundation story.
  - Avoid major auth model changes in this story.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/auth/**`
  - `BE/channel-service/src/main/**/security/**`
  - `BE/channel-service/src/main/resources/application*.yml`
  - `BE/channel-service/src/test/**`
  - `BE/core-common/**` (only if shared error/auth constants required)
- Keep member/account domain ownership boundaries consistent with existing architecture.

### Testing Requirements

- Required checks:
  - Register success, duplicate registration, validation failures.
  - Login success with secure session cookie issuance.
  - Invalid credentials return normalized auth error.
  - Re-login invalidates previous session deterministically.
  - Integration test runs against real Redis + MySQL containers.

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
  - [ ] Scope alignment confirmed: lockout/rate-limit policy implementation is owned by Story 1.5; Story 1.1 only guarantees auth/session baseline compatibility.
  - [ ] Redis+MySQL integration evidence attached for register/login/session issuance path (including secure cookie attributes).
  - [ ] Duplicate-login invalidation evidence attached showing deterministic old-session denial and new-session success.
  - [ ] Invalid-credential normalization evidence attached with non-enumerating auth error semantics.

- Execution reference:
  - Run Epic 1 focused checklist: `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.

### Latest Tech Information

- Version references refreshed:
  - Spring Security `7.0.3`, Spring Session Data Redis `4.0.2`, Spring Boot `3.4.13` patch line.
- Implementation guidance:
  - Keep story implementation aligned with architecture-pinned stack and stable releases.

### Project Context Reference

- `project-context.md` not found in repository scan.
- Context derived from planning/architecture/implementation artifacts.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.1)
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- https://repo1.maven.org/maven2/org/springframework/security/spring-security-config/maven-metadata.xml
- https://repo1.maven.org/maven2/org/springframework/session/spring-session-data-redis/maven-metadata.xml
- https://repo1.maven.org/maven2/org/springframework/boot/spring-boot/maven-metadata.xml

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated via create-story workflow instructions with Epic 1 artifact synthesis.

### Completion Notes List

- Added session/security guardrails and deprecated-pattern exclusions.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/1-1-be-registration-login-session.md
