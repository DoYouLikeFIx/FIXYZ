# Story 2.6: BE Account Status Contract

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an account admin system,
I want explicit account status contract,
so that lock/unlock and order eligibility can be governed consistently.

## Acceptance Criteria

1. Given account status model, when status endpoint is queried, then `ACTIVE/LOCKED` and related metadata are returned.
2. Given locked account, when order flow requests eligibility, then denial reason code is deterministic.
3. Given status transition event, when status changes, then audit/security event is emitted.

## Tasks / Subtasks

- [ ] Implement account status query contract (AC: 1)
  - [ ] Expose status response with metadata fields required by callers
  - [ ] Keep enum/value semantics stable (`ACTIVE`, `LOCKED`)
- [ ] Implement order-eligibility evaluation contract (AC: 2)
  - [ ] Return deterministic denial reason code for locked/non-eligible states
  - [ ] Ensure caller-visible behavior is consistent across repeated checks
- [ ] Emit audit/security event on status transitions (AC: 3)
  - [ ] Record transition actor/context/reason in structured event payload
  - [ ] Ensure event emission is coupled to committed status transition
- [ ] Add integration tests for status query, eligibility denial, and event emission

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2 (`2.1`~`2.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on Story 2.1.
- This story defines status semantics consumed by later order-governance flows.

### Technical Requirements

- Contract stability:
  - Status enum and metadata must be explicit and forward-compatible.
  - Eligibility denial reason must be deterministic for same state/input.
- Governance:
  - Status transitions must emit traceable audit/security events.
- Integration:
  - Downstream order logic must be able to consume eligibility contract without interpretation drift.

### Architecture Compliance

- Keep status model and transition ownership in account-domain backend lane.
- Align event emission with audit/security event model conventions.
- Preserve normalized error/event/correlation practices across services.

### File Structure Requirements

- Expected touched areas:
  - `BE/corebank-service/src/main/**/account/**`
  - `BE/channel-service/src/main/**/account/**` (if eligibility contract is proxied)
  - `BE/*/src/main/**/audit/**` or `**/security-events/**`
  - `BE/*/src/test/**`

### Testing Requirements

- Required checks:
  - Status endpoint returns `ACTIVE/LOCKED` and metadata correctly.
  - Locked-account eligibility check returns deterministic denial code.
  - Status transitions emit expected audit/security event payload.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Contract determinism gate:
  - Validate same status input yields same eligibility denial code.
- Event integrity gate:
  - Validate status transition emits one traceable audit/security event.
- Evidence gate:
  - Attach status/eligibility/event integration test evidence.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 account-status governance guardrails prepared.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.6)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 2 planning artifact.

### Completion Notes List

- Added deterministic status/eligibility and audit-event emission guardrails.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-6-account-status-contract.md
