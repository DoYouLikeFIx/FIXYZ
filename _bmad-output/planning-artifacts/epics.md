---
stepsCompleted: [1, 2, "3-epic0", "3-epic1", "3-epic2", "3-epic3", "3-epic4", "3-epic5", "3-epic6", "3-epic7", "3-epic8", "3-epic9", "3-epic10", "3-epic11", "3-epic12"]
step3Progress: "Bottom-up detailed epics complete (Epic 0~12, BE/FE/MOB ownership)"
version: "v2-detailed-bottom-up"
updated: "2026-03-09"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/planning-artifacts/accounts/api-spec.md"
  - "_bmad-output/planning-artifacts/accounts/db_schema.md"
  - "_bmad-output/planning-artifacts/channels/api-spec.md"
  - "_bmad-output/planning-artifacts/fep-gateway/api-spec.md"
  - "docs/ops/adr/adr-0001-edge-gateway-nginx.md"
  - "docker-compose.yml"
  - "docker/nginx/templates/fixyz-edge.conf.template"
  - "_bmad-output/implementation-artifacts/epic-0-project-foundation.md"
  - "_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md"
  - "_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md"
  - "_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md"
  - "_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md"
  - "_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md"
  - "_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md"
  - "_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md"
  - "_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md"
supplementalEpicArtifacts:
  epic-9: "_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md"
  epic-10: "_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md"
legacyEpicArtifactOverlaps:
  epic-10-historical-overlap: "_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md"
---

# FIX - Epic Breakdown (Bottom-up V2 Detailed)

## Overview

This document is a detailed execution plan that redefines the FIX project's Epic/Story into a **Bottom-up structure**.

Core Objectives:

1. Anchor the common Foundation in `Epic 0`.
2. Mature the Channel, Account, and External systems independently before integration.
3. Maintain Epic numbering starting from 0, extending the final structure to `Epic 0~12`.
4. Explicitly define the `FEP Owner` role in the ownership model.
5. Break down Stories into BE/FE/MOB units to enable actual team distribution.

---

## Ownership Model

### Role Definitions

- `CH`: Channel Owner
- `AC`: Account Owner
- `FEP`: External/FEP Owner
- `INT`: Integration Owner
- `SEC`: Security/Operations Owner
- `FE`: Web Frontend Owner
- `MOB`: Mobile Owner

### Staffing Reality

- Currently, the `FEP Owner` is concurrently held by the Account DRI (acting owner).
- Additional personnel have limited availability, so they are not assigned as Critical Path DRIs.

---

## Epic Summary (0-based)

| Epic | Epic Name | Primary System | Owner Role | DRI |
|---|---|---|---|---|
| 0 | Foundation & Shared Platform | Common | CH | Channel Engineer |
| 1 | Channel Auth & Session Platform | Channel | CH | Channel Engineer |
| 2 | Account Domain & Inquiry APIs | Account | AC | Account Engineer |
| 3 | External Gateway Contract (FEP) | External | FEP | FEP Owner (acting Account Engineer) |
| 4 | Channel Order Session & OTP FSM    | Channel | CH | Channel Engineer |
| 5 | Account Ledger, Limits, Idempotency, Concurrency | Account | AC | Account Engineer |
| 6 | External Resilience, Chaos, Replay/Recovery Ops | External | FEP | FEP Owner (acting Account Engineer) |
| 7 | Channel Notifications, Admin, Channel Security | Channel | CH | Channel Engineer |
| 8 | Cross-system Security, Audit, Observability | Cross-system | CH | Channel Engineer |
| 9 | Integration Orchestration & End-to-End Recovery | Integration | INT | Channel Engineer |
| 10 | Full Validation & Release Readiness | Integration | INT | Channel Engineer |
| 11 | Market Data Ingestion & Virtual Execution Determinism | External + Account | FEP | FEP Owner (acting Account Engineer) |
| 12 | Financial DMZ Boundary and Perimeter Hardening | Edge + Ops + Security | SEC | Security Engineer (with Channel support) |

## Current Implementation Priority (Core-First)

To avoid over-scoping and to produce a demonstrable working core early, implementation is prioritized in two phases.

### P0 (Must-run core flow first)

- Story 4.1: Order Session Create/Status + Ownership
- Story 4.2: OTP Verify Policy
- Story 5.2: Order Execution & Position Update
- Story 2.2: Position & Available-Quantity API

**P0 completion signal:**

- One end-to-end trade flow is runnable: order request -> execution result persisted -> position/balance reflects the execution consistently.

### P1 (Layer on top after P0 proves stable)

- Story 5.3 / 6.x: external sync semantics and recovery hardening
- Story 7.8 (new): operations monitoring dashboard MVP
- Story 10.x: release gates and readiness evidence packaging
- Story 11.x: market data determinism and quote freshness hardening
- Story 12.x: DMZ boundary hardening and controlled-exposure operations (planning default Medium; move to Low only with explicit risk-acceptance record)

---

## Epic List

### Epic 0: Foundation & Shared Platform

Provides the common development foundation (module structure, execution infrastructure, common error contract, test base, CI).

**Story Hints:**
- Story 0.1: BE Core Platform Baseline
- Story 0.2: BE Test & CI Foundation
- Story 0.3: FE Foundation Scaffold
- Story 0.4: MOB Foundation Scaffold
- Story 0.5: Collaboration Webhook Notifications (MatterMost + Jira + GitHub)
- Story 0.6: Multi-Repo Collaboration Webhook Rollout
- Story 0.7: Edge Gateway Baseline (Nginx)
- Story 0.8: Vault Secrets Foundation
- Story 0.9: Additional Infrastructure Bootstrap
- Story 0.10: Database High Availability and Replication Baseline
- Story 0.11: Supply Chain Security Baseline
- Story 0.12: Redis Recovery and Self-Healing Baseline

### Epic 1: Channel Auth & Session Platform

Completes the channel authentication/session foundation, adds password recovery capability, and establishes the FE/MOB authentication UX.

**Story Hints:**
- Story 1.1: BE Registration & Login Session
- Story 1.2: BE Logout/Profile/Session Security
- Story 1.3: FE Auth Flow
- Story 1.4: MOB Auth Flow
- Story 1.5: BE Auth Guardrails
- Story 1.6: FE/MOB Auth Error Standardization
- Story 1.7: BE Password Forgot/Reset API

### Epic 2: Account Domain & Inquiry APIs

Completes the account schema/inquiry API and delivers the FE/MOB account/history screens.

**Story Hints:**
- Story 2.1: BE Schema & Auto Account Provisioning
- Story 2.2: BE Position & Available-Quantity API
- Story 2.3: BE Order History API
- Story 2.4: FE Portfolio Dashboard & History
- Story 2.5: MOB Portfolio Dashboard & History
- Story 2.6: BE Account Status Contract

### Epic 3: External Gateway Contract (FEP)

Finalizes the external FEP contract, mapping, tracing, status inquiry, and contract tests. (BE-centric)

**Story Hints:**
- Story 3.1: BE FEP DTO/Client Contract
- Story 3.2: BE External Error Taxonomy
- Story 3.3: BE ReferenceId & Idempotency Policy
- Story 3.4: BE FEP Status Query API
- Story 3.5: BE Contract Test Suite
- Story 3.6: FE/MOB Visible External Error UX

### Epic 4: Channel Order Session & OTP FSM

Implements the channel order session/OTP state machine and the FE/MOB multi-step order UX.

**Story Hints:**
- Story 4.1: BE Order Session Create/Status + Ownership
- Story 4.2: BE OTP Verify Policy
- Story 4.3: BE FSM Transition Governance
- Story 4.4: FE Order Step A/B
- Story 4.5: FE OTP + Step C
- Story 4.6: MOB Order Step A/B
- Story 4.7: MOB OTP + Step C
- Story 4.8: Cross-Client FSM Parity Validation

### Epic 5: Position Ledger, Limits, Idempotency, Concurrency

Ensures position ledger processing, sell limits, idempotency, and concurrency stability. (BE-centric)

**Story Hints:**
- Story 5.1: BE Limit Engine
- Story 5.2: BE Order Execution & Position Update
- Story 5.3: BE FEP Order Execution Semantics
- Story 5.4: BE Idempotent Posting
- Story 5.5: BE Concurrency Control
- Story 5.6: BE Ledger Integrity
- Story 5.7: FE/MOB Visible Result/Error UX

### Epic 6: External Resilience, Chaos, Replay/Recovery Ops

Implements the external resilience/recovery operation system. (BE-centric)

**Story Hints:**
- Story 6.1: BE Timeout & Circuit Breaker
- Story 6.2: BE Retry Boundary Policy
- Story 6.3: BE Chaos Control API
- Story 6.4: BE UNKNOWN Requery Scheduler
- Story 6.5: BE Manual Replay/Recovery API
- Story 6.6: BE Resilience Scenario Tests
- Story 6.7: FE/MOB Degraded Operation UX

### Epic 7: Channel Notifications, Admin, Channel Security

Completes channel notifications, admin functions, and channel security hardening.

**Story Hints:**
- Story 7.1: BE SSE Stream Registry
- Story 7.2: BE Notification Persistence APIs
- Story 7.3: FE Notification Center
- Story 7.4: MOB Notification Feed
- Story 7.5: BE Admin Session/Audit APIs
- Story 7.6: FE Admin Console Screens
- Story 7.7: BE Channel Security Hardening
- Story 7.8: FE Operations Monitoring Dashboard MVP

### Epic 8: Cross-system Security, Audit, Observability

Ensures consistency in cross-system security, audit, and observability.

**Story Hints:**
- Story 8.1: BE Audit/Security Event Model
- Story 8.2: BE PII Masking Enforcement
- Story 8.3: BE Correlation-id 3-hop Propagation
- Story 8.4: BE OpenAPI Completeness
- Story 8.5: FE Correlation Propagation Support
- Story 8.6: MOB Correlation Propagation Support

### Epic 9: Integration Orchestration & End-to-End Recovery

Assembles the domain components into an integrated orchestration flow and validates the recovery process.

**Story Hints:**
- Story 9.1: BE Execution Orchestration
- Story 9.2: BE End-state Normalization
- Story 9.3: BE Recovery Scheduler Integration
- Story 9.4: BE Cross-system Idempotency Reconciliation
- Story 9.5: FE Integrated Final-state UX
- Story 9.6: MOB Integrated Final-state UX

### Epic 10: Full Validation & Release Readiness

