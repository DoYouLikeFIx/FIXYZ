# Story 10.5: [FE] Web Release Readiness Pack

Status: review
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web release owner,
I want FE E2E and release evidence packaged,
So that web deployment quality is auditable.

## Acceptance Criteria

1. Given FE E2E suite When release pipeline runs Then critical user journeys pass.
2. Given regression in core order/auth paths When detected Then release gate fails.
3. Given release checklist template When preparing shipment Then checklist items are completed with evidence links.
4. Given final FE candidate build When validated Then versioned release notes are generated.
5. Given repository-facing release documentation When an interviewer or evaluator opens `README.md` and the linked local setup references (`BE/README.md`, `FE/README.md`, `.env.example`, `FE/.env.example`, and `BE/application-local.yml.template`) Then the dual-audience demo paths, architecture diagram, Quick Start, CI badges, `## Architecture Decisions`, `## Environment Variables`, `BE/application-local.yml.template` guidance, and OWASP-referenced audit/PII/session-security explanations are present and mutually consistent.

## Scenario Catalog (Plain Language)

- `E10-WEB-001`: 웹에서 로그인→주문→결과 확인 흐름이 정상인지 확인합니다.
- `E10-WEB-002`: 핵심 화면 흐름에 오류가 나면 배포가 차단되는지 확인합니다.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4
- [x] Implement acceptance-criteria scope 5 (AC: 5)
  - [x] Add test coverage for AC 5

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 10.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 9.5, Story 10.1, Story 10.4.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- This story owns the final README/release-doc pass for the web-facing portfolio experience, including dual-audience navigation, Quick Start, CI badges, and local configuration guidance.
- For this story, the concrete documentation outputs are:
  - `README.md` as the repository-facing dual-audience reviewer entry point
  - `BE/README.md` as the backend local setup and service-profile guidance reference
  - `FE/README.md` as the FE local development and live-E2E guidance reference
  - `.env.example` and `FE/.env.example` as the checked-in environment-variable examples referenced by the docs
  - `BE/application-local.yml.template` as the single tracked `application-local.yml.template` deliverable for reviewer-facing local profile guidance
- README release evidence must keep `## Architecture Decisions`, `## Environment Variables`, and `BE/application-local.yml.template` references consistent with the shipped runtime setup.
- README release evidence must also include OWASP-referenced audit, PII masking, and session-security guidance suitable for reviewer walkthroughs.
- Service-local runtime files under `BE/channel-service/src/main/resources/application-local.yml`, `BE/corebank-service/src/main/resources/application-local.yml`, `BE/fep-gateway/src/main/resources/application-local.yml`, and `BE/fep-simulator/src/main/resources/application-local.yml` remain implementation references; this story should not create separate per-service `application-local.yml.template` copies.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep the reviewer-facing documentation contract centralized: `README.md` owns the evaluator journey, while `BE/README.md`, `FE/README.md`, `.env.example`, `FE/.env.example`, and `BE/application-local.yml.template` provide the linked setup detail.

### File Structure Requirements

- Required documentation outputs for this story:
  - `README.md`
  - `BE/README.md`
  - `FE/README.md`
  - `.env.example`
  - `FE/.env.example`
  - `BE/application-local.yml.template`
- Reference-only runtime inputs for configuration consistency:
  - `BE/channel-service/src/main/resources/application-local.yml`
  - `BE/corebank-service/src/main/resources/application-local.yml`
  - `BE/fep-gateway/src/main/resources/application-local.yml`
  - `BE/fep-simulator/src/main/resources/application-local.yml`

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Validate README/release-doc evidence against the dual-audience reviewer path and local setup/configuration consistency requirements.
- Validate that `README.md` links to and stays semantically aligned with `BE/README.md`, `FE/README.md`, `.env.example`, `FE/.env.example`, and `BE/application-local.yml.template`.
- Validate that `BE/application-local.yml.template` documents the reviewer-facing local profile contract without contradicting the checked-in service-local `application-local.yml` runtime files.

### Story Completion Status

- Status set to `review`.
- Completion note: Epic 10 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 10, Story 10.5)
- `_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `README.md`
- `BE/README.md`
- `FE/README.md`
- `.env.example`
- `FE/.env.example`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 10.

### Completion Notes List

- Added the FE release-pack documents under `FE/docs/release` for checklist, matrix, and versioned release notes.
- Added `pnpm run e2e:release` and `pnpm run release:check` so the FE release gate is encoded as checked-in commands.
- Expanded `FE/.env.example`, `FE/README.md`, and root `README.md` so the release path and required variables are mutually consistent.
- Added `tests/unit/release/web-release-readiness-pack.test.ts` and validated the FE scope with `pnpm run type-check`, `pnpm run lint`, `pnpm run test`, `pnpm run build`, `pnpm run e2e:live:preflight`, and `pnpm run e2e:release`.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/10-5-web-release-readiness-pack.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml
- /Users/yeongjae/fixyz/README.md
- /Users/yeongjae/fixyz/FE/.env.example
- /Users/yeongjae/fixyz/FE/README.md
- /Users/yeongjae/fixyz/FE/package.json
- /Users/yeongjae/fixyz/FE/docs/release/web-readiness-checklist.md
- /Users/yeongjae/fixyz/FE/docs/release/web-test-matrix.md
- /Users/yeongjae/fixyz/FE/docs/release/web-release-notes.md
- /Users/yeongjae/fixyz/FE/tests/unit/release/web-release-readiness-pack.test.ts

## Change Log

- 2026-03-25: Implemented the FE release-readiness pack, added release-gate commands and document consistency coverage, and validated the critical live Playwright journeys.
