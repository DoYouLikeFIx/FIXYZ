---
stepsCompleted: [1, 2, "3-epic0", "3-epic1", "3-epic2", "3-epic3", "3-epic4", "3-epic5", "3-epic6", "3-epic7", "3-epic8"]
step3Progress: "All Epics complete (Epic 0~8 fully detailed with stories)"
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
---

# FIX - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for FIX, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

---

## Requirements Inventory

### Functional Requirements

FR-01: Registered user can authenticate with username and password credentials
FR-02: Authenticated user can terminate their session (logout)
FR-03: System can maintain user session state across multiple requests without re-authentication
FR-04: User can retrieve their own identity and role information from an active session
FR-05: System can expire a user session after a configured period of inactivity (Spring Session Redis 30-minute sliding TTL)
FR-06: System can lock a user account after a configured number of consecutive failed login attempts
FR-07: System can enforce a request rate limit on login attempts per IP address
FR-08: Authenticated user can view a list of their own bank accounts
FR-09: Authenticated user can view the details of a specific account including masked account number and current balance
FR-10: System can display account numbers in a privacy-preserving masked format in all user-facing surfaces
FR-11: Authenticated user can initiate a money transfer by specifying source account, destination, and amount
FR-12: System can validate a transfer request against available balance before proceeding
FR-13: System can validate a transfer request against the account's configured daily transfer limit
FR-14: System can facilitate TOTP enrollment by generating a secret key and providing a QR code URI for registration in a TOTP authenticator app (Google Authenticator)
FR-15: Authenticated user can submit a one-time code to advance a pending transfer to authorized state
FR-16: System can enforce a maximum number of OTP verification attempts per transfer session
FR-17: System can expire a pending transfer session after a configured time-to-live period
FR-18: Authenticated user can query the current status of a pending transfer session
FR-19: System can execute a money transfer between two accounts at the same bank atomically
FR-20: System can route a transfer to an external bank via the interbank FEP interface
FR-21: System can record every balance movement as a paired debit and credit ledger entry
FR-22: System can reject a duplicate transfer submission and return the original result unchanged
FR-23: System can compensate a failed interbank transfer by restoring the debited amount to the source account
FR-24: System can track a transfer through discrete status states from initiation to completion or failure
FR-25: System can provide a unique transaction reference number for every completed or failed transfer
FR-26: System can detect repeated failures on the interbank FEP connection and stop forwarding requests while the failure condition persists
FR-27: System can automatically retry a failed inter-service call a configured number of times before propagating the failure
FR-28: System can expose the current state of fault-tolerance mechanisms (circuit breaker status, retry counters) via an operational endpoint
FR-29: System can be configured to produce predictable failure responses on the interbank interface for controlled scenario testing
FR-30: Authenticated user can receive real-time notifications about the outcome of their transfer without polling
FR-31: System can persist notification records so that a user who reconnects can retrieve notifications missed during disconnection
FR-32: Authenticated user can view a list of past notifications from their current session
FR-33: System can record an audit log entry for every significant user action including actor, action, target, and timestamp
FR-34: System can purge audit log records older than a configured retention period
FR-35: System can enforce CSRF protection on all state-changing requests from browser clients
FR-36: System can prevent credentials, session tokens, and full account numbers from appearing in application logs
FR-37: System can enforce rate limits on OTP verification attempts per transfer session
FR-38: Administrator can forcibly invalidate all active sessions for a specific user account
FR-39: Administrator can retrieve audit log records filtered by user or time range
FR-40: System can generate and serve interactive API documentation for the Channel Service
FR-41: Developer can verify full system operation by running a provided startup procedure that requires no manual configuration
FR-42: System can attach a consistent distributed trace identifier to all inter-service requests so that a complete request chain can be reconstructed from logs
FR-43: System can protect concurrent balance modifications for the same account such that the final balance reflects exactly the sum of successful operations and no modification succeeds that would result in a negative balance
FR-44: System can guarantee that debit and credit ledger entries for a single transfer are recorded atomically — either both exist or neither exists
FR-45: System can record security-significant events (account lockout, forced session invalidation, OTP exhaustion) separately from general audit logs with an extended retention period
FR-46: System can enforce separate retention policies for audit logs and security events
FR-47: System can communicate the remaining daily transfer capacity to a user when a transfer is rejected for exceeding the daily limit
FR-48: Authenticated user can view the outcome and reference number of a completed or failed transfer immediately after execution
FR-49: System can include the source account's current available balance in the response when a transfer is rejected for insufficient funds
FR-50: System can record the identity of an administrator who performs privileged actions in the audit trail
FR-51: System can apply a configurable daily transfer limit per account with a defined default value
FR-52: System can reject requests to protected resources from unauthenticated users with an authentication-required response
FR-53: System can expose health status and operational metrics for each service via a dedicated monitoring endpoint
FR-54: System can communicate a transfer failure to the initiating user with a reason code distinguishing between internal errors, insufficient balance, and external network failures
FR-TOTP-01: Authenticated user can register Google Authenticator as a TOTP device by scanning a QR code and confirming with their first code
FR-TOTP-02: System can reject transfer initiation for members who have not completed TOTP enrollment, returning an enrollment guidance URL
FR-TOTP-03: System can verify a TOTP code within a ±1 time window tolerance (RFC 6238) and reject duplicate code reuse within the same 30-second window
FR-TOTP-04: System must store TOTP secrets exclusively in an external Vault integration, never in the application database in plaintext

### NonFunctional Requirements

NFR-P1: Channel-service read endpoints must achieve p95 response time ≤ 500ms under normal load
NFR-P2: Transfer Prepare endpoint (OTP issuance) must achieve p95 response time ≤ 1,000ms under normal load
NFR-P3: Full system cold start (docker compose up) must complete within 90 seconds on a developer laptop (8GB RAM, 4 cores)
NFR-P4: CoreBanking service must successfully complete 10 concurrent transfer requests without deadlock or data corruption within 5 seconds total
NFR-P5: PESSIMISTIC_WRITE row-level lock hold time must remain ≤ 100ms under normal operating conditions
NFR-P6: Error responses (4xx, 5xx) must meet the same p95 latency SLA as success responses
NFR-S1: All session cookies must be issued with HttpOnly, Secure, and SameSite=Strict attributes
NFR-S2: No passwords, session tokens, full account numbers, or OTP values may appear in application log output
NFR-S3: CSRF tokens must be validated on all state-changing HTTP requests
NFR-S4: Internal service endpoints (corebank-service:8081, fep-simulator:8082) must be unreachable from outside the Docker Compose network
NFR-S5: OTP TTL must be ≤ 180 seconds, Transfer session TTL must be ≤ 600 seconds, both enforced via Redis TTL
NFR-S6: GitHub Dependabot must be active; no dependency with CVSS score ≥ 7.0 on main branch
NFR-S7: All state-changing endpoints must require authenticated session
NFR-R1: All 7 acceptance scenarios must pass on every commit to main branch in CI
NFR-R2: Resilience4j Circuit Breaker must transition to OPEN state after 3 consecutive failures within a sliding window
NFR-R3: All services must recover to full operational status within 60 seconds of Redis restart without manual intervention
NFR-R4: Flyway validate-on-migrate=true must be configured; schema checksum mismatch must cause immediate startup failure
NFR-T1: Channel-service line coverage must be ≥ 70% as reported by JaCoCo on every CI run
NFR-T2: CoreBanking-service line coverage must be ≥ 80%
NFR-T3: FEP-simulator line coverage must be ≥ 60%
NFR-T4: Integration test suite must complete within 8 minutes in CI
NFR-T5: Fast test suite must complete within 2 minutes in CI
NFR-T6: TransferConcurrencyTest class must complete within 10 seconds
NFR-T7: Each integration test class must produce identical results regardless of execution order
NFR-M1: Each Gradle module must correspond to exactly one bounded context
NFR-M2: All significant architecture decisions must be documented in the README
NFR-M3: All public Controller-layer methods must have Javadoc or springdoc-openapi @Operation annotations
NFR-M4: No environment-specific values may be hardcoded in source code
NFR-SC1: Docker Compose deployment must support at least 5 concurrent user sessions for demonstration
NFR-SC2: Bucket4j rate limit thresholds must be configurable via environment variables
NFR-D1: No transfer operation may result in a negative account balance or an unmatched ledger entry
NFR-UX1: Transfer flow (Step A → B → C) must execute within a single modal without full page reload
NFR-UX2: SSE connection must re-establish automatically within 5 seconds of disconnection (Error after 3 reconnections)
NFR-O1: GET /swagger-ui.html must return HTTP 200 for channel-service and fep-simulator after startup
NFR-L1: All services must emit logs in JSON format with traceId and correlationId fields via MDC propagation

### Additional Requirements

<!-- Implementation requirements derived from Architecture Decisions -->

**Infrastructure & Build:**

- Gradle 7-module structure: core-common, testing-support, channel-domain, channel-service, corebank-domain, corebank-service, fep-service
- settings.gradle + build.gradle + gradle/libs.versions.toml root build configuration
- docker-compose.yml + docker-compose.override.yml (local port binding separation)
- .env.example + .gitignore + README.md + CONTRIBUTING.md Day 0 mandatory files
- GitHub Actions 4 CI workflows (ci-channel, ci-corebank, ci-fep, ci-frontend)

**Security Architecture:**

- Spring Session Redis (JSESSIONID HttpOnly Cookie, 30-minute sliding TTL, maximumSessions(1), changeSessionId())
- X-Internal-Secret Header: InternalSecretFilter (corebank-service + fep-service only, channel-service excluded — intentional)
- X-Correlation-Id propagation chain: CorrelationIdFilter(Creation) → CoreBankClient/FepClient(Propagation) → InternalSecretFilter(MDC Injection)
- Actuator: expose health, info, metrics only; /actuator/health permitAll, others ROLE_ADMIN

**Data Layer:**

- Flyway 7 files: channel-service V1~V3(channel_db), corebank-service V1~V3 + R\_\_seed_data.sql(core_db)
- QueryDSL 5.x jakarta classifier annotationProcessor 4-line config (corebank-domain)
- BaseTimeEntity shared via core-common, TransferSession core fields (sessionId UUID, clientRequestId UNIQUE, correlationId)
- Redis Key Namespaces: spring:session:sessions:{sessionId}, spring:session:index:...:{memberId}, fds:ip-fail:{ip}, fds:device:{memberId}

**Transaction & Concurrency:**

- TransferService.execute() transaction boundary: FEP call outside transaction, DB write inside transaction
- Transfer Limit Validation: Performed in channel-service TransferSessionService.initiate() before session creation
- CoreBankClient: no-CB/no-Retry (DESIGN-DECISION-018 — FSM + RecoveryScheduler handles retries)

**Test Infrastructure:**

- testing-support build.gradle: TC + WireMock api scope (transitive classpath)
- Integration Test Isolation: @Transactional forbidden, use @BeforeEach deleteAll()
- TestContainersConfig Singleton (MySQL + Redis), only @DynamicPropertySource method allowed
- Scenario #8: SecurityBoundaryTest (@Nested) — Direct call without X-Internal-Secret → 403

**Frontend:**

- React 19 + Vite 6 + TypeScript + pnpm + TailwindCSS
- BrowserRouter + PrivateRoute + NotificationProvider + AuthProvider wrapping
- SSE Session Expiry Notification + 401 Handler (under 10 lines, remove Silent Refresh)
- SSE Failure Fallback: 3 reconnections → Error display + Manual refresh guidance
- vercel.json SPA rewrites, vite.config.ts proxy (/api → :8080)

**UX Design (ux-design-specification.md):**

- 5 Screens: LoginPage, DashboardPage, TransferPage (5-step FSM), NotificationFeed (SSE)
- Tab Close Recovery during Transfer: GET /api/v1/transfer/sessions/{sessionId}/status (SessionStatusResponse)
- AsyncStateWrapper: Common wrapper for loading/error/empty 3-states
- KrwAmountDisplay: formatKRW() utility

### FR Coverage Map

| FR    | Epic   | Description                                                       |
| ----- | ------ | ----------------------------------------------------------------- |
| FR-41 | Epic 0 | Developer can verify full system operation                        |
| FR-01 | Epic 1 | User authentication with credentials                              |
| FR-02 | Epic 1 | User logout / session termination                                 |
| FR-03 | Epic 1 | Session state maintenance across requests                         |
| FR-04 | Epic 1 | Identity and role retrieval from active session                   |
| FR-05 | Epic 1 | Session expiry after inactivity (Spring Session Redis 30 min)             |
| FR-06 | Epic 1 | Account lockout after failed login attempts                       |
| FR-07 | Epic 1 | Rate limit on login attempts per IP                               |
| FR-52 | Epic 1 | Reject unauthenticated requests with 401                          |
| FR-08 | Epic 1 | View list of own bank accounts                                    |
| FR-09 | Epic 1 | View account details with masked number and balance               |
| FR-10 | Epic 1 | Privacy-preserving masked account number display                  |
| FR-11 | Epic 2 | Initiate transfer (source, destination, amount)                   |
| FR-12 | Epic 2 | Validate transfer against available balance                       |
| FR-13 | Epic 2 | Validate transfer against daily limit                             |
| FR-14 | Epic 2 | Generate and deliver OTP for step-up auth                         |
| FR-15 | Epic 2 | Submit OTP to advance session to AUTHED state                     |
| FR-16 | Epic 2 | Enforce max OTP verification attempts                             |
| FR-17 | Epic 2 | Expire pending transfer session after TTL                         |
| FR-18 | Epic 2 | Query current status of pending transfer session                  |
| FR-26 | Epic 3 | Detect FEP failures and stop forwarding (CB OPEN)                 |
| FR-27 | Epic 3 | Auto-retry failed inter-service call                              |
| FR-28 | Epic 3 | Expose fault-tolerance state via operational endpoint             |
| FR-29 | Epic 3 | Configure predictable FEP failure responses (Chaos)               |
| FR-19 | Epic 4 | Execute same-bank transfer atomically                             |
| FR-20 | Epic 4 | Route transfer to FEP for interbank                               |
| FR-21 | Epic 4 | Record every balance movement as paired debit+credit              |
| FR-22 | Epic 4 | Reject duplicate submission (idempotency)                         |
| FR-23 | Epic 4 | Compensate failed interbank transfer (rollback)                   |
| FR-24 | Epic 4 | Track transfer through discrete status states (FSM)               |
| FR-25 | Epic 4 | Provide unique transaction reference number                       |
| FR-43 | Epic 4 | Protect concurrent balance modifications (no negative)            |
| FR-44 | Epic 4 | Atomic debit+credit — both or neither                             |
| FR-47 | Epic 4 | Communicate remaining daily transfer capacity                     |
| FR-48 | Epic 4 | View outcome and reference number after execution                 |
| FR-49 | Epic 4 | Include available balance in insufficient-funds response          |
| FR-54 | Epic 4 | Transfer failure reason code (internal/balance/FEP)               |
| FR-30 | Epic 5 | Receive real-time transfer notifications (SSE)                    |
| FR-31 | Epic 5 | Persist notifications for reconnection retrieval                  |
| FR-32 | Epic 5 | View list of past notifications from current session              |
| FR-33 | Epic 6 | Record audit log for every significant user action                |
| FR-34 | Epic 6 | Purge audit log records older than retention period               |
| FR-35 | Epic 6 | Enforce CSRF protection on state-changing requests                |
| FR-36 | Epic 6 | Prevent PII from appearing in application logs                    |
| FR-37 | Epic 6 | Rate limit on OTP verification attempts per session               |
| FR-38 | Epic 6 | Admin: forcibly invalidate user sessions                          |
| FR-39 | Epic 6 | Admin: retrieve audit logs filtered by user/time                  |
| FR-45 | Epic 6 | Record security-significant events separately                     |
| FR-46 | Epic 6 | Enforce separate retention policies (audit vs security)           |
| FR-50 | Epic 6 | Record admin identity for privileged actions                      |
| FR-51 | Epic 6 | Apply configurable daily transfer limit per account               |
| FR-40 | Epic 7 | Generate and serve interactive API documentation                  |
| FR-42 | Epic 7 | Attach consistent distributed trace identifier (X-Correlation-Id) |
| FR-53 | Epic 7 | Expose health status and operational metrics (Actuator)           |

> **Coverage Check:** 54 FRs fully covered ✅ (Epic 8 is NFR-based validation Epic)

## Epic List

### Epic 0: Project Foundation

`docker compose up` starts all 3 services (channel:8080, corebank:8081, fep:8082) with a single command, GitHub Actions CI passes the base build, and the Frontend Vite dev server achieves Full-Stack Hello World status communicating with the backend. This is the technical foundation for all subsequent Epics.

**FRs covered:** FR-41
**Architecture requirements:** Gradle 7-module structure, core-common, testing-support, docker-compose.yml + override, Flyway V1 migrations, GitHub Actions 4 workflows (skeleton), fix-frontend Vite scaffold, lib/axios.ts, vercel.json
**Story Hints:**

- Story 0.1: Backend Infrastructure Scaffold (settings.gradle → 3 services startup → /actuator/health 200)
- Story 0.2: CI Pipeline & Frontend Scaffold (GitHub Actions base + Vite scaffold + proxy operation)

