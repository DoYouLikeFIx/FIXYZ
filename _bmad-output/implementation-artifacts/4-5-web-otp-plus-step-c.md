# Story 4.5: [FE] Web OTP + Step C

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want OTP verification and final confirmation/result screens,
So that I can complete order with clear status feedback.

## Acceptance Criteria

1. Given valid OTP submission When verify succeeds Then UI transitions to confirmation/execution step.
2. Given OTP failure cases When code is invalid/expired/replayed Then mapped error message is displayed.
3. Given execution in progress When status polling/subscription updates Then result screen reflects final state.
4. Given final state response When completed/failed returned Then reference and reason fields are rendered conditionally.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add test coverage for AC 1
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add test coverage for AC 2
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add test coverage for AC 3
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add test coverage for AC 4

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 4.2, Story 4.3, Story 4.4.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.

#### TC-SSE-004: CB OPEN/CLOSED 이벤트 코에 자동 UX 응답 (Playwright E2E)

- GIVEN 클라이언트가 SSE 스트림에 구독 중
- WHEN SSE로 `CB_STATE_CHANGE{state:"OPEN",retryAfterSeconds:10}` 도달
- THEN "execute" 쮔리퀀 버튼이 `disabled` 상태로 전환되고 countdown timer가 표시됨
- WHEN 이후 SSE로 `CB_STATE_CHANGE{state:"CLOSED"}` 도달
- THEN 뉢버튼이 즉시 `enabled` 상태로 복구됨
- AND 사용자가 수동 조작 없이도 주문 진행할 수 있는 상태
- NOTE FE 단위 테스트에서 SSE 이벤트를 `MockEventSource` 또는 MSW로 주입; Playwright E2E 대상, 참고: `channels/api-spec.md` §3.1 `CB_STATE_CHANGE` UX 가이드

- Status set to `ready-for-dev`.
- Completion note: Epic 4 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.5)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md` (채널계 API 명세)
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/4-5-web-otp-plus-step-c.md
