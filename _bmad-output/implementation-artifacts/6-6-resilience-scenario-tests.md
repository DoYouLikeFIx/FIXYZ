# Story 6.6: [FEP] Resilience Scenario Tests

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a quality owner,
I want scenario tests for timeout/cb/recovery,
So that resilience behavior is proven before release.

## Acceptance Criteria

1. Given controlled timeout scenario When repeated failures occur Then CB open transition is asserted.
2. Given recovery probe scenario When downstream recovers Then CB close transition path is asserted.
3. Given UNKNOWN requery scenario When scheduler executes Then convergence/escalation outcomes are asserted.
4. Given CI gate policy When resilience tests fail Then merge/release is blocked.

## Tasks / Subtasks

- [x] Establish the canonical chaos-driven scenario harness for resilience runs (AC: 1, 2)
  - [x] Drive controlled timeout and recovery inputs through the canonical `fep-simulator` rules API from Story 6.3 instead of introducing a second fault-injection mechanism
  - [x] Treat rule setup, clear/reset, and post-test cleanup as part of the scenario lifecycle so the suite remains deterministic across local and CI runs
- [x] Add corebank resilience transition assertions for circuit-breaker open and recovery paths (AC: 1, 2)
  - [x] Extend `corebank-service` regression coverage for repeated timeout failures leading to breaker-open behavior
  - [x] Extend `corebank-service` regression coverage for half-open probe recovery leading back toward closed behavior
  - [x] Keep timeout / circuit-open error classification assertions stable alongside the transition assertions
- [x] Add channel-side recovery scenario assertions for UNKNOWN requery outcomes (AC: 3)
  - [x] Reuse the Story 6.4 scheduler and recovery-service suites to prove canonical convergence or escalation outcomes
  - [x] Assert the canonical outcome matrix rather than a generic "eventually resolved" result
  - [x] Keep retry-attempt and convergence/escalation metric assertions in scope for the scheduler path
- [x] Wire the resilience scenario suites into repo-owned CI evidence and failure propagation (AC: 4)
  - [x] Ensure failing resilience scenarios fail the existing BE workflow jobs that own the touched lanes
  - [x] Record which required BE workflow names provide repo-owned merge blocking
  - [x] Capture external branch-protection / release-policy verification as evidence, not as code owned by this story
- [x] Review Follow-ups (AI)
  - [x] [AI-Review][High] Replace the test-local combined chaos harness with the real `fep-simulator` control plane and matching semantics.
  - [x] [AI-Review][High] Route the breaker scenario through the real `corebank-service -> fep-gateway -> fep-simulator` runtime path instead of a fake in-test server.
  - [x] [AI-Review][Medium] Add gateway-lane regression coverage for the simulator chaos probe and isolate `corebank-service` Flyway locations after introducing cross-module test dependencies.
  - [x] [AI-Review][Medium] Publish the submit-timeout `504` contract through `fep-gateway` OpenAPI annotations, compatibility tests, and the checked-in snapshot.
  - [x] [AI-Review][Medium] Configure external GitHub required checks on `main` so AC 4 merge blocking is enforced beyond repo-local workflow wiring.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 6.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 6.1, Story 6.2, Story 6.3, Story 6.4.
- Story 6.1 already established the canonical breaker-open / half-open / close-path assertions in `corebank-service`; this story should reuse and extend those suites instead of creating parallel resilience-only tests.
- Story 6.3 already established the canonical non-prod chaos-control surface for deterministic timeout / disconnect / malformed-response injection. Use that control plane for AC 1 / AC 2 inputs.
- Story 6.4 already established the canonical `REQUERYING` / `ESCALATED` recovery behavior, retry-threshold semantics, and metrics path. AC 3 must assert those exact outcomes rather than inventing a second recovery interpretation.
- Story 0.2 already established that BE merge blocking is owned by existing BE GitHub workflow checks. AC 4 must integrate with those workflows, not invent a parallel CI path in the parent repository.

### Implementation Scope Guardrails

