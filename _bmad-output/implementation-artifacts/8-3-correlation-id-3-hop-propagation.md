# Story 8.3: [CH/FEP] Correlation-id 3-hop Propagation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an observability owner,
I want consistent correlation id propagation across CH -> AC -> FEP,
So that end-to-end traces are reconstructable.

## Acceptance Criteria

1. Given inbound request without correlation id When channel filter runs Then new id is generated and returned in response header.
2. Given internal downstream calls on the business path When `channel-service` calls `corebank-service` and `corebank-service` calls `fep-gateway` Then the same `X-Correlation-Id` and `traceparent` are propagated unchanged.
3. Given an explicit internal diagnostic probe from `fep-gateway` to `fep-simulator` When the probe runs with supplied tracing headers Then the simulator internal boundary preserves those exact values and emits operator-readable receipt logs.
4. Given propagation regression tests When CI runs Then hop-by-hop business-path assertions and the explicit gateway-to-simulator diagnostic-boundary assertions pass.

## Tasks / Subtasks

- [x] Preserve and verify the existing ingress correlation baseline instead of re-implementing it (AC: 1, 2)
  - [x] Keep `channel-service` responsible for generating `X-Correlation-Id` when the inbound header is absent
  - [x] Keep downstream services preserving a provided correlation id on ingress and unauthorized internal-secret paths
- [x] Prove exact header forwarding across the runtime chain (AC: 2, 4)
  - [x] Keep `channel-service -> corebank-service` forwarding the same `X-Correlation-Id`
  - [x] Keep `corebank-service -> fep-gateway` forwarding the same `X-Correlation-Id`
  - [x] Add one explicit `fep-gateway -> fep-simulator` internal diagnostic boundary that forwards supplied tracing headers without modifying the order hot path
- [x] Add hop-by-hop propagation regressions instead of synthetic full-chain claims (AC: 2, 4)
  - [x] Assert the business path keeps one correlation context through `Channel -> CoreBank -> FEP Gateway`
  - [x] Assert the explicit gateway diagnostic probe preserves the supplied context through the simulator internal boundary
  - [x] Keep the existing module-level correlation tests green while adding the focused proofs
- [x] Add trace-reconstruction evidence for observability validation (AC: 3)
  - [x] Document one reproducible operator path for the business-path hop-by-hop gate plus the gateway-to-simulator diagnostic probe
  - [x] Ensure the evidence path is suitable for CI or release-verification use

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 8.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Overlap note: `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` already captured much of the correlation/logging baseline. Use it as implementation guidance and duplication-prevention context, not as story ID authority.
- Depends on: Story 3.1, Story 2.2, Story 4.3.
- Dependency status check:
  - Story `3.1` is `done` and already provides the `FepClient` contract baseline.
  - Story `2.2` is `done` and already proves `channel-service -> corebank-service` header forwarding patterns in client tests.
  - Story `4.3` is `done` and is the latest reviewed backend execution-path baseline for the authenticated channel execution boundary.
- Existing implementation baseline already present in code:
  - `BE/channel-service/src/main/java/com/fix/channel/filter/CorrelationIdFilter.java`
  - `BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java`
  - `BE/corebank-service/src/main/java/com/fix/corebank/filter/CorrelationIdFilter.java`
  - `BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java`
  - `BE/fep-gateway/src/main/java/com/fix/fepgateway/filter/CorrelationIdFilter.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/filter/CorrelationIdFilter.java`
- Primary gap this story should close:
  - Do not rebuild basic correlation plumbing that is already green.
  - Add or tighten hop-by-hop regressions for the existing business path.
  - Add one explicit internal diagnostic boundary for `fep-gateway -> fep-simulator` so the simulator boundary can be verified without injecting synthetic calls into the order hot path.
  - Keep the operator evidence path honest about what is business-path coverage versus explicit diagnostics coverage.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Preserve the canonical header names already used in the codebase:
  - `CommonHeaders.X_CORRELATION_ID`
  - `CommonHeaders.TRACEPARENT`
