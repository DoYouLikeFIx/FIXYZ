# Story 7.2: [CH] Notification Persistence APIs

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a notification user,
I want persisted notification history and read-state APIs,
So that missed events can be recovered.

## Acceptance Criteria

1. Given order terminal event When notification pipeline runs Then notification is persisted before/with dispatch.
2. Given list API request When pagination params applied Then ordered notifications are returned.
3. Given read-mark request When notification id belongs to user Then read status is updated.
4. Given unauthorized notification access When validation fails Then request is denied.

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
- Depends on: Story 7.1.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 7 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 7.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-2-notification-persistence-apis.md
