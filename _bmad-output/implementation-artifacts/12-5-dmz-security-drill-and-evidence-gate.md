# Story 12.5: DMZ Security Drill and Evidence Gate

Status: done

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

- [x] Finalize scenario catalog and ownership (AC: 1)
- [x] Finalize promotion-gate semantics (AC: 2)
- [x] Finalize evidence file contract and retention rules (AC: 3)
- [x] Finalize release checklist linkage rules (AC: 4, 5)
  - [x] Define execution modes and the rule that `planning-review` cannot satisfy promotion evidence
  - [x] Define release checklist template fields, freshness rules, and latest-non-superseded weekly lineage rules

## Dev Notes

### Developer Context Section

- Story 12.6 is the reviewed Epic 12 runtime re-entry lane, and Story 0.15 carries edge-mode mobile/client validation before this evidence gate closes promotion readiness.
- Repository-local drill automation was intentionally removed; this story defines the governance and evidence baseline that any future automation must satisfy after reviewed runtime re-entry exists.
- Story 10.1 and Story 10.4 remain supporting release-readiness anchors for CI and smoke/rehearsal evidence, but they do not replace the required DMZ `live-external` evidence defined here.

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

- Changed during this implementation round:
  - `/Users/yeongjae/fixyz/docs/ops/dmz-drill-governance.md`
  - `/Users/yeongjae/fixyz/docs/ops/evidence/dmz/README.md`
  - `/Users/yeongjae/fixyz/docs/ops/dmz-release-checklist-template.md`
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-5-dmz-security-drill-and-evidence-gate.md`
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml`
  - `/Users/yeongjae/fixyz/tests/edge-gateway/dmz-drill-evidence-gate.test.js`
- Optional future automation touchpoint only:
  - `/Users/yeongjae/fixyz/.github/workflows/**`
  - No repository-local drill workflow change is required for the current Story 12.5 governance baseline.

### Testing Requirements

- Add root regression coverage in `tests/edge-gateway/dmz-drill-evidence-gate.test.js`.
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

- Status set to `done`.
- Completion note: Story 12.5 governance and evidence documents now align on required `live-external` promotion evidence, same-environment freshness and lineage rules, Story 12.6 route linkage, Story 0.15 edge-mode client parity references, and root regression coverage.

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

### Debug Log References

- `node --check tests/edge-gateway/dmz-drill-evidence-gate.test.js`
- `node --test tests/edge-gateway/dmz-drill-evidence-gate.test.js`
- `npm.cmd run test:edge-gateway`

### Completion Notes List

- Story documentation updated so promotion evidence is explicitly gated after Story 12.6 runtime re-entry and Story 0.15 edge-mode validation.
- Updated `docs/ops/dmz-drill-governance.md` so owner `SEC`, scenario mapping, `live-external` promotion semantics, review-window lineage, and Story 10.1/10.4 supporting-anchor roles are explicit.
- Updated `docs/ops/evidence/dmz/README.md` so file naming, summary fields, execution-mode semantics, retention rules, and Story 12.6 / Story 0.15 linkage requirements are explicit.
- Updated `docs/ops/dmz-release-checklist-template.md` so first-promotion freshness rules, latest non-superseded weekly lineage, unresolved-finding review, and same-environment promotion gating are explicit.
- Added `tests/edge-gateway/dmz-drill-evidence-gate.test.js` to regression-protect the Story 12.5 governance, evidence, and release-checklist contract.
- Story status advanced to `done` after the documentation contract and root regression coverage were revalidated together.

### File List

- /Users/yeongjae/fixyz/docs/ops/dmz-drill-governance.md
- /Users/yeongjae/fixyz/docs/ops/evidence/dmz/README.md
- /Users/yeongjae/fixyz/docs/ops/dmz-release-checklist-template.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-5-dmz-security-drill-and-evidence-gate.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml
- /Users/yeongjae/fixyz/tests/edge-gateway/dmz-drill-evidence-gate.test.js
