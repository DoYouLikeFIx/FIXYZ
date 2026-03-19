# Story 8.5: [FE] Web Correlation Propagation Support

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web diagnostics user,
I want correlation id included in web error/report contexts,
So that support can trace incidents quickly.

## Acceptance Criteria

1. Given backend returns correlation header When FE handles response Then id is attached to error/report context.
2. Given visible error state When rendered Then support trace key can be surfaced where appropriate.
3. Given client logging policy When diagnostics emitted Then no sensitive values are included.

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
  - This story may run in parallel with Story `8.4` and Story `8.6`.
  - This story does not own backend contract changes.
  - Consume the existing backend contract rather than requesting new BE fields or BE-only telemetry features.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Correlation capture precedence for FE is fixed to:
  1. standardized envelope `traceId`
  2. direct error payload `correlationId`
  3. response header `X-Correlation-Id`
- AC 1 is satisfied when FE preserves correlation in normalized client error/report context using the precedence rule above.
- AC 2 is satisfied through existing FE-visible failure surfaces where support reference is already shown or should be shown consistently:
  - auth unknown-fallback messaging
  - external order error/support reference presentation
  - order failure UI that already consumes normalized error state
- AC 3 does not require rollout of a third-party telemetry SDK.
  - It is satisfied by ensuring FE diagnostic/error context carries only PII-safe fields such as trace/correlation id, machine code, operator code, and retry metadata.
  - Cookies, CSRF tokens, request bodies, account numbers, and other PII must not be added to diagnostic context.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- FE implementation must remain within FE lane files only. Do not modify `BE/**` or `MOB/**` as part of this story.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Minimum verification command set:
  - `cd FE && pnpm test -- --runInBand`
- Minimum targeted suites:
  - `FE/tests/unit/lib/axios.test.ts`
  - `FE/tests/unit/lib/auth-errors.test.ts`
  - `FE/tests/unit/order/external-errors.test.ts`
  - `FE/tests/unit/order/ExternalOrderErrorPanel.test.tsx`
  - `FE/tests/unit/pages/OrderPage.test.tsx`
  - `FE/tests/integration/App.test.tsx`
- Expected primary write scope:
  - `FE/src/lib/axios.ts`
  - `FE/src/lib/auth-errors.ts`
  - `FE/src/order/external-errors.ts`
  - `FE/src/components/order/ExternalOrderErrorPanel.tsx`
  - `FE/tests/**`

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 8 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 8, Story 8.5)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Implementation Plan

- Add a shared correlation-id resolver in `FE/src/lib/axios.ts` so normalized FE errors follow the required precedence: envelope `traceId`, direct payload `correlationId`, then `X-Correlation-Id` response header.
- Preserve the existing auth/order support-reference UX by continuing to flow normalized `traceId` through the current presentation helpers and order error panel.
- Extend axios helper tests to prove header fallback works without leaking unsafe request or account data into normalized FE error context.

### Debug Log References

- Generated from canonical planning artifact for Epic 8.
- `cd FE && pnpm test -- --runInBand`
- `cd FE && pnpm lint`
- `cd FE && pnpm type-check`

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Parallel-ready addendum added on 2026-03-19 to freeze FE correlation fallback order, visible support-reference surfaces, and PII-safe diagnostic scope.
- Added FE correlation fallback resolution in `FE/src/lib/axios.ts` so normalized errors preserve response identifiers using the required precedence order.
- Validated that existing auth unknown-fallback messaging and order support-reference surfaces continue to consume sanitized `traceId` values without requiring broader FE lane changes.
- Added axios unit coverage for header fallback precedence and explicit PII-safe normalized error context assertions.
- Verified Story 8.5 with `pnpm test -- --runInBand` and `pnpm type-check`; `pnpm lint` passes with one pre-existing warning in `FE/src/pages/AdminConsolePage.tsx`.
- Resolved review follow-up gaps by covering the 2xx envelope unwrap path, driving auth/order support-reference tests from header-derived normalized errors, and routing boundary diagnostics through a dedicated PII-safe diagnostic context.

### File List

- FE/src/lib/axios.ts
- FE/src/components/common/ErrorBoundary.tsx
- FE/tests/integration/App.test.tsx
- FE/tests/unit/components/ErrorBoundary.test.tsx
- FE/tests/unit/lib/axios.test.ts
- FE/tests/unit/pages/OrderPage.test.tsx
- _bmad-output/implementation-artifacts/8-5-web-correlation-propagation-support.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- Added response-header correlation fallback to FE normalized error handling while preserving envelope/direct-payload precedence.
- Expanded axios helper coverage for precedence rules and PII-safe diagnostic context preservation.
- Added review follow-up coverage for header-to-UI support-reference propagation and sanitized diagnostic logging.
