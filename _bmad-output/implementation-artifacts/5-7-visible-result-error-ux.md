# Story 5.7: [FE/MOB] Visible Result/Error UX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an order user,
I want limit/position/result failures clearly explained,
So that I can take the correct next action.

## Acceptance Criteria

1. Given insufficient position/limit errors When FE/MOB receives codes Then both clients show aligned actionable guidance.
2. Given order failure reason code When rendered Then reason category is distinguishable (internal/external/validation).
3. Given successful order execution (`FILLED`) When result rendered Then `clOrdId` and updated position quantity are shown where required.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Consume the canonical FE/MOB result and error contracts without inventing client-local semantics
  - [x] Keep FE and MOB local fixtures semantically aligned with the canonical contract bundle
- [x] Add parity coverage that fails when FE and MOB diverge on next-action guidance or result rendering
  - [x] Verify one FE lane and one MOB lane against the same canonical expectations

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 5.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 2.2, Story 5.1, Story 4.8, Story 5.3.
- Story 4.8 already established the FE/MOB parity pattern and local-fixture strategy for order-session semantics; reuse that approach instead of creating a new parity mechanism.
- Story 3.6 already established FE/MOB external-order error guidance patterns and contract-fixture structure; extend those patterns instead of introducing a second error-UX model.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only when Stories 2.2, 5.1, and 5.3 are `done` or their channel-visible account inquiry / order prepare / execute contracts are explicitly frozen unchanged for the same implementation branch.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Canonical scope and wording source for ACs is `_bmad-output/planning-artifacts/epics.md` Epic 5 Story 5.7. If this story file and the epic text diverge, `epics.md` wins.
- Canonical machine-code source of truth for FE/MOB order error mapping is `_bmad-output/planning-artifacts/channels/api-spec.md`. Use PRD examples and UX copy as supporting guidance only; do not treat older PRD code examples as the canonical runtime vocabulary when they differ from the channel API contract.
- Canonical reason-category source of truth for AC 2 is the channel API error-code taxonomy interpreted through `docs/contracts/external-order-error-ux.json` `reasonCategories`; FE and MOB must not create alternate category names or remap code families independently.
- Canonical client-visible result contract source of truth is the channel order-session execute / fetch / history contract plus the FE/MOB UX contract bundle:
  - `_bmad-output/planning-artifacts/channels/api-spec.md`
  - `docs/contracts/order-session-ux.json`
  - `docs/contracts/external-order-error-ux.json`
- FE/MOB must not invent local reason categories or optimistic result states. Category rendering must be derived from canonical backend semantics (`executionResult`, `failureReason`, and documented code families) rather than client reinterpretation.
- AC 3 is satisfied by showing the canonical order reference (`clOrdId`) and updated position quantity context where the final rendered result requires it. `updated balance context` is not a required success criterion for this story.
- The updated position quantity required by AC 3 must come from the canonical Story 2.2 account inquiry contract (`GET /api/v1/accounts/{accountId}/positions?symbol={symbol}`); FE/MOB must not infer the user's current holding quantity from execute payload math, stale local cache, or optimistic client-side state.
- If either client also shows refreshed cash or holdings summary near the result surface, that data must also come from Story 2.2; do not derive updated balance locally from the order execute response.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Preserve FE/MOB-local fixtures if needed, but keep them semantically identical to the canonical contract bundle rather than drifting into independent per-client interpretations.
- Keep result/error semantics tied to backend codes and execute/result payload fields.
- Do not compute updated position or balance optimistically in client-only state when the canonical read/result contracts already define the values to display.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Cover FE/MOB parity for:
  - insufficient position / limit guidance
  - internal vs external vs validation reason-category rendering
  - successful `FILLED` result rendering with `clOrdId` and updated position quantity context
- Reject tests that only compare FE versus MOB fixtures in isolation. At least one parity check must anchor FE and MOB expectations to the canonical contract bundle.

### Quinn Reinforcement Checks

