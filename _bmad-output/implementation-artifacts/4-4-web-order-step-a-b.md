# Story 4.4: [FE] Web Order Step A/B

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want step-based order input and clear authorization guidance,
So that order setup is clear and only risky orders interrupt me with extra verification.

## Acceptance Criteria

1. Given the step A web order form, when the user submits valid symbol and quantity, then the order-session initiation API is called successfully.
2. Given invalid form data, when validation runs, then client-side and server-side errors are shown clearly.
3. Given a transition after initiation, when the response indicates `challengeRequired=true`, then the step-up input UI becomes active with reason and explanation.
4. Given a transition after initiation, when the response indicates `challengeRequired=false` and status `AUTHED`, then the UI skips directly to confirmation or execution step.
5. Given an API or network failure, when the initiation request fails, then the user receives retry guidance.

## Tasks / Subtasks

- [x] Implement step A order entry and initiation request flow (AC: 1)
  - [x] Capture symbol and quantity inputs with validated submission behavior
- [x] Implement client and server validation error rendering (AC: 2)
  - [x] Keep invalid input states actionable without losing form context
- [x] Implement authorization-guidance branching after initiation (AC: 3, 4)
  - [x] Show reason text for challenge-required cases
  - [x] Skip cleanly to confirm for already `AUTHED` sessions
- [x] Implement retry guidance for initiation failure states (AC: 5)
  - [x] Preserve enough context for safe resubmission
- [x] Add FE coverage for form validation, challenge-required branch, auto-authorized branch, and error handling (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.1, Story 2.4.

### Technical Requirements

- Step mapping freeze:
  - Step A = order draft input + `POST /api/v1/orders/sessions`
  - Step B = authorization guidance + conditional step-up entry using `challengeRequired` and `authorizationReason`
- The browser must surface `challengeRequired` and `authorizationReason` without inventing local policy.
- Form state must remain stable across validation and initiation failure paths.
- Auto-authorized and challenge-required flows must diverge only where needed.
- Order-session countdown should remain hidden in steady state; when `remainingSeconds <= 60`, the web flow should surface a non-blocking warning bar with `세션 연장`, and only actual expiry should trigger a blocking restart modal.
- Current web `/api/v1/orders` external-order proof surface is legacy for this lane and must be replaced or retired by the session-based Step A/B flow in this story.

### Architecture Compliance

- Preserve FE route and state-management conventions.
- Treat the backend authorization decision as source of truth.
- Keep error semantics aligned with the standardized auth and order error model.

### Testing Requirements

- Cover valid initiation, invalid form, challenge-required branch, auto-authorized branch, and initiation failure guidance.

### Story Completion Status

- Status set to `review`.
- Completion note: Web Step A/B now uses validated symbol and quantity draft entry, session-based branching, retry-safe error handling, and restore continuity.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.4)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `pnpm lint`
- `pnpm type-check`
- `pnpm test`

### Completion Notes List

- Added symbol and quantity draft helpers, client validation, and user-facing draft summaries for Step A order entry.
- Updated the web order recovery controller and page wiring to create sessions from validated draft input, branch by `challengeRequired`, and rehydrate restored session context.
- Extended the external order recovery section to show actionable validation errors, retry-safe error guidance, and challenge-required authorization copy.
- Added web regression coverage for invalid form handling, challenge-required branching, restored session continuity, and request-shape updates.
- Applied review follow-up fixes so server-side Step A rejects map back to field-level correction, Step B `PREV` preserves session context, and in-flight verify or execute responses cannot resurrect an abandoned preset flow.
- Scoped persisted order-session ids by account, cleared them on logout or reauth boundaries, and separated account-level pre-trade rejects from field-level quantity errors.
- Added FE live order-session E2E coverage against the current-source openapi stack and aligned the live flow with the canonical register -> enroll -> login -> execute path.

### File List

- FE/e2e/live/order-session-live.spec.ts
- FE/src/api/orderApi.ts
- FE/src/order/external-order-recovery.ts
- FE/src/order/order-session-storage.ts
- FE/src/hooks/order/useOrderRecoveryController.ts
- FE/src/components/order/ExternalOrderRecoverySection.tsx
- FE/src/lib/axios.ts
- FE/src/pages/OrderPage.tsx
- FE/src/store/useAuthStore.ts
- FE/tests/integration/App.test.tsx
- FE/tests/integration/auth-contract.e2e.test.ts
- FE/tests/unit/api/orderApi.test.ts
- FE/tests/unit/order/external-order-recovery.test.ts
- FE/tests/unit/pages/OrderPage.test.tsx
- FE/tests/unit/store/useAuthStore.test.ts
- _bmad-output/implementation-artifacts/4-4-web-order-step-a-b.md

## Change Log

- 2026-03-14: Implemented web Step A/B draft entry, validation, challenge-aware branching, restored session continuity, and FE regression coverage.
- 2026-03-14: Closed web review follow-ups for field-level server validation guidance, non-destructive Step B back navigation, and stale async response guards.
- 2026-03-14: Closed adversarial review follow-ups for account-scoped session persistence, auth-boundary cleanup, account-level pre-trade guidance, and live FE openapi verification.
