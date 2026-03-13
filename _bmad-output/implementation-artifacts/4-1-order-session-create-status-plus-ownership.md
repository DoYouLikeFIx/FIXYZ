# Story 4.1: [BE][CH] Order Session Create/Status + Ownership

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a channel API owner,
I want order session creation and status queries with ownership checks,
So that unauthorized access and invalid session usage are blocked.

## Acceptance Criteria

1. Given a valid order initiation request, when the session API is called, then the system creates an order session with TTL, ownership metadata, `challengeRequired`, `authorizationReason`, and current status.
2. Given a low-risk order context with fresh login MFA proof, when policy allows challenge bypass, then the created session may already be `AUTHED` without additional per-order verification.
3. Given a status query for an owned session, when the endpoint is called, then the current session state is returned.
4. Given non-owner session access, when query or action occurs, then a deterministic forbidden error is returned.
5. Given an expired session, when status or action is requested, then the documented expired or not-found contract is returned.

## Tasks / Subtasks

- [x] Implement order-session creation contract with ownership, TTL, and authorization-decision metadata (AC: 1, 2)
  - [x] Return `challengeRequired`, `authorizationReason`, `status`, and `expiresAt` consistently
- [x] Implement owner-only session status query behavior (AC: 3, 4)
  - [x] Enforce cross-user access denial with deterministic error contract
- [x] Implement expiration handling for query and action paths (AC: 5)
  - [x] Ensure expired sessions no longer behave as active authorization context
