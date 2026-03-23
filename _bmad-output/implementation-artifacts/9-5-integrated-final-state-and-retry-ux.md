# Story 9.5: [FE] Integrated Final-state & Retry UX

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want integrated final-state and retry guidance,
So that complex backend outcomes are understandable.

> **Architecture Note:** Stories `4.5`, `5.7`, `6.7`, and `4.8` already established the FE order-session result, degraded-state, and parity baseline. Story `9.5` is the integrated Epic 9 delta: align those existing web surfaces with the normalized Story `9.2` end-state contract so integrated recovery outcomes stay understandable without introducing unsafe user retry semantics.

## Acceptance Criteria

1. Given normalized terminal response When FE renders result Then completed/failed states are displayed consistently.
2. Given recovery-in-progress state When user views order status Then proper pending/retry guidance is shown.
3. Given a restart-eligible recovery or failure state When user starts over from the retry guidance Then FE follows the guarded fresh-draft flow instead of replaying the stale integrated session.
4. Given unknown status resolution When final state arrives Then UI auto-updates without stale conflict.

## Tasks / Subtasks

- [x] Align the existing web order-session surfaces to the normalized Epic 9 state contract (AC: 1, 4)
  - [x] Reuse the current FE order-session guidance helpers, controller, and result surfaces instead of adding a new integrated-result page or client-only state machine
  - [x] Render `COMPLETED`, `FAILED`, `CANCELED`, `REQUERYING`, and `ESCALATED` from canonical `OrderSessionResponse` semantics only
- [x] Clarify guarded retry and restart behavior on web (AC: 2, 3)
  - [x] Treat `REQUERYING` as wait-and-poll guidance, not an end-user replay action
  - [x] Treat `ESCALATED` as manual-review/support guidance with visible `clOrdId`, not an end-user retry path
  - [x] Limit user retry/restart CTA behavior to safe fresh-draft flows that clear stale session context and do not silently reuse a stale integrated session
- [x] Preserve automatic convergence when delayed final state arrives (AC: 2, 4)
  - [x] Ensure a later terminal fetch or event replaces older processing/manual-review presentation without stale conflicts
  - [x] Keep page revisit, refetch, and persisted-session recovery aligned with the latest backend state rather than cached client assumptions