- Contract-source gate:
  - Reject implementation that treats PRD prose or legacy client copy as the machine-code source of truth when it differs from `channels/api-spec.md`.
- Dependency gate:
  - Reject implementation start if Story 5.1 or Story 5.3 result/error semantics are still ambiguous on the active branch.
- Evidence gate:
  - Attach one FE proof, one MOB proof, and one parity proof for AC coverage before status moves to `review`.

### Story Completion Status

- Status set to `review`.
- Completion note: FE and MOB now render canonical reason categories and updated position quantity from Story 2.2 after final order results.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.7)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md` (채널계 API 명세)
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `docs/contracts/order-session-ux.json`
- `docs/contracts/external-order-error-ux.json`
- `_bmad-output/implementation-artifacts/3-6-visible-external-error-ux.md`
- `_bmad-output/implementation-artifacts/2-2-balance-and-available-balance-api.md`
- `_bmad-output/implementation-artifacts/4-8-cross-client-authorization-fsm-parity-validation.md`
- `_bmad-output/implementation-artifacts/5-3-fep-order-execution-semantics.md`
- `_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `pnpm --dir FE type-check`
- `pnpm --dir FE lint`
- `pnpm --dir FE exec vitest run tests/unit/pages/OrderPage.test.tsx tests/unit/order/external-errors.test.ts tests/unit/order/ExternalOrderErrorPanel.test.tsx`
- `npm --prefix MOB run typecheck`
- `npm --prefix MOB run lint`
- `npm --prefix MOB run test -- tests/unit/order/AuthenticatedHomeScreen.test.tsx tests/unit/order/external-errors.test.ts tests/unit/order/external-order-recovery-section-model.test.ts tests/unit/order/ExternalOrderRecoverySection.test.tsx`
- `node --test tests/client-parity/order-session-parity.test.js`

### Completion Notes List

- Added FE/MOB reason-category visibility for validation, internal, and external order failures.
- Added final-result position refresh from the canonical Story 2.2 account inquiry contract instead of client-side inference.
- Expanded FE/MOB and canonical contract tests so parity now covers result rendering and category semantics.

### File List

- FE/src/components/order/ExternalOrderErrorPanel.tsx
- FE/src/components/order/ExternalOrderRecoverySection.tsx
- FE/src/hooks/order/useOrderRecoveryController.ts
- FE/src/order/external-errors.ts
- FE/src/order/order-error-category.ts
- FE/src/pages/OrderPage.tsx
- FE/tests/fixtures/external-order-error-contract.ts
- FE/tests/unit/order/ExternalOrderErrorPanel.test.tsx
- FE/tests/unit/order/external-errors.test.ts
- FE/tests/unit/pages/OrderPage.test.tsx
- MOB/src/components/order/ExternalOrderErrorCard.tsx
- MOB/src/components/order/ExternalOrderRecoverySection.tsx
- MOB/src/order/external-errors.ts
- MOB/src/order/order-error-category.ts
- MOB/src/order/use-external-order-view-model.ts
- MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- MOB/tests/fixtures/external-order-error-contract.ts
- MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- MOB/tests/unit/order/ExternalOrderRecoverySection.test.tsx
- MOB/tests/unit/order/external-errors.test.ts
- MOB/tests/unit/order/external-order-recovery-section-model.test.ts
- docs/contracts/external-order-error-ux.json
- docs/contracts/order-session-ux.json
- FE/docs/contracts/external-order-error-ux.json
- MOB/docs/contracts/external-order-error-ux.json
- FE/tests/order-session-contract-cases.json
- MOB/tests/order-session-contract-cases.json
- tests/client-parity/order-session-parity.test.js
- _bmad-output/implementation-artifacts/2-2-balance-and-available-balance-api.md
- _bmad-output/implementation-artifacts/5-1-limit-engine.md
- _bmad-output/implementation-artifacts/5-3-fep-order-execution-semantics.md
- _bmad-output/implementation-artifacts/5-7-visible-result-error-ux.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
