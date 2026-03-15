# Story 4.8: [FE/MOB] Cross-Client Authorization FSM Parity Validation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a product quality owner,
I want FE and MOB FSM behavior parity,
So that one client does not diverge from core order rules.

## Acceptance Criteria

1. Given the same scenario input sequence, when it runs on FE and MOB, then state transitions are equivalent.
2. Given the same backend error codes, when they are rendered on both clients, then severity and action semantics are aligned.
3. Given the regression suite, when CI runs, then parity checks pass.

## Tasks / Subtasks

- [x] Define the canonical scenario matrix for FE and MOB authorization-state parity (AC: 1)
  - [x] Include challenge-required, auto-authorized, expired, and failed-session paths
  - [x] Treat Story `4.3` as the parity source of truth and keep FE/MOB local contract fixtures derived from the same matrix
- [x] Implement cross-client validation for shared error-code semantics (AC: 2)
  - [x] Verify aligned next actions for the same backend outcome
  - [x] Compare FE and MOB local contract fixtures semantically rather than relying on a single shared repo-level fixture
- [x] Add CI-parity regression coverage for the canonical FSM flow (AC: 3)
  - [x] Fail the regression gate when web and mobile diverge in state or guidance

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.5, Story 4.7.

### Technical Requirements

- FE and MOB may differ in layout, but they must preserve the same state meaning and next-action guidance.
- The canonical parity source is the Story `4.3` order-session contract plus the scenario matrix defined in this story, not client-local reinterpretation of backend states.
- FE and MOB keep separate local contract-fixture files under their own test trees; those files must remain semantically identical to the canonical scenario matrix even though they are not stored in one shared path.
- This story may start against the current Story `4.5` and Story `4.7` review baselines because both implementations exist and have QA `PASS`; parity work in `4.8` must validate those baselines rather than broaden their UX scope.
- Parity coverage should include both low-risk bypass and elevated-risk step-up scenarios.
- Regression checks must remain cheap enough to run continuously.

### Architecture Compliance

- Use the canonical Epic 4 FSM and Story `4.3` clarified status-contract rules as the parity source of truth.
- Keep error semantics tied to backend codes rather than client-specific reinterpretation.
- Preserve deterministic result-state handling across both clients.

### Testing Requirements

- Cover the shared scenario matrix, shared error-code semantics, and CI regression enforcement.

### Story Completion Status

- Status set to `done`.
- Completion note: Story delivered FE/MOB-local fixtures, canonical parity anchoring, and BE-backed regression coverage for both low-risk and step-up authorization flows.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.8)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- 2026-03-16: Added FE/MOB-local authorization scenario matrices for the canonical step-up, auto-authorized, expired, and failed-session paths.
- 2026-03-16: Added a root-level parity regression gate that compares FE and MOB local order-session and external-error contracts semantically.
- 2026-03-16: Senior Developer Review follow-up wired canonical authorization scenarios into FE/MOB UI tests, aligned OTP failure guidance, and anchored the root parity gate to canonical semantics.
- 2026-03-16: Adversarial review follow-up centralized in-client order-session guidance copy and strengthened FE/MOB BE-backed live contract assertions.
- 2026-03-16: FE/MOB direct-backend live regression exposed success-envelope unwrapping drift in both clients' network layers; follow-up fixed normalization and revalidated both BE-backed live lanes.

### Completion Notes List

- FE and MOB now keep matching local authorization FSM fixtures derived from the Story `4.3` backend contract without introducing a shared repo-level fixture dependency.
- FE and MOB now render the canonical auto-authorized, challenge-required, expired, and OTP-exhausted restart guidance directly in their order recovery flows.
- Cross-client parity coverage now checks both order-session guidance fixtures and backend external-order error semantics for semantic drift.
- Root test coverage now fails when FE and MOB diverge in state meaning, next action guidance, or canonical backend error semantics.
- FE live E2E now verifies canonical final-result copy instead of only checking card visibility, and MOB BE-backed live coverage now exercises both low-risk auto-authorization and challenged step-up paths.
- Each client now resolves authorization, processing, and terminal result copy from one local helper so component/view-model duplication cannot silently drift within the same app.
- FE and MOB now correctly unwrap direct backend success envelopes that omit the legacy `error` key, so live auth/order flows stay compatible with the real channel-service contract.

