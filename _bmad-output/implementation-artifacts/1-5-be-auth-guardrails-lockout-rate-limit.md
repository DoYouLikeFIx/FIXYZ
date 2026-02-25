# Story 1.5: BE Auth Guardrails (Lockout and Rate Limit)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a security system,
I want login abuse controls,
so that brute-force attempts are mitigated.

## Acceptance Criteria

1. Given repeated failed login attempts by IP, when threshold is exceeded, then login endpoint returns rate-limit error.
2. Given repeated failed login attempts by account, when threshold is exceeded, then account transitions to locked state.
3. Given locked account, when correct password is submitted, then login remains denied until admin unlock.
4. Given lockout event, when recorded, then security event is persisted.

## Tasks / Subtasks

- [ ] Implement IP-based login rate limiting (AC: 1)
  - [ ] Apply bounded threshold and cooldown policy at login boundary
  - [ ] Return consistent rate-limit error contract
- [ ] Implement account-based lockout transition logic (AC: 2)
  - [ ] Increment and evaluate failed-attempt counters
  - [ ] Persist lock state transition with deterministic threshold behavior
- [ ] Enforce locked-account denial regardless of credential correctness (AC: 3)
  - [ ] Ensure auth layer checks lock state before granting session
- [ ] Persist security lockout events for auditability (AC: 4)
  - [ ] Write structured security-event record on lockout and relevant auth abuse conditions
- [ ] Add integration + unit tests for thresholds, cooldown, and lock lifecycle

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.9`); use it only for technical constraints, not story ID mapping.

- Depends on Story 1.1 auth baseline.
- This story is the main security hardening layer for login abuse prevention.
- Outputs are prerequisites for cross-client auth error standardization in Story 1.6.

### Technical Requirements

- Dual guardrails required:
  - IP-based request throttling.
  - Account-based lockout state transition.
- Locked-account denial must be enforced even with correct credentials.
- Security events must be stored separately or with security semantics that support longer retention and investigations.

### Architecture Compliance

- Architecture indicates Bucket4j + Redis-backed rate limiting on selected endpoints.
- Respect global error envelope and security event taxonomy conventions.
- Keep auth guardrails in channel-service boundary and avoid service-layer duplication in clients.

### Library / Framework Requirements

- Latest rate-limit/auth stack snapshot (2026-02-25):
  - Bucket4j jdk17 core: `8.16.1`
  - Spring Security: `7.0.3`
- Guardrail:
  - Use stable Bucket4j line and centralize policies via configuration where possible.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/security/**`
  - `BE/channel-service/src/main/**/auth/**`
  - `BE/channel-service/src/main/**/audit/**` or `security-events/**`
  - `BE/channel-service/src/main/resources/application*.yml`
  - `BE/channel-service/src/test/**`
- Keep abuse-control policies in one place to avoid threshold mismatch.

### Testing Requirements

- Required checks:
  - IP threshold reached -> rate-limit error.
  - Account threshold reached -> locked state transition.
  - Locked account denied even with correct password.
  - Security event persisted on lockout.
  - Counter reset/cooldown policy behaves as designed.

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
  - [ ] IP and account controls validated independently with explicit `N-1` / `N` / `N+1` evidence.
  - [ ] Locked-account denial with correct password proven until explicit admin unlock.
  - [ ] Cooldown/reset behavior evidence attached for both IP rate-limit and account lock states.
  - [ ] Security event persistence evidence attached with correlation key traceability.

- Execution reference:
  - Run Epic 1 focused checklist: `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.

### Previous Story Intelligence

- From Story 1.4 (cross-client parity context):
  - Auth errors emitted here must be client-consumable and stable.
- From Story 1.2:
  - Session semantics already established; this story must harden pre-session auth path, not rework session model.

### Git Intelligence Summary

- Repository cadence shows architecture-led decisions and strict lane boundaries.
- Keep auth hardening changes targeted and config-driven to reduce integration risk.

### Latest Tech Information

- Bucket4j and Spring Security versions refreshed from official metadata sources.
- Avoid beta/preview dependencies for security controls.

### Project Context Reference

- `project-context.md` not found in repository scan.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.5)
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- https://repo1.maven.org/maven2/com/bucket4j/bucket4j_jdk17-core/maven-metadata.xml
- https://repo1.maven.org/maven2/org/springframework/security/spring-security-config/maven-metadata.xml

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated via create-story workflow instructions with Epic 1 artifact synthesis.

### Completion Notes List

- Added lockout/rate-limit dual-control implementation guardrails and test scope.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/1-5-be-auth-guardrails-lockout-rate-limit.md
