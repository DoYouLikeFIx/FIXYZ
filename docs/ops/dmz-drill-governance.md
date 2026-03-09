# DMZ Drill Governance

## Status

This document is planning-only. No Epic 12 drill automation is currently active in this repository.

## Purpose

Define the intended Story 12.5 governance contract for DMZ validation and release evidence.

## Scenario Catalog

- `blocked-direct-internal-access`
- `route-method-deny`
- `abuse-rate-limit`
- `trusted-proxy-untrusted-spoof-rejected`
- `trusted-proxy-malformed-chain-fallback`
- `trusted-proxy-rightmost-hop-selection`
- `stale-secret-rejection`
- `admin-credential-ttl-expiry`

## Scenario Ownership Mapping

| Scenario | Primary Story Dependency |
|---|---|
| `blocked-direct-internal-access` | Story 12.1 |
| `route-method-deny` | Story 12.2 |
| `abuse-rate-limit` | Story 12.2 |
| `trusted-proxy-untrusted-spoof-rejected` | Story 12.2 |
| `trusted-proxy-malformed-chain-fallback` | Story 12.2 |
| `trusted-proxy-rightmost-hop-selection` | Story 12.2 |
| `stale-secret-rejection` | Story 12.3 |
| `admin-credential-ttl-expiry` | Story 12.4 |

## Ownership and Cadence

- Owner: `SEC`
- Intended cadence after implementation: weekly minimum
- Manual dry runs are allowed before automation exists, but they are documentation review artifacts only

## Promotion Rules

1. A promotion gate is active only after the underlying runtime controls for the required scenarios exist.
2. If any required scenario is `not-implemented`, the drill set is not valid promotion evidence.
3. Release readiness must link at least one full passing drill set from the last 7 days.
4. Rolling last four weekly drill sets must remain retained and linked.
5. Any unresolved finding linked to promotion must include owner, severity, disposition, and reviewer evidence. A finding without a recorded disposition blocks promotion.

A "full drill set" means one evidence package identified by a single `drill_set_id` that contains every required scenario from the catalog exactly once for the same environment and review window.

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

- `planning-review`: documentation-only review, no runtime control executed
- `manual-runtime`: operator executed the scenario against a live runtime
- `automated-runtime`: scheduled or CI-style execution against a live runtime

Only `manual-runtime` and `automated-runtime` can be used for release-promotion evidence.

## Evidence Contract

- Evidence files must follow `docs/ops/evidence/dmz/README.md`.
- Release checklist entry must capture:
  - `drill_set_id`
  - `review_window_id`
  - `supersedes_drill_set_id`, if the promotion set superseded another set in the same review window
  - drill date
  - owner
  - linked summary
  - execution mode
  - environment
  - rolling four-week linked drill history (`week_of`, `review_window_id`, `environment`, `drill_set_id`, `supersedes_drill_set_id`, `status`, `linked_summary`) including the current promotion set and using the latest non-superseded set for each weekly window
  - open findings, if any
  - unresolved-finding review record, if any
  - scenario linkage for each unresolved finding

## Release Checklist Template

- Use `docs/ops/dmz-release-checklist-template.md` as the minimum release-checklist schema for Epic 12 promotion.

## Implementation Notes

- Future automation may use CI or another scheduler, but it must implement this governance contract.
- Documentation-only dry runs must never be confused with active security controls.
