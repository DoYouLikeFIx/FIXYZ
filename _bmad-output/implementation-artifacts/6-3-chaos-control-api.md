# Story 6.3: [FEP] Chaos Control API

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operations engineer,
I want rule-based runtime chaos controls for the FEP simulator,
so that resilience scenarios can be demonstrated and verified without changing production behavior.

## Acceptance Criteria

1. Given a valid internal control request to `PUT /fep-internal/rules` with canonical fields (`action`, `targetSymbol`, `targetExchange`, `ttlSeconds`, `matchAmount`, `probability`) When the request is accepted Then the simulator stores and activates the rule, returns the canonical success envelope, and exposes `ruleId`, `action`, `targetSymbol`, `targetExchange`, `matchAmount`, `probability`, `appliedAt`, and `expiresAt`.
2. Given an active chaos rule whose `action` is one of `APPROVE`, `DECLINE`, `IGNORE`, `DISCONNECT`, `MALFORMED_RESP`, or `TIMEOUT` When matching traffic is processed before `ttlSeconds` expiry Then simulator behavior reflects that action for the matching scope only.
3. Given a request to `GET /fep-internal/rules` with a valid internal secret When the endpoint is called Then the canonical success envelope returns `activeRules[]` containing all non-expired active rules with their canonical fields.
4. Given a request to `DELETE /fep-internal/rules` with a valid internal secret When the request succeeds Then all active rules are cleared, the canonical success envelope is returned, and subsequent simulator behavior resumes normal handling until a new rule is applied.
5. Given a `PUT`, `GET`, or `DELETE` request to `/fep-internal/rules` without a valid `X-Internal-Secret` When the request is processed Then it is denied with the stable unauthorized contract for the internal secret boundary and no rule mutation occurs.
6. Given an invalid chaos-rule payload When `PUT /fep-internal/rules` is called with unsupported `action`, out-of-range `probability`, or non-positive `ttlSeconds` Then the request is rejected with the canonical validation failure contract and no invalid rule is persisted.
7. Given a successful rule mutation or rule reset When the operation completes Then structured operational evidence is emitted with correlation-aware fields sufficient to trace who or what applied the change, what rule/action was affected, and when it expires.

## Tasks / Subtasks

- [x] Converge the simulator control surface onto the canonical internal rules API (AC: 1, 2, 3, 4, 6)
  - [x] Replace or refactor the current `/simulator/v1/rules` and `/simulator/v1/chaos` flow so the canonical behavior lives under `/fep-internal/rules`
  - [x] Implement canonical request/response DTOs and VO mapping for rule create/list/clear
  - [x] Support the canonical action enum and matching fields: `targetSymbol`, `targetExchange`, `ttlSeconds`, `matchAmount`, `probability`
  - [x] Implement TTL expiry and clear-all behavior so `DELETE /fep-internal/rules` is the only reset-to-normal mechanism
- [x] Enforce the internal-secret authorization boundary for the chaos control plane (AC: 5)
  - [x] Keep `/fep-internal/**` behind `InternalSecretFilter`
  - [x] Add regression coverage for missing and invalid `X-Internal-Secret` on rule mutation, query, and clear paths
- [x] Emit operational evidence for rule changes without coupling to future admin-session stories (AC: 7)
  - [x] Add structured logging or equivalent operational evidence in the owning simulator service
  - [x] Include rule/action, target scope, correlation ID, request source, applied timestamp, and expiry timestamp in the evidence
