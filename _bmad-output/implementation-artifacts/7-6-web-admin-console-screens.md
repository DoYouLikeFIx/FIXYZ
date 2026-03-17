# Story 7.6: [FE] Web Admin Console Screens

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operations admin,
I want web screens for security administration,
So that privileged tasks can be done without direct API tooling.

## Acceptance Criteria

1. Given admin authenticated user When admin console opened Then session-invalidate and audit search UIs are available.
2. Given unauthorized user When route access attempted Then access is blocked.
3. Given admin action result When API responds Then success/failure feedback is shown.
4. Given audit filter input When search executed Then result list and pagination work correctly.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 7.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 7.5.
- Product decision recorded: baseline admin web console is included in MVP scope and the PRD admin journey now reflects browser-based admin operations.
- This story consumes the fixed Story 7.5 admin API contract; do not invent alternate admin endpoints.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only when Story 7.5 is `done` or its admin API contract is explicitly frozen unchanged for the same implementation branch.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Route access must remain `ROLE_ADMIN`-only and block anonymous / non-admin users deterministically.
- The UI must call only the canonical Story 7.5 endpoints and honor the canonical error envelope.
- Audit search UX must support the same filter set and pagination rules as `GET /api/v1/admin/audit-logs`.
- Force logout UX must preserve the idempotent `invalidatedCount: 0` success path and must not treat it as an error.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Reuse the existing FE auth store role data and protected-route layout.
- Add explicit admin navigation/route gating only for `ROLE_ADMIN` users; do not leak the screen into anonymous or standard-user flows.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Verify route guard, unauthorized-blocking, success/error feedback, and audit pagination/filter behavior.

### Quinn Reinforcement Checks

- Dependency gate:
  - Reject implementation start if Story 7.5 API ownership is still ambiguous or unstable.
- Contract-consumption gate:
  - Reject FE work that invents new admin endpoints instead of consuming Story 7.5.
- Evidence gate:
  - Attach route-guard proof and one successful / one idempotent force-logout UI proof before status moves to `review`.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story restored to `ready-for-dev` after the product decision to include the baseline admin web console in MVP scope.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.6)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/7-5-admin-session-and-audit-apis.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 7.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Re-enabled as `ready-for-dev` after the admin UI scope decision was recorded in the PRD.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-6-web-admin-console-screens.md