Passes the quality gate just before release and completes the release evidence.

**Story Hints:**
- Story 10.1: BE 7+1 Acceptance CI Gate
- Story 10.2: BE Concurrency/Performance Gate
- Story 10.3: BE FEP Resilience Drills
- Story 10.4: BE Full-stack Smoke & Rehearsal
- Story 10.5: FE Release Readiness Pack
- Story 10.6: MOB Release Readiness Pack

### Epic 11: Market Data Ingestion & Virtual Execution Determinism

Defines simulator-grade market data contracts (LIVE/DELAYED/REPLAY), quote freshness policy, and deterministic valuation/execution behavior.

**Story Hints:**
- Story 11.1: BE Market Data Source Adapter (LIVE/DELAYED/REPLAY)
- Story 11.2: BE Quote Snapshot Freshness Guard
- Story 11.3: BE Replay Timeline Controller
- Story 11.4: BE MARKET Order Sweep Matching Validation
- Story 11.5: FE/MOB Quote Freshness & Source Visibility UX

### Epic 12: Financial DMZ Boundary and Perimeter Hardening

Defines the documentation package for future finance-grade DMZ boundary controls.

**Execution Boundary:** Story 0.7 remains the active runtime owner for TLS termination, basic security headers, and route forwarding. Epic 12 currently carries design, governance, and handoff documents only.

**Deployment Transition Policy:** Any future DMZ runtime rollout must be introduced through new reviewed runtime artifacts. No Epic 12-specific runtime overlay or drill automation is currently active in this repository.

**Priority Policy (planning metadata):** Default Medium. Move to Low only with an explicit risk-acceptance record in `docs/ops/risk-acceptance/<YYYYMMDD>-epic12.md`.

**PRD Anchors:** `NFR-S8`, `NFR-S9`, post-MVP hardened perimeter governance note

**Story Hints:**
- Story 12.1: BE/OPS DMZ Network Segmentation Profile
- Story 12.2: BE/OPS Edge Perimeter Policy Hardening
- Story 12.3: BE/OPS Service Boundary Trust Hardening (Internal Secret Rotation + mTLS Readiness)
- Story 12.4: OPS Admin Access Control Path for DMZ Operations
- Story 12.5: BE/OPS DMZ Security Drill and Evidence Gate

---

## Detailed Epics & Stories

## Epic 0: Foundation & Shared Platform

### Story 0.1: [BE][CH] Core Platform Baseline

As a **backend engineer**,  
I want a stable multi-module platform baseline,  
So that all system lanes can build on a consistent runtime and coding contract.

**Acceptance Criteria:**

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

### Story 0.2: [BE][CH] Test & CI Foundation

As a **platform engineer**,  
I want reproducible test and CI baselines,  
So that feature teams can ship with deterministic validation.

**Depends On:** Story 0.1

**Acceptance Criteria:**

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

### Story 0.3: [FE] Frontend Foundation Scaffold

As a **frontend engineer**,  
I want a standardized web scaffold and API client,  
So that product UI features can be implemented consistently.

**Depends On:** Story 0.1

**Acceptance Criteria:**

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

### Story 0.4: [MOB] Mobile Foundation Scaffold

As a **mobile engineer**,  
I want a standardized mobile scaffold and API layer,  
So that mobile features follow the same contract and architecture.

**Depends On:** Story 0.1

**Acceptance Criteria:**

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
  **Then** client includes credentials and `X-CSRF-TOKEN` header after explicit CSRF bootstrap/refresh (`GET /api/v1/auth/csrf`) on app start/login/resume.
- **Given** foundation CI runs bundle-only checks  
  **When** PR is prepared for merge  
  **Then** AC1 is satisfied only after manual simulator/device smoke evidence (boot log/screenshot + health-call capture) is attached in PR checklist.

### Story 0.5: [BE][CH] Collaboration Webhook Notifications (MatterMost + Jira + GitHub)

As a **delivery team**,  
I want Jira and GitHub webhook events delivered to MatterMost,  
So that release/quality state is visible in real time without manual polling.

**Depends On:** Story 0.2
**Implementation Decision:** Option 1 (Direct integration: `GitHub Actions + Jira Automation -> MatterMost webhook`, no central relay)

**Acceptance Criteria:**

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
  **Then** source retry policy executes with bounded retries (`max_attempts=3`) using source-specific backoff contract (`GitHub`: `2s`,`5s` + jitter `+/-20%`; `Jira`: fixed `2s`,`5s` without jitter due platform limits), per-source+per-entity ordering guard, and final failure visibility in run/audit logs.
- **Given** reliability validation runbook execution  
  **When** duplicate and failure scenarios are replayed  
  **Then** evidence artifacts are indexed under `docs/ops/webhook-validation/<YYYYMMDD>/` with reproducible naming and enforced retention configuration (`>=90 days`).

### Story 0.6: [BE][FE][MOB][CH] Multi-Repo Collaboration Webhook Rollout

As a **delivery platform engineer**,  
I want collaboration webhook notifications rolled out to all FIX repositories,  
So that release and quality visibility is consistent across root, backend, frontend, and mobile repositories.

**Depends On:** Story 0.5

**Acceptance Criteria:**

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

### Story 0.7: [BE][CH] Edge Gateway Baseline (Nginx)

As a **platform engineer**,  
I want a reverse-proxy edge baseline using Nginx,  
So that TLS termination, upstream routing, and security headers are managed consistently.

**Depends On:** Story 0.1

**Acceptance Criteria:**

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

### Story 0.8: [BE][CH] Vault Secrets Foundation

As a **platform engineer**,  
I want Vault-based secret management baseline,  
So that infrastructure and application secrets are centrally controlled with auditable access.

**Depends On:** Story 0.1

**Acceptance Criteria:**

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

### Story 0.9: [BE][CH] Additional Infrastructure Bootstrap

As a **platform engineer**,  
I want reproducible infrastructure bootstrap automation,  
So that dev/staging foundations can be provisioned consistently.

**Depends On:** Story 0.7, Story 0.8

**Acceptance Criteria:**

- **Given** infrastructure baseline scope  
  **When** bootstrap scripts/IaC are executed  
  **Then** required shared components (network, ingress, cache, message/event utilities if needed) are provisioned reproducibly.
- **Given** environment drift risk  
  **When** bootstrap validation runs  
  **Then** configuration parity checks detect missing or divergent components.
- **Given** onboarding requirements  
  **When** a new engineer follows runbook  
  **Then** environment bootstrap succeeds using documented commands only.

### Story 0.10: [AC][CH] Database High Availability and Replication Baseline

As a **platform engineer**,  
I want a database replication baseline,  
So that data services remain available under single-node failure and read load can be distributed.

**Depends On:** Story 0.9

**Acceptance Criteria:**

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

### Story 0.11: [BE][FE][MOB][CH] Supply Chain Security Baseline

As a **platform security engineer**,  
I want automated dependency vulnerability management across all FIX repositories,  
So that critical supply-chain risks are detected and blocked before merge.

**Depends On:** Story 0.2, Story 0.6

**Acceptance Criteria:**

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

### Story 0.12: [BE][CH] Redis Recovery and Self-Healing Baseline

As a **platform engineer**,  
I want deterministic Redis recovery and self-healing validation,  
So that the platform meets the Redis restart recovery target without manual intervention.

**Depends On:** Story 0.2, Story 0.9

**Acceptance Criteria:**

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

---

## Epic 1: Channel Auth & Session Platform

### Story 1.1: [BE][CH] Registration & Login Session Core

As a **new or returning user**,  
I want to register and log in with secure session issuance,  
So that I can access protected features safely.

**Depends On:** Story 0.1

**Acceptance Criteria:**

- **Given** valid registration payload  
  **When** user submits sign-up request  
  **Then** member is created with default role and secure password hash.
- **Given** valid login credentials  
  **When** authentication succeeds  
  **Then** Redis-backed session cookie is issued with secure attributes.
- **Given** duplicate login attempts from same account  
  **When** second session is established  
  **Then** previous session is invalidated by policy.
- **Given** invalid credentials  
  **When** login fails  
  **Then** normalized authentication error is returned.

### Story 1.2: [BE][CH] Logout, Profile, Session Security

As an **authenticated user**,  
I want to manage profile and logout safely,  
So that account access remains under my control.

**Depends On:** Story 1.1

**Acceptance Criteria:**

- **Given** valid authenticated session  
  **When** logout API is called  
  **Then** session is deleted server-side and cookie is expired.
- **Given** profile/password update request  
  **When** validation passes  
  **Then** account profile is updated with audit trail.
- **Given** expired or invalidated session  
  **When** protected endpoint is called  
  **Then** API returns authentication-required error.
- **Given** session timeout policy  
  **When** inactivity exceeds threshold  
  **Then** session is treated as expired.

### Story 1.3: [FE] Web Auth Flow

As a **web user**,  
I want intuitive login/register/private navigation,  
So that authenticated routes behave predictably.

**Depends On:** Story 1.1, Story 1.2, Story 0.3

**Acceptance Criteria:**

- **Given** login and register screens  
  **When** valid credentials are submitted  
  **Then** user is navigated to protected area.
- **Given** unauthenticated access to private route  
  **When** route guard runs  
  **Then** user is redirected to login.
- **Given** server-auth error  
  **When** response arrives  
  **Then** standardized UX error message is shown.
- **Given** session expiration notification event  
  **When** web receives it  
  **Then** user sees re-auth guidance.

### Story 1.4: [MOB] Mobile Auth Flow

As a **mobile user**,  
I want native auth flow parity with web,  
So that account access rules stay consistent across clients.

**Depends On:** Story 1.1, Story 1.2, Story 0.4

**Acceptance Criteria:**

- **Given** mobile login/register screens  
  **When** valid form is submitted  
  **Then** user enters authenticated app stack.
- **Given** invalid or expired session  
  **When** protected API is called  
  **Then** mobile routes user to re-auth flow.
- **Given** auth API validation error  
  **When** response is returned  
  **Then** field-level or global message is shown.
- **Given** device app resume  
  **When** session state is checked  
  **Then** stale sessions are rejected deterministically.

### Story 1.5: [BE][CH] Auth Guardrails (Lockout/Rate Limit)

As a **security system**,  
I want login abuse controls,  
So that brute-force attempts are mitigated.

**Depends On:** Story 1.1

**Acceptance Criteria:**

