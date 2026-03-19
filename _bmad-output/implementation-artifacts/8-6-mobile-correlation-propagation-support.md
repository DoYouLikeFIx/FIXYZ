# Story 8.6: [MOB] Mobile Correlation Propagation Support

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile diagnostics user,
I want correlation id included in mobile failure contexts,
So that incident triage parity with web is maintained.

## Acceptance Criteria

1. Given API response headers When mobile network layer processes response Then correlation id is captured.
2. Given failure UX or support flow When error information shown Then trace id is available for troubleshooting.
3. Given crash/error reporting integration When event sent Then correlation id is attached without PII leakage.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 8.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 8.3.
- Dependency status note:
  - Backend correlation propagation baseline is considered satisfied by `cd BE && ./gradlew correlationIdPropagationChecks`.
- Parallel execution note:
  - This story may run in parallel with Story `8.4` and Story `8.5`.
  - This story does not own backend contract changes.
  - Consume the existing backend contract rather than requesting new BE fields or BE-only telemetry features.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Correlation capture precedence for MOB is fixed to:
  1. standardized envelope `traceId`
  2. direct error payload `correlationId`
  3. response header `X-Correlation-Id`
- AC 1 is satisfied when the mobile network layer preserves correlation in normalized error/report context using the precedence rule above.
- AC 2 is satisfied through existing mobile-visible failure/support surfaces where support reference is already shown or should be shown consistently:
  - auth unknown-fallback messaging
  - external order error/support reference presentation
  - authenticated order failure/support flows consuming normalized error state
- AC 3 does not require rollout of a third-party crash-reporting vendor.
  - It is satisfied by ensuring mobile diagnostic/error context carries only PII-safe fields such as trace/correlation id, machine code, operator code, and retry metadata.
  - Cookies, request bodies, account numbers, and other PII must not be added to diagnostic context.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Mobile implementation must remain within MOB lane files only. Do not modify `BE/**` or `FE/**` as part of this story.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Minimum verification command set:
  - `cd MOB && npm run test -- --runInBand`
- Minimum targeted suites:
  - `MOB/tests/unit/network/http-client.test.ts`
  - `MOB/tests/unit/network/errors.test.ts`
  - `MOB/tests/unit/auth/auth-errors.test.ts`
  - `MOB/tests/unit/order/external-errors.test.ts`
  - `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx`
- Expected primary write scope:
  - `MOB/src/network/http-client.ts`
  - `MOB/src/network/errors.ts`
  - `MOB/src/auth/auth-errors.ts`
  - `MOB/src/order/external-errors.ts`
  - `MOB/src/components/order/ExternalOrderErrorCard.tsx`
  - `MOB/tests/**`

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 8 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 8, Story 8.6)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Implementation Plan

- Centralize mobile correlation-id precedence in normalized HTTP error construction so downstream auth and order surfaces inherit the same trace handling automatically.
- Lock the contract with focused red/green regression coverage for header-only fallback, body-over-header precedence, and visible support-reference propagation.
- Re-validate the full mobile workspace after the narrow runtime change so Story 8.6 can move straight to review without BE/FE coupling.

### Debug Log References

- `npm run test -- tests/unit/network/http-client.test.ts tests/unit/network/errors.test.ts tests/unit/auth/auth-errors.test.ts tests/unit/order/external-errors.test.ts`
- `npm run test -- tests/unit/network/errors.test.ts tests/unit/order/AuthenticatedHomeScreen.test.tsx tests/e2e/mobile-auth-flow.e2e.test.ts`
- `npm run test`
- `npm run lint`
- `npm run typecheck`

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Parallel-ready addendum added on 2026-03-19 to freeze MOB correlation fallback order, visible support-reference surfaces, and PII-safe diagnostic scope.
- Added `traceId` resolution in `MOB/src/network/errors.ts` with the required precedence: envelope `traceId`, direct payload `correlationId`, then response header `X-Correlation-Id`.
- Verified existing auth unknown-fallback messaging and external-order support-reference flows surface header-derived correlation ids without expanding scope beyond MOB lane ownership.
- Added regression coverage for header-only fallback capture, payload-over-header precedence, and PII-safe diagnostic normalization.
- Added review-driven regression coverage for the remaining header-only paths: standardized envelopes without `traceId`, auth-flow unknown fallback sourced from `X-Correlation-Id`, and authenticated order error UX sourced from a header-derived support reference.
- Repo validation used the Vitest-native `npm run test` commands because this mobile workspace does not support Jest-style `--runInBand`.
- Senior Developer Review round 2 found no remaining blocking issues after the header-fallback regression gaps were closed.

### File List

- MOB/src/network/errors.ts
- MOB/tests/unit/network/http-client.test.ts
- MOB/tests/unit/network/errors.test.ts
- MOB/tests/unit/auth/auth-errors.test.ts
- MOB/tests/unit/order/external-errors.test.ts
- MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx
- MOB/tests/e2e/mobile-auth-flow.e2e.test.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/8-6-mobile-correlation-propagation-support.md

## Change Log

- 2026-03-19: Implemented mobile correlation fallback precedence in normalized HTTP errors, extended auth and external-order support-reference regression coverage for header-derived ids, and re-validated the MOB workspace with full test, lint, and typecheck runs.
- 2026-03-19: Resolved Senior Developer Review findings by adding header-only auth-flow coverage, standardized-envelope header fallback coverage, and screen-level support-reference verification; review outcome updated to Approve and story status promoted to `done`.

## Senior Developer Review (AI)

### Review Date

- 2026-03-19

### Outcome

- Approve

### Summary

- Re-reviewed Story 8.6 after fixing the three P2 coverage gaps identified in the first review pass.
- Verified the missing header-only correlation regressions now exist across normalization, auth-flow, and mobile order UX surfaces.
- `project-context.md` is still absent in the repository, so review context was taken from story Dev Notes plus the Epic 8 planning and architecture artifacts.

### Findings

1. No blocking findings remain for this story scope.

### Action Items

- [x] [Medium] Add auth-flow regression proving `X-Correlation-Id` survives `normalizeHttpError` into visible unknown-fallback login copy.
- [x] [Medium] Add standardized-envelope regression proving header fallback still works when the response envelope omits `traceId`.
- [x] [Medium] Add authenticated mobile order screen regression proving the rendered support reference can come from a header-derived correlation id.
