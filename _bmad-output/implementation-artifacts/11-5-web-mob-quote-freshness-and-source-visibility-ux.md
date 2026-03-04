# Story 11.5: [FE/MOB][MD] Quote Freshness & Source Visibility UX

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an order user,  
I want to see quote freshness and source mode,  
So that I understand valuation confidence before execution.

## Acceptance Criteria

1. Given valuation area rendering When quote is fresh Then UI shows `quoteAsOf` and `quoteSourceMode` badge (`LIVE`/`DELAYED`/`REPLAY`).
2. Given quote is stale When user attempts MARKET prepare Then UI blocks progression with actionable stale-data guidance.
3. Given replay mode demo When screen capture reviewed Then source-mode visibility is clear in both web and mobile clients.

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
- Depends on: Story 11.2, Story 11.4.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep stale-quote messaging and source badges consistent between web and mobile.
- Align UX copy and behavior with stale-quote validation contract.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Include cross-client parity checks for source badge and stale-block behaviors.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 11 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11, Story 11.5)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/prd.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 11.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-5-web-mob-quote-freshness-and-source-visibility-ux.md