- **Given** repeated failed login attempts by IP  
  **When** threshold is exceeded  
  **Then** login endpoint returns rate-limit error.
- **Given** repeated failed login attempts by account  
  **When** threshold is exceeded  
  **Then** account transitions to locked state.
- **Given** locked account  
  **When** correct password is submitted  
  **Then** login remains denied until admin unlock.
- **Given** lockout event  
  **When** recorded  
  **Then** security event is persisted.

### Story 1.6: [FE/MOB] Auth Error Standardization

As a **cross-client product team**,  
I want FE/MOB auth error handling standardized,  
So that users receive consistent guidance regardless of client.

**Depends On:** Story 1.3, Story 1.4, Story 1.5

**Acceptance Criteria:**

- **Given** identical backend auth code  
  **When** FE and MOB render message  
  **Then** user-facing semantics are aligned.
- **Given** lockout/expired/rate-limit cases  
  **When** triggered  
  **Then** both clients show recoverable next actions.
- **Given** untranslated or unknown code  
  **When** received  
  **Then** fallback message and correlation id are surfaced.

### Story 1.7: [BE][CH] Password Forgot/Reset API

As a **locked-out or forgetful user**,  
I want a secure password recovery API,  
So that I can regain access without leaking whether my account exists.

**Depends On:** Story 1.1, Story 1.2, Story 1.5, Story 1.6

**Acceptance Criteria:**

- **Given** `POST /api/v1/auth/password/forgot`  
  **When** any normalized email is submitted  
  **Then** API always returns the fixed `202 Accepted` recovery envelope and only eligible accounts receive an asynchronously issued reset email.
- **Given** `POST /api/v1/auth/password/forgot/challenge`  
  **When** challenge bootstrap is requested  
  **Then** API returns the fixed `200 OK` challenge contract with signed challenge token, `ttl=300s`, and replay-safe nonce handling.
- **Given** `POST /api/v1/auth/password/reset` with a valid reset token and a password different from the current password  
  **When** request succeeds  
  **Then** password hash update, `password_changed_at` update, and reset-token consume happen atomically and response is `204 No Content`.
- **Given** invalid, expired, consumed, same-password, or rate-limited recovery requests  
  **When** API rejects the operation  
  **Then** contracted error codes `AUTH-012` through `AUTH-015` and `Retry-After` semantics are returned without revealing account eligibility.
- **Given** a successful password reset for a member with active sessions  
  **When** reset transaction commits  
  **Then** active sessions are invalidated and stale follow-up requests are rejected with `AUTH-016`.

---

## Epic 2: Account Domain & Inquiry APIs

### Story 2.1: [BE][AC] Schema & Auto Account Provisioning

As an **account-domain owner**,  
I want normalized account schema and provisioning endpoints,  
So that every registered member has a usable account baseline.

**Depends On:** Story 0.1, Story 1.1

**Acceptance Criteria:**

- **Given** migration scripts  
  **When** service boots  
  **Then** account/member tables are created with required constraints.
- **Given** successful member registration event  
  **When** provisioning endpoint is called  
  **Then** default account is created idempotently.
- **Given** duplicate provisioning request  
  **When** same member is targeted  
  **Then** account duplication does not occur.
- **Given** provisioning failure  
  **When** transaction is rolled back  
  **Then** failure reason is returned with normalized code.

> **Seed Data (R__seed_data.sql):** `demo` account starts with 500 shares of `005930`, 300 shares of `000660`, and KRW 1,000,000 cash. `admin` account has `ROLE_ADMIN`.

### Story 2.2: [BE][AC] Position & Available-Quantity API

As an **authenticated user**,  
I want real-time position and cash balance information,  
So that order decisions can be made safely.

**Depends On:** Story 2.1, Story 1.2

**Acceptance Criteria:**

- **Given** valid owned account  
  **When** position/balance API is called  
  **Then** current position quantity, available quantity, and cash balance are returned.
- **Given** non-owned account request  
  **When** authorization is checked  
  **Then** access is denied.
- **Given** concurrent updates  
  **When** reads occur  
  **Then** response remains transactionally consistent.
- **Given** downstream error  
  **When** query fails  
  **Then** normalized retriable/non-retriable code is returned.

### Story 2.3: [BE][AC] Order History API

As an **authenticated user**,  
I want paginated order history,  
So that I can inspect recent order activity.

**Depends On:** Story 2.1, Story 1.2

**Acceptance Criteria:**

- **Given** owned account with order records  
  **When** order history API is called  
  **Then** results are paginated, include symbol/qty/status/clOrdId, and ordered by created time desc.
- **Given** order history table columns  
  **When** rendered  
  **Then** columns are: symbol (`symbolName`), side (`BUY`/`SELL`), quantity (`qty`), unit price (`unitPrice`), total amount (`totalAmount`), status, and `ClOrdID`.
- **Given** empty history  
  **When** query executes  
  **Then** empty content contract is returned consistently.
- **Given** unauthorized account id  
  **When** access check fails  
  **Then** API returns forbidden error.
- **Given** malformed pagination params  
  **When** validation runs  
  **Then** 400 validation error is returned.

### Story 2.4: [FE] Web Portfolio Dashboard & History

As a **web user**,  
I want to view my portfolio positions and order history,  
So that portfolio insights are available in one place.

**Depends On:** Story 2.2, Story 2.3, Story 1.3

**Acceptance Criteria:**

- **Given** authenticated session  
  **When** dashboard loads  
  **Then** portfolio summary and position quantities are displayed.
- **Given** order history tab interaction  
  **When** page/filter is changed  
  **Then** server-driven order history list updates correctly.
- **Given** API failure  
  **When** error occurs  
  **Then** user sees standardized retry guidance.
- **Given** account number policy  
  **When** UI renders values  
  **Then** masking format is applied consistently.

### Story 2.5: [MOB] Mobile Portfolio Dashboard & History

As a **mobile user**,  
I want portfolio dashboard and order history on mobile,  
So that parity with web is maintained.

**Depends On:** Story 2.2, Story 2.3, Story 1.4

**Acceptance Criteria:**

- **Given** authenticated mobile session  
  **When** dashboard screen opens  
  **Then** positions and portfolio summaries render correctly.
- **Given** pull-to-refresh on order history  
  **When** user requests refresh  
  **Then** latest order records load without duplications.
- **Given** empty or error response  
  **When** screen state resolves  
  **Then** empty/error states follow UI standard.
- **Given** masked account display policy  
  **When** numbers render  
  **Then** same masking rule as web is applied.

### Story 2.6: [BE][AC] Account Status Contract

As an **account admin system**,  
I want explicit account status contract,  
So that freeze/close lifecycle and order eligibility can be governed consistently.

**Depends On:** Story 2.1

**Acceptance Criteria:**

- **Given** account status model  
  **When** status endpoint is queried  
  **Then** `ACTIVE/FROZEN/CLOSED` and related metadata are returned.
- **Given** `FROZEN` or `CLOSED` account  
  **When** order flow requests eligibility  
  **Then** denial reason code (`ORD-012`) is deterministic.
- **Given** status transition event  
  **When** status changes  
  **Then** account-domain status event is emitted.

---

## Epic 3: External Gateway Contract (FEP)

### Story 3.1: [BE][FEP] FEP DTO/Client Contract

As a **FEP owner**,  
I want a strict request/response contract layer,  
So that channel-to-FEP integration is deterministic.

**Depends On:** Story 0.1

**Acceptance Criteria:**

- **Given** outbound order payload  
  **When** mapped to FEP DTO  
  **Then** required fields (clOrdId, symbol, qty, side) are validated before send.
- **Given** response payload from FEP  
  **When** parsed  
  **Then** internal contract is mapped with explicit status values.
- **Given** contract-breaking change  
  **When** build/test runs  
  **Then** failing contract test blocks merge.
- **Given** contract versioning policy  
  **When** schema evolves  
  **Then** backward compatibility rule is enforced.

### Story 3.2: [BE][FEP] External Error Taxonomy

As a **platform consumer**,  
I want normalized external error codes,  
So that upstream systems handle failures consistently.

**Depends On:** Story 3.1

**Acceptance Criteria:**

- **Given** FEP rejection/system errors  
  **When** adapter receives them  
  **Then** internal error taxonomy is applied deterministically.
- **Given** unmapped FEP code  
  **When** received  
  **Then** fallback unknown-external code is returned.
- **Given** mapped external error  
  **When** propagated to channel  
  **Then** user-facing message key and operator code are both available.
- **Given** taxonomy table update  
  **When** regression test runs  
  **Then** mapping matrix assertions pass.

### Story 3.3: [BE][FEP] ReferenceId & Idempotency Policy

As a **resilience engineer**,  
I want idempotent external request identity,  
So that duplicate transmission never causes double execution.

**Depends On:** Story 3.1

**Acceptance Criteria:**

- **Given** duplicate external request identity  
  **When** replayed  
  **Then** adapter returns existing processing context.
- **Given** cross-owner duplicate misuse  
  **When** validation executes  
  **Then** request is rejected as unauthorized.
- **Given** idempotency retention window  
  **When** expired key is reused  
  **Then** policy behavior is deterministic and documented.
- **Given** replay-denied case  
  **When** handled  
  **Then** security/audit event is recorded.

### Story 3.4: [BE][FEP] FEP Status Query API

As a **recovery scheduler**,  
I want status requery for external orders,  
So that UNKNOWN/EXECUTING outcomes can be reconciled.

**Depends On:** Story 3.1

**Acceptance Criteria:**

- **Given** known external reference  
  **When** status API is queried  
  **Then** latest known status is returned in normalized shape.
- **Given** unknown external reference  
  **When** status API is queried  
  **Then** `UNKNOWN` result is returned without schema drift.
- **Given** temporary external timeout  
  **When** status query fails  
  **Then** retriable classification is returned.
- **Given** repeated query from scheduler  
  **When** threshold is exceeded  
  **Then** escalation signal is produced.

### Story 3.5: [BE][FEP] Contract Test Suite

As a **quality owner**,  
I want contract tests for FEP integration,  
So that integration drift is detected before release.

**Depends On:** Story 3.2, Story 3.4

**Acceptance Criteria:**

- **Given** canonical WireMock stubs  
  **When** CI runs  
  **Then** request header/body and response mapping assertions pass.
- **Given** changed contract field  
  **When** stub and mapper diverge  
  **Then** pipeline fails with explicit mismatch.
- **Given** error taxonomy scenarios  
  **When** test matrix executes  
  **Then** all expected code mappings are validated.
