# Story 1.7: BE Password Forgot Reset API

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a locked-out or forgetful user,
I want a secure password recovery API,
so that I can regain access without leaking whether my account exists.

## Acceptance Criteria

1. Given `POST /api/v1/auth/password/forgot`, when any normalized email is submitted and the request is not rejected by CSRF or rate limiting, then the API returns the fixed `202 Accepted` recovery envelope with no eligibility disclosure, and only existing member accounts are allowed to receive an asynchronously issued reset email under the canonical recovery policy.
2. Given `POST /api/v1/auth/password/forgot/challenge`, when challenge bootstrap is requested and the request is not rejected by CSRF or rate limiting, then the API returns the fixed `200 OK` challenge contract with signed challenge token, `ttl=300s`, and replay-safe nonce handling.
3. Given `POST /api/v1/auth/password/reset` with a valid reset token and a password different from the current password, when the request succeeds, then password hash update, `password_changed_at` update, and reset-token consume happen atomically and the response is `204 No Content`.
4. Given invalid, expired, consumed, same-password, or rate-limited recovery requests, when the API rejects the operation, then the canonical mapping is enforced: `AUTH-012` for invalid or expired reset token, `AUTH-013` for consumed reset token, `AUTH-014` for forgot/challenge/reset rate-limit rejection with `Retry-After`, and `AUTH-015` for same-password reset attempts.
5. Given a successful password reset for a member with active sessions, when the reset transaction commits, then active sessions are invalidated and the first subsequent authenticated `GET /api/v1/auth/session` request made with the pre-reset session is rejected with `401 AUTH-016`.
6. Given missing or invalid CSRF tokens on `POST /api/v1/auth/password/forgot`, `/forgot/challenge`, or `/reset`, when the request is submitted, then Spring Security rejects it with raw `403 Forbidden` before the application error envelope is applied.

## Tasks / Subtasks

- [x] Add password recovery endpoints and DTOs under `/api/v1/auth/password/**` (AC: 1, 2, 3, 4, 6)
  - [x] Introduce forgot, challenge bootstrap, and reset request/response contracts
  - [x] Keep fixed status/body semantics for anti-enumeration paths
- [x] Implement password recovery application service with anti-enumeration timing and rate controls (AC: 1, 2, 4)
  - [x] Normalize email as `NFKC(trim(email)).toLowerCase(Locale.ROOT)`
  - [x] Apply per-IP, per-email, cooldown, and endpoint-global policies from the channel API addendum
  - [x] Gate challenge issuance/verification with signed token plus Redis nonce replay protection
- [x] Introduce reset-token persistence and password-rotation transaction boundary (AC: 3, 4)
  - [x] Add Flyway migration for `password_reset_tokens` and `members.password_changed_at`
  - [x] Persist only token hash plus pepper version, never the raw token
  - [x] Enforce one-active-token-per-member semantics and reissue invalidation
- [x] Reuse and extend existing session invalidation behavior for reset completion (AC: 5)
  - [x] Invalidate all active sessions after successful password reset
  - [x] Add deterministic stale-session denial path for `AUTH-016`
- [x] Add integration and focused unit coverage for recovery lifecycle, timing guardrails, and session invalidation (AC: 1, 2, 3, 4, 5, 6)

## Dev Notes

### Developer Context Section

