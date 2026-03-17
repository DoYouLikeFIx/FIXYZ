# Story 6.2: [FEP] Retry Boundary Policy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a systems architect,
I want clear retry boundaries,
So that non-idempotent paths are not retried dangerously.

## Acceptance Criteria

1. Given retriable status query failure on the FEP status-query lane (`FepClient.queryOrderStatus` / `GET /internal/v1/orders/{clOrdId}/requery`) When policy applies Then bounded retry executes only on that status-query path with explicit max-attempt and backoff configuration.
2. Given non-retriable execution path (`CorebankOrderService.createFreshOrder` -> `FepClient.submitOrder`, and channel `OrderExecutionService` -> `CorebankClient.executeOrder`) When failure occurs Then no automatic duplicate execution retry occurs and the single-write/idempotent submit contract remains unchanged.
3. Given retry exhausted on the status-query lane When final result is returned Then classification reuses the existing retry metadata contract (`retriable`, `escalationRequired`, `attemptCount`, `maxRetryCount`) and preserves stable `message` / `externalSyncStatus` semantics.
4. Given policy review When runbook checked Then `docs/ops/fep-retry-boundary-policy.md` documents the retriable/non-retriable matrix, owner boundary, retry budget/backoff, and escalation handoff to follow-on recovery stories.

## Tasks / Subtasks

- [x] Implement status-query-only bounded retry policy (AC: 1)
  - [x] Add explicit retry settings for status-query attempts/backoff in corebank configuration
  - [x] Apply retry orchestration only around the requery/status lane, not as a global RestClient/FepClient policy
  - [x] Add automated tests proving bounded retry stops at configured max attempts
- [x] Preserve no-retry submit/execution boundary (AC: 2)
  - [x] Add regression coverage proving submit path still performs at most one outbound submit call per execution request
  - [x] Keep channel `CorebankClient` and channel `OrderExecutionService` free of automatic retry additions
- [x] Reuse existing retry metadata contract for exhausted requery outcomes (AC: 3)
  - [x] Reuse `InternalOrderResult` / `InternalOrderResponse` fields rather than introducing a new response shape
  - [x] Add automated tests for retriable, exhausted, and non-retriable classifications
- [x] Document retry boundary runbook and matrix (AC: 4)
  - [x] Add or update `docs/ops/fep-retry-boundary-policy.md`
  - [x] Capture retriable/non-retriable operation matrix and follow-on owner handoff

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 6.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 6.1.
- Story 6.1 is already `done` and established the separate `fep-submit` and `fep-status` circuit breaker lanes plus the BE Gradle-root QA gate.
- Story 6.4 depends on this story and should consume the retry boundary defined here rather than redefining retry eligibility.

### Implementation Scope Guardrails

- This story defines retry boundaries for the FEP integration contract. It does not introduce scheduler-driven recovery loops, queue scanning, or manual replay endpoints. Those belong to Story 6.4 and Story 6.5.
- This story must not add automatic retry to non-idempotent execution paths:
  - `BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderService.java#createFreshOrder`
  - `BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java#submitOrder`
  - `BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java#execute`
- Channel order-session state reconciliation to `REQUERYING` / `ESCALATED` remains follow-on work for Story 6.4 / Story 9.3. Do not expand this story into channel FSM changes unless required to prevent a direct contract break.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Reuse the existing corebank requery contract instead of inventing a new retry response:
  - `BE/corebank-service/src/main/java/com/fix/corebank/vo/InternalOrderResult.java`
  - `BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalOrderResponse.java`
  - `BE/corebank-service/src/main/java/com/fix/corebank/dto/request/InternalOrderRequeryRequest.java`
- Restrict bounded retry to the status-query lane currently implemented by:
  - `BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderService.java#requeryOrder`
  - `BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java#queryOrderStatus`
