# Story 2.2: BE Position, Balance, and Available-Balance API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want real-time position and cash balance information,
so that order decisions can be made safely.

## Acceptance Criteria

1. Given valid owned account, when `GET /api/v1/accounts/{accountId}/positions?symbol={symbol}` is called, then current `quantity`, `availableQuantity`, canonical `balance`, alias `availableBalance` (`== balance`), `currency`, and `asOf` are returned.
2. Given non-owned account request, when authorization is checked by `AUTH_MEMBER_ID` ownership boundary, then API returns `403` with stable machine code `AUTH-005`.
3. Given concurrent updates, when reads occur, then response remains transactionally consistent (single-read snapshot without contradictory cash/position state).
4. Given downstream error, when query fails, then normalized retriable/non-retriable code is returned using fixed mapping table in this story.

## Tasks / Subtasks

- [ ] Freeze Story 2.2 read contract across planning/implementation/account specs (AC: 1, 2, 4)
  - [ ] Keep canonical scope as position + available quantity + cash balance
  - [ ] Keep `balance` canonical and `availableBalance` alias-only (`== balance`)
  - [ ] Keep `availableQuantity` canonical and `availableQty` compatibility alias (deprecated)
- [ ] Implement owned-account inquiry endpoint in channel/corebank boundary (AC: 1)
  - [ ] Channel external endpoint: `GET /api/v1/accounts/{accountId}/positions?symbol={symbol}`
  - [ ] Corebank internal endpoint: `GET /internal/v1/accounts/{accountId}/positions?symbol={symbol}&memberId={memberId}`
  - [ ] Preserve currency/as-of semantics consistently
- [ ] Enforce ownership authorization on account reads (AC: 2)
  - [ ] Extract `memberId` from session `AUTH_MEMBER_ID` in channel layer
  - [ ] Forward `memberId` to corebank and enforce `accounts.member_id == memberId`
  - [ ] Return `403 AUTH-005` deterministically for ownership mismatch
- [ ] Ensure read consistency under concurrent writes (AC: 3)
  - [ ] Apply transaction/read strategy that avoids stale or contradictory balance/position snapshots
  - [ ] Add deterministic consistency assertions in tests
- [ ] Normalize downstream/query failure mapping (AC: 4)
  - [ ] Distinguish retriable/non-retriable failures with stable machine codes
  - [ ] Avoid leaking internal exception details
- [ ] Add integration and contract tests for owned/non-owned/concurrent/failure scenarios (AC: 1, 2, 3, 4)
  - [ ] Include OpenAPI contract update + compatibility test pass in DoD

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2 (`2.1`~`2.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on Story 2.1 and Story 1.2.
- This story is the canonical read-side contract baseline for FE/MOB dashboard flows and order-prepare precheck.

### Technical Requirements

- Contract:
  - External endpoint: `GET /api/v1/accounts/{accountId}/positions?symbol={symbol}`.
  - Internal endpoint: `GET /internal/v1/accounts/{accountId}/positions?symbol={symbol}&memberId={memberId}`.
  - `balance` is the canonical field and means available cash (already net of pending reservations).
  - `availableBalance` must be alias-only (`availableBalance == balance`) with no recomputation.
  - `availableQuantity` is canonical for available sell quantity.
  - `availableQty` may be exposed only as a compatibility alias and must equal `availableQuantity`.
  - `pendingAmount` is reservation context only; do not derive `availableBalance = balance - pendingAmount`.
  - Amount serialization must use DECIMAL(19,4) scale consistently across API/examples/tests.
- Security:
  - Ownership verification is mandatory before balance/position disclosure.
  - Channel must derive `memberId` from `AUTH_MEMBER_ID`; client-provided `memberId` is not trusted.
  - Ownership mismatch must return `403 AUTH-005`.
- Consistency:
  - Reads during concurrent mutations must preserve transactional correctness and coherent cash/position snapshot.
- Error policy:
  - Retries must be guided by fixed normalized retriable/non-retriable mapping.
  - Retriable mapping:
    - `CORE-901` (dependency timeout), `CORE-902` (dependency unavailable)
  - Non-retriable mapping:
    - `AUTH-005` (forbidden ownership), `CORE_001` (resource not found), `VALIDATION_001` (invalid request)

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
  - Owned account returns `quantity`, `availableQuantity`, canonical `balance`, and alias `availableBalance` (`== balance`).
  - If compatibility alias `availableQty` is present, it equals `availableQuantity`.
  - Non-owned account access returns `403 AUTH-005` and no data leakage.
  - Concurrent write/read scenario keeps deterministic and coherent cash/position contract.
  - Downstream failure maps to fixed retriable/non-retriable code table.
  - OpenAPI contracts (`channel-service.json`, `corebank-service.json`) are updated and compatibility tests pass.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key ↔ filename ↔ sprint-status key` are identical.
- Ownership gate:
  - Validate unauthorized account reads are denied without data leakage.
- Consistency gate:
  - Validate read contract remains coherent under concurrent updates.
- Evidence gate:
  - Attach tests covering owned/non-owned/concurrent/failure scenarios.

### Definition of Done

- AC1~AC4 automated tests pass (owned/non-owned/concurrent/failure mapping).
- Channel/Corebank OpenAPI contracts are updated:
  - `BE/contracts/openapi/channel-service.json`
  - `BE/contracts/openapi/corebank-service.json`
- OpenAPI compatibility tests pass in both modules.
- Ownership mismatch path proves `403 AUTH-005` with no data leakage.
- Field compatibility checks prove:
  - `availableBalance == balance`
  - `availableQty == availableQuantity` (when alias is exposed)

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 position/balance inquiry guardrails prepared with ownership/error/DoD freeze.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 2 planning artifact.

### Completion Notes List

- Added ownership and transactional-consistency verification gates.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-2-balance-and-available-balance-api.md
