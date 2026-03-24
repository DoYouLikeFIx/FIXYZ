# DMZ Drill Evidence

## Status

This directory defines the active Story 12.5 evidence contract for Epic 12 DMZ drill sets.
No repository-local DMZ drill automation is currently active, but any operator-run or future automated drill must emit artifacts that match this contract exactly.

## Folder Rule

- `docs/ops/evidence/dmz/<YYYYMMDD>/<drill_set_id>/`

## File Rule

- `dmz-<scenario>-<drill_set_id>-<YYYYMMDDTHHMMSSZ>.json`
- Required summary file per drill set: `summary-index.json`
- Optional immutable copy per run: `summary-index-<drill_set_id>-<YYYYMMDDTHHMMSSZ>.json`

## Required Summary Fields

Each drill summary must record:

- `drill_set_id`
- `review_window_id`
- `scenario_id`
- `status`
- `owner`
- `checked_at`
- `execution_mode`
- `environment`
- `control_state` (`implemented` or `not-implemented`)
- `prerequisite_story`
- `evidence_file`
- `artifact_reference`
- `failure_reason` when `status` is not `pass`
- `story_12_6_route_reference` (`not-applicable` only when the scenario does not directly exercise Story 12.6 runtime routes)
- `story_0_15_edge_mode_reference` (`not-applicable` only when the scenario does not directly exercise Story 0.15 edge-mode client validation)

For `abuse-rate-limit` evidence, the summary must also record:

- `enforcement_layer`
- `limit_key_type`
- `source_identity`
- `source_identity_origin`

For release-linked drill sets, `summary-index.json` must also include an `unresolved_finding_review` array. Each entry must contain:

- `finding_id`
- `severity`
- `owner`
- `scenario_ids`
- `disposition` (`fix-before-release`, `accepted-risk`, `deferred-with-mitigation`)
- `reviewed_by`
- `risk_acceptance_link` or `mitigation_due_date`

`summary-index.json` is valid only when it contains one row for every required scenario in `docs/ops/dmz-drill-governance.md` for the same `drill_set_id`, `review_window_id`, environment, and execution mode. Missing scenarios, mixed environments, or mixed execution modes invalidate the drill set.

Retry rule:

- `summary-index.json` is immutable per `drill_set_id`.
- Scenario retries must create a new `drill_set_id`.
- If a drill set supersedes an earlier run from the same review window, the new summary must record `supersedes_drill_set_id`.
- Release checklist lineage must preserve that same `supersedes_drill_set_id` instead of collapsing the retry history.

## Status Semantics

- `pass`: control implemented and scenario succeeded
- `fail`: control implemented and scenario failed
- `not-implemented`: scenario design exists but runtime control is not yet built

`not-implemented` results may be tracked during planning, but they cannot satisfy release-promotion evidence requirements.

## Execution Mode Semantics

- `planning-review`: documentation-only review, checklist rehearsal, or dry-run validation; this mode must be paired with `control_state = not-implemented` or equivalent preparation-only evidence and cannot satisfy release-promotion evidence requirements.
- `live-external`: the scenario ran against the canonical public edge from the same target environment under release review; this is the only promotion-valid execution mode.

`planning-review` artifacts may support preparation, but they cannot satisfy release-promotion evidence requirements.

Promotion-linked `summary-index.json` files are valid only when every required scenario row uses `execution_mode = live-external`.

## Retention Rule

- Retain at least 35 days of evidence to cover a rolling four-week governance window.
- The first promotion after Stories 12.6 and 0.15 are complete must link at least one successful same-environment `live-external` drill set from the last 7 days.
- Release readiness records must additionally link the most recent passing drill set used for promotion and the rolling four-week same-environment history used by the promotion review.
- Each weekly-history row referenced by promotion records must preserve its own `review_window_id` and `supersedes_drill_set_id` lineage so reruns can be audited without reconstructing them from prose.
- Any promotion-linked drill set must preserve explicit `story_12_6_route_reference` and `story_0_15_edge_mode_reference` linkage so reviewers can verify that canonical public routes and edge-mode clients were actually exercised.

## Ownership Note

- Automation mechanism is intentionally left open. Future implementation may use CI, scheduled jobs, or operator-driven execution, but it must emit artifacts that follow this contract exactly.
