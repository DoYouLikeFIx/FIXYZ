# Story 3.4: [FEP] FEP Status Query API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a recovery scheduler,
I want status requery for external orders,
So that UNKNOWN/EXECUTING outcomes can be reconciled.

## Acceptance Criteria

1. Given known external reference When status API is queried Then latest known status is returned in normalized shape.
2. Given unknown external reference When status API is queried Then UNKNOWN result is returned without schema drift.
3. Given temporary external timeout When status query fails Then retriable classification is returned.
4. Given repeated query from scheduler When threshold is exceeded Then escalation signal is produced.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 3.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 3.1.

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

- Status set to `done`.
- Completion note: Implementation and review remediation for Story 3.4 are complete.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `./gradlew.bat :corebank-service:generateOpenApiDocs`
- `./gradlew.bat :corebank-service:test --tests "com.fix.corebank.service.CorebankOrderServiceTest" --tests "com.fix.corebank.controller.CorebankInternalApiSkeletonTest" --tests "com.fix.corebank.integration.CorebankExternalErrorFlowIntegrationTest" --tests "com.fix.corebank.contract.CorebankOpenApiCompatibilityTest" --rerun-tasks`
- `./gradlew.bat :corebank-service:test --tests com.fix.corebank.client.FepClientContractTest --rerun-tasks`
- `./gradlew.bat :corebank-service:test --rerun-tasks`

### Completion Notes List

- Added scheduler-facing requery attempt tracking with normalized retry/escalation metadata (`message`, `retriable`, `escalationRequired`, `attemptCount`, `maxRetryCount`) for unresolved and transient FEP status outcomes.
- Preserved normalized response shape for known and unknown external statuses while validating `attemptCount >= 1` and making the retry threshold configurable via `recovery.max-retry-count`.
- Synced the committed Corebank OpenAPI contract with the generated requery schema changes, including a real `attemptCount` query parameter on `GET /internal/v1/orders/{clOrdId}/requery`.
- Expanded unit, MVC, integration, and contract coverage for AC1-AC4 and replaced one brittle inline-mock test dependency with a Java 25-safe stub implementation.
- Isolated the external-error integration tests by resetting the dedicated `fep-submit` and `fep-status` circuit breakers between test methods so expected gateway-failure scenarios do not contaminate later assertions.
- Verified the full `corebank-service` test suite passes after the Story 3.4 changes.
- Resolved code review follow-ups by separating submit/status circuit breakers, preventing transient requery failures from marking terminal local orders as retriable, and tightening the OpenAPI contract check to require a real `attemptCount` query parameter.

### File List

- BE/contracts/openapi/corebank-service.json
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java
- BE/corebank-service/src/main/java/com/fix/corebank/controller/InternalCorebankController.java
- BE/corebank-service/src/main/java/com/fix/corebank/dto/request/InternalOrderRequeryRequest.java
- BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalOrderResponse.java
- BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderService.java
- BE/corebank-service/src/main/java/com/fix/corebank/vo/InternalOrderRequeryCommand.java
- BE/corebank-service/src/main/java/com/fix/corebank/vo/InternalOrderResult.java
- BE/corebank-service/src/main/resources/application.yml
- BE/corebank-service/src/test/java/com/fix/corebank/contract/CorebankOpenApiCompatibilityTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/controller/CorebankInternalApiSkeletonTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderServiceTest.java
- _bmad-output/implementation-artifacts/3-4-fep-status-query-api.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-10: Implemented Story 3.4 status requery normalization with scheduler retry/escalation signaling, synced the Corebank OpenAPI contract, added AC1-AC4 regression coverage, and moved the story to `review`.
- 2026-03-10: Resolved code review findings by decoupling FEP submit/status circuit breakers, suppressing retries for terminal local orders on transient requery failures, tightening the `attemptCount` OpenAPI contract shape, and moving the story to `done`.
- 2026-03-10: Confirmed the published requery contract exposes `attemptCount` as a real query parameter, refreshed the Story 3.4 artifact notes, and re-verified the scoped `corebank-service` regression paths.