- **Given** correlation-id propagation requirement  
  **When** outbound call verified  
  **Then** trace header presence is asserted.

### Story 3.6: [FE/MOB] Visible External Error UX

As an **order user**,  
I want understandable external-failure messages,  
So that I know whether to retry, wait, or contact support.

**Depends On:** Story 3.2

**Acceptance Criteria:**

- **Given** external failure code mapping  
  **When** FE/MOB receives error  
  **Then** action-oriented message is displayed.
- **Given** ambiguous unknown external state  
  **When** shown to user  
  **Then** recovery guidance avoids false completion claims.
- **Given** same error code on FE and MOB  
  **When** rendered  
  **Then** parity of UX semantics is maintained.

---

## Epic 4: Channel Order Session & OTP FSM

### Story 4.1: [BE][CH] Order Session Create/Status + Ownership

As a **channel API owner**,  
I want order session creation and status queries with ownership checks,  
So that unauthorized access and invalid session usage are blocked.

**Depends On:** Story 1.2, Story 2.2

**Acceptance Criteria:**

- **Given** valid order initiation request  
  **When** session API is called  
  **Then** order session is created with PENDING_NEW status and TTL.
- **Given** status query for owned session  
  **When** endpoint is called  
  **Then** current session state is returned.
- **Given** non-owner session access  
  **When** query or action occurs  
  **Then** forbidden error is returned.
- **Given** expired session  
  **When** status/action is requested  
  **Then** not-found/expired contract is returned.

### Story 4.2: [BE][CH] OTP Verification Policy

As an **authenticated order initiator**,  
I want robust OTP verification controls,  
So that step-up authentication is secure and abuse-resistant.

**Depends On:** Story 4.1, Story 1.2

**Acceptance Criteria:**

- **Given** valid OTP in allowed time window  
  **When** verify endpoint is called  
  **Then** verification succeeds and session can advance.
- **Given** duplicate rapid verify attempts  
  **When** debounce policy applies  
  **Then** request is throttled without attempt over-consumption.
- **Given** OTP replay in same window  
  **When** replay is detected  
  **Then** request is rejected.
- **Given** max attempts exceeded  
  **When** further verify is attempted  
  **Then** session is failed and execution blocked.

### Story 4.3: [BE][CH] FSM Transition Governance

As a **domain owner**,  
I want explicit order session transition rules,  
So that invalid state progression cannot occur.

> **Reference:** OrderSession FSM transition table is defined in `architecture.md`, section `OrderSession FSM`.  
> Valid transitions: `PENDING_NEW -> AUTHED -> EXECUTING -> (COMPLETED|FAILED|CANCELED|REQUERYING)`, `REQUERYING -> (COMPLETED|CANCELED|ESCALATED)`, `ESCALATED -> (COMPLETED|FAILED|CANCELED)`, `PENDING_NEW|AUTHED -> EXPIRED`.

**Depends On:** Story 4.2

**Acceptance Criteria:**

- **Given** order session FSM definition (see `architecture.md`, section `OrderSession FSM`)  
  **When** state transition command is applied  
  **Then** only allowed transitions are accepted.
- **Given** invalid transition request  
  **When** attempted  
  **Then** deterministic conflict/error is returned.
- **Given** state persistence event  
  **When** transition completes  
  **Then** status and timestamps are stored consistently.
- **Given** API status response  
  **When** serialized  
  **Then** optional fields follow status-specific contract.

### Story 4.4: [FE] Web Order Step A/B

As a **web user**,  
I want step-based order input (symbol/qty) and OTP preparation flow,  
So that order setup is clear and reversible.

**Depends On:** Story 4.1, Story 2.4

**Acceptance Criteria:**

- **Given** step A order form (symbol/qty input)  
  **When** user submits valid symbol and quantity  
  **Then** order session initiation API is called successfully.
- **Given** invalid form data  
  **When** validation runs  
  **Then** client-side and server-side errors are shown.
- **Given** transition to step B  
  **When** order session advances to OTP step  
  **Then** OTP input UI becomes active.
- **Given** API/network error  
  **When** request fails  
  **Then** user receives retry guidance.

### Story 4.5: [FE] Web OTP + Step C

As a **web user**,  
I want OTP verification and order execution result screens,  
So that I can complete order execution with clear status feedback.

**Depends On:** Story 4.2, Story 4.3, Story 4.4

**Acceptance Criteria:**

- **Given** valid OTP submission  
  **When** verify succeeds  
  **Then** UI transitions to confirmation/execution step.
- **Given** OTP failure cases  
  **When** code is invalid/expired/replayed  
  **Then** mapped error message is displayed.
- **Given** execution in progress  
  **When** status polling/SSE updates  
  **Then** result screen reflects final order state (FILLED/REJECTED/FAILED).
- **Given** final state response  
  **When** FILLED/REJECTED/FAILED returned  
  **Then** ClOrdID and failure reason are rendered conditionally.

### Story 4.6: [MOB] Mobile Order Step A/B

As a **mobile user**,  
I want order input (symbol/qty) and OTP preparation on mobile flow,  
So that I can initiate order with same capability as web.

**Depends On:** Story 4.1, Story 2.5

**Acceptance Criteria:**

- **Given** step A mobile order form  
  **When** submission succeeds  
  **Then** order session is created and step B is shown.
- **Given** invalid symbol/quantity input  
  **When** validation fails  
  **Then** contextual error indicators are displayed.
- **Given** OTP pending session  
  **When** user navigates to OTP step  
  **Then** remaining session context is preserved.
- **Given** navigation interruption  
  **When** user returns  
  **Then** state restoration logic preserves flow continuity.

### Story 4.7: [MOB] Mobile OTP + Step C

As a **mobile user**,  
I want OTP verification and order execution result flow on mobile,  
So that complete order execution experience is parity with web.

**Depends On:** Story 4.2, Story 4.3, Story 4.6

**Acceptance Criteria:**

- **Given** OTP verify on mobile  
  **When** valid code is entered  
  **Then** app transitions to confirmation/execution.
- **Given** OTP or execution errors  
  **When** response received  
  **Then** user sees mapped action guidance.
- **Given** final result response  
  **When** FILLED/REJECTED/FAILED  
  **Then** ClOrdID and failure reasons are rendered.
- **Given** app background/foreground cycle  
  **When** session resumes  
  **Then** current order status is recovered.

### Story 4.8: [FE/MOB] Cross-client FSM Parity Validation

As a **product quality owner**,  
I want FE and MOB FSM behavior parity,  
So that one client does not diverge from core order rules.

**Depends On:** Story 4.5, Story 4.7

**Acceptance Criteria:**

- **Given** same scenario input sequence  
  **When** run on FE and MOB  
  **Then** state transitions are equivalent.
- **Given** same error codes  
  **When** rendered on both clients  
  **Then** severity/action semantics are aligned.
- **Given** regression suite  
  **When** CI runs  
  **Then** parity checks pass.

---

## Epic 5: Account Ledger, Limits, Idempotency, Concurrency

### Story 5.1: [BE][AC] Limit Engine

As an **account policy engine**,  
I want position availability and daily sell limit validation,  
So that order attempts respect position constraints and policy limits.

**Depends On:** Story 2.2

**Acceptance Criteria:**

- **Given** order request with position context  
  **When** position availability and limit check executes  
  **Then** available quantity and daily sell remaining capacity are computed accurately.
- **Given** order quantity exceeds available position or daily limit  
  **When** availability check fails  
  **Then** rejection includes available quantity and remaining-limit metadata.
- **Given** exactly-at-limit order request  
  **When** check runs  
  **Then** acceptance/rejection behavior follows documented boundary.
- **Given** daily window rollover  
  **When** date boundary changes  
  **Then** counters reset according to timezone rule.

> **MVP Scope Note:** `InsufficientPositionException` (available_qty < requested qty) and `DailySellLimitExceededException` are both MVP-scope rejection paths and must return deterministic metadata.

### Story 5.2: [BE][AC] Order Execution & Position Update

As a **position management engine**,  
I want atomic position deduction and order record posting for order execution,  
So that position integrity is preserved.

**Depends On:** Story 5.1, Story 4.3

**Acceptance Criteria:**

- **Given** authorized order execution  
  **When** execution occurs  
  **Then** position deduction and `orders`/`executions` records are committed atomically.
- **Given** `MARKET` order with opposite-side liquidity  
  **When** matching runs  
  **Then** engine sweeps opposite book levels in price-time order until requested qty or liquidity exhaustion.
- **Given** `MARKET` order with no opposite-side liquidity  
  **When** matching runs  
  **Then** request is rejected with deterministic no-liquidity contract and no position mutation.
- **Given** execution failure mid-transaction  
  **When** transaction aborts  
  **Then** no partial position update or orphaned `orders`/`executions` record remains.
- **Given** insufficient position quantity condition  
  **When** availability pre-check fails  
  **Then** no position mutation occurs.
- **Given** successful execution  
  **When** response is built  
  **Then** ClOrdID and order reference are included.

### Story 5.3: [BE][AC] FEP Order Execution Semantics

As a **FEP execution owner**,  
I want deterministic execution semantics for FEP-routed orders,  
So that local position state stays consistent with FEP execution lifecycle.

**Depends On:** Story 5.1, Story 3.1, Story 3.2, Story 4.3

**Acceptance Criteria:**

- **Given** FEP-routed order execution request  
  **When** pre-execution position reservation occurs  
  **Then** order state records FEP reference and clOrdId metadata.
- **Given** simulator mode execution  
  **When** local Order Book match commits  
  **Then** local `executions` is treated as canonical position truth and FEP report is used for confirmation/recovery only.
- **Given** FEP rejection/failure after local canonical match commit  
  **When** external sync recovery path runs  
  **Then** position quantity remains canonical and order is marked for requery/replay reconciliation (`ESCALATED`).
- **Given** FEP unknown/pending outcome  
  **When** order settlement deferred  
  **Then** position state remains reconcilable for later recovery.
- **Given** FEP order FILLED  
  **When** finalized  
  **Then** final order status (FILLED) and clOrdId references are consistent.

### Story 5.4: [BE][AC] Idempotent Posting

As a **order safety owner**,  
I want duplicate execution suppression,  
So that repeated client/system calls do not double-execute orders.

**Depends On:** Story 5.2, Story 5.3

**Acceptance Criteria:**

- **Given** same idempotency key and same owner  
  **When** execution retried  
  **Then** original result is returned without new posting.
