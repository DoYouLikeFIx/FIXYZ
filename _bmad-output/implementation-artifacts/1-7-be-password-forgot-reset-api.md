# Story 1.7: BE Password Forgot Reset API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a locked-out or forgetful user,
I want a secure password recovery API,
so that I can regain access without leaking whether my account exists.

## Acceptance Criteria

1. Given `POST /api/v1/auth/password/forgot`, when any normalized username is submitted, then the API always returns the fixed `202 Accepted` recovery envelope and only eligible accounts receive an asynchronously issued reset email.
2. Given `POST /api/v1/auth/password/forgot/challenge`, when challenge bootstrap is requested, then the API returns the fixed `200 OK` challenge contract with signed challenge token, `ttl=300s`, and replay-safe nonce handling.
3. Given `POST /api/v1/auth/password/reset` with a valid reset token and a password different from the current password, when the request succeeds, then password hash update, `password_changed_at` update, and reset-token consume happen atomically and the response is `204 No Content`.
4. Given invalid, expired, consumed, same-password, or rate-limited recovery requests, when the API rejects the operation, then contracted error codes `AUTH-012` through `AUTH-015` and `Retry-After` semantics are returned without revealing account eligibility.
5. Given a successful password reset for a member with active sessions, when the reset transaction commits, then active sessions are invalidated and stale follow-up requests are rejected with `AUTH-016`.

## Tasks / Subtasks

- [ ] Add password recovery endpoints and DTOs under `/api/v1/auth/password/**` (AC: 1, 2, 3, 4)
  - [ ] Introduce forgot, challenge bootstrap, and reset request/response contracts
  - [ ] Keep fixed status/body semantics for anti-enumeration paths
- [ ] Implement password recovery application service with anti-enumeration timing and rate controls (AC: 1, 2, 4)
  - [ ] Normalize username as `NFKC(trim(username)).toLowerCase(Locale.ROOT)`
  - [ ] Apply per-IP, per-username, cooldown, and endpoint-global policies from the channel API addendum
  - [ ] Gate challenge issuance/verification with signed token plus Redis nonce replay protection
- [ ] Introduce reset-token persistence and password-rotation transaction boundary (AC: 3, 4)
  - [ ] Add Flyway migration for `password_reset_tokens` and `members.password_changed_at`
  - [ ] Persist only token hash plus pepper version, never the raw token
  - [ ] Enforce one-active-token-per-member semantics and reissue invalidation
- [ ] Reuse and extend existing session invalidation behavior for reset completion (AC: 5)
  - [ ] Invalidate all active sessions after successful password reset
  - [ ] Add deterministic stale-session denial path for `AUTH-016`
