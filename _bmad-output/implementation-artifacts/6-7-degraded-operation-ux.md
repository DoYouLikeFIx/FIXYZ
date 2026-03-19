# Story 6.7: Degraded Operation UX

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an order user,
I want transparent degraded-state guidance,
So that I understand delays and recovery behavior.

## Acceptance Criteria

1. Given degraded external mode signal When FE/MOB receives state Then banner/notice communicates delay and expected behavior.
2. Given recovery complete signal When state normalizes Then warning UI is cleared.
3. Given prolonged unresolved state When threshold exceeded Then user sees support/escalation guidance.

## Tasks / Subtasks

- [x] Converge FE/MOB degraded-state rendering onto the canonical order-session and external-error contracts (AC: 1, 3)
  - [x] Reuse the existing FE/MOB order-session guidance surfaces instead of creating a second degraded-state UI model
  - [x] Render `EXECUTING` and `REQUERYING` as in-progress degraded/recovery guidance with no false completion claim
  - [x] Render `ESCALATED` as support/escalation guidance using the canonical manual-review semantics
  - [x] Surface canonical external execute-error guidance for `FEP-001` / `FEP-002` using contract-driven copy and `retryAfterSeconds` when present
- [x] Clear stale degraded guidance when the runtime state normalizes (AC: 2)
  - [x] Replace degraded notices with terminal result UI when polling or restore resolves to `COMPLETED`, `FAILED`, or `CANCELED`
  - [x] Ensure restart/reset paths clear prior degraded notices so a fresh draft does not retain stale warning state
- [x] Anchor prolonged unresolved guidance to the canonical recovery threshold from Story 6.4 (AC: 3)
  - [x] Treat `status: "ESCALATED"` with `failureReason: "ESCALATED_MANUAL_REVIEW"` as the threshold-exceeded signal; do not invent client-local timers or counters
  - [x] Keep `clOrdId` and support/contact context visible when manual review guidance is shown
- [x] Add automated FE/MOB and parity coverage for degraded-state behavior (AC: 1, 2, 3)
  - [x] FE coverage for execute-time degraded guidance, normalization clearing, and escalated/manual-review rendering
  - [x] MOB coverage for restored degraded sessions, normalization clearing, and escalated/manual-review rendering
  - [x] Shared parity coverage anchored to the canonical contract fixtures under `docs/contracts`

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 6.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 6.3, Story 6.4.
- Story 3.6 already established FE/MOB external execute-error guidance patterns and the shared external error contract fixture strategy; extend those patterns instead of inventing a new degraded-error model.
- Story 5.7 already established shared FE/MOB order-session guidance fixtures, parity checks, and existing order result surfaces; reuse that same contract-and-fixture approach for degraded-state work.
- Story 6.4 defines the canonical prolonged unresolved threshold through recovery retry exhaustion and `REQUERYING -> ESCALATED`; FE/MOB must consume that signal, not redefine their own threshold rules.
- Current FE/MOB order surfaces already render baseline `EXECUTING`, `REQUERYING`, and `ESCALATED` guidance in the existing order recovery sections. Treat this story as convergence/hardening work on those surfaces, not as a greenfield screen.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Canonical scope and wording source for ACs is `_bmad-output/planning-artifacts/epics.md` Epic 6 Story 6.7. If this story file and `epics.md` diverge, `epics.md` wins.
- Canonical runtime source of truth for degraded-state session semantics is:
  - `_bmad-output/planning-artifacts/channels/api-spec.md`
  - `docs/contracts/order-session-ux.json`
- Canonical runtime source of truth for degraded external execute-error semantics is:
  - `_bmad-output/planning-artifacts/fep-gateway/api-spec.md`
  - `docs/contracts/external-order-error-ux.json`
- Canonical UX proof-point wording for circuit-breaker fallback and degraded order execution is:
  - `_bmad-output/planning-artifacts/ux-design-specification.md`
