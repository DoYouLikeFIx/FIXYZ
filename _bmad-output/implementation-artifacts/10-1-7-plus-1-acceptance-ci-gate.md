# Story 10.1: [INT/CH] 7+1 Acceptance CI Gate

Status: ready-for-dev
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release owner,
I want mandatory acceptance scenarios in CI,
So that release quality baseline is objectively enforced.

## Acceptance Criteria

1. Given protected branch policy When PR to main is opened Then all 7+1 scenarios must pass before merge.
2. Given scenario regression When any scenario fails Then merge gate is blocked.
3. Given scenario tagging policy When tests run Then scenario IDs are traceable in test reports.
4. Given CI report artifact policy When pipeline completes Then evidence artifacts are stored.

## Scenario Catalog (Plain Language)

- `E10-ACCEPT-001`: 주문 접수부터 체결 완료까지 기본 흐름이 정상인지 확인합니다.
- `E10-ACCEPT-002`: 동일 종목 동시 매수/매도 100건에서도 수량과 상태가 맞는지 확인합니다.
- `E10-ACCEPT-003`: 인증번호가 틀리면 주문 실행이 차단되는지 확인합니다.
- `E10-ACCEPT-004`: 같은 주문번호를 다시 보내도 중복 처리되지 않는지 확인합니다.
- `E10-ACCEPT-005`: 외부 응답 지연이 반복될 때 보호 동작이 작동하는지 확인합니다.
- `E10-ACCEPT-006`: 로그아웃 후 요청이 차단되는지 확인합니다.
- `E10-ACCEPT-007`: 누적 매수/매도 결과와 최종 보유수량이 일치하는지 확인합니다.
- `E10-ACCEPT-008`: 시세 지연이 3초를 넘으면 주문이 거절되는지 확인합니다.
- `E10-ACCEPT-009`: 부분 체결 후 잔량 취소 시 손익 계산이 정확한지 확인합니다.
- `E10-SEC-001`: 내부 전용 주소를 인증 없이 호출하면 차단되는지 확인합니다.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 10.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 9.4, Story 7.7, Story 8.4.

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

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 10 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 10, Story 10.1)
- `_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 10.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/10-1-7-plus-1-acceptance-ci-gate.md
