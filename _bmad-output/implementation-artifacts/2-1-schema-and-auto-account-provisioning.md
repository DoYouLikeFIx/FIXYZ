# Story 2.1: BE Schema and Auto Account Provisioning

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an account-domain owner,
I want normalized account schema and provisioning endpoints,
so that every registered member has a usable account baseline.

## Acceptance Criteria

1. Given migration scripts, when service boots, then account/member tables are created with required constraints.
2. Given successful member registration event, when provisioning endpoint is called, then default account is created idempotently.
3. Given duplicate provisioning request, when same member is targeted, then account duplication does not occur.
4. Given provisioning failure, when transaction is rolled back, then failure reason is returned with normalized code.

## Tasks / Subtasks

- [ ] Implement and verify account-domain schema migrations (AC: 1)
  - [ ] Add/verify account table constraints (ownership, uniqueness, status defaults)
  - [ ] Ensure migration startup validation fails fast on mismatch
- [ ] Implement idempotent default-account provisioning flow (AC: 2)
  - [ ] Provide internal provisioning path for newly registered member
  - [ ] Guarantee one default account baseline per member policy
- [ ] Prevent duplicate account creation on retries/replays (AC: 3)
  - [ ] Enforce idempotency via constraint + deterministic conflict handling
  - [ ] Return stable success/duplicate semantics
- [ ] Implement rollback-safe failure handling (AC: 4)
  - [ ] Ensure failed provisioning leaves no partial account state
  - [ ] Return normalized error code with actionable reason
- [ ] Add integration tests for bootstrap/duplicate/failure scenarios (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2 (`2.1`~`2.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on Story 0.1 and Story 1.1.
- This story establishes account-domain baseline for all Epic 2 inquiry APIs.

### Technical Requirements

- Schema and ownership:
  - Account domain must be migration-managed and deterministic at startup.
  - Provisioning must keep member-account ownership explicit and enforceable.
- Idempotency:
  - Repeated provisioning for the same member must not create duplicate accounts.
  - Retry behavior must be deterministic and safe under at-least-once invocation.
- Error contract:
  - Failures must return normalized codes/messages consistent with global API envelope.

### Architecture Compliance

- Keep account schema ownership in corebank/account domain lane.
- Keep channel-to-corebank boundary internal and header-guarded for internal provisioning calls.
- Do not move account-creation ownership into client layers.

### File Structure Requirements

- Expected touched areas:
  - `BE/corebank-service/src/main/**/account/**`
  - `BE/corebank-service/src/main/resources/db/migration/**`
  - `BE/channel-service/src/main/**/auth/**` (only if registration-provisioning hook requires integration)
  - `BE/*/src/test/**`

### Testing Requirements

- Required checks:
  - Fresh boot applies account schema migrations successfully.
  - First provisioning call creates default account.
  - Duplicate provisioning call does not duplicate account rows.
  - Failure path rolls back and returns normalized failure code.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Idempotency boundary gate:
  - Validate duplicate/retry provisioning remains single-account outcome.
- Failure atomicity gate:
  - Validate partial writes are absent on provisioning failure.
- Evidence gate:
  - Attach integration evidence for success, duplicate, and rollback scenarios.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 story context prepared with account-domain guardrails.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.1)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 2 planning artifact.

### Completion Notes List

- Added canonical numbering and idempotent provisioning guardrails.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-1-schema-and-auto-account-provisioning.md
