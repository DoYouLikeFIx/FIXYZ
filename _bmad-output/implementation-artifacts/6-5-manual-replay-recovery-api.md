# Story 6.5: [BE][FEP] Manual Replay/Recovery API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want controlled replay/recovery commands,
So that unresolved orders can be corrected safely.

## Acceptance Criteria

1. Given an authenticated `ROLE_ADMIN` caller and an `OrderSession` whose DB-backed status is `ESCALATED`
   When `POST /api/v1/admin/orders/{clOrdId}/replay` is called with the canonical request body
   Then `channel-service` injects `operatorId` from the current admin session, validates the fixed governance fields, routes the replay through `corebank-service` instead of calling `fep-gateway` directly, and returns the canonical final-result envelope with `clOrdId`, `finalStatus`, `executionSource`, optional `executionResult`, optional execution payload, `processedBy`, and `processedAt`.
2. Given an authenticated non-admin caller
   When the admin replay endpoint is called
   Then the request is rejected with deterministic `403 AUTH-006`
   And a security event containing actor context, target `clOrdId`, correlation id, and client IP is recorded
   And unauthenticated or stale-session requests continue to follow the existing canonical auth contracts (`AUTH-003`, `CHANNEL-001`) without introducing a second replay-specific auth model.
3. Given a duplicate replay request for the same replay identity
   When the normalized replay command identity `{clOrdId, manualDecision, approvedBy, evidenceRef, reason, executionPrice, injected operatorId}` is identical
   Then idempotent behavior is enforced by returning the same final replay result without issuing a second downstream replay mutation
   And when a terminalized replay target is called again with a different payload, the request is rejected as a conflict instead of being silently treated as idempotent.
4. Given replay completion or failure
   When the operation ends
   Then the final result is fully auditable: the order session transitions from `ESCALATED` to `COMPLETED`, `FAILED`, or `CANCELED` as appropriate; canonical `MANUAL_REPLAY` audit evidence includes operator/approver/governance fields and correlation data; forbidden attempts emit security evidence; and the response plus terminal SSE outcome follows the fixed replay decision rules for `FILLED`, `PARTIALLY_FILLED`, virtual fill, `CANCELED`, `PARTIAL_FILL_CANCEL`, and `MANUAL_REJECT`.

## Tasks / Subtasks

- [x] Expose the canonical channel admin replay endpoint and contract surface (AC: 1, 2)
  - [x] Add `POST /api/v1/admin/orders/{clOrdId}/replay` to the existing admin controller surface; do not create a second admin namespace
  - [x] Add request/response DTOs and OpenAPI coverage that match `_bmad-output/planning-artifacts/channels/api-spec.md`
  - [x] Inject `operatorId` from the authenticated admin session; do not accept `operatorId` from the public request body
  - [x] Reuse the established admin rate-limit pattern (`20 req/min/session`, `Retry-After`) and auth failure semantics from the existing admin API stack
- [x] Implement the upstream orchestration path through `corebank-service` (AC: 1, 4)
  - [x] Add a single internal replay boundary in `corebank-service` for channel-to-corebank replay requests
  - [x] Route `channel-service -> corebank-service -> fep-gateway`; do not allow `channel-service` to call `fep-gateway` directly
  - [x] Reuse the existing one-shot requery-before-finalize rule for `APPROVE` decisions before applying manual finalization rules
- [x] Implement governance validation and replay idempotency (AC: 1, 3)
  - [x] Validate `approvedBy`, `evidenceRef`, `reason`, `executionPrice`, and virtual-fill deviation rules exactly as fixed in the canonical API spec
  - [x] Persist and compare a stable replay identity/fingerprint so same-payload duplicate requests are idempotent across retries and process restarts
  - [x] Reject divergent replay payloads against an already terminalized replay target as a conflict; do not silently reuse the prior result