> **[ADR-TOTP-SEC-001] TOTP Secret Temporary Storage Strategy** (Party Mode Decision: #5 — Winston/John)
> **Decision:** In Epic 2 (Story 2.2), TOTP secrets will be stored encrypted in DB using `@EncryptedColumn` (AES-256, key externalized via `TOTP_ENCRYPTION_KEY` env var). Migration to HashiCorp Vault KV v2 will occur in Epic 6 Story 6.4.
> **Rationale:** Vault's `docker compose` initialization complexity (unseal, init, depends_on chain) risks delaying Epic 0 baseline work. `TotpSecretRepository` interface abstracts the implementation, so switching requires no service code changes.
> **Temporary Security Level:** AES-256 encryption + Externalized Key env var → Secrets cannot be decrypted from DB dump alone. Follows the spirit of FR-TOTP-04; full compliance upon Story 6.4 completion.
> **Interview Point:** "We knew Vault was the right answer and introduced it incrementally" — ADR documents the basis for this correct judgment.

---

### Epic 1: User Authentication & Account Access

Users can log in and maintain their session via Spring Session Redis (JSESSIONID HttpOnly cookie with 30-minute sliding TTL), safely view their account list and balances, and receive an SSE warning notification 5 minutes before session expiry to extend the session. On logout, the session is immediately invalidated. The React app's Router + PrivateRoute + NavigationBar are built.

**FRs covered:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-52
**Architecture Requirements:** SessionConfig(@EnableRedisHttpSession), SpringSessionBackedSessionRegistry, CorrelationIdFilter, AuthService, OtpService (base), SecurityConfig, CorsConfig, Member Entity, Account Entity, ChannelIntegrationTestBase, CoreBankIntegrationTestBase
**Frontend:** LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx, App.tsx(Router), PrivateRoute, NavigationBar, useAuthStore.ts, useAccount.ts, lib/axios.ts(SSE + 401 handler)
**Story Hints:**

- Story 1.1: Backend Auth — Registration API
- Story 1.2: Backend Auth — Login + Spring Session Issuance
- Story 1.3: Backend Auth — Logout + SSE Session Expiry Notification
- Story 1.4: Backend Account — Account List/Detail Inquiry API

---

### Epic 2: Transfer Initiation & OTP

Authenticated users initiate a transfer (TransferSession INPUT state), verify OTP, and proceed the session to AUTHED state. Insufficient balance, limit exceeded, OTP expiry, and duplicate attempts are all handled safely.

**FRs covered:** FR-11, FR-12, FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-47, FR-49
**Architecture Requirements:** TransferSessionService.initiate()(includes limit validation), OtpService, TransferSession FSM(INPUT→AUTHED), Redis OTP TTL 180s, clientRequestId UNIQUE
**Frontend:** TransferPage.tsx(FSM), TransferInputForm.tsx, OtpInput.tsx, useTransfer.ts(useReducer)
**Story Hints:**

- Story 2.1: Transfer Session — Initiate Transfer API + Session Status Inquiry
- Story 2.2: OTP — Issue/Verify + Expiry/Attempt Limit Handling
- Story 2.3: Frontend — TransferInputForm + OtpInput + useTransfer(useReducer FSM)

---

### Epic 3: Fault Tolerance & FEP Resilience

When the external FEP interface fails repeatedly, Resilience4j Circuit Breaker automatically opens to protect core banking. FepChaosController allows runtime control of failure scenarios (delay, failure rate, mode). Scenario #5 (CB OPEN after 3 failures) passes.

**FRs covered:** FR-26, FR-28, FR-29
**FR-27 Reclassification:** FR-27 (automatic retry) is covered by `TransferSessionRecoveryService` (responsible for distributed retry) instead of `FepClient` `@Retry`. See [ADR-FEP-RETRY-001].
**Architecture Requirements:** FepClient(@CircuitBreaker, **no-Retry**), Resilience4j settings (slidingWindow=3), FepSimulatorService([SIMULATION]), FepChaosController(PUT /fep-internal/config, **POST /fep-internal/simulate-failures**), FepChaosConfig, FepIntegrationTestBase

> **[ADR-FEP-RETRY-001] Decision not to apply FepClient Retry**
> **Decision:** `@Retry` not applied to `FepClient`. FR-27 (automatic retry) is covered by `TransferSessionRecoveryService`.
> **Rationale:** When `@Retry` is nested inside `@CircuitBreaker`, with `maxAttempts: 2`, a single execute request is recorded as 2 failures in the CB sliding window → breaking the determinism of Scenario #5 conditions ("3 requests = 3 failures" becomes "2 requests = 4 failures"). Thus, no-Retry is appropriate.
> **FR-27 Coverage:** `RecoveryScheduler` handles EXECUTING timeouts by re-querying FEP and retrying CREDIT TX → this fulfills the "automatic retry" role.
> **Interview Point:** "Design decision understanding interaction between CB and Retry" — ADR documents the rationale.

> **[ADR-CB-INTERNAL-001] Circuit Breaker not applied to CoreBankClient**
> **Decision:** Circuit Breaker and Retry are not applied to the `channel-service → corebank-service` path.
> **Rationale:** Since this is internal communication within the same Docker Compose network, corebank connection failures are handled at the infrastructure level. TransferSession FSM + RecoveryScheduler handles EXECUTING timeouts. Adding CB could lead to unnecessary fallback complexity.
> **Monitoring:** DB connection failures monitored via Spring Boot Health and Actuator.
> **Interview Point:** Opportunity to demonstrate "ability to judge appropriate trade-offs".

**Story Hints:**

- Story 3.1: FEP Simulator — FepController + FepSimulatorService + Chaos Config + **simulate-failures + status inquiry API**
- Story 3.2: Circuit Breaker — FepClient CB Config (**no-Retry**) + FepChaosController + CB OPEN verification test

---

### Epic 4: Transfer Execution & Ledger Integrity

AUTHED transfer sessions are executed, creating atomic dual entries (DEBIT+CREDIT) in the ledger. Balances never go negative even with 10 concurrent threads, and duplicate requests are handled idempotently. Compensation transactions (rollback) execute upon failure. Scenarios #1, #2, #4, #7 pass.

**FRs covered:** FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-43, FR-44, FR-48, FR-54
**Architecture Requirements:** TransferService.execute()(transaction boundary: FEP outside, DB inside), @Lock PESSIMISTIC_WRITE, TransferHistory(DEBIT+CREDIT), clientRequestId(UNIQUE), TransferSessionRecoveryService(@Scheduled), AccountRepositoryImpl(QueryDSL)
**Frontend:** TransferConfirm.tsx, TransferProcessing.tsx, TransferResult.tsx
**Story Hints:**

- Story 4.1: Ledger — TransferService transaction boundary + PESSIMISTIC_WRITE + TransferHistory
- Story 4.2: Idempotency — clientRequestId duplicate handling + CompensationTransaction
- Story 4.3: Recovery — TransferSessionRecoveryService(@Scheduled) + EXECUTING timeout handling
- Story 4.4: Frontend — TransferConfirm + TransferProcessing + TransferResult

---

### Epic 5: Real-time Notifications

Transfer execution results are delivered instantly via SSE (Server-Sent Events). Automatic reconnection attempts (3 times) occur on disconnection, and missed notifications can be retrieved via fallback API. Transfer results are verifiable even if the browser tab was closed and reopened.

**FRs covered:** FR-30, FR-31, FR-32
**Architecture Requirements:** SseNotificationService(@Async), NotificationController(/api/v1/notifications/stream), V3 Flyway(notification table), SSE reconnection 3-time fallback, GET /api/v1/accounts/{id}/transfers(fallback API), GET /api/v1/transfer/sessions/{sessionId}/status(session recovery)
**Frontend:** NotificationContext.tsx(SSE + 3 retries + error display), useNotification.ts
**Story Hints:**

- Story 5.1: SSE Backend — SseNotificationService + NotificationController + Notification Storage
- Story 5.2: SSE Frontend — NotificationContext(reconnection/fallback) + useNotification

---

### Epic 6: Security, Audit & Administration

All user actions are recorded in audit logs, and administrators can force session invalidation and view audit history. PII (account numbers, passwords) is not exposed in logs. CSRF protection, Rate Limiting, and Account Lockout are fully operational.

**FRs covered:** FR-33, FR-34, FR-35, FR-36, FR-37, FR-38, FR-39, FR-45, FR-46, FR-50, FR-51
**Architecture Requirements:** AuditLogService, AdminController(/api/v1/admin/** ROLE_ADMIN), V2 Flyway(audit_log table), RateLimitFilter(Bucket4j), SessionConfig, MaskingUtils, R\_\_seed_data.sql(admin@fix.com ROLE_ADMIN seed), Actuator Security(/actuator/health permitAll, other ROLE_ADMIN)
**Story Hints:**

- Story 6.1: Audit Logging — AuditLogService + V2 Migration + PII Masking Verification
- Story 6.2: Admin API — AdminController(Session Invalidation + Audit History) + ROLE_ADMIN Protection
- Story 6.3: Rate Limit & CSRF — RateLimitFilter(Bucket4j) + CSRF Protection Integration Test
- Story 6.4: **[NEW — party mode #5]** Vault TOTP Secret Migration — Replace `@EncryptedColumn` DB temporary storage with HashiCorp Vault KV v2 (FR-TOTP-04)

---

### Epic 7: Observability, API Docs & README

Swagger UI documents all Channel APIs, X-Correlation-Id permeates logs across all 3 services, and JSON structured logs allow request chain reconstruction. README provides immediate answers for both interview tracks (Bank/FinTech).

**FRs covered:** FR-40, FR-42, FR-53
**NFRs covered:** NFR-O1(Swagger 200), NFR-L1(JSON Logs), NFR-M2(README ADR), NFR-M3(API Documentation), NFR-M4(Env Var Externalization)
**Architecture Requirements:** springdoc-openapi SwaggerConfig, logback-spring.xml(JSON + MDC), X-Correlation-Id Propagation Chain(CorrelationIdFilter→CoreBankClient/FepClient→InternalSecretFilter), Actuator Endpoint Exposure Config
**Story Hints:**

- Story 7.1: Swagger & API Docs — SwaggerConfig + @Operation annotation on Controllers
- Story 7.2: Structured Logging — logback-spring.xml JSON + correlationId MDC propagation verification
- Story 7.3: README & Portfolio — Architecture Diagram + Dual Track Demo Script + Quick Start

---

### Epic 8: Full System Validation & Acceptance Testing

Validates that all features implemented in Epics 0~7 function correctly in an integrated environment. 7+1 Acceptance Scenarios pass in CI, JaCoCo thresholds met, Ledger Integrity verification, Concurrency tests, and Docker Compose Full-Stack Smoke tests. Epic completion = MVP Complete = Ready for GitHub Public.

**FRs covered:** (No new features — Validation of existing Epics)
**NFRs covered:** NFR-R1(7 Scenarios CI), NFR-T1~T7(JaCoCo + Timeout), NFR-D1(Ledger Integrity), NFR-P4(Concurrency 5s), NFR-P6(Error Response SLA), NFR-S4(Internal Network Isolation)
**Validation Scope:**

- Scenario #1: Same-bank E2E → TransferControllerIntegrationTest
- Scenario #2: 10-thread Concurrent Transfer → ConcurrentTransferIntegrationTest @Timeout(10)
- Scenario #3: OTP Failure → TransferSessionServiceTest
- Scenario #4: Duplicate clientRequestId → IdempotencyIntegrationTest
- Scenario #5: FEP Timeout → CB OPEN → FepCircuitBreakerIntegrationTest
- Scenario #6: Session Rejection after Logout → AuthControllerIntegrationTest
- Scenario #7: SUM(DEBIT)==SUM(CREDIT) → LedgerIntegrityIntegrationTest
- Scenario #8: Direct Call without X-Internal-Secret → SecurityBoundaryTest
- X-Correlation-Id Propagation: Verify matching correlationId in logs of 3 services
- Docker Smoke: `/actuator/health` 200, `/swagger-ui.html` 200, JSON Log Parsing 0 errors

**Story Hints:**

- Story 8.1: Acceptance Scenario Suite — 7+1 Scenarios Pass + JaCoCo Threshold Enforcement
- Story 8.2: Performance & Concurrency Validation — Concurrency + Response Time SLA Verification
- Story 8.3: Docker Integration & Final Polish — Full-Stack Smoke + Final README Review

---

## Epic 0: Project Foundation

`docker compose up` starts all 3 services (channel:8080, corebank:8081, fep:8082) with a single command, GitHub Actions CI passes the base build, and the Frontend Vite dev server achieves Full-Stack Hello World status communicating with the backend. This is the technical foundation for all subsequent Epics.

### Story 0.1: Backend Infrastructure Scaffold

As a **developer**,
I want the Gradle multi-module project to build and all three services to start via `docker compose up` with seed data loaded,
So that I have a verified foundation to build all subsequent features on.

**Acceptance Criteria:**

**Given** a clean checkout of the repository
**When** `./gradlew build` is run from the project root
**Then** all 7 modules (core-common, testing-support, channel-domain, channel-service, corebank-domain, corebank-service, fep-service) compile without errors
**And** `gradle.properties` contains `org.gradle.parallel=true` and `org.gradle.caching=true`

**Given** `.env.example` is copied to `.env` with placeholder values filled
**When** `docker compose up` is run
**Then** all three services start within 90 seconds (NFR-P3)
**And** `GET localhost:8080/actuator/health` returns HTTP 200 `{"status":"UP"}`
**And** `GET localhost:8081/actuator/health` returns HTTP 200 `{"status":"UP"}`
**And** `GET localhost:8082/actuator/health` returns HTTP 200 `{"status":"UP"}`

**Given** Flyway is configured for channel-service and corebank-service
**When** services start
**Then** `V1__create_transfer_session_table.sql` runs against channel_db without error
**And** `V1__create_member_table.sql` runs against core_db without error
**And** `R__seed_data.sql` runs on local/test profile and creates seed data including:

- `admin@fix.com` account with ROLE_ADMIN
- `user@fix.com` account with ROLE_USER
- Each account has at least one bank account with non-zero balance

**Given** `docker-compose.override.yml` exists at project root
**When** `docker compose up` is run locally
**Then** `mysql:3306`, `redis:6379`, `corebank-service:8081`, `fep-service:8082` ports are accessible from the host machine
**And** DBeaver / Redis Insight can connect to each service directly

**Given** `curl localhost:8081/actuator/health` is run from the host machine without override
**When** the base `docker-compose.yml` is used alone (production mode)
**Then** connection is refused for corebank and fep (NFR-S4 — internal services not exposed)

**Given** `testing-support/build.gradle` declares TC and WireMock with `api` scope
**When** `./gradlew :channel-service:test` is run (empty test class)
**Then** `ChannelIntegrationTestBase` compiles successfully
**And** Testcontainers MySQL container starts and stops without error
**And** `MySQLContainer` and `WireMockServer` classes resolve on the test classpath

**Given** `corebank-service` internal API Security Skeleton (John + Winston, issue CCC)
**When** `corebank-service:8081/internal/**` calls without `X-Internal-Secret` header
**Then** `InternalSecretFilter` (`OncePerRequestFilter`) applied to `/internal/**` path
**And** Requests without header → HTTP 403 (Implementation Skeleton — Logic completed in Story 6.3)
**And** Externalize secret via `COREBANK_INTERNAL_SECRET` env var (`application.yml: ${COREBANK_INTERNAL_SECRET:dev-secret}`)
**And** `fep-service:8082/fep-internal/**` implements `FepInternalSecretFilter` skeleton in same pattern
**And** Ensure Story 6.3 `SecurityBoundaryTest` passes on this skeleton

---

### Story 0.2: CI Pipeline & Frontend Scaffold

As a **developer**,
I want GitHub Actions to run a basic build on every push and the frontend Vite dev server to communicate with the backend,
So that every code change is automatically validated and the full development environment is ready from day one.

**Acceptance Criteria:**

**Given** code is pushed to any branch
**When** the GitHub Actions workflows trigger
**Then** `ci-channel.yml`, `ci-corebank.yml`, `ci-fep.yml`, `ci-frontend.yml` all run
**And** `./gradlew build` exits with code 0 on each backend workflow
**And** `pnpm install && pnpm build` exits with code 0 on the frontend workflow

**Given** `fix-frontend/` is scaffolded with Vite 6 + React 19 + TypeScript + pnpm
**When** `pnpm dev` is run in `fix-frontend/`
**Then** `vite.config.ts` proxy routes `/api/*` to `http://localhost:8080`
**And** `src/lib/axios.ts` exports a single configured Axios instance with `baseURL` from `VITE_API_BASE_URL`
**And** `@/` path alias resolves to `src/` in both `vite.config.ts` (resolve.alias) and `tsconfig.json` (paths)

**Given** `fix-frontend/.env.local` contains `VITE_API_BASE_URL=http://localhost:8080`
**When** the dev server is running and backend is up
**Then** a `GET /actuator/health` call via the Axios instance returns HTTP 200

**Given** `vercel.json` exists in `fix-frontend/`
**When** Vercel builds the project
**Then** all routes are rewritten to `/index.html` (SPA routing support)

**Given** the repository root contains `README.md`
**When** a developer clones the repo and reads the README
**Then** a "Quick Start" section exists with exactly 3 commands:

```bash
cp .env.example .env
docker compose up
# → All services healthy at localhost:8080/8081/8082
```

**Given** `CONTRIBUTING.md` exists at the project root
**When** a developer reads it
**Then** it defines: branch naming convention, commit message format (Conventional Commits), and PR merge strategy

---

## Epic 1: User Authentication & Account Access

Implementation of Spring Session Redis-based authentication (Login/Register/Logout), SSE Session Expiry Notification, Account List/Balance Inquiry, Transfer History Inquiry, Profile/Password Change, and Frontend Auth Pages plus PrivateRoute. Fully covers FR-01~10, FR-52.

> **Common Error Format (GlobalExceptionHandler):** All error responses follow the `{ code: string, message: string, timestamp: ISO8601, path: string }` structure. Consistently handled by `@ControllerAdvice` `GlobalExceptionHandler`.

---

### Story 1.1: Member Registration API

As a **new user**,
I want to register with my email, password, and name,
So that I can create an account and immediately have a bank account ready to use.

**Acceptance Criteria:**

**Given** `POST /api/v1/auth/register` receives `{ email, password, name }` with valid data
**When** the email does not already exist
**Then** member record is created with `ROLE_USER`, `ACTIVE` status
**And** password is stored as BCrypt hash (≥12 rounds)
**And** Register API always assigns `ROLE_USER` (`ROLE_ADMIN` is created only via direct DB seed)
**And** corebank-service `POST /internal/v1/accounts` call automatically creates 1 default demand deposit account (FR-52)
**And** Returns HTTP 201: `{ memberId, email, name, createdAt }`

**Given** corebank `POST /internal/v1/accounts` call fails with 5xx or timeout
**When** Exception occurs
**Then** Rollback member creation, return HTTP 503 `{ code: "ACCOUNT_CREATION_FAILED" }`

**Given** `POST /api/v1/auth/register` with duplicate email
**When** the email already exists
**Then** Return HTTP 409 `{ code: "MEMBER_ALREADY_EXISTS" }`

**Given** Invalid input (empty email, password < 8 chars)
**When** Bean Validation executes
**Then** HTTP 400 with field-level error details

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL)
**When** Run integration test
**Then** Pass all cases: normal registration, duplicate email, validation failure

---

### Story 1.2: Login & Spring Session Issuance

As a **registered user**,
I want to log in with my email and password and receive a session cookie,
So that I can authenticate subsequent API calls automatically.

**Acceptance Criteria:**

**Given** `POST /api/v1/auth/login` with valid credentials
**When** Spring Security authentication processing
**Then** Store session in Spring Session Redis (TTL 30 min sliding)
**And** Set `Set-Cookie: JSESSIONID={sessionId}; HttpOnly; Secure; SameSite=Strict` response header
**And** `sessionFixation().changeSessionId()` — Migrate temp session ID to new session ID before login (Session Fixation protection)
**And** `maximumSessions(1)` — Force expire existing session on re-login with same account
**And** Return HTTP 200: `{ memberId, email, name }`
**And** Load `REDIS_PASSWORD` only from environment variable (No hardcoding, RULE-079)

**Given** Login with wrong password
**When** Authentication fails
**Then** Return HTTP 401 `{ code: "INVALID_CREDENTIALS" }`, no session issued

**Given** Login with non-existent email
**When** `UserDetailsService` throws `UsernameNotFoundException`
**Then** Return HTTP 401 (Same message — Prevent email enumeration, NFR-S2)

**Given** 5 consecutive login failures from same IP
**When** 6th `POST /api/v1/auth/login` request
**Then** Return HTTP 429 (Redis Bucket4j IP rate-limit, NFR-S)

**Given** 5 consecutive login failures for same account (email)
**When** 6th login attempt
**Then** Change account status to `LOCKED`, return HTTP 401 `{ code: "ACCOUNT_LOCKED" }`
**And** Cannot login even with correct password (Admin unlock required — implemented in Epic 6)

**Given** Call endpoint protected by issued JSESSIONID cookie
**When** `HttpSessionSecurityContextRepository` processing
**Then** Retrieve session from Redis → Register `MemberDetails` in `SecurityContext` → Reset TTL to 30 min

**Given** New session B login for same account (Existing session A active)
**When** `maximumSessions(1)` triggers
**Then** Calling API with Session A returns HTTP 401 `{ code: "SESSION_EXPIRED_BY_NEW_LOGIN" }`
**And** Session B works normally

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + Redis)
**When** Run login integration test
**Then** Verify JSESSIONID cookie reception on valid login
**And** Session fixation defense: Verify JSESSIONID replacement before/after login (M1 scenario)

---

### Story 1.3: Explicit Logout & Session Expiry Notification

As an **authenticated user**,
I want to explicitly log out and receive advance warning before my session expires,
So that my session is securely terminated and I can extend it if needed.

**Depends On:** Story 1.2

**Acceptance Criteria:**

**Given** `POST /api/v1/auth/logout` call (Valid JSESSIONID cookie)
**When** Processing
**Then** `HttpSession.invalidate()` → Delete Redis `spring:session:sessions:{sessionId}` immediately
**And** `Set-Cookie: JSESSIONID=; Max-Age=0; Path=/` (Expire cookie immediately)
**And** Return HTTP 204

**Given** API call protected by same JSESSIONID after logout
**When** Spring Session lookup
**Then** No Redis key → Return HTTP 401 immediately (No TTL wait unlike JWT)

**Given** Redis `notify-keyspace-events=Ex` setting + `SessionExpiryListener` active
**When** Detect session remaining TTL ≤ 300s (`@Scheduled(fixedDelay=60_000)`)
**Then** Send SSE event `session-expiry { remainingSeconds: 300 }`
**And** Client Toast: "You will be logged out automatically in 5 minutes."

**Given** User clicks "Continue Session" → Call `GET /api/v1/auth/session`
**When** Spring Session processing
**Then** Reset session TTL to 30 min (Sliding)
**And** Return HTTP 200

**Given** SSE connection lost (Network error)
**When** EventSource reconnection attempts 3 times (backoff 5s, 10s, 30s) all fail
**Then** Show warning via Client-side timer (25 min after last activity)

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + Redis)
**When** Run Logout integration test
**Then** Verify HTTP 401 on protected API call after logout

---

### Story 1.4: Account List & Balance Inquiry

As a **logged-in user**,
I want to view my account list and real-time balances,
So that I know how much money I have before initiating a transfer.

**Depends On:** Story 0.1 (corebank startup), Story 1.2 (Spring Session Auth)

**Acceptance Criteria:**

**Given** `GET /api/v1/accounts` call (Valid JSESSIONID cookie)
**When** channel-service → corebank-service `GET /internal/v1/members/{memberId}/accounts` call
**Then** Include `X-Internal-Secret: {INTERNAL_API_SECRET}` header in request (NFR-S4)
**And** corebank-service returns HTTP 403 for internal API request without header
**And** HTTP 200: `[ { accountId, accountNumber, balance, currency, createdAt } ]`
**And** Balance reflects DB real-time value (No cache, FR-08)

**Given** Member with 0 accounts
**When** Request processed
**Then** HTTP 200, returns empty array `[]`

**Given** `GET /api/v1/accounts/{accountId}/balance` call (Own account)
**When** Request processed
**Then** HTTP 200: `{ accountId, balance, pendingAmount, currency, asOf }`
**And** `balance` is available balance after deducting PENDING transfers, `pendingAmount` is amount pending withdrawal (FR-07)

**Given** Inquiry with another member's account ID
**When** Ownership verification fails
**Then** Return HTTP 403 (FR-38)

---

### Story 1.5: Transfer History Inquiry

As a **logged-in user**,
I want to view my transfer history in a paginated and filterable list,
So that I can track my financial activity.

**Depends On:** Story 1.4

**Acceptance Criteria:**

**Given** `GET /api/v1/transfers?page=0&size=20` call (Valid JSESSIONID cookie)
**When** channel-service queries transfer_session table
**Then** HTTP 200: `{ content: [...], totalElements, totalPages, page, size }`
**And** Each item: `{ transferId, fromAccount, toAccount, amount, status, createdAt }`
**And** Sort by `createdAt DESC`

**Given** `GET /api/v1/transfers/{transferId}` call (Own transfer)
**When** Ownership check passes
**Then** HTTP 200: Include full details `{ ..., fepReferenceId, completedAt, failReason }`

**Given** Inquiry `transferId` of another member
**When** Ownership verification fails
**Then** Return HTTP 403

**Given** `GET /api/v1/transfers?status=COMPLETED`
**When** Query executes
**Then** Return only COMPLETED transfers

**Given** `GET /api/v1/transfers?direction=SENT` or `direction=RECEIVED` (FR-09)
**When** Query executes
**Then** `SENT` → Return only transfers where `fromAccountId` is own account
**And** `RECEIVED` → Return only transfers where `toAccountId` is own account
**And** Return all if `direction` unspecified

**Given** `GET /api/v1/transfers?page=-1` or `size=0`
**When** Request processed
**Then** Return HTTP 400 (Invalid page parameter)

---

### Story 1.6: Profile & Password Change

As a **logged-in user**,
I want to view my profile and change my password,
So that I can manage my account security.

**Depends On:** Story 1.3 (Logout + Spring Session Structure)

**Acceptance Criteria:**

**Given** `GET /api/v1/members/me` call (Valid JSESSIONID cookie)
**When** Request processed
**Then** HTTP 200: `{ memberId, email, name, role, createdAt }` (Password hash excluded)

**Given** `PATCH /api/v1/members/me/password` with `{ currentPassword, newPassword }`
**When** `currentPassword` matches stored BCrypt hash
**Then** Update `newPassword` as BCrypt hash
**And** Delete all Redis keys matching `refresh:{memberId}:*` pattern (Force re-login on all devices)
**And** Return HTTP 204

**Given** Incorrect `currentPassword` input
**When** BCrypt match fails
**Then** HTTP 400 `{ code: "CURRENT_PASSWORD_MISMATCH" }`

**Given** `newPassword` < 8 chars
**When** Bean Validation executes
**Then** Return HTTP 400 validation error

---

### Story 1.7: Frontend — Auth Pages & Private Route

As a **user**,
I want login/register pages with proper route protection and navigation,
So that unauthenticated users cannot access protected sections of the app.

**Acceptance Criteria:**

**Given** User accesses `/login`
**When** Login page renders
**Then** Display email·password fields
**And** On login success, store member info in `useAuthStore` (JSESSIONID managed by browser cookie auto) then redirect to `/`

**Given** Login failure (HTTP 401)
**When** Response received
**Then** Display inline error message "Please check your email or password" (Below input field, not toast)

**Given** Login button clicked and awaiting response
**When** API call in progress
**Then** Disable button + Show loading spinner (Prevent duplicate clicks)

**Given** User accesses `/register`
**When** Register page renders
**Then** Display name, email, password fields
**And** On success, redirect to `/login`

**Given** `<PrivateRoute>` wraps protected routes (`/`, `/transfers`, etc.)
**When** Sessionless user accesses
**Then** Redirect to `/login` (Save current path in `returnTo`)

**Given** `<NavBar>` rendering (Authenticated user)
**When** Display
**Then** Include User Name, Account List Link, Transfer History Link, Logout Button
**And** On Logout click, call `POST /api/v1/auth/logout` then initialize useAuthStore member to null

---

### Story 1.8: TOTP Enrollment (Google Authenticator)

As an **authenticated user**,
I want to register my Google Authenticator app to my account,
So that I can use TOTP-based step-up authentication when initiating transfers.

**Depends On:** Story 1.2 (Spring Session Auth), Story 1.6 (Password verify pattern)

**Acceptance Criteria:**

**Given** `POST /api/v1/members/me/totp/enroll` (Valid JSESSIONID cookie, `member.totp_enabled = false`)
**When** Enrollment start request
**Then** `TotpOtpService.generateSecret()` → Generate Base32 encoded secret (Use `com.warrenstrange:googleauth:1.5.0` library)
**And** Save Secret to Vault `secret/fix/member/{memberId}/totp-secret` path (FR-TOTP-04 — DB storage prohibited)
**And** Maintain `member.totp_enabled = false` (Until confirmEnrollment)
**And** HTTP 200: `{ qrUri: "otpauth://totp/FIX:{email}?secret={base32Secret}&issuer=FIX", expiresAt }` — Include secret only in this response once

**Given** `POST /api/v1/members/me/totp/confirm` with `{ totpCode: "123456" }`
**When** User submits first code after registering QR in Google Authenticator app
**Then** Execute `TotpOtpService.confirmEnrollment(memberId, totpCode)`
**And** Retrieve secret from Vault for memberId → RFC 6238 TOTP validation (Allow ±1 window)
**And** Validation success → Update `member.totp_enabled = true`, `member.totp_enrolled_at = NOW()` (Flyway migration)
**And** HTTP 200: `{ message: "Google OTP registration completed." }`

**Given** confirmEnrollment attempt with invalid totpCode
**When** TOTP code mismatch
**Then** HTTP 401 `{ code: "AUTH-010", message: "Invalid authentication code. Please check the current code in the app." }`
**And** Maintain `totp_enabled = false` (Retry allowed)

**Given** `GET /api/v1/members/me/totp/status`
**When** Request processed
**Then** HTTP 200: `{ totpEnabled: true/false, enrolledAt: "2026-02-24T10:00:00Z" | null }`

**Given** `DELETE /api/v1/members/me/totp` with `{ currentPassword }` (TOTP reset request)
**When** Password check passed (BCrypt verify)
**Then** Delete TOTP secret for memberId from Vault
**And** Reset `member.totp_enabled = false`, `member.totp_enrolled_at = null`
**And** Return HTTP 204 (Re-registration possible via `/totp/enroll` hereafter)

**DB Flyway migration (`V?__add_totp_fields_to_member.sql`):**
```sql
ALTER TABLE member ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE member ADD COLUMN totp_enrolled_at TIMESTAMP NULL;
```

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + WireMock Vault)
**When** Run TOTP Enrollment flow integration test
**Then** enroll → Receive QR URI → Calculate current code with `Totp.create(secret).now()` library → confirm → Verify `totp_enabled=true`
**And** Verify HTTP 401 AUTH-010 on confirm with wrong code
**And** DELETE totp → Verify `totp_enabled=false`
**And** Vault WireMock stub: `PUT /v1/secret/fix/member/{memberId}/totp-secret`, `GET /v1/secret/fix/member/{memberId}/totp-secret`, `DELETE /v1/secret/fix/member/{memberId}/totp-secret`

---

### Story 1.9: Frontend — SSE Session Expiry & Error UX

As a **logged-in user**,
I want to receive advance warning before my session expires and for session errors to be clearly communicated,
So that I can extend my session or be gracefully redirected to login.

**Depends On:** Story 1.8, Story 1.7, Story 1.3

**Acceptance Criteria:**

**Given** SSE `session-expiry { remainingSeconds: 300 }` event received
**When** Client EventSource listener executes
**Then** Show Toast "Automatic logout in 5 minutes. Do you want to continue?"
**And** Clicking "Continue" button calls `GET /api/v1/auth/session` → Reset Session TTL to 30 min

**Given** HTTP 401 response received (Session expired)
**When** Axios response interceptor executes (< 10 lines)
**Then** If `SESSION_EXPIRED_BY_NEW_LOGIN` code, show toast "Session ended due to login from another device."
**And** For other 401s, show toast "Session expired. Please login again." once
**And** Redirect to `/login` (Prevent infinite loop)

**Given** SSE EventSource connection lost
**When** Reconnection attempts 3 times (backoff 5s, 10s, 30s) all fail
**Then** Show warning via Client-side timer (25 min after last activity)

**Given** Playwright (or Cypress) E2E Test Environment Setup
**When** Execute Login → Account List → Logout flow
**Then** Prepare structure to verify normal response at each step
**Note:** Actual E2E scenario implementation will be completed in Epic 8

---

## Epic 2: Transfer Initiation & OTP

Authenticated users initiate a transfer (TransferSession INPUT state), verify OTP, and proceed the session to AUTHED state. Insufficient balance, limit exceeded, OTP expiry, and duplicate attempts are all handled safely.

> **TransferSession FSM:** `INPUT → OTP_PENDING → AUTHED → EXECUTING → COMPLETED | FAILED | EXPIRED`
> **Redis Keys:** `ch:txn-session:{transferSessionId}` (TTL 600s), `ch:totp-used:{memberId}:{windowIndex}:{code}` (TTL 60s — Replay Prevention), `ch:otp-attempts:{transferSessionId}` (TTL per-session count), `ch:otp-attempt-ts:{transferSessionId}` (TTL 1s debounce)
> **TOTP Secret Storage:** Vault `secret/fix/member/{memberId}/totp-secret` (FR-TOTP-04 — DB storage strictly prohibited)

---

### Story 2.1: Transfer Session Initiation & Status API

As an **authenticated user**,
I want to initiate a transfer session specifying source account, destination account number, and amount,
So that I can proceed through the OTP verification step before the transfer is executed.

**Depends On:** Story 1.4 (Account Inquiry API), Story 1.2 (Spring Session Auth)

**Acceptance Criteria:**

**Given** `POST /api/v1/transfers/sessions` with `{ fromAccountId, toAccountNumber, amount, clientRequestId }` (Valid JSESSIONID cookie)
**When** `TransferSessionService.initiate()` runs
**Then** `clientRequestId` is **generated by client as `crypto.randomUUID()`** — allows safe retry with same ID if network response is lost (John, FR-22)
**And** `fromAccountId` ownership verified (HTTP 403 `TRF-006` if not own account) — Handled by `SessionOwnershipValidator` common component (Winston)
**And** `amount` > 0 verified (HTTP 400 `TRF-001` if ≤ 0)
**And** `toAccountNumber` format verified (HTTP 400 `TRF-004` if mismatch `^\d{10,14}$`) — Reject 9/15 digits or non-numeric cases
**And** Self-transfer blocked (HTTP 400 `TRF-004` if `fromAccount.accountNumber == toAccountNumber`)
**And** TOTP non-enrollment check: `member.totp_enabled = false` → HTTP 403 `{ code: "AUTH-009", message: "Google OTP registration is required. Please register Google Authenticator in settings first.", enrollUrl: "/settings/totp/enroll" }` — Immediate return without session creation (Quinn, FR-TOTP-02)
**And** Real-time balance inquiry via corebank-service `GET /internal/v1/accounts/{accountId}/balance`
**And** `amount > availableBalance` → HTTP 422 `{ code: "TRF-002", message: "Insufficient balance.", availableBalance: N, requestedAmount: M }` (FR-49)
**And** Daily transfer accumulation check: SUM `amount` from `channel_db.transfer_sessions` where `status IN ('OTP_PENDING','AUTHED','EXECUTING','COMPLETED') AND DATE(created_at)=CURDATE() AND from_account_id=?` — **Must include EXECUTING** to prevent TOCTOU (Bob, Winston)
**And** Accumulated + amount > `Account.dailyLimit` → HTTP 422 `{ code: "TRF-003", message: "Daily transfer limit exceeded.", remainingLimit: N }` (FR-47)
**And** `Account.dailyLimit` default = **₩5,000,000** (`corebank_domain.Account` entity field, externalized via `DAILY_LIMIT_DEFAULT`) — Separate from seed data demo value ₩500,000 (Mary, FR-51)
**And** Verification Pass: `TransferSession` created (status: `OTP_PENDING`, sessionId: UUID, clientRequestId UNIQUE INDEX)
**And** Redis `ch:txn-session:{sessionId}` saved with TTL 600s
**And** HTTP 201: `{ sessionId, status: "OTP_PENDING", fromAccountId, toAccountNumber, amount, expiresAt }`

**Given** Retry with same `clientRequestId` (**Same User**)
**When** UNIQUE INDEX collision detected
**Then** HTTP 200: Return existing `TransferSession` response (No re-execution, full idempotency guarantee, FR-22) — Client can safely retry same UUID on network delay (Party Mode Decision: #2, #3)
**And** No new `TransferSession` record created
**And** Response body has same structure as initial creation response `{ sessionId, status, fromAccountId, toAccountNumber, amount, expiresAt }`

**Given** Request with `clientRequestId` owned by **another member**
**When** UNIQUE INDEX collision + Ownership check failed (memberId mismatch)
**Then** HTTP 403 `{ code: "TRF-006", message: "Access denied." }` — Block attempt to use other's request ID (Security defense, party mode decision: #2)

**Given** `fromAccountId` request for non-existent account ID
**When** Ownership lookup fails
**Then** HTTP 404 `{ code: "TRF-005" }`

**Given** `GET /api/v1/transfers/sessions/{sessionId}/status` (Valid JSESSIONID cookie)
**When** `SessionOwnershipValidator` passes ownership check (Winston — applied to all session endpoints)
**Then** HTTP 200: `SessionStatusResponse` — Includes status-specific fields (Mary, D-014 `NON_NULL` setting auto-excludes null fields):
```json
{
  "sessionId": "uuid",
  "status": "COMPLETED",
  "fromAccountId": 1,
  "toAccountNumber": "110-1234-5678",
  "amount": 100000,
  "remainingSeconds": null,
  "transactionId": "uuid",
  "fromBalance": 900000,
  "failureReason": null,
  "createdAt": "2026-02-24T10:00:00Z"
}
```
**And** `remainingSeconds`: included only in `OTP_PENDING`/`AUTHED` state (Calculated from Redis TTL)
**And** `transactionId`: included only in `COMPLETED`/`FAILED` state (FR-25)
**And** `fromBalance`: included only in `COMPLETED` state (FR-48)
**And** `failureReason`: included only in `FAILED` state (`INSUFFICIENT_BALANCE`/`FEP_ERROR`/`INTERNAL_ERROR`, FR-54)

**Given** `SessionStatusResponse` OpenAPI schema contract lock (Party Mode Decision: #1 — Winston)
**When** Story 2.1 PR merges
**Then** `SessionStatusResponse` schema explicitly defined via `channel-service/src/main/resources/openapi/transfer-schemas.yaml` or SpringDoc `@Schema` annotation
**And** `GET /swagger-ui.html` → `/api/v1/transfers/sessions/{sessionId}/status` endpoint response model visible in UI (Contract fixed before Epic 5 SSE integration)
**And** `SessionStatusResponse` all fields: `sessionId(UUID)`, `status(Enum)`, `fromAccountId(Long)`, `toAccountNumber(String)`, `amount(Long)`, `remainingSeconds(Integer, nullable)`, `transactionId(UUID, nullable)`, `fromBalance(Long, nullable)`, `failureReason(String, nullable)`, `createdAt(ISO8601)` — Version up required for changes in later Stories

**Given** `channel-transfer/` module structure (L — Bob/Amelia)
**Then** Package path `io.github.yeongjae.fix.channel.transfer.{subpackage}`:
- `domain/TransferSession.java` — `@Entity`, FSM status enum
- `service/TransferSessionService.java` — `initiate()`, `getStatus()`
- `service/OtpService.java` — `generate()`, `verify()`
- `service/SessionOwnershipValidator.java` — `@Component`, `validateOwner(sessionId, memberId)` — Reused in Story 2.2/2.3 execute
- `controller/TransferController.java` — POST /sessions, GET /sessions/{id}/status
- `controller/OtpController.java` — POST /sessions/{id}/otp, POST /sessions/{id}/otp/verify

**Given** Non-existent or expired sessionId inquiry
**When** Redis key missing
**Then** HTTP 404 `{ code: "TRF-008", message: "Transfer session not found." }`

**Given** SessionId inquiry of another member
**When** Ownership verification fails
**Then** HTTP 403 `{ code: "TRF-006" }`

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + Redis)
**When** Run transfer session creation integration test
**Then** Pass all cases: insufficient balance, limit exceeded, duplicate clientRequestId, normal creation
**And** Verify Redis TTL set exactly within 600s
**And** Verify `COMPLETED` session Status API response includes `transactionId`, `fromBalance` and excludes `remainingSeconds` (Jackson `NON_NULL`)

---

### Story 2.2: TOTP Step-Up Verification

As an **authenticated user with a pending transfer session**,
I want to enter my Google Authenticator code to advance the session to AUTHED state,
So that my transfer completes step-up authentication before execution.

**Depends On:** Story 2.1, Story 1.8

**Acceptance Criteria:**

**Given** `POST /api/v1/transfers/sessions/{sessionId}/otp/verify` with `{ totpCode: "123456" }`
**When** TOTP Verification (Session status: `OTP_PENDING`)
**Then** `SessionOwnershipValidator` checks ownership (Winston)
**And** RULE-015 debounce applied: `SET ch:otp-attempt-ts:{sessionId} NX EX 1` → if key exists HTTP 429 `AUTH-004` (No attempt count consumed)
**And** Vault `secret/fix/member/{memberId}/totp-secret` retrieval → `TotpOtpService.verify(sessionId, totpCode, memberId)` execution
**And** RFC 6238 ±1 window allowance (windowIndex = epochSeconds / 30, ±1 range sequential verification, Murat):
```java
long windowIndex = clock.instant().getEpochSecond() / 30;
for (long w = windowIndex - 1; w <= windowIndex + 1; w++) {
    if (totpMatches(vaultSecret, w, totpCode)) { /* match */ }
}
```
**And** Replay Prevention: `ch:totp-used:{memberId}:{windowIndex}:{code}` `SETNX TTL 60s` — Re-use of same code within same window → HTTP 401 `{ code: "AUTH-011", message: "Code already used. Please check new code in app." }` (W Decision: memberId scope, conservative multi-device block)
**And** Verification Success → Change session status to `AUTHED`
**And** Redis `ch:txn-session:{sessionId}` status update, TTL maintained
**And** HTTP 200: `{ sessionId, status: "AUTHED", message: "Verification successful." }`

**Given** Invalid TOTP code input (±1 window mismatch)
**When** TOTP Mismatch
**Then** `ch:otp-attempts:{sessionId}` DECR atomic execution
**And** HTTP 401 `{ code: "AUTH-003", remainingAttempts: N }` (N > 0)
**And** remainingAttempts == 0 → Session status `FAILED`, HTTP 401 `{ code: "AUTH-005", message: "Max verification attempts exceeded. Please restart transfer." }` (FR-16)

**Given** `verify` request when session status is NOT `OTP_PENDING`
**When** FSM state check fails
**Then** Status-specific response (Quinn):
- `AUTHED` → HTTP 409 `{ code: "TRF-009", message: "Session already authenticated.", currentStatus: "AUTHED" }`
- `EXECUTING` → HTTP 409 `{ code: "TRF-009", message: "Transfer is in progress.", currentStatus: "EXECUTING" }`
- `COMPLETED` / `FAILED` / `EXPIRED` → HTTP 409 `{ code: "TRF-009", message: "Terminated transfer session.", currentStatus: "COMPLETED" }`

**Given** `verify` request after Session TTL(600s) expiry
**When** `ch:txn-session:{sessionId}` key missing
**Then** HTTP 404 `{ code: "TRF-008", message: "Transfer session not found." }`

**Given** Two concurrent OTP verify requests on same session (Both valid TOTP codes, Party Mode Decision: #6 — Winston/Murat)
**When** Two requests enter `TotpOtpService.verify()` simultaneously
**Then** Exactly 1 request returns HTTP 200 `AUTHED`
**And** The other returns HTTP 409 `{ code: "TRF-009", message: "Session is already being processed.", currentStatus: "AUTHED" }`
**And** `TransferSession.status` becomes `AUTHED` (Double transition impossible)
**And** `TransferSession` entity's `@Version Long version` Optimistic Lock detects collision at DB level: `UPDATE transfer_sessions SET status='AUTHED', version=v+1 WHERE id=? AND status='OTP_PENDING' AND version=v`
**And** `TotpOtpService.verify()` — **Absolutely NO** `@Retryable` — Retrying OptimisticLockException violates security (Amelia)

**Given** `TransferSessionConcurrencyTest` (Testcontainers MySQL + Fixed Clock)
**When** Execute concurrent OTP verify with 2 threads using `CountDownLatch`
**Then** Verify exactly 1 success (200 AUTHED) + 1 failure (409 Conflict)
**And** Confirm final DB `transfer_sessions.status = 'AUTHED'`

**Given** `TotpOtpService` design (`OtpService` interface implementation — Amelia, R)
**Then** Inject `Clock clock` into constructor (`Clock.systemUTC()` production, `Clock.fixed()` test):
```java
public interface OtpService {
    TotpEnrollResult generateSecret(Long memberId);         // Story 1.8 Enrollment
    boolean confirmEnrollment(Long memberId, String code);  // Story 1.8 Enrollment Verification
    OtpVerifyResult verify(String sessionId, String code, Long memberId); // Story 2.2
}
```
**And** Library: `com.warrenstrange:googleauth:1.5.0`
**And** Vault client: `org.springframework.vault:spring-vault-core`
**And** `channel-transfer/service/TotpOtpService.java` — `io.github.yeongjae.fix.channel.transfer.service`

**Given** `TotpSecretRepository` interface extraction (Pre-contract for Story 6.4 Vault migration)
**When** Designing `TotpOtpService`
**Then** Define `TotpSecretRepository` interface (Guarantee implementation swappability):
```java
public interface TotpSecretRepository {
    void save(Long memberId, String base32Secret);         // Save secret
    Optional<String> findByMemberId(Long memberId);        // Find secret
    void deleteByMemberId(Long memberId);                  // Withdrawal/Reset
}
```
**And** Default implementation: `DatabaseTotpSecretRepository implements TotpSecretRepository` `@Profile("!vault")` — `@EncryptedColumn` AES-256 DB storage
**And** `TotpOtpService` only references `TotpSecretRepository` interface — No service code change during Story 6.4 Vault migration (Bob, issue Y)
**And** Verify Story 6.4 `VaultTotpSecretService` can replace via same interface with `@SpringBootTest` unit test

**Given** `DevToolController` (`@Profile("local,dev")`)
**When** Need to check current TOTP code in Dev/Demo environment
**Then** `GET /api/v1/dev/sessions/{sessionId}/totp-code` → Retrieve from Vault, calculate server-side current code and return
**And** `@Operation(hidden = true)` — No Swagger exposure, physically excluded in production build (Barry)

**Given** `ChannelIntegrationTestBase` (Real Redis + WireMock Vault)
**When** Execute TOTP integration test
**Then** Normal verification, exceed limit, debounce(retry within 1s), ±1 window boundary, replay protection cases all pass
**And** **Replay Protection Test (Murat — Fixed Clock method):**
```java
Clock fixedClock = Clock.fixed(Instant.parse("2026-02-24T10:00:15Z"), ZoneOffset.UTC);
String validCode = generateTotpForClock(vaultSecret, fixedClock); // windowIndex fixed
otpService.verify(sessionId, validCode, memberId); // First success
assertThrows(ReplayAttackException.class,
    () -> otpService.verify(sessionId, validCode, memberId)); // AUTH-011