- `channel-service` remains the external ingress owner for correlation-id generation when the header is absent.
- Downstream services must reuse the incoming value. They must not mint a new correlation id once the request is already inside the CH -> AC -> FEP chain.
- Treat the existing per-service `CorrelationIdFilter` classes as the current implementation baseline. Do not move correlation responsibilities into `InternalSecretFilter` unless a failing test proves a concrete bug.
- The business-path proof for this story is limited to the existing runtime chain that actually traverses:
  - `channel-service`
  - `corebank-service`
  - `fep-gateway`
- `fep-simulator` coverage for this story is satisfied through an explicit internal diagnostic probe. It is not part of the canonical order submission flow and must not be implemented by inserting synthetic network calls into `FixDataPlaneService` or other hot paths.
- AC 3 is not satisfied by code inspection alone. It requires a reproducible evidence path that can search logs or captured test output by a single correlation id.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Architecture intent is governed by `_bmad-output/planning-artifacts/architecture.md` Q-7-11, but the live codebase already realizes that intent through service-local `CorrelationIdFilter` implementations on all four backend services.
- Preserve the current filter ordering pattern where correlation handling runs before downstream request processing and unauthorized responses still emit `X-Correlation-Id`.
- No FE or MOB scope belongs in this story. The frontend/mobile consumers are handled by Stories `8.5` and `8.6`.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/build.gradle`
  - `BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java`
  - `BE/corebank-service/build.gradle`
  - `BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientPropagationTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankCorrelationPropagationIntegrationTest.java`
  - `BE/fep-gateway/build.gradle`
  - `BE/fep-gateway/src/main/java/com/fix/fepgateway/controller/FepGatewayTraceDiagnosticController.java`
  - `BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/fix/FepSimulatorTraceBridgeClient.java`
  - `BE/fep-gateway/src/main/resources/application*.yml`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/dataplane/fix/FepSimulatorTraceBridgeClientTest.java`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/integration/FepGatewaySimulatorTraceBridgeIntegrationTest.java`
  - `BE/fep-simulator/build.gradle`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/controller/FepSimulatorController.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/controller/FepSimulatorInternalPingLoggingTest.java`
  - `BE/docs/testing/correlation-id-propagation.md`
  - `BE/*/src/test/**`
- Favor extending existing correlation-focused test classes before creating brand new fragmented test fixtures.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Existing regression anchors that must remain green:
  - `BE/channel-service/src/test/java/com/fix/channel/filter/CorrelationIdFilterTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/filter/CorrelationIdFilterTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/security/InternalSecretFilterTest.java`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/filter/CorrelationIdFilterTest.java`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/security/InternalSecretFilterTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/filter/CorrelationIdFilterTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/security/InternalSecretFilterTest.java`
- Required new or tightened proof for this story:
  - One regression that demonstrates the same correlation id and `traceparent` crossing the authenticated `channel-service -> corebank-service -> fep-gateway` runtime chain hop by hop.
  - One regression that demonstrates the explicit `fep-gateway -> fep-simulator` diagnostic boundary preserves supplied tracing headers.
  - One reproducible evidence path for AC 3 that distinguishes business-path verification from the explicit diagnostic probe.
- Minimum verification command set to keep attached to the implementation notes:
  - `./gradlew :channel-service:correlationPropagationTests`
  - `./gradlew :corebank-service:correlationPropagationTests`
  - `./gradlew :fep-gateway:correlationPropagationTests`
  - `./gradlew :fep-simulator:correlationPropagationTests`
  - `./gradlew correlationIdPropagationChecks`
- If AC 3 is verified with Docker Compose evidence, keep the command reproducible and grep/search by one concrete correlation id value across:
  - `channel-service`
  - `corebank-service`
  - `fep-gateway`
  - `fep-simulator`
  - and explicitly state whether the simulator evidence came from the diagnostic probe rather than the business order flow

### Quinn Reinforcement Checks

- Deduplication gate:
  - Do not recreate correlation generation/filter plumbing that is already implemented and tested.
- Chain-integrity gate:
  - The same correlation id must survive all business-path hops without mutation once generated or accepted at channel ingress.
- Unauthorized-path gate:
  - Internal-secret failures must still surface the provided or generated `X-Correlation-Id`.
- Evidence gate:
  - Story completion must include both automated regression proof and one operator-readable trace reconstruction path that does not overclaim a single four-service runtime flow.

