# Story 3.5: [FEP] Contract Test Suite

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a quality owner,
I want contract tests for FEP integration,
So that integration drift is detected before release.

## Acceptance Criteria

1. Given canonical WireMock stubs When CI runs Then request header/body and response mapping assertions pass.
2. Given changed contract field When stub and mapper diverge Then pipeline fails with explicit mismatch.
3. Given error taxonomy scenarios When test matrix executes Then all expected code mappings are validated.
4. Given correlation-id propagation requirement When outbound call verified Then trace header presence is asserted.

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
- Depends on: Story 3.2, Story 3.4.

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
- Completion note: Implementation and review remediation for Story 3.5 are complete.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.5)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Implementation Plan

- Externalize canonical FEP submit/status fixtures into reusable WireMock-backed test resources so CI validates the documented request/response contract shape.
- Expand `FepClientContractTest` to fail explicitly on contract-field drift and to cover the full documented external RC taxonomy for both submit and status calls.
- Re-run scoped contract tests plus backend quality gates to prove the suite catches drift without introducing regressions.

### Debug Log References

- `./gradlew :corebank-service:test --tests com.fix.corebank.client.FepClientContractTest` (red: failed before fixture resources were added)
- `./gradlew :corebank-service:test --tests com.fix.corebank.client.FepClientContractTest`
- `./gradlew :corebank-service:check`
- `./gradlew test`

### Completion Notes List

- Added canonical JSON fixtures for submit success, submit request payload, drifted submit response, and unknown-status response so WireMock assertions run against reusable contract assets instead of inline bodies.
- Refactored `FepClientContractTest` to load the canonical fixtures, assert request headers/body plus response mapping from those fixtures, and fail with an explicit `VALIDATION-001` contract message when the submit response drifts from `clOrdId`.
- Expanded the external error taxonomy coverage into a full submit/status matrix and asserted `X-Correlation-Id` propagation across outbound FEP calls in both success and failure paths.
- Verified the contract suite, `corebank-service` quality gate, and backend-wide regression suite all pass after the test-suite changes.
- Added a canonical MARKET submit fixture and strict body assertion for `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, and `preTradePrice`, closing the request-drift gap for market orders.
- Added canonical success fixtures for `PARTIALLY_FILLED`, `PENDING`, `REJECTED`, `CANCELED`, and `MALFORMED` status responses and parameterized the status success-path mapping assertions across the full documented matrix.
- Bound the canonical positive fixtures to `BE/contracts/openapi/fep-gateway.json` and fixed `FepOutboundOrderPayload.quoteAsOf` serialization to ISO `date-time` so the real outbound body matches the contract snapshot.

### File List

- BE/corebank-service/src/main/java/com/fix/corebank/client/FepOutboundOrderPayload.java
- BE/corebank-service/src/test/java/com/fix/corebank/client/FepClientContractTest.java
- BE/corebank-service/src/test/resources/contracts/fep/status-canceled-response.json
- BE/corebank-service/src/test/resources/contracts/fep/status-malformed-response.json
- BE/corebank-service/src/test/resources/contracts/fep/status-partially-filled-response.json
- BE/corebank-service/src/test/resources/contracts/fep/status-pending-response.json
- BE/corebank-service/src/test/resources/contracts/fep/status-rejected-response.json
- BE/corebank-service/src/test/resources/contracts/fep/status-unknown-response.json
- BE/corebank-service/src/test/resources/contracts/fep/submit-limit-request.json
- BE/corebank-service/src/test/resources/contracts/fep/submit-market-request.json
- BE/corebank-service/src/test/resources/contracts/fep/submit-success-drifted-clordid-response.json
- BE/corebank-service/src/test/resources/contracts/fep/submit-success-fill-response.json
- _bmad-output/implementation-artifacts/3-5-contract-test-suite.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-11: Added canonical FEP contract fixtures, explicit contract-drift failure coverage, full submit/status taxonomy matrix assertions, and correlation-id propagation checks; validated with scoped, module, and backend-wide test runs.
- 2026-03-11: Addressed code-review findings by covering all documented status success variants, asserting the full MARKET request contract, validating canonical fixtures against the OpenAPI snapshot, and fixing `quoteAsOf` ISO serialization.

## Senior Developer Review (AI)

### Review Date

- 2026-03-11

### Reviewer

- GPT-5 Codex

### Outcome

- Approved after remediation

### Summary

- Closed all three review findings by expanding canonical fixture coverage, strengthening the MARKET request assertions, and checking the positive fixtures against the committed OpenAPI contract snapshot.

### Acceptance Criteria Validation

- AC1: Pass. Canonical LIMIT and MARKET request bodies plus submit/status success mappings are covered by reusable fixtures.
- AC2: Pass. The drift fixture still fails explicitly when `clOrdId` is renamed.
- AC3: Pass. Submit and status error taxonomy matrices remain fully exercised.
- AC4: Pass. Correlation ID propagation remains asserted on submit and status calls.

### Action Items

- None.