- Canonical tracking source for this story is `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-7-be-password-forgot-reset-api`.
- Canonical planning precedence for this story is: `_bmad-output/planning-artifacts/channels/api-spec.md` -> `_bmad-output/planning-artifacts/epics.md` -> `_bmad-output/planning-artifacts/channels/login_flow.md` -> `_bmad-output/planning-artifacts/prd.md` / `_bmad-output/planning-artifacts/architecture.md`.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` remains historical context only and must not override the canonical planning stack for Story 1.7.
- This story extends the Epic 1 auth lane after Story 1.5 and Story 1.6. It must reuse existing auth/session patterns instead of inventing a second recovery or session model.
- Current code already invalidates all sessions on authenticated password change in `MemberService.updateMyPassword(...)`; reuse that session invalidation approach for reset completion rather than creating a new session-revocation mechanism.

### Technical Requirements

- Canonical contract decisions from the planning stack:
  - Recovery endpoints use JSON request bodies (`@RequestBody`); existing non-recovery auth endpoints may remain form-bound.
  - Token ownership uses `members.id` as the only persisted recovery foreign key.
  - Recovery CSRF uses the advertised header name from `GET /api/v1/auth/csrf`; current channel baseline is `X-CSRF-TOKEN`.
  - `POST /api/v1/auth/password/reset` success is bare `204 No Content`, while `forgot` and `challenge` use the standard success envelope.
  - CSRF failures are enforced by Spring Security before controller advice and therefore return raw `403 Forbidden`, not the application error envelope.
- Endpoint contract from channel addendum:
  - `POST /api/v1/auth/password/forgot`
  - `POST /api/v1/auth/password/forgot/challenge`
  - `POST /api/v1/auth/password/reset`
- Fixed recovery semantics:
  - Forgot returns fixed `202 Accepted` with recovery metadata and no eligibility disclosure for all non-rate-limited, non-CSRF-rejected requests.
  - Challenge bootstrap returns fixed `200 OK` with `challengeToken`, `challengeType`, and `challengeTtlSeconds=300` for all non-rate-limited, non-CSRF-rejected requests.
  - Reset success returns `204 No Content`.
- Canonical recovery policy language:
  - "eligible account" means an existing member account.
  - At the Story 1.7 contract layer, no additional business-state exclusions are introduced beyond existence plus the canonical cooldown, challenge, and rate-limit gates already documented in the planning artifacts.
- Canonical error mapping from `_bmad-output/planning-artifacts/channels/api-spec.md`:
  - `AUTH-012` -> invalid or expired reset token (`401`)
  - `AUTH-013` -> consumed reset token (`409`)
  - `AUTH-014` -> forgot/challenge/reset rate limit exceeded with `Retry-After` (`429`)
  - `AUTH-015` -> `newPassword` equals current password (`422`)
  - `AUTH-016` -> stale session after password change (`401`)
- Rate limits from `_bmad-output/planning-artifacts/channels/api-spec.md`:
  - `forgot`: `per-IP 5/min`, `per-email 3/15min`, `mail-cooldown-key(emailHash) 1/5min`
  - `forgot/challenge`: `per-IP 5/min`, `per-email 3/10min`, `endpoint-global 60/min`
  - `reset`: `per-IP 10/5min`, `per-tokenHash 5/15min`, `endpoint-global 60/min`
- Timing equalization:
  - Forgot path anti-enumeration envelope: floor `400ms`, jitter `0~50ms`
  - Reset token validation: floor `120ms`, jitter `0~20ms` across valid/invalid/expired/consumed paths
  - The planning addendum target of p95 delta `<= 80ms` between existent/non-existent/challenge-gated forgot paths remains in force.
  - Review evidence for that target must document the benchmark method using at least `30` warmed samples per path in the same integration environment and must record the slowest-versus-fastest p95 delta in `_bmad-output/implementation-artifacts/tests/test-summary.md` or a story-specific timing appendix under the same folder.
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
  - keep the standardized application error envelope for business exceptions that reach controller advice
  - keep correlation-id propagation and user-facing `traceId`
- Canonicalized contract drift decisions for this story:
  - Recovery endpoints use JSON bodies; existing auth form-binding remains unchanged outside the recovery surface.
  - Recovery persistence uses `members.id`; no dual-key recovery ownership is permitted.
- Guardrail:
  - If this story changes the canonical recovery contract, controller behavior, tests, API docs, and FE/MOB expectations must be synchronized together; no mixed contract per recovery endpoint.

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
  - `BE/channel-service/src/main/resources/db/migration/V6__password_recovery_tokens_and_password_changed_at.sql`
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
  - same `forgot` response body and status for existent vs non-existent accounts when the requests are not rejected by CSRF or rate limiting
  - same `forgot` response body and status for existent, non-existent, and challenge-gated accounts when the requests are not rejected by CSRF or rate limiting
  - challenge bootstrap returns fixed contract and rejects replayed/expired challenge nonce
  - valid reset rotates password, consumes token, updates `password_changed_at`, and invalidates sessions
  - invalid and expired reset token paths map to `AUTH-012`; consumed reset token path maps to `AUTH-013`
  - same-password reset attempt returns `AUTH-015`
  - rate-limited forgot/challenge/reset paths return `429` with `Retry-After`
  - missing/invalid CSRF token still fails for all non-GET recovery endpoints with the raw Spring Security `403` contract
  - `GET /api/v1/auth/session` made with the pre-reset session fails with `401 AUTH-016`
- Test infrastructure expectations:
  - prefer `ChannelContainersIntegrationTestBase` for MySQL + Redis-backed integration coverage
  - add narrow unit tests for timing equalization helpers and token-hash validation branches
  - if email dispatch is asynchronous, isolate transport with stub/fake sender rather than real SMTP
- Client/contract evidence expectations:
  - attach FE/MOB evidence for the canonical recovery submit policy under `_bmad-output/implementation-artifacts/tests/`, including the one-refresh/one-retry CSRF behavior when that path is exercised
- Regression checks:
  - existing login/logout/session flows must continue to pass
  - authenticated password change behavior in `MemberService` must not regress
  - no raw reset token may appear in DB assertions, logs, or serialized error bodies

### Quinn Reinforcement Checks

- Numbering conflict gate:
  - Reject implementation start if any source uses the legacy frontend-auth supplemental reference in `epic-1-user-authentication-and-account-access.md` as the requirements source for this file.
  - `story_key`, filename, and sprint-status key must remain `1-7-be-password-forgot-reset-api`.
- Contract drift gate:
  - Recovery endpoints use JSON (`@RequestBody`); current auth-style form binding remains outside this recovery surface.
  - Update controller tests, API docs, and FE/MOB expectations together; no mixed contract per recovery endpoint.
- Identity key gate:
  - Token ownership uses `members.id`.
  - Migration, entity, repository, and SQL snippets must all use `members.id` with no dual-key ambiguity.
- Anti-enumeration gate:
  - Compare existent/non-existent/challenge-gated forgot flows for status/body equivalence when the requests are not rejected by CSRF or rate limiting.
  - Ensure logging/audit output also avoids leaking whether the submitted email exists.
- Token lifecycle gate:
  - Reissue invalidates previous active token.
  - Raw token is never persisted.
  - `valid`, `invalid`, `expired`, and `consumed` reset paths respect equalized timing.
- Session invalidation gate:
  - Successful reset invalidates all existing sessions for the member.
  - First stale follow-up call to `GET /api/v1/auth/session` after reset must fail with the contracted `AUTH-016` path, not a generic auth error.
- Quality risk severity gate:
  - Any P0/P1 defect in anti-enumeration, token lifecycle, or session invalidation blocks status transition to `review`.
  - Any accepted P2 defect must include issue ID, owner, and due date in QA evidence.
- Evidence gate for review handoff:
  - Review handoff evidence must live under `_bmad-output/implementation-artifacts/tests/`; source tests alone are implementation references, not sufficient review artifacts.
  - Attach integration evidence for forgot/challenge/reset happy path and negative path matrix in `_bmad-output/implementation-artifacts/tests/test-summary.md` or a story-specific companion file under the same folder.
  - Attach one DB evidence sample proving hash-only persistence and one session invalidation trace showing `GET /api/v1/auth/session` becomes stale after reset in the same evidence folder.

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

- Status set to `review`.
- Completion note: Story artifact corrected to match the canonical password-recovery contract in `channels/api-spec.md`, `channels/login_flow.md`, `prd.md`, and `epics.md`.

### References

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
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

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Evidence Artifacts

- `_bmad-output/implementation-artifacts/tests/test-summary.md`
