# DMZ Drill Governance

## Status

This document is the active Story 12.5 governance baseline for Epic 12 DMZ promotion evidence.
No repository-local DMZ drill automation is currently active in this repository, but any operator-run or future automated drill must follow this contract exactly.

## Purpose

Define repeatable DMZ security drill scenarios, promotion semantics, and release-checklist lineage rules after Story 12.6 canonical public edge routing and Story 0.15 edge-mode client parity.

## Scenario Catalog

| Scenario | Owner | Intended cadence | Primary prerequisite story | Promotion role | Notes |
|---|---|---|---|---|---|
| `blocked-direct-internal-access` | `SEC` | weekly minimum + release review | Story 12.1 | required | Documents the segmentation boundary check and remains part of the full drill set even though Story 12.5 explicitly calls out 12.2/12.3/12.4/12.6/0.15 mapping as the minimum promotion lanes. |
| `route-method-deny` | `SEC` | weekly minimum + release review | Story 12.2 | required | Confirms deterministic deny behavior for disallowed methods and internal namespaces. |
| `abuse-rate-limit` | `SEC` | weekly minimum + release review | Story 12.2 | required | Confirms perimeter abuse controls and evidence fields from `docs/ops/dmz-abuse-response.md`. |
| `trusted-proxy-untrusted-spoof-rejected` | `SEC` | weekly minimum + release review | Story 12.2 | required | Separate trusted-proxy spoof rejection scenario. |
| `trusted-proxy-malformed-chain-fallback` | `SEC` | weekly minimum + release review | Story 12.2 | required | Separate malformed-chain fallback scenario. |
| `trusted-proxy-rightmost-hop-selection` | `SEC` | weekly minimum + release review | Story 12.2 | required | Separate right-most-hop selection scenario. |
| `stale-secret-rejection` | `SEC` | weekly minimum + release review | Story 12.3 | required | Validates stale credential or secret-rotation rejection. |
| `admin-credential-ttl-expiry` | `SEC` | weekly minimum + release review | Story 12.4 | required | Requires TTL expiry, auto-revocation, and post-expiry deterministic denial proof. |
| `canonical-public-edge-route-behavior` | `SEC` | weekly minimum + release review | Story 12.6 | required | Must show the Story 12.6 canonical public route inventory is exercised through the public edge rather than direct service reachability. |
| `edge-mode-client-parity` | `SEC` | weekly minimum + release review | Story 0.15 | required | Must show edge-mode client validation through the same target environment that is under release review. |

## Ownership and Cadence

- Owner: `SEC`
- Intended cadence after implementation: weekly minimum
- `planning-review` artifacts are allowed before or between live runs, but they are preparation-only artifacts and cannot satisfy promotion evidence

## Promotion Rules

1. This DMZ gate complements Story 10.1 acceptance CI evidence and Story 10.4 smoke/rehearsal evidence. Those release-readiness anchors remain required, but neither can substitute for required DMZ drill evidence.
2. A promotion gate is active only after the underlying runtime controls for the required scenarios exist, including Story 12.6 canonical public edge routing and Story 0.15 edge-mode client parity.
3. Only required scenarios recorded as `execution_mode = live-external` from the same target environment under review may satisfy the promotion gate.
4. `planning-review` artifacts may support procedure review, checklist drafting, and dry-run preparation, but they can never satisfy promotion evidence.
5. If any required scenario is `status = fail` or `control_state = not-implemented`, the drill set is not valid promotion evidence and must include explicit failure reason, owner assignment, and mapped prerequisite story.
6. The first promotion review after Stories 12.6 and 0.15 are complete must link at least one full successful same-environment `live-external` drill set from the last 7 days.
7. Rolling last four weekly same-environment drill sets must remain retained and linked, using the latest non-superseded drill set for each review window.
8. Any unresolved finding linked to promotion must include owner, severity, disposition, and reviewer evidence. A finding without a recorded disposition blocks promotion.

A "full drill set" means one evidence package identified by a single `drill_set_id` that contains every required scenario from the catalog exactly once for the same environment and review window.

Environment parity rule:

- Promotion evidence must come from the same target environment that is being assessed for release readiness.
- Weekly rolling-history rows must preserve that same environment unless a reviewed exception is linked from the release checklist.

Review window rule:

- Every drill set must carry a `review_window_id` that identifies the promotion or weekly governance slice it belongs to.
- Any superseding drill set must use the same `review_window_id` as the drill set it replaces.
- Weekly steady-state governance may use an ISO-week-based identifier such as `2026-W10-prod`, but the exact format must be stable within the workspace.
- For rolling-history promotion checks, the four rows must represent the four most recent consecutive weekly governance windows for the same environment as the promotion set.
- If reruns occurred inside one weekly window, only the latest non-superseded drill set for that environment/week counts toward the rolling-history requirement.

Retry and supersession rule:

- `summary-index.json` is immutable for a given `drill_set_id`.
- If any scenario must be rerun, the rerun creates a new `drill_set_id`; it does not overwrite or append a second result into the existing set.
- A superseding drill set must reference the superseded `drill_set_id` in release notes or evidence metadata when the retry occurred in the same review window.

## Status Semantics

- `pass`: scenario executed and succeeded
- `fail`: scenario executed and failed
- `not-implemented`: design exists, runtime control not yet built

## Execution Mode Semantics

- `planning-review`: documentation-only review, checklist rehearsal, or dry-run validation with no promotion-eligible runtime proof
- `live-external`: the scenario was executed against the canonical public edge from the same target environment being reviewed for promotion; operator-run and automated executions both use this mode when the runtime proof is real

Only `live-external` can be used for release-promotion evidence.

## Evidence Contract

- Evidence files must follow `docs/ops/evidence/dmz/README.md`.
- Any Story 12.4-derived field in drill evidence must reuse the canonical snake_case names from `docs/ops/dmz-admin-access.md`.
- Every release-linked drill set must include explicit linkage showing whether and how the evidence exercised Story 12.6 runtime routes and Story 0.15 edge-mode client validation.
- Release checklist entry must capture:
  - linked Story 10.1 CI gate evidence
  - linked Story 10.4 smoke/rehearsal evidence
  - `drill_set_id`
  - `review_window_id`
  - `supersedes_drill_set_id`, if the promotion set superseded another set in the same review window
  - drill date
  - owner
  - linked summary
  - execution mode (`live-external` only for promotion evidence)
  - environment
  - `story_12_6_route_reference`
  - `story_0_15_edge_mode_reference`
  - rolling four-week linked drill history (`week_of`, `review_window_id`, `environment`, `drill_set_id`, `supersedes_drill_set_id`, `status`, `linked_summary`) including the current promotion set and using the latest non-superseded set for each weekly window
  - open findings, if any
  - unresolved-finding review record, if any
  - scenario linkage for each unresolved finding
- Scenario-specific minimum evidence:
  - `canonical-public-edge-route-behavior`: linked route inventory or artifact proving Story 12.6 canonical public routes were exercised through the public edge, plus any deny-coverage note for method/namespace protection that influenced the run
  - `edge-mode-client-parity`: linked evidence proving Story 0.15 edge-mode client validation ran against the same target environment and canonical edge base URL or ingress selector contract
- Additional scenario-specific minimum evidence:
  - `admin-credential-ttl-expiry`: linked evidence proving `requester`, `approved_by` or a linked emergency-review record, `environment`, `scope`, `lease_id`, `issued_at`, `expires_at`, expiry confirmation or explicit revocation result, auto-revocation within 60 seconds of TTL expiry, post-expiry denial sample proving deterministic `403 DMZ_ACCESS_DENIED`, `status`, `actor`, `bootstrap_identity_type`, `operator_surface`, and `listener_scope`.

## Release Checklist Template

- Use `docs/ops/dmz-release-checklist-template.md` as the minimum release-checklist schema for Epic 12 promotion.

## Implementation Notes

- Future automation may use CI or another scheduler, but it must implement this governance contract.
- Repository-local workflow automation is optional future follow-on scope; Story 12.5 itself is satisfied by the governance and evidence contract even when execution remains operator-run.
- Documentation-only dry runs must never be confused with active security controls.
