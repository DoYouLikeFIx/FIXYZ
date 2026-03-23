# Story 7.8: [FE][CH] Operations Monitoring Dashboard MVP

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operations admin,
I want a lightweight monitoring dashboard backed by Prometheus and Grafana,
so that I can understand system health at a glance during demo and operations review.

## Acceptance Criteria

1. Given admin authenticated user, when the monitoring dashboard is opened, then Grafana panels show real-time execution volume, pending session count, and market-data ingest status on one screen.
2. Given metric data source delay or failure, when dashboard refresh occurs, then stale-data indicator and last-updated timestamp are shown using Prometheus scrape freshness.
3. Given unauthorized user, when monitoring route is accessed, then access is blocked.
4. Given operator review session, when anomalies occur (spike in pending, ingest drop), then operator can navigate to related admin or audit views and the underlying Grafana drill-down panel.

## Tasks / Subtasks

- [ ] Extend the existing admin FE surface with a monitoring section or route (AC: 1, 3, 4)
  - [ ] Reuse `AdminRoute`, the existing `/admin` entry point, and the current `AdminConsolePage` shell instead of introducing a separate admin security model.
  - [ ] Decide whether the monitoring MVP lives as a third panel in `AdminConsolePage` or as a nested admin route under the same guard, and keep drill-down navigation consistent with current admin UX.
- [ ] Add config-driven Grafana panel integration for the fixed MVP metrics (AC: 1, 4)
  - [ ] Wire environment-safe Grafana URLs or panel descriptors for execution volume, pending session count, and market-data ingest status.
  - [ ] Reuse signed internal links as the default integration shape and allow iframe embed only when the target Grafana deployment and access model support it.
  - [ ] Expose operator drill-down actions that open the relevant Grafana panel or focus the related admin audit view without inventing a new backend admin API.
- [ ] Implement freshness and unavailable-state handling for operations review (AC: 2)
  - [ ] Render stale or unavailable messaging and last-updated metadata from Prometheus or Grafana freshness signals rather than custom FE heuristics.
  - [ ] Keep the dashboard useful when panel config is missing or the observability stack is unavailable by showing deterministic guidance instead of a broken blank state.
