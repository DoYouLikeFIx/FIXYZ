# Story 12.5: DMZ Security Drill and Evidence Gate

Status: blocked

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release governance owner,
I want a documented DMZ drill governance model aligned to the reviewed edge runtime path,
so that promotion only proceeds after canonical public edge controls and edge-mode clients are proven with real evidence.

**Depends On:** Story 10.1, Story 10.4, Story 12.1, Story 12.2, Story 12.3, Story 12.4, Story 12.6, Story 0.15

## Acceptance Criteria

1. Given DMZ validation requirements, when `docs/ops/dmz-drill-governance.md` is reviewed, then the scenario catalog, owner, intended cadence, and prerequisite mapping to Stories 12.2, 12.3, 12.4, 12.6, and 0.15 are explicit.
2. Given release-promotion requirements, when the governance document is reviewed, then `planning-review` and `not-implemented` scenarios are explicitly disallowed as promotion evidence and only required `live-external` scenarios may satisfy the gate.
3. Given evidence packaging requirements, when `docs/ops/evidence/dmz/README.md` is reviewed, then file naming, summary fields, retention expectations, execution mode, environment, control state, `review_window_id`, and linkage to Story 12.6 runtime routes and Story 0.15 edge-mode validation are explicit.
4. Given first promotion after Stories 12.6 and 0.15, when release-readiness evidence is reviewed, then at least one successful same-environment `live-external` drill set from the last 7 days and any unresolved-finding review records are linked from the release checklist.
5. Given reruns inside a weekly governance window, when checklist lineage is reviewed, then each weekly row uses the latest non-superseded set for that `review_window_id` and records `supersedes_drill_set_id` when a retry replaced an earlier set.

## Tasks / Subtasks

- [ ] Finalize scenario catalog and ownership (AC: 1)
- [ ] Finalize promotion-gate semantics (AC: 2)
- [ ] Finalize evidence file contract and retention rules (AC: 3)
- [ ] Finalize release checklist linkage rules (AC: 4)
  - [ ] Define execution modes and the rule that `planning-review` cannot satisfy promotion evidence
  - [ ] Define release checklist template fields, freshness rules, and latest-non-superseded weekly lineage rules

## Dev Notes

### Developer Context Section

- Story 12.6 is the reviewed Epic 12 runtime re-entry lane, and Story 0.15 carries edge-mode mobile/client validation before this evidence gate closes promotion readiness.
- Repository-local drill automation was intentionally removed; this story defines the governance and evidence baseline that any future automation must satisfy after reviewed runtime re-entry exists.

### Technical Requirements

- Drill governance must map each scenario to its owning prerequisite story.
- Drill governance must treat Story 12.6 canonical public edge routing and Story 0.15 edge-mode client parity as explicit prerequisite lanes for promotion evidence.
- Evidence summaries must include `drill_set_id`, execution mode, environment, control state, and artifact reference.
- Evidence summaries must include `review_window_id` so rerun lineage can be validated mechanically.
- Drill governance must include separate trusted-proxy spoof-rejection, malformed-chain fallback, and right-most-hop-selection scenarios.
- `planning-review` is allowed for documentation review only and can never satisfy a promotion gate.
- Required promotion evidence must come from `live-external` execution against the same target environment that is being reviewed for release readiness.
- Release checklist schema must be explicit and reusable.
- Release-linked evidence must include unresolved-finding review records with disposition and reviewer evidence.
- Drill governance must define retry/supersession semantics for rerun scenarios.
- Release checklist lineage must include `supersedes_drill_set_id` when applicable and a rolling four-week drill history table.
- Rolling history rows must preserve environment parity with the promotion set unless a reviewed exception is linked.

### Architecture Compliance

- Preserve Story 10.x release-readiness ownership while adding Epic 12-specific gate rules.
- Keep Story 12.5 as a governance/evidence gate after Story 12.6 runtime re-entry and Story 0.15 client parity; do not smuggle new unreviewed runtime behavior into this story.
- Do not allow documentation-only evidence to masquerade as runtime validation.

### File Structure Requirements

- Expected touched areas when implementation resumes:
  - `/Users/yeongjae/fixyz/docs/ops/dmz-drill-governance.md`
  - `/Users/yeongjae/fixyz/docs/ops/evidence/dmz/README.md`
  - `/Users/yeongjae/fixyz/docs/ops/dmz-release-checklist-template.md`
  - `/Users/yeongjae/fixyz/.github/workflows/**`

### Testing Requirements

- Verify scenario ownership mapping stays consistent with Epic 12 story dependencies, including Stories 12.6 and 0.15.
- Verify evidence summaries include execution mode, environment, and control state.
- Verify `summary-index.json` is rejected if any required scenario row is missing for the same `drill_set_id`.
- Verify a drill set containing `not-implemented` cannot pass promotion review.
- Verify a drill set containing only `planning-review` evidence cannot pass promotion review.
- Verify checklist freshness rule rejects evidence older than 7 days.
- Verify first-promotion review requires a successful same-environment `live-external` drill set after Stories 12.6 and 0.15 are complete.
- Verify unresolved findings without owner/disposition/reviewer evidence block promotion.
- Verify rerun scenarios create a new `drill_set_id` instead of mutating a prior drill set.
- Verify rerun lineage uses the same `review_window_id`.
- Verify checklist lineage records `supersedes_drill_set_id` when a retry replaced an earlier set in the same review window.
- Verify checklist requires four linked weekly same-environment drill sets for steady-state promotion review.

### Story Completion Status

- Status set to `blocked` until Stories 12.6 and 0.15 are completed.
- Completion note: Story 12.5 now defines post-12.6 and post-0.15 evidence schema, execution mode, and release checklist expectations, but implementation should not start before those prerequisite stories are done.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-6-canonical-public-edge-route-enablement.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-15-mobile-edge-parity-and-physical-device-transport-hardening.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-drill-governance.md`
- `/Users/yeongjae/fixyz/docs/ops/evidence/dmz/README.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-release-checklist-template.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Completion Notes List

- Story documentation updated so promotion evidence is explicitly gated after Story 12.6 runtime re-entry and Story 0.15 edge-mode validation.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-5-dmz-security-drill-and-evidence-gate.md
