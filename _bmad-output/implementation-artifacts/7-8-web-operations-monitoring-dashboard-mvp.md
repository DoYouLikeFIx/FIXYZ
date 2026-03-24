# Story 7.8: [FE][CH] Operations Monitoring Dashboard MVP

Status: done

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

- [x] Extend the existing admin FE surface with a monitoring section or route (AC: 1, 3, 4)
  - [x] Reuse `AdminRoute`, the existing `/admin` entry point, and the current `AdminConsolePage` shell instead of introducing a separate admin security model.
  - [x] Decide whether the monitoring MVP lives as a third panel in `AdminConsolePage` or as a nested admin route under the same guard, and keep drill-down navigation consistent with current admin UX.
- [x] Add config-driven Grafana panel integration for the fixed MVP metrics (AC: 1, 4)
  - [x] Wire environment-safe Grafana URLs or panel descriptors for execution volume, pending session count, and market-data ingest status.
  - [x] Standardize on one FE config contract (`VITE_ADMIN_MONITORING_PANELS_JSON`) so panel URLs, embed capability, freshness behavior, and drill-down targets are declared together instead of scattered hard-coded constants.
  - [x] Reuse signed internal links as the default integration shape and allow iframe embed only when the target Grafana deployment and access model support it.
  - [x] Expose operator drill-down actions that open the relevant Grafana panel or focus the related admin audit view without inventing a new backend admin API.
- [x] Implement freshness and unavailable-state handling for operations review (AC: 2)
  - [x] Render stale or unavailable messaging and last-updated metadata from Prometheus or Grafana freshness signals rather than custom FE heuristics.
  - [x] Treat Grafana-backed freshness metadata as the single source of truth. Do not derive "live" or "stale" labels from browser timers, local polling intervals, or FE-only age calculations.
  - [x] Keep the dashboard useful when panel config is missing or the observability stack is unavailable by showing deterministic guidance instead of a broken blank state.
- [x] Add regression coverage for admin-only monitoring behavior (AC: 1, 2, 3, 4)
  - [x] Add FE tests for admin guard enforcement, configured panel rendering, stale-state messaging, unavailable-state handling, and drill-down navigation.
  - [x] Add one integration-level proof that the monitoring MVP coexists with the existing force-logout and audit-search admin console behavior.

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
  - Freshness source of truth must be Grafana-backed panel metadata or a companion Grafana freshness panel that is itself derived from Prometheus scrape signals such as `up` / scrape-health. FE must not synthesize freshness from `Date.now()` or refresh cadence.
- Scope guardrails:
  - Execution volume and pending-session panels must consume existing or pre-provisioned observability signals. If the required metric contract is missing, capture it as an explicit dependency gap instead of inventing a shadow metric in FE.
  - The existing admin APIs remain canonical:
    - `GET /api/v1/admin/audit-logs`
    - `DELETE /api/v1/admin/members/{memberUuid}/sessions`
  - Story 7.8 must not create a second admin backend contract just to support dashboard chrome.
  - If Ops cannot provide Grafana panel descriptors that satisfy AC 1 / AC 2, stop at an explicit dependency-gap note rather than silently inventing FE-owned monitoring semantics.
- Suggested FE configuration contract:
  - Add explicit Vite env typing for `VITE_ADMIN_MONITORING_PANELS_JSON`.
  - Keep Grafana link or embed URLs out of hard-coded component markup.
  - Use one JSON env contract with this shape:
    ```ts
    type AdminMonitoringPanelKey =
      | 'executionVolume'
      | 'pendingSessions'
      | 'marketDataIngest';

    type AdminMonitoringPanelDescriptor = {
      key: AdminMonitoringPanelKey;
      title: string;
      description: string;
      mode: 'link' | 'embed';
      linkUrl: string;
      embedUrl?: string;
      dashboardUid: string;
      panelId: number;
      sourceMetricHint: string;
      freshness: {
        source: 'grafana-panel' | 'grafana-companion-panel';
        indicatorLabel: string;
        lastUpdatedLabel: string;
        companionPanelUrl?: string;
      };
      drillDown: {
        grafanaUrl: string;
        adminAuditUrl?: string;
      };
    };
    ```
  - Required descriptor keys:
    - `executionVolume`
    - `pendingSessions`
    - `marketDataIngest`
  - FE must treat missing env, invalid JSON, or incomplete descriptors as a deterministic configuration-unavailable state, not a render crash.
  - `mode='link'` is the default safe deployment mode. `mode='embed'` is allowed only when the target Grafana deployment explicitly supports embedding for the operator access model.
  - AC 2 is satisfied only when the descriptor's `freshness` block points to a Grafana-backed source that exposes stale/live semantics and a visible last-updated label.