### File List

- FE/src/components/order/ExternalOrderRecoverySection.tsx
- FE/src/hooks/order/useOrderRecoveryController.ts
- FE/src/lib/axios.ts
- FE/src/order/order-session-guidance.ts
- FE/e2e/live/order-session-live.spec.ts
- FE/src/types/api.ts
- FE/tests/order-session-contract-cases.json
- FE/tests/unit/lib/axios.test.ts
- FE/tests/unit/pages/OrderPage.test.tsx
- MOB/src/components/order/ExternalOrderRecoverySection.tsx
- MOB/src/order/use-external-order-view-model.ts
- MOB/src/order/order-session-guidance.ts
- MOB/src/network/errors.ts
- MOB/src/network/http-client.ts
- MOB/src/network/types.ts
- MOB/tests/e2e/mobile-order-live.e2e.test.ts
- MOB/tests/order-session-contract-cases.json
- MOB/tests/unit/network/http-client.test.ts
- MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- MOB/tests/unit/order/ExternalOrderRecoverySection.test.tsx
- docs/contracts/order-session-ux.json
- package.json
- tests/client-parity/order-session-parity.test.js

### Change Log

- 2026-03-16: Added FE/MOB authorization parity fixtures and a root-level CI parity regression gate.
- 2026-03-16: Senior Developer Review resolved canonical-scenario drift by wiring FE/MOB UI coverage to the scenario matrix and anchoring parity regression checks to canonical semantics.
- 2026-03-16: Adversarial review pass centralized client guidance copy, strengthened FE live canonical result assertions, and added the missing MOB low-risk BE-backed live lane.
- 2026-03-16: Fixed the FE/MOB direct-backend success-envelope parsers so BE-backed live flows work against the current channel-service response contract.

## Senior Developer Review (AI)

### Review Date

2026-03-16

### Reviewer

GPT-5 Codex (Adversarial Review Mode)

### Outcome

Approved after follow-up fixes

### Summary

- Total findings: 3
- High severity: 1
- Medium severity: 2
- Low severity: 0
- Git vs Story File List discrepancies: 0

### Findings

- [resolved][high] `FE/tests/order-session-contract-cases.json` and `MOB/tests/order-session-contract-cases.json` added the new `authorizationScenarios` matrix, but the FE and MOB test suites still ignored it, so AC1 only compared static JSON rather than real client state transitions. The follow-up pass added scenario-driven UI tests in both clients.
- [resolved][medium] `FE/src/hooks/order/useOrderRecoveryController.ts`, `FE/src/components/order/ExternalOrderRecoverySection.tsx`, `MOB/src/order/use-external-order-view-model.ts`, and `MOB/src/components/order/ExternalOrderRecoverySection.tsx` still rendered generic authorization or failure copy, so the new `failed-session-reset` and canonical guidance strings were not actually reflected in the product flows. The follow-up aligned both clients to the scenario matrix.
- [resolved][medium] `tests/client-parity/order-session-parity.test.js` originally only compared FE versus MOB local fixtures, which meant synchronized drift away from Story `4.3` semantics could still pass. The follow-up anchored authorization scenarios to explicit canonical expectations and backend error semantics to the canonical root contract.

### Follow-up Round

- 2026-03-16: Resolved story artifact drift where `Story Completion Status` still said `ready-for-dev` after the story had already been completed.
- 2026-03-16: Resolved file-list drift by adding `docs/contracts/order-session-ux.json`, the new client guidance helpers, and the MOB live test file that now materially supports this story.
- 2026-03-16: Resolved FE live E2E weakness by asserting canonical final-result title/body pairs instead of only checking that a result card is visible.
- 2026-03-16: Resolved the missing MOB low-risk BE-backed live lane by covering auto-authorized order-session creation and execution in addition to the challenged step-up path.
- 2026-03-16: Resolved in-client drift risk by moving authorization, processing, and terminal result copy into shared helpers used by both view models and components.
- 2026-03-16: Resolved real FE/MOB live regressions where success envelopes without an `error` key were not unwrapped, which broke direct-backend registration/CSRF bootstrap and auth/order flows.
- 2026-03-16: Additional high/medium findings after the follow-up fixes: 0.