- **Given** same key from different owner  
  **When** request arrives  
  **Then** unauthorized duplication is rejected.
- **Given** concurrent duplicate requests  
  **When** race occurs  
  **Then** only one execution path commits.
- **Given** dedupe hit  
  **When** response returned  
  **Then** idempotency indicator is included for diagnostics.

### Story 5.5: [BE][AC] Concurrency Control

As a **corebank integrity owner**,  
I want pessimistic locking and race-safe behavior,  
So that concurrent orders cannot produce negative or corrupted position quantities.

**Depends On:** Story 5.2

**Acceptance Criteria:**

- **Given** concurrent order attempts on same account+symbol  
  **When** `(account_id, symbol)` pessimistic lock policy is applied  
  **Then** final available_qty never becomes negative.
- **Given** lock contention  
  **When** threshold exceeded  
  **Then** request fails with deterministic conflict/error contract.
- **Given** 10-thread concurrency test on single symbol (`005930`)  
  **When** executed in CI  
  **Then** expected success/failure counts and final available_qty assertions pass.
- **Given** concurrent orders on two different symbols (`005930` / `000660`)  
  **When** executed in parallel  
  **Then** symbol-level lock isolation is verified and each symbol's available_qty converges independently without cross-symbol blocking.
- **Given** lock duration observation  
  **When** measured  
  **Then** operational threshold alerting is available.

### Story 5.6: [BE][AC] Ledger Integrity

As a **position correctness owner**,  
I want position invariant checks and repair visibility,  
So that position integrity can be continuously verified.

**Depends On:** Story 5.2, Story 5.3

**Acceptance Criteria:**

- **Given** completed order set  
  **When** integrity query runs  
  **Then** position deduction/execution(+restoration) invariants hold.
- **Given** detected mismatch  
  **When** integrity check fails  
  **Then** anomaly is reported with traceable identifiers.
- **Given** scheduled integrity job  
  **When** executed  
  **Then** summary metrics are stored for operations.
- **Given** release gate  
  **When** position integrity test fails  
  **Then** build is blocked.

### Story 5.7: [FE/MOB] Visible Result/Error UX

As an **order user**,  
I want limit/position/result failures clearly explained,  
So that I can take the correct next action.

**Depends On:** Story 5.1, Story 4.8

**Acceptance Criteria:**

- **Given** insufficient position/limit errors  
  **When** FE/MOB receives codes  
  **Then** both clients show aligned actionable guidance.
- **Given** order failure reason code  
  **When** rendered  
  **Then** reason category is distinguishable (internal/external/validation).
- **Given** successful order execution (FILLED)  
  **When** result rendered  
  **Then** ClOrdID and updated position quantity are shown where required.

---

## Epic 6: External Resilience, Chaos, Replay/Recovery Ops

### Story 6.1: [BE][FEP] Timeout & Circuit Breaker

As a **resilience owner**,  
I want timeout and circuit breaker policies enforced,  
So that repeated external failures do not cascade.

**Depends On:** Story 3.1

**Acceptance Criteria:**

- **Given** external call exceeding timeout threshold  
  **When** request executes  
  **Then** timeout classification is returned.
- **Given** consecutive failures at configured threshold  
  **When** next call occurs  
  **Then** circuit breaker transitions to open behavior.
- **Given** cool-down window elapsed  
  **When** probe request succeeds  
  **Then** breaker transitions toward closed state.
- **Given** probe request fails  
  **When** half-open state active  
  **Then** breaker returns to open.

### Story 6.2: [BE][FEP] Retry Boundary Policy

As a **systems architect**,  
I want clear retry boundaries,  
So that non-idempotent paths are not retried dangerously.

**Depends On:** Story 6.1

**Acceptance Criteria:**

- **Given** retriable status query failure  
  **When** policy applies  
  **Then** bounded retry executes.
- **Given** non-retriable execution path  
  **When** failure occurs  
  **Then** no automatic duplicate execution retry occurs.
- **Given** retry exhausted  
  **When** final error returned  
  **Then** classification includes retry metadata.
- **Given** policy review  
  **When** runbook checked  
  **Then** retriable/non-retriable matrix is documented.

### Story 6.3: [BE][FEP] Chaos Control API

As an **operations engineer**,  
I want runtime chaos controls,  
So that resilience scenarios can be demonstrated and tested reliably.

**Depends On:** Story 3.1

**Acceptance Criteria:**

- **Given** admin chaos mode endpoint  
  **When** mode set to NORMAL/TIMEOUT/FAILURE  
  **Then** subsequent behavior reflects chosen mode.
- **Given** non-admin access  
  **When** mode change is attempted  
  **Then** request is denied.
- **Given** chaos config query endpoint  
  **When** called  
  **Then** active mode and parameters are returned.
- **Given** mode switch audit requirement  
  **When** mode changes  
  **Then** operational event is logged.

### Story 6.4: [BE][FEP] UNKNOWN Requery Scheduler

As a **recovery engine**,  
I want periodic requery for unknown outcomes,  
So that ambiguous orders can converge to terminal states.

**Depends On:** Story 3.4, Story 6.2, Story 4.3

**Acceptance Criteria:**

- **Given** order in UNKNOWN/EXECUTING timeout state  
  **When** scheduler runs  
  **Then** clOrdId status requery is executed with backoff policy.
- **Given** requery returns accepted/completed  
  **When** reconciliation runs  
  **Then** order state converges to terminal success (FILLED).
- **Given** requery repeatedly unknown/failing  
  **When** threshold exceeded  
  **Then** order is escalated to manual recovery queue.
- **Given** scheduler cycle execution  
  **When** metrics collected  
  **Then** attempt and convergence counters are recorded.

### Story 6.5: [BE][FEP] Manual Replay/Recovery API

As an **operator**,  
I want controlled replay/recovery commands,  
So that unresolved orders can be corrected safely.

**Depends On:** Story 6.4

**Acceptance Criteria:**

- **Given** authorized operator request  
  **When** replay endpoint called  
  **Then** operation is accepted with replay tracking id.
- **Given** unauthorized caller  
  **When** replay is attempted  
  **Then** forbidden response and security event are produced.
- **Given** duplicate replay request  
  **When** same replay identity used  
  **Then** idempotent replay behavior is enforced.
- **Given** replay completion/failure  
  **When** operation ends  
  **Then** final result is auditable.

### Story 6.6: [BE][FEP] Resilience Scenario Tests

As a **quality owner**,  
I want scenario tests for timeout/cb/recovery,  
So that resilience behavior is proven before release.

**Depends On:** Story 6.1, Story 6.2, Story 6.4

**Acceptance Criteria:**

- **Given** controlled timeout scenario  
  **When** repeated failures occur  
  **Then** CB open transition is asserted.
- **Given** recovery probe scenario  
  **When** downstream recovers  
  **Then** CB close transition path is asserted.
- **Given** UNKNOWN requery scenario  
  **When** scheduler executes  
  **Then** convergence/escalation outcomes are asserted.
- **Given** CI gate policy  
  **When** resilience tests fail  
  **Then** merge/release is blocked.

### Story 6.7: [FE/MOB] Degraded Operation UX

As an **order user**,  
I want transparent degraded-state guidance,  
So that I understand delays and recovery behavior.

**Depends On:** Story 6.3, Story 6.4

**Acceptance Criteria:**

- **Given** degraded external mode signal  
  **When** FE/MOB receives state  
  **Then** banner/notice communicates delay and expected behavior.
- **Given** recovery complete signal  
  **When** state normalizes  
  **Then** warning UI is cleared.
- **Given** prolonged unresolved state  
  **When** threshold exceeded  
  **Then** user sees support/escalation guidance.

---

## Epic 7: Channel Notifications, Admin, Channel Security

### Story 7.1: [BE][CH] SSE Stream Registry

As a **notification backend owner**,  
I want SSE stream lifecycle management,  
So that users receive order execution outcomes in real time.

**Depends On:** Story 1.2, Story 4.3

**Acceptance Criteria:**

- **Given** authenticated SSE stream request  
  **When** connection established  
  **Then** emitter is registered for member identity.
- **Given** duplicate connection for same member  
  **When** new stream opens  
  **Then** previous stream is replaced safely.
- **Given** disconnected or failed emitter  
  **When** send fails  
  **Then** registry cleanup occurs.
- **Given** heartbeat policy  
  **When** stream idle  
  **Then** keepalive events are emitted.

### Story 7.2: [BE][CH] Notification Persistence APIs

As a **notification user**,  
I want persisted notification history and read-state APIs,  
So that missed events can be recovered.

**Depends On:** Story 7.1

**Acceptance Criteria:**

- **Given** order terminal event (FILLED/REJECTED/FAILED)  
  **When** notification pipeline runs  
  **Then** notification is persisted before/with dispatch.
- **Given** list API request  
  **When** pagination params applied  
  **Then** ordered notifications are returned.
- **Given** read-mark request  
  **When** notification id belongs to user  
  **Then** read status is updated.
- **Given** unauthorized notification access  
  **When** validation fails  
  **Then** request is denied.

### Story 7.3: [FE] Web Notification Center

As a **web user**,  
I want real-time notification center with reconnection behavior,  
So that order execution results are visible even across brief disconnections.

**Depends On:** Story 7.1, Story 7.2

**Acceptance Criteria:**

- **Given** authenticated web session  
  **When** app mounts provider  
  **Then** single SSE connection is established.
- **Given** SSE disconnect  
  **When** retry policy executes  
  **Then** bounded retries occur before fallback.
- **Given** missed-event window  
  **When** reconnection succeeds  
  **Then** fallback list API backfills notifications.
- **Given** no notifications  
  **When** feed renders  
  **Then** empty state message is shown.

### Story 7.4: [MOB] Mobile Notification Feed

As a **mobile user**,  
I want in-app notification feed and reconnection,  
So that order execution outcomes remain visible on mobile.

**Depends On:** Story 7.1, Story 7.2

**Acceptance Criteria:**

- **Given** active mobile session  
  **When** notification module starts  
  **Then** live updates are received and stored in UI state.
- **Given** app network loss/recovery  
  **When** connection is restored  
  **Then** missed notifications are synchronized.
- **Given** notification read action  
  **When** user marks as read  
  **Then** read state is reflected in app and backend.
- **Given** repeated disconnects  
  **When** retry threshold exceeded  
  **Then** user sees retry guidance.

