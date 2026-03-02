# Story 4.2: [CH] OTP Verification Policy

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated order initiator,
I want robust OTP verification controls,
So that step-up authentication is secure and abuse-resistant.

## Acceptance Criteria

1. Given valid OTP in allowed time window When verify endpoint is called Then verification succeeds and session can advance.
2. Given duplicate rapid verify attempts When debounce policy applies Then request is throttled without attempt over-consumption.
3. Given OTP replay in same window When replay is detected Then request is rejected.
4. Given max attempts exceeded When further verify is attempted Then session is failed and execution blocked.

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
- Depends on: Story 4.1, Story 1.2.

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

#### TC-4.2-OTP-DEBOUNCE: OTP 동일 츽 재전송 경계 테스트

- GIVEN 동일 `orderSessionId`에서 T=0에 유효한 OTP 검증 성공 (AC 1)
- WHEN T=5s에 동일 TOTP 값(30초 윈도우 내)으로 `POST /api/v1/orders/sessions/{id}/otp` 재호출
- THEN HTTP 409 (`ORD-002` 또는 idempotent 200) 리턴 — 구현 선택 단일화 필수
- AND `attempt` 카운터가 중복 호출로 인해 추가 소비되지 않아야 함 (AC 2)
- AND 동일 창에서 **`ORD-002`로 실패한 코드**를 재전송하면 `attempt` 카운터가 1 증가하고 `ORD-002`가 반환됨 — idempotent 미적용 (실패 코드는 캐시 키에 포함되지 않음)
- VERIFY 새 TOTP 윈도우(T+31s)의 OTP는 정상 처리되는지 확인
- NOTE TOTP 윈도우 시간을 Mock하여 단위 테스트 수행, 참고: `channels/api-spec.md` §2.2

- Status set to `ready-for-dev`.
- Completion note: Epic 4 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.2)
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

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/4-2-otp-verification-policy.md