- [x] Implement audit, security, and state-transition evidence (AC: 2, 4)
  - [x] Record canonical `MANUAL_REPLAY` audit evidence via the shared audit boundary from Story 8.1
  - [x] Record forbidden replay attempts in `security_events` with actor, IP, target, and correlation context
  - [x] Update the order-session state from `ESCALATED` to `COMPLETED`, `FAILED`, or `CANCELED` and preserve `ESCALATED` on `CORE-001` retry-later failures
  - [x] Emit the correct terminal client outcome (`ORDER_FAILED`, `ORDER_CANCELED`, `ORDER_PARTIAL_FILL_CANCEL`, or normal completion outcome) after replay finalization
- [x] Add automated verification for the canonical replay contract (AC: 1, 2, 3, 4)
  - [x] Add success coverage for `FILLED`, `PARTIALLY_FILLED`, virtual-fill `LIMIT`, virtual-fill `MARKET`, full `CANCELED`, partial-fill-cancel, and `MANUAL_REJECT`
  - [x] Add negative coverage for non-admin `403 AUTH-006`, stale session, governance validation failures, missing `executionPrice`, deviation overflow, non-`ESCALATED` targets, and `CORE-001`
  - [x] Add duplicate-request coverage proving same-identity replay is idempotent and divergent replay payloads are rejected
  - [x] Add evidence assertions proving `MANUAL_REPLAY` audit data includes operator, approver, evidence ref, reason, correlation id, and final outcome details

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 6.
- Public executable contract source of truth for this story is `_bmad-output/planning-artifacts/channels/api-spec.md` section `4.2`.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 6.4.
- Story 6.4 is already `done` and owns the durable manual-recovery queue plus `ESCALATED` session semantics. This story consumes that output; do not redesign queue ownership here.
- Story 7.5 is already `done` and owns the existing admin controller/session/rate-limit pattern. Extend that surface instead of introducing a parallel admin stack.
- Story 8.1 is already `done` and fixes the shared audit/security schema plus canonical `MANUAL_REPLAY` vocabulary. Consume that contract; do not create a second audit path or alternate event naming.
- Existing downstream replay behavior already exists in `BE/fep-gateway`; this story is primarily the upstream channel/corebank orchestration and evidence contract needed to reach that path safely.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only when Story 6.4 remains `done` and the Story 7.5 / Story 8.1 admin-audit contracts are treated as frozen for the implementation branch.

### Implementation Scope Guardrails

- The canonical public endpoint is fixed: `POST /api/v1/admin/orders/{clOrdId}/replay`.
- The public request body excludes `operatorId`. `channel-service` must derive it from the authenticated admin session and pass it only on the internal lane.
- `channel-service` must validate replay eligibility from the DB-backed `order_sessions` record and its `ESCALATED` state. Redis session/order TTL expiry must not be treated as the source of truth for replay eligibility.
- The replay topology is fixed: `channel-service -> corebank-service -> fep-gateway`. `channel-service` must not call `fep-gateway` directly.
- This endpoint is a synchronous final-result contract. Do not implement or document an async "accepted with tracking id" contract for this story.
- `APPROVE` must perform exactly one fresh requery through the internal lane before applying manual finalization rules.
- Do not expand this story into scheduler ownership, retry-boundary redesign, or chaos-control API changes. Those belong to Stories 6.2, 6.3, 6.4, and 9.3.

### Technical Requirements

- Public request fields are fixed by `_bmad-output/planning-artifacts/channels/api-spec.md`:
  - `manualDecision`
  - `approvedBy`
  - `evidenceRef`
  - `reason`
  - `executionPrice` (optional except where virtual-fill rules make it mandatory)
- Public error contract is fixed:
  - `AUTH-003`
  - `AUTH-006`
  - `CHANNEL-001`
  - `ORD-008`
  - `ORD-009`
  - `VALIDATION-001`
  - `VALIDATION-002`
  - `VALIDATION-004`
  - `RATE-001`
  - `CORE-001`
  - `SYS-001`