```
**And** Session TTL expiry test: Manually call `redisTemplate.delete("ch:txn-session:{sessionId}")` → Verify TRF-008
**And** Do not use `Thread.sleep()` based waiting (Comply with CI NFR-T4 8 minutes)
**And** WireMock Vault stub: `GET /v1/secret/fix/member/{memberId}/totp-secret` → Return Base32 test secret

---

### Story 2.3: Frontend — Transfer Flow FSM (Step A & B)

As a **logged-in user on the Dashboard**,
I want to initiate a transfer and verify OTP within a modal without page reload,
So that the transfer flow feels fast and consistent with Korean mobile banking UX.

**Depends On:** Story 2.1, Story 2.2, Story 1.7

**Acceptance Criteria:**

**Given** Click "Transfer" button on DashboardPage
**When** `<TransferModal>` renders
**Then** No URL change (NFR-UX1) — Confirm 0 Document type requests in Network tab
**And** `useReducer(transferReducer, { step: 'INPUT', clientRequestId: crypto.randomUUID(), sessionId: null, otpExpiresAt: null, sessionExpiresAt: null, otpRemainingAttempts: 3 })` initial state — `clientRequestId` generated **immediately on client** at modal mount (John, Barry)
**And** Step A: Withdraw account, Deposit account number, Transfer amount input fields shown
**And** Amount display: Apply `formatKRW()` (₩1,000,000 format)

**Given** Click "Next" button in Step A
**When** Calling `POST /api/v1/transfers/sessions` (includes `clientRequestId`)
**Then** `data-testid="transfer-next-btn"` disabled + loading spinner shown (Prevent double click)

**Given** Transfer session creation success (HTTP 201)
**When** Response received
**Then** FSM dispatch `{ type: 'SESSION_CREATED', sessionId, expiresAt }` → transition to step `'OTP'`
**And** Save `sessionExpiresAt = Date.now() + (ms remaining until expiresAt)` state
**And** Step B: Show OTP input screen
**And** OTP Input UI: **6 split `<input maxLength={1}>` boxes** — `aria-label="Verification code digit {n}"` (Sally, Korean mobile banking standard)
**And** Instruction: "Please enter the current 6-digit code from Google Authenticator app"
**And** Timer Visual Hierarchy (Party Mode Final Decision: Adopt Sally's recommendation):
  - **[Priority 1 — Main Emphasis]** OTP TTL Countdown (`data-testid="otp-countdown"`) — `180s → 0s`, Bold/Large font, turns Red (under 30s), immediately transition to `OTP_EXPIRED` state when reaching 0s
  - **[Priority 2 — Sub Display]** TOTP 30s Window Countdown (`data-testid="otp-timer"`) — Based on `Math.ceil(Date.now() / 30000) * 30000`, small faint text: "App code refreshes in {N}s", Inline guide "Check new code in app" when 0s (No animation — minimize distraction)
  - **[Priority 3 — Conditional Display]** Session Remaining Time (`data-testid="session-timer"`) — **Hidden by default**, shows only when `sessionExpiresAt` is under 60s: "⚠️ Transfer session expires in {N}s" (Orange warning banner)
**And** Use `vi.useFakeTimers()` to verify timer progress without real wait in `setInterval` unit tests (Murat — Comply with CI NFR-T5 2 minutes)

**Given** Insufficient balance response (HTTP 422 TRF-002)
**When** Error handled
**Then** `data-testid="transfer-error-msg"`: "Insufficient balance. Withdraw account balance: ₩{availableBalance} / Transfer amount: ₩{amount}" (role="alert")
**And** Stay in Step A (Re-entry possible)

**Given** OTP 6-digit input completed
**When** Last digit entered
**Then** Automatically call `POST /api/v1/transfers/sessions/{sessionId}/otp/verify` without manual confirm button (OTP auto-submit)
**And** Verify auto-submit with `userEvent.type(input, '123456')` test

**Given** OTP verification success (HTTP 200 AUTHED)
**When** Response received
**Then** FSM dispatch `{ type: 'OTP_VERIFIED' }` → step `'CONFIRM'` (Implemented in Epic 4 Story 4.4)

**Given** TOTP code mismatch (Window mismatch, HTTP 401 AUTH-003) or Replay protection (AUTH-011)
**When** Error received
**Then** Red border on each input box + `data-testid="otp-error-msg"`: "Invalid code. Remaining attempts: {remainingAttempts}" (role="alert")
**And** Reset input fields (Re-entry possible)
**And** No "Resend" UI as TOTP 30s window automatically generates next code — Only show "Check new code in app" guide when countdown reaches 0
**And** FSM state: Remove `OTP_REISSUED` action — 30s window expiry is just `totpWindowExpiresAt` auto-refresh (setInterval 1s)

**Given** Limit exceeded (HTTP 401 AUTH-005)
**When** Error received
**Then** "Authentication limit exceeded. Please restart transfer." + [Start Over] button
**And** Click [Start Over] → FSM `{ type: 'RESET' }` → Initialize to step `'INPUT'`

**Given** `import.meta.env.DEV` environment TOTP code auto-lookup helper (Barry)
**When** Developer calls `window.__fixDev.getOtp(sessionId)` in browser console
**Then** `GET /api/v1/dev/sessions/{sessionId}/totp-code` → Return current TOTP code (DevToolController `@Profile` local,dev)
**And** `import.meta.env.DEV` guard allows `window.__fixDev` unregistered in production build
**And** `fix-web/src/lib/devTools.ts` — `window.__fixDev = { getOtp: async (sessionId: string) => ... }` (Production build tree-shaking, `import.meta.env.DEV` guard)

**Given** OTP expiry detected in `step: 'OTP'` state — Epic 2 polling strategy (Party Mode Decision: #8 — Amelia/Sally)
**When** `useEffect` polling active (10s interval)
**Then** Run `setInterval(() => api.get('/transfers/sessions/{sessionId}/status'), 10_000)` while `step === 'OTP'`
**And** Response `status === 'OTP_EXPIRED'` → FSM `dispatch({ type: 'OTP_EXPIRED' })` → `step: 'OTP_EXPIRED'` transition
**And** `status === 'AUTHED'` (Authenticated on other device/window) → FSM `dispatch({ type: 'OTP_VERIFIED' })` → Auto transition to `step: 'CONFIRM'`
**And** `useEffect` cleanup: Call `clearInterval()` (On component unmount or `step` change)
**And** **Replace this polling with SSE subscription in Epic 5 Story 5.2** — Same `dispatch` interface, only internal implementation of `useTransfer` hook changes (Progressive enhancement, no change to parent component)

**Given** `step: 'OTP_EXPIRED'` state (OTP TTL 180s expired, Party Mode Decision: #8 — Sally)
**When** Polling detected or Frontend countdown reached 0s
**Then** Show expiry message instead of OTP input screen: `data-testid="otp-expired-msg"`: "OTP has expired. Do you want to restart transfer?"
**And** `data-testid="otp-retry-btn"`: "Restart Transfer" button shown
**And** Click [Restart Transfer] → FSM `{ type: 'RESET' }` → Initialize to step `'INPUT'` (Pre-fill previous form values)
**And** Countdown timer (`data-testid="otp-countdown"`) displayed before expiry: 180s → 0s (Sally)
**And** When countdown reaches 0s, frontend timer immediately transitions to `OTP_EXPIRED` state (Regardless of polling cycle, instant UX reaction)

**Given** Close `<TransferModal>` (X button or ESC)
**When** Closing in progress state
**Then** Show confirmation dialog "Do you want to cancel transfer?" then close
**And** Initialize FSM state

---

## Epic 3: Fault Tolerance & FEP Resilience

When the external FEP interface fails repeatedly, Resilience4j Circuit Breaker automatically opens to protect core banking. FepChaosController allows runtime control of failure scenarios (delay, failure rate, mode). Scenario #5 (CB OPEN after 3 failures) passes.

---

### Story 3.1: FEP Simulator — Service & Chaos Controller

As a **developer**,
I want the FEP simulator to support runtime chaos configuration (delay, failure mode, failure rate),
So that I can demonstrate circuit breaker behavior during interviews without code changes.

**Depends On:** Story 0.1 (FEP Service Startup)

**Acceptance Criteria:**

**Given** `POST /fep/v1/interbank/transfer` with `{ fromBankCode, toBankCode, toAccountNumber, amount, referenceId }`
**When** `FepSimulatorService` processes (chaos config OFF)
**Then** HTTP 200: `{ status: "ACCEPTED", fepReferenceId: UUID, processedAt: ISO8601 }`
**And** If `referenceId` is non-existent transferId: `{ status: "REJECTED", reason: "INVALID_ACCOUNT" }` (Simulation)
**And** Request without `X-Internal-Secret` header → HTTP 403 (NFR-S4)

**Given** `PUT /fep-internal/config` with `{ mode: "TIMEOUT", delayMs: 3000, failureRate: 0.0 }` (ROLE_ADMIN Bearer Token)
**When** Chaos config applied
**Then** Subsequent `POST /fep/v1/interbank/transfer` requests delayed by `delayMs` then `ReadTimeoutException` occurs
**And** HTTP 200: `{ mode: "TIMEOUT", delayMs: 3000, failureRate: 0.0 }`

**Given** `PUT /fep-internal/config` with `{ mode: "FAILURE", failureRate: 1.0 }`
**When** Chaos config applied
**Then** All subsequent requests return HTTP 500 `{ status: "SYSTEM_ERROR" }`

**Given** `PUT /fep-internal/config` with `{ mode: "NORMAL" }`
**When** Normal recovery config
**Then** Chaos disabled, normal responses resume

**Given** `GET /fep-internal/config`
**When** Current chaos config queried
**Then** HTTP 200: `{ mode, delayMs, failureRate }` returns current config values (FR-29)

**Given** `GET /actuator/health` on fep-service
**When** Health Check
**Then** HTTP 200 `{ status: "UP" }` (NFR-P3)

**Given** `GET /fep/v1/transfer/{referenceId}/status` (Party Mode Decision: I — Bob, Integration with Story 4.3 Recovery Scheduler)
**When** Story 4.3 `TransferSessionRecoveryService` re-queries FEP
**Then** If `referenceId` was successfully processed by FEP Simulator → Return `{ referenceId, status: "ACCEPTED", processedAt }`
**And** If `referenceId` does not exist in FEP → Return `{ referenceId, status: "UNKNOWN" }` (Return HTTP 200 blindly, do not use 404 — Recovery scheduler logic checks payload shape)
**And** Only allow requests with `X-Internal-Secret` header (NFR-S4)
**And** `FepSimulatorService` stores `Map<String, FepTransactionRecord> processedTransfers` internally — Record `referenceId → ACCEPTED` only on successful `POST /fep/v1/interbank/transfer`

**Given** `POST /fep-internal/simulate-failures?count={N}` (Party Mode Decision: H — John/Amelia, Demo convenience)
**When** Need to quickly prepare CB demonstration during demo
**Then** FEP Simulator internally simulates N fake failed FepRequests to inject N failures into CB sliding window (Temporarily apply FepChaosConfig FAILURE mode then restore)
**And** If `N ≥ slidingWindowSize(3)`, CB enters `OPEN` state immediately after call
**And** Request without `X-Internal-Secret` header → HTTP 403 Forbidden (NFR-S4, Amelia Security Point)
**And** `@Operation(hidden = true)` — No Swagger exposure (Internal tool for demo only)
**And** HTTP 200: `{ injectedFailures: N, circuitBreakerState: "OPEN|CLOSED" }` Return current CB state
**And** Must use `try-finally` block to **guarantee restoration** after applying FAILURE mode — Ensure concurrent real transfer requests do not receive dummy failures (Party Mode Decision: K — Amelia)
**And** `referenceId` of dummy request is generated as `"sim-dummy-{UUID}"` → Not recorded in `processedTransfers` map (Winston Point — Prevent recovery scheduler malfunction)

> **[Design Note — processedTransfers initialization on Fep Simulator restart]** (Party Mode Decision: L — Winston)
> `processedTransfers` is stored in application memory (`ConcurrentHashMap`). When FEP Simulator restarts, the map is initialized, so the recovery scheduler receives `UNKNOWN` and can execute compensation credit.
> **Allowed trade-off within portfolio scope** — In real processing, it would be persisted in Redis or DB. No issue as there is no Docker Compose restart during demo environment. Demonstrate design awareness by mentioning this proactively during interview.

**Given** `FepIntegrationTestBase` (SpringBootTest + WireMock)
**When** FEP Simulator integration test
**Then** Pass NORMAL, TIMEOUT, FAILURE mode transitions and response verification
**And** `GET /fep/v1/transfer/{referenceId}/status` — Verify ACCEPTED/UNKNOWN response
**And** `POST /fep-internal/simulate-failures?count=3` → Verify CB OPEN state

---

### Story 3.2: Circuit Breaker — Resilience4j Integration

As a **backend system**,
I want the circuit breaker to open automatically after 3 consecutive FEP failures,
So that corebank-service is protected from cascading FEP outages.

**Depends On:** Story 3.1, Story 0.1

**Acceptance Criteria:**

**Given** `FepClient` bean annotated with `@CircuitBreaker(name = "fep", fallbackMethod = "fepFallback")` (**`@Retry` NOT applied** — [ADR-FEP-RETRY-001], Party Mode Decision: F)
**When** `InterbankTransferService.send()` called
**Then** Confirm `FepClient` called via Spring AOP proxy (D-005 — No direct new instance usage)
**And** Confirm no `resilience4j.retry` config in `application.yml` — Zero Retry usage
**And** 1 execute request = Exactly 1 failure recorded in CB sliding window (Matches Scenario #5 condition)

**Given** `application.yml` Resilience4j configuration
**When** Checking config file
**Then** Following values are set exactly:
```yaml
resilience4j.circuitbreaker.instances.fep:
  slidingWindowType: COUNT_BASED
  slidingWindowSize: 3
  failureRateThreshold: 100
  waitDurationInOpenState: 10s
  permittedNumberOfCallsInHalfOpenState: 1
  registerHealthIndicator: true
