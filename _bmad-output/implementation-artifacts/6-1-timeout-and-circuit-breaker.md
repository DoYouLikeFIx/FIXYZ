# Story 6.1: [FEP] Timeout & Circuit Breaker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a resilience owner,
I want timeout and circuit breaker policies enforced,
So that repeated external failures do not cascade.

## Acceptance Criteria

1. Given external submit/status call exceeds timeout policy and upstream timeout taxonomy applies (`9004` -> `TIMEOUT`) When request executes Then timeout classification is returned consistently.
2. Given consecutive failures at configured threshold (`minimumNumberOfCalls=3`, `failureRateThreshold=100`) When next call occurs Then circuit breaker transitions to open behavior.
3. Given cool-down window elapsed (`waitDurationInOpenState=10s`) When probe request succeeds Then breaker transitions toward closed state.
4. Given probe request fails When half-open state active Then breaker returns to open.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

### Closed Review Follow-ups (AI History)

- [x] [AI-Review][HIGH] Story `File List` does not enumerate actual BE implementation files that satisfy AC1~AC4, preventing auditable traceability of claimed completion [BE/corebank-service/src/main/resources/application.yml:43, BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java:142]
- [x] [AI-Review][MEDIUM] Untracked workspace change `.vscode/settings.json` exists in git status but is not documented in story artifacts, causing git-vs-story discrepancy [./.vscode/settings.json]
- [x] [AI-Review][MEDIUM] `Story Completion Status` still states `ready-for-dev` although current workflow moved story through review; section is stale and contradictory [story section: Story Completion Status]
- [x] [AI-Review][MEDIUM] AC 3/4 technical checklists and BE implementation work-item checklists remain unchecked while top-level tasks are checked complete, reducing review confidence and DoD traceability [story section: AC 3/4 Test Checklist]

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 6.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 3.1.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Circuit breaker baseline parameters (apply to `fep-submit`, `fep-status`):
  - `slidingWindowType=COUNT_BASED`
  - `slidingWindowSize=3`
  - `minimumNumberOfCalls=3`
  - `failureRateThreshold=100`
  - `waitDurationInOpenState=10s`
  - `permittedNumberOfCallsInHalfOpenState=1`

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.

### QA Gate Execution Standard

- Use BE Gradle-root execution as canonical QA/review gate for this story:
  - `cd /c/Users/SSAFY/FIXYZ/BE && ./gradlew :corebank-service:test --no-daemon`
- Treat editor-integrated runner failures as non-gating only when ALL of the following hold:
  - Failure signature matches known environment/classpath/resource artifacts (e.g., `NoClassDefFoundError: CircuitBreakerRegistry`, `ClassPathResource ... cannot be opened because it does not exist`).
  - The same test scope passes via BE Gradle-root command in the same session.
  - Gate decision and command evidence are recorded in test summary artifacts.

#### AC 3/4 Test Checklist

- [x] AC 3 half-open success path: after `waitDurationInOpenState` elapses, allow exactly one probe call and verify state transitions toward closed (`HALF_OPEN -> CLOSED`).
- [x] AC 4 half-open failure path: when the half-open probe fails, verify immediate transition back to open (`HALF_OPEN -> OPEN`).
- [x] Verify no extra probe is admitted while half-open probe slot is consumed (`permittedNumberOfCallsInHalfOpenState=1`).
- [x] Verify timeout/failure classification remains consistent with error envelope contracts (`TIMEOUT` / `CIRCUIT_OPEN`) during AC 3/4 scenarios.

#### BE Test Implementation Work Items (File Candidates)

- [x] Config update: add `permittedNumberOfCallsInHalfOpenState=1` for both `fep-submit` and `fep-status`.
  - Candidate file: `BE/corebank-service/src/main/resources/application.yml`
- [x] AC 3 integration test: validate half-open probe success transitions toward closed.
  - Candidate file: `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java`
  - Suggested test name: `shouldTransitionFromHalfOpenToClosedWhenProbeSucceeds`
- [x] AC 4 integration test: validate half-open probe failure transitions back to open.
  - Candidate file: `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java`
  - Suggested test name: `shouldReturnToOpenWhenHalfOpenProbeFails`
- [x] Probe slot constraint test: ensure only one half-open probe call is admitted.
  - Candidate file: `BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java`
  - Suggested test name: `shouldAllowSingleProbeCallInHalfOpenState`
- [x] Contract consistency assertion: keep `TIMEOUT` (`9004`) and `CIRCUIT_OPEN` (`9098`) classification stable during AC 3/4 scenarios.
  - Candidate file: `BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java`

### Story Completion Status