- [x] Add automated verification for the canonical contract and convergence path (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] Controller tests for `PUT /fep-internal/rules`, `GET /fep-internal/rules`, and `DELETE /fep-internal/rules`
  - [x] Filter tests for unauthorized requests to `/fep-internal/rules`
  - [x] Integration tests for active-rule listing, TTL expiry, and clear-all reset behavior
  - [x] Update contract/openapi compatibility coverage if the published simulator surface changes

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] Task is marked complete for integration tests (active-rule listing, TTL expiry, clear-all reset), but no integration test implementation evidence was added in this change set. Add integration/service-level tests and update completion status truthfully.
- [x] [AI-Review][HIGH] AC 2 remains partial: `resolveMatchingAction(...)` exists but has no runtime call sites in the simulator data-plane flow, so matching traffic behavior is not proven to reflect configured chaos actions.
- [x] [AI-Review][HIGH] API contract mismatch: Story source-of-truth specifies `PUT /fep-internal/rules` request body JSON, but controller/OpenAPI currently model the payload as query parameters via `@ModelAttribute`.
- [x] [AI-Review][MEDIUM] Unauthorized-path regression does not prove "no rule mutation occurs"; tests assert status code only and do not assert mutation-side effects.
- [x] [AI-Review][MEDIUM] `clearRules` computes count via `findAll().size()` before `deleteAllInBatch()`, causing unnecessary full-entity load on reset path.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 6.
- Primary source of truth for this story's API contract is `_bmad-output/planning-artifacts/fep-gateway/api-spec.md`, not the previous mode-based placeholder wording in this story file.
- Architecture confirms chaos control is a demo/control-plane use case and the canonical endpoint is `PUT /fep-internal/rules`; it is not a test-only convenience endpoint.
- Depends on: Story 3.1.
- Story 6.1 and Story 6.2 are already `done` and establish the resilience lanes this story must exercise, not replace.
- Story 6.4 and Story 6.5 should consume the rule-based control surface defined here instead of inventing another chaos-control contract.

### Implementation Scope Guardrails

- This story owns the internal FEP simulator control plane only. It does not add a channel admin proxy API, browser admin console flow, or `ROLE_ADMIN` session authorization.
- Use `X-Internal-Secret` as the authorization boundary for `/fep-internal/rules`. Do not rewrite this story into Bearer-token or admin-session auth.
- Do not introduce a parallel mode abstraction such as `NORMAL`, `TIMEOUT`, or `FAILURE`. Reset to normal behavior is achieved by clearing active rules with `DELETE /fep-internal/rules`.
- Do not couple AC 7 to Story 7.5 or Story 8.1 database-backed audit models. This story only requires structured operational evidence owned by `fep-simulator`.
- Keep the chaos control plane non-production-only per the canonical architecture intent (`@Profile("!prod")` / equivalent non-prod gating).
- Converge existing `/simulator/v1/**` scaffolding toward the canonical contract; do not leave the new behavior implemented only behind a second, divergent API surface.

### Technical Requirements

- Preserve the canonical envelope and field semantics defined in the API spec:
  - `PUT /fep-internal/rules`
  - `GET /fep-internal/rules`
  - `DELETE /fep-internal/rules`
- Canonical `action` values:
  - `APPROVE`
  - `DECLINE`
  - `IGNORE`
  - `DISCONNECT`
  - `MALFORMED_RESP`
  - `TIMEOUT`
- Canonical rule request fields:
  - `action`
  - `targetSymbol`
  - `targetExchange`
  - `ttlSeconds`
  - `matchAmount`
  - `probability`
- Canonical list response field:
  - `activeRules[]`
- Validation guardrails:
  - reject unsupported `action`
  - reject `ttlSeconds <= 0`
  - reject `probability` outside `0.0..1.0`
  - do not persist invalid rules
- Operational evidence for AC 7 must at minimum capture:
  - correlation ID
  - request URI or operation type
  - `ruleId` when applicable
  - action or clear-all operation
  - target symbol / exchange / amount scope
  - probability
  - `appliedAt`
  - `expiresAt`
- Reuse the existing simulator repository/service layer where practical, but reshape it to the canonical rule contract instead of preserving `ruleCode/action/enabled` as the primary public API.

### BE Integration Points

