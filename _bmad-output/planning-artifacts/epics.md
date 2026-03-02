---
stepsCompleted: [1, 2, "3-epic0", "3-epic1", "3-epic2", "3-epic3", "3-epic4", "3-epic5", "3-epic6", "3-epic7", "3-epic8", "3-epic9", "3-epic10"]
step3Progress: "Bottom-up detailed epics complete (Epic 0~10, BE/FE/MOB ownership)"
version: "v2-detailed-bottom-up"
updated: "2026-02-25"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/implementation-artifacts/epic-0-project-foundation.md"
  - "_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md"
  - "_bmad-output/implementation-artifacts/epic-2-order-session-and-otp.md"
  - "_bmad-output/implementation-artifacts/epic-3-fault-tolerance-and-fep-resilience.md"
  - "_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md"
  - "_bmad-output/implementation-artifacts/epic-5-real-time-notifications.md"
  - "_bmad-output/implementation-artifacts/epic-6-security-audit-and-administration.md"
  - "_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md"
  - "_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md"
---

# FIX - Epic Breakdown (Bottom-up V2 Detailed)

## Overview

This document is a detailed execution plan that redefines the FIX project's Epic/Story into a **Bottom-up structure**.

Core Objectives:

1. Anchor the common Foundation in `Epic 0`.
2. Mature the Channel, Account, and External systems independently before integration.
3. Maintain Epic numbering starting from 0, extending the final structure to `Epic 0~10`.
4. Explicitly define the `FEP Owner` role in the ownership model.
5. Break down Stories into BE/FE/MOB units to enable actual team distribution.

---

## Ownership Model

### Role Definitions

- `CH`: Channel Owner
- `AC`: Account Owner
- `FEP`: External/FEP Owner
- `INT`: Integration Owner
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

### Epic 1: Channel Auth & Session Platform

Completes the channel authentication/session foundation and establishes the FE/MOB authentication UX.

**Story Hints:**
- Story 1.1: BE Registration & Login Session
- Story 1.2: BE Logout/Profile/Session Security
- Story 1.3: FE Auth Flow
- Story 1.4: MOB Auth Flow
- Story 1.5: BE Auth Guardrails
- Story 1.6: FE/MOB Auth Error Standardization

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
- **Given** CI split workflow design  
  **When** push/PR occurs  
  **Then** service-scoped pipelines execute independently.
- **Given** failed quality check  
  **When** pipeline runs  
  **Then** merge is blocked by status check.

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
  **Then** client includes credentials and `X-XSRF-TOKEN` header derived from `XSRF-TOKEN` cookie after explicit CSRF bootstrap/refresh (`GET /api/v1/auth/csrf`) on app start/login/resume.
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
  **Then** source retry policy executes with bounded retries (`max_attempts=3`) using source-specific backoff contract (`GitHub`: `2s`,`5s` + jitter `±20%`; `Jira`: fixed `2s`,`5s` without jitter due platform limits), per-source+per-entity ordering guard, and final failure visibility in run/audit logs.
- **Given** reliability validation runbook execution  
  **When** duplicate and failure scenarios are replayed  
  **Then** evidence artifacts are indexed under `docs/ops/webhook-validation/<YYYYMMDD>/` with reproducible naming and enforced retention configuration (`>=90 days`).

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

> **Seed Data (R__seed_data.sql):** `demo` account — 포지션 005930 삼성전자 500주, 000660 SK하이닉스 300주, 현금 ₩5,000,000 / `admin` account — ROLE_ADMIN.

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
  **Then** results are paginated, include symbol/qty/status/clOrdID, and ordered by created time desc.
- **Given** order history table columns  
  **When** rendered  
  **Then** columns are: 종목명(symbolName), 구분(side: BUY/SELL), 수량(qty), 체결단가(unitPrice), 체결금액(totalAmount), 상태(status), ClOrdID.
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
So that lock/unlock and order eligibility can be governed consistently.

**Depends On:** Story 2.1

**Acceptance Criteria:**

- **Given** account status model  
  **When** status endpoint is queried  
  **Then** `ACTIVE/LOCKED` and related metadata are returned.
- **Given** locked account  
  **When** order flow requests eligibility  
  **Then** denial reason code is deterministic.
- **Given** status transition event  
  **When** status changes  
  **Then** audit/security event is emitted.

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
  **Then** required fields (clOrdID, symbol, qty, side) are validated before send.
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

> **Reference:** OrderSession FSM transition table is defined in `architecture.md §OrderSession FSM`.  
> Valid transitions: `PENDING_NEW → AUTHED → EXECUTING → COMPLETED | FAILED | EXPIRED`.

**Depends On:** Story 4.2

**Acceptance Criteria:**

- **Given** order session FSM definition (see `architecture.md §OrderSession FSM`)  
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

> **MVP Scope Note:** `InsufficientPositionException` (available_qty < requested qty) is enforced in MVP.  
> `DailySellLimitExceededException` is declared but **not enforced in MVP** — enforcement deferred to Phase 2.

### Story 5.2: [BE][AC] Order Execution & Position Update

As a **position management engine**,  
I want atomic position deduction and order record posting for order execution,  
So that position integrity is preserved.

**Depends On:** Story 5.1, Story 4.3

**Acceptance Criteria:**

- **Given** authorized order execution  
  **When** execution occurs  
  **Then** position deduction and OrderHistory record are committed atomically.
- **Given** execution failure mid-transaction  
  **When** transaction aborts  
  **Then** neither partial position update nor OrderHistory record persists.
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
  **Then** order state records FEP reference and clOrdID metadata.
- **Given** FEP rejection/failure requiring position restoration  
  **When** position restoration path runs  
  **Then** position quantity is restored with traceable order linkage.
- **Given** FEP unknown/pending outcome  
  **When** order settlement deferred  
  **Then** position state remains reconcilable for later recovery.
- **Given** FEP order FILLED  
  **When** finalized  
  **Then** final order status (FILLED) and clOrdID references are consistent.

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

- **Given** concurrent order attempts on same symbol  
  **When** symbol-level pessimistic lock policy is applied  
  **Then** final available_qty never becomes negative.
- **Given** lock contention  
  **When** threshold exceeded  
  **Then** request fails with deterministic conflict/error contract.
- **Given** 10-thread concurrency test on single symbol (005930 삼성전자)  
  **When** executed in CI  
  **Then** expected success/failure counts and final available_qty assertions pass.
- **Given** concurrent orders on two different symbols (005930 삼성전자 / 000660 SK하이닉스)  
  **When** executed in parallel  
  **Then** symbol-level lock isolation is verified — each symbol's available_qty converges independently.
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
  **Then** clOrdID status requery is executed with backoff policy.
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
  **Then** `OrderExecutionService` initiates FEP-routed execution and records clOrdID.
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
