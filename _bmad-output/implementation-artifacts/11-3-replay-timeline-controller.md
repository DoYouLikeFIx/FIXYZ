# Story 11.3: [BE][MD] Replay Timeline Controller

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a test architect,  
I want replay timeline controls,  
So that CI and scenario demos are deterministic and reproducible.

## Acceptance Criteria

1. Given replay start point and speed factor When replay starts Then timeline advances deterministically.
2. Given replay pause/resume command When command is issued Then cursor and emitted sequence remain consistent.
3. Given identical replay seed When CI reruns Then snapshot sequence hash matches baseline.
4. Given LIVE WebSocket disconnect/reconnect event When session recovers Then open subscriptions are re-registered deterministically and gap range is backfilled via replay policy.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 11.
- No supplemental epic artifact detected for this epic at generation time.
- Depends on: Story 11.1.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep replay timeline controls deterministic and auditable for CI.
- Preserve reproducibility with fixed seed/cursor and stable sequence hashing.
- Include reconnect/resubscribe deterministic behavior for provider socket interruptions.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Include deterministic hash assertions in CI and local replay test runs.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Epic 11 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11, Story 11.3)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md`
- `_bmad-output/planning-artifacts/fep-gateway/kis-websocket-h0stcnt0-spec.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 11.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-3-replay-timeline-controller.md