- For this story, FE/MOB must treat the following as canonical degraded/recovery signals:
  - `OrderSession.status = EXECUTING`
  - `OrderSession.status = REQUERYING`
  - `OrderSession.status = ESCALATED`
  - external execute errors mapped through the canonical `FEP-001` / `FEP-002` contract cases
- AC 1 is satisfied only when degraded guidance explains both delay and expected next behavior. Examples:
  - `EXECUTING`: still waiting for terminal confirmation
  - `REQUERYING`: backend recovery is actively reconciling the outcome
  - `FEP-001/CIRCUIT_OPEN`: user should wait for the backoff window before retry
  - `FEP-002/TIMEOUT`: user must not assume completion and should wait for follow-up status
- AC 2 normalization signal is the runtime state moving out of degraded mode into a non-degraded state. Canonical examples:
  - `EXECUTING` / `REQUERYING` / `ESCALATED` resolving to `COMPLETED`, `FAILED`, or `CANCELED`
  - user restarting or resetting the order flow so a fresh draft replaces the old degraded session context
- AC 3 prolonged unresolved threshold is satisfied by the backend-owned escalation signal from Story 6.4:
  - `status: "ESCALATED"`
  - `failureReason: "ESCALATED_MANUAL_REVIEW"`
  FE/MOB must not invent client-local elapsed-time thresholds, retry counters, or separate degraded-state stores.
- If `retryAfterSeconds` is present on the canonical external error contract, FE/MOB must surface that contract value in user guidance. Do not hardcode a countdown or wait time outside the backend contract.
- FE/MOB must not add a separate dedicated degraded-operation page for this story. The canonical scope is to enhance the existing order-session and external-error surfaces already used during order execution and recovery.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep degraded-state rendering tied to existing channel order-session polling / restore flows and the external execute-error contract. Do not create a parallel client-only state machine for resilience UX.
- Preserve FE/MOB-local fixtures if needed, but keep them semantically identical to the canonical contract bundle rather than drifting into per-client interpretations.
- Keep the existing 30-second polling and session-restore behavior aligned with the channel contract for `REQUERYING` and `ESCALATED`; do not change backend-owned cadence or thresholds in FE/MOB.

### File Structure Requirements

- Prefer converging the existing FE/MOB order guidance files over creating a new degraded-UX module tree.
- Likely FE touch points:
  - `FE/src/order/order-session-guidance.ts`
  - `FE/src/order/external-errors.ts`
  - `FE/src/components/order/ExternalOrderRecoverySection.tsx`
  - `FE/src/hooks/order/useOrderRecoveryController.ts`
  - `FE/tests/unit/pages/OrderPage.test.tsx`
  - `FE/tests/order-session-contract-cases.json`
- Likely MOB touch points:
  - `MOB/src/order/order-session-guidance.ts`
  - `MOB/src/order/external-errors.ts`
  - `MOB/src/components/order/ExternalOrderRecoverySection.tsx`
  - `MOB/src/order/use-external-order-view-model.ts`
  - `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx`
  - `MOB/tests/order-session-contract-cases.json`
- Shared contract / parity touch points:
  - `docs/contracts/order-session-ux.json`
  - `docs/contracts/external-order-error-ux.json`
  - `tests/client-parity/order-session-parity.test.js`

### Previous Story Intelligence

- Story 3.6 already codified `FEP-001`, `FEP-002`, and unknown external execute outcomes into a shared FE/MOB external error contract. That contract already carries `retryAfterSeconds` and support-reference semantics; Story 6.7 should extend and validate that behavior rather than fork it.
- Story 5.7 already codified shared order-session guidance fixtures for `EXECUTING`, `REQUERYING`, `ESCALATED`, and final states. Story 6.7 should converge actual FE/MOB rendering onto those fixtures and close any stale-warning or normalization gaps.
- Story 6.4 made `REQUERYING` and `ESCALATED` backend-visible states with explicit semantics in the channel contract. This story owns only FE/MOB interpretation of those states.
- Existing FE/MOB tests already prove parts of the surface area:
  - FE render path for `REQUERYING` and `ESCALATED`
  - MOB restore/remount path for `REQUERYING` and `ESCALATED`
  - shared parity fixtures anchored to `docs/contracts`
  Treat those as the baseline to extend, not as duplicate work to replace.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Required FE/MOB coverage for this story:
  - execute-time degraded guidance for external timeout / service-unavailable outcomes
  - restored or polled `REQUERYING` state guidance with no false success claim
  - `ESCALATED` manual-review guidance including support/contact context and visible `clOrdId`
  - normalization path that removes stale degraded guidance when a later fetch/poll resolves to a terminal state
  - reset/restart path that clears stale degraded warnings for a fresh draft
