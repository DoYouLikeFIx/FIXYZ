# Story 4.1: [CH] Order Session Create/Status + Ownership

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a channel API owner,
I want order session creation and status queries with ownership checks,
So that unauthorized access and invalid session usage are blocked.

## Acceptance Criteria

1. Given valid order initiation request When session API is called Then session is created with PENDING_NEW status and TTL.
2. Given status query for owned session When endpoint is called Then current session state is returned.
3. Given non-owner session access When query or action occurs Then forbidden error is returned.
4. Given expired session When status/action is requested Then not-found/expired contract is returned.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 1.2, Story 2.2.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 4 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md` (채널계 API 명세)
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 4.
- `./gradlew :channel-service:test --tests "com.fix.channel.service.OrderSessionServiceTest" --tests "com.fix.channel.integration.OrderSessionIntegrationTest"`
- `./gradlew :core-common:test :channel-domain:test :channel-service:test`
- `./gradlew :channel-service:check`

### Implementation Notes

- Added a dedicated `OrderSessionService` flow with authenticated member resolution, ownership validation, and Redis-backed TTL enforcement for session liveness.
- Replaced scaffold `OPEN` order-session behavior with `PENDING_NEW`, returning TTL metadata and normalized order-session ownership/not-found contracts.
- Synced the committed channel-service OpenAPI snapshot with the updated order-session request and response schema.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Completed order-session create/status behavior with authenticated ownership checks and Redis TTL-based expiration handling.
- Added unit and Testcontainers integration coverage for create, owned lookup, forbidden access, and expired-session scenarios.
- Verified affected backend modules and `channel-service:check` all pass after OpenAPI contract sync.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java
- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSessionStatus.java
- BE/channel-domain/src/test/java/com/fix/channel/entity/OrderSessionStateMachineTest.java
- BE/channel-service/src/main/java/com/fix/channel/controller/OrderSessionController.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/OrderSessionCreateRequest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/OrderSessionQueryRequest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/OrderSessionResponse.java
- BE/channel-service/src/main/java/com/fix/channel/service/ChannelScaffoldService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionTtlStore.java
- BE/channel-service/src/main/java/com/fix/channel/service/RedisOrderSessionTtlStore.java
- BE/channel-service/src/main/java/com/fix/channel/service/SessionOwnershipValidator.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderSessionQueryCommand.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderSessionResult.java
- BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- BE/contracts/openapi/channel-service.json
- BE/core-common/src/main/java/com/fix/common/error/ErrorCode.java
- _bmad-output/implementation-artifacts/4-1-order-session-create-status-plus-ownership.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-11: Implemented order-session create/status ownership flow with Redis TTL enforcement, added automated coverage, and synced OpenAPI contract.
- 2026-03-11: QA automation added action-path regressions for duplicate create ownership/expiration semantics and verified `channel-service` quality gates.

## QA Results

### Reviewer

- Quinn (QA Engineer), 2026-03-11

### Gate Decision

- PASS

### Acceptance Criteria Validation

1. AC1 (create `PENDING_NEW` session with TTL): PASS
   - Evidence: create flow returns TTL metadata, Redis session key, OTP-attempt seed, and stable duplicate-create metadata
   - Automated coverage: `BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java`
2. AC2 (owned session status query): PASS
   - Evidence: authenticated owner can resolve active session state by `orderSessionId`
   - Automated coverage: `BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java`
3. AC3 (non-owner access forbidden): PASS
   - Evidence: both status lookup and duplicate-create action are rejected for a different member
   - Automated coverage: `BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java`
4. AC4 (expired session returns not-found/expired contract): PASS
   - Evidence: both status lookup and duplicate-create action return the expired/not-found contract once Redis TTL state is gone
   - Automated coverage: `BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java`

### Executed Verification

- `cd BE && .\gradlew.bat :channel-service:test --tests "com.fix.channel.service.OrderSessionServiceTest"` -> PASS
- `cd BE && .\gradlew.bat :channel-service:test --tests "com.fix.channel.integration.OrderSessionIntegrationTest"` -> PASS
- `cd BE && .\gradlew.bat :channel-service:check` -> PASS

### Findings

- No blocking QA findings remain for Story 4.1 after the UUID contract and stable `expiresAt` remediation.
