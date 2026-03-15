# Story 4.6: [MOB] Mobile Order Step A/B

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want order input and authorization guidance on mobile,
So that I can initiate orders with the same server-owned risk behavior as web.

## Acceptance Criteria

1. Given the step A mobile order form, when submission succeeds, then an order session is created and step B is shown.
2. Given invalid symbol or quantity input, when validation fails, then contextual error indicators are displayed.
3. Given a challenge-required session, when the user navigates to the step-up step, then remaining session context is preserved.
4. Given an auto-authorized session, when the API returns `challengeRequired=false`, then the app skips directly to confirmation.
5. Given navigation interruption, when the user returns, then state-restoration logic preserves flow continuity.

## Tasks / Subtasks

- [x] Implement mobile step A order entry and initiation flow (AC: 1)
  - [x] Preserve mobile-safe form and submission behavior
- [x] Implement contextual validation error handling for symbol and quantity inputs (AC: 2)
  - [x] Avoid losing in-progress order context during correction
- [x] Implement authorization-branch handling for challenge-required and auto-authorized sessions (AC: 3, 4)
  - [x] Preserve remaining-session context when entering step-up
- [x] Implement interruption and return-state restoration (AC: 5)
  - [x] Support back-stack, background, and resume continuity
- [x] Add mobile coverage for initiation, validation, branch handling, and state restoration (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.1, Story 2.5.

### Technical Requirements

- Step mapping freeze:
  - Step A = order draft input + `POST /api/v1/orders/sessions`
  - Step B = authorization guidance + conditional step-up entry using `challengeRequired` and `authorizationReason`
- Mobile flow must preserve the same semantics as web even if the navigation model differs.
- Challenge-required and auto-authorized branches must remain explicit in client state.
- Interruption handling must restore the correct session state rather than inventing a new one.
- Order-session countdown should remain hidden in steady state; when `remainingSeconds <= 60`, mobile should surface a bottom sticky warning CTA for `세션 연장`, and only actual expiry should trigger a blocking restart modal.
- Current mobile `/api/v1/orders` proof surface is legacy for this lane and must be replaced or retired by the session-based Step A/B flow in this story.
- Post-MVP discussion items to capture but not implement in this story:
  - mobile-specific trusted device/app continuity and invalidation rules
  - soft-signal treatment for network change/background-resume through telemetry-first rollout
  - Step C local biometric/app-PIN transaction confirmation
  - device-keystore/FIDO-backed confirmation hardening
  - see `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/post-mvp-mobile-order-trust-hardening.md`

### Architecture Compliance

- Preserve mobile navigation and session-bootstrap conventions.
- Use backend response fields as the only source for authorization guidance.
- Keep FE and MOB semantic parity for challenge-required and auto-authorized behavior.

### Testing Requirements

- Cover valid initiation, invalid input, challenge-required branch, bypass branch, and resume or restore continuity.

### Story Completion Status

- Status set to `review`.
- Completion note: Mobile Step A/B now uses validated order draft entry, explicit challenge branching, and interruption-safe session restoration.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.6)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `npm run lint`
- `npm run typecheck`
- `npm test`

### Completion Notes List

- Added shared mobile draft helpers for symbol and quantity validation, preset hydration, and human-readable summaries.
- Current MVP implementation remains on the shared backend authorization model; advanced mobile trust hardening is recorded as post-MVP follow-up only.
- Updated the external-order view model and screen wiring to build sessions from validated draft input, branch by backend authorization decision, and restore active session state on resume.
- Extended the mobile recovery section and model to surface actionable validation errors while preserving in-progress order context.
- Added mobile regression coverage for invalid input, challenge-required branching, auto-authorized continuation, and remount or restore continuity.
- Applied review follow-up fixes so server-side Step A rejects map back to field-level correction, Step B `PREV` preserves the existing session, scenario changes are locked during in-flight execution, and persisted session ids survive real mobile resume via secure storage.
- Closed the second review pass by canceling stale OTP verify transitions on Step B back navigation, clearing persisted order-session context on logout or reauth boundaries, and adding explicit secure-storage runtime tests for React Native success and failure paths.
- Closed adversarial review follow-ups by making secure-store writes and removals atomic, handling restore-time storage bootstrap failures deterministically, separating account-level cash guidance from quantity validation, and verifying the mobile order flow against the live openapi stack.

### File List

- MOB/README.md
- MOB/e2e/maestro/order/01-order-success.yaml
- MOB/e2e/maestro/order/02-order-fep-pending.yaml
- MOB/e2e/maestro/order/03-order-unknown-fallback.yaml
- MOB/e2e/maestro/order/04-order-unavailable-without-account.yaml
- MOB/tests/e2e/mobile-order-live.e2e.test.ts
- MOB/scripts/mock-auth-server.mjs
- MOB/src/api/order-api.ts
- MOB/src/order/external-order-recovery.ts
- MOB/src/network/errors.ts
- MOB/src/network/types.ts
- MOB/src/order/order-session-storage.ts
- MOB/src/order/use-external-order-view-model.ts
- MOB/src/components/order/external-order-recovery-section-model.ts
- MOB/src/components/order/ExternalOrderRecoverySection.tsx
- MOB/src/auth/auth-flow-view-model.ts
- MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- MOB/tests/e2e/mobile-foundation.e2e.test.ts
- MOB/tests/unit/api/order-api.test.ts
- MOB/tests/unit/auth/auth-flow-view-model.test.ts
- MOB/tests/unit/order/external-order-recovery.test.ts
- MOB/tests/unit/order/external-order-recovery-section-model.test.ts
- MOB/tests/unit/order/ExternalOrderRecoverySection.test.tsx
- MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- MOB/tests/unit/order/order-session-storage.test.ts
- _bmad-output/implementation-artifacts/4-6-mobile-order-step-a-b.md

## Change Log

- 2026-03-14: Implemented mobile Step A/B draft entry, validation, challenge-aware branching, interruption-safe restoration, and mobile regression coverage.
- 2026-03-14: Closed mobile review follow-ups for durable restore storage, Step B context-preserving back navigation, field-level server validation guidance, and in-flight execute race guards.
- 2026-03-14: Closed second review follow-ups for stale Step B verify cancellation, logout or reauth storage cleanup, and secure-storage runtime verification coverage.
- 2026-03-14: Closed adversarial review follow-ups for storage atomicity, restore bootstrap failure handling, account-level pre-trade guidance, and live MOB openapi verification.