- Preserve the current submit-path safety rule: a failed `submitOrder` call may update the persisted order's `external_sync_status`, but it must not automatically re-submit the outbound execution request.
- Keep the existing metadata meanings stable:
  - `retriable=true` only when another status query is allowed
  - `escalationRequired=true` only when retry budget is exhausted or the result is terminally non-retriable
  - `attemptCount` remains 1-based and scheduler-facing
  - `maxRetryCount` remains sourced from configuration and returned verbatim in exhausted/follow-up responses
- If additional retry config is required, keep it in corebank configuration and separate from the circuit breaker settings already established in Story 6.1.

### BE Integration Points

- Primary implementation lane:
  - `BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderService.java`
  - `BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderPersistenceService.java`
- Supporting DTO/contract lane:
  - `BE/corebank-service/src/main/java/com/fix/corebank/dto/request/InternalOrderRequeryRequest.java`
  - `BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalOrderResponse.java`
  - `BE/corebank-service/src/main/java/com/fix/corebank/vo/InternalOrderResult.java`
- Guardrail-only references that must remain no-retry:
  - `BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java`
  - `BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java`
  - `BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java`

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Respect the architecture decision that channel-service `CorebankClient` has no circuit breaker / retry layer. Retry policy defined in this story must not leak upward into the channel lane.
- Respect the existing separation between `fep-submit` and `fep-status` circuit breaker instances. Status-query retry must not collapse those two lanes into one shared retry/circuit policy.
- Preserve the current local source-of-truth rule: submit-side canonical order persistence remains single-write and idempotent by `clOrdId`; retry applies only to read/reconciliation semantics, not duplicate external execution.

### Previous Story Intelligence

- Story 6.1 already validated:
  - `fep-submit` and `fep-status` are independent circuit breaker instances in `BE/corebank-service/src/main/resources/application.yml`
  - timeout classification is stable (`FEP-002` / operator code `TIMEOUT`)
  - circuit-open classification is stable (`FEP-001` / operator code `CIRCUIT_OPEN`)
- Reuse existing test baselines instead of replacing them:
  - `BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderServiceTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java`
- Existing requery tests already cover metadata shape and escalation thresholds; extend them for bounded retry execution rather than creating a second competing contract path.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Minimum required automated coverage:
  - Unit: status-query retry executes only up to configured max attempts and stops early on non-retriable outcomes
  - Unit: submit path performs no automatic retry when `submitOrder` throws
  - Integration: `/internal/v1/orders/{clOrdId}/requery` returns stable retry metadata after transient failure and after retry exhaustion
  - Integration: `fep-status` retry behavior does not affect `fep-submit` availability or call counts
- Preferred file candidates:
  - `BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderServiceTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java` only if contract serialization/headers change
- Add at least one explicit regression assertion that `FepClient.submitOrder` is invoked once for a failing execution request.

### QA Gate Execution Standard

