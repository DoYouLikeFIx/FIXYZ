# Story 8.7: [AC] Ledger Integrity Observability & Alerting

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operations owner,
I want ledger integrity run, backlog, and alert signals exposed,
So that unresolved accounting risks are visible before release and during operations.

## Acceptance Criteria

1. Given stored integrity runs and reconciliation cases When operations summary query executes Then latest run result, unresolved anomaly counts, repair-pending counts, and latest failed identifiers are returned.
2. Given integrity check or reconciliation outcomes change When metrics are emitted Then latest run status, unresolved backlog, critical anomaly count, and stale-last-run indicators are observable.
3. Given configured thresholds are breached When alert evaluation runs Then a structured alert or event is emitted with run id and traceable identifiers.
4. Given non-operator or public caller When integrity observability data is requested Then access is denied and only internal/admin surfaces are exposed.

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
- Depends on: Story 5.6, Story 5.8, Story 8.3.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep observability outputs read-only, PII-safe, and aligned with internal/admin usage.
- Avoid introducing repair execution or public UI concerns outside required observability boundaries.

### Architecture Compliance

- Follow architecture-defined observability, security, and internal boundary conventions.
- Reuse existing correlation, metrics, and alerting patterns instead of creating bespoke pipelines.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure authorization, threshold edge cases, stale-run scenarios, and metrics publication paths are covered.

### Story Completion Status

- Status set to `done`.
- Completion note: Internal ledger-integrity summary, Micrometer backlog/staleness signals, structured threshold alerts, and internal-only access coverage were implemented, two rounds of Senior Developer Review findings were remediated, and targeted plus regression verification was rerun on 2026-03-20.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 8, Story 8.7)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/5-6-ledger-integrity.md`
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 8.
- 2026-03-20: implemented internal summary endpoint, observability metrics/alerts, committed OpenAPI snapshot refresh, and targeted BE regression verification.
- 2026-03-20: remediated Senior Developer Review findings around missing-run metric semantics, alert run-id traceability, backlog counting after terminal case resolution, and duplicate rerun observability refresh.
- 2026-03-20: remediated follow-up review findings by sampling alert identifiers at creation time and keeping fallback alert identifiers scoped to the emitted run id.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Added `LedgerIntegrityObservabilityService` to compute latest-run summary, unresolved/repair-pending/critical backlog counts, stale-run indicators, and structured alert events.
- Exposed `GET /internal/v1/ledger-integrity/summary` through `InternalCorebankController` with internal-secret protection and committed OpenAPI contract coverage.
- Refreshed observability state after integrity run persistence, reconciliation case changes, and repair/rerun operations so metrics and alerts track live ledger workflow changes.
- Added controller, unit, integration, and contract tests covering summary payloads, threshold/stale alert behavior, metrics publication, and unauthorized access denial.
- Fixed review follow-ups so missing-run status is observable via a sentinel metric, backlog alerts point at the correct run context, terminal reconciliation cases no longer inflate unresolved backlog, and rerun flows refresh observability only once.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/8-7-ledger-integrity-observability-and-alerting.md
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/config/LedgerIntegrityObservabilityProperties.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/controller/InternalCorebankController.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalLedgerIntegritySummaryResponse.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/repository/LedgerIntegrityAnomalyRecordRepository.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/repository/LedgerIntegrityRunRepository.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/repository/LedgerReconciliationCaseRepository.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerIntegrityObservabilityService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerIntegrityService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerReconciliationService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/LedgerRepairService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/vo/LedgerIntegrityFailedIdentifier.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/vo/LedgerIntegrityObservabilitySummary.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application.yml
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application-openapi.yml
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application-test.yml
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/controller/CorebankInternalApiSkeletonTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/contract/CorebankOpenApiCompatibilityTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/LedgerIntegrityObservabilityIntegrationTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/service/LedgerIntegrityObservabilityServiceTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/service/LedgerRepairServiceTest.java
- /Users/yeongjae/fixyz/BE/contracts/openapi/corebank-service.json

## Change Log

- 2026-03-20: Implemented Story 8.7 BE scope for internal ledger-integrity summary, observability metrics and alerts, internal-only API exposure, and OpenAPI/test coverage.
- 2026-03-20: Resolved Senior Developer Review findings by distinguishing missing-run metric state, aligning alert `runId` with emitted identifiers, excluding terminally resolved anomalies from backlog counts, and removing duplicate rerun observability refresh; revalidated with targeted and regression test suites plus `verifyCommittedOpenApi`.
- 2026-03-20: Resolved second-round review findings by capping alert identifier sampling before alert creation and preventing fallback backlog alerts from mixing identifiers across runs; revalidated with targeted service tests and full BE regression plus OpenAPI verification.
- 2026-03-20: Logged follow-up traceability for the observability review note that `corebank.ledger.integrity.run.passed` must distinguish `no run yet` from `latest run failed`; story action item remains completed via the sentinel metric remediation.

## Senior Developer Review (AI)

### Review Date

- 2026-03-20

### Outcome

- Approve

### Summary

- Re-reviewed Story 8.7 after remediating the four findings raised in the initial BE review pass.
- Verified the observability summary now counts only truly unresolved backlog, threshold alerts emit the correct run context, rerun flows do not double-refresh alerting, and metrics distinguish `no run yet` from `latest run failed`.
- Review context was taken from the story Dev Notes plus Epic 8 planning and architecture artifacts.

### Findings

1. No blocking findings remain for this story scope.

### Action Items

- [x] [Medium] Distinguish `no run yet` (`null`) from `latest run failed` (`false`) in `corebank.ledger.integrity.run.passed` so dashboards can observe latest-run status without inferring from stale signals.
- [x] [High] Align backlog alert `runId` with the identifiers emitted in the same structured alert payload.
- [x] [High] Exclude anomalies backed only by terminal reconciliation cases from unresolved and critical backlog counts.
- [x] [High] Remove duplicate observability refresh during rerun so alert counters and logs reflect the post-transition state only.
