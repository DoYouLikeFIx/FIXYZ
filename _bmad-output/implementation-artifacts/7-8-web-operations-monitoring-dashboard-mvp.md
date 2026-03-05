# Story 7.8: [FE][CH] Operations Monitoring Dashboard MVP

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operations admin,
I want a lightweight monitoring dashboard backed by Prometheus/Grafana,
So that I can understand system health at a glance during demo and operations review.

## Acceptance Criteria

1. Given admin authenticated user When monitoring dashboard is opened Then Grafana panels show real-time execution volume, pending session count, and market-data ingest status on one screen.
2. Given metric data source delay or failure When dashboard refresh occurs Then stale-data indicator and last-updated timestamp are shown using Prometheus scrape freshness.
3. Given unauthorized user When monitoring route is accessed Then access is blocked.
4. Given operator review session When anomalies occur (pending spike, ingest drop) Then operator can navigate to related admin/audit views and the underlying Grafana drill-down panel.

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

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 7.
- Depends on: Story 7.1, Story 7.2, Story 7.5, Story 9.1.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Use Prometheus as the metrics source and Grafana as the presentation layer (no direct FE-only synthetic metrics).

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Operations monitoring dashboard story scaffolded for post-core rollout.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.8)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact updates for Epic 7.

### Completion Notes List

- Story scaffold generated to make operations dashboard scope explicitly implementable.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-8-web-operations-monitoring-dashboard-mvp.md
