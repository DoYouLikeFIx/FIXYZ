# Story 2.8: [FE/MOB][CH] Portfolio PnL Visibility & Stale Valuation Guidance

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated investor,
I want portfolio screens on web and mobile to show server-owned valuation and PnL only when the backend marks it trustworthy,
so that I do not mistake stale valuation for live portfolio truth.

## Scope Decision

- This execution artifact now records the completed cross-client slice for `FE` and `MOB`.
- FE parity was implemented after the original MOB-first execution pass, so Epic 2 valuation visibility now has matching web/mobile evidence for the Story 2.8 contract.

## Acceptance Criteria

1. Given portfolio data is returned with `valuationStatus=FRESH`, when the account dashboard or selected-position portfolio surface renders on web and mobile, then both clients display `avgPrice`, `marketPrice`, `unrealizedPnl`, `realizedPnlDaily`, `quoteAsOf`, and `quoteSourceMode` directly from the server response without client-side recalculation.
2. Given portfolio data is returned with `valuationStatus=STALE` or `valuationStatus=UNAVAILABLE`, when the portfolio surface renders, then web and mobile do not invent, recompute, or cache synthetic PnL values, hide or neutralize unavailable market-derived numbers consistently, and show clear stale or unavailable guidance derived from `valuationStatus` and `valuationUnavailableReason`.
3. Given positive, negative, zero, and `null` valuation values are returned by the backend, when clients render PnL and valuation rows, then formatting, sign treatment, emphasis, and placeholder handling remain internally consistent and clearly distinguish `0` from unavailable data.
4. Given quote freshness metadata is returned by the backend, when the user views portfolio valuation context, then the UI shows `quoteAsOf`, `quoteSourceMode`, and a user-facing freshness or status label that makes it clear whether displayed valuation is trustworthy, stale, or unavailable.
5. Given the user transitions from portfolio inquiry toward order-related flows, when valuation freshness is stale or unavailable, then the clients carry only server-owned freshness metadata and guidance forward while leaving actual order-validation enforcement to the backend contract.
6. Given FE/MOB contract, fixture, or screen behavior regresses, when unit, integration, or E2E verification runs, then tests prove fresh rendering, stale rendering, unavailable rendering, null-field handling, and absence of client-side PnL math for all server-owned valuation states used by both clients.

## Tasks / Subtasks