- [ ] Add regression coverage for admin-only monitoring behavior (AC: 1, 2, 3, 4)
  - [ ] Add FE tests for admin guard enforcement, configured panel rendering, stale-state messaging, unavailable-state handling, and drill-down navigation.
  - [ ] Add one integration-level proof that the monitoring MVP coexists with the existing force-logout and audit-search admin console behavior.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 7.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` is historical and may help with observability context, but it is not the canonical story authority.
- Depends on Story 7.1, Story 7.2, Story 7.5, and Story 9.1.
- Story 7.6 already established the FE admin route guard and admin console shell. Story 7.8 should extend that surface, not fork it.
- PRD traceability caveat: `_bmad-output/planning-artifacts/prd.md` says richer admin dashboards are excluded from the FR-traced MVP. Treat Story 7.8 as a lightweight demo or operations-review follow-on on top of the existing admin console, not as a full observability product surface.

### Technical Requirements

- UI scope:
  - Keep Story 7.8 FE-owned and lightweight.
  - Do not build a custom charting system or direct Prometheus query client in the browser.
  - Prefer a config-driven Grafana integration that reuses existing dashboards or panels.
- Observability source expectations:
  - Architecture defines Grafana panels plus selected Actuator endpoints as the demo observability surface.
  - Prometheus scrape semantics should drive freshness interpretation; use documented scrape-health signals rather than FE-only timers.
  - Market-data ingest status can reuse existing `fep.marketdata.*` Micrometer metrics already exposed by `MarketDataMetrics`.
- Scope guardrails:
  - Execution volume and pending-session panels must consume existing or pre-provisioned observability signals. If the required metric contract is missing, capture it as an explicit dependency gap instead of inventing a shadow metric in FE.
  - The existing admin APIs remain canonical:
    - `GET /api/v1/admin/audit-logs`
    - `DELETE /api/v1/admin/members/{memberUuid}/sessions`
  - Story 7.8 must not create a second admin backend contract just to support dashboard chrome.
- Suggested FE configuration contract:
  - Add explicit Vite env typing for the monitoring dashboard URLs if they do not already exist.
  - Keep Grafana link or embed URLs out of hard-coded component markup.

### Architecture Compliance

- Reuse current FE stack and conventions:
  - React `19.2.0`
  - `react-router-dom` `7.13.1`
  - Vitest `4.0.8`
- Preserve `ROLE_ADMIN` gating through `AdminRoute`; anonymous and standard users must never see monitoring content.
- Keep the existing `/admin` workflow coherent with Story 7.6 so session invalidation, audit search, and monitoring can coexist without route or layout duplication.
- Respect architecture RULE-068: Prometheus is an internal scrape target and Grafana is the single metrics source for operator visualization. FE should not encourage direct browser access to raw Prometheus endpoints on management ports.

### Library / Framework Requirements

- Grafana integration notes from current official docs:
  - Internal panel links are the safest default for authenticated operator access.
  - Panel iframe embedding requires a Grafana deployment model that supports embedding and appropriate viewer access.
  - Grafana Cloud does not support panel embedding or anonymous-access embedding for this use case, so Story 7.8 must keep a link-based fallback.
- Prometheus freshness notes from current official docs:
  - `up{job,instance}` indicates scrape target health (`1` healthy, `0` failed).
  - `scrape_duration_seconds{job,instance}` is available for scrape timing and can support operator freshness or health interpretation when panel configuration exposes it.

### File Structure Requirements

- Expected touched areas:
  - `FE/src/pages/AdminConsolePage.tsx`
  - `FE/src/router/AppRouter.tsx` and/or `FE/src/router/navigation.ts` if a nested admin monitoring route is introduced
  - `FE/src/router/AdminRoute.tsx`
  - `FE/src/types/admin.ts` or a new adjacent FE admin-monitoring type file
  - `FE/src/vite-env.d.ts`
  - `FE/tests/unit/pages/AdminConsolePage.test.tsx`
  - `FE/tests/unit/router/AdminRoute.test.tsx`
  - `FE/src/index.css`
- Reference inputs:
  - `FE/src/pages/AdminConsolePage.tsx`
  - `FE/src/api/adminApi.ts`
  - `FE/src/router/AdminRoute.tsx`
  - `FE/src/router/AppRouter.tsx`
  - `FE/src/router/navigation.ts`
  - `FE/src/types/admin.ts`
  - `BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/marketdata/MarketDataMetrics.java`
  - `BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryService.java`

### Testing Requirements

- Validate admin-only access control for the monitoring surface.
- Validate configured Grafana links or embeds render deterministically and fail gracefully when absent or unavailable.
- Validate stale-state or unavailable-state messaging includes a user-visible last-updated or freshness clue and does not silently show misleading live status.
- Validate operator drill-down actions lead to the correct Grafana panel or relevant admin audit context.
- Validate monitoring additions do not regress Story 7.6 force-logout and audit-search interactions on the same admin surface.

### Previous Story Intelligence

- From Story 7.5:
  - Reuse the canonical admin API contract and do not invent a new admin endpoint for monitoring decoration.
  - Preserve admin identity, audit vocabulary, and rate-limit semantics when linking from anomalies to audit views.
- From Story 7.6:
  - Reuse `AdminRoute`, `AdminConsolePage`, and the existing admin layout and styling rather than splitting a parallel admin page hierarchy.
  - Keep admin UI behavior deterministic for unauthorized access and feedback states.
- From Story 7.7:
  - Do not weaken the channel security posture while adding operator-facing monitoring shortcuts.
  - Keep cookie, CSRF, and admin route protections intact when adding new FE admin navigation.

### Git Intelligence Summary

- Recent repo work is concentrated around Epic 12 planning and implementation-artifact updates. Keep Story 7.8 scoped to FE admin monitoring so it does not interfere with ongoing Epic 12 edits.
- The current FE admin surface already exists in code and tests, so Story 7.8 should be an additive extension rather than a structural rewrite.

### Latest Tech Information

- Grafana docs: panel sharing supports internal links, embeds, and snapshots, but embed support depends on deployment mode and access model. Use internal links by default and treat embed as optional deployment-specific enhancement.
  - Source: [Grafana Share Dashboards and Panels](https://grafana.com/docs/grafana/latest/visualizations/dashboards/share-dashboards-panels/)
- Prometheus docs: `up` is the canonical target-health metric and `scrape_duration_seconds` is emitted per scrape target. These should anchor any freshness or availability hints exposed to operators.
  - Source: [Prometheus Jobs and Instances](https://prometheus.io/docs/concepts/jobs_instances/)

### Project Structure Notes

- No `project-context.md` file was detected in this repository.
- Align with the existing FE admin route and page layout before creating any new files.
- If a separate monitoring component is introduced, keep it under the FE admin page or component tree instead of a cross-cutting observability module.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.8)
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/7-5-admin-session-and-audit-apis.md`
- `_bmad-output/implementation-artifacts/7-6-web-admin-console-screens.md`
- `_bmad-output/implementation-artifacts/7-7-channel-security-hardening.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md`
- `FE/src/pages/AdminConsolePage.tsx`
- `FE/src/router/AdminRoute.tsx`
- `FE/src/router/AppRouter.tsx`
- `FE/src/router/navigation.ts`
- `FE/src/api/adminApi.ts`
- `FE/src/types/admin.ts`
- `BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/marketdata/MarketDataMetrics.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryService.java`

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Backfilled omitted Story 7.8 with FE admin monitoring scope, Grafana integration guardrails, and observability-source constraints.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 7 planning artifact for the omitted Story 7.8 entry.
- Cross-checked against current FE admin console implementation, observability architecture notes, and existing Micrometer metric sources.

### Completion Notes List

- Created Story 7.8 as a lightweight FE admin monitoring follow-on rather than a new full observability product lane.
- Captured Grafana link/embed deployment constraints and Prometheus freshness semantics so implementation does not assume unsupported browser access patterns.
- Anchored the story to the existing `/admin` surface and current admin API contract to prevent duplicate route or backend work.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-8-web-operations-monitoring-dashboard-mvp.md
