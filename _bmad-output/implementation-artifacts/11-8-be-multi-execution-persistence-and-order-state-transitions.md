# Story 11.8: [BE][AC] Multi-Execution Persistence and Order State Transitions

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an execution ledger owner,  
I want multi-execution persistence and canonical order-state transitions,  
So that matching outcomes are durably recorded and downstream balances stay consistent.

## Acceptance Criteria

1. Given matching output with multiple fills When persistence executes Then `executions` rows are stored per fill with deterministic `executionSeq` order and traceable quantity/price/linkage fields.
2. Given persistence outcome When order summary is finalized Then `status`, `execution_result`, `executedQty`, `leavesQty`, and `executedPrice` reflect canonical transition rules (`NEW`, `PARTIALLY_FILLED`, `FILLED`, `REJECTED`) and `executedPrice` is weighted-average price over persisted fills.
3. Given no-liquidity reject path (`ORD-013`) When persistence finalizes Then no execution row and no position/cash mutation are applied.
4. Given MARKET path requiring post-trade traceability When rows are written Then quote snapshot linkage fields (`quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`) are persisted consistently with non-null policy for MARKET and nullable policy for LIMIT.
5. Given concurrent executions on overlapping account/position keys When persistence runs Then lock acquisition order is deterministic (`order -> positions(symbol ASC)`) under a single transaction to prevent deadlock and double-mutation.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Replace single execution write path with fill-list persistence
  - [ ] Add `executionSeq` generation rule (1..N, contiguous)
  - [ ] Add row-level linkage validation tests
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Centralize order-state transition mapping from matching result
  - [ ] Add weighted-average execution price calculation contract
  - [ ] Add transition matrix regression tests
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add explicit `ORD-013` no-liquidity reject guard for mutation suppression
  - [ ] Add mutation/no-mutation assertions
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add quote snapshot trace-field persistence contract with MARKET/LIMIT nullability rule
  - [ ] Add auditability verification for stored linkage
- [ ] Implement acceptance-criteria scope 5 (AC: 5)
  - [ ] Document and enforce lock acquisition order in persistence service
  - [ ] Add concurrent deadlock-regression test with deterministic lock order assertions
- [ ] Migration and backfill readiness
  - [ ] Add Flyway migration for new columns/constraints/indexes required by multi-execution model
  - [ ] Add backfill script for legacy single-fill rows (`executionSeq=1`, linkage defaults) and migration verification test

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11 expansion.
- This story aligns Epic 11 matching determinism with Epic 5.2 persistence semantics.
- Depends on: Story 11.7, Story 5.2.

### Technical Requirements

- Remove single-fill assumptions from persistence path.
- Keep persistence and posting in the same transaction boundary for canonical consistency.
- Ensure deterministic mapping between matching result and order summary fields.
- Migration artifacts are required in the same story scope (schema + backfill + rollback notes).
- Reject-path contract must be explicit: `ORD-013` produces immutable ledger state (no fills, no posting, no position mutation).
- Post-commit external submission/requery failure follows canonical policy: keep persisted canonical fill, mark external sync as recovery-target state (`FAILED`/`ESCALATED`), and never roll back ledger rows.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Persisted model changes stay in `corebank-domain` migrations/entities; orchestration and transaction policy stay in `corebank-service`.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration as appropriate).
- Include regression checks preventing fallback to fixed immediate-FILLED behavior.
- Include migration tests validating both fresh install and legacy upgrade paths for execution ledger integrity.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11)
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/5-2-order-execution-and-position-update.md`
- `_bmad-output/implementation-artifacts/orderbook-matching-gap-checklist.md`

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Generated via create-story workflow with user-specified story slicing.

### Completion Notes List

- Added multi-execution persistence and canonical state-transition story.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-8-be-multi-execution-persistence-and-order-state-transitions.md
