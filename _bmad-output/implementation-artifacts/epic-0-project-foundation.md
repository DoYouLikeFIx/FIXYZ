# Epic 0: Foundation & Shared Platform

## Sync Note

This document is synchronized to `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0 section) and is the execution companion for Story 0.1 through Story 0.12.

Primary source of truth for story decomposition remains `epics.md`.

---

## Summary

Epic 0 establishes the common platform foundation required before feature epics:

- Backend multi-module baseline and runtime topology
- Test and CI foundations for deterministic validation
- Web and mobile scaffolds aligned to backend contracts
- Team collaboration notification baseline (GitHub/Jira -> MatterMost)
- Shared platform infrastructure hardening for edge, secrets, and data availability
- Supply-chain security and operational self-healing baselines for release safety

---

## Story 0.1: [BE][CH] Core Platform Baseline

As a **backend engineer**,  
I want a stable multi-module platform baseline,  
So that all system lanes can build on a consistent runtime and coding contract.

### Acceptance Criteria

- **Given** a clean checkout  
  **When** `./gradlew build` runs  
  **Then** all backend modules compile without error.
- **Given** docker compose setup files  
  **When** `docker compose up` is executed  
  **Then** channel/corebank/fep-gateway/fep-simulator services become healthy.
- **Given** Flyway configuration for channel/corebank schemas  
  **When** services start  
  **Then** baseline migrations and local/test seed data run without error.
- **Given** internal service boundaries  
  **When** internal endpoint is called without secret header  
  **Then** request is blocked by scaffold filter.
- **Given** common error contract requirement  
  **When** API exception occurs  
  **Then** standardized error schema is returned.
- **Given** local developer visibility requirements  
  **When** `docker-compose.override.yml` is applied  
  **Then** MySQL/Redis/internal service ports are reachable for local tools only.
- **Given** SpringDoc build-time generation is configured for channel/corebank/fep-gateway/fep-simulator services  
  **When** `generateOpenApiDocs` tasks run  
  **Then** each service outputs a valid OpenAPI 3.0 JSON artifact.
- **Given** a merge to `main` with backend CI passing  
  **When** `docs-publish.yml` completes  
  **Then** GitHub Pages (`https://<org>.github.io/<repo>/`) is the canonical API docs endpoint and renders Channel/CoreBank/FEP Gateway/FEP Simulator selectors from latest generated specs.
- **Given** first deployment on a repository without Pages source configuration  
  **When** initial docs publish run completes  
  **Then** one-time Pages source setup (`gh-pages` / root) is completed and recorded in ops runbook.

---

## Story 0.2: [BE][CH] Test & CI Foundation

As a **platform engineer**,  
I want reproducible test and CI baselines,  
So that feature teams can ship with deterministic validation.

**Depends On:** Story 0.1

### Acceptance Criteria

- **Given** Testcontainers base classes  
  **When** integration tests execute  
  **Then** MySQL/Redis test resources spin up deterministically.
- **Given** WireMock dependency policy  
  **When** contract test stubs are compiled  
  **Then** test module resolves all required classes.
- **Given** CI split workflow design in BE repository workflows (`BE/.github/workflows`)  
  **When** push/PR occurs  
  **Then** service-scoped pipelines execute independently.
- **Given** failed quality check  
  **When** pipeline runs  
  **Then** merge is blocked by status check in BE repository branch protection.

---

## Story 0.3: [FE] Frontend Foundation Scaffold

As a **frontend engineer**,  
I want a standardized web scaffold and API client,  
So that product UI features can be implemented consistently.

**Depends On:** Story 0.1

### Acceptance Criteria

- **Given** Vite + TypeScript scaffold  
  **When** local dev server runs  
  **Then** build and HMR work without runtime error.
- **Given** API base URL configuration  
  **When** client requests backend health endpoint  
  **Then** call succeeds via configured proxy/baseURL.
- **Given** path alias convention  
  **When** imports use alias paths  
  **Then** compile and runtime resolution both succeed.
- **Given** shared error interceptor policy  
  **When** backend returns standard error schema  
  **Then** web layer parses and displays normalized message.

---

## Story 0.4: [MOB] Mobile Foundation Scaffold

As a **mobile engineer**,  
I want a standardized mobile scaffold and API layer,  
So that mobile features follow the same contract and architecture.

**Depends On:** Story 0.1

### Acceptance Criteria

- **Given** mobile project scaffold  
  **When** project is built and launched  
  **Then** baseline app runs on target simulator/device.