- Current controller surface to converge:
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/controller/FepSimulatorRuleController.java`
- Current service layer to reshape around canonical rule semantics:
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/service/FepSimulatorControlService.java`
- Current DTO/VO candidates that likely need replacement or refactor:
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/request/SimulatorRuleUpsertRequest.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/request/SimulatorRuleQueryRequest.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/request/SimulatorChaosRequest.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/response/SimulatorRuleResponse.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/response/SimulatorChaosResponse.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/vo/SimulatorRuleUpsertCommand.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/vo/SimulatorRuleQueryCommand.java`
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/vo/SimulatorChaosCommand.java`
- Existing authorization boundary that must remain authoritative:
  - `BE/fep-simulator/src/main/java/com/fix/fepsimulator/security/InternalSecretFilter.java`

### Architecture Compliance

- Respect the architecture split:
  - data plane: FIX 4.2 TCP between gateway and simulator
  - control plane: HTTP + `X-Internal-Secret` for chaos/rule management
- Follow architecture-defined module boundaries, error envelope conventions, and non-prod gating for internal control endpoints.
- Keep chaos rule semantics local to `fep-simulator`; do not leak retry, replay, or admin-session ownership concerns from other epics into this story.
- Preserve compatibility with the resilience behaviors introduced in Story 6.1 and Story 6.2. Chaos actions may trigger those paths, but this story must not redefine circuit-breaker or retry policy.

### Library / Framework Requirements

- Stay within the existing Spring Boot MVC / validation / test stack already used by `fep-simulator`.
- Reuse the current shared error-envelope support from `fix-common`; do not invent a simulator-only error shape.
- If openapi snapshots or contract tests assert endpoint paths, update those fixtures together with the canonical endpoint migration.

### File Structure Requirements

- Prefer converging the existing controller/service/test files over creating a second parallel implementation tree.
- If legacy `/simulator/v1/**` endpoints must remain temporarily for local compatibility, treat them as adapter or transitional code only; the canonical source of truth and test coverage must target `/fep-internal/rules`.
- Keep new request/response classes under the existing `dto/request`, `dto/response`, and `vo` packages unless there is a strong repo-local pattern requiring a different location.

### Previous Story Intelligence

- Story 6.1 established timeout and circuit-breaker behavior in the upstream FEP path. `TIMEOUT`, `IGNORE`, and `DISCONNECT` chaos actions should be designed to exercise those paths without changing their classification contract.
- Story 6.2 established a strict retry boundary. This story must not add automatic submit retry semantics while implementing chaos behavior.
- Current simulator code already has a rule/chaos scaffold, but it is shaped as:
  - `/simulator/v1/rules`
  - `/simulator/v1/chaos`
  - `ruleCode/action/enabled`
  That scaffold should be refactored toward the canonical rule contract instead of extended as a second public API.

### Testing Requirements

- Validate all acceptance criteria with automated tests.
- Minimum required automated coverage:
  - Controller: successful `PUT /fep-internal/rules` returns canonical fields and success envelope
  - Controller: successful `GET /fep-internal/rules` returns `activeRules[]`
  - Controller: successful `DELETE /fep-internal/rules` clears rules and resumes normal behavior
  - Negative: missing/invalid `X-Internal-Secret` returns unauthorized and leaves state unchanged
  - Negative: invalid `action`, `ttlSeconds`, and `probability` return validation failure and persist nothing
  - Integration: TTL expiry removes rules from active behavior/listing
  - Integration or service-level: successful mutation/reset emits structured operational evidence
