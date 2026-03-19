# Story 8.4: [CH/AC/FEP] OpenAPI Completeness

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform consumer,
I want consistent API docs across services,
So that integration and test automation are reliable.

## Acceptance Criteria

1. Given `docs-publish.yml` succeeds on `main`, when canonical API docs endpoint (`https://<org>.github.io/<repo>/`) is accessed, then docs selector tabs for required services are reachable.
2. Given controller endpoints When docs generated Then operation summaries and response schemas are present.
3. Given error codes When docs reviewed Then common failure responses are documented.
4. Given API change When contract diff check runs Then undocumented changes fail review gate.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 8.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 1.2, Story 2.2, Story 3.1.
- Parallel execution note:
  - This story may run in parallel with Story `8.5` and Story `8.6`.
  - This story owns only backend/docs-publish/OpenAPI verification scope.
  - Do not require FE/MOB changes to complete this story.
- Required services for AC 1 and AC 4 are fixed to:
  - `Channel Service`
  - `CoreBank Service`
  - `FEP Gateway`
  - `FEP Simulator`
- Immediate known issue before implementation:
  - `cd BE && ./gradlew :corebank-service:verifyCommittedOpenApi` currently fails.
  - Generated `corebank-service` OpenAPI output omits ledger-integrity paths and some `InternalOrderResponse` fields that are still present in source.
  - Treat the first implementation task as root-cause analysis of springdoc generation drift, not a blind snapshot refresh.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Contract-diff review gate for this story is fixed to service-local `verifyCommittedOpenApi` tasks plus canonical docs bundle validation through `.github/workflows/docs-publish.yml`.
- AC 2 is satisfied only when generated specs include current controller operations and current response-schema fields, not merely when committed snapshots match.
- AC 3 must cover common failure response documentation through the shared `ApiErrorResponse` envelope and any service-local machine-code response contracts already exposed by the generated spec.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep canonical serving behavior aligned with GitHub Pages aggregation and `docs-publish.yml`; do not switch canonical docs serving to service-local Swagger UI.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Minimum verification command set:
  - `cd BE && ./gradlew :channel-service:verifyCommittedOpenApi :corebank-service:verifyCommittedOpenApi :fep-gateway:verifyCommittedOpenApi :fep-simulator:verifyCommittedOpenApi`
  - `cd BE && ./gradlew :corebank-service:test --tests com.fix.corebank.contract.CorebankOpenApiCompatibilityTest`
  - `cd BE && ./gradlew :corebank-service:test --tests com.fix.corebank.controller.CorebankProdDocsDisabledTest`
- Expected primary write scope:
  - `BE/**`
  - `.github/workflows/docs-publish.yml`
  - `BE/contracts/openapi/**`

### Story Completion Status