- [x] Extend FE/MOB account response types and fixtures for valuation metadata (AC: 1, 2, 6)
  - [x] Add `avgPrice`, `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, `realizedPnlDaily`, `valuationStatus`, and `valuationUnavailableReason` to client account response types with backend-nullability preserved.
  - [x] Update web/mobile fixtures, API tests, and local mock payloads so fresh, stale, and unavailable responses are represented explicitly.
- [x] Render fresh valuation and PnL on web/mobile portfolio surfaces (AC: 1, 3, 4)
  - [x] Show server-owned valuation rows, timestamps, and source labels in dashboard surfaces without duplicating formula logic in the client.
  - [x] Treat the selected position payload from `fetchAccountPositions` as the canonical valuation source for portfolio rendering; do not synthesize valuation rows from summary responses that do not yet carry the full valuation contract.
- [x] Implement stale and unavailable presentation guidance on web/mobile (AC: 2, 4, 5)
  - [x] Hide or neutralize unavailable market-derived numbers and present freshness messaging derived from backend status and reason enums.
  - [x] Carry only backend freshness metadata and guidance into order-adjacent surfaces; keep stale-quote validation ownership on the backend.
- [x] Add FE/MOB regression coverage for valuation rendering behavior (AC: 2, 3, 6)
  - [x] Add tests for fresh, stale, unavailable, and null-field payloads in unit, integration, and targeted E2E coverage where practical.
  - [x] Verify no client-side PnL recalculation path is introduced in dashboard or order-adjacent flows.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2.
- Depends on Story 2.4, Story 2.5, and Story 2.7.
- This story is intentionally display-only. All formula ownership stays on the backend.
- Story 2.7 is already done and provides the backend valuation contract needed by both clients.
- Web and mobile both already had dashboard/order-adjacent quote surfaces, but Story 2.8 parity required them to model `avgPrice`, `unrealizedPnl`, `realizedPnlDaily`, `valuationStatus`, and `valuationUnavailableReason` explicitly.
- Current `summary` responses do not expose the full valuation contract, so selected-position rendering remains the canonical source for valuation rows across both clients.

### Technical Requirements

- Clients must never compute PnL locally from `avgPrice` and `marketPrice`.
- Freshness semantics are backend-owned:
  - `valuationStatus`: `FRESH`, `STALE`, `UNAVAILABLE`
  - `valuationUnavailableReason`: `STALE_QUOTE`, `QUOTE_MISSING`, `PROVIDER_UNAVAILABLE`
- UI behavior:
  - `FRESH`: render valuation and PnL values normally.
  - `STALE` / `UNAVAILABLE`: do not display synthetic or cached market-derived values as if they are current.
  - Use backend timestamps and source metadata to explain the state to the user.
- Client rendering rule:
  - Preserve backend nullability semantics. `STALE` may still include `quoteSnapshotId`, `quoteAsOf`, and `quoteSourceMode`, while `UNAVAILABLE` may not.
  - Do not infer freshness from missing fields alone when `valuationStatus` is present.
  - Prefer explicit placeholders and guidance copy over silently hiding the entire valuation context.

### Architecture Compliance

- Preserve existing web/mobile account-dashboard information architecture and extend it with contract-driven valuation rows.
- Do not move stale-quote validation into the clients. Backend remains the enforcement source of truth.
- FE and MOB parity are both part of the completed execution evidence for this story.

### File Structure Requirements

- Expected touched areas:
  - `FE/src/types/account.ts`
  - `FE/src/api/accountApi.ts`
  - `FE/src/lib/account-valuation.ts`
  - `FE/src/hooks/portfolio/useAccountDashboard.ts`
  - `FE/src/pages/PortfolioPage.tsx`
  - `FE/src/components/portfolio/DashboardQuoteTicker.tsx`
  - `FE/src/hooks/order/useOrderRecoveryController.ts`
  - `FE/src/components/order/ExternalOrderRecoverySection.tsx`
  - `FE/tests/unit/lib/account-valuation.test.ts`
  - `FE/tests/unit/api/accountApi.test.ts`
  - `FE/tests/unit/pages/PortfolioPage.test.tsx`
  - `FE/tests/unit/pages/OrderPage.test.tsx`
  - `FE/tests/integration/portfolio-transport-support-reference.test.tsx`
  - `FE/e2e/order-market-ticker.spec.ts`
  - `MOB/src/types/account.ts`
  - `MOB/src/api/account-api.ts`
  - `MOB/src/account/use-account-dashboard-view-model.ts`
  - `MOB/src/screens/app/AuthenticatedHomeScreen.tsx`
  - `MOB/src/components/account/DashboardQuoteTicker.tsx`
  - `MOB/src/order/use-external-order-view-model.ts`
  - `MOB/src/components/order/ExternalOrderRecoverySection.tsx`
  - `MOB/scripts/mock-auth-server.mjs`
  - `MOB/tests/unit/api/account-api.test.ts`
  - `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx`
  - `MOB/tests/e2e/mobile-dashboard-live.e2e.test.ts`

### Testing Requirements

- Validate fresh/stale/unavailable rendering on web and mobile.
- Validate formatting and placeholder handling for positive, negative, zero, and `null` values.
- Validate no client-side math path is introduced for `unrealizedPnl` or `realizedPnlDaily`.
- Validate stale guidance remains aligned with backend enum values and metadata.
- Validate both clients do not depend on summary valuation fields when positions payloads are the canonical valuation source.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key`, filename, and sprint-status entry all match `2-8-portfolio-pnl-visibility-and-stale-valuation-guidance`.
- Render-only gate:
  - Verify both clients render server-owned values and never derive PnL locally.
- Scope gate:
  - Verify this artifact includes FE and MOB parity evidence for the Story 2.8 contract.
- Evidence gate:
  - Attach FE/MOB test artifacts that show fresh and stale/unavailable states before closing the story.

### Story Completion Status