### Definition of Done

- AC 1 through AC 4 are covered by automated tests or reproducible release evidence.
- Existing module-level correlation tests remain green.
- The business path proves the same correlation id across `Channel -> CoreBank -> FEP Gateway`.
- The gateway-to-simulator boundary is validated only through the explicit internal diagnostic probe and its focused regressions.
- No downstream service introduces a second correlation id generator for already-correlated internal traffic.
- One reproducible log search or compose-based verification path exists for NFR-L1 trace reconstruction.
- Story file `File List`, `Debug Log References`, and `Completion Notes List` are updated with the real touched files and evidence commands during implementation.

### Story Completion Status

- Status set to `review`.
- Completion note: Story is now in `review` with the final implemented scope aligned to hop-by-hop business-path verification plus the explicit gateway-to-simulator diagnostic boundary.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 8, Story 8.3)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (correlation/logging baseline and overlap guardrail)
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 8.
- 2026-03-19: SM validation pass expanded the story with concrete correlation-chain anchors, regression expectations, and duplication-prevention guidance.
- 2026-03-19: `./gradlew :channel-service:correlationPropagationTests :corebank-service:correlationPropagationTests :fep-gateway:correlationPropagationTests :fep-simulator:correlationPropagationTests`
- 2026-03-19: `./gradlew correlationIdPropagationChecks`
- 2026-03-19: `./gradlew :fep-gateway:verifyCommittedOpenApi :fep-simulator:verifyCommittedOpenApi`

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Story context now identifies the existing correlation baseline and narrows the implemented scope to business-path hop verification plus an explicit simulator diagnostic boundary.
- The final implementation does not inject synthetic simulator calls into the order hot path. `channel-service -> corebank-service -> fep-gateway` remains the verified business path, and `fep-gateway -> fep-simulator` is covered through a dedicated internal diagnostic endpoint.
- Added focused channel/corebank/gateway/simulator propagation suites, aggregate Gradle verification tasks, OpenAPI snapshot verification for the new internal diagnostic surface, and an operator-facing runbook that clearly separates business-path evidence from diagnostic-boundary evidence.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/8-3-correlation-id-3-hop-propagation.md
- /Users/yeongjae/fixyz/BE/build.gradle
- /Users/yeongjae/fixyz/BE/README.md
- /Users/yeongjae/fixyz/BE/channel-service/build.gradle
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/build.gradle
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientPropagationTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankCorrelationPropagationIntegrationTest.java
- /Users/yeongjae/fixyz/BE/fep-gateway/build.gradle
- /Users/yeongjae/fixyz/BE/fep-gateway/src/main/java/com/fix/fepgateway/controller/FepGatewayTraceDiagnosticController.java
- /Users/yeongjae/fixyz/BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/fix/FepSimulatorTraceBridgeClient.java
- /Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application-local.yml
- /Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application-test.yml
- /Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application.yml
- /Users/yeongjae/fixyz/BE/fep-gateway/src/test/java/com/fix/fepgateway/dataplane/fix/FepSimulatorTraceBridgeClientTest.java
- /Users/yeongjae/fixyz/BE/fep-gateway/src/test/java/com/fix/fepgateway/integration/FepGatewaySimulatorTraceBridgeIntegrationTest.java
- /Users/yeongjae/fixyz/BE/fep-simulator/build.gradle
- /Users/yeongjae/fixyz/BE/fep-simulator/src/main/java/com/fix/fepsimulator/controller/FepSimulatorController.java
- /Users/yeongjae/fixyz/BE/fep-simulator/src/test/java/com/fix/fepsimulator/controller/FepSimulatorInternalPingLoggingTest.java
- /Users/yeongjae/fixyz/BE/docs/testing/correlation-id-propagation.md

### Change Log

- 2026-03-19: Strengthened story readiness with concrete code/test anchors, overlap guardrails against Epic 7 duplication, and explicit AC 3/AC 4 evidence expectations.
- 2026-03-19: Reworked implementation scope to keep the business path limited to `channel-service -> corebank-service -> fep-gateway`, moved simulator verification onto an explicit internal diagnostic boundary, removed hot-path synthetic bridging claims, and updated the verification/runbook language to match the final code.
