# Story 1.1: BE Registration and Login Session

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a new or returning user,
I want to register and complete the password phase of login that underpins secure session issuance,
so that protected features are unlocked only after the required MFA flow completes.

> Historical baseline note: this story originally predated mandatory login MFA. The current target contract keeps the registration/password groundwork here, while final authenticated session issuance is completed through Story 1.11.

## Acceptance Criteria

1. Given valid registration payload, when sign-up is requested, then member is created with default role and secure password hash.
2. Given valid login credentials, when the password phase succeeds, then a short-lived `loginToken` and next action are returned and no protected session is issued yet.
3. Given mandatory login MFA follow-on is completed, when current TOTP verification or first-time enrollment confirmation succeeds, then a Redis-backed session cookie is issued with secure attributes.
4. Given duplicate login from the same account, when a second fully authenticated session is established, then previous session is invalidated by policy.
5. Given invalid credentials, when login fails, then normalized authentication error is returned.

## Tasks / Subtasks

- [x] Implement registration endpoint and member creation policy (AC: 1)
  - [x] Enforce role defaulting and password hashing policy
  - [x] Return normalized success contract for register result
- [x] Implement password-step login endpoint and baseline auth/session plumbing (AC: 2)
  - [x] Establish the credential-validation entrypoint that later mandatory MFA builds on
  - [x] Provide the Redis-backed session/security foundation consumed by the final MFA-complete issuance path
- [x] Enforce single active session policy per account (AC: 4)
  - [x] Expire prior active session on re-login
  - [x] Return deterministic behavior for old/new session usage
- [x] Normalize authentication error responses (AC: 5)
  - [x] Unify invalid credentials/non-existent account response semantics
  - [x] Ensure consistent global error envelope
- [x] Add integration coverage for register/login/session baseline (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.10`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.10`); use it only for technical constraints, not story ID mapping.

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
  - Verify 'story_key ??filename ??sprint-status key' are identical before moving status from 'ready-for-dev' to 'in-progress'.
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
- Party review resolution status (closeout confirmed 2026-03-11):
  - [x] Scope alignment confirmed: lockout/rate-limit policy implementation is owned by Story 1.5; Story 1.1 only guarantees auth/session baseline compatibility.
  - [x] Redis+MySQL integration evidence attached for register/login/session issuance path (including secure cookie attributes).
  - [x] Duplicate-login invalidation evidence attached showing deterministic old-session denial and new-session success.
  - [x] Invalid-credential normalization evidence attached with non-enumerating auth error semantics.

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

- Status set to `done`.
- Completion note: Story closed as done to reflect the delivered registration, login, and session baseline that underpins the completed Epic 1 auth platform.

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
- 2026-03-12: Implemented password-step pre-auth `loginToken` flow in `BE/channel-service`, moved authenticated session issuance to `POST /api/v1/auth/otp/verify`, and refreshed impacted integration/openapi contract coverage.
- Validation:
  - `./gradlew :channel-service:test --tests 'com.fix.channel.integration.ChannelAuthFlowTest' --tests 'com.fix.channel.integration.ChannelAuthGuardrailsIntegrationTest' --tests 'com.fix.channel.integration.ChannelSessionTimeoutIntegrationTest'`
  - `./gradlew :channel-service:test --tests 'com.fix.channel.integration.ChannelAuthSessionIntegrationTest' --tests 'com.fix.channel.integration.ChannelPasswordRecoveryIntegrationTest' --tests 'com.fix.channel.integration.OrderSessionIntegrationTest' --tests 'com.fix.channel.integration.ChannelAuthDemoTotpIntegrationTest'`
  - `./gradlew :channel-service:test --tests 'com.fix.channel.contract.ChannelOpenApiCompatibilityTest' :channel-service:verifyCommittedOpenApi`
  - `./gradlew :channel-service:test`

### Completion Notes List

- Added session/security guardrails and deprecated-pattern exclusions.
- Reworked `/api/v1/auth/login` to validate only the password phase and return `loginToken`, `nextAction`, `totpEnrolled`, and expiry metadata without issuing an authenticated session.
- Added `LoginTokenService` with Redis-backed storage and in-memory fallback so pre-auth login tokens work in both container-backed integration tests and `spring.session.store-type=none` test slices.
- Moved authenticated session issuance, duplicate-session invalidation, and MFA proof metadata persistence to `/api/v1/auth/otp/verify`.
- Updated integration helpers and committed OpenAPI contract so downstream session, order, and password-recovery flows authenticate through `login -> otp verify`.

### File List

- _bmad-output/implementation-artifacts/1-1-be-registration-login-session.md
- BE/channel-service/src/main/java/com/fix/channel/service/LoginTokenService.java
- BE/channel-service/src/main/java/com/fix/channel/service/AuthService.java
- BE/channel-service/src/main/java/com/fix/channel/service/ChannelScaffoldService.java
- BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java
- BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityConfig.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/OtpVerifyRequest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/AuthLoginResponse.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/OtpVerifyResponse.java
- BE/channel-service/src/main/java/com/fix/channel/vo/AuthLoginResult.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OtpVerifyCommand.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OtpVerifyResult.java
- BE/channel-service/src/main/resources/application.yml
- BE/channel-service/src/test/java/com/fix/channel/contract/ChannelOpenApiCompatibilityTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthFlowTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthGuardrailsIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthSessionIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthDemoTotpIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelPasswordRecoveryIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelSessionTimeoutIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java
- BE/contracts/openapi/channel-service.json
- BE/core-common/src/main/java/com/fix/common/error/ErrorCode.java

## Change Log

- 2026-03-12: aligned Story 1.1 implementation with mandatory-login-MFA contract by introducing password-step `loginToken` issuance, shifting authenticated session creation to OTP verification, and updating affected tests plus OpenAPI snapshot.
