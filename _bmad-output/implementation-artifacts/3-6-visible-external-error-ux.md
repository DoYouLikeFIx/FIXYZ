# Story 3.6: Visible External Error UX

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an order user,
I want understandable external-failure messages,
So that I know whether to retry, wait, or contact support.

## Acceptance Criteria

1. Given external failure code mapping When FE/MOB receives error Then action-oriented message is displayed.
2. Given ambiguous unknown external state When shown to user Then recovery guidance avoids false completion claims.
3. Given same error code on FE and MOB When rendered Then parity of UX semantics is maintained.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 3.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 3.2.

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
- Completion note: Epic 3 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.6)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `FE: pnpm test`
- `FE: pnpm type-check`
- `FE: pnpm lint`
- `FE: pnpm exec playwright test e2e/order-external-error.spec.ts`
- `MOB: npm test`
- `MOB: npm run typecheck`
- `MOB: npm run lint`
- `MOB: npm run e2e:maestro:order`

### Completion Notes List

- Added a shared external-order error contract under `docs/contracts` and aligned FE/MOB parity tests to it.
- Replayed FE onto a dedicated `/orders` boundary that submits real `/api/v1/orders` requests and renders inline external-order recovery guidance only after runtime failures.
- Replayed MOB with channel-aware order API wiring, external-order view-model ownership, and visible surface tests that verify support reference and selected scenario rendering.
- Tightened FE/MOB order-account handling to canonical numeric IDs only, gated the order boundary for users without a linked order account, and upgraded FE/MOB E2E harnesses to assert request-contract behavior instead of preview-only rendering.

### File List

- docs/contracts/external-order-error-ux.json
- FE/src/api/orderApi.ts
- FE/src/components/order/ExternalOrderErrorPanel.tsx
- FE/src/components/order/ExternalOrderRecoverySection.tsx
- FE/src/hooks/order/useOrderRecoveryController.ts
- FE/src/index.css
- FE/src/lib/axios.ts
- FE/src/order/external-errors.ts
- FE/src/order/external-order-recovery.ts
- FE/src/pages/OrderPage.tsx
- FE/src/pages/PortfolioPage.tsx
- FE/src/router/AppRouter.tsx
- FE/src/types/api.ts
- FE/tests/fixtures/external-order-error-contract.ts
- FE/tests/integration/App.test.tsx
- FE/tests/unit/api/orderApi.test.ts
- FE/tests/unit/lib/axios.test.ts
- FE/tests/unit/order/ExternalOrderErrorPanel.test.tsx
- FE/tests/unit/order/external-errors.test.ts
- FE/tests/unit/order/external-order-recovery.test.ts
- FE/tests/unit/pages/OrderPage.test.tsx
- FE/tests/unit/pages/PortfolioPage.test.tsx
- FE/tsconfig.app.json
- MOB/App.tsx
- MOB/README.md
- MOB/e2e/maestro/order/01-order-success.yaml
- MOB/e2e/maestro/order/02-order-fep-pending.yaml
- MOB/e2e/maestro/order/03-order-unknown-fallback.yaml
- MOB/e2e/maestro/order/04-order-unavailable-without-account.yaml
- MOB/package.json
- MOB/src/api/order-api.ts
- MOB/src/auth/create-mobile-auth-runtime.ts
- MOB/src/components/order/ExternalOrderErrorCard.tsx
- MOB/src/components/order/ExternalOrderRecoverySection.tsx
- MOB/src/components/order/external-order-recovery-section-model.ts
- MOB/src/navigation/AppNavigator.tsx
- MOB/src/network/errors.ts
- MOB/src/network/http-client.ts
- MOB/src/network/types.ts
- MOB/src/order/external-errors.ts
- MOB/src/order/external-order-recovery.ts
- MOB/src/order/use-external-order-view-model.ts
- MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- MOB/scripts/mock-auth-server.mjs
- MOB/scripts/run-maestro-auth-suite.sh
- MOB/tests/fixtures/external-order-error-contract.ts
- MOB/tests/mocks/react-native.ts
- MOB/tests/setup-vitest.ts
- MOB/tests/unit/api/order-api.test.ts
- MOB/tests/unit/network/errors.test.ts
- MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- MOB/tests/unit/order/ExternalOrderRecoverySection.test.tsx
- MOB/tests/unit/order/external-errors.test.ts
- MOB/tests/unit/order/external-order-recovery.test.ts
- MOB/tests/unit/order/external-order-recovery-section-model.test.ts
- MOB/vitest.config.ts
- _bmad-output/implementation-artifacts/3-6-visible-external-error-ux.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-03-11: Reapplied lost Story 3.6 FE/MOB implementation into the standing nested repos, restored canonical contract coverage, and revalidated FE/MOB test, typecheck, and lint suites.
- 2026-03-11: Closed adversarial review findings by removing unsafe trailing-digit `accountId` coercion, gating order UX without linked accounts, validating outbound order request contracts in FE/MOB automation, and hardening the Maestro mock-server runner against stale port reuse.