```

**Given** FEP chaos config `mode: TIMEOUT` (ReadTimeoutException occurs)
**When** `InterbankTransferService.send()` called 3 times consecutively (All timeout)
**Then** After 3rd failure, CB state transitions `CLOSED → OPEN`
**And** 4th call is NOT sent to FEP and fallback executes immediately (FR-26)
**And** Fallback returns `{ status: "CIRCUIT_OPEN", reason: "FEP_UNAVAILABLE" }`

**Given** `waitDurationInOpenState` (10s) passes in CB OPEN state
**When** Next request comes
**Then** CB transitions `HALF_OPEN` → 1 test request sent to FEP
**And** If success, recover to `CLOSED`, if failure, return to `OPEN`

**Given** `GET /actuator/circuitbreakers`
**When** Querying CB status
**Then** HTTP 200: `{ circuitBreakers: [{ name: "fep", state: "OPEN|CLOSED|HALF_OPEN", failureRate: N }] }` (FR-28)
**And** Accessible without authentication (`permitAll()` — For demo screenshare purpose, D-015)

**Given** `application-test.yml` Resilience4j test profile override (Party Mode Decision: J — Murat)
**When** `@SpringBootTest` + `@ActiveProfiles("test")` environment
**Then** Override config exists in `application-test.yml`:
```yaml
resilience4j.circuitbreaker.instances.fep:
  waitDurationInOpenState: 1s   # Test environment: Shortened 10s → 1s
