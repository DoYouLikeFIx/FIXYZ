# Story 2.2: BE Balance and Available-Balance API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want real-time balance information,
so that transfer decisions can be made safely.

## Acceptance Criteria

1. Given valid owned account, when balance API is called, then current balance and available balance are returned.
2. Given non-owned account request, when authorization is checked, then access is denied.
3. Given concurrent updates, when reads occur, then response remains transactionally consistent.
4. Given downstream error, when query fails, then normalized retriable/non-retriable code is returned.

## Tasks / Subtasks

- [ ] Implement owned-account balance inquiry endpoint (AC: 1)
  - [ ] Return current and available balance fields in stable contract
  - [ ] Preserve currency/as-of semantics consistently
- [ ] Enforce ownership authorization on account reads (AC: 2)
  - [ ] Deny non-owned account access deterministically
  - [ ] Keep forbidden behavior aligned with global error contract
- [ ] Ensure read consistency under concurrent writes (AC: 3)
  - [ ] Apply transaction/read strategy that avoids stale or contradictory balances
  - [ ] Add deterministic consistency assertions in tests
- [ ] Normalize downstream/query failure mapping (AC: 4)
  - [ ] Distinguish retriable/non-retriable failures with stable codes
  - [ ] Avoid leaking internal exception details
- [ ] Add integration tests for ownership, consistency, and error mapping (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2 (`2.1`~`2.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-2-transfer-initiation-and-otp.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on Story 2.1 and Story 1.2.
- This story is the read-side contract baseline for FE/MOB dashboard flows.

### Technical Requirements

- Contract:
  - Response must include both `balance` and `availableBalance` semantics.
  - Field meanings must remain stable across clients.
- Security:
  - Ownership verification is mandatory before balance disclosure.
- Consistency:
  - Reads during concurrent mutations must preserve transactional correctness.
- Error policy:
  - Retries must be guided by normalized retriable/non-retriable codes.

### Architecture Compliance

- Keep account inquiry in corebank/channel service ownership boundaries.
- Preserve PII and account-number masking policy for user-facing surfaces.
- Follow standardized exception envelope and correlation behavior.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/account/**`
  - `BE/corebank-service/src/main/**/account/**`
  - `BE/*/src/test/**`

### Testing Requirements

- Required checks:
  - Owned account returns current and available balance.
  - Non-owned account access returns forbidden response.
  - Concurrent write/read scenario keeps deterministic balance contract.
  - Downstream failure maps to normalized retriable/non-retriable code.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Ownership gate:
  - Validate unauthorized account reads are denied without data leakage.
- Consistency gate:
  - Validate read contract remains coherent under concurrent updates.
- Evidence gate:
  - Attach tests covering owned/non-owned/concurrent/failure scenarios.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 balance inquiry guardrails prepared.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-2-transfer-initiation-and-otp.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 2 planning artifact.

### Completion Notes List

- Added ownership and transactional-consistency verification gates.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-2-balance-and-available-balance-api.md