- Preferred file candidates:
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/controller/FepSimulatorRuleControllerTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/security/InternalSecretFilterTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/integration/FepSimulatorContainersIntegrationTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/contract/FepSimulatorOpenApiCompatibilityTest.java`

### QA Gate Execution Standard

- Use BE Gradle-root execution as the canonical verification path for this story:
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :fep-simulator:test --no-daemon`
- When narrowing failures during implementation, targeted commands are acceptable:
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :fep-simulator:test --tests com.fix.fepsimulator.controller.FepSimulatorRuleControllerTest --no-daemon`
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :fep-simulator:test --tests com.fix.fepsimulator.security.InternalSecretFilterTest --no-daemon`
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :fep-simulator:test --tests com.fix.fepsimulator.integration.FepSimulatorContainersIntegrationTest --no-daemon`

### Project Structure Notes

- The current story placeholder was mode-based and under-specified. This rewrite makes the canonical rule contract explicit so the developer does not have to infer behavior from unrelated documents.
- The current codebase already contains useful simulator control scaffolding, but it does not yet match the canonical path, auth boundary, or response shapes. Treat that as migration/refactor work, not as proof that Story 6.3 is already implemented.
- No frontend, mobile, or channel-service file changes are required for this story unless contract documentation outside `fep-simulator` must be synchronized.

### Story Completion Status

- Status set to `done`.
- Completion note: Review follow-ups were resolved with second-round verification and contract synchronization.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.3)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md`
- `_bmad-output/implementation-artifacts/6-1-timeout-and-circuit-breaker.md`
- `_bmad-output/implementation-artifacts/6-2-retry-boundary-policy.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Re-analyzed the canonical chaos control contract in `_bmad-output/planning-artifacts/fep-gateway/api-spec.md`.
- Re-checked architecture guidance for the control-plane/data-plane split in `_bmad-output/planning-artifacts/architecture.md`.
- Reviewed the current `fep-simulator` controller, service, DTO, and filter scaffolding to turn the story into a convergence guide instead of a greenfield placeholder.
- Cross-checked Story 6.1 and Story 6.2 so this story does not redefine established timeout/circuit-breaker or retry-boundary semantics.
- Implemented canonical control-plane API under `/fep-internal/rules` with `PUT`, `GET`, `DELETE` and non-prod gating via `@Profile("!prod")`.
- Reworked `SimulatorRule` persistence shape to canonical fields (`ruleId`, scope, probability, applied/expires) and added TTL-based cleanup on read/mutation flows.
- Added operational evidence logging in `FepSimulatorControlService` including correlation ID, request URI/source, rule/action scope, and expiry timestamps.
- Generated fresh OpenAPI snapshot with `:fep-simulator:generateOpenApiDocs` and synced `contracts/openapi/fep-simulator.json`.
- Verified with Gradle QA gate commands:
  - `./gradlew :fep-simulator:test --tests com.fix.fepsimulator.controller.FepSimulatorRuleControllerTest --tests com.fix.fepsimulator.security.InternalSecretFilterTest --no-daemon`
  - `./gradlew :fep-simulator:test --tests com.fix.fepsimulator.contract.FepSimulatorOpenApiCompatibilityTest --no-daemon`
  - `./gradlew :fep-simulator:test --no-daemon`

### Completion Notes List

- Replaced the incorrect `NORMAL/TIMEOUT/FAILURE` mode framing with the canonical rule/action contract.
- Clarified that authorization for this story is `X-Internal-Secret`, not admin-session or `ROLE_ADMIN`.
- Defined reset-to-normal behavior as `DELETE /fep-internal/rules`.
- Made AC 7 explicit as structured operational evidence owned by `fep-simulator`, avoiding premature coupling to later audit stories.
- Added concrete implementation and test candidates so the dev agent can refactor the existing `/simulator/v1/**` scaffold toward the canonical internal API.
- Converged controller/service/DTO/VO/model layers to canonical chaos-rule semantics and removed dependency on legacy `ruleCode/enabled` public contract.
- Added validation guardrails for unsupported `action`, invalid `ttlSeconds`, and out-of-range `probability` with canonical validation error response (`VALIDATION-001`, HTTP 422).
- Added canonical response DTOs for `activeRules[]` listing and clear-all result payload.
- Updated Flyway schema/seed to persist canonical chaos-rule attributes and remain compatible with openapi-profile H2 startup.
- Updated controller/filter/contract tests to assert canonical endpoint behavior and internal-secret boundary regressions.
- Aligned `PUT /fep-internal/rules` to JSON request body (`@RequestBody`) and synced OpenAPI snapshot to remove query-parameter drift.
- Added runtime chaos action resolution call-site in simulator traffic path (`/api/v1/ping` with match parameters) and integration assertions for apply/list/ttl/clear behavior.
- Hardened unauthorized regression tests with no-mutation side-effect assertions and optimized clear path from entity-load counting to repository count.
- Strengthened OpenAPI compatibility test to enforce request-body schema mapping for `PUT /fep-internal/rules`.

### File List

_Note: This is a cumulative file list across implementation + review follow-up + QA automation rounds._

- BE/contracts/openapi/fep-simulator.json
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/controller/FepSimulatorRuleController.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/controller/FepSimulatorController.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/request/SimulatorRuleUpsertRequest.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/response/SimulatorRuleResponse.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/response/SimulatorRuleListResponse.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/dto/response/SimulatorRuleClearResponse.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/entity/SimulatorRule.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/repository/SimulatorRuleRepository.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/service/FepSimulatorControlService.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/vo/ChaosRuleAction.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/vo/SimulatorRuleResult.java
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/vo/SimulatorRuleUpsertCommand.java
- BE/fep-simulator/src/main/resources/db/migration/V1__create_fep_simulator_scaffolding_tables.sql
- BE/fep-simulator/src/main/resources/db/seed/R__seed_local_simulator_rules.sql
- BE/fep-simulator/src/test/java/com/fix/fepsimulator/controller/FepSimulatorRuleControllerTest.java
- BE/fep-simulator/src/test/java/com/fix/fepsimulator/controller/FepSimulatorErrorContractTest.java
- BE/fep-simulator/src/test/java/com/fix/fepsimulator/security/InternalSecretFilterTest.java
- BE/fep-simulator/src/test/java/com/fix/fepsimulator/filter/CorrelationIdFilterTest.java
- BE/fep-simulator/src/test/java/com/fix/fepsimulator/convention/FepSimulatorModelAttributeConventionTest.java
- BE/fep-simulator/src/test/java/com/fix/fepsimulator/integration/FepSimulatorContainersIntegrationTest.java
- BE/fep-simulator/src/test/java/com/fix/fepsimulator/contract/FepSimulatorOpenApiCompatibilityTest.java
- _bmad-output/implementation-artifacts/6-3-chaos-control-api.md

## Change Log

- 2026-03-16: Converged simulator control plane to canonical `/fep-internal/rules` API (`PUT/GET/DELETE`) with non-prod gating and canonical request/response fields.
- 2026-03-16: Reworked simulator rule persistence to canonical schema (`ruleId`, scope, probability, TTL, applied/expires), implemented TTL cleanup and clear-all reset semantics.
- 2026-03-16: Added structured operational evidence logging for rule mutation/reset including correlation, request metadata, and expiry context.
- 2026-03-16: Updated controller/filter/contract tests and OpenAPI snapshot; verified full module QA gate with `./gradlew :fep-simulator:test --no-daemon`.
- 2026-03-16: Executed BMAD adversarial code review; outcome `Changes Requested`; added AI follow-up tasks and moved story to `in-progress`.
- 2026-03-16: Applied follow-up fixes for AC2 runtime hook-up, request-body contract alignment, unauthorized no-mutation assertions, and reset-path efficiency.
- 2026-03-16: Added integration verification for active-rule listing, TTL expiry, clear reset semantics, and matching chaos action resolution.
- 2026-03-16: Regenerated and synced `contracts/openapi/fep-simulator.json`; added contract guard asserting JSON request-body mapping for `PUT /fep-internal/rules`.
- 2026-03-16: Re-ran second-round QA gate (`:fep-simulator:test`) and closed review with approval.
- 2026-03-16: Executed BMAD QA automate workflow for Story 6.3, added invalid payload API cases (`probability`, `ttlSeconds`) and updated test automation summary artifact.
- 2026-03-16: Completed third-round adversarial documentation consistency pass; normalized reproducible test commands and traceability notes.

## Senior Developer Review (AI)

### Review Date

- 2026-03-16

### Reviewer

- Senior Developer (AI)

### Final Outcome

- Approved

### Final Severity Breakdown

- Critical: 0
- High: 0
- Medium: 0
- Low: 0

### Final Verdict Notes

- Final authoritative decision is **Approved** based on Re-Review Round 2.
- Initial `Changes Requested` findings are retained below as historical review context only.

### AC-to-Test Traceability (Final)

- AC 1: `FepSimulatorRuleControllerTest#shouldApplyRuleUsingCanonicalEndpoint`
- AC 2: `FepSimulatorContainersIntegrationTest#shouldListOnlyActiveRulesAndDropExpiredRule` (runtime action reflection via `/api/v1/ping`)
- AC 3: `FepSimulatorRuleControllerTest#shouldReturnActiveRules` and integration listing assertions
- AC 4: `FepSimulatorRuleControllerTest#shouldClearRules` and `FepSimulatorContainersIntegrationTest#shouldClearRulesAndResumeNormalHandling`
- AC 5: `InternalSecretFilterTest` unauthorized mutation/query/clear plus no-mutation side-effect assertions
- AC 6: `FepSimulatorRuleControllerTest#shouldRejectInvalidAction`, `#shouldRejectOutOfRangeProbability`, `#shouldRejectNonPositiveTtlSeconds`
- AC 7: `FepSimulatorControlService` structured log fields validated indirectly through mutation/reset flow tests and reviewed log contract implementation

### QA Evidence Artifacts

- Module gate command: `./gradlew :fep-simulator:test --no-daemon`
- Targeted gate command:
  - `./gradlew :fep-simulator:test --tests com.fix.fepsimulator.controller.FepSimulatorRuleControllerTest --tests com.fix.fepsimulator.security.InternalSecretFilterTest --tests com.fix.fepsimulator.integration.FepSimulatorContainersIntegrationTest --tests com.fix.fepsimulator.contract.FepSimulatorOpenApiCompatibilityTest --no-daemon`
- Test summary: `_bmad-output/implementation-artifacts/tests/test-summary.md`
- Module HTML report: `BE/fep-simulator/build/reports/tests/test/index.html`
- QA automate note: IDE `runTests` produced known classpath false negatives; Gradle BE-root gate is treated as authoritative for this module.

### Historical Review (Round 1 - Archived)

- Outcome: Changes Requested
- Severity Breakdown: Critical 1, High 2, Medium 2, Low 0
- Historical Findings:
  - Task/claim mismatch for integration-test evidence
  - AC2 runtime hookup gap
  - `PUT /fep-internal/rules` request-shape mismatch (query vs JSON body)
  - Unauthorized no-mutation assertion gap
  - Reset-path count inefficiency
- Historical findings above are fully resolved and closed in Round 2.

### Re-Review (Round 2)

- Date: 2026-03-16
- Outcome: Approved
- Severity Breakdown: Critical 0, High 0, Medium 0, Low 0
- Closure Evidence:
  - Integration coverage added and passing for active-rule listing, TTL expiry, clear reset, and runtime action reflection.
  - `PUT /fep-internal/rules` request binding moved to JSON body and committed OpenAPI snapshot synced.
  - Unauthorized filter regressions now assert no service mutation invocations.
  - Reset path optimized to repository count + batch delete.
  - QA gate: `./gradlew :fep-simulator:test --no-daemon` passed.

### Re-Review (Round 3)

- Date: 2026-03-16
- Outcome: Approved
- Severity Breakdown: Critical 0, High 0, Medium 0, Low 0
- Closure Evidence:
  - Review section is now non-contradictory with a single authoritative final outcome.
  - Targeted QA command is explicit and reproducible (no wildcard ellipsis).
  - File list scope is explicitly marked cumulative across rounds.
  - Latest QA automate execution and artifact update are logged in change history.
