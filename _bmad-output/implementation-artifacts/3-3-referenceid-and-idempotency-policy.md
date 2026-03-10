# Story 3.3: [FEP] ReferenceId & Idempotency Policy

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resilience engineer,
I want idempotent external request identity,
So that duplicate transmission never causes double execution.

## Acceptance Criteria

1. Given duplicate external request identity When replayed Then adapter returns existing processing context.
2. Given cross-owner duplicate misuse When validation executes Then request is rejected as unauthorized.
3. Given idempotency retention window When expired key is reused Then policy behavior is deterministic and documented.
4. Given replay-denied case When handled Then security/audit event is recorded.

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

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.3)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 3.
- 2026-03-10: `./gradlew.bat :fep-gateway:test --tests com.fix.fepgateway.contract.FepGatewayOpenApiCompatibilityTest --tests com.fix.fepgateway.integration.FepGatewayMigrationTest --tests com.fix.fepgateway.controller.FepGatewayOrderContractTest`
- 2026-03-10: `./gradlew.bat :fep-gateway:generateOpenApiDocs`
- 2026-03-10: `./gradlew.bat :fep-gateway:test :fep-gateway:verifyCommittedOpenApi`
- 2026-03-10: `./gradlew.bat :fep-gateway:test :fep-gateway:verifyCommittedOpenApi :corebank-service:test`
- 2026-03-10: `./gradlew.bat :corebank-service:test`
- 2026-03-10: `./gradlew.bat :fep-gateway:test --tests com.fix.fepgateway.contract.FepGatewayOpenApiCompatibilityTest --tests com.fix.fepgateway.integration.FepGatewayMigrationTest --tests com.fix.fepgateway.controller.FepGatewayOrderContractTest :corebank-service:test --tests com.fix.corebank.client.FepClientContractTest --tests com.fix.corebank.service.CorebankOrderServiceTest`

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Added persisted `referenceId` ownership/retention enforcement with denied replay audit events in `fep-gateway`.
- Added contract, migration, and OpenAPI coverage for same-owner replay, cross-owner rejection, expired key reuse, and request length bounds.
- Updated the canonical FEP API spec addendum and committed OpenAPI snapshot for Story 3.3 semantics.
- Re-aligned CoreBank submit response validation with the current architecture invariant that local `clOrdId` remains the canonical order identity.
- Unified correlation-id normalization in shared web support so response headers, MDC, and denied-replay audit rows preserve the same traced value.
- Added a CoreBank service-level test that pins the current outbound invariant `referenceId == clOrdId`, making the current end-to-end replay boundary explicit.
- Strengthened migration and audit assertions to verify schema contracts and denied-replay payload integrity, not just object existence.

### File List

- _bmad-output/implementation-artifacts/3-3-referenceid-and-idempotency-policy.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/fep-gateway/api-spec.md
- BE/contracts/openapi/fep-gateway.json
- BE/core-common/src/main/java/com/fix/common/web/CorrelationIdSupport.java
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepOrderResult.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderServiceTest.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/controlplane/controller/FepGatewayOrderController.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/controlplane/service/FepGatewayControlService.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/dto/request/FepOrderSubmitRequest.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/entity/GatewayOrder.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/entity/GatewaySecurityEvent.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/repository/GatewayOrderRepository.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/repository/GatewaySecurityEventRepository.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/service/GatewaySecurityEventService.java
- BE/fep-gateway/src/main/resources/db/migration/V7__add_reference_id_idempotency_policy.sql
- BE/fep-gateway/src/test/java/com/fix/fepgateway/contract/FepGatewayOpenApiCompatibilityTest.java
- BE/fep-gateway/src/test/java/com/fix/fepgateway/controller/FepGatewayClOrdIdContractTest.java
- BE/fep-gateway/src/test/java/com/fix/fepgateway/controller/FepGatewayOrderContractTest.java
- BE/fep-gateway/src/test/java/com/fix/fepgateway/integration/FepGatewayMigrationTest.java

### Change Log

- 2026-03-10: Implemented Story 3.3 submit idempotency policy, replay-denied audit persistence, and OpenAPI/documentation guardrails.