- **Given** env-based API config  
  **When** mobile calls backend health endpoint  
  **Then** request succeeds against host matrix (`Android emulator=http://10.0.2.2:8080`, `iOS simulator=http://localhost:8080`, `physical device=http://<LAN_IP>:8080`) with `GET /actuator/health` HTTP 200 within 5s.
- **Given** common network module  
  **When** API errors occur  
  **Then** mobile receives parsed standardized error payload.
- **Given** server-side cookie session policy  
  **When** session is issued  
  **Then** mobile persists no raw credentials/password/OTP in app storage and uses OS-approved secure storage controls for any sensitive client-side secret material.
- **Given** cookie-session + CSRF contract for state-changing API calls  
  **When** mobile sends non-GET request  
  **Then** client includes credentials and `X-XSRF-TOKEN` header derived from `XSRF-TOKEN` cookie after explicit CSRF bootstrap/refresh (`GET /api/v1/auth/csrf`) on app start/login/resume.
- **Given** foundation CI runs bundle-only checks  
  **When** PR is prepared for merge  
  **Then** AC1 is satisfied only after manual simulator/device smoke evidence (boot log/screenshot + health-call capture) is attached in PR checklist.

---

## Story 0.5: [BE][CH] Collaboration Webhook Notifications (MatterMost + Jira + GitHub)

As a **delivery team**,  
I want Jira and GitHub webhook events delivered to MatterMost,  
So that release/quality state is visible in real time without manual polling.

**Depends On:** Story 0.2  
**Implementation Decision:** Option 1 (Direct integration: `GitHub Actions + Jira Automation -> MatterMost webhook`, no central relay)

### Acceptance Criteria

- **Given** GitHub webhook events (`pull_request`, `workflow_run`)  
  **When** GitHub Actions workflow posts to MatterMost incoming webhook  
  **Then** MatterMost receives standardized notifications with repository, actor, link, and result.
- **Given** Jira webhook events for issue lifecycle transitions  
  **When** Jira Automation rule sends transition event to MatterMost webhook  
  **Then** MatterMost receives issue key, summary, previous/new status, and assignee context.
- **Given** webhook secrets and integration endpoints  
  **When** runtime configuration is applied  
  **Then** credentials are managed only via GitHub Secrets and Jira secured webhook settings (no hardcoding).
- **Given** duplicate delivery or retry from source systems  
  **When** normalized dedupe key `source + source_project + target_channel + event_type + entity_id + normalized_target_status + normalized_actor` (`null`/missing -> `_`) or source event id (`delivery_id`/equivalent) repeats within source suppression window (`GitHub=10m`, `Jira=10m`)  
  **Then** duplicated user-visible posts are suppressed.
- **Given** direct integration architecture (no central relay)  
  **When** dedupe state is persisted  
  **Then** source-specific dedupe contract is explicit and auditable (`GitHub`: Actions cache key `mm-dedupe-{dedupe_hash}-{window_bucket_10m}` where `window_bucket_10m=floor(event_epoch/600)`; `Jira`: entity/property `mm_last_hash` + `mm_last_ts` with 10-minute timestamp comparison).
- **Given** outbound posting failure to MatterMost  
  **When** network timeout or non-2xx response occurs  
  **Then** source retry policy executes with bounded retries (`max_attempts=3`) using source-specific backoff contract (`GitHub`: `2s`,`5s` + jitter `±20%`; `Jira`: fixed `2s`,`5s` without jitter due platform limits), per-source+per-entity ordering guard, and final failure visibility in run/audit logs.
- **Given** reliability validation runbook execution  
  **When** duplicate and failure scenarios are replayed  
  **Then** evidence artifacts are indexed under `docs/ops/webhook-validation/<YYYYMMDD>/` with reproducible naming and enforced retention configuration (`>=90 days`).

---

## Story 0.6: [BE][FE][MOB][CH] Multi-Repo Collaboration Webhook Rollout

As a **delivery platform engineer**,  
I want collaboration webhook notifications rolled out to all FIX repositories,  
So that release and quality visibility is consistent across root, backend, frontend, and mobile repositories.

**Depends On:** Story 0.5

### Acceptance Criteria