### Story 7.5: [BE][CH] Admin Session & Audit APIs

As an **administrator**,  
I want forced session invalidation and audit retrieval,  
So that security incidents can be handled quickly.

**Depends On:** Story 1.2, Story 8.1

**Acceptance Criteria:**

- **Given** admin role request  
  **When** invalidate-session API called  
  **Then** target member sessions are removed.
- **Given** audit query filters  
  **When** endpoint executes  
  **Then** paginated and filterable audit list is returned.
- **Given** non-admin caller  
  **When** admin API is called  
  **Then** forbidden response is returned.
- **Given** privileged action executed  
  **When** operation completes  
  **Then** admin identity is recorded.

### Story 7.6: [FE] Web Admin Console Screens

As an **operations admin**,  
I want web screens for security administration,  
So that privileged tasks can be done without direct API tooling.

**Depends On:** Story 7.5

**Acceptance Criteria:**

- **Given** admin authenticated user  
  **When** admin console opened  
  **Then** session-invalidate and audit search UIs are available.
- **Given** unauthorized user  
  **When** route access attempted  
  **Then** access is blocked.
- **Given** admin action result  
  **When** API responds  
  **Then** success/failure feedback is shown.
- **Given** audit filter input  
  **When** search executed  
  **Then** result list and pagination work correctly.

### Story 7.7: [BE][CH] Channel Security Hardening

As a **security owner**,  
I want channel-side CSRF/rate-limit/cookie hardening,  
So that abuse and session attacks are mitigated.

**Depends On:** Story 1.5, Story 4.2

**Acceptance Criteria:**

- **Given** sensitive endpoints  
  **When** rate-limit policy applied  
  **Then** endpoint-specific thresholds are enforced.
- **Given** state-changing browser requests  
  **When** CSRF validation runs  
  **Then** invalid token requests are blocked.
- **Given** session cookie issuance  
  **When** response generated  
  **Then** secure cookie attributes are enforced.
- **Given** direct internal endpoint call without secret  
  **When** request reaches boundary  
  **Then** blocked with security error.

### Story 7.8: [FE][CH] Operations Monitoring Dashboard MVP

As an **operations admin**,  
I want a lightweight monitoring dashboard backed by Prometheus/Grafana,  
So that I can understand system health at a glance during demo and operations review.

**Depends On:** Story 7.1, Story 7.2, Story 7.5, Story 9.1

**Acceptance Criteria:**

- **Given** admin authenticated user  
  **When** monitoring dashboard is opened  
  **Then** Grafana panels show real-time execution volume, pending session count, and market-data ingest status on one screen.
- **Given** metric data source delay or failure  
  **When** dashboard refresh occurs  
  **Then** stale-data indicator and last-updated timestamp are shown using Prometheus scrape freshness.
- **Given** unauthorized user  
  **When** monitoring route is accessed  
  **Then** access is blocked.
- **Given** operator review session  
  **When** anomalies occur (spike in pending, ingest drop)  
  **Then** operator can navigate to related admin/audit views and the underlying Grafana drill-down panel.

---

## Epic 8: Cross-system Security, Audit, Observability

### Story 8.1: [BE][CH] Audit/Security Event Model

As a **compliance owner**,  
I want audit and security event schemas with retention rules,  
So that investigations and compliance checks are reliable.

**Depends On:** Story 1.2, Story 4.3

**Acceptance Criteria:**

- **Given** significant user/system actions  
  **When** events occur  
  **Then** audit or security event is persisted in correct store.
- **Given** retention schedule  
  **When** cleanup job runs  
  **Then** records older than policy are purged.
- **Given** privileged actions  
  **When** performed by admin  
  **Then** actor identity is captured.
- **Given** event insert failure  
  **When** exception occurs  
  **Then** fallback operational log captures failure context.

### Story 8.2: [BE][CH] PII Masking Enforcement

As a **security engineer**,  
I want sensitive data masking in logs,  
So that credentials/session data/account numbers are never leaked.

**Depends On:** Story 8.1

**Acceptance Criteria:**

- **Given** logging of order/auth contexts  
  **When** sensitive fields included  
  **Then** masking rules are applied.
- **Given** password/otp/session token values  
  **When** logging attempted  
  **Then** raw values are never persisted.
- **Given** masking utility tests  
  **When** test suite runs  
  **Then** representative patterns are validated.
- **Given** log compliance check  
  **When** release gate runs  
  **Then** prohibited pattern scan returns clean.

### Story 8.3: [BE][CH/FEP] Correlation-id 3-hop Propagation

As an **observability owner**,  
I want consistent correlation id propagation across CH -> AC -> FEP,  
So that end-to-end traces are reconstructable.

**Depends On:** Story 3.1, Story 2.2, Story 4.3

**Acceptance Criteria:**

- **Given** inbound request without correlation id  
  **When** channel filter runs  
  **Then** new id is generated and returned in response header.
- **Given** internal downstream calls  
  **When** channel calls account and FEP  
  **Then** same correlation id is propagated.
- **Given** log aggregation query  
  **When** searching by correlation id  
  **Then** all four backend services show traceable chain.
- **Given** propagation regression test  
  **When** CI runs  
  **Then** 3-hop header assertions pass.

### Story 8.4: [BE][CH/AC/FEP] OpenAPI Completeness

As a **platform consumer**,  
I want consistent API docs across services,  
So that integration and test automation are reliable.

**Depends On:** Story 1.2, Story 2.2, Story 3.1

**Acceptance Criteria:**

- **Given** `docs-publish.yml` succeeds on `main`  
  **When** canonical API docs endpoint (`https://<org>.github.io/<repo>/`) is accessed  
  **Then** docs selector tabs for required services are reachable.
- **Given** controller endpoints  
  **When** docs generated  
  **Then** operation summaries and response schemas are present.
- **Given** error codes  
  **When** docs reviewed  
  **Then** common failure responses are documented.
- **Given** API change  
  **When** contract diff check runs  
  **Then** undocumented changes fail review gate.

### Story 8.5: [FE] Web Correlation Propagation Support

As a **web diagnostics user**,  
I want correlation id included in web error/report contexts,  
So that support can trace incidents quickly.

**Depends On:** Story 8.3

**Acceptance Criteria:**

- **Given** backend returns correlation header  
  **When** FE handles response  
  **Then** id is attached to error/report context.
- **Given** visible error state  
  **When** rendered  
  **Then** support trace key can be surfaced where appropriate.
- **Given** client logging policy  
  **When** diagnostics emitted  
  **Then** no sensitive values are included.

### Story 8.6: [MOB] Mobile Correlation Propagation Support

As a **mobile diagnostics user**,  
I want correlation id included in mobile failure contexts,  
So that incident triage parity with web is maintained.

**Depends On:** Story 8.3

**Acceptance Criteria:**

- **Given** API response headers  
  **When** mobile network layer processes response  
  **Then** correlation id is captured.
- **Given** failure UX or support flow  
  **When** error information shown  
  **Then** trace id is available for troubleshooting.
- **Given** crash/error reporting integration  
  **When** event sent  
  **Then** correlation id is attached without PII leakage.

---

## Epic 9: Integration Orchestration & End-to-End Recovery

### Story 9.1: [BE][INT/CH] Execution Orchestration

As an **integration owner**,  
I want a single FEP-routed order execution flow via `OrderExecutionService`,  
So that all sell orders are consistently routed to KRX via FEP Gateway.

> **Architecture Note:** All sell orders are routed to KRX via `fep-gateway:8083` (QuickFIX/J FIX 4.2). There is no corebank-direct execution path in the securities domain.

**Depends On:** Story 4.3, Story 5.2, Story 5.3, Story 3.2

**Acceptance Criteria:**

- **Given** AUTHED order session  
  **When** execute command issued  
  **Then** `OrderExecutionService` initiates FEP-routed execution and records clOrdId.
- **Given** FEP execution completed  
  **When** FILLED/REJECTED received from FEP simulator  
  **Then** order session state reflects terminal outcome deterministically.
- **Given** FEP timeout/failure  
  **When** execution path fails  
  **Then** EXECUTING/UNKNOWN recovery-eligible state is assigned.
- **Given** orchestration logic update  
  **When** integration tests run  
  **Then** FEP-routed execution path remains green.

### Story 9.2: [BE][INT/CH] End-state Normalization

As a **platform consumer**,  
I want normalized order terminal states,  
So that clients can render outcomes without service-specific branching.

**Depends On:** Story 9.1

**Acceptance Criteria:**

- **Given** branch-specific outcomes  
  **When** response is normalized  
  **Then** terminal states follow common contract.
- **Given** failed order  
  **When** failure code is set  
  **Then** reason taxonomy matches documented categories.
- **Given** completed order (FILLED)  
  **When** response returned  
  **Then** ClOrdID is always present.
- **Given** state contract regression  
  **When** tests run  
  **Then** schema mismatch fails CI.

### Story 9.3: [BE][INT/CH] Recovery Scheduler Integration

As a **reliability owner**,  
I want orchestrated recovery for EXECUTING/UNKNOWN orders,  
So that stuck orders eventually converge to FILLED/REJECTED/FAILED.

**Depends On:** Story 9.1, Story 6.4

**Acceptance Criteria:**

- **Given** order session remains non-terminal beyond threshold  
  **When** scheduler runs  
  **Then** recovery sequence is triggered.
- **Given** external requery returns terminal result  
  **When** reconciliation succeeds  
  **Then** order is closed with normalized terminal state.
- **Given** repeated unresolved attempts  
  **When** max tries exceeded  
  **Then** manual recovery queue entry is created.
- **Given** recovery execution  
  **When** audited  
  **Then** attempt history is queryable.

### Story 9.4: [BE][INT/CH] Cross-system Idempotency Reconciliation

As an **integration data owner**,  
I want idempotency reconciled across CH/AC/FEP,  
So that duplicate operations never diverge across system boundaries.

**Depends On:** Story 5.4, Story 3.3, Story 9.1

**Acceptance Criteria:**

- **Given** duplicate request at channel boundary  
  **When** dedupe applies  
  **Then** same canonical outcome is returned.
- **Given** AC/FEP partial records  
  **When** reconciliation runs  
  **Then** canonical order identity is restored.
- **Given** mismatch detection  
  **When** discovered  
  **Then** inconsistency is surfaced to operations.
- **Given** reconciliation run report  
  **When** completed  
  **Then** success/failure counters are emitted.