- Required parity coverage:
  - FE and MOB processing-state fixtures remain aligned with `docs/contracts/order-session-ux.json`
  - FE and MOB external degraded error fixtures remain aligned with `docs/contracts/external-order-error-ux.json`
  - at least one shared parity test must fail if FE and MOB diverge on degraded-state wording or contract cases
- Reject tests that only compare FE versus MOB local mocks in isolation. At least one assertion path must be anchored to the canonical contract bundle.

### Quinn Reinforcement Checks

- Contract-source gate:
  - Reject implementation that treats ad hoc client copy as source of truth when it differs from `channels/api-spec.md`, `fep-gateway/api-spec.md`, or the canonical `docs/contracts` bundle.
- Delta gate:
  - Reject implementation that introduces a second degraded-state store or page instead of extending the existing order-session / external-error surfaces.
- Evidence gate:
  - Attach one FE proof, one MOB proof, and one parity proof for AC coverage before status moves to `review`.

### Story Completion Status

- Status set to `review`.
- Completion note: FE/MOB degraded execute guidance now preserves warning UI only while the session remains non-terminal, and clears stale panels once refresh resolves to a final result.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 6, Story 6.7)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md` (채널계 주문 세션 / 이력 계약)
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외 execute 오류 / retry 계약)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `docs/contracts/order-session-ux.json`
- `docs/contracts/external-order-error-ux.json`
- `_bmad-output/implementation-artifacts/3-6-visible-external-error-ux.md`
- `_bmad-output/implementation-artifacts/5-7-visible-result-error-ux.md`
- `_bmad-output/implementation-artifacts/6-4-unknown-requery-scheduler.md`
- `_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `pnpm test -- tests/unit/pages/OrderPage.test.tsx` (FE)
- `pnpm test -- tests/unit/order/AuthenticatedHomeScreen.test.tsx` (MOB)
- `npm run test:client-parity` (root)
- `pnpm type-check` (FE)
- `pnpm typecheck` (MOB)

### Completion Notes List

- Updated FE/MOB refresh reconciliation so execute-time degraded presentations do not outlive terminal `COMPLETED` / `FAILED` / `CANCELED` sessions.
- Added FE coverage for `FEP-001/CIRCUIT_OPEN` retry guidance, reset clearing, and `FEP-002/TIMEOUT` normalization clearing.
- Added MOB coverage for `FEP-001/CIRCUIT_OPEN` retry guidance, reset clearing, and terminal-result clearing after execute-time timeout refresh.
- Reused existing `REQUERYING` / `ESCALATED` guidance and shared parity contract suites as the canonical AC 1 / AC 3 proof.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/6-7-degraded-operation-ux.md
- /Users/yeongjae/fixyz/FE/src/hooks/order/useOrderRecoveryController.ts
- /Users/yeongjae/fixyz/MOB/src/order/use-external-order-view-model.ts
- /Users/yeongjae/fixyz/FE/tests/unit/pages/OrderPage.test.tsx
- /Users/yeongjae/fixyz/MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx

### Change Log

- Adjusted FE/MOB session refresh handling to clear external degraded presentations when refresh resolves to a final order result.
- Added FE and MOB regression coverage for circuit-breaker retry guidance and reset-based stale-warning clearing.
- Verified shared client parity contracts remain aligned with `docs/contracts`.
