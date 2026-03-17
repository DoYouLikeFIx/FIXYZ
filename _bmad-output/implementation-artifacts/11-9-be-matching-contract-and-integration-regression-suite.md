# Story 11.9: [BE][AC] Matching Contract and Integration Regression Suite

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a quality owner for execution engine changes,  
I want a matching-focused contract and integration regression suite,  
So that future changes cannot silently break deterministic matching behavior.

## Acceptance Criteria

1. Given LIMIT and MARKET canonical scenarios (`LIMIT_CROSS`, `LIMIT_NON_CROSS`, `MARKET_SWEEP`, `MARKET_PARTIAL`, `MARKET_NO_LIQUIDITY`) When regression suite runs Then deterministic outcome contracts (fill list, leaves, status, reject code) are verified end-to-end.
2. Given quote-trace and execution-ledger requirements When persistence assertions run Then `executedQty`, `executedPrice`, `leavesQty`, `executionSeq`, and quote linkage fields are validated across matching paths.
3. Given previously observed fixed-FILLED shortcut risk When regression suite executes Then tests fail if implementation reverts to single-path immediate fill behavior.
4. Given CI execution on current BE stack When suite completes Then reproducible pass/fail evidence is produced with deterministic fixtures and anti-flake controls.
5. Given matching regression suite execution under normal load When p95 is measured Then `/api/v1/orders/sessions/{sessionId}/execute` latency remains within existing order SLA (`<= 1000ms p95`) and gate fails on breach.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add scenario matrix for LIMIT/LIMIT non-cross/MARKET sweep/partial/no-liquidity
  - [ ] Add deterministic result assertions for each matrix row
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add persistence-level field assertions including quote linkage
  - [ ] Add integration-level consistency checks between order summary and execution rows
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add explicit anti-regression tests for immediate-fill fallback behavior
  - [ ] Add change-detection assertions around multi-execution semantics
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add CI-ready execution contract and evidence output expectations
  - [ ] Add stable fixture set, deterministic replay strategy, and anti-flake controls (fixed seed/clock, isolated DB state)
- [ ] Implement acceptance-criteria scope 5 (AC: 5)
  - [ ] Add Gatling/k6 smoke profile for matching paths with p95 extraction
  - [ ] Wire SLA assertion to fail release gate when p95 > 1000ms

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11 expansion.
- This story converts matching implementation changes into long-lived safety rails.
- Scope boundary with Story 11.4: Story 11.4 validates policy intent, Story 11.9 enforces executable regression guardrails in CI.
- Depends on: Story 11.8, Story 3.5.

### Technical Requirements

- Cover both rule correctness and persistence correctness in one cohesive suite.
- Keep fixtures deterministic and explicit about expected order and price outcomes.
- Ensure contracts are resilient to non-functional refactors.
- Keep test ownership explicit: contract/integration suites in `corebank-service` test modules, gateway-only behavior stays in `fep-gateway` tests.
- Evidence artifacts must include test reports and matrix summary document attached to CI run.
- CI output paths are fixed for reviewability: `_bmad-output/test-artifacts/matching-regression/<build-id>/matrix-summary.md`, `_bmad-output/test-artifacts/matching-regression/<build-id>/junit/`, `_bmad-output/test-artifacts/matching-regression/<build-id>/perf-p95.json`.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (integration/contract priority).
- Include CI gate readiness checks and deterministic evidence capture.
- Define named test classes per scope (contract, integration, anti-regression, performance smoke) to avoid ambiguous coverage.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11)
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/3-5-contract-test-suite.md`
- `_bmad-output/implementation-artifacts/orderbook-matching-gap-checklist.md`

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Generated via create-story workflow with user-specified story slicing.

### Completion Notes List

- Added matching contract/integration regression safety-net story.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-9-be-matching-contract-and-integration-regression-suite.md
