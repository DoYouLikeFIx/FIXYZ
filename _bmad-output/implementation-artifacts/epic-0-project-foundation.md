# Epic 0: Foundation & Shared Platform

## Sync Note

This document is synchronized to `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0 section) and is the execution companion for Story 0.1 through Story 0.5.

Primary source of truth for story decomposition remains `epics.md`.

---

## Summary

Epic 0 establishes the common platform foundation required before feature epics:

- Backend multi-module baseline and runtime topology
- Test and CI foundations for deterministic validation
- Web and mobile scaffolds aligned to backend contracts
- Team collaboration notification baseline (GitHub/Jira -> MatterMost)

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
- **Given** CI split workflow design  
  **When** push/PR occurs  
  **Then** service-scoped pipelines execute independently.
- **Given** failed quality check  
  **When** pipeline runs  
  **Then** merge is blocked by status check.

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