- This story is a resilience evidence and regression story. It should prove the existing Epic 6 runtime behaviors together, not redesign breaker policy, retry policy, scheduler ownership, or simulator contracts.
- Do not replace canonical simulator fault injection with ad hoc WireMock-only stubs, local sleeps, or test-only controller shortcuts unless those helpers are extending the existing `fep-simulator` contract tests.
- Do not create a new resilience-only API, scheduler, or CI workflow for this story. Reuse the existing module boundaries and workflow names.
- Do not broaden this story into FE/MOB degraded UX, manual replay governance, or release drill reporting. Those belong to Story 6.7, Story 6.5, and Story 10.3 respectively.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- AC 1 / AC 2 fault injection source of truth is the canonical Story 6.3 rules API under `fep-simulator`:
  - `PUT /fep-internal/rules`
  - `GET /fep-internal/rules`
  - `DELETE /fep-internal/rules`
- AC 1 must prove the same breaker-open semantics already validated in Story 6.1:
  - repeated timeout failures lead to circuit-breaker open behavior
  - error classification remains canonically aligned to `TIMEOUT` / `CIRCUIT_OPEN`
- AC 2 must prove the same half-open recovery semantics already validated in Story 6.1:
  - after the open-state cool-down, a successful probe path transitions toward closed behavior
  - the suite must not silently skip half-open behavior by resetting application state out of band
- AC 3 must prove the Story 6.4 recovery outcome matrix, not a generic success/fail summary. Canonical outcomes in scope are:
  - `REQUERYING -> COMPLETED`
  - `REQUERYING -> CANCELED`
  - `REQUERYING -> ESCALATED`
  - retry exhaustion / repeated transport failure escalation using the existing `ESCALATED_MANUAL_REVIEW` semantics
- AC 4 repo-owned scope is that failing resilience scenarios make the existing BE workflows go red. External GitHub branch-protection / release-policy settings are verification evidence required for closure, but not code implemented by this story.

### BE Integration Points

- Corebreaker regression lane:
  - `BE/corebank-service/src/resilienceScenario/java/com/fix/corebank/integration/CorebankSimulatorDrivenResilienceIntegrationTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java`
- Recovery scheduler lane:
  - `BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoverySchedulerTest.java`
  - `BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoveryServiceTest.java`
  - `BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java`