- Public rate limiting is fixed at `20 req/min` per admin session with `Retry-After` response header.
- Governance rules are fixed and must not be weakened:
  - `approvedBy` is required, UUID-shaped, and must differ from injected `operatorId`
  - `evidenceRef` is required
  - `reason` is required and must remain at least 30 characters
  - `executionPrice` is required for `MARKET` + unresolved `APPROVE` (`UNKNOWN`, `PENDING`, `MALFORMED`)
  - virtual-fill price deviation must respect `maxVirtualFillDeviationBps`
- Replay identity for idempotency is fixed for this story as the normalized tuple `{clOrdId, manualDecision, approvedBy, evidenceRef, reason, executionPrice, injected operatorId}`.
- Same-identity duplicate replay requests must return the same final result without issuing a second downstream replay mutation. This detection must survive process restarts and must not rely only on in-memory state.
- Divergent replay payloads against an already terminalized replay target must fail as a conflict path; they must not be silently mapped onto the previously completed replay result.
- `APPROVE` decision rules are fixed by the canonical API spec:
  - fresh requery `FILLED` / `PARTIALLY_FILLED` -> complete from requery data
  - fresh requery `UNKNOWN` / `PENDING` / `MALFORMED` -> virtual fill using the fixed policy
  - fresh requery `CANCELED` + zero fill -> final `CANCELED`
  - fresh requery `CANCELED` + partial fill -> final `CANCELED` with `executionResult = PARTIAL_FILL_CANCEL`
- `REJECT` must finalize the order session as `FAILED` with the canonical manual-reject client outcome.
- `CORE-001` failure path must keep the session in `ESCALATED` and require explicit operator retry; do not silently downgrade it to another state.
- Audit evidence must include at minimum:
  - canonical action `MANUAL_REPLAY`
  - `operatorId`
  - `approvedBy`
  - `evidenceRef`
  - `reason`
  - `manualDecision`
  - `executionPrice` when provided
  - final status/outcome fields
  - correlation id, IP, and user agent

### BE Integration Points

- Public channel admin lane:
  - `BE/channel-service/src/main/java/com/fix/channel/controller/AdminController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/dto/request/**`
  - `BE/channel-service/src/main/java/com/fix/channel/dto/response/**`
  - `BE/channel-service/src/main/java/com/fix/channel/service/**`
  - `BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java`
  - `BE/contracts/openapi/channel-service.json`
- Internal corebank lane to add:
  - `BE/corebank-service/src/main/java/com/fix/corebank/controller/**`
  - `BE/corebank-service/src/main/java/com/fix/corebank/dto/request/**`
  - `BE/corebank-service/src/main/java/com/fix/corebank/dto/response/**`
  - `BE/corebank-service/src/main/java/com/fix/corebank/service/**`
  - `BE/contracts/openapi/corebank-service.json` if the internal replay boundary is snapshot-tested
- Domain and persistence lane:
  - `BE/channel-domain/src/main/java/com/fix/channel/entity/**`
  - `BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java`
  - shared audit/security services from Story 8.1
- Downstream contract to consume, not redesign:
  - existing `BE/fep-gateway/src/main/**/replay` endpoint and its scenario/contract tests

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Respect the architecture rule that `channel-service` is the saga orchestrator while `corebank-service` owns canonical local execution state.
- Manual replay updates only external confirmation/recovery state; it must not introduce a second canonical execution source or duplicate submit path.
- Respect Story 6.2 retry boundaries. Do not add automatic submit retries or hidden replay retries that violate the non-idempotent execution guardrail.
- Reuse the shared audit/security recording boundary from Story 8.1 and the admin auth/rate-limit patterns from Story 7.5.

### Previous Story Intelligence

- From Story 6.4:
  - `ESCALATED` sessions already converge into a durable manual-recovery queue; this story consumes that queue/result state rather than redefining it.
  - `CANCELED` recovery convergence and terminal notification patterns already exist and should be reused where compatible.
- From Story 6.2:
  - retry logic belongs only to the status-query lane; manual replay must not disguise a second automatic execution retry path.
