# Story 5.3: [AC] FEP Order Execution Semantics

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a FEP execution owner,
I want deterministic posting semantics for external orders,
So that local ledger stays consistent with external processing lifecycle.

## Acceptance Criteria

1. Given FEP-routed order execution request When pre-posting/debit occurs Then order state records external linkage metadata.
2. Given external failure after local canonical match When recovery path runs Then position truth is preserved and external sync state is escalated with traceable linkage.
3. Given external unknown outcome When settlement deferred Then ledger state remains reconcilable for later recovery.
4. Given FEP order FILLED When finalized Then final order status (FILLED) and clOrdID references are consistent.

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
- Depends on: Story 5.1, Story 3.2, Story 4.3.

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

#### TC-5.3-UNKNOWN-THRESHOLD: UNKNOWN 재조회 maxRetryCount 경계 테스트

- GIVEN `order_session.status = EXECUTING`, `executing_started_at` 기준 timeout(예: 30초)을 초과한 OrderSession
- WHEN `OrderSessionRecoveryService`의 재조회 응답이 매회 `UNKNOWN`으로 5회 반복
- THEN 5회차 후 `order_session.status = ESCALATED`로 업데이트됨 (AC 3)
- AND 잔액/포지션 추가 변동 없이 레저 상태가 reconcilable 하게 유지됨
- VERIFY `recovery.max-retry-count=5` 설정 변경 시(e.g. 3회) 해당 횟수만큼 재시도 후 ESCALATED 전환 여부
- NOTE `maxRetryCount` 코드 값: `application.yml recovery.max-retry-count=5`, 참고: `fep-gateway/api-spec.md` §10.1
- NOTE **통합 테스트 속도 최적화**: 스케줄러 60초 대기를 회피하려면 `@TestPropertySource(properties="recovery.scan-interval-ms=100")` 또는 `@SpringBootTest` 설정에서 `recovery.scan-interval-ms=100`을 오버라이드하여 100ms 주기로 실행할 것.

- Status set to `ready-for-dev`.
- Completion note: Epic 5 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 5, Story 5.3)
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

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/5-3-fep-order-execution-semantics.md