```
**And** Production `application.yml` `waitDurationInOpenState: 10s` remains unchanged

**Given** `FepCircuitBreakerIntegrationTest` (Testcontainers + WireMock for FEP stub)
**When** Execute Scenario #5 CB OPEN test
**Then** WireMock returns timeout stub 3 consecutive times
**And** Verify CB enters `OPEN` state (Actuator API or `CircuitBreakerRegistry`)
**And** Confirm FEP WireMock stub is NOT called on 4th invocation (verify 0 invocations)
**And** Test completion time ≤ 10s (NFR-T6 level, sliding window opens immediately)

**Given** CB OPEN → HALF_OPEN → CLOSED recovery path test (Party Mode Decision: J — Murat)
**When** Wait `Thread.sleep(1100)` after CB OPEN (Based on `waitDurationInOpenState: 1s` override)
**Then** Verify CB transitions `HALF_OPEN` (`CircuitBreakerRegistry.getCircuitBreaker("fep").getState()`)
**And** Change WireMock FEP stub to normal response, send 1 request → Verify CB `CLOSED` recovery
**And** `Thread.sleep()` usage allowed ONLY in this test — No CI NFR-T4(8min) violation as `waitDurationInOpenState: 1s`

**Given** `GET /actuator/health` on channel-service
**When** CB OPEN state
**Then** Includes `components.fep.status: "CIRCUIT_OPEN"` (health indicator registered)

---

## Epic 4: Transfer Execution & Ledger Integrity

AUTHED transfer sessions are executed, creating atomic dual entries (DEBIT+CREDIT) in the ledger. Balances never go negative even with 10 concurrent threads, and duplicate requests are handled idempotently. Compensation transactions (rollback) execute upon failure. Scenarios #1, #2, #4, #7 pass.

---

### Story 4.1: Transfer Execution & Ledger (Same-bank & Interbank)

As a **system**,
I want transfer execution to atomically debit source and credit destination accounts with paired ledger entries,
So that the ledger always balances and no transfer results in a negative balance.

**Depends On:** Story 2.2 (AUTHED Session), Story 3.1 (FEP Integration)

**Acceptance Criteria:**

**Given** `POST /api/v1/transfers/sessions/{sessionId}/execute` (Session status: `AUTHED`)
**When** `TransferSessionService.execute()` is called
**Then** Redis `SET ch:txn-lock:{sessionId} NX EX 30` executes atomically
**And** Lock acquisition fails (concurrent request) → HTTP 409 `{ code: "CORE-003", message: "Transfer is already in progress." }`
**And** Session status changes to `EXECUTING`

**Given** Same-bank transfer (`toBankCode == internal bank code`)
**When** `SameBankTransferService.execute()` executes
**Then** `@Transactional(timeout=25)` transaction starts — Guaranteed commit within Redis lock TTL(30s) (party mode decision: B — Amelia)
**And** `accountRepository.findByIdWithLock(sourceId)` → InnoDB `SELECT FOR UPDATE` (ADR-001)
**And** Real-time balance re-validation (defends against balance changes between session creation ~ execution)
**And** `source.balance -= amount` (debit)
**And** `destination.balance += amount` (credit)
**And** `TransferHistory` 2 entries saved atomically: `type: DEBIT, accountId: source, amount: -N` + `type: CREDIT, accountId: dest, amount: +N` (FR-21, FR-44)
**And** Session status `COMPLETED`, `transactionId` (UUID) generated, `postExecutionBalance = source.balance` saved (party mode decision: C — Bob)
**And** Transaction commits
**And** `ch:txn-lock:{sessionId}` Redis key deleted
**And** HTTP 200: `{ sessionId, status: "COMPLETED", transactionId, fromBalance: N, completedAt }` (FR-48, FR-25)

**Given** DB error during transfer execution (Transaction rollback)
**When** Exception occurs
**Then** Balance changes and TransferHistory all rollback (Atomicity guaranteed, FR-44)
**And** Session status changes to `FAILED`
**And** HTTP 500 `{ code: "CORE-001", reason: "INTERNAL_ERROR" }` (FR-54)

**Given** Interbank transfer (`toBankCode != internal bank code`)
**When** `InterbankTransferService.execute()` executes
**Then** `@Transactional(timeout=25)` TX1 starts: source account debit + `TransferHistory(DEBIT)` recorded then commit (FEP call is outside transaction)
**And** FEP `POST /fep/v1/interbank/transfer` called (`referenceId = sessionId` passed — Idempotency key, party mode decision: A)
**And** FEP **HTTP 200 + `status: "ACCEPTED"`** → TX2: credit `TransferHistory(CREDIT)` separate transaction record + session `COMPLETED` + `postExecutionBalance` saved (party mode decision: C)
**And** FEP **HTTP 200 + `status: "REJECTED"`** (Business rejection e.g., account mismatch) → Compensating transaction: source account credit restore + `TransferHistory(COMPENSATING_CREDIT)` record + session `FAILED` + HTTP 422 `{ code: "FEP-002", reason: "REJECTED_BY_FEP" }` (party mode decision: D — Murat)
**And** FEP **HTTP 5xx / timeout / CB OPEN** (Infrastructure failure) → Fallback identical compensating transaction + HTTP 503 `{ code: "FEP-001", reason: "FEP_UNAVAILABLE" }` (FR-54)
**And** HTTP 200 `{status:"REJECTED"}` vs HTTP 5xx failure paths have different error codes and HTTP status codes — Client can distinguish business rejection vs infrastructure failure (FR-54)

**Given** Ledger integrity verification (`LedgerIntegrityIntegrationTest` — Scenario #7)
**When** Verification after N execution transfers
**Then** `SUM(amount WHERE type=DEBIT) + SUM(amount WHERE type=CREDIT) == 0` (NFR-D1)
**And** Count(DEBIT) == Count(CREDIT) (Verify COMPENSATING_CREDIT inclusion if compensating transaction involved)

**Given** `SELECT FOR UPDATE` lock time measurement
**When** Single transfer execution
**Then** lock hold time ≤ 100ms (NFR-P5, local MySQL basis)

**Given** Daily limit re-validation after acquiring `PESSIMISTIC_WRITE` lock — TOCTOU defense (party mode decision: #7 — John/Winston)
**When** Immediately after acquiring source account row lock in `SameBankTransferService.execute()`
**Then** `SELECT SUM(amount) FROM transfer_history WHERE account_id=source AND type='DEBIT' AND DATE(created_at)=TODAY()` re-query
**And** Re-query accumulated amount + amount > `Account.dailyLimit` → Immediately `TransferSession FAILED` + HTTP 422 `{ code: "TRF-003", message: "Daily transfer limit exceeded.", remainingLimit: N }` (FR-47)
**And** Balance change and TransferHistory not recorded (Compensating transaction unnecessary — debit not executed)
**And** This re-validation executes **inside** PESSIMISTIC_WRITE transaction so row-level serialization is guaranteed

**Given** `DailyLimitConcurrencyTest` (Testcontainers MySQL — party mode decision: #7 — Murat)
**When** 2 threads concurrent execution with `CountDownLatch` (Each ₩700,000, limit ₩1,000,000)
**Then** Exactly 1 success (COMPLETED) + 1 failure (DAILY_LIMIT_EXCEEDED, HTTP 422)
**And** `SUM(amount WHERE type='DEBIT' AND date=today AND account=source) ≤ dailyLimit` verification
**And** Failed session's source balance unchanged verification (Confirm compensation unnecessary)

---

### Story 4.2: Idempotency & Duplicate Transfer Protection

As a **system**,
I want duplicate execute requests to return the original result without re-executing the transfer,
So that network retries and double-submission never cause duplicate debits.

**Depends On:** Story 4.1

**Acceptance Criteria:**

**Given** Re-request `POST /api/v1/transfers/sessions/{sessionId}/execute` with `COMPLETED` session ID
**When** Session status checked
**Then** HTTP 200: Returns same `{ transactionId, fromBalance, completedAt }` as original completion (No re-execution, FR-22)
**And** `fromBalance` queried from `TransferSession.postExecutionBalance` column — Real-time `Account.balance` not used (Guarantees same value regardless of subsequent balance changes, party mode decision: C — Bob)

**Given** Re-request with `FAILED` session ID
**When** Session status checked
**Then** HTTP 409 `{ code: "TRF-010", message: "Transfer session failed. Please start a new transfer." }`

**Given** Re-request with `EXECUTING` session ID (Concurrent request)
**When** `ch:txn-lock:{sessionId}` NX fails
**Then** HTTP 409 `{ code: "CORE-003" }` (Duplicate execution protection)

**Given** `clientRequestId` UNIQUE INDEX based double submission prevention (DB level)
**When** Session creation retry with same `clientRequestId`
**Then** `DataIntegrityViolationException` → HTTP 409 `TRF-007` (Same behavior as Story 2.1)

**Given** `IdempotencyIntegrationTest` (Testcontainers MySQL — Scenario #4)
**When** 2 concurrent execute calls with same session (`CountDownLatch` used)
**Then** Exactly 1 actual transfer execution, balance change reflected only once
**And** Both responses return same `transactionId`

---

### Story 4.3: Transfer Session Recovery Service

As a **system**,
I want stuck `EXECUTING` sessions to be automatically recovered after timeout,
So that transient failures during execution never leave accounts in an inconsistent ledger state.

**Depends On:** Story 4.1

**Acceptance Criteria:**

**Given** `TransferSessionRecoveryService` (`@Scheduled(fixedDelay = 60000)`)
**When** Scheduler runs
**Then** Retrieve sessions in `EXECUTING` state updated more than 30s ago
**And** Check if DEBIT record exists in `TransferHistory` for each session
**And** No DEBIT record → Process session as `FAILED` (No balance change)
**And** DEBIT record exists but no CREDIT record → **First re-query FEP status** `GET /fep/v1/transfer/{referenceId}/status` (party mode decision: A — John/Winston):
  - FEP `ACCEPTED` response → Re-execute CREDIT TX: Record `TransferHistory(CREDIT)` + Session `COMPLETED` + Save `postExecutionBalance` (Prevent double deposit)
  - FEP `REJECTED` / `UNKNOWN` / HTTP 5xx → Execute compensating credit + `TransferHistory(COMPENSATING_CREDIT)` + Session `FAILED` (FR-23)
  - FEP re-query itself timeouts/CB OPEN → Execute compensating credit (Conservative processing, Safety first)

**Given** FEP re-query idempotency (`referenceId = sessionId` key based)
**When** Recovery scheduler re-queries FEP status
**Then** FEP Simulator `GET /fep/v1/transfer/{referenceId}/status` → Returns original processing result (FEP internal idempotent storage)
**And** Returns `UNKNOWN` if `referenceId` does not exist in FEP → Execute compensating credit

**Given** Recovery scheduler idempotency guarantee
**When** Scheduler runs twice for same EXECUTING session (Double execution defense)
**Then** Redis `SET recovery:lock:{sessionId} NX EX 120` acquired then processed — Skip already processing sessions
**And** Delete lock key after recovery completion

**Given** No sessions to recover
**When** Scheduler runs
**Then** Process ends normally without action (Log only)

**Given** Normally completed `COMPLETED` session
**When** Scheduler runs
**Then** Exclude session from processing (Status filtering)

**Given** `OTP_PENDING` session with TTL 600s expired (Redis key expired)
**When** Scheduler runs
**Then** Update DB status to `EXPIRED` (Compensation unnecessary — Debit not executed state)

**Given** `TransferSessionRecoveryServiceTest` (Unit test + WireMock FEP stub)
**When** Mock injection of EXECUTING + >30s session
**Then** Case A: WireMock FEP → `ACCEPTED` → Re-execute CREDIT TX + Verify `COMPLETED`
**And** Case B: WireMock FEP → `REJECTED` → Compensating credit + Verify `FAILED`
**And** Case C: WireMock FEP → HTTP 500 → Compensating credit + Verify `FAILED`
**And** Double execution prevention: Verify FEP stub not called on second scheduler call (recovery lock)

---

### Story 4.4: Frontend — Transfer Confirm, Processing & Result (Step C)

As an **authenticated user who passed OTP verification**,
I want to review transfer details before final confirmation and see the result immediately,
So that I can verify accuracy and receive proof of transfer completion.

**Depends On:** Story 2.3 (Step B complete → AUTHED), Story 4.1

**Acceptance Criteria:**

**Given** FSM step `'CONFIRM'` after successful OTP verification
**When** Step C renders
**Then** Display transfer summary card: Source account (Masked), Destination account number, Transfer amount (₩ format), "Do you want to execute transfer?" confirmation message
**And** `data-testid="transfer-confirm-btn"` (Execute Transfer) + `data-testid="transfer-cancel-btn"` (Cancel)

**Given** "Execute Transfer" button click
**When** `POST /api/v1/transfers/sessions/{sessionId}/execute` calling
**Then** FSM `{ type: 'EXECUTING' }` → `data-testid="transfer-processing-msg"`: "Processing transfer. Please wait."
**And** Button fully disabled (Double click prevention, FR-22)

**Given** Transfer success response (HTTP 200 COMPLETED)
**When** Response received
**Then** FSM `{ type: 'COMPLETED', result }` → Display result screen
**And** `data-testid="transfer-ref"`: Display transaction reference number (transactionId) (FR-25)
**And** `data-testid="balance-after"`: Display source account balance after processing (₩ format) (FR-48)
**And** `data-testid="balance-after"` value ≥ 0 (NFR-D1 — Visual verification of non-negative balance)
**And** "Transfer completed." success message

**Given** Insufficient balance (Re-validation on execution, HTTP 422)
**When** Error response
**Then** `data-testid="transfer-error-msg"`: "Insufficient balance." + [Go to Start] button

**Given** FEP failure / CB OPEN (HTTP 503)
**When** Error response
**Then** `data-testid="cb-fallback-msg"`: "Temporary error occurred. Please try again later." (NFR-UX1 — Immediate display)

**Given** Transfer completion result screen
**When** "Confirm" button click
**Then** Close Modal + Refresh account list balance on DashboardPage (`GET /api/v1/accounts`)

**Given** Session storage upon entering Step B (OTP entry screen) — party mode decision: E (Sally/Winston)
**When** Immediately after FSM `SESSION_CREATED` dispatch (Transitioning to `step: 'OTP'`)
**Then** Save `sessionStorage.setItem('lastTransferSessionId', sessionId)` (Support tab recovery even before Step C)

**Given** Browser tab close and reconnect (Recover in-progress session) (Sally, FR-18)
**When** `DashboardPage` mounts (`useEffect`)
**Then** Check `sessionStorage.getItem('lastTransferSessionId')` (Sally — `sessionStorage` not `localStorage`: auto-remove on tab close, maintain on refresh)
**And** If `lastTransferSessionId` exists, call `GET /api/v1/transfers/sessions/{sessionId}/status`
**And** Response status = `COMPLETED` → Automatically display result Modal including `transactionId`, `fromBalance` + Delete `sessionStorage` key
**And** Response status = `FAILED` → Display failure guide Modal (Korean message based on `failureReason`) + Delete `sessionStorage` key
**And** Response status = `EXECUTING` → Display banner "Transfer is processing. Please check again in a moment." (No polling after recovery — receive result via SSE)
**And** Response status = `OTP_PENDING` + `remainingSeconds > 0` → Display popup "Previous transfer is awaiting OTP verification. Do you want to continue?" + [Continue] button: Restore TransferModal to `step: 'OTP'` state (party mode decision: E — Sally/Winston)
**And** Response status = `OTP_PENDING` + `remainingSeconds = 0` (Expired) → Delete `sessionStorage` key, Do not display recovery UI
**And** HTTP 404 (Session expired) or 403 → Delete `sessionStorage` key, Do not display recovery UI
**And** Re-save `sessionStorage.setItem('lastTransferSessionId', sessionId)` immediately before calling `POST /api/v1/transfers/sessions/{sessionId}/execute` (Step C entry point, explicitly re-save to correct status check timing even if already saved in Step B)

---

## Epic 5: Real-time Notifications

Transfer execution results are delivered to the user immediately via SSE (Server-Sent Events). Automatic reconnection occurs 3 times if disconnected, and missing notifications can be retrieved via fallback API after reconnection. Transfer results can be checked even after closing and reopening the browser tab.

---

### Story 5.1: SSE Notification Backend

As a **system**,
I want to push transfer result notifications to connected clients in real time and persist them for fallback retrieval,
So that users receive immediate feedback and can recover missed notifications after reconnection.

**Depends On:** Story 4.1 (Transfer Completed Event), Story 1.2 (Spring Session Auth)

**Acceptance Criteria:**

**Given** `GET /api/v1/notifications/stream` (Valid JSESSIONID cookie)
**When** SSE connection established
**Then** Response `Content-Type: text/event-stream;charset=UTF-8`
**And** Create `SseEmitter(Long.MAX_VALUE)` — No timeout (D-019)
**And** Send heartbeat event immediately upon connection: `event: heartbeat\ndata: {}\n\n`
**And** Single registration `memberId → SseEmitter` in `SseEmitterRegistry` (ADR-SSE-REGISTRY-001)
**And** If new connection with same `memberId`, call `SseEmitter.complete()` on existing one and replace (Ensure single connection, Consistent with `maximumSessions(1)` policy)
**And** Remove from registry on connection completion (`onCompletion`, `onTimeout`)
**And** Single instance assumption — Redis pub/sub needed for multi-instance environment (Out of current scope, see ADR-SSE-REGISTRY-001)

**Given** `CORS` configuration with `allowCredentials=true` + SSE endpoint included
**When** Frontend connects with `EventSource({ withCredentials: true })`
**Then** SSE connection established without CORS preflight request (`EventSource` uses GET only)
**And** `HttpOnly` cookie included (Session authentication)

**Given** Transfer `COMPLETED` or `FAILED` event occurs (Story 4.1)
**When** `NotificationService.send(memberId, notificationPayload)` called
**Then** D-013 dual-write order: ① `channel_db.notifications` INSERT (persist) ② `SseEmitter.send()` (@Async, RULE-013)
**And** SSE event format: `event: notification\ndata: {"notificationId":N,"type":"TRANSFER_COMPLETED","message":"₩X transfer completed.","transferId":"UUID","createdAt":"ISO8601"}\n\n`
**And** DB save success even if SSE client is disconnected (FR-31)

**Given** `GET /api/v1/notifications` (Valid JSESSIONID cookie)
**When** Retrieve notification list
**Then** HTTP 200: `{ content: [...], totalElements, ... }` Pagination response (FR-32)
**And** Sort by `createdAt DESC`, default `size=20`
**And** Include `isRead` field

**Given** `PATCH /api/v1/notifications/{notificationId}/read`
**When** Mark notification as read
**Then** HTTP 204, Update `notifications.is_read = true`

**Given** `SseEmitter.send()` failure (Client disconnected)
**When** `IOException` occurs
**Then** Call `SseEmitter.completeWithError()` + Remove from registry (Do not ignore error)
**And** DB record is already completed (Guaranteed by dual-write order)

**Given** `@Async SSE` Integration Test (Using `@TestConfiguration` `SyncTaskExecutor`, RULE-019)
**When** Test notification sending after transfer completion
**Then** Synchronous verification possible without separate thread wait thanks to `SyncTaskExecutor`
**And** Use `Awaitility.await().atMost(3, SECONDS).until(() -> notificationRepository.count() > 0)` when verifying DB save in async context
**And** SSE stream endpoint test: `mockMvc.perform(...).andExpect(request().asyncStarted())` pattern
**And** Do not use `Thread.sleep()` in SSE related tests — Substitute with `SyncTaskExecutor` or `Awaitility`

**Given** Notification retention policy
**When** Notification creation
**Then** Set `expires_at = transferSession.expiresAt + 24h`
**And** `@Scheduled` daily cleanup: `DELETE WHERE created_at < now() - INTERVAL 25 HOUR` (24h + 600s buffer)

**Given** `Flyway V3__create_notification_table.sql` (channel_db)
**When** Service startup
**Then** Create `notifications` table: `id, member_id, type, message, transfer_id, is_read, created_at, expires_at`
**And** Include `expires_at DATETIME NOT NULL` column (Track notification retention period)

---

### Story 5.2: SSE Frontend — NotificationContext & Reconnection

As a **logged-in user**,
I want real-time transfer notifications with automatic SSE reconnection,
So that I receive immediate results without polling and never miss a notification after brief disconnection.

**Depends On:** Story 5.1, Story 1.7

**Acceptance Criteria:**

**Given** Authenticated user enters app (`<NotificationProvider>` mount)
**When** `useEffect` runs
**Then** Create single `EventSource` instance (`withCredentials: true`)
**And** On `event: notification` receipt, execute `dispatch({ type: 'ADD_NOTIFICATION', payload })`
**And** Network tab shows `GET /api/v1/notifications/stream` as `EventStream` type

**Given** SSE connection lost (`onerror` event)
**When** Error detected
**Then** 1st reconnection attempt (1s delay)
**And** If failed, 2nd (2s delay), 3rd (3s delay) — Exponential backoff
**And** Stop reconnection after 3 failures → Auto-call `recoverTransferSession()` in `hooks/useTransferRecovery.ts` (Shared hook with Story 4.4, Item R)
**And** Inside `recoverTransferSession()`: `sessionStorage.getItem('lastTransferSessionId')` → `GET /transfers/sessions/{id}/status` → Display modal based on status
**And** Show `data-testid="sse-error-msg"`: "Notification connection lost. Please refresh the page." only if `recoverTransferSession()` API fails (404/403) (NFR-UX2 fallback)
**And** Upon successful reconnection, recover missing notifications by calling fallback `GET /api/v1/notifications?since={lastEventTime}` (FR-31)

**Given** SSE `notification` event received after transfer completion
**When** `NotificationContext` dispatch
**Then** Immediately add new notification to `data-testid="notification-item"` list (re-render)
**And** Notification item: "Transfer of ₩{amount} to account {toAccountNumber} completed." + Transaction reference number

**Given** NotificationFeed screen (`/notifications`)
**When** Rendering
**Then** Retrieve `GET /api/v1/notifications` and display list
**And** Empty list → Show "No notifications yet." empty state
**And** Click individual notification → Mark as `read` (`PATCH /api/v1/notifications/{id}/read`)

**Given** Epic 2 Story 2.3 10s Polling → SSE Transition (RULE-020)
**When** Receive SSE `notification` event in `NotificationContext`
**Then** Publish `window.dispatchEvent(new CustomEvent('transfer-notification', { detail: notification }))`
**And** `useTransfer` hook: Remove existing 10s polling `useEffect` → Replace with `addEventListener('transfer-notification', handler)` subscription
**And** Maintain same `dispatch` interface (No changes needed for `TransferModal`, `DashboardPage`)
**And** Include validation test for removing Story 2.3 polling code

**Given** `hooks/useTransferRecovery.ts` Shared Hook (Story 4.4 & Story 5.2)
**When** SSE 3 failures or Dashboard recovery scenario
**Then** Reuse same `recoverTransferSession()` function (Prohibit duplicate implementation)
**And** `useCallback` + `sessionStorage.getItem('lastTransferSessionId')` → API call → Status based modal dispatch pattern

**Given** `vitest` unit test with `MockEventSource` stub (`src/test/setup.ts`)
**When** Test execution
**Then** Simulate `onerror` with `EventSource` mock → Verify 3 reconnection logic
**And** Verify `recoverTransferSession()` call after 3 failures (Display error message fallback if API fails)

**Given** Logout (`<NotificationProvider>` unmount)
**When** Cleanup runs
**Then** Call `EventSource.close()` to clearly terminate SSE connection

---

## Epic 6: Security, Audit & Administration

All user actions are recorded in audit logs, and administrators can force-invalidate sessions and query audit history. PII (account numbers, passwords) is masked in logs. CSRF protection, Rate Limiting, and Account Locking are enforced.

---

### Story 6.1: Audit Logging & PII Masking

As a **system**,
I want every significant user action to be recorded in an audit log with actor, action, target, and timestamp,
So that security investigations can reconstruct the complete event chain.

**Depends On:** Story 1.2 (Authentication), Story 4.1 (Transfer)

**Acceptance Criteria:**

**Given** User login success/failure, logout, transfer session creation, OTP issuance/verification, transfer execution, account inquiry
**When** Each action executes
**Then** `AuditEvent` domain event publish → `AuditLogEventListener` handles via `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async` (Murat, issue U)
**And** Audit INSERT after transfer TX commit (Best-effort independent of transfer rollback)
**And** `channel_db.audit_logs` INSERT
**And** Fields: `id, member_id, action (ENUM), target_id, ip_address, user_agent, created_at`
**And** `action` ENUM: `LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, TRANSFER_INITIATED, OTP_ISSUED, OTP_VERIFIED, OTP_FAILED, TRANSFER_EXECUTED, TRANSFER_FAILED, TRANSFER_COMPENSATED`
**And** `TRANSFER_COMPENSATED`: Recorded when Story 4.3 RecoveryScheduler executes compensating transaction (Amelia, issue AA)
**And** On `@Async` failure, `log.error("AUDIT_FAIL: action={}, memberId={}", event.getAction(), event.getMemberId(), ex)` mandatory logging (Sally, issue QQ) — Ops team can detect missed audits via log alerts

**Given** Security critical events (Account lock, OTP limit exceeded, Forced session invalidation)
**When** Event occurs
**Then** Additionally record in `channel_db.security_events` table (FR-45)
**And** `security_events` retention period: 180 days (audit_logs: 90 days, FR-46)

**Given** Audit log retention period expiration (`@Scheduled`)
**When** Runs daily at midnight
**Then** Delete records `audit_logs.created_at` < now - 90 days (FR-34)
**And** Delete records `security_events.created_at` < now - 180 days (FR-46)

**Given** Application log output (Logback)
**When** Transfer execution log recorded
**Then** Full account number (`^\d{10,14}$` pattern) not output to log — Apply `MaskingUtils.maskAccountNumber()` (NFR-S2, FR-36)
**And** Password, OTP value, JSESSIONID value not output to log
**And** Account number masking format: `110-****-5678` (Front 3 + ** + Back 4)

**Given** `MaskingUtilsTest` (Unit Test)
**When** Input full account number / password string
**Then** Verify masking application (Regex based)
**And** Verify sensitive info not output via log appender mock

**Given** `Flyway V2__create_audit_log_table.sql` (channel_db)
**When** Service startup
**Then** Create `audit_logs`, `security_events` tables

---

### Story 6.2: Admin API — Session Invalidation & Audit Query

As an **administrator**,
I want to force-invalidate user sessions and query audit logs,
So that I can respond to security incidents and investigate suspicious activity.

**Depends On:** Story 6.1, Story 1.2 (ROLE_ADMIN)

**Acceptance Criteria:**

**Given** `DELETE /api/v1/admin/members/{memberId}/sessions` (ROLE_ADMIN JWT)
**When** Request forced session invalidation
**Then** `FindByIndexNameSessionRepository.findByPrincipalName(memberId)` → Get sessionId collection (O(1)) (Winston, issue S — SCAN prohibited)
**And** `sessionRepository.deleteById(sessionId)` Delete each session (No SCAN — Prevent latency spike by full keyspace scan)
**And** Automatically managed via Spring Session principal name index (`spring:session:index:...PRINCIPAL_NAME_INDEX_NAME:{memberId}`)
**And** Record `FORCED_LOGOUT` event in `security_events` table (FR-50 — Include admin ID)
**And** HTTP 204 returned

**Given** Access `/api/v1/admin/**` with ROLE_USER token
**When** Verify authorization
**Then** HTTP 403 `{ code: "AUTH-006", message: "Access denied." }`

**Given** `GET /api/v1/admin/audit-logs?memberId={id}&from={ISO8601}&to={ISO8601}&page=0&size=20`
**When** Query audit logs (ROLE_ADMIN)
**Then** HTTP 200 Pagination: `{ content: [{ auditId, memberId, action, targetId, ipAddress, createdAt }], totalElements, ... }` (FR-39)
**And** `memberId` filter: Filter by specific user
**And** `from`/`to` filter: Filter by time range

**Given** `GET /api/v1/admin/members/{memberId}/locked`
**When** Query lock status (ROLE_ADMIN)
**Then** HTTP 200: `{ memberId, status: "LOCKED|ACTIVE", lockedAt, failedAttempts }`

**Given** `POST /api/v1/admin/members/{memberId}/unlock`
**When** Unlock account (ROLE_ADMIN)
**Then** `member.status = ACTIVE`, `failedAttempts = 0` reset (FR-06 unlock)
**And** Record `ACCOUNT_UNLOCKED` in `security_events` (Include admin ID)
**And** HTTP 204 returned

**Given** Initial admin account seed data (John, issue W)
**When** `docker compose up` or Flyway migration runs
**Then** `admin@fix.com / Admin1234!` account exists in `channel_db.members` as `ROLE_ADMIN`
**And** E2E verification of admin login + session invalidation possible in Story 8.3 smoke test
**And** Insert via `DataInitializer` or `V2__seed_admin_user.sql` (Common across all environments)

**Given** `ChannelIntegrationTestBase` (Testcontainers)
**When** Admin API integration test
**Then** Verify 403 when accessing admin API with ROLE_USER
**And** Verify 401 when invalidated user refreshes after admin force logout

---

### Story 6.3: Rate Limiting, CSRF & Security Boundary

As a **system**,
I want to enforce rate limits on sensitive endpoints, CSRF protection on all state-changing requests, and block direct access to internal endpoints,
So that abuse, CSRF attacks, and network bypass attempts are all rejected.

**Depends On:** Story 1.2, Story 2.1, Story 2.2 (Bob, issue LL — Dependency on OTP verify endpoint)

**Acceptance Criteria:**

**Given** `RateLimitFilter` (Bucket4j + Redis-backed) applied endpoints
**When** Check configuration
**Then** Applied only to 3 endpoints:
- `POST /api/v1/auth/login`: 5 req/min/IP
- `POST /api/v1/transfers/sessions/{id}/otp/verify`: 3 times/session (Double defense with Story 2.2 OTP attempt limit)
- `POST /api/v1/transfers/sessions`: 10 req/min/userId

**Given** Rate limit exceeded
**When** Request received
**Then** HTTP 429 `{ code: "RATE-001", message: "Too many requests. Please try again later.", retryAfterSeconds: N }`
**And** Include `Retry-After: N` response header

**Given** Bucket4j Redis integration setup (Winston, issue T)
**When** Check `RateLimitConfig @Configuration`
**Then** Add `bucket4j-redis` dependency (`io.github.bucket4j:bucket4j-redis`)
**And** Define `ProxyManager<String>` Bean: `Bucket4jRedisProxyManager` with Lettuce RedisClient
**And** Acquire Bucket via `proxyManager.builder().addLimit(bandwidth).build(key)` in `RateLimitFilter`
**And** On limit exceeded: `bucket.tryConsume(1)` → false → HTTP 429

**Given** Rate limit settings externalized to environment variables (NFR-SC2)
**When** Check `application.yml`
**Then** Refer env vars with defaults like `${RATE_LIMIT_LOGIN_MAX:5}`, `${RATE_LIMIT_OTP_MAX:3}`

**Given** CSRF token initialization (Sally, issue CC)
**When** React App initial mount (`App.tsx useEffect`)
**Then** `GET /api/v1/csrf` call (No auth required, `SecurityConfig.permitAll()` registered)
**And** Spring Security issues `XSRF-TOKEN` cookie automatically on response (Pre-issue to prevent first POST CSRF failure)
**And** `CookieCsrfTokenRepository.withHttpOnlyFalse()` setting — JavaScript readable cookie (Winston)
**And** `JSESSIONID` maintains `HttpOnly=true` (Explicit separation of auth cookie and CSRF cookie attributes)

**Given** POST/PATCH/DELETE requests from React App
**When** Axios interceptor executes
**Then** Auto-inject `X-XSRF-TOKEN` header (CSRF Double-Submit Cookie pattern)
**And** Server validates token via `CookieCsrfTokenRepository.withHttpOnlyFalse()`
**And** Request without `X-XSRF-TOKEN` header → HTTP 403 (FR-35)

**Given** SSE endpoint (`GET /api/v1/notifications/stream`)
**When** Check CSRF configuration
**Then** GET request so CSRF token not required (Spring default behavior)
**And** `SecurityConfigTest`: Explicitly verify SSE endpoint excluded from CSRF (Amelia — Prevent customization errors)

**Given** `curl corebank-service:8081/internal/v1/accounts` (No X-Internal-Secret header)
**When** Call
**Then** Return HTTP 403 (NFR-S4, FR-52)

**Given** `SecurityBoundaryTest` (`@Nested` — Scenario #8)
**When** Direct call to internal API without X-Internal-Secret
**Then** `corebank-service:8081/internal/**` → Verify 403
**And** `fep-service:8082/fep/**` → Verify 403
**And** With valid X-Internal-Secret → Verify normal processing

**Given** `RateLimitIntegrationTest` (Testcontainers Redis)
**When** 6 consecutive login attempts (Same IP)
**Then** HTTP 429 returned on 6th request

**Given** Rate Limit + Circuit Breaker test isolation (Murat, issue HH)
**When** Run `RateLimitIntegrationTest` / `FepCircuitBreakerIntegrationTest`
**Then** Apply `@DirtiesContext(classMode = AFTER_CLASS)` to each test class — Prevent CB state pollution
**And** Reset CB via `circuitBreakerRegistry.circuitBreaker("fep").reset()` in `@AfterEach`
**And** Verify no interference between `simulate-failures` test and Rate Limit test

---

### Story 6.4: Vault TOTP Secret Migration (FR-TOTP-04)

As a **system security requirement**,
I want TOTP secrets to be stored exclusively in HashiCorp Vault instead of the application database,
So that TOTP secrets are never exposed even in the event of a database breach.

> **Refers to ADR:** Replaces temporary solution (`@EncryptedColumn` AES-256) decided in Epic 0 with Vault in this story. See [ADR-TOTP-SEC-001] in architecture.md.

**Depends On:** Story 2.2 (TotpOtpService interface), Story 6.1 (Security Event Logging), Story 0.1 (docker-compose infra)

**Acceptance Criteria:**

**Given** HashiCorp Vault container added to `docker-compose.yml`
**When** `docker compose up` runs
**Then** Vault container `vault:1.15` starts, `VAULT_DEV_ROOT_TOKEN_ID=root-token` dev mode (Local/CI only)
**And** `vault-init` container starts after `depends_on: vault` + `healthcheck`
**And** `vault-init.sh` — idempotent script (Winston, issue DD):
  - Skip if `vault kv get secret/fix/config` succeeds, else run `vault secrets enable -path=secret kv-v2`
  - Skip if `vault policy read fix-policy` exists, else create policy
  - Conditional injection of seed user (`memberId=1`) TOTP secret: run `vault kv put ... secret="JBSWY3DPEHPK3PXP"` only if `vault kv get secret/fix/member/1/totp-secret` returns 404
  - **Safe to re-run on restart (Idempotency guaranteed)**
**And** `channel-service` starts after `depends_on: vault` healthcheck passes

> **Design Note (DD):** Vault dev mode clears memory on restart, deleting all stored secrets. This is an intended trade-off for local/CI dev mode. In demo environments, use `docker compose stop && docker compose start` instead of `docker compose restart` (`vault-init` re-runs to re-inject seed secrets). This guide is also specified in README.

**Given** `spring-vault-core` dependency added to `channel-service/build.gradle`
**When** `channel-service` starts
**Then** `spring.cloud.vault.token=root-token` (Externalized via `VAULT_TOKEN` env var, NFR-M4)
**And** Set `spring.cloud.vault.host`, `spring.cloud.vault.port` env vars (`VAULT_HOST`, `VAULT_PORT`)

**Given** `VaultTotpSecretService implements TotpSecretRepository` implementation
**When** Save/Retrieve TOTP secret
**Then** `PUT /v1/secret/data/fix/member/{memberId}/totp-secret` → Save `{ secret: Base32EncodedKey }`
**And** `GET /v1/secret/data/fix/member/{memberId}/totp-secret` → Retrieve secret
**And** Disable existing `@EncryptedColumn` based `DatabaseTotpSecretRepository` implementation via `@Profile("!vault")` guard
**And** `TotpOtpService` refers only to `TotpSecretRepository` interface — No service code change upon implementation swap (Amelia, Clean Seam)

**Given** Migration of existing `@EncryptedColumn` DB stored TOTP secrets
**When** Start with Vault active profile
**Then** `VaultMigrationRunner` (`@EventListener(ApplicationReadyEvent)`, `@Profile("vault")`): Guarantee idempotent execution (Amelia, issue MM)
**And** For each member: **Skip** if `vaultRepo.findByMemberId(memberId).isPresent()` is true (No duplicate write)
**And** Execute Vault save only if secret exists in DB but not in Vault
**And** **Prohibit** immediate NULLing of DB column — Mark completion time in `totp_secret_migrated_at DATETIME` column (Phase 1)
**And** Phase 2 (Actual deletion of DB column) documented in `docs/ops/vault-migration-phase2.md` — Out of scope for Story 6.4
**And** `VaultMigrationRunnerTest` 3 cases:
  1. First run: DB secret exists → Save to Vault → Set `migrated_at`
  2. Idempotent re-run: Exists in Vault → Skip (0 Vault writes)
  3. Re-run without Vault (dev restart): DB secret valid → Vault re-injection success
**And** Migration completion log: `"TOTP secret migrated to Vault for {N} members"` (Include traceId)

**Given** Vault connection failure (At channel-service startup)
**When** Vault healthcheck fails
**Then** `channel-service` fail to start (`ConnectionRefusedException` → Spring Boot startup failure) — TOTP feature never starts without Vault

**Given** WireMock Vault stub added to `testing-support`
**When** Inherit `ChannelIntegrationTestBase`
**Then** Inject `spring.cloud.vault.host=localhost`, port = WireMock port via `@DynamicPropertySource`
**And** `GET /v1/secret/data/fix/member/*/totp-secret` → Automatically register stub returning Base32 test secret
**And** Verify existing Story 2.2 TOTP integration tests pass without changes using Vault stub

**Given** `GET /actuator/health`
**When** Vault connection normal
**Then** Include `components.vault.status: "UP"` (Spring Vault auto health indicator)

---

## Epic 7: Observability, API Docs & README

Swagger UI documents all Channel APIs, X-Correlation-Id flows through logs of all 3 services, and JSON structured logs allow request chain reconstruction. README answers the two interviewer tracks (Bank/FinTech) directly.

---

### Story 7.1: Swagger & OpenAPI Documentation

As a **developer or interviewer**,
I want interactive API documentation at `/swagger-ui.html` covering all Channel Service endpoints,
So that I can explore and verify the API without reading source code.

**Depends On:** Story 1.2, Story 2.1 (Controller implementation complete)

**Acceptance Criteria:**

**Given** `GET /swagger-ui.html` (after channel-service startup)
**When** Request
**Then** Return HTTP 200 (NFR-O1)
**And** Accessible without authentication (`SecurityConfig.permitAll()` — RULE-012)

**Given** `SwaggerConfig @Configuration`
**When** Check configuration
**Then** Dependency: `implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.x'` (Spring Boot 3.x required, Winston — issue RR)
**And** Set `springdoc.paths-to-exclude=/actuator/**` — Hide Actuator endpoints from Swagger (Amelia — issue YY)
**And** `OpenAPI` Bean definition: title "FIX Channel Service API", version "v1", contact info
**And** `SecurityScheme` definition: Include Bearer Token (JWT) auth scheme
**And** Set `springdoc.swagger-ui.operations-sorter: method`