- Status set to `done`.
- Completion note: Epic 6 Story 6.1 implementation and review follow-up resolution completed.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.1)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 6.
- Verified existing resilience implementation in corebank service and integration tests for timeout/circuit-breaker/half-open probe behavior.
- Executed targeted test runs via runTests for external error flow and contract coverage; observed test-runner classpath limitations while core AC scenarios are already implemented in code.
- Fixed test runner classpath by executing tests from BE Gradle root path (`/c/Users/SSAFY/FIXYZ/BE`) with module-scoped tasks.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Confirmed circuit breaker baseline config for `fep-submit` and `fep-status` includes `permittedNumberOfCallsInHalfOpenState=1`.
- Confirmed AC coverage in `CorebankExternalErrorFlowIntegrationTest` for timeout classification, open transition, half-open success/failure transition, and single probe slot enforcement.
- Added negative threshold guard test for submit breaker and status breaker half-open recovery test.
- Updated story and sprint tracking status to `done`.
- Review gate verified with BE Gradle path:
  - `./gradlew :corebank-service:test --tests com.fix.corebank.integration.CorebankExternalErrorFlowIntegrationTest --no-daemon`
  - `./gradlew :corebank-service:test --tests com.fix.corebank.client.FepClientContractTest --no-daemon`
  - `./gradlew :corebank-service:test --no-daemon`
  - `./gradlew :corebank-service:check --no-daemon`
- Verification artifacts:
  - `BE/corebank-service/build/reports/tests/test/index.html`
  - `_bmad-output/implementation-artifacts/tests/6-1-timeout-and-circuit-breaker-test-summary.md`
- Resolved all Senior Developer review follow-up items (traceability, workspace drift cleanup, status consistency, and checklist parity).

### File List

- BE/corebank-service/src/main/resources/application.yml
- BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankExternalErrorFlowIntegrationTest.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java
- _bmad-output/implementation-artifacts/6-1-timeout-and-circuit-breaker.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/6-1-timeout-and-circuit-breaker-test-summary.md

## Change Log

- 2026-03-16: Marked AC1-AC4 tasks/subtasks complete after validating existing implementation and tests; advanced story status to `review`.
- 2026-03-16: Standardized review-gate verification on BE Gradle root path to avoid IDE runner classpath drift; `:corebank-service:test` and `:corebank-service:check` passed.
- 2026-03-16: Senior Developer adversarial review executed; outcome `Changes Requested`; added AI review follow-up tasks and set status to `in-progress`.
- 2026-03-16: Resolved all AI review follow-ups; reconciled file traceability and checklist parity; finalized story status to `done`.
- 2026-03-16: Strengthened AC2/AC3/AC4 test reliability and coverage (submit threshold negative case, status breaker half-open recovery), and normalized QA gate standard reference.
- 2026-03-16: Executed second adversarial review round after hardening changes; no blocking findings remained and residual low-risk notes were tracked.
- 2026-03-16: Final hardening round completed (status half-open failure coverage, stronger single-probe synchronization, and explicit gate qualification criteria).
- 2026-03-16: Executed final adversarial review round after hardening; gate remains approved with no blocking findings.

## Senior Developer Review (AI)

### Review Date

- 2026-03-16

### Reviewer

- Senior Developer (AI)

### Outcome

- Approved

### Summary

- AC implementation evidence is present in BE config and tests (`application.yml`, `CorebankExternalErrorFlowIntegrationTest`, `FepClientContractTest`).
- BE module Gradle verification succeeded (`:corebank-service:test`, `:corebank-service:check`) with fixed root-path execution.
- Story traceability and documentation consistency issues were resolved and revalidated.

### Severity Breakdown

- High: 0
- Medium: 0
- Low: 0

### Action Items

- [x] [HIGH] Reconcile `File List` with actual implementation evidence files for this story (include real BE source/test files tied to AC1~AC4).
- [x] [MEDIUM] Either document `.vscode/settings.json` as intentional workspace change or remove/revert it from current change set.
- [x] [MEDIUM] Normalize stale narrative sections (`Story Completion Status`) so they align with current workflow status.
- [x] [MEDIUM] Update AC 3/4 checklist/work-item checkboxes to reflect validated completion or explicitly note remaining scope.

### Closure Evidence

- AC threshold guard evidence: `shouldKeepSubmitCircuitClosedBeforeFailureThresholdReached` (includes metrics assertion for buffered/failed calls before threshold open)
- Status half-open recovery/failure evidence:
  - `shouldTransitionStatusBreakerFromOpenToClosedAfterSuccessfulProbe`
  - `shouldReturnStatusBreakerToOpenWhenHalfOpenProbeFails`
- Single-probe synchronization evidence: request-observed wait helper (`waitForSubmitRequestObserved`) prevents pre-flight latch races.

### Re-Review (Round 2)

- Date: 2026-03-16
- Outcome: Approved (No additional blocking findings)
- Scope checked: AC threshold guard coverage, `fep-status` breaker transition coverage, QA artifact traceability, and gate-command standardization.

### Re-Review (Round 3)

- Date: 2026-03-16
- Outcome: Approved (No blocking findings)
- Scope checked: AC wording precision, gate qualification criteria, deterministic test synchronization, and audit-evidence pointers.

### Re-Review (Round 4)

- Date: 2026-03-16
- Outcome: Approved (No blocking findings)
- Scope checked: status half-open failure re-open coverage, threshold metrics assertion, and QA index metadata completeness.
