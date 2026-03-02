# Story 4.3: [CH] FSM Transition Governance

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a domain owner,
I want explicit order session transition rules,
So that invalid state progression cannot occur.

## Acceptance Criteria

1. Given order FSM definition When state transition command is applied Then only allowed transitions are accepted.
2. Given invalid transition request When attempted Then deterministic conflict/error is returned.
3. Given state persistence event When transition completes Then status and timestamps are stored consistently.
4. Given API status response When serialized Then optional fields follow status-specific contract.

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
- Depends on: Story 4.2.

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

#### TC-4.3-FSM-BOUNDARY: ORD-009 FSM 불법 상태 전이 전체 열거

아래 모든 전이를 단위 테스트로 검증해야 한다 (AC 2):

| 현재 상태 | 시도한 전이 | 예상 결과 |
|---|---|---|
| `PENDING` | OTP없이 바로 execute | HTTP 409 `ORD-009` |
| `PENDING` | 주문 준비 없이 execute 직접 호출 (`PENDING`에서 마논 단계 생략) | HTTP 409 `ORD-009` |
| `PENDING` | 동일 `PENDING` 유지 요청 | HTTP 409 `ORD-009` |
| `AUTHED` | 다시 OTP 호출 | HTTP 409 `ORD-009` |
| `EXECUTING` | execute 재호출 | HTTP 409 `ORD-009` (상태 전이 불가) 또는 `ORD-010` (락 충돌) — 순서 아래 참고 |
| `COMPLETED` | OTP 또는 execute | HTTP 409 `ORD-009` |
| `FAILED` | execute | HTTP 409 `ORD-009` |
| `ESCALATED` | execute | HTTP 409 `ORD-009` |

- **판단 순서 (CRITICAL)**: 상태 검증(`ORD-009`)이 Redis SETNX 락 획득(`ORD-010`)보다 **항상 먼저** 실행된다.  
  따라서 `EXECUTING` 상태에서 execute 재호출 시: 상태 검증 선행 → `ORD-009` 반환 (락 획득 시도 안 함).  
  `AUTHED` 상태에서 동시 2개 요청 경쟁 시에만 `ORD-010` 발생 가능.
- NOTE 허용 전이만 열거: `PENDING→AUTHED(OTP성공)`, `AUTHED→EXECUTING(execute)`, `EXECUTING→COMPLETED/FAILED(FEP응답)`, 참고: `channels/api-spec.md` §2.3

- Status set to `ready-for-dev`.
- Completion note: Epic 4 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.3)
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

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/4-3-fsm-transition-governance.md