- Use BE Gradle-root execution as the canonical verification path for this story:
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :corebank-service:test --tests com.fix.corebank.service.CorebankOrderServiceTest --no-daemon`
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :corebank-service:test --tests com.fix.corebank.integration.CorebankExternalErrorFlowIntegrationTest --no-daemon`
- If API contract fixtures change, also run:
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :corebank-service:test --tests com.fix.corebank.client.FepClientContractTest --no-daemon`

### Documentation Output

- Produce or update `docs/ops/fep-retry-boundary-policy.md`.
- The document must include:
  - Operation matrix: `submitOrder`, `queryOrderStatus`, scheduler requery, manual replay
  - Retry eligibility by failure code/result (`FEP_GATEWAY_TIMEOUT`, `FEP_GATEWAY_UNAVAILABLE`, terminal reject, malformed, filled/canceled)
  - Max attempts and backoff source of truth
  - Escalation trigger and downstream owner (`Story 6.4`, `Story 6.5`, `Story 9.3`)
  - Explicit statement that non-idempotent submit/execution paths are no-retry

### Story Completion Status

- Status set to `done`.
- Completion note: Story 6.2 retry-boundary implementation, review follow-up fixes, regression coverage, and runbook output are complete.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 6.
- Reviewed current implementation contracts in `CorebankOrderService`, `FepClient`, `InternalOrderResult`, `InternalOrderResponse`, and channel execution flow to anchor retry-boundary scope.
- Cross-checked Story 6.1 completion artifact and existing corebank unit/integration tests to reuse established resilience patterns.
- Implemented bounded retry inside `CorebankOrderService.requeryOrder` only, with dedicated `recovery.status-query.*` settings and no submit-path retry additions.
- Verified with `.\gradlew.bat :corebank-service:test --tests com.fix.corebank.service.CorebankOrderServiceTest --tests com.fix.corebank.integration.CorebankExternalErrorFlowIntegrationTest --no-daemon`.

### Completion Notes List

- Added status-query-only bounded retry with explicit max-attempt/backoff configuration in corebank service configuration.
- Kept submit and channel execution lanes free of automatic retry and added regression assertions that failing submit still issues a single outbound call.
- Extended unit and integration coverage for retry success, retry exhaustion, non-retriable stop conditions, and stable retry metadata reuse.
- Applied review follow-up fixes for mixed-failure message stability, stale terminal-state protection, and explicit non-retriable single-call guarantees.
- Hardened requery persistence with compare-and-set style state updates, fail-fast retry config validation, and missing-row safe failure handling.
- Removed corebank-service OpenAPI QA noise by fixing Gradle task deprecations and openapi-profile H2/JPA warnings, then re-ran `:corebank-service:check`.
- Added `docs/ops/fep-retry-boundary-policy.md` with the operation matrix, retry eligibility rules, and escalation handoff ownership.
- Re-ran targeted tests, full `:corebank-service:test`, and `:corebank-service:check --warning-mode all` after the final adversarial review follow-up.

### File List

- C:/Users/SSAFY/FIXYZ/BE/corebank-service/build.gradle
- C:/Users/SSAFY/FIXYZ/BE/corebank-service/src/main/java/com/fix/corebank/repository/OrderRepository.java
- C:/Users/SSAFY/FIXYZ/BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderPersistenceService.java
- C:/Users/SSAFY/FIXYZ/BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderService.java
- C:/Users/SSAFY/FIXYZ/BE/corebank-service/src/main/resources/application-openapi.yml
- C:/Users/SSAFY/FIXYZ/BE/corebank-service/src/main/resources/application.yml
- C:/Users/SSAFY/FIXYZ/BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderServiceTest.java
- C:/Users/SSAFY/FIXYZ/BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java
- C:/Users/SSAFY/FIXYZ/docs/ops/fep-retry-boundary-policy.md
- C:/Users/SSAFY/FIXYZ/_bmad-output/implementation-artifacts/6-2-retry-boundary-policy.md

## Senior Developer Review (AI)

### Review Date

- 2026-03-16

### Outcome

- Approved after review follow-up fixes.

### Notes

- Preserved the first retriable status-query failure when bounded retry ends in mixed timeout/unavailable sequences so requery messaging stays stable.
- Refreshed persisted order state between retry attempts and prevented stale non-terminal requery results from overwriting a terminal status reached by another worker.
- Added explicit regression coverage for non-retriable single-call behavior, retry-stop on terminalization, and stable retry metadata/call counts.
- Added compare-and-set state persistence and real concurrent requery regression coverage to close the last stale-overwrite race after the final refresh.

## Change Log

- 2026-03-16: Completed code-review follow-up for Story 6.2, fixed retry-semantics edge cases, and re-ran targeted corebank unit/integration tests successfully.
- 2026-03-16: Fixed `:corebank-service:check` warning/deprecation follow-ups in OpenAPI generation and openapi profile configuration.
- 2026-03-16: Closed adversarial-review follow-ups for compare-and-set requery persistence, mixed-failure/runbook clarity, and structural OpenAPI snapshot comparison.
- 2026-03-16: Re-verified the final 6.2 patch set with targeted tests, full `corebank-service` tests, and `check`; no additional high/medium findings remained in scope.