### Drill-down Mapping Contract

- Use fixed anomaly-to-drill-down mapping so operators do not guess where each card leads:
  - `executionVolume`
    - Grafana drill-down: execution-volume panel descriptor `grafanaUrl`
    - Admin shortcut: `/admin?auditEventType=ORDER_EXECUTE`
  - `pendingSessions`
    - Grafana drill-down: pending-sessions panel descriptor `grafanaUrl`
    - Admin shortcut: `/admin?auditEventType=ORDER_RECOVERY`
  - `marketDataIngest`
    - Grafana drill-down: market-data-ingest panel descriptor `grafanaUrl`
    - Admin shortcut: omit when no canonical admin audit view exists; do not invent a fake audit filter
- Reuse the existing `/admin` route for audit drill-down prefills instead of creating a separate monitoring-only admin path.
- Audit-prefill navigation is FE-owned routing glue only; it must still load data through the canonical `GET /api/v1/admin/audit-logs` contract.

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
- Validate stale-state or unavailable-state messaging uses the descriptor-declared Grafana freshness source and includes a user-visible last-updated or freshness clue without FE-derived timer heuristics.
- Validate operator drill-down actions lead to the correct Grafana panel or relevant admin audit context using the fixed anomaly mapping:
  - `executionVolume` -> Grafana panel + `/admin?auditEventType=ORDER_EXECUTE`
  - `pendingSessions` -> Grafana panel + `/admin?auditEventType=ORDER_RECOVERY`
  - `marketDataIngest` -> Grafana panel only unless a canonical admin audit target is later defined
- Validate monitoring additions do not regress Story 7.6 force-logout and audit-search interactions on the same admin surface.
- Validate invalid or partial `VITE_ADMIN_MONITORING_PANELS_JSON` config yields deterministic guidance instead of blank cards or uncaught exceptions.

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

- Status set to `done` after follow-up fixes and a clean second senior developer review pass.
- Completion note: Backfilled omitted Story 7.8 with FE admin monitoring scope, explicit Grafana panel config contract, fixed drill-down mapping, and observability-source constraints.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical Epic 7 planning artifact for the omitted Story 7.8 entry.
- Cross-checked against current FE admin console implementation, observability architecture notes, and existing Micrometer metric sources.
- Implemented monitoring descriptors, audit-query drill-down helpers, and admin console UI extensions in the existing FE `/admin` surface.
- Validation completed with `pnpm -C FE type-check`, `pnpm -C FE test -- --runInBand`, and `pnpm -C FE lint`.

### Completion Notes List

