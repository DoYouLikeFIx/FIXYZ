# Story 11.2: [BE][MD] Quote Snapshot Freshness Guard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a risk owner,  
I want stale quote rejection rules,  
So that MARKET pre-check and valuation do not run on outdated data.

## Acceptance Criteria

1. Given snapshot age within `maxQuoteAgeMs` When prepare/valuation executes Then request succeeds with `quoteSnapshotId`, `quoteAsOf`, and `quoteSourceMode`.
2. Given snapshot age exceeds `maxQuoteAgeMs` When prepare/valuation executes Then request fails with deterministic stale-quote validation code.
3. Given stale rejection When audit log is written Then `symbol`, `snapshotAgeMs`, `quoteSourceMode` are recorded.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11.
- No supplemental epic artifact detected for this epic at generation time.
- Depends on: Story 11.1.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep stale-quote decision deterministic across environments and replay runs.
- Keep `VALIDATION-003 / STALE_QUOTE` contract aligned across channel/corebank/fep docs.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure boundary tests include exact-threshold and over-threshold cases for `maxQuoteAgeMs`.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 11 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11, Story 11.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/accounts/api-spec.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 11.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-2-quote-snapshot-freshness-guard.md
