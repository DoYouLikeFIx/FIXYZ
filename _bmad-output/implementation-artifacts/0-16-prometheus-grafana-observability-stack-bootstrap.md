# Story 0.16: [OPS][INT] Prometheus/Grafana Observability Stack Bootstrap

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want a repo-owned Prometheus and Grafana stack with provisioned dashboards and stable monitoring URLs,
so that admin monitoring and release smoke checks run against a real observability surface.

## Acceptance Criteria

1. Given the observability profile is enabled, when the compose stack starts, then Prometheus and Grafana containers become healthy with persistent storage and documented local-operator access endpoints.
2. Given Channel, CoreBank, FEP Gateway, and FEP Simulator expose Prometheus metrics, when Prometheus scrapes the compose network, then all required scrape targets are reachable over the internal Docker network and report `UP`.
3. Given the current services use a mix of same-port and separated management ports, when scrape access is wired, then Prometheus can reach canonical `/actuator/prometheus` endpoints without exposing internal management ports on the public edge or host by default.
4. Given Grafana provisioning files are present, when Grafana starts, then the Prometheus datasource and repo-owned operations dashboards are auto-provisioned with stable dashboard UIDs and panel IDs for `executionVolume`, `pendingSessions`, and `marketDataIngest`.
5. Given the monitoring descriptor contract defined in this story, when local or deployed environment templates are generated, then `VITE_ADMIN_MONITORING_PANELS_JSON` resolves to real Grafana links and drill-down URLs instead of placeholders.
6. Given the observability stack is restarted or re-provisioned, when validation and runbook steps are executed, then dashboards, datasource wiring, and recovery guidance remain reproducible with no manual Grafana UI-only setup.

## Tasks / Subtasks

- [x] Provision repo-owned observability services and storage in Docker assets (AC: 1, 2, 3, 6)
  - [x] Add Prometheus and Grafana services, persistent volumes, and an `observability` profile or equivalent opt-in compose wiring that does not weaken the existing public edge contract.
  - [x] Keep operator access deterministic for local development, preferably via loopback-bound host access for Grafana, and avoid publishing internal application management ports on the host by default.
  - [x] Preserve the existing cold-start expectations or document and verify any intentional startup-profile split if observability is not part of the default `docker compose up` path.
- [x] Wire scrape accessibility and security boundaries for all required services (AC: 2, 3)
  - [x] Make CoreBank, FEP Gateway, and FEP Simulator management endpoints reachable from Prometheus on the Docker network without broadening host or edge exposure.
  - [x] Resolve Channel scrape access cleanly by adding the smallest internal-safe allowance for `/actuator/prometheus` or by moving metrics to a dedicated management port with documented security implications.
  - [x] If one of the required monitoring cards lacks a canonical exported series, add the smallest BE-owned Micrometer metric contract needed to make the panel real in this story rather than leaving a dependency gap behind.
- [x] Provision Grafana datasource and dashboard assets from version-controlled files (AC: 1, 4, 5, 6)
  - [x] Add datasource provisioning with stable naming and `prune` semantics so stale datasource entries do not drift across restarts.
  - [x] Add dashboard provisioning YAML and dashboard JSON files with stable dashboard UIDs and panel IDs aligned to the descriptor keys defined below: `executionVolume`, `pendingSessions`, and `marketDataIngest`.
  - [x] Keep dashboard definitions in repo-owned files; do not rely on manual UI-only Grafana configuration as the source of truth.
- [x] Align FE/operator configuration and runbooks to the real observability stack (AC: 5, 6)
  - [x] Add or update root `.env.example`, `FE/.env.example`, and operator docs so the local Grafana base URL and `VITE_ADMIN_MONITORING_PANELS_JSON` contract are reproducible from checked-in assets.
  - [x] Document startup, verification, dashboard URL mapping, and restart/recovery steps in an ops runbook that can be followed without guessing hidden dashboard IDs.