### Story 9.5: [FE] Integrated Final-state & Retry UX

As a **web user**,  
I want integrated final-state and retry guidance,  
So that complex backend outcomes are understandable.

**Depends On:** Story 9.2, Story 4.5

**Acceptance Criteria:**

- **Given** normalized terminal response  
  **When** FE renders result  
  **Then** completed/failed states are displayed consistently.
- **Given** recovery-in-progress state  
  **When** user views order status  
  **Then** proper pending/retry guidance is shown.
- **Given** retry-eligible failure  
  **When** user triggers retry action  
  **Then** operation follows guarded flow.
- **Given** unknown status resolution  
  **When** final state arrives  
  **Then** UI auto-updates without stale conflict.

### Story 9.6: [MOB] Integrated Final-state & Retry UX

As a **mobile user**,  
I want integrated final-state and retry guidance on mobile,  
So that order completion behavior is parity with web.

**Depends On:** Story 9.2, Story 4.7

**Acceptance Criteria:**

- **Given** normalized final response  
  **When** mobile renders result  
  **Then** status/reason/ref fields follow same semantics as web.
- **Given** recovery-in-progress condition  
  **When** screen revisited  
  **Then** current status is restored and shown accurately.
- **Given** retryable failure condition  
  **When** user retries  
  **Then** guarded action path executes and prevents duplicates.
- **Given** connectivity interruption  
  **When** app resumes  
  **Then** latest order state is re-synced.

---

## Epic 10: Full Validation & Release Readiness

### Story 10.1: [BE][INT/CH] 7+1 Acceptance CI Gate

As a **release owner**,  
I want mandatory acceptance scenarios in CI,  
So that release quality baseline is objectively enforced.

**Depends On:** Story 9.4, Story 7.7, Story 8.4

**Acceptance Criteria:**

- **Given** protected branch policy  
  **When** PR to main is opened  
  **Then** all 7+1 scenarios must pass before merge.
- **Given** scenario regression  
  **When** any scenario fails  
  **Then** merge gate is blocked.
- **Given** scenario tagging policy  
  **When** tests run  
  **Then** scenario IDs are traceable in test reports.
- **Given** CI report artifact policy  
  **When** pipeline completes  
  **Then** evidence artifacts are stored.

### Story 10.2: [BE][AC] Concurrency/Performance Gate

As a **performance owner**,  
I want concurrency and latency gates,  
So that release does not regress runtime safety or responsiveness.

**Depends On:** Story 5.5, Story 9.1

**Acceptance Criteria:**

- **Given** concurrency scenario suite  
  **When** CI executes tests  
  **Then** race/integrity assertions pass.
- **Given** p95 SLA thresholds  
  **When** perf tests run  
  **Then** configured targets are satisfied.
- **Given** threshold breach  
  **When** observed  
  **Then** release gate fails with metric evidence.
- **Given** repeated benchmark runs  
  **When** compared  
  **Then** unacceptable variance is reported.

### Story 10.3: [BE][FEP] FEP Resilience Drills

As a **FEP owner**,  
I want repeatable resilience drills,  
So that operational recovery confidence is proven.

**Depends On:** Story 6.6, Story 9.3

**Acceptance Criteria:**

- **Given** timeout and failure drill setup  
  **When** test run executes  
  **Then** CB open behavior is verified.
- **Given** recovery drill scenario  
  **When** downstream recovers  
  **Then** state closes and normal flow resumes.
- **Given** replay/requery drill  
  **When** unresolved order simulated  
  **Then** recovery workflow converges or escalates as designed.
- **Given** drill evidence requirement  
  **When** drill completes  
  **Then** report/log artifacts are attached.

### Story 10.4: [BE][INT/CH] Full-stack Smoke & Rehearsal

As a **release manager**,  
I want full-stack smoke and rehearsal flow,  
So that deployment readiness is validated before production cut.

**Depends On:** Story 10.1

**Acceptance Criteria:**

- **Given** fresh environment boot  
  **When** compose stack starts  
  **Then** health endpoints are green within threshold.
- **Given** critical API/docs endpoints  
  **When** smoke checks run  
  **Then** mandatory endpoints respond correctly.
- **Given** rollback rehearsal plan  
  **When** exercise performed  
  **Then** recovery procedure is executable and documented.
- **Given** rehearsal completion  
  **When** reviewed  
  **Then** go/no-go checklist can be updated.
- **Given** observability stack requirement  
  **When** rehearsal verification runs  
  **Then** Prometheus targets are UP and Grafana release dashboard is reachable.

### Story 10.5: [FE] Web Release Readiness Pack

As a **web release owner**,  
I want FE E2E and release evidence packaged,  
So that web deployment quality is auditable.

**Depends On:** Story 9.5, Story 10.1, Story 10.4

**Acceptance Criteria:**

- **Given** FE E2E suite  
  **When** release pipeline runs  
  **Then** critical user journeys pass.
- **Given** regression in core order/auth paths  
  **When** detected  
  **Then** release gate fails.
- **Given** release checklist template  
  **When** preparing shipment  
  **Then** checklist items are completed with evidence links.
- **Given** final FE candidate build  
  **When** validated  
  **Then** versioned release notes are generated.

### Story 10.6: [MOB] Mobile Release Readiness Pack

As a **mobile release owner**,  
I want MOB E2E and release evidence packaged,  
So that mobile deployment quality is auditable.

**Depends On:** Story 9.6, Story 10.1, Story 10.4

**Acceptance Criteria:**

- **Given** MOB E2E suite  
  **When** release pipeline runs  
  **Then** critical flows pass on target test matrix.
- **Given** auth/order/notification regressions  
  **When** detected  
  **Then** release gate fails.
- **Given** release checklist template  
  **When** preparing distribution  
  **Then** checklist and artifact links are completed.
- **Given** final build candidate  
  **When** approved  
  **Then** release notes and handoff package are finalized.

### Epic 10 Scenario Catalog (Release Gate View)

The following scenario catalog is the release gate checklist for Epic 10.  
All mandatory scenarios must pass before merge/release approval.

| Category | Scenario | Primary Risk Controlled | Pass Condition |
|---|---|---|---|
| Core acceptance | Order request -> execution -> completion happy path | Broken core transaction flow | Full flow succeeds with correct final state |
| Core acceptance | Concurrent sell (10-thread) on same position | Over-sell / race corruption | No over-sell; final quantity remains consistent |
| Core acceptance | OTP failure blocks execution | Missing step-up auth control | Execution blocked with deterministic failure |
| Core acceptance | Duplicate client order key replay | Double execution from retry | Idempotent response; no duplicate posting |
| Core acceptance | Repeated external timeout opens protection circuit | Cascading external failure | Circuit opens and fallback path returns safely |
| Core acceptance | Session invalidated after logout | Session security bypass | Subsequent protected API is rejected |
| Core acceptance | Ledger integrity after N executions | Drift between executions and position | Buy/Sell aggregate equals final position |
| Security boundary | Internal endpoint call without internal secret | Internal network boundary breach | Request is denied (403) |
| Performance gate | p95 latency threshold validation | Silent performance degradation | Configured p95 thresholds are met in Grafana panels sourced from Prometheus |
| Performance gate | Threshold breach release fail | Releasing with known SLA violation | Release gate blocks with metric evidence |
| Resilience drill | Downstream failure/recovery drill | Unproven recovery behavior | Recovery path closes and normal flow resumes |
| Smoke/rehearsal | Fresh environment smoke + rollback rehearsal | Deployment readiness unknown | Health/API checks pass, Prometheus targets are UP, and rollback runbook validated |
| Web readiness | Web critical journey regression gate | Web production regressions | Critical journeys pass; regression blocks release |
| Mobile readiness | Mobile test-matrix regression gate | Device-specific regressions | Matrix critical flows pass; regression blocks release |

## Epic 11: Market Data Ingestion & Virtual Execution Determinism

### Story 11.1: [BE][MD] Market Data Source Adapter (LIVE/DELAYED/REPLAY)

As a **market data owner**,  
I want a unified source adapter for LIVE/DELAYED/REPLAY modes,  
So that quote ingestion and downstream valuation use a single contract.

**Depends On:** Story 5.2

**Acceptance Criteria:**

- **Given** configured `LIVE` mode  
  **When** KIS WebSocket(`H0STCNT0`) quote events arrive  
  **Then** adapter authenticates with `approval_key` and subscribes using `tr_type=1`, `tr_id=H0STCNT0`, `tr_key` contract.
- **Given** configured `DELAYED` mode  
  **When** quote events are consumed  
  **Then** configured delay is applied deterministically and emitted snapshots include `quoteSnapshotId` with `quoteSourceMode=DELAYED`.
- **Given** configured `REPLAY` mode  
  **When** replay seed and cursor are fixed  
  **Then** identical input produces identical quote snapshot sequence (including `quoteSnapshotId`) with `quoteSourceMode=REPLAY`.
- **Given** KIS real-time frame `encFlag|trId|count|payload`  
  **When** `count>1` or `encFlag=1` frame is received  
  **Then** adapter splits multi-record payload by `count`, decrypts encrypted payload via key/iv, and emits normalized snapshots with `quoteSourceMode=LIVE`.

### Story 11.2: [BE][MD] Quote Snapshot Freshness Guard

As a **risk owner**,  
I want stale quote rejection rules,  
So that MARKET pre-check and valuation do not run on outdated data.

**Depends On:** Story 11.1

**Acceptance Criteria:**

- **Given** snapshot age within `maxQuoteAgeMs`  
  **When** prepare/valuation executes  
  **Then** request succeeds with `quoteSnapshotId`, `quoteAsOf`, and `quoteSourceMode`.
- **Given** snapshot age exceeds `maxQuoteAgeMs`  
  **When** prepare/valuation executes  
  **Then** request fails with deterministic stale-quote validation code.
- **Given** stale rejection  
  **When** audit log written  
  **Then** `symbol`, `snapshotAgeMs`, `quoteSourceMode` are recorded.

### Story 11.3: [BE][MD] Replay Timeline Controller

As a **test architect**,  
I want replay timeline controls,  
So that CI and scenario demos are deterministic and reproducible.

**Depends On:** Story 11.1

**Acceptance Criteria:**

- **Given** replay start point and speed factor  
  **When** replay starts  
  **Then** timeline advances deterministically.
- **Given** replay pause/resume command  
  **When** command is issued  
  **Then** cursor and emitted sequence remain consistent.
