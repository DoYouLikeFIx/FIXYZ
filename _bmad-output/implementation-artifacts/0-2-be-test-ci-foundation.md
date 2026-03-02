# Story 0.2: BE Test and CI Foundation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want reproducible test and CI baselines,
so that feature teams can ship with deterministic validation.

## Acceptance Criteria

1. Given Testcontainers base classes, when integration tests execute, then MySQL/Redis test resources spin up deterministically.
2. Given WireMock dependency policy, when contract test stubs are compiled, then test modules resolve all required classes.
3. Given CI split workflow design, when push/PR occurs, then service-scoped pipelines execute independently.
4. Given failed quality checks, when pipeline runs, then merge is blocked by status checks.

## Tasks / Subtasks

- [ ] Establish shared test foundation in `testing-support` (AC: 1, 2)
  - [ ] Provide reusable MySQL and Redis Testcontainers base support
  - [ ] Expose Testcontainers/WireMock classes with scopes that downstream test modules can resolve
  - [ ] Document local reuse behavior vs CI isolated behavior
- [ ] Add CI workflow separation by service lane (AC: 3)
  - [ ] Add/verify backend scoped workflows for channel/corebank/fep-gateway/fep-simulator
  - [ ] Keep workflow commands deterministic and minimal
- [ ] Enforce quality gate behavior on PR (AC: 4)
  - [ ] Ensure failing test/lint/build status blocks merge to main
  - [ ] Ensure CI status checks are explicit branch protection targets
- [ ] Add baseline verification scripts/docs (AC: 1, 3, 4)
  - [ ] Command snippets for local fast validation
  - [ ] CI troubleshooting notes for containerized tests

## Dev Notes

### Developer Context Section

- Dependency: Story 0.1 must already define module skeleton and compose baseline.
- This story should not duplicate FE scaffold responsibilities from Story 0.3.
- Canonical Epic 0 split is fixed as `0.2 (BE Test/CI)` + `0.3 (FE scaffold)` + `0.4 (MOB scaffold)` in both planning and implementation artifacts.

### Technical Requirements

- Integration tests must use real MySQL/Redis semantics through Testcontainers.
- CI must run lane-specific pipelines so failures localize quickly.
- Coverage/quality checks should fail fast and block merges on red states.
- Keep Testcontainers behavior predictable:
  - local can leverage reuse optimization
  - CI must assume fresh isolated environment per job

### Architecture Compliance

- Respect test layering guidance:
  - heavy integration in service modules
  - shared utility/container scaffolding in `testing-support`
- Maintain dependency direction and avoid coupling production code to test utilities.
- For FEP-related contract behavior, prefer standardized WireMock patterns to avoid divergent test setup.

### Library / Framework Requirements

- Latest ecosystem snapshot (2026-02-25):
  - Testcontainers Java latest stable: `2.0.3`
  - WireMock standalone latest stable: `3.13.2` (4.x line is beta)
- Guardrails:
  - Avoid adopting prerelease/beta test stack in this foundation story.
  - Keep test stack versions explicit and centralized to prevent module drift.

### File Structure Requirements

- Expected touched areas:
  - `BE/testing-support/**`
  - `BE/*-service/src/test/**`
  - `/Users/yeongjae/fixyz/.github/workflows/**`
  - `/Users/yeongjae/fixyz/README.md` (quality gate and local test runbook updates, if needed)
- Do not implement application features in this story; CI/test infrastructure only.

### Testing Requirements

- Minimum checks for story completion:
  - Shared test base compiles from consuming service modules.
  - At least one integration test per lane can boot required containers.
  - CI workflows run independently and fail correctly on broken checks.
  - Branch protection-compatible status checks are produced.

### Previous Story Intelligence

- From Story 0.1 context:
  - Module boundaries and compose contracts are the baseline; do not rework them in 0.2.
  - Internal boundary filter scaffold already exists; this story should only validate/test behavior, not redesign it.
  - Keep Day 1 startup success (`docker compose up`, health UP) untouched.

### Git Intelligence Summary

- Recent commits indicate documentation-heavy and submodule setup activity (`BE`, `FE`, `MOB` linked as submodules).
- Actionable implication:
  - Keep test/CI changes scoped and traceable in dedicated files.
  - Avoid broad structural edits unrelated to CI foundation to reduce merge churn.

### Latest Tech Information

- Version checks performed to avoid stale CI/tooling assumptions:
  - Testcontainers: `2.0.3`
  - WireMock standalone: `3.13.2`
- Recommendation:
  - Use stable lines only for CI baseline.
  - Revisit major upgrades after foundational epics stabilize.

### Project Context Reference

- `project-context.md` was not found.
- Rely on architecture + Epic 0 implementation artifact and current repo structure.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.2)
- `_bmad-output/implementation-artifacts/epic-0-project-foundation.md` (Story 0.2 detail variant)
- `_bmad-output/planning-artifacts/architecture.md` (testing-support scope, CI patterns, WireMock guidance)
- `_bmad-output/planning-artifacts/prd.md` (CI and quality NFR coverage context)
- Testcontainers metadata: https://repo1.maven.org/maven2/org/testcontainers/testcontainers/maven-metadata.xml
- WireMock metadata: https://repo1.maven.org/maven2/org/wiremock/wiremock-standalone/maven-metadata.xml

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story generated from create-story workflow instructions and Epic 0 artifact synthesis.

### Completion Notes List

- Previous-story and git intelligence added for implementation guardrails.
- Version-stability rules added to prevent premature beta adoption.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-2-be-test-ci-foundation.md
