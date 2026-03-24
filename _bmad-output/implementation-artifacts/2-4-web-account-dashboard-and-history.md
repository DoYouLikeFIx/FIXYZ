# Story 2.4: FE Web Portfolio Dashboard and History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want to view my default-account portfolio summary and order history,
so that portfolio insights are available in one place.

## Acceptance Criteria

1. Given authenticated session, when dashboard loads, then default-account portfolio summary, masked account number, balances, and positions are displayed without an account-selection step.
2. Given history tab interaction, when page/filter is changed, then server-driven history list updates correctly.
3. Given API failure, when error occurs, then user sees standardized retry guidance.
4. Given account number policy, when UI renders values, then masking format is applied consistently.

## Tasks / Subtasks

- [x] Implement dashboard default-account summary rendering (AC: 1)
  - [x] Load and display default-account balances, masked account number, and portfolio summary on initial dashboard view
  - [x] Keep MVP entry flow free of an account-selection step
  - [x] Keep loading/error/empty states deterministic
- [x] Implement history list with server-driven paging/filtering (AC: 2)
  - [x] Sync page/filter controls with backend query contract
  - [x] Prevent duplicate or stale list rendering on quick interactions
- [x] Implement standardized API-failure guidance (AC: 3)
  - [x] Reuse global error semantics and retry guidance pattern
  - [x] Keep message/action consistency with FE auth error standards
- [x] Apply account-number masking policy consistently (AC: 4)
  - [x] Ensure full account number is never shown in user-facing surfaces
- [x] Add FE tests for dashboard/history/error/masking behaviors (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2 (`2.1`~`2.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on Story 2.2, Story 2.3, and Story 1.3.
- This story consumes Epic 2 inquiry APIs and exposes them in FE dashboard UX.
- MVP account model note: FE dashboard assumes one member-owned default trading account; account-selection UX is out of scope for this story.

### Technical Requirements

- Data flow:
  - Dashboard must consume default-account balance/account summary contract from backend.
  - Dashboard entry must resolve directly to the provisioned default account with no account-selection branch.
  - History tab must use server-driven pagination/filtering semantics.
- UX consistency:
  - Error handling must follow standardized retry guidance pattern.
  - Masking rule must be identical across portfolio summary/history surfaces.

### Architecture Compliance

- Keep web lane logic within FE submodule scope.
- Use shared API client/interceptor pattern; avoid per-page network divergence.
- Do not bypass backend ownership/masking rules with client-side assumptions.

### File Structure Requirements

- Expected touched areas:
  - `FE/src/pages/**`
  - `FE/src/components/**`
  - `FE/src/lib/axios*`
  - `FE/src/store/**`
  - `FE/src/test/**`

### Testing Requirements

- Required checks:
  - Authenticated dashboard renders account summary and balances.
  - History page/filter updates backend-driven list correctly.
  - API failure shows standardized retry guidance.
  - Masking rule is consistently applied to rendered account numbers.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- FE contract gate:
  - Validate list/filter state stays synchronized with backend contract.
- Masking gate:
  - Validate full account number never appears in rendered UI.
- Evidence gate:
  - Attach UI test evidence for dashboard/history/error/masking cases.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 web dashboard/history guardrails prepared.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.4)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 2 planning artifact.

### Completion Notes List

- Added server-driven history sync and masking guardrails for FE.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-4-web-account-dashboard-and-history.md
