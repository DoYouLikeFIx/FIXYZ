# Story 11.6: [BE][AC] OrderBook Query and Sorting Contract

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an execution engine owner,  
I want deterministic opposite-book query and sorting contracts,  
So that matching input order is stable and auditable before fill calculation.

## Acceptance Criteria

1. Given a target symbol and incoming side When opposite-book candidates are loaded Then only `NEW` or `PARTIALLY_FILLED` orders from the opposite side are returned.
2. Given candidate rows for matching When sort is applied Then ordering follows strict price-time priority with deterministic tie-break (`BUY book: price DESC + createdAt ASC + id ASC`, `SELL book: price ASC + createdAt ASC + id ASC`).
3. Given repeated reads in the same transaction boundary When query executes Then deterministic ordering remains stable and matching preconditions are reproducible under `REPEATABLE_READ`.
4. Given concurrent matching requests for the same symbol/side When opposite-book rows are loaded for execution Then repository query uses pessimistic lock semantics (`FOR UPDATE`) so competing transactions cannot consume the same liquidity row.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add repository query contract for opposite-side open orders
  - [ ] Add status filter coverage for `NEW` and `PARTIALLY_FILLED`
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Implement explicit price-time sort contract in repository/custom query layer
  - [ ] Add deterministic tie-break sort by `id ASC` for same `price` + `createdAt`
  - [ ] Add deterministic ordering test cases for both sides
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add transaction-scope reproducibility tests
  - [ ] Add mismatch-regression test for accidental unordered scans
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add query variant with pessimistic lock for execution path
  - [ ] Add concurrent-consumption test proving no duplicate liquidity consumption

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11 expansion.
- This story is created from execution-path slicing approved in discussion: `11.6 -> 11.7 -> 11.8 -> 11.9`.
- Depends on: Story 5.2, Story 11.2.

### Technical Requirements

- Define a single canonical query contract for matching input rows.
- Avoid ad-hoc in-memory re-sorting at call sites; enforce order at repository/query boundary.
- Keep filtering semantics aligned with order status transition model used by CoreBanking.
- Distinguish two repository contracts explicitly: read-only preview query (no lock) and execution query (pessimistic lock).
- Canonical execution query ordering key must be `(price, createdAt, id)` with side-specific price direction.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration as appropriate).
- Include side-specific sort assertions and reproducibility checks under transaction boundaries.
- Include concurrent integration test (>=2 threads) that verifies the same opposite-book row is not matched twice.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11)
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/orderbook-matching-gap-checklist.md`

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- Generated via create-story workflow with user-specified story slicing.

### Completion Notes List

- Added deterministic orderbook query/sort contract story as Epic 11 extension.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-6-be-orderbook-query-and-sorting-contract.md
