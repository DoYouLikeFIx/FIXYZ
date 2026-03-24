# DMZ Release Checklist Template

Use this template when Epic 12 controls are implemented and a hardened ingress mode is proposed for promotion.

## Required Fields

- Any Story 12.4-derived field in this checklist must reuse the canonical snake_case names from `docs/ops/dmz-admin-access.md`.
- release candidate identifier
- environment
- linked Story 10.1 acceptance CI gate evidence
- linked Story 10.4 smoke and rehearsal evidence
- `drill_set_id`
- `review_window_id`
- `supersedes_drill_set_id` or `none`
- drill date
- drill owner
- promotion review timestamp
- execution mode (`live-external` only for promotion evidence)
- linked `summary-index.json`
- `story_12_6_route_reference`
- `story_0_15_edge_mode_reference`
- scenario status table containing:
  - `blocked-direct-internal-access`
  - `route-method-deny`
  - `abuse-rate-limit`
  - `trusted-proxy-untrusted-spoof-rejected`
  - `trusted-proxy-malformed-chain-fallback`
  - `trusted-proxy-rightmost-hop-selection`
  - `stale-secret-rejection`
  - `admin-credential-ttl-expiry`
  - `canonical-public-edge-route-behavior`
  - `edge-mode-client-parity`
- For the `admin-credential-ttl-expiry` scenario, linked evidence must prove:
  - `requester`
  - `approved_by` or linked emergency-review record
  - `environment`
  - `scope`
  - `lease_id`
  - `issued_at`
  - `expires_at`
  - expiry confirmation or explicit revocation result
  - auto-revocation within 60 seconds of TTL expiry
  - post-expiry denial sample proving deterministic `403 DMZ_ACCESS_DENIED`
  - `status`
  - `actor`
  - `bootstrap_identity_type`
  - `operator_surface`
  - `listener_scope`
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

- The first promotion review after Stories 12.6 and 0.15 are complete requires at least one successful same-environment `live-external` drill set from the last 7 days.
- Any execution mode other than `live-external` blocks promotion evidence.
- Any required scenario with status `fail` or `not-implemented` blocks promotion.
- Promotion drill evidence older than 7 days blocks promotion.
- Missing rerun lineage when a superseding drill set exists in the same review window blocks promotion.
- Missing rolling four-week drill history linkage blocks promotion.
- Rolling-history rows that skip a weekly governance window or reference a superseded set instead of the latest non-superseded set for that week block promotion.
- Rolling-history rows that do not match the promotion environment block promotion unless an explicit reviewed exception is linked.
- Any unresolved finding without owner, disposition, and reviewer evidence blocks promotion.
- Story 10.1 and Story 10.4 evidence remain required release-readiness anchors, but neither can substitute for the DMZ drill set.
- `planning-review` or historical baseline artifacts may support preparation, but they cannot be linked as promotion-satisfying drill evidence.
