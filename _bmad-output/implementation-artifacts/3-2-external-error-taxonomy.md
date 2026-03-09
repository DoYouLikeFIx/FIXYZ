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

- Status set to `ready-for-dev`.
- Completion note: Epic 3 story context prepared from canonical planning artifact.

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
- Added regression coverage for the taxonomy matrix, adapter-level gateway error translation, upstream propagation through the corebank internal API, and channel-boundary metadata exposure via contract testing.
- Refreshed the committed corebank OpenAPI snapshot and added a compatibility test so `userMessageKey` and `operatorCode` stay documented.
- Added a backend end-to-end style integration test that drives the real corebank HTTP endpoint through `FepClient` against WireMock so mapped and fallback external errors are verified beyond stubbed client tests.

### File List

- BE/channel-service/src/main/java/com/fix/channel/config/GlobalExceptionHandler.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- BE/contracts/openapi/corebank-service.json
- BE/core-common/build.gradle
- BE/core-common/src/main/java/com/fix/common/error/ApiErrorResponse.java
- BE/core-common/src/main/java/com/fix/common/error/BusinessException.java
- BE/core-common/src/main/java/com/fix/common/error/ErrorCode.java
- BE/core-common/src/main/java/com/fix/common/error/ErrorMetadata.java
- BE/core-common/src/main/java/com/fix/common/error/FixException.java
- BE/core-common/src/main/java/com/fix/common/error/SystemException.java
- BE/core-common/src/test/java/com/fix/common/error/CoreCommonContractTest.java
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepExternalErrorTaxonomy.java
- BE/corebank-service/src/main/java/com/fix/corebank/config/GlobalExceptionHandler.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepExternalErrorTaxonomyTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/contract/CorebankOpenApiCompatibilityTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/controller/CorebankInternalApiSkeletonTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/support/TestStubFepClient.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/config/GlobalExceptionHandler.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/config/GlobalExceptionHandler.java
- _bmad-output/implementation-artifacts/3-2-external-error-taxonomy.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-09: Implemented external error taxonomy mapping, added envelope metadata propagation, and covered the mapping matrix plus propagation flows with automated tests.
- 2026-03-09: Closed QA findings by adding channel-boundary metadata coverage and syncing the committed corebank OpenAPI contract with the generated document.
- 2026-03-09: Added backend end-to-end coverage for mapped and fallback external FEP errors through the real corebank HTTP boundary.