- **Given** repository topology includes `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, and `FIXYZ-MOB`  
  **When** rollout is complete  
  **Then** each repository has a repository-local GitHub->MatterMost workflow for PR/workflow events.
- **Given** secure runtime configuration  
  **When** workflows are configured  
  **Then** `MATTERMOST_WEBHOOK_URL` is configured per repository secret and never hardcoded.
- **Given** channel routing requirements  
  **When** variable configuration is applied  
  **Then** each repository can independently set `MATTERMOST_CHANNEL_KEY` without code edits.
- **Given** reliability contracts from Story 0.5  
  **When** notifications are posted from each repository  
  **Then** dedupe/retry/failure-observability behavior remains contract-compatible.
- **Given** per-repository validation runs  
  **When** duplicate and failure scenarios are replayed in each repository  
  **Then** repository-scoped evidence is indexed under `docs/ops/webhook-validation/<YYYYMMDD>/`.

---

## Story 0.7: [BE][CH] Edge Gateway Baseline (Nginx)

As a **platform engineer**,  
I want a reverse-proxy edge baseline using Nginx,  
So that TLS termination, upstream routing, and security headers are managed consistently.

**Depends On:** Story 0.1

### Acceptance Criteria

- **Given** edge proxy option decision (`Nginx`)  
  **When** Epic 0 edge baseline is finalized  
  **Then** a documented ADR records selected option, rationale, and operational trade-offs.
- **Given** external traffic enters through edge proxy  
  **When** requests are routed  
  **Then** channel/corebank/fep-gateway/fep-simulator routes are forwarded by explicit upstream rules.
- **Given** TLS and security baseline requirements  
  **When** edge config is applied  
  **Then** HTTPS termination, HSTS, and baseline security headers are enforced.
- **Given** edge failure scenarios  
  **When** upstream is unhealthy  
  **Then** health-check and deterministic error responses are observable in logs/metrics.

---

## Story 0.8: [BE][CH] Vault Secrets Foundation

As a **platform engineer**,  
I want Vault-based secret management baseline,  
So that infrastructure and application secrets are centrally controlled with auditable access.

**Depends On:** Story 0.1

### Acceptance Criteria

- **Given** secret management policy  
  **When** Vault baseline is configured  
  **Then** app/infrastructure secrets are sourced from Vault paths rather than hardcoded or committed files.
- **Given** CI/CD and runtime authentication needs  
  **When** service identity is configured  
  **Then** Vault access uses short-lived auth mechanisms and least-privilege policies.
- **Given** secret rotation requirement  
  **When** rotation drill is executed  
  **Then** at least one critical secret is rotated without service outage.
- **Given** audit requirements  
  **When** secret read/write happens  
  **Then** Vault audit logs provide traceable access records.

---

## Story 0.9: [BE][CH] Additional Infrastructure Bootstrap

As a **platform engineer**,  
I want reproducible infrastructure bootstrap automation,  
So that dev/staging foundations can be provisioned consistently.

**Depends On:** Story 0.7, Story 0.8

### Acceptance Criteria

- **Given** infrastructure baseline scope  
  **When** bootstrap scripts/IaC are executed  
  **Then** required shared components (network, ingress, cache, message/event utilities if needed) are provisioned reproducibly.
- **Given** environment drift risk  
  **When** bootstrap validation runs  
  **Then** configuration parity checks detect missing or divergent components.
- **Given** onboarding requirements  
  **When** a new engineer follows runbook  
  **Then** environment bootstrap succeeds using documented commands only.

---

## Story 0.10: [AC][CH] Database High Availability and Replication Baseline

As a **platform engineer**,  
I want a database replication baseline,  
So that data services remain available under single-node failure and read load can be distributed.

**Depends On:** Story 0.9

### Acceptance Criteria

- **Given** primary-replica architecture baseline  
  **When** database topology is provisioned  
  **Then** replication is healthy and lag is observable with alert thresholds.
- **Given** application read/write contract  
  **When** runtime configuration is applied  
  **Then** writes are pinned to primary and read-routing strategy is explicit/documented.
- **Given** failover drill scenario  
  **When** primary node is simulated unavailable  
  **Then** recovery procedure and measured targets (`RTO <= 300s`, `RPO <= 60s`) are captured with explicit calculation method.
- **Given** backup and restore requirements  
  **When** recovery rehearsal is executed  
  **Then** restore integrity is validated against deterministic `SHA-256` checksum procedure.
- **Given** alerting requirements  
  **When** lag/failure thresholds are evaluated  
  **Then** alert rules apply explicit windows (`warn: lag >= 5s for 3 samples @10s`, `critical: lag >= 30s for 2 samples @10s` or replication stopped >= 60s).
- **Given** architecture baseline contains single-node local runtime decision  
  **When** HA baseline is introduced  
  **Then** ADR records HA scope boundary (`deploy/staging`) and rollback assumptions.
- **Given** read-replica consistency trade-off  
  **When** read-routing is enabled  
  **Then** strong-consistency endpoint allowlist is pinned to primary and tested against stale-read risk.

---

## Story 0.11: [BE][FE][MOB][CH] Supply Chain Security Baseline

As a **platform security engineer**,  
I want automated dependency vulnerability management across all FIX repositories,  
So that critical supply-chain risks are detected and blocked before merge.

**Depends On:** Story 0.2, Story 0.6

### Acceptance Criteria

- **Given** repository topology includes `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, and `FIXYZ-MOB`  
  **When** supply-chain baseline is applied  
  **Then** each repository has ecosystem-appropriate dependency update and scan configuration.