- Status set to `review`.
- Completion note: The FE and MOB slices are implemented, review findings were fixed, full FE regression and critical E2E evidence passed, and the story is ready for review with cross-client parity evidence.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.8)
- `_bmad-output/planning-artifacts/prd.md` (`FR-55`, `FR-56`)
- `_bmad-output/planning-artifacts/accounts/api-spec.md` (`API-CH-04`, `API-CH-05`)
- `_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `npm --prefix /Users/yeongjae/fixyz/MOB test -- --run tests/unit/account/account-valuation.test.ts tests/unit/api/account-api.test.ts tests/unit/order/AuthenticatedHomeScreen.test.tsx`
- `npm --prefix /Users/yeongjae/fixyz/MOB test -- --run tests/unit/order/AuthenticatedHomeScreen.test.tsx tests/integration/mobile-order-transport.test.tsx`
- `npm --prefix /Users/yeongjae/fixyz/MOB test`
- `npm --prefix /Users/yeongjae/fixyz/MOB run typecheck`
- `npm --prefix /Users/yeongjae/fixyz/MOB run lint`
- `pnpm --prefix /Users/yeongjae/fixyz/FE test`
- `pnpm --prefix /Users/yeongjae/fixyz/FE exec vitest run tests/unit/lib/account-valuation.test.ts tests/unit/api/accountApi.test.ts tests/unit/pages/PortfolioPage.test.tsx tests/unit/pages/OrderPage.test.tsx tests/integration/portfolio-transport-support-reference.test.tsx`
- `pnpm --prefix /Users/yeongjae/fixyz/FE run type-check`
- `pnpm --prefix /Users/yeongjae/fixyz/FE exec playwright test e2e/order-market-ticker.spec.ts`
- `pnpm --prefix /Users/yeongjae/fixyz/FE run lint`

### Implementation Plan

- Split the client read contract so `fetchAccountSummary` remains cash/balance-only while selected positions from `fetchAccountPositions` become the canonical valuation source.
- Add shared valuation helpers for freshness labels and stale/unavailable guidance so dashboard and order-adjacent ticker copy stay aligned on FE and MOB.
- Render valuation rows and quote context directly from backend-owned fields, using placeholders for missing market-derived values instead of client-side recomputation.

### Completion Notes List

- Implemented mobile valuation contract support for `avgPrice`, PnL fields, freshness enums, and unavailable reasons while keeping summary responses separate from selected-position valuation rendering.
- Added mobile dashboard valuation rows for fresh, stale, unavailable, zero, and malformed timestamp states with server-owned formatting, placeholders, and guidance copy.
- Extended the mobile market-order ticker to carry backend freshness status and stale/unavailable guidance forward without fabricating price or PnL values.
- Updated mobile fixtures and regressions to cover fresh, stale, unavailable, and zero/null valuation paths, plus the market-order stale metadata flow.
- Removed client-side freshness inference so valuation trust remains backend-owned, cleared cached market-order quotes after refresh failures, and aligned quote-panel status copy with actual stale/unavailable valuation state.
- Added direct regression coverage for the valuation helper and the account summary/position API contract boundary.
- Implemented FE parity for the valuation contract by splitting `AccountSummary` from `AccountPosition`, promoting selected-position data to the canonical valuation source, and rendering fresh/stale/unavailable valuation states with explicit placeholders and guidance.
- Extended the FE portfolio dashboard and order market ticker so stale/unavailable backend states suppress synthetic market-derived values, surface server-owned freshness metadata, and drop cached quotes after refresh failures.
- Added FE regression coverage across helper, API, page, transport, and Playwright layers for fresh/stale/unavailable valuation rendering and order-adjacent stale quote guidance.
- Re-ran the full FE regression suite, FE type-check, FE lint, and the critical market-order stale-quote Playwright flow to validate the story against the dev-story definition-of-done gates before moving it to review.

### File List

- FE/e2e/order-market-ticker.spec.ts
- FE/src/api/accountApi.ts
- FE/src/components/order/ExternalOrderRecoverySection.tsx
- FE/src/components/portfolio/DashboardQuoteTicker.tsx
- FE/src/hooks/order/useOrderRecoveryController.ts
- FE/src/hooks/portfolio/useAccountDashboard.ts
- FE/src/index.css
- FE/src/lib/account-valuation.ts
- FE/src/pages/PortfolioPage.tsx
- FE/src/types/account.ts
- FE/src/utils/formatters.ts
- FE/tests/integration/portfolio-transport-support-reference.test.tsx
- FE/tests/unit/api/accountApi.test.ts
- FE/tests/unit/lib/account-valuation.test.ts
- FE/tests/unit/pages/OrderPage.test.tsx
- FE/tests/unit/pages/PortfolioPage.test.tsx
- MOB/scripts/mock-auth-server.mjs
- MOB/src/account/account-valuation.ts
- MOB/src/account/use-account-dashboard-view-model.ts
- MOB/src/api/account-api.ts
- MOB/src/components/account/DashboardQuoteTicker.tsx
- MOB/src/components/order/ExternalOrderRecoverySection.tsx
- MOB/src/order/use-external-order-view-model.ts
- MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- MOB/src/types/account.ts
- MOB/src/utils/formatters.ts
- MOB/tests/e2e/mobile-dashboard-live.e2e.test.ts
- MOB/tests/integration/mobile-order-transport.test.tsx
- MOB/tests/unit/account/account-valuation.test.ts
- MOB/tests/unit/api/account-api.test.ts
- MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- _bmad-output/implementation-artifacts/2-8-portfolio-pnl-visibility-and-stale-valuation-guidance.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-03-24: Implemented the mobile valuation visibility slice for Story 2.8, including contract updates, fresh/stale/unavailable dashboard rendering, order-adjacent freshness guidance, mock fixture expansion, and mobile regression coverage.
- 2026-03-24: Senior code review requested changes and returned the story to in-progress because freshness ownership, stale/unavailable dashboard signaling, and API regression coverage are not fully aligned with the story contract.
- 2026-03-24: Addressed review findings by removing client-side freshness inference, clearing cached market-order quotes on refresh failure, aligning quote-panel status messaging, and adding regression coverage for valuation helpers and account API contract boundaries.
- 2026-03-24: Implemented the FE parity slice for Story 2.8, including valuation contract typing, canonical selected-position rendering, stale/unavailable dashboard guidance, order-adjacent freshness handling, regression coverage, and Playwright evidence.
- 2026-03-24: Executed the dev-story completion flow for FE, revalidated the full FE regression/type-check/lint/E2E gates, and moved the story to review.

## Senior Developer Review (AI)

### Reviewer

- Reviewer: GPT-5 Codex
- Date: 2026-03-24
- Outcome: Approved after fixes

### Findings

1. High: `MOB/src/account/account-valuation.ts` still synthesizes `FRESH`/`STALE` from quote fields when `valuationStatus` is absent. Story 2.8 explicitly makes freshness backend-owned, so this fallback can fabricate trust state instead of showing that the contract is incomplete.
2. High: `MOB/src/order/use-external-order-view-model.ts` preserves the last successful market ticker position when refresh calls fail, and `MOB/src/components/order/ExternalOrderRecoverySection.tsx` continues rendering that cached price. Story 2.8 says order-adjacent flows should carry only server-owned freshness metadata; showing a client-cached quote after refresh failure violates that rule.
3. Medium: `MOB/src/components/account/DashboardQuoteTicker.tsx` still drives its prominent badge and status note from `quoteSourceMode` only. A position can therefore be marked `STALE`/`UNAVAILABLE` while the panel still looks like `직결 시세` / `실시간 기준`, or falls back to the placeholder note `새 source mode`, which is not clear user guidance.
4. Medium: The story task claiming API regression coverage is not fully evidenced. `MOB/tests/unit/api/account-api.test.ts` was not updated and still only asserts request URLs, so the new `AccountSummary` split and valuation nullability expectations are not protected at the API boundary.

### Resolution

- Resolved 2026-03-24 by removing local freshness inference, dropping cached market-order quote data after refresh failures, aligning quote-panel state copy to `valuationStatus`, and adding regression coverage for valuation helpers plus the account summary/position API split.