- From Story 7.5:
  - reuse the existing admin controller/session-resolution/rate-limit pattern and OpenAPI discipline
- From Story 8.1:
  - canonical audit vocabulary already includes `MANUAL_REPLAY`
  - actor identity and correlation capture are already fixed and queryable

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Minimum required automated coverage:
  - admin auth and rate limit: `401`, `403`, `410`, `429`
  - success: requery `FILLED`, requery `PARTIALLY_FILLED`, virtual-fill `LIMIT`, virtual-fill `MARKET`, full `CANCELED`, partial-fill-cancel, and `MANUAL_REJECT`
  - validation: missing/invalid `approvedBy`, missing `evidenceRef`, short `reason`, missing `executionPrice`, deviation overflow, non-`ESCALATED` target
  - idempotency: same-identity duplicate request returns the same result and does not issue a second downstream replay mutation
  - conflict: divergent replay payload against an already terminalized replay target is rejected
  - resilience: `CORE-001` keeps the session in `ESCALATED`
  - evidence: `MANUAL_REPLAY` audit payload proves operator, approver, evidence ref, reason, correlation id, and final outcome persistence
- Preferred file candidates:
  - `BE/channel-service/src/test/java/com/fix/channel/integration/**`
  - `BE/channel-service/src/test/java/com/fix/channel/controller/**`
  - `BE/channel-service/src/test/java/com/fix/channel/service/**`
  - `BE/corebank-service/src/test/java/com/fix/corebank/controller/**`
  - `BE/corebank-service/src/test/java/com/fix/corebank/service/**`
  - existing `BE/fep-gateway/src/test/java/com/fix/fepgateway/scenario/FepGatewayReplayScenarioTest.java` as downstream contract evidence

### Quinn Reinforcement Checks

- Contract gate:
  - Reject any implementation that returns or documents an async replay tracking id instead of the canonical final-result payload.
- Topology gate:
  - Reject any implementation where `channel-service` calls `fep-gateway` directly.
- Idempotency gate:
  - Verify the replay identity tuple is persisted or reproducible so duplicate detection survives restart and does not depend only on volatile state.
- Governance gate:
  - Verify dual-control, evidence ref, reason length, execution-price requirement, and deviation checks are all enforced before the downstream replay mutation happens.
- Evidence gate:
  - Attach one success proof, one duplicate-idempotency proof, one forbidden-attempt proof, and one canceled-race-condition proof before status moves to `review`.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story artifact refined against the canonical replay contract, existing admin/audit dependencies, explicit idempotency rules, and concrete verification gates.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.5)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/db_schema.md`
- `_bmad-output/planning-artifacts/channels/table_spec.md`
- `_bmad-output/implementation-artifacts/6-4-unknown-requery-scheduler.md`
- `_bmad-output/implementation-artifacts/7-5-admin-session-and-audit-apis.md`
- `_bmad-output/implementation-artifacts/8-1-audit-security-event-model.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Reviewed canonical replay contract in `_bmad-output/planning-artifacts/channels/api-spec.md`
- Cross-checked prerequisite outputs in Stories 6.4, 7.5, and 8.1
- Verified current implementation boundaries in `BE/channel-service`, `BE/corebank-service`, and `BE/fep-gateway`
- Ran `./gradlew :channel-service:compileJava :corebank-service:compileJava`
- Ran targeted replay suites:
  - `./gradlew :channel-service:test --tests com.fix.channel.service.AdminOrderReplayServiceTest --tests com.fix.channel.client.CorebankClientTest`
  - `./gradlew :channel-service:test --tests com.fix.channel.integration.AdminOrderReplayIntegrationTest`
  - `./gradlew :corebank-service:test --tests com.fix.corebank.service.CorebankOrderReplayServiceTest --tests com.fix.corebank.controller.CorebankInternalApiSkeletonTest`
