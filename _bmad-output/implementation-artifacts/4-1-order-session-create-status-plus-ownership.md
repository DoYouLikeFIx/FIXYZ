# Story 4.1: [BE][CH] Order Session Create/Status + Ownership

Status: review
Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a channel API owner,
I want order session creation and status queries with ownership checks,
So that unauthorized access and invalid session usage are blocked.

## Acceptance Criteria

1. Given a valid order initiation request, when the session API is called, then the system creates an order session with TTL, ownership metadata, `challengeRequired`, `authorizationReason`, and current status.
2. Given a low-risk order context with an active trusted auth-session window, when policy allows challenge bypass, then the created session may already be `AUTHED` without additional per-order verification.
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
- [x] Review Follow-ups (AI)
  - [x] [AI-Review][high] Gate legacy `POST /api/v1/orders` behind an owned `AUTHED` order session and execution-payload match
  - [x] [AI-Review][high] Require login or device continuity plus recent-security-event clean window before auto-authorized bypass
  - [x] [AI-Review][high] Enforce Step A pre-trade cash or quantity validation before session issuance and sync the committed prepare contract surface

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 1.2, Story 2.2.

### Technical Requirements

- Canonical Epic 4 contract freeze:
  - `POST /api/v1/orders/sessions` is the canonical initiation endpoint and must return `orderSessionId`, `clOrdId`, `status`, `challengeRequired`, `authorizationReason`, and `expiresAt`.
  - No separate `/authorization` endpoint exists in the canonical Epic 4 flow; the authorization decision is part of the create response.
  - Low-risk sessions may be created directly as `AUTHED` with `challengeRequired=false`; elevated-risk sessions remain `PENDING_NEW` with `challengeRequired=true`.
  - `GET /api/v1/orders/sessions/{orderSessionId}` must return owner-only current state plus the same authorization-decision metadata.
  - `POST /api/v1/orders/sessions/{orderSessionId}/otp/verify` exists only for sessions where `challengeRequired=true`.
  - Ownership mismatch returns `403 CHANNEL-006`; expired or missing sessions return `404 ORD-008`.
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

- `./gradlew :channel-service:test --tests com.fix.channel.service.OrderSessionServiceTest --tests com.fix.channel.integration.OrderSessionIntegrationTest`
- `./gradlew :channel-service:test --tests com.fix.channel.integration.ChannelAuthDemoTotpIntegrationTest`
- `./gradlew :channel-service:test --tests com.fix.channel.migration.ChannelFlywayMigrationTest`
- `./gradlew :channel-service:test --tests com.fix.channel.contract.ChannelOpenApiCompatibilityTest`
- `./gradlew :channel-service:verifyCommittedOpenApi`
- `./gradlew --console=plain :channel-service:test --tests com.fix.channel.integration.ChannelAuthDemoTotpIntegrationTest --tests com.fix.channel.controller.ChannelErrorContractTest --tests com.fix.channel.contract.ChannelOpenApiCompatibilityTest`
- `./gradlew --console=plain :channel-service:test --tests com.fix.channel.convention.ChannelDtoVoBoundaryArchTest --tests com.fix.channel.controller.ChannelErrorContractTest`
- `./gradlew --console=plain :channel-service:test`
- `./gradlew --console=plain :channel-service:verifyCommittedOpenApi`

### Completion Notes List

- Added immutable order-session authorization decision persistence via `challenge_required` and `authorization_reason`, including Flyway V13 backfill for legacy sessions.
- Implemented low-risk auto-authorization for fresh-login MFA sessions while preserving elevated-risk `PENDING_NEW` behavior for higher-risk creates.
- Extended create/status responses and owner-only replay paths to re-expose `challengeRequired` and `authorizationReason` consistently.
- Synced order-session, demo, migration, and OpenAPI contract coverage with the canonical Epic 4 create/status contract.
- Resolved review finding [high] by binding legacy `POST /api/v1/orders` execution to the owned `AUTHED` order session, expiry checks, and execution-payload equality.
- Resolved review finding [high] by tightening low-risk bypass to require matching login/request client context and a recent high-risk security-event clean window.
- Resolved review finding [high] by validating available cash or available quantity before session issuance and syncing the committed OpenAPI response with the prepare contract additions.
- Added test-only order-session fixture wiring to keep controller-boundary tests inside ArchUnit package rules while preserving external-error contract coverage.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java
- BE/channel-service/src/main/java/com/fix/channel/controller/OrderSessionController.java
- BE/channel-service/src/main/java/com/fix/channel/controller/OrderController.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/OrderSessionCreateRequest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/OrderSessionResponse.java
- BE/channel-service/src/main/java/com/fix/channel/service/AuthService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderSessionCreateCommand.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderSessionResult.java
- BE/channel-service/src/main/java/db/migration/V13__add_order_session_authorization_decision_columns.java
- BE/channel-service/src/test/java/com/fix/channel/contract/ChannelOpenApiCompatibilityTest.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthDemoTotpIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/migration/ChannelFlywayMigrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/testsupport/OrderSessionTestFixture.java
- BE/contracts/openapi/channel-service.json
- BE/core-common/src/main/java/com/fix/common/error/ErrorCode.java
- _bmad-output/implementation-artifacts/4-1-order-session-create-status-plus-ownership.md

## Change Log

- 2026-03-13: Implemented canonical order-session authorization-decision contract, added low-risk auto-auth policy plus Flyway backfill, expanded automated coverage, and synced committed OpenAPI snapshot.
- 2026-03-13: Senior developer review requested changes; story moved back to in-progress pending risk-policy, prepare-validation, and execution-gating fixes.
- 2026-03-13: Addressed AI review findings by enforcing legacy execution gating, strengthening auto-auth risk checks, adding pre-trade eligibility validation, restoring ArchUnit-compliant test fixtures, and re-verifying the committed OpenAPI snapshot.

## Senior Developer Review (AI)

### Review Date

2026-03-13

### Outcome

Changes requested at review time; all findings resolved in the 2026-03-13 follow-up pass.

### Findings

- [resolved][high] `OrderSessionService.resolveAuthorizationDecision()` originally auto-authorized too narrowly on fresh login MFA plus notional threshold. The follow-up implementation tightened this to trusted-session/device continuity plus recent-security-event checks.
- [resolved][high] `POST /api/v1/orders/sessions` originally skipped Step A pre-trade validation. The follow-up implementation added available cash or available quantity checks and aligned the committed contract surface.
- [resolved][high] The legacy `POST /api/v1/orders` execution path originally accepted raw `accountId` and `clOrdId` without order-session gating. The follow-up implementation bound it to owned `AUTHED` order-session validation and execution-payload equality.