- [ ] Add integration and focused unit coverage for recovery lifecycle, timing guardrails, and session invalidation (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical tracking source for this story is `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-7-be-password-forgot-reset-api`.
- Canonical planning artifact `_bmad-output/planning-artifacts/epics.md` now contains Story 1.7 and serves as the parent planning source for this file.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` was realigned so the old frontend-auth material is labeled as a supplemental reference. Use this file as the source of truth for canonical Story 1.7 implementation details.
- This story extends the Epic 1 auth lane after Story 1.5 and Story 1.6. It must reuse existing auth/session patterns instead of inventing a second recovery or session model.
- Current code already invalidates all sessions on authenticated password change in `MemberService.updateMyPassword(...)`; reuse that session invalidation approach for reset completion rather than creating a new session-revocation mechanism.

### Technical Requirements

- Endpoint contract from channel addendum:
  - `POST /api/v1/auth/password/forgot`
  - `POST /api/v1/auth/password/forgot/challenge`
  - `POST /api/v1/auth/password/reset`
- Fixed recovery semantics:
  - Forgot always returns `202 Accepted` with recovery metadata and no eligibility disclosure.
  - Challenge bootstrap always returns `200 OK` with `challengeToken`, `challengeType`, and `challengeTtlSeconds=300`.
  - Reset success returns `204 No Content`.
- Rate limits from `_bmad-output/planning-artifacts/channels/api-spec.md`:
  - `forgot`: `per-IP 5/min`, `per-username 3/15min`, `mail-cooldown-key(usernameHash) 1/5min`
  - `forgot/challenge`: `per-IP 5/min`, `per-username 3/10min`, `endpoint-global 60/min`
  - `reset`: `per-IP 10/5min`, `per-tokenHash 5/15min`, `endpoint-global 60/min`
- Timing equalization:
  - Forgot path anti-enumeration envelope: floor `400ms`, jitter `0~50ms`, p95 delta between existent/non-existent/challenge paths <= `80ms`
  - Reset token validation: floor `120ms`, jitter `0~20ms` across valid/invalid/expired/consumed paths
- Token persistence contract:
  - Persist HMAC token hash only, never the raw token
  - Store pepper version to support active + previous pepper validation
  - Successful reissue invalidates prior active token
  - Successful reset updates `members.password_changed_at` in the same transaction as password hash update and token consume
- Session/security contract:
  - Non-GET recovery endpoints remain CSRF-protected
  - Successful reset invalidates active sessions; delayed stale-session denial must use `AUTH-016`
  - `AUTH-015` is returned when `newPassword` equals the current password

### Architecture Compliance

- Keep the implementation inside the existing channel auth lane:
  - `AuthController` remains the external HTTP boundary
  - service orchestration stays in `BE/channel-service`
  - persistent auth entities remain in `BE/channel-domain`
- Reuse existing patterns already present in code:
  - `PasswordEncoder` from `ChannelSecurityConfig`
  - session invalidation via `FindByIndexNameSessionRepository`
  - audit/security event conventions from `AuditLog` and `SecurityEvent`
  - Flyway migration numbering and `db/migration` layout
- Do not weaken global security baselines just because these endpoints are public:
  - keep CSRF enforcement
  - keep standardized error envelope
  - keep correlation-id propagation and user-facing `traceId`
- Resolve the documented implementation drifts explicitly before coding:
  - Request binding drift: current auth endpoints use `@ModelAttribute`, while password recovery addenda are documented as JSON bodies
  - Identity drift: recovery table specs use `member_uuid`, while current entity/migration baseline exposes `members.id` and `member_no`
- Guardrail:
  - Do not partially "fix" one of the drifts for this story alone. Choose a canonical implementation path and update controller, tests, API docs, and client expectations together.

### Library / Framework Requirements

- Repository baseline already in use:
  - Spring Boot `3.4.13`
  - dependency-management plugin `1.1.7`
  - springdoc OpenAPI plugin `1.9.0`
  - `org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.15`
  - Testcontainers `2.0.3`
  - WireMock `3.13.2`
- Auth/session stack already available in `BE/channel-service/build.gradle`:
  - `spring-boot-starter-security`
  - `spring-session-data-redis`
  - `spring-boot-starter-data-jpa`
  - `flyway-core`
- If password recovery email is delivered in-process:
  - prefer `spring-boot-starter-mail` under the Spring Boot BOM
  - do not pin `jakarta.mail` or `angus-mail` manually
  - do not introduce a second auth framework or token platform
- Guardrail:
  - this story is not a stack-upgrade story; stay on the repo baseline and avoid ad-hoc major-version upgrades.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/service/AuthService.java` or a new recovery-focused service under the same package
  - `BE/channel-service/src/main/java/com/fix/channel/dto/request/**`
  - `BE/channel-service/src/main/java/com/fix/channel/dto/response/**`
  - `BE/channel-service/src/main/java/com/fix/channel/repository/**`
  - `BE/channel-domain/src/main/java/com/fix/channel/entity/**`
  - `BE/core-common/src/main/java/com/fix/common/error/ErrorCode.java`
  - `BE/channel-service/src/main/resources/application*.yml`
  - `BE/channel-service/src/main/resources/db/migration/V6__*.sql` (or the next available version if a newer migration is added first)
  - `BE/channel-service/src/test/java/com/fix/channel/integration/**`
- Recommended additions:
  - `PasswordResetToken` entity in `BE/channel-domain`
  - dedicated repository for reset-token lookup and lifecycle
  - dedicated recovery service rather than overloading unrelated member/profile logic
  - focused integration test class such as `ChannelPasswordRecoveryIntegrationTest`
- Reuse before adding new files:
  - reuse `MemberRepository.findByEmailForUpdate(...)` locking pattern if email remains the recovery identity
  - reuse session invalidation logic already implemented for password change
  - reuse existing auth error envelope and audit-log conventions

### Testing Requirements

- Required backend checks:
  - same `forgot` response body and status for existent vs non-existent accounts
  - challenge bootstrap returns fixed contract and rejects replayed/expired challenge nonce
  - valid reset rotates password, consumes token, updates `password_changed_at`, and invalidates sessions
  - invalid, expired, and consumed token paths map to `AUTH-012` or `AUTH-013` deterministically
  - same-password reset attempt returns `AUTH-015`
  - rate-limited forgot/challenge/reset paths return `429` with `Retry-After`
  - missing/invalid CSRF token still fails for all non-GET recovery endpoints
- Test infrastructure expectations:
  - prefer `ChannelContainersIntegrationTestBase` for MySQL + Redis-backed integration coverage
  - add narrow unit tests for timing equalization helpers and token-hash validation branches
  - if email dispatch is asynchronous, isolate transport with stub/fake sender rather than real SMTP
- Regression checks:
  - existing login/logout/session flows must continue to pass
  - authenticated password change behavior in `MemberService` must not regress
  - no raw reset token may appear in DB assertions, logs, or serialized error bodies

### Quinn Reinforcement Checks

- Numbering conflict gate:
  - Reject implementation start if any source uses the legacy frontend-auth supplemental reference in `epic-1-user-authentication-and-account-access.md` as the requirements source for this file.
  - `story_key`, filename, and sprint-status key must remain `1-7-be-password-forgot-reset-api`.
- Contract drift gate:
  - Decide once whether recovery endpoints use JSON (`@RequestBody`) or current auth-style binding (`@ModelAttribute`).
  - Update controller tests, API docs, and FE/MOB expectations together; no mixed contract per recovery endpoint.
- Identity key gate:
  - Before writing the migration, resolve whether token ownership uses `members.id`, `member_no`, or a newly introduced `member_uuid`.
  - Migration, entity, repository, and SQL snippets must all use the same identity key with no dual-key ambiguity.
- Anti-enumeration gate:
  - Compare existent/non-existent/challenge-gated forgot flows for status/body equivalence and bounded timing delta.
  - Ensure logging/audit output also avoids leaking account eligibility.
- Token lifecycle gate:
  - Reissue invalidates previous active token.
  - Raw token is never persisted.
  - `valid`, `invalid`, `expired`, and `consumed` reset paths respect equalized timing.
- Session invalidation gate:
  - Successful reset invalidates all existing sessions for the member.
  - First stale follow-up call after reset must fail with the contracted `AUTH-016` path, not a generic auth error.
- Quality risk severity gate:
  - Any P0/P1 defect in anti-enumeration, token lifecycle, or session invalidation blocks status transition to `review`.
  - Any accepted P2 defect must include issue ID, owner, and due date in QA evidence.
- Evidence gate for review handoff:
  - Attach integration evidence for forgot/challenge/reset happy path and negative path matrix.
  - Attach one DB evidence sample proving hash-only persistence.
  - Attach one session invalidation trace showing pre-reset session becomes stale after reset.

### Previous Story Intelligence

- From Story 1.6:
  - Password recovery mapping addendum already defines `AUTH-012` through `AUTH-016`.
  - FE/MOB contract expects one CSRF refresh and one retry only on CSRF `403` for forgot/challenge/reset submits.
- From Story 1.5:
  - Reuse the existing rate-limit and boundary-test mindset (`N-1`, `N`, `N+1`) for recovery endpoints.
  - Security-sensitive auth behavior must produce deterministic audit/security evidence.
- From current codebase:
  - `MemberService.updateMyPassword(...)` already invalidates all member sessions and clears the current security context.
  - `AuthService.login(...)` already uses the principal index for single-session cleanup, so session repository access patterns are established.

### Git Intelligence Summary

- Recent commit `afbb268` added the password recovery planning addenda and sprint-status entry but did not create the canonical story file.
- Current repository cadence is documentation-first and lane-specific. Keep Story 1.7 scoped to channel auth/password recovery and avoid coupling it to unrelated observability work from the same commit.
- Existing Epic 1 story files consistently include explicit guardrails, regression gates, and source references. Maintain that level of specificity here.

### Latest Tech Information

- Repository baseline versions were refreshed from local build files:
  - Spring Boot `3.4.13`
  - Testcontainers `2.0.3`
  - WireMock `3.13.2`
  - springdoc starter `2.8.15`
- Implementation guidance:
  - Use the Spring Boot-managed auth/session stack already present in this repo.
  - If email transport is added, stay within the Spring Boot BOM and official starter path rather than introducing direct mail-library pinning.

### Project Context Reference

- `project-context.md` not found in repository scan.
- Context derived from planning artifacts, current channel-service implementation, and sprint tracking.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story artifact backfilled to match existing sprint-status tracking with comprehensive password recovery guardrails.

### References

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/login_flow.md`
- `_bmad-output/planning-artifacts/channels/primary_query.md`
- `_bmad-output/planning-artifacts/channels/status_machine.md`
- `_bmad-output/planning-artifacts/channels/db_schema.md`
- `_bmad-output/planning-artifacts/channels/erd.md`
- `_bmad-output/planning-artifacts/channels/table_spec.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `BE/build.gradle`
- `BE/channel-service/build.gradle`
- `BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/AuthService.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/MemberService.java`
- `BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityConfig.java`
- `BE/channel-service/src/main/java/com/fix/channel/config/ChannelSessionConfig.java`
- `BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthFlowTest.java`
- `BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthGuardrailsIntegrationTest.java`
- https://repo1.maven.org/maven2/org/springframework/boot/spring-boot/maven-metadata.xml
- https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-mail/maven-metadata.xml

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated via `bmad-bmm-create-story` workflow interpretation with password recovery addendum synthesis.

### Completion Notes List

- Backfilled missing Story 1.7 artifact from sprint-status and channel password recovery addenda.
- Added explicit guardrails for numbering conflict, request-contract drift, identity-key drift, and session invalidation reuse.

### File List

- C:/Users/SSAFY/FIXYZ/_bmad-output/implementation-artifacts/1-7-be-password-forgot-reset-api.md