**Given** All `@RestController` methods
**When** Code review
**Then** Include `@Operation(summary = "...", description = "...", tags = {...})` on each method (NFR-M3, FR-40)
**And** Include `@Schema(description = "...")` on Request/Response DTOs
**And** Document error response codes (400, 401, 403, 422, 500) via `@ApiResponse` annotation

**Given** `GET /v3/api-docs`
**When** Request
**Then** Return OpenAPI 3.0 spec in HTTP 200 JSON format
**And** Verify inclusion of all `/api/v1/**` endpoints

**Given** `GET /swagger-ui.html` (after fep-service startup)
**When** Request
**Then** HTTP 200 (NFR-O1 — fep-service also provides Swagger)
**And** Document `/fep/v1/**` and `/fep-internal/**` endpoints

---

### Story 7.2: Structured Logging & Distributed Trace Propagation

As a **developer**,
I want all services to emit JSON-format logs with traceId and correlationId fields,
So that a complete request chain can be reconstructed from logs across services.

**Depends On:** Story 0.1 (Service startup)

**Acceptance Criteria:**

**Given** `logback-spring.xml` configuration (All 3 services)
**When** Service startup
**Then** JSON format log output using `logstash-logback-encoder` (D-010)
**And** Every log line JSON parsable, fields: `timestamp, level, logger, message, traceId, correlationId, memberId`