- **Given** identical replay seed  
  **When** CI reruns  
  **Then** snapshot sequence hash matches baseline.
- **Given** LIVE WebSocket disconnect/reconnect event  
  **When** session recovers  
  **Then** open subscriptions are re-registered deterministically and gap range is backfilled via replay policy.

### Story 11.4: [BE][AC] MARKET Order Sweep Matching Validation

As an **execution engine owner**,  
I want explicit MARKET sweep rules validated,  
So that market-order behavior is predictable and auditable.

**Depends On:** Story 5.2, Story 11.2

**Acceptance Criteria:**

- **Given** multi-level opposite book  
  **When** MARKET order executes  
  **Then** fills are consumed in strict price-time order.
- **Given** insufficient liquidity  
  **When** MARKET order executes  
  **Then** partial fill or no-liquidity reject follows documented policy.
- **Given** execution result  
  **When** persisted  
  **Then** `executedQty`, `executedPrice`, `leavesQty`, `quoteSnapshotId` are traceable.

### Story 11.5: [FE/MOB][MD] Quote Freshness & Source Visibility UX

As an **order user**,  
I want to see quote freshness and source mode,  
So that I understand valuation confidence before execution.

**Depends On:** Story 11.2, Story 11.4

**Acceptance Criteria:**

- **Given** valuation area rendering  
  **When** quote is fresh  
  **Then** UI shows `quoteAsOf` and `quoteSourceMode` badge (`LIVE`/`DELAYED`/`REPLAY`).
- **Given** quote is stale  
  **When** user attempts MARKET prepare  
  **Then** UI blocks progression with actionable stale-data guidance.
- **Given** replay mode demo  
  **When** screen capture reviewed  
  **Then** source-mode visibility is clear in both web and mobile clients.

## Epic 12: Financial DMZ Boundary and Perimeter Hardening

> **Scope note:** Story 0.7 remains the active runtime baseline. Epic 12 is currently documentation-only and exists to preserve a complete DMZ design package without keeping partial runtime code in the repository.
> **Transition note:** Future Epic 12 implementation must reintroduce runtime assets through a new reviewed change set that updates the design documents at the same time.

### Story 12.1: [BE/OPS][CH] DMZ Network Segmentation Profile

As a **platform security owner**,  
I want explicit DMZ network segmentation profiles,  
So that public ingress, channel traffic, and private dependencies are isolated by design before code is reintroduced.

**Depends On:** Story 0.7, Story 0.9, Story 0.13

**Acceptance Criteria:**

- **Given** the active Story 0.7 baseline
  **When** `docs/ops/dmz-network-mapping.md` is reviewed
  **Then** current host exposure, services without direct host ports, and edge-visible baseline exceptions are explicitly documented.
- **Given** the target Epic 12 topology
  **When** the design package is reviewed
  **Then** edge/application/core-private zones, allowed flows, and owner services are explicitly documented.
- **Given** future implementation planning
  **When** Story 12.1 is reviewed
  **Then** the expected future repository-owned runtime specification, default compose filename if Compose is used, verification points, and rollback triggers are documented.
- **Given** architecture isolation concerns
  **When** Story 12.1 is reviewed
  **Then** any lane split or lane collapse decisions are explicit instead of hidden inside deployment config.

### Story 12.2: [BE/OPS][CH] Edge Perimeter Policy Hardening

As a **security engineer**,  
I want hardened edge perimeter policies,  
So that only approved routes and methods are reachable from external clients.

**Depends On:** Story 0.7, Story 7.7, Story 12.1

**Acceptance Criteria:**

- **Given** explicit route-method matrix in `docs/ops/dmz-route-policy.md`  
  **When** a request targets disallowed path or method  
  **Then** edge returns deterministic deny mapping with stable machine codes (`404 EDGE_ROUTE_NOT_ALLOWED` for unknown path, `404 EDGE_METHOD_NOT_ALLOWED` for disallowed method, `403 EDGE_INTERNAL_NAMESPACE_DENIED` for internal namespace).
- **Given** abuse-control thresholds
  **When** traffic exceeds limits (`unknown routes: 60 req/min/source_identity, burst 20`; `sensitive routes: 20 req/min/source_identity, burst 5`)
  **Then** edge returns `429` with retry metadata and request-id for audit trace.
- **Given** repeated abuse from same source
  **When** the same normalized `source_identity` triggers at least 5 rate-limit violations within 5 minutes
  **Then** the design package defines a 10-minute temporary deny, `Retry-After` behavior, deterministic response contract, and required security event fields in `docs/ops/dmz-abuse-response.md`.
- **Given** client identity extraction for abuse controls  
  **When** request source is evaluated  
  **Then** limiter key uses trusted proxy chain policy (`X-Forwarded-For` only from trusted ingress, otherwise `remote_addr`).
- **Given** trusted ingress allowlist source  
  **When** runtime configuration is inspected  
  **Then** trusted CIDR ownership, review flow, and future configuration surface are documented in `docs/ops/dmz-trusted-proxies.md`.
- **Given** active Story 0.7 scaffold routes
  **When** Story 12.2 is reviewed
  **Then** scaffold-only public paths and missing scaffold coverage relative to the canonical target contract are explicitly inventoried instead of being implied.
- **Given** the current Story 0.7 edge alias surface
  **When** Story 12.2 is reviewed
  **Then** `/api/v1/channel/*` is explicitly treated as a legacy edge-only alias that must be denied in hardened mode unless an ADR-backed migration exception is approved.
- **Given** ambiguous request path encodings or trailing-slash variants
  **When** the perimeter policy is reviewed
  **Then** canonical path normalization and route matching rules are explicit.
- **Given** privileged DMZ operator flows
  **When** Story 12.2 is reviewed
  **Then** the public edge policy explicitly excludes privileged operator surfaces from the public allowlist and points to the private Story 12.4 operator path.

### Story 12.3: [BE/OPS][SEC] Service Boundary Trust Hardening (Internal Secret Rotation + mTLS Readiness)

As a **service trust owner**,  
I want hardened service-boundary trust controls with rotation safety,  
So that east-west traffic is resilient to spoofing and stale credential risk.

**Depends On:** Story 0.8, Story 0.13, Story 8.3, Story 12.1

**Acceptance Criteria:**

- **Given** trust-hardening design review
  **When** `docs/ops/dmz-trust-hardening.md` is reviewed
  **Then** dual-secret overlap window, invalidation timing, and stale-secret behavior are explicit.
- **Given** trust validation planning
  **When** Story 12.3 is reviewed
  **Then** service pairs, workload shape, numerator/denominator calculation, and pass/fail thresholds are explicit.
- **Given** mTLS readiness scope
  **When** Story 12.3 is reviewed
  **Then** ADR output, the fixed `channel-service -> corebank-service` PoC scope, and deferred items are explicit.
- **Given** non-local Vault constraints
  **When** Story 12.3 is reviewed
  **Then** Story 0.13 requirements are carried forward as mandatory upstream context.

### Story 12.4: [OPS][SEC] Admin Access Control Path for DMZ Operations

As a **security operations lead**,  
I want controlled DMZ administration access paths,  
So that privileged operations are restricted, temporary, and fully auditable.

**Depends On:** Story 0.13, Story 7.5, Story 8.1

**Acceptance Criteria:**

- **Given** privileged DMZ maintenance requests  
  **When** access is granted  
  **Then** `docs/ops/dmz-admin-access.md` defines Vault-issued short-lived credentials with TTL at or below 30 minutes, least-privilege scope, and non-local environment constraints.
- **Given** credential TTL expiry  
  **When** TTL elapses  
  **Then** Story 12.4 defines auto-revocation target within 60 seconds and deterministic denial after expiry.
- **Given** privileged action execution  
  **When** audit/security events are queried  
  **Then** actor, action, target, timestamp, correlation-id, reason, ticket-id, credential reference, approver, environment, and listener scope are all mandatory fields.
- **Given** privileged credential issuance
  **When** Story 12.4 is reviewed
  **Then** the bootstrap identity that may call `issue` and the private operator access path are explicit.
- **Given** approved automation issuance
  **When** Story 12.4 is reviewed
  **Then** workload identity registration, rotation, suspension, and scope-separation rules are explicit.
- **Given** task-specific privileged controls such as temp deny management
  **When** Story 12.4 is reviewed
  **Then** the shared operator contract explicitly allows task-specific operations and response fields without diverging from the common `dmz:access:*` model.

### Story 12.5: [BE/OPS][INT] DMZ Security Drill and Evidence Gate

As a **release governance owner**,  
I want repeatable DMZ security drills as a delivery gate,  
So that perimeter controls are proven before deployment promotion.

**Depends On:** Story 10.1, Story 10.4, Story 12.1, Story 12.2, Story 12.3, Story 12.4

**Acceptance Criteria:**

- **Given** DMZ drill scenarios (`blocked direct internal access`, `route-method deny`, `abuse rate-limit`, `trusted proxy untrusted spoof rejected`, `trusted proxy malformed-chain fallback`, `trusted proxy right-most hop selection`, `stale-secret rejection`, `admin credential TTL expiry`)
  **When** scheduled validation runs  
  **Then** any failed or not-yet-implemented required scenario blocks promotion with explicit failure reason and owner assignment.
- **Given** drill evidence packaging  
  **When** artifacts are generated  
  **Then** artifacts follow `docs/ops/evidence/dmz/README.md` exactly, including execution mode, environment, control state, and `review_window_id`.
- **Given** first DMZ promotion gate  
  **When** release readiness is reviewed  
  **Then** at least one full successful DMZ drill result within the last 7 days and unresolved findings with owner, disposition, and reviewer evidence are linked from the release checklist.
- **Given** steady-state DMZ operation after first promotion  
  **When** periodic governance review runs  
  **Then** rolling last four weekly drill results are retained and linked.
- **Given** a flaky or repeated drill scenario in the same review window
  **When** the scenario is rerun
  **Then** a new `drill_set_id` is created and the previous set is treated as superseded rather than mutated in place.
- **Given** release checklist lineage requirements
  **When** Story 12.5 is reviewed
  **Then** the checklist template records `review_window_id`, `supersedes_drill_set_id` when applicable, and links the rolling last four consecutive weekly same-environment drill sets using the latest non-superseded set for each week.
- **Given** DMZ drill governance ownership
  **When** operations controls are reviewed
  **Then** `docs/ops/dmz-drill-governance.md` defines owner `SEC`, intended cadence, and promotion semantics.