- [x] Add FE regression and parity coverage for integrated final-state UX (AC: 1, 2, 3, 4)
  - [x] Cover the canonical final-result matrix for `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, and terminal failure
  - [x] Cover `externalOrderId` nullability, `canceledAt` visibility rules, updated-position quantity sourcing, and stale-guidance clearing
  - [x] Cover the retry-safety rules that block false completion claims and unsafe repeat actions for `REQUERYING` and `ESCALATED`

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 9.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 9.2, Story 4.5.
- Story `4.5` already established the FE Step C, processing-state, and final-result baseline on the current order surfaces; Story `9.5` must integrate and tighten that baseline against Epic 9 normalized end-state semantics rather than create a second result flow.
- Story `5.7` already established canonical final-result field expectations, updated-position quantity sourcing, and FE/MOB contract-fixture reuse for visible order outcomes.
- Story `6.7` already established degraded-state handling for `EXECUTING`, `REQUERYING`, and `ESCALATED`, including stale-guidance clearing when a terminal state later arrives.
- Story `4.8` already established the FE/MOB-local fixture and parity-gate strategy for order-session semantics; reuse that approach instead of inventing a new parity mechanism.
- Implementation gate satisfied: Story `9.2` was already `done` and Story `4.5` behavior already existed on the active branch, so work on Story `9.5` was constrained to validating and refining that baseline rather than creating a new greenfield experience.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Canonical scope and wording source for ACs is `_bmad-output/planning-artifacts/epics.md` Epic 9 Story 9.5. If this story file and `epics.md` diverge, `epics.md` wins.
- Canonical machine-code source of truth for integrated final-state and recovery-aware order-session rendering is:
  - `_bmad-output/planning-artifacts/channels/api-spec.md`
  - `docs/contracts/order-session-ux.json`
- Story `9.2` is the normalized contract baseline. FE must consume the normalized `OrderSessionResponse` semantics instead of branching on downstream transport details or pre-Epic-9 assumptions.
- Final-state rendering must preserve the canonical client-visible reference semantics from Story `9.2`:
  - `clOrdId` is the required user-visible order reference for terminal and recovery-aware states
  - `externalOrderId` is supplemental and may be `null`; FE must render it only when the contract provides it and must not block final-state rendering when it is absent
- Final-result handling must remain aligned with the canonical field rules already codified through Stories `5.7` and `9.2`:
  - `COMPLETED` may carry `executionResult = FILLED | PARTIAL_FILL | VIRTUAL_FILL`
  - `CANCELED` may carry `executionResult = CANCELED | PARTIAL_FILL_CANCEL`
  - `FAILED` uses canonical `failureReason` mapping for user guidance
  - `canceledAt` is visible only for `CANCELED` states
- `ESCALATED_MANUAL_REVIEW` is a UX-mapping signal, not raw copy to show directly to the user.
- Guarded retry behavior for this story is strict:
  - `REQUERYING` means the user should wait for SSE/fetch convergence and the UI should continue the canonical 30-second fallback polling cadence
  - `ESCALATED` means manual-review/support guidance, not end-user replay
  - any user-visible retry or restart action must begin a safe fresh draft/order-session path rather than replaying the same integrated order-session in place
- Updated position quantity shown near final results must come from the canonical account inquiry path established by Story `2.2`; FE must not derive holdings from execute payload math or stale local cache.
- Story `9.4` may later restore supplemental linkage such as `externalOrderId`; FE should render those restored fields automatically when present, but must not assume `9.4` completion as a prerequisite for correct final-state rendering.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep integrated final-state and recovery-aware rendering on the existing FE order-session surfaces. Do not introduce a parallel integrated-result workflow, page, or state store.
- Preserve FE-local fixtures where needed, but keep them semantically identical to the canonical contract bundle rather than drifting into FE-only interpretations.
- Keep stale-response protection intact: a newer terminal response must win over an older processing/manual-review render path.
- Keep retry guidance tied to documented backend contracts and existing recovery ownership boundaries; FE must not simulate admin replay, backend reconciliation, or local recovery timers.

### File Structure Requirements

- Likely FE touch points:
  - `FE/src/order/order-session-guidance.ts`
  - `FE/src/components/order/ExternalOrderRecoverySection.tsx`
  - `FE/src/hooks/order/useOrderRecoveryController.ts`
  - `FE/src/pages/OrderPage.tsx`
  - `FE/tests/order-session-contract-cases.json`
  - `FE/tests/unit/pages/OrderPage.test.tsx`
  - `FE/e2e/live/order-session-live.spec.ts`
- Shared parity touch points:
  - `docs/contracts/order-session-ux.json`
  - `tests/client-parity/order-session-parity.test.js`

### Previous Story Intelligence

- Story `4.5` already proved the current FE order flow can render `EXECUTING`, `REQUERYING`, `ESCALATED`, and terminal result states on the existing order page. Treat that surface as the baseline to refine, not as duplicate work to replace.
- Story `5.7` already anchored final-result rendering to the canonical order-session contract bundle and Story `2.2` updated-position quantity lookup. Reuse that result matrix instead of inventing a narrower integrated-final-state subset.
- Story `6.7` already hardened degraded-state copy, stale-warning clearing, and manual-review presentation on FE. Story `9.5` should keep those semantics while realigning them to Story `9.2` normalized end states.
- Story `4.8` already proved the FE/MOB-local order-session contract fixture strategy and the root parity regression gate. Story `9.5` should extend that same parity discipline for integrated final-state semantics.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Required FE coverage for this story:
  - processing guidance for `EXECUTING` and `REQUERYING`
  - manual-review guidance for `ESCALATED` with visible `clOrdId`
  - transition from processing/manual-review into terminal result without stale UI conflict
  - final-result rendering across `FILLED`, `PARTIAL_FILL`, `VIRTUAL_FILL`, `CANCELED`, `PARTIAL_FILL_CANCEL`, and terminal failure
  - `externalOrderId` nullability, `canceledAt` visibility policy, and updated-position quantity rendering
  - retry-safety behavior that avoids exposing an unsafe replay action for `REQUERYING` or `ESCALATED`
- Required parity coverage:
  - FE final-state expectations remain semantically aligned with MOB and `docs/contracts/order-session-ux.json`
  - at least one parity test must fail if FE and MOB diverge on processing, manual-review, or terminal-result semantics
- Reject tests that only assert card visibility. At least one assertion path must validate canonical title/body/reference-field semantics from the contract bundle.

### Quinn Reinforcement Checks

- Contract-source gate:
  - Reject implementation that treats legacy FE copy or pre-normalization assumptions as the source of truth when they differ from `channels/api-spec.md`, `docs/contracts/order-session-ux.json`, or Story `9.2`.
- Retry-safety gate:
  - Reject implementation that exposes an end-user replay path for `REQUERYING` or `ESCALATED`, or that silently reuses a stale integrated session when a fresh draft is required.
- Delta gate:
  - Reject implementation that creates a second integrated-result page, store, or bespoke state machine instead of extending the current order surfaces.
- Evidence gate:
  - Attach one FE proof and one parity proof for AC coverage before status moves to `review`.

### Story Completion Status

- Status set to `done`.
- Completion note: On 2026-03-24 a final re-review found no remaining blocking issues for Story 9.5, so the story moved from `review` to `done`.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 9, Story 9.5)
- `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `docs/contracts/order-session-ux.json`
- `_bmad-output/implementation-artifacts/4-5-web-conditional-step-up-plus-step-c.md`
- `_bmad-output/implementation-artifacts/4-8-cross-client-authorization-fsm-parity-validation.md`
- `_bmad-output/implementation-artifacts/5-7-visible-result-error-ux.md`
- `_bmad-output/implementation-artifacts/6-7-degraded-operation-ux.md`
- `_bmad-output/implementation-artifacts/9-2-end-state-normalization.md`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Initial implementation validation: `pnpm exec vitest run tests/unit/pages/OrderPage.test.tsx` (in `/Users/yeongjae/fixyz/FE`)
- Initial implementation validation: `pnpm type-check` (in `/Users/yeongjae/fixyz/FE`)
- Initial implementation validation: `pnpm test` (in `/Users/yeongjae/fixyz/FE`)
- Initial implementation validation: `pnpm lint` (in `/Users/yeongjae/fixyz/FE`)
- Initial implementation validation: `node --test tests/client-parity/order-session-parity.test.js` (in `/Users/yeongjae/fixyz`)
- Review follow-up rerun: `pnpm exec vitest run tests/unit/pages/OrderPage.test.tsx` (in `/Users/yeongjae/fixyz/FE`)