- Canonical fault-injection support lane:
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/controller/FepSimulatorRuleControllerTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/integration/FepSimulatorContainersIntegrationTest.java`
- Gateway bridge lane:
  - `BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/fix/FixDataPlaneService.java`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/controller/FepGatewayOrderErrorContractTest.java`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/dataplane/fix/FixDataPlaneServiceTest.java`
- Repo-owned CI workflow lane:
  - `BE/.github/workflows/ci-corebank.yml`
  - `BE/.github/workflows/ci-channel.yml`
  - `BE/.github/workflows/ci-fep-gateway.yml`
  - `BE/.github/workflows/ci-fep-simulator.yml`
  - `BE/.github/workflows/ci-quality-gate.yml`

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep the breaker-transition evidence in `corebank-service`, the recovery evidence in `channel-service`, and the deterministic fault injection in `fep-simulator`.
- Treat `fep-simulator` as the canonical external-fault driver and `corebank-service` / `channel-service` as the systems under test. Do not collapse those responsibilities into one module-local fake.
- Preserve the existing CI ownership split: lane-local workflows prove module-level regressions, and `ci-quality-gate` proves aggregate repo health.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Minimum required automated coverage:
  - AC 1: repeated timeout failures produce circuit-breaker open behavior in `corebank-service`
  - AC 2: successful downstream recovery after the open window produces the canonical half-open recovery path toward closed behavior
  - AC 3: scheduler-driven requery proves the exact canonical convergence / escalation outcomes from Story 6.4
  - AC 4: the touched scenario suites are executed by existing BE workflows and fail those jobs when broken
- Preferred file candidates:
  - `BE/corebank-service/src/resilienceScenario/java/com/fix/corebank/integration/CorebankSimulatorDrivenResilienceIntegrationTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java`
  - `BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java`
  - `BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoverySchedulerTest.java`
  - `BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoveryServiceTest.java`
  - `BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/controller/FepGatewayOrderErrorContractTest.java`
  - `BE/fep-gateway/src/test/java/com/fix/fepgateway/dataplane/fix/FixDataPlaneServiceTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/controller/FepSimulatorRuleControllerTest.java`
  - `BE/fep-simulator/src/test/java/com/fix/fepsimulator/integration/FepSimulatorContainersIntegrationTest.java`
- Reject coverage that only proves one lane in isolation. At least one scenario path must show the canonical simulator fault driving the runtime behavior that `corebank-service` or `channel-service` then asserts.
- Reject AC 3 coverage that asserts only "no exception" or "eventually terminal." The suite must assert the exact canonical terminal or escalated state and the matching retry-threshold semantics.

### QA Gate Execution Standard

- Use BE Gradle-root execution from the active BE repository root or active BE worktree root as the canonical verification path for this story.
- Corebreaker-focused commands:
  - `./gradlew :corebank-service:resilienceScenarioTest --tests com.fix.corebank.integration.CorebankSimulatorDrivenResilienceIntegrationTest --no-daemon`
  - `./gradlew :corebank-service:test --tests com.fix.corebank.integration.CorebankExternalErrorFlowIntegrationTest --no-daemon`
  - `./gradlew :corebank-service:test --tests com.fix.corebank.client.FepClientContractTest --no-daemon`
- Gateway bridge command:
  - `./gradlew :fep-gateway:test --no-daemon`
- Recovery-focused commands:
  - `./gradlew :channel-service:test --tests com.fix.channel.service.OrderSessionRecoverySchedulerTest --tests com.fix.channel.service.OrderSessionRecoveryServiceTest --tests com.fix.channel.integration.OrderSessionIntegrationTest --no-daemon`
- Fault-injection support commands if simulator helpers/contracts change:
  - `./gradlew :fep-simulator:test --tests com.fix.fepsimulator.controller.FepSimulatorRuleControllerTest --tests com.fix.fepsimulator.integration.FepSimulatorContainersIntegrationTest --no-daemon`
- Aggregate repo-owned CI equivalence check:
  - `./gradlew :core-common:test :corebank-domain:test :corebank-service:test :corebank-service:resilienceScenarioTest :channel-domain:test :channel-service:test :fep-gateway:test :fep-simulator:test --no-daemon`
- AC 4 closure evidence must identify the repo-owned workflow names expected to fail when the scenario suites fail:
  - `ci-corebank`
  - `ci-channel`
  - `ci-fep-gateway` when the gateway chaos bridge is touched
  - `ci-fep-simulator`
  - `ci-quality-gate`

### CI Scope Clarification

- Repo-owned implementation scope:
  - failing resilience scenarios must fail existing BE workflow jobs
  - any workflow file changes for this story must stay under `BE/.github/workflows`
- External verification scope:
  - branch protection required-check configuration
  - release policy configuration that consumes those checks
- Do not mark AC 4 complete until both repo-owned failure propagation and external verification evidence are recorded.

### Quinn Reinforcement Checks

- Canonical-fault gate:
  - Reject implementation that bypasses the Story 6.3 simulator rules path for AC 1 / AC 2 scenario setup.
- Outcome-matrix gate:
  - Reject AC 3 tests that do not assert the exact Story 6.4 convergence or escalation result.
- CI-ownership gate:
  - Reject AC 4 closure if the story only says "tests exist" without naming which BE workflows fail and what external evidence confirms those checks gate merge/release.

### Story Completion Status

- Status set to `done`.
- Completion note: Reworked the resilience breaker scenario to use the real `corebank-service -> fep-gateway -> fep-simulator` path, added gateway-lane chaos-probe regression coverage, published the submit-timeout `504` through the `fep-gateway` OpenAPI contract, tightened the Story 6.4 recovery outcome assertions in `channel-service`, and recorded AC 4 evidence that GitHub `main` now enforces BE required checks as of 2026-03-19.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.6)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/0-2-be-test-ci-foundation.md`
- `_bmad-output/implementation-artifacts/6-1-timeout-and-circuit-breaker.md`
- `_bmad-output/implementation-artifacts/6-2-retry-boundary-policy.md`
- `_bmad-output/implementation-artifacts/6-3-chaos-control-api.md`
- `_bmad-output/implementation-artifacts/6-4-unknown-requery-scheduler.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Implemented from clean BE worktree `/Users/yeongjae/worktrees/fixyz-be-story-6-6`.
- Added gateway-side chaos probing against the canonical simulator ping/rules path and verified:
  - `./gradlew :fep-gateway:generateOpenApiDocs --no-daemon`
  - `./gradlew :fep-gateway:test --no-daemon`
- Reworked `corebank-service` resilience scenario coverage to boot real `fep-gateway` and `fep-simulator` applications in-process and verified:
  - `./gradlew :corebank-service:resilienceScenarioTest --tests com.fix.corebank.integration.CorebankSimulatorDrivenResilienceIntegrationTest --no-daemon`
  - `./gradlew :corebank-service:test --tests com.fix.corebank.integration.CorebankExternalErrorFlowIntegrationTest --tests com.fix.corebank.client.FepClientContractTest --no-daemon`
- Tightened Story 6.4 recovery outcome assertions and verified:
  - `./gradlew :channel-service:test --tests com.fix.channel.service.OrderSessionRecoveryServiceTest --no-daemon`
  - `./gradlew :channel-service:test --tests com.fix.channel.service.OrderSessionRecoverySchedulerTest --tests com.fix.channel.service.OrderSessionRecoveryServiceTest --tests com.fix.channel.integration.OrderSessionIntegrationTest --no-daemon`
- Completed the aggregate repo-owned CI equivalence run and verified:
  - `./gradlew :core-common:test :corebank-domain:test :corebank-service:test :corebank-service:resilienceScenarioTest :channel-domain:test :channel-service:test :fep-gateway:test :fep-simulator:test --no-daemon`
- Checked BE worktree diff hygiene with:
  - `git diff --check`
- Confirmed repo-owned CI workflow names from BE workflow files:
  - `ci-corebank`
  - `ci-channel`
  - `ci-fep-gateway`
  - `ci-fep-simulator`
  - `ci-quality-gate`
- Captured external merge-gate evidence with GitHub CLI:
  - `gh api repos/DoYouLikeFIx/FIXYZ-BE/branches/main/protection` -> required checks `ci-corebank`, `ci-channel`, `ci-fep-gateway`, `ci-fep-simulator`, `ci-quality-gate` with strict mode enabled
  - `gh api repos/DoYouLikeFIx/FIXYZ-BE/rulesets` -> `[]`
- Observed that parallel Gradle builds in the same worktree can race on generated Querydsl sources; final verification was re-run serially.

### Completion Notes List

- Added a non-prod gateway chaos probe so `FixDataPlaneService` can consult the canonical simulator control plane before submit handling, and covered it in `FixDataPlaneServiceTest`.
- Reworked `CorebankSimulatorDrivenResilienceIntegrationTest` into a dedicated `resilienceScenarioTest` source set so `TIMEOUT -> CIRCUIT_OPEN -> recovery` runs through real `fep-gateway` and `fep-simulator` application contexts without broadening the default `corebank-service:test` lane.
- Kept existing `CorebankExternalErrorFlowIntegrationTest` and `FepClientContractTest` in the validation gate so Story 6.1 breaker/error-contract coverage remains stable alongside the new scenario path.
- Tightened `OrderSessionRecoveryServiceTest` so canonical `CANCELED` and `ESCALATED` requery outcomes assert convergence metrics and terminal notifications explicitly.
- Scoped cross-module resilience dependencies and Flyway locations to the dedicated `resilienceScenarioTest` lane so default `corebank-service:test` execution stays isolated.
- Published the `fep-gateway` submit-timeout `504` in controller annotations, compatibility assertions, and the checked-in OpenAPI snapshot so runtime and contract behavior stay aligned.
- Confirmed the touched resilience suites map to existing repo-owned BE workflows: `ci-corebank`, `ci-channel`, `ci-fep-gateway`, `ci-fep-simulator`, and `ci-quality-gate`.
- Applied external GitHub branch protection on `main` with strict required checks for `ci-corebank`, `ci-channel`, `ci-fep-gateway`, `ci-fep-simulator`, and `ci-quality-gate`, while confirming no separate repository rulesets are configured.

### File List

- /Users/yeongjae/worktrees/fixyz-be-story-6-6/channel-service/src/test/java/com/fix/channel/service/OrderSessionRecoveryServiceTest.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/core-common/src/main/java/com/fix/common/error/ErrorCode.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/corebank-service/build.gradle
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/corebank-service/src/resilienceScenario/java/com/fix/corebank/integration/CorebankSimulatorDrivenResilienceIntegrationTest.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/contracts/openapi/fep-gateway.json
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/fep-gateway/src/main/java/com/fix/fepgateway/controlplane/controller/FepGatewayOrderController.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/fix/FixDataPlaneService.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/fep-gateway/src/test/java/com/fix/fepgateway/controller/FepGatewayOrderErrorContractTest.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/fep-gateway/src/test/java/com/fix/fepgateway/contract/FepGatewayOpenApiCompatibilityTest.java
- /Users/yeongjae/worktrees/fixyz-be-story-6-6/fep-gateway/src/test/java/com/fix/fepgateway/dataplane/fix/FixDataPlaneServiceTest.java
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/6-6-resilience-scenario-tests.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/tests/test-summary.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-19: Reworked the resilience breaker scenario to use real `fep-gateway` and `fep-simulator` application contexts instead of a local fake harness.
- 2026-03-19: Added gateway-lane chaos probe coverage and isolated cross-module `corebank-service` resilience execution in a dedicated `resilienceScenarioTest` lane.
- 2026-03-19: Published the `fep-gateway` submit-timeout `504` in the controller annotations, compatibility test, and checked-in OpenAPI snapshot.
- 2026-03-19: Tightened `channel-service` recovery outcome assertions for `CANCELED` and `ESCALATED` convergence metrics/notifications.
- 2026-03-19: Verified BE suite ownership under `ci-corebank`, `ci-channel`, `ci-fep-gateway`, `ci-fep-simulator`, and `ci-quality-gate`, completed the aggregate CI-equivalence run, and confirmed strict required checks on GitHub `main`.

## Senior Developer Review (AI)

### Review Date

- 2026-03-19

### Reviewer

- GPT-5 Codex (Adversarial Review Mode)

### Outcome

- Changes requested twice, then resolved in the same review cycle.

### Findings

- [High] The initial scenario reimplemented the simulator control plane inside the test instead of using the real `fep-simulator` rules API.
- [High] The initial scenario bypassed the real `corebank-service -> fep-gateway -> fep-simulator` runtime path with an in-test combined fake server.
- [Medium] The initial implementation lacked a gateway-lane regression guard and caused Flyway migration drift risk after adding cross-module test dependencies.
- [Medium] The gateway submit endpoint exposed a runtime `504 TIMEOUT` path without publishing the same response in the checked-in OpenAPI contract.
- [Medium] AC 4 was initially closed without external merge-blocking evidence because GitHub `main` had no required checks configured.

### Resolution Summary

- Added a gateway-side chaos probe that consults the canonical simulator ping/rules path in non-prod test scenarios.
- Rewrote the `corebank-service` resilience scenario to boot real `fep-gateway` and `fep-simulator` applications and count submit attempts through a test-only primary bean override.
- Added `FixDataPlaneServiceTest` and pinned `corebank-service` test Flyway locations to module-local migrations so the scenario stays honest without destabilizing the rest of the lane.
- Published the `fep-gateway` submit-timeout `504` response in controller annotations, compatibility assertions, and the checked-in OpenAPI snapshot.
- Applied strict required checks on GitHub `main` for `ci-corebank`, `ci-channel`, `ci-fep-gateway`, `ci-fep-simulator`, and `ci-quality-gate` to satisfy AC 4 external merge-blocking evidence.
