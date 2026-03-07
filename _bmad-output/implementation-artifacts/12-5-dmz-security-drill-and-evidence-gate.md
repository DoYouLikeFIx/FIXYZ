# Story 12.5: DMZ Security Drill and Evidence Gate

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release governance owner,
I want a documented DMZ drill governance model,
so that future implementation can add automation without weakening promotion evidence rules.

**Depends On:** Story 10.1, Story 10.4, Story 12.1, Story 12.2, Story 12.3, Story 12.4

## Acceptance Criteria

1. Given DMZ validation requirements, when `docs/ops/dmz-drill-governance.md` is reviewed, then the scenario catalog, owner, and intended cadence are explicit.
2. Given release-promotion requirements, when the governance document is reviewed, then `not-implemented` scenarios are explicitly disallowed as promotion evidence.
3. Given evidence packaging requirements, when `docs/ops/evidence/dmz/README.md` is reviewed, then file naming, summary fields, and retention expectations are explicit.
4. Given release-readiness integration, when the design is reviewed, then freshness and checklist-link requirements are explicit.
5. Given reruns inside a weekly governance window, when checklist lineage is reviewed, then each weekly row uses the latest non-superseded set for that `review_window_id`.

## Tasks / Subtasks

- [ ] Finalize scenario catalog and ownership (AC: 1)
- [ ] Finalize promotion-gate semantics (AC: 2)
- [ ] Finalize evidence file contract and retention rules (AC: 3)
- [ ] Finalize release checklist linkage rules (AC: 4)
  - [ ] Define execution modes and the rule that `planning-review` cannot satisfy promotion evidence
  - [ ] Define release checklist template fields, freshness rules, and latest-non-superseded weekly lineage rules

## Dev Notes

### Developer Context Section

- Repository-local drill automation was intentionally removed; this story now defines the governance baseline that future automation must satisfy.

### Technical Requirements

- Drill governance must map each scenario to its owning prerequisite story.
- Evidence summaries must include `drill_set_id`, execution mode, environment, control state, and artifact reference.
- Evidence summaries must include `review_window_id` so rerun lineage can be validated mechanically.
- Drill governance must include separate trusted-proxy spoof-rejection, malformed-chain fallback, and right-most-hop-selection scenarios.
- `planning-review` is allowed for documentation review only and can never satisfy a promotion gate.
- Release checklist schema must be explicit and reusable.
- Release-linked evidence must include unresolved-finding review records with disposition and reviewer evidence.
- Drill governance must define retry/supersession semantics for rerun scenarios.
- Release checklist lineage must include `supersedes_drill_set_id` when applicable and a rolling four-week drill history table.
- Rolling history rows must preserve environment parity with the promotion set unless a reviewed exception is linked.

### Architecture Compliance

- Preserve Story 10.x release-readiness ownership while adding Epic 12-specific gate rules.
- Do not allow documentation-only evidence to masquerade as runtime validation.

### File Structure Requirements

- Expected touched areas when implementation resumes:
  - `/Users/yeongjae/fixyz/docs/ops/dmz-drill-governance.md`
  - `/Users/yeongjae/fixyz/docs/ops/evidence/dmz/README.md`
  - `/Users/yeongjae/fixyz/docs/ops/dmz-release-checklist-template.md`
  - `/Users/yeongjae/fixyz/.github/workflows/**`

### Testing Requirements

- Verify scenario ownership mapping stays consistent with Epic 12 story dependencies.
- Verify evidence summaries include execution mode, environment, and control state.
- Verify `summary-index.json` is rejected if any required scenario row is missing for the same `drill_set_id`.
- Verify a drill set containing `not-implemented` cannot pass promotion review.
- Verify checklist freshness rule rejects evidence older than 7 days.
- Verify unresolved findings without owner/disposition/reviewer evidence block promotion.
- Verify rerun scenarios create a new `drill_set_id` instead of mutating a prior drill set.
- Verify rerun lineage uses the same `review_window_id`.
- Verify checklist lineage records `supersedes_drill_set_id` when a retry replaced an earlier set in the same review window.
- Verify checklist requires four linked weekly same-environment drill sets for steady-state promotion review.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story 12.5 now defines evidence schema, execution mode, and release checklist expectations.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-drill-governance.md`
- `/Users/yeongjae/fixyz/docs/ops/evidence/dmz/README.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-release-checklist-template.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Completion Notes List

- Story documentation created after removing repository-local Epic 12 runtime assets.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-5-dmz-security-drill-and-evidence-gate.md
