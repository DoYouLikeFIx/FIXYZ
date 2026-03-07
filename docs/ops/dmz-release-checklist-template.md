# DMZ Release Checklist Template

Use this template when Epic 12 controls are implemented and a hardened ingress mode is proposed for promotion.

## Required Fields

- release candidate identifier
- environment
- `drill_set_id`
- `review_window_id`
- `supersedes_drill_set_id` or `none`
- drill date
- drill owner
- promotion review timestamp
- execution mode (`manual-runtime` or `automated-runtime`)
- linked `summary-index.json`
- scenario status table containing:
  - `blocked-direct-internal-access`
  - `route-method-deny`
  - `abuse-rate-limit`
  - `trusted-proxy-untrusted-spoof-rejected`
  - `trusted-proxy-malformed-chain-fallback`
  - `trusted-proxy-rightmost-hop-selection`
  - `stale-secret-rejection`
  - `admin-credential-ttl-expiry`
- rolling four-week drill history table containing the four most recent consecutive weekly governance windows for the promotion environment, using the latest non-superseded drill set for each week, with:
  - `week_of`
  - `review_window_id`
  - `environment`
  - `drill_set_id`
  - `supersedes_drill_set_id` or `none`
  - `status`
  - `linked_summary`
- unresolved findings review table containing:
  - `finding_id`
  - `severity`
  - `owner`
  - `scenario_ids`
  - `disposition`
  - `reviewed_by`
  - `risk_acceptance_link` or `mitigation_due_date`
- approval decision
- approver
- notes

## Gate Rule

- Any required scenario with status `fail` or `not-implemented` blocks promotion.
- Promotion drill evidence older than 7 days blocks promotion.
- Missing rerun lineage when a superseding drill set exists in the same review window blocks promotion.
- Missing rolling four-week drill history linkage blocks promotion.
- Rolling-history rows that skip a weekly governance window or reference a superseded set instead of the latest non-superseded set for that week block promotion.
- Rolling-history rows that do not match the promotion environment block promotion unless an explicit reviewed exception is linked.
- Any unresolved finding without owner, disposition, and reviewer evidence blocks promotion.
