# Story 4.7: [MOB] Mobile Conditional Step-Up + Step C

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want conditional additional verification and order execution result flow on mobile,
So that the complete order execution experience is parity with web.

## Acceptance Criteria

1. Given required step-up on mobile, when a valid code is entered, then the app transitions to confirmation or execution.
2. Given a low-risk session already authorized, when the step-up screen is not required, then the app transitions directly to confirmation or execution.
3. Given step-up or execution errors, when a response is received, then the user sees mapped action guidance.
4. Given an active Step C session with `remainingSeconds <= 60`, when the warning threshold is crossed, then the app shows a bottom sticky `세션 연장` CTA without losing navigation context.
5. Given actual expiry during Step B, Step C, or resume, when the stale session is detected, then the app shows a blocking restart path and clears stale session state safely.
6. Given the saved order session is reloaded after remount or session refresh, when the stored order session is restored, then the app restores Step B for `PENDING_NEW`, Step C for `AUTHED`, processing guidance for `EXECUTING` or `REQUERYING`, and manual-review guidance for `ESCALATED`.
7. Given a final or reconciled result response, when `executionResult` is `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, or terminal failure guidance is returned, then ClOrdID and the relevant quantity, price, cancel-time, or failure fields are rendered conditionally.

## Tasks / Subtasks

- [x] Implement mobile conditional step-up flow and bypass path (AC: 1, 2, 3)
  - [x] Support already-authorized sessions without unnecessary extra screens
- [x] Map mobile step-up and execution errors into native guidance (AC: 3)
  - [x] Keep action guidance aligned with FE semantics
- [x] Implement mobile Step C warning, extend, and expiry recovery UX (AC: 4, 5)
  - [x] Preserve local navigation or back-stack integrity across extend and restart
- [x] Implement resume-safe processing, reconciliation, and final-result rendering (AC: 6, 7)
  - [x] Query or restore real order-session state rather than cached assumptions
- [x] Add mobile coverage for step-up success, bypass, error guidance, session extend, expiry recovery, resume behavior, and reconciled result rendering (AC: 1, 2, 3, 4, 5, 6, 7)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.2, Story 4.3, Story 4.6.

### Technical Requirements

- Mobile should support both challenge-required and already-authorized flows cleanly.
- Error mapping must preserve deterministic semantics across clients.
- Step C must preserve active order-session continuity through warning, extend, and expired-session restart behavior.
- Resume behavior must query or restore the real order-session state, not cached assumptions.
- Mobile restore behavior must remain state-specific for `PENDING_NEW`, `AUTHED`, `EXECUTING`, `REQUERYING`, and `ESCALATED`.

### Architecture Compliance

- Preserve the canonical order-session FSM on mobile.
- Consume backend order-session and error contracts directly.
- Align final-result semantics with the same downstream execution states used by web.

### Testing Requirements

- Cover step-up success, bypass, mobile-specific error rendering, session extend, expiry recovery, processing or reconciliation states, final result states, and resume or recovery behavior.

### Story Completion Status

- Status set to `review`.
- Completion note: Implementation is complete and the story remains in `review` with focused QA evidence for resume-safe restore behavior plus shared fixture coverage for processing and terminal result payloads, including `VIRTUAL_FILL`, `executedPrice`, `canceledAt`, and nullable `expiresAt`.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.7)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.
- `pnpm exec vitest run tests/unit/order/AuthenticatedHomeScreen.test.tsx`
- `pnpm exec vitest run tests/unit/order/ExternalOrderRecoverySection.test.tsx`
- `pnpm typecheck`

### Completion Notes List

- Story scaffold expanded to include mobile Step C session continuity, restore-matrix behavior, and contract-aligned processing or reconciled result handling.
- Brought the mobile step-up flow in line with web semantics by mapping replay, throttle, and stale-session errors deterministically and verifying as soon as a six-digit OTP is entered.
- Added restore-safe order-session handling for `PENDING_NEW`, `AUTHED`, `EXECUTING`, `REQUERYING`, `ESCALATED`, and final result states, including forced-expiry recovery messaging.
- Added focused mobile coverage for replay or throttle guidance, stale-session restart, explicit remount or post-refresh resume recovery, resumed `EXECUTING` to final-result transitions, and final-result rendering across `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, and terminal failure states.
- Switched the mobile result-matrix tests to the shared cross-client contract fixture so web and mobile now validate the same processing/final-result payload fields, including processing body copy, `executedPrice`, `canceledAt`, and nullable `expiresAt`.

### File List

- MOB/src/components/order/ExternalOrderRecoverySection.tsx
- MOB/src/order/use-external-order-view-model.ts
- MOB/src/screens/app/AuthenticatedHomeScreen.tsx
- MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- MOB/tests/unit/order/ExternalOrderRecoverySection.test.tsx
- tests/order-session-contract-cases.json
- _bmad-output/implementation-artifacts/4-7-mobile-conditional-step-up-plus-step-c.md

### Change Log

- 2026-03-15: Implemented mobile conditional step-up and Step C continuity with parity error mapping, restore-safe status handling, and focused RN regression coverage.

## QA Results

### Reviewer

- Quinn (QA Engineer), 2026-03-15

### Gate Decision

- PASS

### Acceptance Criteria Validation

1. AC1 (mobile step-up success): PASS
2. AC2 (already-authorized bypass path): PASS
3. AC3 (mapped mobile action guidance): PASS
4. AC4 (Step C warning and extend CTA): PASS
5. AC5 (expiry recovery): PASS
6. AC6 (resume and restore matrix): PASS
   - Evidence: focused screen tests cover `PENDING_NEW`, `AUTHED`, `EXECUTING`, `REQUERYING`, and `ESCALATED` across remount and post-refresh resume paths, with the resumed `EXECUTING` path verified through a processing-to-final transition after the saved order session is reloaded.
7. AC7 (final and reconciled result rendering): PASS
   - Evidence: the mobile screen test lane now explicitly covers `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, and terminal failure rendering using the shared cross-client contract fixture, including conditional `executedPrice`/`canceledAt` rendering and `expiresAt: null` payload handling while preserving the shared result payload semantics used by web.

### Executed Verification

- `pnpm exec vitest run tests/unit/order/AuthenticatedHomeScreen.test.tsx tests/unit/order/ExternalOrderRecoverySection.test.tsx`
- `pnpm typecheck`
- `LIVE_API_BASE_URL=http://127.0.0.1:8080 pnpm exec vitest run tests/e2e/mobile-order-live.e2e.test.ts`

### Findings

- None.

### Notes

- QA remediation verified the mobile execute-error recovery path now preserves visible external-order guidance across a successful `getOrderSession()` refresh.
- Mobile processing-state polling now honors the 30-second fallback contract and no longer retriggers immediate restore-state polling on every same-status refresh.
- Web and mobile now share the same order-session contract fixture for processing and final-result assertions, reducing silent parity drift for the common payload matrix.
- The BE-MOB live order-session lane was rerun successfully on `2026-03-16`, covering fresh-MFA challenged execution plus same-window replay recovery on the current backend stack.