- **Given** scheduled and PR-triggered security scans  
  **When** vulnerabilities are analyzed  
  **Then** findings are published with repository, package, severity, and fix availability context.
- **Given** high-risk vulnerability policy (`CVSS >= 7.0`)  
  **When** unresolved critical/high findings exist on target branch  
  **Then** merge is blocked by required security status checks.
- **Given** unavoidable false-positive or temporary exception cases  
  **When** suppression is requested  
  **Then** time-bounded exception process with owner, reason, expiry, audit trail, and auto-expiry re-blocking is enforced.
- **Given** evidence and audit requirements  
  **When** scan workflow completes  
  **Then** reports are retained and indexed under `docs/ops/security-scan/<YYYYMMDD>/`.
- **Given** secret-handling constraints  
  **When** scan/reporting workflows run  
  **Then** credentials/tokens are not hardcoded or exposed in logs.
- **Given** branch-protection integration needs  
  **When** rollout completes  
  **Then** required security checks are verifiably bound in all 4 repositories with evidence artifacts.
- **Given** multi-source CVSS scoring differences  
  **When** threshold decision is made  
  **Then** score precedence is explicit (`GitHub Advisory CVSS` primary, `NVD` fallback).
- **Given** GitHub Actions supply-chain risk  
  **When** security workflows are defined  
  **Then** actions are SHA-pinned or temporary exception record is required with auto-expiry.
- **Given** advisories without CVSS score in primary/fallback sources  
  **When** risk is evaluated  
  **Then** finding enters mandatory manual-triage state and merge remains blocked until decision is recorded.
- **Given** action pinning operational constraints  
  **When** an action cannot be pinned immediately  
  **Then** a time-bounded exception record is required and policy reverts to blocking on expiry.
- **Given** evidence collection requirements  
  **When** workflows complete  
  **Then** evidence follows fixed machine-readable artifact contract (`index.json`, `scan-summary-<repo>.json`, `branch-protection-<repo>.json`, `exceptions-<repo>.json`).

---

## Story 0.12: [BE][CH] Redis Recovery and Self-Healing Baseline

As a **platform engineer**,  
I want deterministic Redis recovery and self-healing validation,  
So that the platform meets the Redis restart recovery target without manual intervention.

**Depends On:** Story 0.2, Story 0.9

### Acceptance Criteria

- **Given** Redis restart fault injection scenario  
  **When** `redis` is restarted during active platform runtime  
  **Then** all backend services recover to healthy status within 60 seconds without manual service restarts, using internal-network probe execution context.
- **Given** outage window during Redis unavailability  
  **When** stateful endpoints are called  
  **Then** failures are deterministic and normalized, with no unrecoverable stuck session/order state after recovery.
- **Given** post-restart verification flow  
  **When** recovery checks run  
  **Then** representative authentication/session/order smoke scenarios pass after Redis returns.
- **Given** repeatable recovery drill requirement  
  **When** automation script or CI job executes the drill  
  **Then** timestamps, measured recovery duration, and pass/fail threshold outputs are captured.
- **Given** operations runbook requirements  
  **When** an engineer follows documented recovery steps  
  **Then** troubleshooting matrix and escalation path are actionable from runbook only.
- **Given** stuck-state guardrail requirement  
  **When** recovery validation runs  
  **Then** no non-terminal order session exceeds `TTL + 60s` (`TTL` default 600s unless documented override).
- **Given** full-operational verdict requirement  
  **When** drill completes  
  **Then** success quorum is 100% pass across required probes in a single run.
- **Given** internal service exposure policy (`NFR-S4`)  
  **When** recovery probes are executed  
  **Then** internal service probes run from compose network context, not host-exposed ports.
