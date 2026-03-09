# Story 11.4: [BE][AC] MARKET Order Sweep Matching Validation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an execution engine owner,  
I want explicit MARKET sweep rules validated,  
So that market-order behavior is predictable and auditable.

## Acceptance Criteria

1. Given multi-level opposite book When MARKET order executes Then fills are consumed in strict price-time order.
2. Given insufficient liquidity When MARKET order executes Then partial fill or no-liquidity reject follows documented policy.
3. Given execution result When persisted Then `executedQty`, `executedPrice`, `leavesQty`, `quoteSnapshotId` are traceable.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add test coverage for AC 1
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add test coverage for AC 2
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add test coverage for AC 3

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11.
- No supplemental epic artifact detected for this epic at generation time.
- Depends on: Story 5.2, Story 11.2.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Preserve strict price-time sweep behavior for MARKET execution.
- Persist quote snapshot linkage for post-trade traceability.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Include no-liquidity and partial-fill boundary tests with deterministic expected outputs.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 11 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11, Story 11.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/accounts/db_schema.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 11.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-4-market-order-sweep-matching-validation.md