### Completion Notes List

- Initial implementation: Strengthened FE regression coverage so `REQUERYING` and `ESCALATED` explicitly expose the safe fresh-start action while suppressing unsafe in-place execute/replay actions.
- Initial implementation: Revalidated the existing FE order-session result surface against the integrated Epic 9 contract with targeted unit coverage plus full FE typecheck, test, and lint runs.
- Initial implementation: Fixed shared parity drift by restoring the root `external-order-error-ux` stale-quote contract case to match the FE and MOB copies, then reran the root order-session parity suite successfully.
- Review follow-up: Added a restored-session reset regression proving late `REQUERYING` and `ESCALATED` poll completions cannot resurrect stale integrated-session UI after the user starts fresh, and that reset returns the user to a clean draft state while clearing stale session context.
- Review follow-up: Aligned the story completion metadata with the active `review` state and captured the guarded-retry review follow-up with pending re-review status.
- Final re-review: Confirmed no remaining blocking issues in the FE story scope and closed Story 9.5 as `done`.

### File List

- Cumulative story change set across the initial implementation and the review follow-up:
- /Users/yeongjae/fixyz/FE/tests/unit/pages/OrderPage.test.tsx
- /Users/yeongjae/fixyz/docs/contracts/external-order-error-ux.json
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/9-5-integrated-final-state-and-retry-ux.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-24: Strengthened FE guarded-retry regression coverage so reset from restored `REQUERYING` and `ESCALATED` sessions ignores stale late poll completions and keeps the user on a clean fresh-draft path.
- 2026-03-24: Aligned Story Completion Status metadata with the top-level `review` status and recorded the pending re-review follow-up state.
- 2026-03-24: Final re-review found no remaining blocking issues, so Story 9.5 moved from `review` to `done`.

## Senior Developer Review (AI)

### Review Date

- 2026-03-24

### Outcome

- Final re-review passed

### Summary

- The follow-up regressions and metadata corrections remain in place, and a final re-review found no remaining blocking issues in Story 9.5.
- Story 9.5 is now closed as `done`.

### Findings

1. No blocking findings remain in the FE story scope after the final re-review.

### Action Items

- [x] [Medium] Add a restored-session regression proving reset from `REQUERYING` ignores a late poll completion and clears stale session context.
- [x] [Medium] Add a restored-session regression proving reset from `ESCALATED` ignores a late poll completion and does not resurface the integrated session.
- [x] [Medium] Align Story Completion Status metadata with the top-level `review` status and current story history.
