# Story 3.2: [FEP] External Error Taxonomy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform consumer,
I want normalized external error codes,
So that upstream systems handle failures consistently.

## Acceptance Criteria

1. Given FEP rejection/system errors When adapter receives them Then internal error taxonomy is applied deterministically.
2. Given unmapped FEP code When received Then fallback unknown-external code is returned.
3. Given mapped external error When propagated to channel Then user-facing message key and operator code are both available.
4. Given taxonomy table update When regression test runs Then mapping matrix assertions pass.

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
- Completion note: External error taxonomy is implemented, production propagation paths are covered, and contracts are synchronized.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 3.
- `./gradlew.bat :core-common:test :corebank-service:test --tests com.fix.common.error.CoreCommonContractTest --tests com.fix.corebank.client.FepClientContractTest --tests com.fix.corebank.client.FepExternalErrorTaxonomyTest --tests com.fix.corebank.controller.CorebankInternalApiSkeletonTest`
- `./gradlew.bat :channel-service:test --tests com.fix.channel.controller.ChannelErrorContractTest`
- `./gradlew.bat :corebank-service:test --tests com.fix.corebank.contract.CorebankOpenApiCompatibilityTest --tests com.fix.corebank.controller.CorebankInternalApiSkeletonTest`
- `./gradlew.bat :corebank-service:generateOpenApiDocs`
- `./gradlew.bat test`

### Completion Notes List

- Added deterministic FEP external error taxonomy mapping for gateway/system/rejection codes with fallback unknown-external handling.
- Extended shared error envelopes and exception types to surface `userMessageKey` and `operatorCode` without changing existing non-FEP error behavior.
- Added regression coverage for the full documented FEP RC matrix at the adapter layer, including submit and requery failure paths.
- Added a real channel-to-corebank order execution path so mapped external metadata is proven on the production channel boundary instead of a synthetic test controller.
- Refreshed the committed channel/corebank OpenAPI snapshots and added build-time verification so generated and committed contracts cannot drift silently.
- Added backend end-to-end style integration coverage for both submit and requery error translation through the real corebank HTTP boundary against WireMock.

### File List

- BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java
- BE/channel-service/src/main/java/com/fix/channel/controller/OrderController.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/OrderCreateRequest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/OrderResponse.java
- BE/channel-service/src/main/java/com/fix/channel/exception/GlobalExceptionHandler.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderExecuteCommand.java
- BE/channel-service/src/main/java/com/fix/channel/vo/OrderExecuteResult.java
- BE/channel-service/src/test/java/com/fix/channel/contract/ChannelOpenApiCompatibilityTest.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- BE/contracts/openapi/channel-service.json
- BE/contracts/openapi/corebank-service.json
- BE/core-common/build.gradle
- BE/core-common/src/main/java/com/fix/common/error/ApiErrorResponse.java
- BE/core-common/src/main/java/com/fix/common/error/BusinessException.java
- BE/core-common/src/main/java/com/fix/common/error/ErrorCode.java
- BE/core-common/src/main/java/com/fix/common/error/ErrorMetadata.java
- BE/core-common/src/main/java/com/fix/common/error/FixException.java
- BE/core-common/src/main/java/com/fix/common/error/SystemException.java
- BE/core-common/src/test/java/com/fix/common/error/CoreCommonContractTest.java
- BE/corebank-service/build.gradle
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepExternalErrorTaxonomy.java
- BE/corebank-service/src/main/java/com/fix/corebank/exception/GlobalExceptionHandler.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepExternalErrorTaxonomyTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/contract/CorebankOpenApiCompatibilityTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/controller/CorebankInternalApiSkeletonTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/support/TestStubFepClient.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/exception/GlobalExceptionHandler.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/exception/GlobalExceptionHandler.java
- _bmad-output/implementation-artifacts/3-2-external-error-taxonomy.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-09: Implemented external error taxonomy mapping, added envelope metadata propagation, and covered the mapping matrix plus propagation flows with automated tests.
- 2026-03-09: Closed QA findings by adding channel-boundary metadata coverage and syncing the committed corebank OpenAPI contract with the generated document.
- 2026-03-09: Added backend end-to-end coverage for mapped and fallback external FEP errors through the real corebank HTTP boundary.
- 2026-03-10: Aligned the adapter with the canonical `rc` error shape, added real channel-to-corebank order propagation coverage, and enforced exact OpenAPI snapshot verification in the build.
