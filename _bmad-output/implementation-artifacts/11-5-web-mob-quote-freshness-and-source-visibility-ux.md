# Story 11.5: [FE/MOB][MD] Quote Freshness & Source Visibility UX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an order user,  
I want to see quote freshness and source mode,  
So that I understand valuation confidence before execution.

## Acceptance Criteria

1. Given web `PortfolioPage` dashboard summary or mobile `AuthenticatedHomeScreen` dashboard summary renders valuation data from the canonical account response When `marketPrice`, `quoteAsOf`, and `quoteSourceMode` are present and fresh Then the valuation surface shows a formatted `quoteAsOf` label plus a source badge using the exact mode text `LIVE`/`DELAYED`/`REPLAY` (web: `portfolio-quote-as-of`, `portfolio-quote-source-mode`; mobile: `mobile-dashboard-quote-as-of`, `mobile-dashboard-quote-source-mode`).
2. Given a MARKET preset/path is selected in Step A When `POST /api/v1/orders/sessions` fails with `VALIDATION-003` + `userMessageKey=error.quote.stale` + `operatorCode=STALE_QUOTE` Then both web and mobile keep the user in Step A, do not render Step B/C progression actions, and show actionable stale-data guidance that includes the validation category, `details.quoteSourceMode`, and `details.snapshotAgeMs` when present (web: `order-session-stale-quote-guidance`; mobile: `mobile-order-session-stale-quote-guidance`).
3. Given deterministic replay fixture data with `quoteSourceMode=REPLAY` and fixed `quoteAsOf` When regression tests or capture fixtures render the valuation surface Then both web and mobile visibly show the `REPLAY` badge and the formatted quote timestamp without falling back to generic placeholder copy.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11.
- No supplemental epic artifact detected for this epic at generation time.
- Depends on: Story 11.2, Story 11.4.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- The canonical valuation data source for this story is the channel account response (`AccountPositionResponse` / `AccountPosition`) carrying `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, and `quoteSourceMode`; do not introduce a separate FE-only quote endpoint contract for this story.
- Current FE/MOB account and order-session client types do not yet expose quote metadata; add client-side type parity before rendering freshness/source UI.
- Current FE/MOB demo order flow is LIMIT-oriented. This story includes introducing or enabling a deterministic MARKET Step A path/preset because stale-quote blocking is only valid on MARKET prepare.
- Keep stale-quote messaging and source badges consistent between web and mobile.
- Align UX copy and behavior with the stale-quote validation contract: `VALIDATION-003`, `userMessageKey=error.quote.stale`, `operatorCode=STALE_QUOTE`, `details.symbol`, `details.snapshotAgeMs`, `details.quoteSnapshotId`, `details.quoteSourceMode`.
- Badge text must preserve the raw upstream source-mode values (`LIVE`, `DELAYED`, `REPLAY`) for parity with backend/operator evidence and replay demos.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Include cross-client parity checks for source badge and stale-block behaviors.
- Cover quote metadata rendering in the existing dashboard tests for web and mobile using deterministic fixtures for `LIVE`, `DELAYED`, and `REPLAY`.
- Cover the create-stage stale-quote path in the existing order-flow tests for web and mobile using `VALIDATION-003` fixture errors.
- Ensure replay coverage asserts visible `REPLAY` badge text and formatted `quoteAsOf`, not just internal state.

### Implementation Notes

- Web valuation surface owner: `FE/src/pages/PortfolioPage.tsx`.
- Mobile valuation surface owner: `MOB/src/screens/app/AuthenticatedHomeScreen.tsx`.
- Web stale-quote Step A handling owner: `FE/src/hooks/order/useOrderRecoveryController.ts` + `FE/src/components/order/ExternalOrderRecoverySection.tsx`.
- Mobile stale-quote Step A handling owner: `MOB/src/order/use-external-order-view-model.ts` + `MOB/src/components/order/ExternalOrderRecoverySection.tsx`.
- Client type parity targets: `FE/src/types/account.ts`, `FE/src/types/order.ts`, `MOB/src/types/account.ts`, `MOB/src/types/order.ts`.
- Regression targets: `FE/tests/unit/pages/PortfolioPage.test.tsx`, `FE/tests/unit/pages/OrderPage.test.tsx`, `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx`, `MOB/tests/unit/order/ExternalOrderRecoverySection.test.tsx`.

### Story Completion Status

- Status set to `review`.
- Completion note: Epic 11 story implementation and post-review remediation are reflected in this artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11, Story 11.5)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/prd.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 11.
- 2026-03-23: `pnpm -C FE exec vitest run tests/unit/order/external-order-recovery.test.ts tests/unit/api/orderApi.test.ts tests/unit/lib/axios.test.ts tests/unit/pages/PortfolioPage.test.tsx tests/unit/pages/OrderPage.test.tsx`
- 2026-03-23: `pnpm -C MOB exec vitest run tests/unit/order/external-order-recovery.test.ts tests/unit/api/order-api.test.ts tests/unit/network/errors.test.ts tests/unit/order/ExternalOrderRecoverySection.test.tsx tests/unit/order/AuthenticatedHomeScreen.test.tsx`
- 2026-03-23: `pnpm -C FE type-check`
- 2026-03-23: `pnpm -C MOB typecheck`
- 2026-03-23: `pnpm -C FE exec vitest run tests/integration/order-transport-support-reference.test.tsx tests/integration/portfolio-transport-support-reference.test.tsx`
- 2026-03-23: `pnpm -C MOB exec vitest run tests/integration/mobile-order-transport.test.tsx`
- 2026-03-23: `pnpm -C FE type-check`
- 2026-03-23: `pnpm -C MOB typecheck`
- 2026-03-23: `pnpm -C FE exec vitest run tests/unit/order/external-order-recovery.test.ts tests/unit/lib/axios.test.ts tests/unit/pages/PortfolioPage.test.tsx tests/unit/pages/OrderPage.test.tsx`
- 2026-03-23: `pnpm -C MOB exec vitest run tests/unit/order/external-order-recovery.test.ts tests/unit/network/errors.test.ts tests/unit/order/AuthenticatedHomeScreen.test.tsx`
- 2026-03-23: `pnpm -C FE type-check`
- 2026-03-23: `pnpm -C MOB typecheck`
- 2026-03-23: `pnpm -C FE exec vitest run tests/unit/api/orderApi.test.ts tests/unit/lib/axios.test.ts tests/unit/order/external-order-recovery.test.ts tests/unit/pages/PortfolioPage.test.tsx tests/unit/pages/OrderPage.test.tsx tests/integration/order-transport-support-reference.test.tsx tests/integration/portfolio-transport-support-reference.test.tsx`
- 2026-03-23: `pnpm -C MOB exec vitest run tests/unit/api/order-api.test.ts tests/unit/network/errors.test.ts tests/unit/order/external-order-recovery.test.ts tests/unit/order/AuthenticatedHomeScreen.test.tsx tests/integration/mobile-order-transport.test.tsx`
- 2026-03-23: `pnpm -C FE type-check`
- 2026-03-23: `pnpm -C MOB typecheck`

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- 2026-03-23: Story acceptance criteria and dev notes were tightened to define canonical valuation surfaces, the exact stale-quote UX contract, and deterministic replay evidence for FE/MOB parity.
- 2026-03-23: Added FE/MOB account and order-session quote metadata parity, including `marketPrice`, `quoteAsOf`, `quoteSourceMode`, and stale-quote `details` propagation.
- 2026-03-23: Implemented web/mobile dashboard quote freshness rendering with raw `LIVE`/`DELAYED`/`REPLAY` badges and formatted `quoteAsOf` labels.
- 2026-03-23: Enabled deterministic MARKET preset handling for Step A and blocked stale MARKET prepare on `VALIDATION-003 / STALE_QUOTE` while keeping users in Step A.
- 2026-03-23: Added regression coverage for FE/MOB dashboard replay badges, stale-quote UX, transport payload parity, and error normalization details.
- 2026-03-23: Post-review fixes separated explicit MARKET order-type state from preset matching, surfaced `symbol` and `quoteSnapshotId` in stale-quote guidance, and added missing `DELAYED`/custom-market-path regressions.
- 2026-03-23: Added FE/MOB transport-backed integration coverage so `DELAYED`/`REPLAY` quote visibility and `VALIDATION-003 / STALE_QUOTE` Step A blocking are exercised above unit-test level.
- 2026-03-23: Post-review hardening removed duplicate stale-quote rendering, restored deterministic MARKET-only create behavior, fixed preset-specific LIMIT pricing, and aligned QA artifacts so unit/integration coverage is separated from environment-backed live E2E verification.
- 2026-03-23: Added a compact BE-FE / BE-MOB runtime-flow artifact for dashboard quote freshness rendering and MARKET stale-quote Step A blocking.
- 2026-03-23: Added FE/MOB actual runtime recordings plus posters that show dashboard quote freshness and MARKET stale-quote behavior on the real app surfaces.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-5-web-mob-quote-freshness-and-source-visibility-ux.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-5-be-fe-be-mob-compact-flows.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-5-fe-mob-actual-runtime-flows.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml
- /Users/yeongjae/fixyz/_bmad-output/planning-artifacts/ux-design-specification.md
- /Users/yeongjae/fixyz/FE/docs/contracts/external-order-error-ux.json
- /Users/yeongjae/fixyz/FE/src/api/orderApi.ts
- /Users/yeongjae/fixyz/FE/src/components/order/ExternalOrderRecoverySection.tsx
- /Users/yeongjae/fixyz/FE/src/hooks/order/useOrderRecoveryController.ts
- /Users/yeongjae/fixyz/FE/src/lib/axios.ts
- /Users/yeongjae/fixyz/FE/src/order/external-order-recovery.ts
- /Users/yeongjae/fixyz/FE/src/order/order-flow-state.ts
- /Users/yeongjae/fixyz/FE/src/pages/OrderPage.tsx
- /Users/yeongjae/fixyz/FE/src/pages/PortfolioPage.tsx
- /Users/yeongjae/fixyz/FE/src/types/account.ts
- /Users/yeongjae/fixyz/FE/src/types/api.ts
- /Users/yeongjae/fixyz/FE/src/types/order.ts
- /Users/yeongjae/fixyz/FE/tests/fixtures/createNormalizedApiErrorFromResponse.ts
- /Users/yeongjae/fixyz/FE/tests/integration/auth-contract.test.ts
- /Users/yeongjae/fixyz/FE/tests/integration/order-transport-support-reference.test.tsx
- /Users/yeongjae/fixyz/FE/tests/integration/portfolio-transport-support-reference.test.tsx
- /Users/yeongjae/fixyz/FE/tests/unit/api/orderApi.test.ts
- /Users/yeongjae/fixyz/FE/tests/unit/lib/axios.test.ts
- /Users/yeongjae/fixyz/FE/tests/unit/order/external-order-recovery.test.ts
- /Users/yeongjae/fixyz/FE/tests/unit/pages/OrderPage.test.tsx
- /Users/yeongjae/fixyz/FE/tests/unit/pages/PortfolioPage.test.tsx
- /Users/yeongjae/fixyz/MOB/docs/contracts/external-order-error-ux.json
- /Users/yeongjae/fixyz/MOB/src/api/order-api.ts
- /Users/yeongjae/fixyz/MOB/src/components/order/ExternalOrderRecoverySection.tsx
- /Users/yeongjae/fixyz/MOB/src/network/errors.ts
- /Users/yeongjae/fixyz/MOB/src/network/types.ts
- /Users/yeongjae/fixyz/MOB/src/order/external-order-recovery.ts
- /Users/yeongjae/fixyz/MOB/src/order/order-flow-state.ts
- /Users/yeongjae/fixyz/MOB/src/order/use-external-order-view-model.ts
- /Users/yeongjae/fixyz/MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- /Users/yeongjae/fixyz/MOB/src/types/account.ts
- /Users/yeongjae/fixyz/MOB/src/types/order.ts
- /Users/yeongjae/fixyz/MOB/tests/e2e/mobile-order-live.e2e.test.ts
- /Users/yeongjae/fixyz/MOB/tests/integration/mobile-order-transport.test.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/api/order-api.test.ts
- /Users/yeongjae/fixyz/MOB/tests/unit/network/errors.test.ts
- /Users/yeongjae/fixyz/MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/order/ExternalOrderRecoverySection.test.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/order/external-order-recovery.test.ts

### Change Log

- 2026-03-23: Implemented FE/MOB quote freshness/source visibility, MARKET stale-quote Step A blocking, quote metadata type parity, and matching regression coverage.
- 2026-03-23: Fixed review findings for implicit preset-based order-type flips, stale-quote correlation detail visibility, and missing `DELAYED` regression coverage.
- 2026-03-23: Reduced remaining validation risk by adding transport-backed integration coverage for quote freshness rendering and stale-quote create rejection on both web and mobile.
