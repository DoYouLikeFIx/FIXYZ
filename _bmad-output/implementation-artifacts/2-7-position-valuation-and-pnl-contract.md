# Story 2.7: [BE][AC] Position Valuation & PnL Contract

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want position inquiry responses to include valuation and PnL with explicit freshness semantics,
so that I can interpret portfolio performance without trusting stale market data.

## Acceptance Criteria

1. Given valid owned account inquiry and fresh valuation inputs, when position or portfolio inquiry is requested, then the response includes `avgPrice`, `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, `realizedPnlDaily`, and `valuationStatus=FRESH` alongside existing quantity/balance fields.
2. Given BUY and SELL executions already exist for the symbol, when valuation fields are computed, then `avgPrice`, `unrealizedPnl`, and `realizedPnlDaily` follow the documented MVP formulas and use deterministic DECIMAL scale consistent with the account inquiry contract.
3. Given the latest quote snapshot is stale or unavailable for valuation, when the inquiry is processed, then the API still returns `200 OK`, preserves non-market-derived fields (`quantity`, `availableQuantity`, `balance`, `availableBalance`, `currency`, `asOf`, `avgPrice`), returns `marketPrice`, `unrealizedPnl`, and `realizedPnlDaily` as `null`, sets `valuationStatus` to `STALE` or `UNAVAILABLE`, and populates `valuationUnavailableReason` with a canonical reason code.
4. Given a non-owned account request, when authorization is evaluated using server-owned member/session identity, then the API returns deterministic `403 AUTH-005` and discloses no position, valuation, or PnL fields.
5. Given concurrent executions or position mutations are in progress, when inquiry reads occur, then quantity, balance, average price, and valuation-state fields are returned from one transactionally coherent snapshot without contradictory cash/position/PnL combinations.
6. Given the valuation contract is changed or extended, when OpenAPI generation and compatibility verification run, then channel/corebank specs remain aligned on nullable stale behavior and canonical enum values for `valuationStatus` and `valuationUnavailableReason`.

## Tasks / Subtasks

- [ ] Extend the account inquiry contract with valuation and PnL fields (AC: 1, 6)
  - [ ] Add `avgPrice`, `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, `realizedPnlDaily`, `valuationStatus`, and `valuationUnavailableReason` to the canonical BE DTO/OpenAPI surfaces.
  - [ ] Keep Story 2.2 canonical fields and compatibility aliases unchanged while layering valuation fields on top.
- [ ] Implement deterministic valuation and PnL computation rules (AC: 1, 2, 5)
  - [ ] Reuse committed execution and position-ledger truth from Story 5.2 for weighted-average cost and realized/unrealized PnL math.
  - [ ] Enforce fixed DECIMAL serialization and one coherent read snapshot across quantity, balance, average price, and valuation status.
- [ ] Implement the stale and unavailable valuation policy (AC: 3, 4)
  - [ ] Return `200 OK` for inquiry reads even when quote freshness is stale or unavailable.
  - [ ] Null only market-derived fields and populate canonical `valuationStatus` and `valuationUnavailableReason` enums without leaking unauthorized data.
- [ ] Add compatibility and regression coverage for the valuation contract (AC: 2, 3, 5, 6)
  - [ ] Add BE tests for fresh, stale, unavailable, ownership-denied, and concurrent-read scenarios.
  - [ ] Add contract verification that channel/corebank schemas and serialized field nullability remain aligned.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2.
- Depends on Story 2.2 and Story 5.2.
- PRD still carries FR-55 and FR-56 plus the MVP PnL formulas; this story is the plan-level owner for that contract.
- Story 2.2 keeps the base inquiry scope (`quantity`, `availableQuantity`, `balance` plus aliases). Story 2.7 adds valuation and PnL without redefining Story 2.2.

### Technical Requirements

- Read-side stale policy:
  - Inquiry endpoints degrade gracefully with `200 OK` and explicit freshness metadata.
  - `marketPrice`, `unrealizedPnl`, and `realizedPnlDaily` become `null` when valuation is stale or unavailable.
  - Non-market-derived fields (`quantity`, `availableQuantity`, `balance`, `availableBalance`, `currency`, `asOf`, `avgPrice`) remain present.
- Canonical enums:
  - `valuationStatus`: `FRESH`, `STALE`, `UNAVAILABLE`
  - `valuationUnavailableReason`: `STALE_QUOTE`, `QUOTE_MISSING`, `PROVIDER_UNAVAILABLE`
- Scope boundary:
  - This story owns inquiry-time valuation semantics only.
  - Order prepare/execute fail-closed stale-quote enforcement remains owned by order-validation stories and must not be weakened here.

### Architecture Compliance

- Preserve channel-service ownership checks that derive `memberId` from the authenticated session and enforce `403 AUTH-005` on mismatch.
- Keep valuation math server-owned; FE/MOB must remain pure renderers of the returned contract.
- Reuse existing quote snapshot metadata and ledger/execution records rather than introducing duplicate valuation storage.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/account/**`
  - `BE/corebank-service/src/main/**/account/**`
  - `BE/*/src/main/**/quote/**`
  - `BE/*/src/test/**`

### Testing Requirements

- Validate fresh, stale, and unavailable valuation responses.
- Validate ownership denial (`AUTH-005`) never leaks valuation data.
- Validate concurrent inquiry reads observe a coherent quantity/balance/avgPrice/valuation snapshot.
- Validate OpenAPI and compatibility tests cover nullable valuation fields and enum values.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key`, filename, and sprint-status entry all match `2-7-position-valuation-and-pnl-contract`.
- Stale-policy gate:
  - Verify stale/unavailable valuation returns `200 OK`, preserves non-market-derived fields, and nulls only market-derived values.
- Contract determinism gate:
  - Verify fixed DECIMAL scale and canonical enum values across repeated responses.
- Evidence gate:
  - Attach contract-test and stale-state regression evidence before closing the story.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 valuation/PnL contract follow-on prepared with explicit stale-valuation semantics.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.7)
- `_bmad-output/planning-artifacts/prd.md` (`PnL Model (MVP)`, `FR-55`, `FR-56`)
- `_bmad-output/planning-artifacts/accounts/api-spec.md` (`API-CH-04`, `API-CH-05`, PnL calculation rules)
- `_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from Epic 2 planning updates and PnL scope reconciliation discussion.

### Completion Notes List

- Reopened Epic 2 with a dedicated BE valuation/PnL contract owner.
- Locked the inquiry stale policy to graceful degradation with explicit status enums.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-7-position-valuation-and-pnl-contract.md
