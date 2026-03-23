# Story 2.8: [FE/MOB][CH] Portfolio PnL Visibility & Stale Valuation Guidance

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated investor,
I want portfolio screens to show server-owned valuation and PnL only when the backend marks it trustworthy,
so that I do not mistake stale valuation for live portfolio truth.

## Acceptance Criteria

1. Given portfolio data is returned with `valuationStatus=FRESH`, when the portfolio screen renders on web and mobile, then both clients display `avgPrice`, `marketPrice`, `unrealizedPnl`, `realizedPnlDaily`, `quoteAsOf`, and `quoteSourceMode` using the server response without client-side recalculation.
2. Given portfolio data is returned with `valuationStatus=STALE` or `valuationStatus=UNAVAILABLE`, when the portfolio screen renders, then web and mobile do not invent, recompute, or cache synthetic PnL values, hide or neutralize unavailable valuation numbers consistently, and show clear stale or unavailable guidance derived from `valuationStatus` and `valuationUnavailableReason`.
3. Given positive, negative, zero, and `null` valuation values are returned by the backend, when clients render PnL and valuation rows, then formatting, sign treatment, emphasis, placeholder handling, and copy remain parity-safe across web and mobile for the same payload.
4. Given quote freshness metadata is returned by the backend, when the user views portfolio valuation context, then the UI shows `quoteAsOf`, `quoteSourceMode`, and a user-facing freshness or status label that makes it clear whether displayed valuation is trustworthy, stale, or unavailable.
5. Given the user transitions from portfolio inquiry toward order-related flows, when valuation freshness is stale or unavailable, then the client carries only server-owned freshness metadata and guidance forward while leaving actual order-validation enforcement to the backend contract.
6. Given FE/MOB contract, fixture, or screen behavior regresses, when unit, integration, or E2E verification runs, then tests prove fresh rendering, stale rendering, unavailable rendering, null-field handling, and cross-client parity for all server-owned valuation states.

## Tasks / Subtasks

- [ ] Extend FE and MOB account response types and fixtures for valuation metadata (AC: 1, 2, 6)
  - [ ] Add `avgPrice`, `marketPrice`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, `realizedPnlDaily`, `valuationStatus`, and `valuationUnavailableReason` to shared client-side contract types.
  - [ ] Update mock fixtures and API adapters so fresh, stale, and unavailable payloads are represented explicitly.
- [ ] Render fresh valuation and PnL consistently across web and mobile (AC: 1, 3, 4)
  - [ ] Show server-owned values, timestamps, and source labels without duplicating formula logic in the clients.
  - [ ] Keep color, sign, placeholder, and copy behavior aligned across both surfaces.
- [ ] Implement stale and unavailable presentation guidance (AC: 2, 4, 5)
  - [ ] Hide or neutralize unavailable valuation numbers and present clear freshness messaging derived from backend status and reason.
  - [ ] Carry only backend freshness metadata forward to order-adjacent flows and keep validation ownership on the backend.
- [ ] Add parity and regression coverage for FE/MOB rendering behavior (AC: 2, 3, 6)
  - [ ] Add tests for fresh, stale, unavailable, and null-field payloads on web and mobile.
  - [ ] Verify no client-side PnL recalculation path is introduced.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2.
- Depends on Story 2.4, Story 2.5, and Story 2.7.
- This story is intentionally display-only. All formula ownership stays on the backend.
- Existing FE and MOB account types currently stop at quantity and balance fields; this story is the planned contract expansion point.

### Technical Requirements

- Clients must never compute PnL locally from `avgPrice` and `marketPrice`.
- Freshness semantics are backend-owned:
  - `valuationStatus`: `FRESH`, `STALE`, `UNAVAILABLE`
  - `valuationUnavailableReason`: `STALE_QUOTE`, `QUOTE_MISSING`, `PROVIDER_UNAVAILABLE`
- UI behavior:
  - `FRESH`: render valuation and PnL values normally.
  - `STALE` / `UNAVAILABLE`: do not display synthetic or cached market-derived values as if they are current.
  - Use backend timestamps and source metadata to explain the state to the user.

### Architecture Compliance

- Preserve existing FE/MOB portfolio information architecture and extend it with contract-driven valuation rows.
- Keep parity across web and mobile; copy and placeholder semantics should not drift for the same backend payload.
- Do not move stale-quote validation into the clients. Backend remains the enforcement source of truth.

### File Structure Requirements

- Expected touched areas:
  - `FE/src/types/**`
  - `FE/src/**/portfolio/**`
  - `MOB/src/types/**`
  - `MOB/src/**/portfolio/**`
  - `FE/**/test/**`
  - `MOB/**/test/**`

### Testing Requirements

- Validate fresh/stale/unavailable rendering on both clients.
- Validate formatting parity for positive, negative, zero, and `null` values.
- Validate no client-side math path is introduced for `unrealizedPnl` or `realizedPnlDaily`.
- Validate stale guidance remains aligned with backend enum values and metadata.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key`, filename, and sprint-status entry all match `2-8-portfolio-pnl-visibility-and-stale-valuation-guidance`.
- Render-only gate:
  - Verify FE/MOB render server-owned values and never derive PnL locally.
- Parity gate:
  - Verify identical payloads produce parity-safe web/mobile states for fresh, stale, unavailable, and null values.
- Evidence gate:
  - Attach FE/MOB screenshots or test artifacts that show fresh and stale/unavailable states before closing the story.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 2 FE/MOB valuation visibility follow-on prepared with stale-state guidance and parity guardrails.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.8)
- `_bmad-output/planning-artifacts/prd.md` (`FR-55`, `FR-56`)
- `_bmad-output/planning-artifacts/accounts/api-spec.md` (`API-CH-04`, `API-CH-05`)
- `_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from Epic 2 planning updates and cross-client stale-valuation discussion.

### Completion Notes List

- Added a dedicated FE/MOB render-only story for valuation and PnL visibility.
- Locked cross-client stale/unavailable handling to backend-owned freshness metadata.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-8-portfolio-pnl-visibility-and-stale-valuation-guidance.md