- Status set to `review`.
- Completion note: AC1-AC4 now pass with four-service docs bundle coverage, regenerated committed contracts, and passing OpenAPI verification gates.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 8, Story 8.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 8.
- 2026-03-19: `cd BE && npm run test:openapi-docs`
- 2026-03-19: `cd BE && ./gradlew :channel-service:refreshOpenApiDocs :corebank-service:refreshOpenApiDocs :fep-gateway:refreshOpenApiDocs :fep-simulator:refreshOpenApiDocs`
- 2026-03-19: `cd BE && ./gradlew :channel-service:verifyCommittedOpenApi :corebank-service:verifyCommittedOpenApi :fep-gateway:verifyCommittedOpenApi :fep-simulator:verifyCommittedOpenApi :channel-service:test --tests com.fix.channel.contract.ChannelOpenApiCompatibilityTest :corebank-service:test --tests com.fix.corebank.contract.CorebankOpenApiCompatibilityTest :corebank-service:test --tests com.fix.corebank.controller.CorebankProdDocsDisabledTest :fep-gateway:test --tests com.fix.fepgateway.contract.FepGatewayOpenApiCompatibilityTest :fep-simulator:test --tests com.fix.fepsimulator.contract.FepSimulatorOpenApiCompatibilityTest`

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Parallel-ready addendum added on 2026-03-19 to freeze service list, lane ownership, and root-cause-first handling of the current corebank OpenAPI drift.
- Fixed the corebank OpenAPI drift root cause by replacing fragile plugin-side file generation with a shared boot-wait-capture pipeline that starts each service on a deterministic OpenAPI port, waits for health readiness, fetches live `/v3/api-docs`, normalizes only `servers[].url`, and then verifies committed snapshots.
- Added shared OpenAPI documentation helpers in `core-common` so Channel/CoreBank/FEP Gateway/FEP Simulator emit operation summaries, JSON `ApiErrorResponse` failure responses, and auth failure tracing headers consistently when explicit annotations are absent.
- Centralized channel public/admin path policy and service-local internal-secret path policy so runtime security filters and OpenAPI auth documentation now share the same protection rules instead of drifting.
- Documented real auth contracts for protected endpoints, including `401`/`403` behavior, required `X-Internal-Secret` request headers, and `X-Correlation-Id` / `traceparent` response headers in the committed OpenAPI snapshots.
- Normalized pre-existing explicit 4xx/5xx OpenAPI annotations so committed contracts no longer publish wildcard `*/*` media types for JSON error envelopes.
- Added BE-side regression coverage for the canonical selector workflow through a checked-in docs-site assembler script/config and strengthened baseline tests so they validate summaries, schema-bearing success contracts, common failure contracts, and representative auth-failure documentation.

### File List

- BE/package.json
- BE/gradle/openapi-contract.gradle
- BE/scripts/openapi-docs-site.config.json
- BE/scripts/assemble-openapi-docs-site.mjs
- BE/tests/openapi/openapi-docs-baseline.test.js
- BE/core-common/src/main/java/com/fix/common/openapi/OpenApiDocumentationSupport.java
- BE/core-common/src/main/java/com/fix/common/openapi/OpenApiSummarySupport.java
- BE/channel-service/build.gradle
- BE/channel-service/src/main/java/com/fix/channel/config/ChannelOpenApiDocumentationConfig.java
- BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java
- BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityConfig.java
- BE/channel-service/src/main/resources/application-openapi.yml
- BE/corebank-service/build.gradle
- BE/corebank-service/src/main/java/com/fix/corebank/config/CorebankOpenApiDocumentationConfig.java
- BE/corebank-service/src/main/java/com/fix/corebank/security/CorebankInternalSecretPaths.java
- BE/corebank-service/src/main/java/com/fix/corebank/security/InternalSecretFilter.java
- BE/corebank-service/src/main/resources/application-openapi.yml
- BE/fep-gateway/build.gradle
- BE/fep-gateway/src/main/java/com/fix/fepgateway/config/FepGatewayOpenApiDocumentationConfig.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/security/FepGatewayInternalSecretPaths.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/security/InternalSecretFilter.java
- BE/fep-gateway/src/main/resources/application-openapi.yml
- BE/fep-simulator/build.gradle
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/config/FepSimulatorOpenApiDocumentationConfig.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/security/FepSimulatorInternalSecretPaths.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/security/InternalSecretFilter.java
- BE/fep-simulator/src/main/resources/application-openapi.yml
- BE/contracts/openapi/channel-service.json
- BE/contracts/openapi/corebank-service.json
- BE/contracts/openapi/fep-gateway.json
- BE/contracts/openapi/fep-simulator.json
- _bmad-output/implementation-artifacts/8-4-openapi-completeness.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-19: Replaced fragile service-local OpenAPI generation with a shared boot-wait-capture verification pipeline, centralized auth/error OpenAPI documentation helpers and security path rules, normalized wildcard error media types to `application/json`, added canonical docs-site assembler coverage, and regenerated the committed Channel/CoreBank/FEP Gateway/FEP Simulator contract snapshots.