**Given** React App → Channel Service (Login request)
**When** After `JwtAuthenticationFilter` processing
**Then** If `X-Correlation-Id` header missing, generate new UUID; if present, reuse existing
**And** Generated/Extracted `correlationId` → Inject into MDC `correlationId`
**And** Include `X-Correlation-Id: {UUID}` in response header

**Given** Channel Service → CoreBanking call (`RestClient`)
**When** Send request
**Then** Propagate `X-Correlation-Id` header (FR-42)
**And** CoreBanking `InternalSecretFilter` receives `X-Correlation-Id` → Inject into MDC

**Given** CoreBanking → FEP call (`FepClient`)
**When** Send request
**Then** Register `ClientHttpRequestInterceptor` in `FepClient` (`RestClient`) — Extract `correlationId` from MDC and auto-inject `X-Correlation-Id` header (Amelia, issue BB)
**And** `FepClientConfig @Bean`: Apply `RestClient.builder().requestInterceptor(correlationIdInterceptor())`
**And** `FepClientCorrelationTest`: Verify same `correlationId` propagation across Channel → CoreBanking → FEP 3-hop

**Given** Full request chain log query (Same `correlationId`)
**When** Grep logs of 3 services
**Then** Reconstruct entire request chain with identical `correlationId` (NFR-L1)

