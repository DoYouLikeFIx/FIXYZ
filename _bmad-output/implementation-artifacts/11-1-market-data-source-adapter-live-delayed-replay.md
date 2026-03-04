# Story 11.1: [BE][MD] Market Data Source Adapter (LIVE/DELAYED/REPLAY)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a market data owner,  
I want a unified source adapter for LIVE/DELAYED/REPLAY modes,  
So that quote ingestion and downstream valuation use a single contract.

## Acceptance Criteria

1. Given configured `LIVE` mode When KIS WebSocket(`H0STCNT0`) quote events arrive Then adapter authenticates with `approval_key` and subscribes using `tr_type=1`, `tr_id=H0STCNT0`, `tr_key` contract.
2. Given configured `DELAYED` mode When quote events are consumed Then configured delay is applied deterministically and emitted snapshots include `quoteSnapshotId` with `quoteSourceMode=DELAYED`.
3. Given configured `REPLAY` mode When replay seed and cursor are fixed Then identical input produces identical quote snapshot sequence (including `quoteSnapshotId`) with `quoteSourceMode=REPLAY`.
4. Given KIS real-time frame `encFlag|trId|count|payload` When `count>1` or `encFlag=1` frame is received Then adapter splits multi-record payload by `count`, decrypts encrypted payload via key/iv, and emits normalized snapshots with `quoteSourceMode=LIVE`.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add test coverage for AC 1
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add test coverage for AC 2
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add test coverage for AC 3
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add test coverage for AC 4

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11.
- No supplemental epic artifact detected for this epic at generation time.
- Depends on: Story 5.2.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep quote snapshot contract aligned with architecture/PRD/API (`quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`).
- Keep deterministic behavior for DELAYED/REPLAY testability.
- Enforce KIS provider contract (`approval_key`, `tr_type=1/2`, `count`-based frame split, `encFlag` decrypt).

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure deterministic replay assertions use fixed seed and stable sequence hash.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 11 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11, Story 11.1)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md`
- `_bmad-output/planning-artifacts/fep-gateway/kis-websocket-h0stcnt0-spec.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 11.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-1-market-data-source-adapter-live-delayed-replay.md
