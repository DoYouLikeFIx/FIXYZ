# DMZ Drill Evidence

## Status

This directory documents the target evidence contract for Epic 12. No repository-local DMZ drill automation is currently active.

## Folder Rule

- `docs/ops/evidence/dmz/<YYYYMMDD>/`

## File Rule

- `dmz-<scenario>-<YYYYMMDDTHHMMSSZ>.json`
- Required summary file per drill set: `summary-index.json`
- Optional immutable copy per run: `summary-index-<YYYYMMDDTHHMMSSZ>.json`

## Required Summary Fields

Each drill summary must record:

- drill set id
- review window id
- scenario name
- status
- owner
- checked timestamp
- execution mode
- environment
- control state (`implemented` or `not-implemented`)
- evidence file name or link
- commit or artifact reference
- failure reason when status is not `pass`

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

`summary-index.json` is valid only when it contains one row for every required scenario in `docs/ops/dmz-drill-governance.md` for the same `drill_set_id`, `review_window_id`, and environment. Missing scenarios invalidate the drill set.

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

`planning-review` execution mode must be paired with `control state = not-implemented` and cannot satisfy release-promotion evidence requirements.

## Retention Rule

- Retain at least 35 days of evidence to cover a rolling four-week governance window.
- Release readiness records must additionally link the most recent passing drill set used for promotion and the rolling four-week same-environment history used by the promotion review.
- Each weekly-history row referenced by promotion records must preserve its own `review_window_id` and `supersedes_drill_set_id` lineage so reruns can be audited without reconstructing them from prose.

## Ownership Note

- Automation mechanism is intentionally left open. Future implementation may use CI, scheduled jobs, or operator-driven execution, but it must emit artifacts that follow this contract exactly.
