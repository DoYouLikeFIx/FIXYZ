# Story 2.3: BE Transfer History API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want paginated transfer history,
so that I can inspect recent financial activity.

## Acceptance Criteria

1. Given owned account with transaction records, when history API is called, then results are paginated and ordered by created time desc.
2. Given empty history, when query executes, then empty content contract is returned consistently.
3. Given unauthorized account id, when access check fails, then API returns forbidden error.
4. Given malformed pagination params, when validation runs, then 400 validation error is returned.

## Tasks / Subtasks

- [ ] Implement paginated transfer history endpoint for owned accounts (AC: 1)
  - [ ] Enforce sort by created time descending
  - [ ] Return stable page metadata and content shape
- [ ] Implement empty-result consistency handling (AC: 2)
  - [ ] Return deterministic empty content contract without null-shape drift
- [ ] Enforce authorization guard by account ownership (AC: 3)
  - [ ] Return forbidden contract on non-owned account access
- [ ] Validate pagination parameters (AC: 4)
  - [ ] Reject malformed page/size inputs with normalized validation errors
- [ ] Add integration tests for pagination/empty/forbidden/validation (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2 (`2.1`~`2.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-2-transfer-initiation-and-otp.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on Story 2.1 and Story 1.2.
- This story provides backend contract required by web/mobile history UI stories.

### Technical Requirements

- Pagination contract:
  - Page metadata and ordering semantics must be deterministic.
  - Empty results must preserve same JSON shape as non-empty responses.
- Authorization:
  - History must be scoped to owned accounts only.
- Validation:
  - Negative or invalid paging parameters must fail with 400 validation contract.

### Architecture Compliance

- Keep query ownership in channel/corebank service boundaries as defined by architecture.
- Preserve standardized error envelope for forbidden/validation failures.
- Avoid leaking non-owned transfer metadata in any failure path.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/transfer/**`
  - `BE/corebank-service/src/main/**/transfer/**` (if delegated query path exists)
  - `BE/*/src/test/**`

### Testing Requirements

- Required checks:
  - Paginated history returns ordered records and stable metadata.
  - Empty-history request returns deterministic empty content contract.
  - Unauthorized account history request returns forbidden error.
  - Malformed pagination returns 400 validation error.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Contract-shape gate:
  - Validate empty and non-empty responses keep consistent schema.
- Authorization gate:
  - Validate no leakage for unauthorized account history requests.
- Evidence gate:
  - Attach pagination, empty, forbidden, and validation test evidence.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 transfer-history API guardrails prepared.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.3)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-2-transfer-initiation-and-otp.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 2 planning artifact.

### Completion Notes List

- Added pagination, authorization, and validation contract gates.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-3-transfer-history-api.md