- Investigated `corebank-service` OpenAPI generation mismatch caused by local port `18081` being occupied, reproduced runtime docs on an override port, and hardened docs generation with dynamic port fallback plus normalization
- Regenerated and synced `BE/contracts/openapi/channel-service.json` and `BE/contracts/openapi/corebank-service.json`
- Ran full regression verification with `./gradlew :channel-service:check :corebank-service:check`
- Ran downstream replay scenario evidence with `./gradlew :fep-gateway:test --tests com.fix.fepgateway.scenario.FepGatewayReplayScenarioTest`

### Completion Notes List

- Replaced the scaffold-level AC wording with the executable admin replay contract.
- Added explicit idempotency identity rules so duplicate replay behavior is implementable without guesswork.
- Added concrete cross-service scope, validation rules, evidence expectations, and test gates.
- Implemented the admin replay API in `channel-service`, including authenticated operator injection, persisted replay fingerprints, manual replay audit evidence, forbidden-attempt security events, and terminal notification publishing.
- Implemented the internal replay lane in `corebank-service` and replay result translation from `fep-gateway`, preserving `ESCALATED` on `CORE-001` retry-later failures and finalizing `COMPLETED` / `FAILED` / `CANCELED` outcomes.
- Stabilized `corebank-service` OpenAPI generation so local port collisions no longer corrupt the committed snapshot verification path.
- Verified the story with targeted unit/integration suites, full `:channel-service:check :corebank-service:check`, and downstream `FepGatewayReplayScenarioTest`.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java
- BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java
- BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityConfig.java
- BE/channel-service/src/main/java/com/fix/channel/controller/AdminController.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/AdminOrderReplayRequest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/AdminOrderReplayResponse.java
- BE/channel-service/src/main/java/com/fix/channel/repository/OrderSessionRepository.java
- BE/channel-service/src/main/java/com/fix/channel/service/AdminApiRateLimitService.java
- BE/channel-service/src/main/java/com/fix/channel/service/AdminMemberSessionService.java
- BE/channel-service/src/main/java/com/fix/channel/service/AdminOrderReplayService.java
- BE/channel-service/src/main/java/com/fix/channel/service/AdminReplaySecurityEventRecorder.java
- BE/channel-service/src/main/java/com/fix/channel/support/ManualReplayIdentitySupport.java
- BE/channel-service/src/main/java/com/fix/channel/vo/AdminActorContext.java
- BE/channel-service/src/main/java/com/fix/channel/vo/AdminOrderReplayCommand.java
- BE/channel-service/src/main/java/com/fix/channel/vo/AdminOrderReplayResult.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderReplayResult.java
- BE/channel-service/src/main/java/db/migration/V21__add_manual_replay_columns_to_order_sessions.java
- BE/channel-service/src/test/java/com/fix/channel/client/CorebankClientTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/AdminOrderReplayIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/AdminOrderReplayServiceTest.java
- BE/contracts/openapi/channel-service.json
- BE/contracts/openapi/corebank-service.json
- BE/corebank-service/build.gradle
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepGatewayReplayResponse.java
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepReplayPayload.java
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepReplayResult.java
- BE/corebank-service/src/main/java/com/fix/corebank/controller/InternalCorebankController.java
- BE/corebank-service/src/main/java/com/fix/corebank/dto/request/InternalOrderReplayRequest.java
- BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalOrderReplayResponse.java
- BE/corebank-service/src/main/java/com/fix/corebank/repository/OrderRepository.java
- BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderReplayService.java
- BE/corebank-service/src/main/java/com/fix/corebank/vo/InternalOrderReplayCommand.java
- BE/corebank-service/src/main/java/com/fix/corebank/vo/InternalOrderReplayResult.java
- BE/corebank-service/src/main/resources/application-openapi.yml
- BE/corebank-service/src/test/java/com/fix/corebank/controller/CorebankInternalApiSkeletonTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderReplayServiceTest.java
- _bmad-output/implementation-artifacts/6-5-manual-replay-recovery-api.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-19: Implemented Story 6.5 manual replay/recovery API across `channel-service` and `corebank-service`, synced OpenAPI contracts, and completed regression validation.
