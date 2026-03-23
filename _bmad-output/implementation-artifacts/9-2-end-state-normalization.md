# Story 9.2: [BE][INT/CH] End-state Normalization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform consumer,
I want normalized order terminal states,
So that clients can render outcomes without service-specific branching.

> **Architecture Note:** `OrderSessionResponse` is the canonical channel contract for active, terminal, and recovery-aware order-session states. Clients must key off normalized channel states instead of downstream-specific execution details.

## Acceptance Criteria

1. Given channel order-session responses in `COMPLETED`, `FAILED`, `CANCELED`, `REQUERYING`, or `ESCALATED` When `OrderSessionResponse` is serialized Then each state follows one documented channel contract and only the permitted optional fields are exposed.
2. Given failed or degraded order outcome When `failureReason` is returned Then canonical reason values such as `OTP_EXCEEDED`, `UNKNOWN_EXECUTION_OUTCOME`, and `ESCALATED_MANUAL_REVIEW` stay stable, and `REQUERYING`/`ESCALATED` API responses mask execution metadata while preserving recovery context internally.
3. Given completed order (`COMPLETED` with `executionResult=FILLED`) When the response is returned Then the canonical `clOrdId` is always present, while `externalOrderId` remains supplemental external linkage metadata exposed only where the state contract allows.
4. Given order-session response contract regression When automated verification runs Then serializer, controller-boundary, and committed OpenAPI compatibility suites fail on schema drift.

## Tasks / Subtasks

- [x] Freeze the normalized `OrderSessionResponse` contract for terminal and recovery-aware states (AC: 1)
  - [x] Keep `expiresAt` and `remainingSeconds` limited to active-window states and mask disallowed terminal/recovery fields
- [x] Freeze canonical failure-reason and degraded-state masking semantics (AC: 2)
  - [x] Keep `REQUERYING` and `ESCALATED` API responses recovery-aware while hiding execution/external linkage fields from clients
- [x] Preserve the canonical `clOrdId` on normalized final-state responses (AC: 3)
  - [x] Distinguish canonical `clOrdId` from supplemental `externalOrderId`
- [x] Protect the normalized contract with serializer, controller, and OpenAPI regression coverage (AC: 4)
  - [x] Keep committed OpenAPI snapshot and response-contract suites green

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 9.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 9.1.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Story `4.3` is the serializer/status-contract baseline for `OrderSessionResponse`; Story `9.2` closes the integrated execute/final-state contract on top of that existing baseline.
- `OrderSessionResponse` and `OrderSessionResponseSerializer` are the canonical channel normalization layer for order-session state exposure.
- `clOrdId` is the canonical client-visible order reference for normalized responses. `externalOrderId` is supplemental external linkage metadata and may be `null` or masked depending on the state contract.
- `REQUERYING` and `ESCALATED` preserve recovery context in persistence while masking execution and external linkage fields in API responses.
- CI-compatible contract guardrails for this story are `OrderSessionResponseSerializationTest`, `ChannelErrorContractTest`, `ChannelOpenApiCompatibilityTest`, and the committed OpenAPI verification task.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep response normalization in the channel backend so FE/MOB can consume one contract without state-specific branching on downstream transport details.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Cover normalized response contracts for `COMPLETED`, `FAILED`, `CANCELED`, `REQUERYING`, and `ESCALATED`.
- Cover execute-endpoint response normalization for `COMPLETED`, `REQUERYING`, and `ESCALATED`.
- Keep committed OpenAPI schema and contract suites aligned with the serialized response shape.

### Story Completion Status

- Status set to `done`.
- Completion note: Story 9.2 normalized the integrated final-state response contract, locked canonical `clOrdId` semantics, and passed targeted serializer/controller/OpenAPI regression checks on 2026-03-23.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 9, Story 9.2)
- `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `.\gradlew.bat :channel-service:test --tests "com.fix.channel.serialization.OrderSessionResponseSerializationTest" --tests "com.fix.channel.contract.ChannelOpenApiCompatibilityTest" --tests "com.fix.channel.controller.ChannelErrorContractTest"`
- `_bmad-output/implementation-artifacts/tests/test-summary.md` Round 9 QA Automate Update (Story 9.2)

### Completion Notes List

- Story contract was realigned from vague branch-based wording to the current channel normalization layer defined by `OrderSessionResponse`.
- Canonical client reference semantics are now explicit: `clOrdId` is required, while `externalOrderId` is supplemental and state-dependent.
- `REQUERYING` and `ESCALATED` now explicitly document masked API fields versus persisted recovery context.
- Targeted serializer, controller-boundary, and OpenAPI compatibility suites were re-run and remain green.
- Story 9.2 is closed as `done` based on implemented normalization behavior plus targeted QA evidence.

### File List

- BE/channel-service/src/main/java/com/fix/channel/dto/response/OrderSessionResponse.java
- BE/channel-service/src/main/java/com/fix/channel/serialization/OrderSessionResponseSerializer.java
- BE/channel-service/src/test/java/com/fix/channel/serialization/OrderSessionResponseSerializationTest.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- BE/channel-service/src/test/java/com/fix/channel/contract/ChannelOpenApiCompatibilityTest.java
- BE/contracts/openapi/channel-service.json
- _bmad-output/implementation-artifacts/9-2-end-state-normalization.md
- _bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
