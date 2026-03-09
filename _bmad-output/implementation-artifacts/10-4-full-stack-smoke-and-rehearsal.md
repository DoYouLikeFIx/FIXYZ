# Story 10.4: [INT/CH] Full-stack Smoke & Rehearsal

Status: ready-for-dev
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release manager,
I want full-stack smoke and rehearsal flow,
So that deployment readiness is validated before production cut.

## Acceptance Criteria

1. Given fresh environment boot When compose stack starts Then health endpoints are green within threshold.
2. Given critical API/docs endpoints When smoke checks run Then mandatory endpoints respond correctly.
3. Given rollback rehearsal plan When exercise performed Then recovery procedure is executable and documented.
4. Given rehearsal completion When reviewed Then go/no-go checklist can be updated.
5. Given observability stack verification When smoke rehearsal runs Then Prometheus targets are UP and Grafana dashboard is reachable.

## Scenario Catalog (Plain Language)

- `E10-SMOKE-001`: 전체 환경 기동 직후 핵심 서비스 상태가 정상인지 확인합니다.
- `E10-SMOKE-002`: 필수 API/문서 주소가 모두 응답하는지 확인합니다.
- `E10-SMOKE-003`: 장애 시 롤백 절차를 실제로 실행할 수 있는지 확인합니다.
- `E10-OBS-001`: Prometheus에서 각 서비스 상태가 `UP`으로 보이는지 확인합니다.
- `E10-OBS-002`: Grafana 대시보드에 접속되고 기본 패널이 보이는지 확인합니다.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add test coverage for AC 1
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add test coverage for AC 2
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add test coverage for AC 3
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add test coverage for AC 4
- [ ] Implement acceptance-criteria scope 5 (AC: 5)
  - [ ] Add test coverage for AC 5

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 10.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 10.1.

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

- `_bmad-output/planning-artifacts/epics.md` (Epic 10, Story 10.4)
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

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/10-4-full-stack-smoke-and-rehearsal.md
