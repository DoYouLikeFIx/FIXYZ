# Story 2.5: MOB Mobile Account Dashboard and History

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want account dashboard and history on mobile,
so that parity with web is maintained.

## Acceptance Criteria

1. Given authenticated mobile session, when dashboard screen opens, then balances and account summaries render correctly.
2. Given pull-to-refresh on history, when user requests refresh, then latest records load without duplications.
3. Given empty or error response, when screen state resolves, then empty/error states follow UI standard.
4. Given masked account display policy, when numbers render, then same masking rule as web is applied.

## Tasks / Subtasks

- [ ] Implement mobile dashboard summary screen (AC: 1)
  - [ ] Render account balances and summaries for authenticated user
  - [ ] Keep loading and stale-state handling deterministic
- [ ] Implement history refresh behavior (AC: 2)
  - [ ] Wire pull-to-refresh with dedup-safe state updates
  - [ ] Preserve server-driven ordering semantics in refreshed lists
- [ ] Implement standardized empty/error states (AC: 3)
  - [ ] Align screen-state behavior with mobile UI standards
  - [ ] Reuse shared network error normalization path
- [ ] Apply web-parity masking rules in mobile rendering (AC: 4)
  - [ ] Ensure full account numbers are never shown
- [ ] Add mobile tests for dashboard/history/empty/error/masking behavior (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2 (`2.1`~`2.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-2-transfer-initiation-and-otp.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on Story 2.2, Story 2.3, and Story 1.4.
- This story establishes mobile parity for account inquiry UX.

### Technical Requirements

- Data and parity:
  - Dashboard/history contracts must match backend semantics used by web.
  - Refresh behavior must avoid duplicate entries and stale-state drift.
- UX consistency:
  - Empty/error states must follow mobile standard patterns.
  - Masking rule must match FE output semantics.

### Architecture Compliance

- Keep implementation within MOB lane boundaries.
- Use centralized mobile network layer and shared error normalization path.
- Do not implement screen-local parsing branches that diverge from shared contract.

### File Structure Requirements

- Expected touched areas:
  - `MOB/src/screens/**`
  - `MOB/src/navigation/**`
  - `MOB/src/network/**`
  - `MOB/src/store/**`
  - `MOB/src/test/**`

### Testing Requirements

- Required checks:
  - Authenticated dashboard renders balance summary correctly.
  - Pull-to-refresh updates latest history without duplication.
  - Empty/error states match mobile UI standard.
  - Account masking output matches web parity rule.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Refresh-consistency gate:
  - Validate pull-to-refresh does not create duplicates or stale merges.
- Parity gate:
  - Validate masking and error-state semantics match FE parity expectations.
- Evidence gate:
  - Attach mobile test evidence for dashboard/history/empty/error/masking scenarios.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 mobile dashboard/history parity guardrails prepared.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.5)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-2-transfer-initiation-and-otp.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 2 planning artifact.

### Completion Notes List

- Added mobile refresh-dedup and FE/MOB masking-parity guardrails.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-5-mobile-account-dashboard-and-history.md
