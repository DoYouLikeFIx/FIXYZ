# Story 4.2: [CH] OTP Verification Policy

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated order initiator,
I want robust OTP verification controls,
So that step-up authentication is secure and abuse-resistant.

## Acceptance Criteria

1. Given valid OTP in allowed time window When verify endpoint is called Then verification succeeds and session can advance.
2. Given duplicate rapid verify attempts When debounce policy applies Then request is throttled without attempt over-consumption.
3. Given OTP replay in same window When replay is detected Then request is rejected.
4. Given max attempts exceeded When further verify is attempted Then session is failed and execution blocked.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 4.1, Story 1.2.

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
- Completion note: Epic 4 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/4-2-otp-verification-policy.md