**Given** `CorrelationIdPropagationTest` (Integration Test)
**When** Execute transfer E2E request
**Then** Verify Channel → CoreBanking WireMock headers (Murat, issue FF):
```java
channelWireMock.verify(postRequestedFor(urlEqualTo("/internal/v1/transfers"))
    .withHeader("X-Correlation-Id", matching("[a-f0-9\\-]{36}")));
fepWireMock.verify(postRequestedFor(urlEqualTo("/fep/v1/transfer"))
    .withHeader("X-Correlation-Id", matching("[a-f0-9\\-]{36}")));
```
**And** Verify 3-hop (Channel → CoreBanking → FEP) same `correlationId` UUID propagation
**And** Extract same `correlationId` from Channel / CoreBanking logs → Verify match

---

### Story 7.3: README & Portfolio Documentation

As an **interviewer or developer**,
I want the README to answer the first 3 technical questions within the first screen,
So that I can evaluate the project's depth without asking.

**Depends On:** Story 8.3 (Final review time)

**Acceptance Criteria:**

**Given** GitHub Repository README.md (Top)
**When** First screen (above the fold)
**Then** CI badges (`ci-channel`, `ci-corebank`, `ci-fep`, `ci-frontend` 4 EA), JaCoCo coverage badge displayed
**And** Architecture Diagram (Mermaid) — Channel:8080, CoreBanking:8081, FEP:8082, MySQL, Redis relationships included
**And** Quick Start 3 commands section (Story 0.2 defined):
```bash
cp .env.example .env
docker compose up
# → localhost:8080 access
```

**Given** Bank Interviewer Track section (README)
**When** Reading
**Then** "Why Pessimistic Locking?" → ADR-001 summary + Interview speaking point
**And** "How does OTP work?" → Simulation boundary (SecureRandom vs HSM) explanation
**And** "Ledger Integrity?" → Link to SUM(DEBIT)==SUM(CREDIT) Scenario #7
**And** 5-minute Demo Script (Sally, issue VV):
```bash
# 1. Normal Transfer
curl -X POST .../auth/login → Get JSESSIONID
curl -X POST .../transfers/sessions → sessionId
curl -X POST .../otp/verify (Valid TOTP)
curl -X POST .../execute → COMPLETED
# 2. OTP Failure 3 times → FAILED
curl -X POST .../otp/verify (Wrong Code) ×3 → AUTH-005
# 3. Admin Session Invalidation → Retry
curl -X DELETE .../admin/members/{id}/sessions (admin@fix.com)
curl -X POST .../auth/login (Login again and retry transfer)
```

**Given** FinTech Interviewer Track section (README)
**When** Reading
**Then** Link to Swagger UI (`localhost:8080/swagger-ui.html`)
**And** DevTools verification guide: Network tab → Check `EventStream`, no Document reload
**And** Actuator Circuit Breaker Demo Script (John, issue UU — endpoint fix):
```bash
# Force Trigger CB OPEN
curl -X POST "http://localhost:8082/fep-internal/simulate-failures?count=3" \
     -H "X-Internal-Secret: $FEP_INTERNAL_SECRET"
# Check CB State
curl http://localhost:8080/actuator/circuitbreakers
# → Confirm fep.state: "OPEN"
```

**Given** ADR File Organization (John, issue X)
**When** Create `docs/adr/` directory
**Then** Write each ADR as independent file: `docs/adr/ADR-001-pessimistic-lock.md`, `ADR-TOTP-SEC-001.md`, `ADR-FEP-RETRY-001.md`, `ADR-CB-INTERNAL-001.md`, `ADR-SSE-REGISTRY-001.md`
**And** Each ADR file format: `# Title / ## Status / ## Context / ## Decision / ## Consequences` (Standard ADR template)
**And** Direct link to each file in README ADR Index section (`[ADR-001](docs/adr/ADR-001-pessimistic-lock.md)`)

**Given** ADR Index section (README or `docs/adr/`)
**When** Check
**Then** Provide links to D-XXX / ADR-XXX / RULE-XXX decision list (NFR-M2)

**Given** README Quick Start Vault Guide (Sally, issue AAA)
**When** After `docker compose up` completes
**Then** Specify Vault UI access in README: `http://localhost:8200` → Token: `root-token` login
**And** Include guide to check seed user TOTP secret at path `secret/fix/member/1/totp-secret`
**And** Seed user TOTP manual registration guide (John + Murat, issue EEE) — Manual entry in Google Authenticator:
```
otpauth://totp/FIX:user%40fix.com?secret=JBSWY3DPEHPK3PXP&issuer=FIX
```
Include guide in README saying "No QR Scan needed — Google Authenticator → '+' → Enter setup key" along with URL
**And** README Windows compatible commands (Sally, issue PP):
```bash
# Linux/Mac
cp .env.example .env
# Windows PowerShell
Copy-Item .env.example .env
```

**Given** CONTRIBUTING.md
**When** Check
**Then** Define Conventional Commits format, Branch naming (`feat/`, `fix/`, `test/`), PR Merge Strategy (Squash merge)

---

## Epic 8: Full System Validation & Acceptance Testing

We verify that all functionality implemented in Epics 0-7 works perfectly in an integrated environment. 7+1 Acceptance Scenario full coverage in CI, JaCoCo threshold satisfaction, ledger integrity verification, concurrency testing, and Docker Compose full-stack smoke testing. Completion of this Epic = MVP Completion = Ready for GitHub release.

---

### Story 8.1: Acceptance Scenario Suite (7+1)

As a **project maintainer**,
I want all 7+1 acceptance scenarios to pass in CI on every commit to main,
So that the system's correctness claims are continuously verified.

**Depends On:** Epics 1-6 complete, Story 7.3 (README complete — Bob, issue XX)

**Acceptance Criteria:**

**Given** Scenario #1 (Same-bank E2E happy path) — `TransferControllerIntegrationTest`
**When** `POST /session → POST /otp → POST /otp/verify → POST /execute` Full flow
**Then** Login first in `ChannelIntegrationTestBase @BeforeEach` + Obtain JSESSIONID cookie (Amelia, issue DDD)
**And** HTTP 200 COMPLETED, returns `transactionId`, verify 2 TransferHistory records (DEBIT+CREDIT) in DB (NFR-R1)

**Given** Scenario #3 (OTP failure blocks transfer) — `TransferSessionOtpIntegrationTest` (HHH — Explicitly named as Integration Test, requires Redis)
**When** Enter wrong OTP 3 times
**Then** Include `@DisplayName("Scenario #3: OTP failure blocks transfer")` annotation (Sally, issue QQQ)
**And** Session status `FAILED`, execute call returns HTTP 409 `TRF-010`
**And** Verify actual balance has not changed

**Given** Scenario #4a (Same member + Duplicate clientRequestId) — `IdempotencyIntegrationTest.SameMemberIdempotency` (Bob, issue KK)
**When** Same member attempts session creation twice with same `clientRequestId`
**Then** 2nd request returns HTTP 200 — Returns existing sessionId (Idempotent, reflecting Round 1 decision)
**And** Only 1 DB session record exists (No duplicate INSERT)

**Given** Scenario #4b (Different member + Duplicate clientRequestId) — `IdempotencyIntegrationTest.CrossMemberSecurity`
**When** Different member attempts session creation using another person's `clientRequestId`
**Then** HTTP 403 `{ code: "AUTH-007" }` (Security boundary — Prevent probing other's sessions)
**And** Only 1 DB session record exists (No new session created)

**Given** Scenario #5 (FEP timeout → CB OPEN) — `FepCircuitBreakerIntegrationTest`
**When** WireMock FEP 3 times timeout stub
**Then** Verify WireMock is not called on 4th call + Verify CB state `OPEN`

**Given** Scenario #6 (Session invalidated after logout) — `AuthControllerIntegrationTest`
**When** Call protected API with same JSESSIONID after logout
**Then** HTTP 401 `UNAUTHORIZED` (Verify Redis Spring Session key deletion — Immediate invalidation)

**Given** Scenario #7 (Ledger integrity) — `LedgerIntegrityTest` **`corebank-service` Integration Test** (John + Winston, issue KKK)
**When** N transfers completed + M compensating transactions (`COMPENSATING_CREDIT`) executed → Aggregate **`core_db.transactions`**
**Then** `SUM(amount WHERE type='DEBIT') == SUM(amount WHERE type='CREDIT') + SUM(amount WHERE type='COMPENSATING_CREDIT')`
**And** Verify `transactionId IS NOT NULL` for all `transfer_history` with `status='COMPLETED'`
**And** Use `CorebankIntegrationTestBase` (Testcontainers core_db MySQL)
**And** Directly execute aggregation SQL on `core_db.transactions` after inserting N seed transfers via `@Sql`
**And** Run in `ci-corebank.yml` (Ledger consistency is corebank module responsibility)
**And** Include RecoveryScheduler compensation scenario after `COMPLETED` transfer: Verify ledger equality holds even after compensation

**Given** Scenario #8 (Security boundary) — `SecurityBoundaryTest (@Nested)`
**When** Call `corebank-service:8081/internal/v1/**` directly without X-Internal-Secret header
**Then** HTTP 403

**Given** `ci.yml` GitHub Actions (NFR-R1)
**When** `push main` / `pull_request → main`
**Then** Must pass all 7+1 scenarios to allow PR merge
**And** JaCoCo threshold check — `main` branch specific condition (Murat, issue GG):
```yaml
- name: Check JaCoCo Coverage
  if: github.ref == 'refs/heads/main'
  run: ./gradlew jacocoTestCoverageVerification
```
**And** Generate JaCoCo report only on feature branches (No forced threshold — Prevent build break during development)
**And** Create `@Tag("concurrency")` — Concurrency correctness tests (Winston + Murat, issue FFF):
```yaml
- name: Run concurrency tests   # PR + main blocking execution
  run: ./gradlew test -Pgroups=concurrency
  # Includes: ConcurrentTransferIntegrationTest, TransferSessionConcurrencyTest, DailyLimitConcurrencyTest
- name: Run slow perf tests     # main only
  if: github.ref == 'refs/heads/main'
  run: ./gradlew test -Pgroups=slow
  # Includes: p95 response time, VaultMigrationRunnerTest, etc.
```
**And** Separate `@Tag("slow")` tests into distinct CI step (Murat, issue TT):
```yaml
- name: Run slow tests
  if: github.ref == 'refs/heads/main'
  run: ./gradlew test -Pgroups=slow
```
**And** 8-minute SLA (NFR-T4) applies only to non-slow tests — slow tests (`@Tag("slow")`) are separate step
**And** Include `@DisplayName("Scenario #N: ...")` annotation on each scenario test class (Sally, issue QQQ) — Traceability between code and docs

**Given** `ci-channel.yml`, `ci-corebank.yml`, `ci-fep.yml`, `ci-frontend.yml` 4 workflows
**When** Push changes to each service
**Then** Run only relevant service CI in parallel (D-004 Matrix Build)
**And** JaCoCo Reports: channel ≥ 70% (NFR-T1), corebank ≥ 80% (NFR-T2), fep ≥ 60% (NFR-T3)

---

### Story 8.2: Performance & Concurrency Validation

As a **system**,
I want concurrent transfer attempts to complete without deadlock or data corruption,
So that the pessimistic locking strategy is proven under load.

**Depends On:** Story 4.1 (PESSIMISTIC_WRITE), Story 8.1

**Acceptance Criteria:**

**Given** `ConcurrentTransferIntegrationTest` (Testcontainers MySQL — Scenario #2)
**When** 10 threads attempt 5 transfers of ₩200,000 simultaneously from same account (`accountId=1`, balance ₩1,000,000) (`ExecutorService` + `CountDownLatch`)
**Then** Include `@DisplayName("Scenario #2: Concurrent transfer — PESSIMISTIC_WRITE integrity")` annotation
**And** Apply `@Tag("concurrency")` (PR + main blocking execution, Winston issue FFF)
**And** Exactly 5 `COMPLETED`, rest `FAILED` (Insufficient balance or lock fail)
**And** Final balance = ₩0 (No negative balance, NFR-D1)
**And** `TransferHistory` DEBIT sum = ₩1,000,000
**And** Total test completion ≤ 20s (Amelia — 2-core CI runner capacity) — Apply `@Timeout(20)` annotation
**And** `@Tag("concurrency")` tests run in PR stage in CI (`./gradlew test -Pgroups=concurrency`)

**Given** `TransferConcurrencyTest` — `@Tag("concurrency")` (Murat, issue III — Clarify purpose)
**When** Execute concurrent TOTP verify with 2 threads (Designed not to overlap with TransferSessionConcurrencyTest scenario)
**Then** Objective: Verify thread safety for concurrent execution scenarios other than PESSIMISTIC_WRITE (No additional notification during lock hold time)
**And** Apply `@Timeout(10)` (NFR-T6)
**And** `DailyLimitConcurrencyTest` (defined in Story 4.1) does not overlap with this class — Dedicated for TOCTOU daily limit (Bob, issue MMM)

**Given** p95 Response Time Verification (Amelia, issue NNN — Include warm-up + Separate `@Tag("perf")`)
**When** Measure after 50 warm-up calls for account list
**Then** Apply `@Tag("perf")` — `main` branch only
**And** p95 ≤ 500ms (NFR-P1, Reference metric — Indirect verification via `@Timeout` in CI)

**Given** Error Response (4xx, 5xx) Response Time Measurement
**When** Measure 50 invalid credential logins (`@Tag("perf")`)
**Then** p95 ≤ 500ms (NFR-P6)

**Given** `@Lock PESSIMISTIC_WRITE` lock hold time measurement test (Amelia, issue ZZ)
**When** Measure single transfer execution time
**Then** Measure transaction execution time with `StopWatch`:
```java
StopWatch sw = new StopWatch();
sw.start();
transferService.executeTransfer(sessionId, memberId);
sw.stop();
log.info("Lock hold time: {}ms", sw.getTotalTimeMillis());
assertThat(sw.getTotalTimeMillis()).isLessThan(100);
```
**And** Verify lock hold time ≤ 100ms (NFR-P5)

---

### Story 8.3: Docker Integration & Final Polish

As a **developer**,
I want the full Docker Compose stack to pass smoke tests and the README to be demo-ready,
So that any interviewer can verify the system within 5 minutes of cloning the repository.

**Depends On:** Story 8.1, Story 7.3

**Acceptance Criteria:**

**Given** `docker compose up` (`.env` based on `.env.example`)
**When** Startup within 120s (NFR-P3 — Adjusted 90s → 120s due to Vault + vault-init addition, Winston issue SS)
**Then** `GET localhost:8080/actuator/health` → `{"status":"UP"}` (channel-service)
**And** `GET localhost:8081/actuator/health` → `{"status":"UP"}` (corebank-service)
**And** `GET localhost:8082/actuator/health` → `{"status":"UP"}` (fep-service)
**And** `GET localhost:8080/swagger-ui.html` → HTTP 200 (NFR-O1)

**Given** Docker Compose Port Exposure Structure (Winston, issue EE)
**When** Check `compose.yml` (base)
**Then** `corebank-service`, `fep-service`, `vault` services have **NO** `ports:` section — No direct external access
**And** Open ports for dev convenience (`8081:8081`, `8082:8082`, `8200:8200`) only in `docker-compose.override.yml` (Local dev only, Filename matches Story 0.1 — Winston, issue GGG)
**And** CI Environment: `docker compose -f compose.yml up` (without override) — No internal service exposure

**Given** Docker Compose Network Isolation Verification
**When** `curl localhost:8081` from host (Base compose without override)
**Then** Connection refused (NFR-S4 — Internal services not directly accessible)

**Given** JSON Log Parsing Verification
**When** Run `docker compose logs channel-service | head -5 | python3 -c "import sys,json; [json.loads(l) for l in sys.stdin]"`
**Then** JSON parse success without error (NFR-L1)
**And** Windows alternative (Murat, issue JJJ): Use `python` instead of `python3`, or use `jq`:
```bash
docker compose logs channel-service | head -5 | jq -R 'fromjson?' | jq -s '. | length'
```

**Given** Seed Data Check
**When** Login test after `docker compose up`
**Then** `POST /api/v1/auth/login` with `{ email: "user@fix.com", password: "Test1234!" }` → HTTP 200
**And** `POST /api/v1/auth/login` with `{ email: "admin@fix.com", password: "Admin1234!" }` → HTTP 200 (John, issue LLL — Admin seed smoke check)

**Given** 5 Concurrent User Sessions Simulation (NFR-SC1)
**When** Concurrent login with 5 independent browser sessions / curl sessions
**Then** Independent session cookies issued for all, account inquiry returns normal response for each

**Given** Dependabot Configuration (NFR-S6)
**When** Check `.github/dependabot.yml`
**Then** Gradle + pnpm dependency auto-update configuration exists
**And** `dependencyCheckAnalyze` — Separated into weekly scheduled workflow (Amelia, issue OOO — Prevent CI timeout from NVD download):
```yaml
# .github/workflows/security-scan.yml
schedule:
  - cron: '0 2 * * 0'   # Every Sunday 02:00 UTC
```
**And** Normal CI checks only for Dependabot alert count 0 (NVD scan excluded)
**And** No CVSS ≥ 7.0 dependencies on `main` branch

**Given** README Quick Start Final Review
**When** Execute steps in fresh clone environment
**Then** Verify full stack startup with just 3 commands (cp .env.example .env → docker compose up → browser)
**And** Login credentials (`user@fix.com / Test1234!`) stated in README
**And** 5-minute verification checklist (Sally, issue PPP):
```
□ docker compose up (Complete < 2 min)
□ localhost:8080/swagger-ui.html → HTTP 200
□ Login → Transfer → SSE Notification received (Complete < 2 min)
□ POST /fep-internal/simulate-failures?count=3 → Confirm CB OPEN (< 1 min)
```