- [x] Add machine-checkable validation for observability bring-up and provisioning (AC: 1, 2, 4, 5, 6)
  - [x] Add a smoke script or automated check that proves Prometheus target health, Grafana health, and dashboard reachability by stable UID.
  - [x] Add a regression proof for restart/idempotency so datasource/dashboard provisioning survives container recreation without manual repair.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` Epic 0.
- This story is a foundation/platform gap-closure. The repository still lacks a real Prometheus/Grafana stack in `docker-compose.yml`, so current monitoring URLs remain placeholder or environment-owned rather than repo-owned.
- Story 7.8 consumes Grafana-backed monitoring in the FE admin surface, and Story 10.4 verifies observability reachability during smoke and rehearsal. This story provides the shared platform dependency both stories need.
- Story 0.9 established the project's preferred bootstrap pattern: repo-owned automation, profile-aware bring-up, runbooks, and machine-checkable outputs. Reuse that style instead of inventing a one-off observability bootstrap flow.
- The monitoring descriptor contract defined below already expects real, safe Grafana URLs through `VITE_ADMIN_MONITORING_PANELS_JSON`. This story should provision dashboard assets and environment documentation that satisfy that exact contract instead of changing FE semantics.

### Monitoring Descriptor Contract

- This story must remain self-contained and produce the exact descriptor contract that FE consumes. Provision Grafana assets and environment examples to match this shape:
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
- Required stable mapping:
  - `executionVolume` -> dashboard/panel provisioned in Grafana + admin audit drill-down `/admin?auditEventType=ORDER_EXECUTE`
  - `pendingSessions` -> dashboard/panel provisioned in Grafana + admin audit drill-down `/admin?auditEventType=ORDER_RECOVERY`
  - `marketDataIngest` -> dashboard/panel provisioned in Grafana + Grafana-only drill-down unless a canonical admin audit shortcut is later defined
- `VITE_ADMIN_MONITORING_PANELS_JSON` examples added by this story must be valid against the FE parser and use safe absolute `http(s)` Grafana URLs plus valid `/admin` drill-down routes.

### Project Structure Notes

- No `project-context.md` file was detected in this repository.
- Current repo structure has no `docker/observability/` subtree and no Prometheus/Grafana services in `/Users/yeongjae/fixyz/docker-compose.yml`, so this story is expected to introduce a new observability asset tree under `docker/` rather than repurpose unrelated directories.
- Keep observability assets parallel to existing repo-owned infrastructure patterns:
  - `docker/nginx/**` for edge
  - `docker/vault/**` for secrets/bootstrap
  - `docker/observability/**` for Prometheus/Grafana provisioning
- FE already owns the monitoring descriptor parser and `/admin` rendering path. Do not duplicate dashboard mapping logic in a second FE-only config module; provision real dashboard IDs and document the env contract instead.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Added a canonical Epic 0 foundation story to provision a real Prometheus/Grafana baseline that satisfies Story 7.8 monitoring URLs and Story 10.4 observability smoke requirements.

### Technical Requirements

- Provision the observability stack in repo-owned Docker assets. Prefer an opt-in `observability` profile or equivalent overlay if that is the safest way to preserve existing cold-start and exposure guarantees. If default enablement is chosen instead, document and prove that the change does not violate the architecture cold-start target.
- Prometheus must scrape internal Docker-network endpoints only. FE/browser code must continue to treat Grafana as the operator-facing metrics surface and must not query Prometheus directly.
- Current runtime constraint: `corebank-service`, `fep-gateway`, and `fep-simulator` set `management.server.address: 127.0.0.1`, which blocks a separate Prometheus container from scraping their management ports over the Docker network. The story must resolve this without publishing those management ports to the host or the public edge.
- Current runtime constraint: `channel-service` keeps `/actuator/**` admin-only in `ChannelSecurityPaths`, while the downstream admin monitoring consumer and architecture guidance assume Prometheus-backed metrics are available to internal scraping. Any scrape access change must be minimal and explicit; do not broaden all actuator endpoints just to make Prometheus work.
- Grafana must be provisioned entirely from version-controlled files:
  - datasource provisioning with stable datasource naming and cleanup semantics
  - dashboard provisioning from checked-in files with stable dashboard UIDs
  - panel IDs that match the descriptor mapping defined in this story for `executionVolume`, `pendingSessions`, and `marketDataIngest`
- If one of the required panels cannot be backed by an existing exported metric, do not leave placeholder panels behind. Add the smallest BE-owned Micrometer metric contract required to make the panel real in this story.
- Keep scope lean:
  - do not add Alertmanager routing or notification policy in this story
  - do not add Loki, Tempo, or broader LGTM stack expansion
  - do not replace the descriptor contract defined in this story with hard-coded FE constants
  - do not rely on manual Grafana UI editing as the only source of truth

### Architecture Compliance

- Respect `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md` RULE-068: Prometheus is an internal scrape target and Grafana is the single metrics source for operator visualization.
- Preserve the current network posture from architecture and compose:
  - `edge-gateway:80/443` are the public-edge ports
  - `channel-service:8080` remains the current dev convenience surface
  - `corebank-service:8081`, `fep-simulator:8082`, and `fep-gateway:8083` stay internal-only application ports
  - observability access must not create new public-edge exposure of internal management ports
- Reuse the existing Docker network (`fix-net`) and repo bootstrap conventions instead of adding an unrelated standalone observability deployment path.
- Keep the downstream admin monitoring consumer additive. This story should provide real infrastructure and documented URLs; it should not refactor the FE admin route structure or monitoring card semantics.

### Library / Framework Requirements

- Prometheus official docs confirm that configuration is driven by flags plus a configuration file, and config reload via `/-/reload` requires the `--web.enable-lifecycle` flag. Only enable lifecycle reload if the implementation actually uses it.
- Prometheus official docs define jobs and instances as the scrape configuration model. Use explicit, stable job names for Channel, CoreBank, FEP Gateway, and FEP Simulator so dashboard queries and smoke checks do not depend on brittle implicit labels.
- Grafana official docs recommend persistent storage for Docker-based deployments. Use pinned official Docker images and persistent volumes instead of ephemeral throwaway state for the dashboard baseline.
- Grafana official docs support provisioning data sources and dashboards from files. Prefer repo-owned provisioning with stable UIDs over manual import flows, and keep committed JSON/YAML assets authoritative.

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/docker-compose.yml`
  - `/Users/yeongjae/fixyz/.env.example`
  - `/Users/yeongjae/fixyz/FE/.env.example`
  - `/Users/yeongjae/fixyz/FE/README.md`
  - `/Users/yeongjae/fixyz/docs/ops/infrastructure-bootstrap-runbook.md` or a new adjacent observability runbook under `/Users/yeongjae/fixyz/docs/ops/`
  - `/Users/yeongjae/fixyz/docker/observability/prometheus/**`
  - `/Users/yeongjae/fixyz/docker/observability/grafana/**`
  - `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityConfig.java`
  - `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java`
  - `/Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/BE/fep-simulator/src/main/resources/application.yml`
  - optional bootstrap or validation scripts under `/Users/yeongjae/fixyz/scripts/**` if the team chooses machine-checkable bring-up helpers
- Reference inputs:
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-8-web-operations-monitoring-dashboard-mvp.md`
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/10-4-full-stack-smoke-and-rehearsal.md`
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-9-additional-infrastructure-bootstrap.md`
  - `/Users/yeongjae/fixyz/docker-compose.yml`
  - `/Users/yeongjae/fixyz/BE/channel-service/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/BE/fep-simulator/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/FE/src/types/adminMonitoring.ts`
  - `/Users/yeongjae/fixyz/FE/src/pages/AdminConsolePage.tsx`
  - `/Users/yeongjae/fixyz/BE/docs/testing/corebank-position-lock-observability.md`

### Testing Requirements

- Minimum validation for completion:
  - `docker compose config` succeeds with the observability additions
  - observability bring-up succeeds with the intended profile or compose path
  - Prometheus target health proves the required services are `UP`
  - Grafana health and dashboard provisioning can be verified by stable dashboard UID
  - the committed panel IDs and dashboard UIDs match the `VITE_ADMIN_MONITORING_PANELS_JSON` contract defined in this story and consumed by Story 7.8
  - restart or reprovision keeps datasource/dashboard state reproducible without manual UI repair
- Add at least one security regression proof around Channel actuator exposure so the scrape fix does not accidentally open the broader `/actuator/**` surface.
- Add at least one validation that the operator docs are executable as written, either through a smoke script, shell-based check, or an automated test harness similar in spirit to Story 0.9 bootstrap validation.

### Previous Story Intelligence

- From Story 7.8:
  - The FE contract already expects real Grafana URLs, dashboard UIDs, panel IDs, freshness metadata, and drill-down URLs through `VITE_ADMIN_MONITORING_PANELS_JSON`.
  - Story 7.8 explicitly forbids FE-owned monitoring semantics and direct Prometheus browser access. This infrastructure story must therefore make the real Grafana surface available rather than shifting more responsibility into FE.
- From Story 0.9:
  - Reuse the existing bootstrap/runbook pattern of idempotent commands, documented profiles, and machine-checkable validation outputs.
  - Keep infrastructure setup deterministic and repo-owned rather than relying on undocumented local workstation state.

### Git Intelligence Summary

- Recent repo history already introduced Story 7.8 and its descriptor-based monitoring contract. Keep this story scoped to infrastructure, provisioning, security wiring, and operator documentation so it complements that work instead of reworking it.
- Ongoing repo work also touches DMZ and release-readiness artifacts. Avoid changing edge exposure rules or release-pack semantics beyond the observability baseline needed for this story.
- This story should be implementable even if the developer reads only this file. Keep any required panel-key mapping, descriptor shape, and dashboard expectations here instead of assuming the developer will cross-reference Story 7.8 line by line.

### Latest Tech Information

- Grafana Docker docs currently document the official Docker images, persistent storage, and compose-based startup. Use pinned official images with persistent volumes instead of floating tags or ephemeral state.
  - Source: [Grafana Run Grafana Docker Image](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/)
- Grafana provisioning docs currently document file-based datasource and dashboard provisioning, `prune: true` for datasource cleanup, stable dashboard UID behavior, and the importance of committed provisioning files for reproducibility.
  - Source: [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- Prometheus docs currently state that scrape jobs and instances are configured in the YAML configuration file, and config reload through `/-/reload` is gated behind `--web.enable-lifecycle`.
  - Source: [Prometheus Configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- Prometheus docs currently define `up` as the canonical per-target health signal. Use that signal for smoke checks and freshness-oriented validation rather than inventing custom target-health semantics.
  - Source: [Prometheus Jobs and Instances](https://prometheus.io/docs/concepts/jobs_instances/)

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.16, Epic 7 Story 7.8, Epic 10 Story 10.4)
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-8-web-operations-monitoring-dashboard-mvp.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/10-4-full-stack-smoke-and-rehearsal.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-9-additional-infrastructure-bootstrap.md`
- `/Users/yeongjae/fixyz/docker-compose.yml`
- `/Users/yeongjae/fixyz/.env.example`
- `/Users/yeongjae/fixyz/FE/.env.example`
- `/Users/yeongjae/fixyz/FE/README.md`
- `/Users/yeongjae/fixyz/FE/src/types/adminMonitoring.ts`
- `/Users/yeongjae/fixyz/FE/src/pages/AdminConsolePage.tsx`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityConfig.java`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/resources/application.yml`
- `/Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application.yml`
- `/Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application.yml`
- `/Users/yeongjae/fixyz/BE/fep-simulator/src/main/resources/application.yml`
- `/Users/yeongjae/fixyz/BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/marketdata/MarketDataMetrics.java`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionRecoveryService.java`
- `/Users/yeongjae/fixyz/BE/docs/testing/corebank-position-lock-observability.md`
- [Grafana Run Grafana Docker Image](https://grafana.com/docs/grafana/latest/setup-grafana/installation/docker/)
- [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- [Prometheus Configuration](https://prometheus.io/docs/prometheus/latest/configuration/configuration/)
- [Prometheus Jobs and Instances](https://prometheus.io/docs/concepts/jobs_instances/)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Added an opt-in `observability` compose profile with repo-owned Prometheus/Grafana services, persistent volumes, provisioning mounts, loopback-bound operator ports, and stable runtime health checks.
- Added repo-owned Grafana datasource/dashboard provisioning plus a generator that emits a valid `VITE_ADMIN_MONITORING_PANELS_JSON` contract for Story 7.8 from stable dashboard UID and panel IDs.
- Added a validation script that checks compose config, Prometheus target health, Grafana health, dashboard reachability by UID, generated panel-link safety, and internal-only management-port exposure constraints.
- Added minimal backend metric wiring for `channel.order.execution.completed` and `channel.order.sessions.recovery.backlog`, and confirmed existing market-data metrics satisfy the third monitoring card.
- Resolved the channel scrape blocker by exposing only `/actuator/prometheus` as a public management endpoint while preserving the broader `/actuator/**` admin-only posture.
- While validating live bring-up, discovered and repaired a pre-existing local bootstrap gap: `scripts/infra-bootstrap/repair-service-databases.sh` was a directory, not an executable script, which broke `mysql-grant-repair` during compose startup.

### Completion Notes List

- Runtime observability bring-up now succeeds with `COMPOSE_PROFILES=observability`, and the validator confirms all required Prometheus targets are `UP`, Grafana is healthy, and the provisioned dashboard UID is reachable.
- FE/operator contract is reproducible from checked-in assets through `.env.example`, `FE/.env.example`, `FE/README.md`, the generator script, and the new observability runbook.
- Regression coverage now includes static observability contract tests, runtime validator coverage, a dedicated `ChannelSecurityPathsTest`, and infra baseline tests that prove MySQL repair-script compatibility.
- Story 7.8 can now be pointed at a real repo-owned Grafana surface instead of placeholders once the generated descriptor is placed in the target environment.

### File List

- /Users/yeongjae/fixyz/.env.example
- /Users/yeongjae/fixyz/docker-compose.yml
- /Users/yeongjae/fixyz/package.json
- /Users/yeongjae/fixyz/FE/.env.example
- /Users/yeongjae/fixyz/FE/README.md
- /Users/yeongjae/fixyz/BE/channel-service/src/main/resources/application.yml
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application.yml
- /Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application.yml
- /Users/yeongjae/fixyz/BE/fep-simulator/src/main/resources/application.yml
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/repository/OrderSessionRepository.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionMonitoringMetrics.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/config/ChannelSecurityPathsTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionMonitoringMetricsTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/compliance/LogPiiComplianceTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- /Users/yeongjae/fixyz/docker/observability/prometheus/prometheus.yml
- /Users/yeongjae/fixyz/docker/observability/grafana/provisioning/datasources/datasource.yaml
- /Users/yeongjae/fixyz/docker/observability/grafana/provisioning/dashboards/dashboard-provider.yaml
- /Users/yeongjae/fixyz/docker/observability/grafana/dashboards/ops-monitoring-overview.json
- /Users/yeongjae/fixyz/scripts/observability/generate-monitoring-panels.mjs
- /Users/yeongjae/fixyz/scripts/observability/validate-observability-stack.sh
- /Users/yeongjae/fixyz/scripts/infra-bootstrap/repair-service-databases.sh
- /Users/yeongjae/fixyz/tests/observability/observability-baseline.test.js
- /Users/yeongjae/fixyz/tests/observability/observability-runtime.test.js
- /Users/yeongjae/fixyz/docs/ops/observability-stack-runbook.md
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-16-prometheus-grafana-observability-stack-bootstrap.md

### Change Log

- Added repo-owned Prometheus/Grafana stack provisioning, dashboard assets, generator/validator tooling, and operator documentation for observability bootstrap.
- Added backend metric and security wiring needed for live Prometheus scraping, including a narrow channel-service `/actuator/prometheus` allowance.
- Repaired the MySQL grant-repair bootstrap script discovered during live compose validation so the observability profile can start cleanly end to end.
