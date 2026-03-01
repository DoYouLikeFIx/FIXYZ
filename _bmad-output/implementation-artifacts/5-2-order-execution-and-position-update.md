# Story 5.2: [AC] Order Execution & Position Update

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a position engine,
I want atomic position deduction and cash settlement for FEP-routed FILLED orders,
So that portfolio integrity is preserved.

## Acceptance Criteria

1. Given authorized FILLED order When position update occurs Then stock quantity deducted and cash settled atomically.
2. Given posting failure mid-transaction When transaction aborts Then neither partial position nor cash mutation persists.
3. Given insufficient position condition When pre-check fails Then no position mutation occurs.
4. Given successful position update When response is built Then clOrdID and filled quantity are included.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 5.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 5.1, Story 4.3.

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

#### TC-5.2-PARTIAL-FILL: 일부 체결 포지션 반영

- GIVEN FEP Simulator가 `ExecType=1 (PARTIAL_FILL)` ExecutionReport 리턴 (`executedQty=5`, `leavesQty=5`)
- WHEN `corebank-service`가 `OrderSession` 포지션 업데이트 실행
- THEN `position_holding.quantity` 증가량이 `executedQty(5)` 만큼만 반영됨 (전량 체결 아님)
- AND `cash_account.balance` 괐리량이 `executedQty × executedPrice` 에 해당하는 금액만큼만 차감됨
- AND `order_session.execution_result = PARTIAL_FILL`, `status = COMPLETED`
- AND 잔여 수량 `leavesQty(5)` 분은 포지션에 반영되지 않음 (AC 1 원자성)
- NOTE 참고: `channels/api-spec.md` §2.3 PARTIAL_FILL 정책

#### TC-5.2-PARTIAL-FILL-CANCEL: 일부 체결 후 잔량 자동 취소 포지션 처리

- GIVEN FEP Simulator가 `PARTIAL_FILL_CANCEL` ExecutionReport 리턴 (`executedQty=5`, `canceledQty=5`)
- WHEN `corebank-service`가 체결분+취소분을 분리 시도
- THEN `position_holding.quantity` 증가량이 `executedQty(5)` 만 처리됨
- AND `canceledQty × executedPrice` 상당액은 `cash_account.balance` 환원됨
- AND `order_session.execution_result = PARTIAL_FILL_CANCEL`, `status = COMPLETED`
- AND 환원 전후로 `order_history` 테이블에 `filled_qty=5`, `canceled_qty=5` 모두 기록됨 (AC 4 추적성)
- NOTE 참고: `fep-gateway/api-spec.md` §3.3 PARTIAL_FILL_CANCEL 정책

- Status set to `ready-for-dev`.
- Completion note: Epic 5 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.2)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md` (채널계 API 명세)
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md` (대외계 API 명세)
- `_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 5.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/5-2-order-execution-and-position-update.md
