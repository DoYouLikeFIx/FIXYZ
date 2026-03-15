# Story 4.5: [FE] Web Conditional Step-Up + Step C

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want conditional additional verification and order execution result screens,
So that I can complete order execution with clear status feedback.

## Acceptance Criteria

1. Given a required step-up challenge, when valid TOTP submission succeeds, then the UI transitions to confirmation or execution step.
2. Given a low-risk order where no challenge is required, when the session is already `AUTHED`, then the UI enters confirmation or execution step directly and shows that extra verification was not required.
3. Given step-up failure cases, when the code is invalid, expired, replayed, or throttled, then mapped error guidance is displayed.
4. Given an active Step C session with `remainingSeconds <= 60`, when the warning threshold is crossed, then the UI shows a non-blocking warning bar with `세션 연장` and preserves confirmation context.
5. Given an active order session before expiry, when the user triggers session extend, then `expiresAt` is refreshed and the current step context remains intact.
6. Given actual order-session expiry during Step B or Step C, when the stale session is detected, then a blocking expired-session modal is shown and restart clears stale session context.
7. Given execution in progress or reconciliation states, when status polling updates return `EXECUTING`, `REQUERYING`, or `ESCALATED`, then the UI shows processing or manual-review guidance without presenting a false terminal outcome.
8. Given a final or reconciled result response, when `executionResult` is `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, or terminal failure guidance is returned, then ClOrdID and the relevant quantity, price, cancel-time, or failure fields are rendered conditionally.

## Tasks / Subtasks

- [x] Implement conditional step-up submission flow on web (AC: 1, 2, 3)
  - [x] Support both challenge-required and already-authorized session entry points
- [x] Map TOTP and policy failure states into user guidance (AC: 3)
  - [x] Include replay, expiry, and throttle handling without ambiguous messaging
- [x] Implement Step C order-session warning, extend, and expiry recovery UX (AC: 4, 5, 6)
  - [x] Preserve confirmation context across extend and fail closed on actual expiry
- [x] Implement processing, reconciliation, and final-result rendering (AC: 7, 8)
  - [x] Keep result screen synchronized with polling-driven order-status updates
- [x] Add FE coverage for successful step-up, bypass path, failure mapping, session extend, expiry recovery, and result rendering across processing and reconciled outcomes (AC: 1, 2, 3, 4, 5, 6, 7, 8)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.2, Story 4.3, Story 4.4.

### Technical Requirements

- Step-up is conditional, not mandatory for every order.
- Step C must preserve order-session continuity through expiring-soon warning, extend, and expired-session recovery behavior.
- Result rendering must work for both auto-authorized and step-up-authorized sessions.
- Result and recovery UX must cover processing, reconciliation, and final outcomes from the canonical status plus `executionResult` contracts.
- FE should not imply that OTP occurred when the session was already `AUTHED`.
- Step C warning or expiry UX must use `expiresAt` and local remaining time rather than waiting for SSE to announce order-session expiry.

### Architecture Compliance

- Preserve the canonical order-session FSM and status-response contracts.
- Consume backend error codes directly for deterministic guidance.
- Keep result-flow state aligned with downstream execution ownership.

### Testing Requirements

- Cover step-up success, bypass path, invalid or expired code, replay or throttle path, session extend, expiry recovery, processing state, reconciliation states, and final result rendering.

### Story Completion Status

- Status set to `review`.
- Completion note: Implementation is complete and the story remains in `review` with focused QA evidence for polling-backed continuation states plus shared fixture coverage for processing and terminal result payloads, including `VIRTUAL_FILL`, `executedPrice`, `canceledAt`, and nullable `expiresAt`.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.5)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.
- `pnpm exec vitest run tests/unit/pages/OrderPage.test.tsx`
- `pnpm type-check`

### Completion Notes List

- Story scaffold expanded to include Step C session-window continuity, expiry recovery, and contract-aligned processing or reconciled result handling.
- Added deterministic web guidance for replayed, throttled, expired, and stale order-session verification responses while preserving the already-`AUTHED` bypass path.
- Synced Step C and result-state handling to backend contracts, including polling-backed refresh for `EXECUTING`, `REQUERYING`, and `ESCALATED` plus final-result rendering for reconciled outcomes.
- Added focused web coverage for replay and throttle mapping, stale-session expiry recovery, processing-to-final polling transitions, and explicit final-result rendering across `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, and terminal failure states.
- Switched the web result-matrix tests to the FE-local order-session contract fixture derived from the canonical parity matrix so web stays aligned with mobile on processing/final-result payload fields, including processing body copy, `executedPrice`, `canceledAt`, and nullable `expiresAt`.

### File List

- FE/src/components/order/ExternalOrderRecoverySection.tsx
- FE/src/hooks/order/useOrderRecoveryController.ts
- FE/src/pages/OrderPage.tsx
- FE/tests/unit/pages/OrderPage.test.tsx
- FE/tests/order-session-contract-cases.json
- _bmad-output/implementation-artifacts/4-5-web-conditional-step-up-plus-step-c.md

### Change Log

- 2026-03-15: Implemented web conditional step-up parity with Step C continuity, polling-backed processing or manual-review states, and contract-aligned final result rendering.

## QA Results

### Reviewer

- Quinn (QA Engineer), 2026-03-15

### Gate Decision

- PASS

### Acceptance Criteria Validation

1. AC1 (step-up success advances flow): PASS
2. AC2 (already-`AUTHED` bypass path): PASS
3. AC3 (mapped verification failures): PASS
4. AC4 (expiring-soon Step C warning): PASS
5. AC5 (session extend preserves context): PASS
6. AC6 (expiry recovery): PASS
7. AC7 (processing and reconciliation guidance): PASS
   - Evidence: `OrderPage.test.tsx` now verifies polling-backed processing and manual-review rendering for `EXECUTING`, `REQUERYING`, and `ESCALATED`, plus a processing-to-final transition from a polled `REQUERYING` session into the terminal result card.
8. AC8 (final and reconciled result rendering): PASS
   - Evidence: the page test lane now explicitly covers `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, and terminal failure rendering using the shared cross-client contract fixture, including conditional `executedPrice`/`canceledAt` rendering and `expiresAt: null` payload handling while visible external-order execute failures remain preserved across refresh and polling.

### Executed Verification

- `pnpm exec vitest run tests/unit/pages/OrderPage.test.tsx`
- `pnpm type-check`
- `LIVE_API_BASE_URL=http://127.0.0.1:8080 pnpm exec playwright test e2e/live/order-session-live.spec.ts`

### Findings

- None.

### Notes

- QA remediation aligned the fallback polling interval with the 30-second API contract.
- The visible external-order error presentation is now preserved across both the immediate refetch and subsequent processing-state polling.
- Web and mobile now use FE/MOB-local order-session contract fixtures derived from the same canonical parity matrix, reducing silent drift for the common processing and final-result payload matrix.
- The BE-FE live order-session lane was rerun successfully on `2026-03-16`, covering fresh-MFA low-risk execution plus elevated-risk Step B replay/recovery on the current backend stack.