- [x] Add automated coverage for create, owned lookup, forbidden access, auto-authorized path, and expiration (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 1.2, Story 2.2.

### Technical Requirements

- Session responses must carry authorization-decision metadata, not just raw status.
- Ownership validation must apply consistently to query and follow-up action paths.
- Session TTL and expiration behavior must remain deterministic across refresh or retry.

### Architecture Compliance

- Keep order-session ownership and authorization state in the channel domain boundary.
- Preserve standardized error-envelope and correlation-id behavior.
- Use architecture-defined session and Redis conventions for lifecycle control.

### Testing Requirements

- Cover create success, auto-authorized success, status query, forbidden access, and expired session behavior.
- Include regression coverage for duplicate reads or repeated status polling.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated from canonical Epic 4 planning and companion contract.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.
- 2026-03-12: `./gradlew.bat :channel-domain:testClasses :channel-service:testClasses`
- 2026-03-12: `./gradlew.bat :channel-domain:test --tests com.fix.channel.entity.OrderSessionStateMachineTest :channel-service:test --tests com.fix.channel.service.OrderSessionServiceTest --tests com.fix.channel.service.RedisOrderSessionTtlStoreTest --tests com.fix.channel.service.OrderSessionExpirySchedulerTest --tests com.fix.channel.integration.OrderSessionIntegrationTest`
- 2026-03-12: `./gradlew.bat :channel-service:generateOpenApiDocs`
- 2026-03-12: `./gradlew.bat :channel-domain:test :channel-service:check`
- 2026-03-12: `./gradlew.bat :channel-domain:test :channel-service:check` (review follow-up fixes)
- 2026-03-12: `./gradlew.bat :channel-domain:test :channel-service:check` (current-login MFA scoping, OTP replay guard, EXPIRED backfill regression)
- 2026-03-12: `./gradlew.bat :channel-domain:test :channel-service:check` (single-use bypass concurrency guard)
- 2026-03-12: `./gradlew.bat :channel-domain:test :channel-service:check` (Redis-backed session lock for clustered create serialization)
- 2026-03-12: `./gradlew.bat :channel-service:test --tests com.fix.channel.migration.ChannelFlywayMigrationTest`
- 2026-03-12: `./gradlew.bat :channel-service:check` (expanded V9 authorization-metadata migration regression coverage)

### Completion Notes List

- Story scaffold regenerated for order-session create/status and ownership scope.
- Added persisted authorization-decision metadata to order sessions and exposed `challengeRequired`, `authorizationReason`, `status`, and `expiresAt` in create/status responses.
- Hydrated fresh MFA and single-use bypass context from real auth session flows so low-risk requests can start in `AUTHED` without the former test-only session mutation path.
- Tightened auto-authorization to require trusted session continuity, no recent security signal, and no recent order-session velocity before bypassing step-up.
- Extended unit, integration, migration, and OpenAPI contract coverage for created, replayed, forbidden, auto-authorized, repeated-poll, and expired-session paths.
- Scoped fresh MFA bypass to the current login session only, rejected OTP replay from refreshing proof timestamps, and backfilled legacy post-auth `EXPIRED` rows via version-aware migration coverage.
- Serialized same-session order create requests so a single fresh-login MFA bypass cannot authorize multiple concurrent orders before the flag is consumed.
- Upgraded the session create lock to a Redis-backed distributed lock with local fallback so the single-use bypass rule still holds across multiple channel-service nodes sharing Spring Session.
- Expanded V9 migration regression coverage so legacy authorized terminal states and version-gated post-auth `EXPIRED` rows are explicitly backfilled and verified.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java
- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSessionAuthorizationReason.java
- BE/channel-domain/src/test/java/com/fix/channel/entity/OrderSessionStateMachineTest.java
- BE/channel-service/src/main/java/com/fix/channel/controller/OrderSessionController.java
- BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/OrderSessionCreateRequest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/OrderSessionResponse.java
- BE/channel-service/src/main/java/com/fix/channel/repository/OrderSessionRepository.java
- BE/channel-service/src/main/java/com/fix/channel/repository/OtpVerificationRepository.java
- BE/channel-service/src/main/java/com/fix/channel/repository/SecurityEventRepository.java
- BE/channel-service/src/main/java/com/fix/channel/service/AuthService.java
- BE/channel-service/src/main/java/com/fix/channel/service/ChannelScaffoldService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionAuthorizationDecisionService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionTtlStore.java
- BE/channel-service/src/main/java/com/fix/channel/service/RedisOrderSessionTtlStore.java
- BE/channel-service/src/main/java/com/fix/channel/session/ChannelSessionAttributes.java
- BE/channel-service/src/main/java/com/fix/channel/session/ChannelSessionRequestLock.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderSessionAuthorizationDecision.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderSessionCreateCommand.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderSessionResult.java
- BE/channel-service/src/main/resources/db/migration/V9__add_order_session_authorization_metadata.sql
- BE/channel-service/src/test/java/com/fix/channel/contract/ChannelOpenApiCompatibilityTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthSessionIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/migration/ChannelFlywayMigrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionExpirySchedulerTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/RedisOrderSessionTtlStoreTest.java
- BE/channel-service/src/test/java/com/fix/channel/session/ChannelSessionRequestLockTest.java
- BE/channel-service/src/test/java/com/fix/channel/web/OrderSessionControllerConcurrencyTest.java
- BE/contracts/openapi/channel-service.json
- _bmad-output/implementation-artifacts/4-1-order-session-create-status-plus-ownership.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-12: Implemented order-session authorization metadata, session-backed auto-`AUTHED` creation, owner-only status enforcement regression coverage, and updated the committed OpenAPI contract.
- 2026-03-12: Addressed review follow-ups by backfilling legacy authorized rows correctly and wiring low-risk auto-authorization to real MFA session context plus conservative risk gates.
- 2026-03-12: Addressed second review follow-ups by binding fresh MFA proof to the active login session, preventing OTP replay from extending bypass freshness, and covering legacy `EXPIRED` backfill with migration regression tests.
- 2026-03-12: Addressed concurrent create replay risk by serializing same-session order-session creation and adding a controller-level concurrency regression test.
- 2026-03-12: Replaced the single-node session lock with a Redis-backed distributed lock and added cross-instance session-lock regression coverage.
- 2026-03-12: Expanded V9 authorization-metadata migration regression coverage and documented the post-auth `EXPIRED` backfill rule inline in the migration.