- Created Story 7.8 as a lightweight FE admin monitoring follow-on rather than a new full observability product lane.
- Captured Grafana link/embed deployment constraints, explicit FE panel-descriptor config, fixed anomaly drill-down mapping, and Prometheus-backed freshness semantics so implementation does not assume unsupported browser access patterns.
- Anchored the story to the existing `/admin` surface and current admin API contract to prevent duplicate route or backend work.
- Added a config-driven monitoring section to `AdminConsolePage` with Grafana open/drill-down actions, freshness metadata rendering, and deterministic placeholder guidance for missing or invalid panel config.
- Reused the existing `/admin` route guard and audit API by introducing query-param-based audit drill-down shortcuts instead of adding a new backend admin contract.
- Added unit and integration coverage to prove monitoring cards coexist with force-logout and audit-search workflows and updated the shared axios test harness to record serialized query params.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-8-web-operations-monitoring-dashboard-mvp.md
- /Users/yeongjae/fixyz/FE/src/index.css
- /Users/yeongjae/fixyz/FE/playwright.config.ts
- /Users/yeongjae/fixyz/FE/e2e/admin-monitoring.spec.ts
- /Users/yeongjae/fixyz/FE/src/pages/AdminConsolePage.tsx
- /Users/yeongjae/fixyz/FE/src/router/navigation.ts
- /Users/yeongjae/fixyz/FE/src/types/admin.ts
- /Users/yeongjae/fixyz/FE/src/types/adminMonitoring.ts
- /Users/yeongjae/fixyz/FE/src/vite-env.d.ts
- /Users/yeongjae/fixyz/FE/tests/fixtures/mockAxiosModule.ts
- /Users/yeongjae/fixyz/FE/tests/integration/admin-console-monitoring-support.test.tsx
- /Users/yeongjae/fixyz/FE/tests/unit/pages/AdminConsolePage.test.tsx
- /Users/yeongjae/fixyz/FE/tests/unit/types/adminMonitoring.test.ts
- /Users/yeongjae/fixyz/FE/tests/unit/router/AdminRoute.test.tsx
- /Users/yeongjae/fixyz/FE/tests/unit/router/navigation.test.ts
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-24: Implemented the FE operations monitoring dashboard MVP on the existing `/admin` console, added config-driven Grafana panel support plus audit drill-down shortcuts, expanded admin regression coverage, and moved story status to `review`.
- 2026-03-24: Senior developer code review requested changes, recorded three functional/contract findings, and moved story status to `in-progress`.
- 2026-03-24: Fixed the review findings by honoring descriptor-driven audit drill-downs, enforcing freshness/url config contracts, adding parser regression tests, and moving story status to `done`.
- 2026-03-24: QA automation pass added Playwright admin-monitoring E2E coverage, stabilized Playwright monitoring config for deterministic FE browser runs, and refreshed the shared QA summary artifact.

## QA Update - 2026-03-24

- Automated QA completed for Story 7.8 admin monitoring route coverage, monitoring-card rendering, audit drill-down behavior, and admin-route access blocking.
- Added browser-level coverage in `/Users/yeongjae/fixyz/FE/e2e/admin-monitoring.spec.ts`.
- Stabilized Playwright runtime config for this story by injecting a deterministic monitoring panel descriptor fixture in `/Users/yeongjae/fixyz/FE/playwright.config.ts`.
- Verified the new Playwright suite passes against the FE Vite server with mocked admin/auth contracts.
- QA outcome: pass

## Senior Developer Review (AI)

### Reviewer

- yeongjae

### Outcome

- Changes requested

### Git / Story Notes

- Story File List matched the reviewed FE change set.
- Repository root also has unrelated dirty entries in `BE` and `MOB`; they were excluded from this story review.
- No `project-context.md` file was present.

### Findings

1. `FE/src/pages/AdminConsolePage.tsx`: the monitoring audit drill-down handler updates the URL from `drillDown.adminAuditUrl` but then overwrites the actual filter state with the hard-coded fallback event type for `executionVolume` and `pendingSessions`. If Ops changes the descriptor target, the URL and fetched audit results can diverge.
2. `FE/src/types/adminMonitoring.ts`: the descriptor parser accepts `freshness.status` and `freshness.lastUpdatedAt` as optional, so a config can be marked `ready` even though AC2 requires a visible stale/live indicator and last-updated timestamp.
3. `FE/src/types/adminMonitoring.ts`: Grafana/admin URLs are validated only as non-empty strings. Malformed or unsafe values can pass config parsing and then be rendered directly into `href` / `iframe src`, which breaks the "environment-safe" contract and can cause runtime failures.

### Validation Evidence

- `pnpm -C FE type-check`
- `pnpm -C FE test -- --runInBand`
- `pnpm -C FE lint`

### Follow-up Review (Round 2)

- Outcome: Approved
- Result: No remaining HIGH or MEDIUM findings after re-review.
- Resolved:
  - Audit drill-down now prefers the descriptor-declared admin target before falling back to the canonical panel mapping.
  - Monitoring config now requires explicit freshness status and timestamp fields before a panel can enter the `ready` state.
  - Grafana/admin URLs are validated as safe absolute http(s) URLs or `/admin` drill-down routes with valid audit event types.
- Validation evidence:
  - `pnpm -C FE type-check`
  - `pnpm -C FE test -- --runInBand`
  - `pnpm -C FE lint`
