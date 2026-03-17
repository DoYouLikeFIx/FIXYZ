---
stepsCompleted:
  [
    "step-01-init",
    "step-02-discovery",
    "step-02b-vision",
    "step-02c-executive-summary",
    "step-03-success",
    "step-04-journeys",
    "step-05-domain",
    "step-06-innovation",
    "step-07-project-type",
    "step-08-scoping",
    "step-09-functional",
    "step-10-nonfunctional",
    "step-11-polish",
  ]
inputDocuments:
  - "_bmad-output/planning-artifacts/plan.md"
  - "_bmad-output/planning-artifacts/deep-research-report.md"
  - "_bmad-output/planning-artifacts/deep-research.pdf"
documentCounts:
  briefs: 0
  research: 3
  brainstorming: 0
  projectDocs: 0
classification:
  projectName: "FIX"
  projectType: "distributed-backend-system"
  subType: "gradle-multi-module-monolith + 3-satellite-services"
  domain: "fintech-securities-exchange"
  domainDetail: "Channel/CoreBanking/FEP architecture for a Korean securities trading simulator"
  complexity: "high"
  projectContext: "greenfield"
  targetAudience:
    primary: "Korean bank-affiliated securities firms"
    secondary: "Korean FinTech startups"
  timeline: "6 weeks to interview-ready MVP"
  techStack:
    backend: "Java 21 + Spring Boot 3.x + Gradle multi-module"
    dataAccess: "JPA + Query Annotations + QueryDSL"
    database: "MySQL InnoDB (channel_db + core_db + fep_db)"
    cache: "Redis (Docker Compose from day 1)"
    resilience: "Resilience4j (circuit breaker; retry handled by OrderSessionRecoveryService)"
    session: "Spring Session + Redis"
    fixProtocol: "FIX 4.2 via QuickFIX/J (FEP Gateway -> FEP Simulator)"
  frontend:
    mvp: "React Web (5 screens)"
    phase2: "React Native (post-MVP)"
  complianceBoundary: "Simulator only - no real KRX/KSD/financial-institution integration"
  keycloak: false
  deployableUnits:
    - "channel-service (port 8080)"
    - "corebank-service (port 8081)"
    - "fep-gateway (port 8083)"
    - "fep-simulator (port 8082)"
  acceptanceCriteria:
    - "Stock order E2E happy path (Channel -> CoreBanking -> Order Book -> FEP Gateway -> FEP Simulator -> FILLED)"
    - "Concurrent sell order (10 threads x 100 shares on 500-share position) -> exactly 5 FILLED, final positions.quantity = 0"
    - "OTP failure blocks order execution"
    - "Duplicate ClOrdID returns idempotent result"
    - "FEP Simulator TIMEOUT x3 (slidingWindowSize=3) -> Resilience4j circuit breaker OPEN -> Channel RC=9098 -> UI fallback"
    - "Session invalidated after logout -> subsequent API call rejected"
    - "After N executions -> SUM(BUY executed_qty) - SUM(SELL executed_qty) == positions.quantity for each symbol"
workflowType: "prd"
---

# Product Requirements Document - FIX

_Complete Product Requirements Document for FIX. Audience: human stakeholders and LLM downstream agents (UX, Architecture, Implementation). All requirements are WHAT-only; implementation details are excluded._

**Author:** yeongjae
**Date:** 2026-02-20

## Executive Summary

**FIX** is a `docker compose up`-deployable Korean securities trading simulator. It is composed of four independently deployable services - Channel, CoreBanking, FEP Gateway, and FEP Simulator - built on Java 21 and Spring Boot 3.x. The project is designed to demonstrate production-grade engineering decisions such as Redis-backed session integrity, pessimistic locking for position consistency, Resilience4j-based fault tolerance on the FEP path, FIX 4.2 protocol translation via QuickFIX/J, an Order Book matching engine, and structured JSON observability.

**Target Users:** Korean bank-affiliated securities firm hiring managers and FinTech engineering teams evaluating backend candidates. For evaluators, FIX provides a coherent, documented system where each architectural claim is backed by tests and each major design decision is explained.

**Problem Solved:** Many backend portfolios stop at CRUD. Korean securities engineering interviews often go further: they test why the channel layer should not own position state, how mandatory login MFA and risk-based order authorization balance security with UX, how a circuit breaker protects CoreBanking from exchange-side failures, and how FIX 4.2 models real exchange communication. FIX is built to demonstrate that level of systems thinking.

### What Makes This Special

FIX bridges the gap between "I know Spring Boot" and "I understand why securities systems are separated the way they are."

**Visible Architecture:** The four-service deployment (`channel-service:8080`, `corebank-service:8081`, `fep-gateway:8083`, `fep-simulator:8082`) makes separation explicit: Channel for auth/session/order intake, CoreBanking for positions and Order Book logic, and the FEP path for exchange simulation and FIX translation. The Gradle multi-module layout makes these bounded contexts easy to inspect from the repository tree.

**Production Data Access Pattern:** Data access layers use JPA and QueryDSL, a combination commonly seen in production systems, with `@Lock(PESSIMISTIC_WRITE)` to make `SELECT FOR UPDATE` semantics explicit for concurrent position mutation safety.

**Demonstrable Correctness:** Seven non-negotiable acceptance scenarios cover concurrent position integrity, `ClOrdID` idempotency, execution ledger correctness, FIX 4.2 circuit breaker behavior, and session security. These scenarios are the portfolio's technical proof points.

**Dual-Audience Experience:** A securities-domain interviewer can open the README and immediately find OWASP-referenced audit log rules, mandatory login MFA plus risk-based order step-up rationale, PII masking rules, and FIX 4.2 session-state documentation. A FinTech interviewer can inspect the CI badge, open the concurrent sell-order test, and confirm 10-thread race-condition coverage in GitHub Actions.

## Project Classification

| Attribute               | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Project Type**        | Distributed backend system - Gradle multi-module monolith + 3 satellite services |
| **Domain**              | Fintech / Korean securities trading simulator |
| **Complexity**          | High - concurrency control, Order Book matching, FIX 4.2, resilience, security, observability |
| **Project Context**     | Greenfield portfolio project                                                       |
| **Timeline**            | 6 weeks to interview-ready MVP                                                     |
| **Compliance Boundary** | Simulator only - no real KRX/KSD/financial-institution integration                 |
| **Data Access**         | JPA + `@Query` annotations + QueryDSL                                              |
| **FIX Protocol**        | FIX 4.2 via QuickFIX/J - FEP Gateway to FEP Simulator segment only                |
| **Market Data Modes**   | LIVE / DELAYED / REPLAY (deterministic seed + timestamped quote snapshots)         |
| **Frontend**            | React Web MVP (5 screens); React Native Phase 2                                    |
| **Keycloak**            | Out of MVP scope                                                                   |

## Success Criteria

### User Success

**yeongjae (Developer / Portfolio Author)**

- Can open any file in the FIX repository during a screenshare, explain what it does, why it is structured that way, and what would break if that design changed, without preparation.
- Within 4 weeks of sharing the GitHub link, at least one technical interviewer asks about a specific implementation detail in FIX, such as the `SELECT FOR UPDATE` concurrency choice.

**Hiring Manager (Evaluator)**

- Opens the README and finds OWASP-referenced audit log rules, session externalization rationale, PII masking rules, and FIX 4.2 session-state documentation within 2 minutes of landing on the repository.
- FinTech-track evaluator clicks the CI badge, views the Testcontainers concurrent sell-order test, and sees 10-thread race condition validation on a 500-share position passing in GitHub Actions.
- Within 8 weeks of FIX going public on GitHub: at least one technical interview invitation received from a bank-affiliated securities firm or FinTech securities startup where the interviewer has viewed the repository.

### Business Success

- **Portfolio differentiation:** FIX is the only portfolio project in yeongjae's GitHub that demonstrates Channel/CoreBanking/FEP separation with running code, live tests, and documented design rationale.
- **Interview conversion:** At least one offer-stage interview is secured within 3 months of completion from either a bank-affiliated securities firm or a FinTech securities startup.
- **Dual-audience README:** A securities-domain interviewer and a FinTech interviewer both independently confirm that the README answers their first three questions without requiring deep document hunting.

### Technical Success

| Metric                      | Target                                                | How Verified                                             |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Channel p95 response time   | Visible in Grafana latency panel, documented in README | Prometheus scrape (`/actuator/prometheus`) + Grafana panel |
| Order execution failure rate | Circuit breaker demo scenario scripted and runnable   | Grafana error-rate panel + circuit breaker drill evidence |
| Concurrent sell integrity   | 0 over-sell events under 10-thread simultaneous sell  | `@SpringBootTest` + `ExecutorService` test passing in CI |
| Docker cold start           | `docker compose up` -> first successful API call <= 120s | Documented in README Quick Start |
| CoreBanking test coverage   | >= 80% line coverage                                   | JaCoCo report in CI                                      |
| Channel test coverage       | >= 70% line coverage                                   | JaCoCo report in CI                                      |
| FEP simulator test coverage | >= 60% line coverage                                   | JaCoCo report in CI                                      |
| GitHub Actions CI           | All 7 acceptance scenarios green on `main`            | CI badge in README                                       |

### Measurable Outcomes - 7 Non-Negotiable Acceptance Scenarios

All seven must pass in CI before the MVP is considered complete:

| #   | Scenario                                                        | Layer                  | Architectural Claim Proven                                          |
| --- | --------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| 1   | Stock order E2E happy path (Buy -> Order Book match -> FILLED) | Channel -> CoreBanking -> FEP Gateway -> FEP Simulator | Order state machine, FIX 4.2 Execution Report, trace ID propagation |
| 2   | Concurrent sell (10 threads x 100 shares on 500-share position) -> exactly 5 FILLED, final `positions.quantity = 0` | CoreBanking | `SELECT FOR UPDATE` on position row; over-sell impossible |
| 3   | OTP failure blocks order execution                              | Channel               | Step-up re-authentication enforcement before market order           |
| 4   | Duplicate `ClOrdID` returns idempotent result                   | CoreBanking           | No double-fill on retry; `UNIQUE INDEX idx_clordid`                 |
| 5   | FEP Simulator `TIMEOUT` x3 (`slidingWindowSize=3`) -> Resilience4j circuit breaker `OPEN` -> Channel `RC=9098 CIRCUIT_OPEN` -> UI fallback | CoreBanking + Channel | Resilience4j sliding-window circuit breaker; no position change on preemptive fallback |
| 6   | Session invalidated after logout -> subsequent API call rejected | Channel + Redis | Redis session security |
| 7   | After N executions, `SUM(BUY executed_qty) - SUM(SELL executed_qty) == positions.quantity` for each symbol | CoreBanking | Position ledger integrity; no phantom fill, no over-sell |

## Product Scope

### MVP - Minimum Viable Product (Week 6 Exit Gate)

- GitHub Actions CI: 7 acceptance scenarios GREEN on main branch
- `docker compose up` cold start <= 120s to first API response
- Four deployable services wired: `channel-service`, `corebank-service`, `fep-gateway`, `fep-simulator`
- React Web 5-screen demo functional (Login, Portfolio View, Order Entry, Order Flow, Notification Feed)
- Prometheus + Grafana observability stack running with core operational panels
- README with architecture diagram, dual-audience demo script, Quick Start section, CI badge
- Flyway migration history: `V1__init.sql` through final schema version across 3 schemas
- Audit log, PII masking, and session security documented with OWASP references

### Growth Features (Post-MVP)

- React Native mobile view (responsive demo for mobile-first interviewers)
- Grafana alert tuning + Alertmanager integration (pager/webhook routing)
- Keycloak SSO integration (demonstrates enterprise IDP awareness)
- Advanced rate limiting and fraud detection simulation
- DMZ perimeter hardening design package and promotion evidence gate for future hardened ingress mode
- Mobile order trust-hardening follow-up:
  - Revisit whether mobile continuity should prioritize trusted device/app state over the current shared login-context continuity model
  - Define server-owned mobile trust inputs such as `deviceInstallationId`, `deviceTrustBindingId`, and `sessionFamilyId`
  - Define invalidation rules for app reinstall, secure-storage wipe, trust revoke/rotate, session-family mismatch, and recovery/rebind security events
  - Evaluate telemetry-first rollout where mobile network change and background/resume become soft signals rather than immediate OTP triggers
  - Add mobile Step C local biometric/app-PIN transaction confirmation
  - Evaluate stronger device-keystore / FIDO-backed transaction assertions after MVP
  - See `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/post-mvp-mobile-order-trust-hardening.md` for the preserved discussion record and deferred design detail

### Vision (Future)

- Kafka event streaming replacing synchronous internal calls (MSA migration story)
- Outbox pattern for reliable event delivery
- Multi-exchange simulation (multiple FEP endpoints, routing logic)
- Load testing report with k6 or Gatling

## User Journeys

### Journey 1 - Jisu Stock Buy Order (Primary Happy Path)

**Persona:** Jisu, 28, is a retail investor using a KB-style web HTS (Home Trading System). She wants to buy 100 shares of a listed stock.

**Opening Scene:** Jisu opens the FIX web app on her laptop. She completes password + current TOTP login MFA, a protected session is issued, and the Portfolio View loads with her current cash balance and no existing holdings.

**Rising Action:** She opens order entry, selects Buy, enters symbol `005930`, quantity `100`, and limit price `5,000`. The Prepare step checks available cash against CoreBanking, detects insufficient funds, and forces her to lower the quantity to `60`. The second prepare attempt succeeds, returns an `orderSessionId` plus authorization-decision metadata (`challengeRequired=true`, `authorizationReason=ELEVATED_ORDER_RISK`), stores the session in Redis with a 10-minute TTL, and advances the UI to Step B.

**Climax:** She enters her 6-digit TOTP code. The system validates it against her registered secret and moves the order session to `AUTHED`. When she confirms the order, Channel calls CoreBanking, CoreBanking acquires a `SELECT FOR UPDATE` lock on the relevant position row, creates the order, and places it into the Order Book. The Order Book matches the order at `5,000`, emits an `ExecutionReport(OrdStatus=FILLED)`, and then CoreBanking forwards the trade through FEP Gateway to FEP Simulator using FIX 4.2 `NewOrderSingle(35=D)`. The simulator returns a matching `ExecutionReport(35=8, OrdStatus=FILLED)`, and the transaction commits with position and cash updates.

**Resolution:** The UI shows a successful fill message including the order number, executed price, and quantity. The trace ID is visible for debugging, and within 2 seconds an SSE notification confirms that symbol `005930` was filled at `5,000`.

**Capabilities Revealed:** Session management, mandatory password+TOTP login MFA, conditional order TOTP step-up, the order state machine (`NEW -> FILLED`), Order Book price-time priority matching, FIX 4.2 message exchange, position locking, SSE notification, and distributed trace IDs.

---

### Journey 2 - Jisu Exchange Connectivity Failure (Primary Failure Path)

**Persona:** The same user, Jisu, is now attempting to sell 50 shares of `005930`.

**Opening Scene:** She follows the same password + current TOTP login MFA flow, selects Sell, chooses a market order for 50 shares, completes Prepare successfully, and passes the conditional OTP verification only if the order session requires step-up so that the session reaches `AUTHED`.

**Rising Action:** On Execute, Channel calls CoreBanking while the simulator has already been configured to force timeouts using `PUT /fep-internal/rules { "action_type": "TIMEOUT", "delay_ms": 3000 }`. Three earlier timeouts have already exhausted the Resilience4j `slidingWindowSize=3` failure window.

**Climax:** After 3 consecutive FEP timeouts, the circuit breaker transitions to `OPEN`. On this execute call, the fallback fires immediately, no `@Transactional` block starts, no order record is inserted, and no position is mutated. The fallback returns `RC=9098 CIRCUIT_OPEN` to Channel, which marks the `OrderSession` as `FAILED`.

**Resolution:** The UI receives a clear failure response telling the user that the order could not be processed and that no position was changed. An SSE notification also reports the failure. The OPEN circuit-breaker state is visible in Actuator, no order row is created, and re-submitting the same `ClOrdID` returns the same deterministic failed result.

**Capabilities Revealed:** CB preemptive fallback (no order created, no position change), Resilience4j circuit breaker OPEN state, ClOrdID idempotency on FAILED session, failure UX messaging, audit log of failure event.

---

### Journey 3 - Hyunseok Admin Force-Logout (Security Ops)

**Persona:** Hyunseok is a Security Operations engineer. He receives an alert that a customer's account shows suspicious simultaneous logins from two different IP addresses.

**Opening Scene:** Hyunseok opens the dedicated admin web console, identifies the target user from the security event and audit views, and triggers a force-logout action from the browser UI. The console is backed by the same admin API contract used for force logout and audit retrieval.

**Climax:** The channel service invalidates all Redis-backed sessions for that user. Any in-flight request using the stale session immediately receives `401 Unauthorized`, and pending `PENDING_NEW` orders are cleaned up by the session-expiry flow.

**Resolution:** The audit log records the admin actor, target user, reason, and timestamp. On the next page load, the user is redirected to the login screen with a security message indicating that the session was terminated.

**Capabilities Revealed:** Admin web console, admin role endpoint, Redis session bulk invalidation, audit log with admin actor, 401 propagation on invalidated session, pending order cleanup on forced logout.

---

### Journey 4 - Portfolio Reviewer Journey

> _This is a non-standard journey included because FIX is a portfolio project. It maps how technical evaluators experience the repository._

**Securities-domain interviewer lens:**  
The reviewer opens the GitHub repository, scans the module structure, inspects `AuditLogService.java` for PII masking, opens `OrderExecutionService.java` to confirm `@Lock(PESSIMISTIC_WRITE)`, checks the schema in `V1__init.sql`, and verifies FIX mapping in `FIX42SessionAdapter.java`. They then open the README Security Architecture section and find OWASP-referenced operational vocabulary.
**Assessment:** _"This candidate understands why the channel layer and core banking layer are separated, and why FIX 4.2 matters in this domain."_

**FinTech interviewer lens:**  
The reviewer opens the GitHub repo, clicks the CI badge, confirms the concurrent sell-order test is green, inspects `PositionConcurrencyIntegrationTest.java`, checks the Resilience4j configuration in `application.yml`, runs `docker compose up`, submits a buy order, injects a timeout through the FEP chaos endpoint, and watches the circuit breaker open in Actuator.
**Assessment:** _"This candidate writes tests that prove the hard parts and understands FIX 4.2."_

**Capabilities Revealed:** README structure, Actuator exposure, CI badge integration, FEP chaos/test endpoint, Order Book matching engine, FIX 4.2 session state machine code visibility.

---

### Journey Requirements Summary

| Capability | Revealed By Journey |
| ---------- | ------------------- |
| Session management (Redis externalization) | J1, J3, J4 |
| Mandatory login MFA + conditional TOTP step-up | J1, J2 |
| Order-session state machine (`PENDING_NEW -> AUTHED -> EXECUTING -> COMPLETED / FAILED / ESCALATED / EXPIRED`) | J1, J2 |
| Order Book price-time priority matching | J1 |
| FIX 4.2 NewOrderSingle / ExecutionReport exchange | J1, J2 |
| FEP routing and timeout handling | J2 |
| Resilience4j circuit breaker + sliding window | J2, J4 |
| `ClOrdID` idempotency | J2 |
| SSE real-time notifications | J1, J2 |
| Admin force logout (Redis session bulk purge) | J3 |
| Audit log with actor + PII masking | J3, J4 |
| Distributed tracing (`traceparent`) | J1, J2 |
| FEP chaos/test endpoint | J4 |

## Domain-Specific Requirements

### Compliance Boundary Declaration

FIX is a **simulator**. It mirrors the control points and operational vocabulary of a Korean securities platform without connecting to live institutions or real customer data.

| Real Securities Component | FIX Simulator Equivalent | Why This Is Sufficient for Interviews |
| ------------------------ | ------------------------ | ------------------------------------- |
| HSM-backed OTP device | TOTP via Google Authenticator (RFC 6238) with Vault-stored secret | Demonstrates mandatory login MFA, conditional step-up, and secret replaceability |
| KRX FEP gateway (FIX 4.2 over leased line) | `fep-simulator` on port `8082` using QuickFIX/J SocketAcceptor | Demonstrates FIX 4.2 session handling and exchange fault tolerance |
| KSD securities settlement | Not implemented | Explicitly out of MVP scope |
| Regulatory reporting | Not implemented | Explicitly out of MVP scope |
| Enterprise SSO / bank identity fabric | Spring Security session cookie | Sufficient to prove auth/session architecture |
| Real PII | Faker-generated test data | No compliance exposure while still demonstrating masking rules |

Real KYC/AML integration, KRX/KSD live connectivity, and regulatory reporting are intentionally out of scope. The portfolio demonstrates the architecture and risk controls, not production institution onboarding.

---

### Security Standards (In Scope)

| Standard | Application in FIX |
| -------- | ------------------ |
| OWASP Authentication Cheat Sheet | Mandatory MFA at login plus re-authentication/step-up on elevated-risk order execution |
| OWASP CSRF | Synchronizer Token (`HttpSessionCsrfTokenRepository` + `X-CSRF-TOKEN` header) |
| OWASP Logging Cheat Sheet | No tokens, passwords, or raw PII in logs; account/member numbers masked to the last 4 digits |
| Spring Security Cookie Guidance | `HttpOnly` + `Secure` + `SameSite` session cookie attributes |

---

### OTP Lifecycle Specification

The authenticated journey uses mandatory password+TOTP login MFA first, and the later order flow may add a conditional TOTP step-up challenge when risk policy requires it:

```text
Phase 0A -> Password verification
  POST /api/v1/auth/login
  -> Validate email + password
  -> Return short-lived `loginToken`
  -> If already enrolled: `nextAction=VERIFY_TOTP`
  -> If not enrolled: `nextAction=ENROLL_TOTP`
  -> No protected session is issued at this stage

Phase 0B -> Login MFA completion
  If already enrolled:
    POST /api/v1/auth/otp/verify
    -> Validate `loginToken` + current TOTP
    -> On success: issue Redis-backed session and persist MFA proof metadata (`lastMfaVerifiedAt`, related trust signals)
  If not enrolled:
    POST /api/v1/members/me/totp/enroll
    -> Generate QR / manual entry bootstrap from the password-verified pre-auth state
    POST /api/v1/members/me/totp/confirm
    -> Enable TOTP and complete the first authenticated login
  -> Until Phase 0B succeeds, service use remains blocked

Phase 1 -> Prepare + Authorization Decision
  POST /api/v1/orders/sessions
  -> Validate available cash / available quantity against CoreBanking
  -> Create OrderSession in Redis (`ch:order-session:{sessionId}`)
  -> TTL: 3600 seconds (60 minutes)
  -> Evaluate current shared login-context continuity plus order risk attributes
  -> Current MVP uses trusted auth-session window (default 60 minutes) + login IP/user-agent continuity across FE and MOB
  -> Mobile-specific trusted-device/app continuity, soft-signal treatment for network change/background-resume, and local transaction confirmation are deferred post-MVP hardening topics
  -> Trusted auth-session window is a create-time auto-authorization rule only; it decides whether the new session may start in `AUTHED` without Step B
  -> Return `sessionId`, `status`, `challengeRequired`, `authorizationReason`, and `expiresAt`
  -> Low risk + trusted auth session: `challengeRequired=false`, `authorizationReason=TRUSTED_AUTH_SESSION`, status becomes `AUTHED`
  -> Elevated risk: `challengeRequired=true`, status remains `PENDING_NEW`
  -> Initialize `ch:otp-attempts:{sessionId}` = 3 (NX EX 3600)

Phase 2 -> Conditional Step-Up (only when `challengeRequired=true`)
  POST /api/v1/orders/sessions/{sessionId}/otp/verify
  -> Validate RFC 6238 code (6 digits, 30-second window) only when challenge required
  -> Read secret from Vault: `secret/fix/member/{memberUuid}/totp-secret`
  -> Replay prevention: `ch:totp-used:{memberUuid}:{windowIndex}:{code}` TTL 60s
  -> Attempt tracking: `ch:otp-attempts:{sessionId}` with lockout at 0
  -> Debounce guard: `ch:otp-attempt-ts:{sessionId}` NX EX 1
  -> Step-up success: session status becomes AUTHED
  -> 3 failures: session status becomes FAILED
  -> Owner-only status query remains `GET /api/v1/orders/sessions/{sessionId}`

Phase 2A -> Active Session Extension (only before expiry)
  POST /api/v1/orders/sessions/{sessionId}/extend
  -> Owner-only; allowed while session is still active (`PENDING_NEW` or `AUTHED`)
  -> Extension is an active-session continuity action, not a new auto-authorization decision
  -> `lastMfaVerifiedAt` freshness is not re-evaluated on extend; stale MFA alone must not block an on-time extend request
  -> Reset `expiresAt` to extension time + 3600 seconds
  -> Refresh Redis TTL on both `ch:order-session:{sessionId}` and `ch:otp-attempts:{sessionId}`
  -> Client keeps countdown hidden in steady state, surfaces a non-blocking extension CTA only when 60 seconds or less remain, and shows a blocking expired-session modal only after actual expiry

Phase 3 -> Execute
  POST /api/v1/orders/sessions/{sessionId}/execute
  -> Requires AUTHED state
     - PENDING_NEW or any non-AUTHED active state -> HTTP 409 ORD-009
     - EXECUTING with active `ch:txn-lock` -> HTTP 409 ORD-010
     - EXPIRED or missing Redis key -> HTTP 404 ORD-008
  -> On start: session status becomes EXECUTING
  -> CoreBanking acquires `@Lock(PESSIMISTIC_WRITE)` on the position row
  -> Matching runs synchronously within `@Transactional`
  -> FEP Gateway sends FIX 4.2 `NewOrderSingle(35=D)`
  -> Order result is `NEW`, `PARTIALLY_FILLED`, or `FILLED`
  -> Post-commit sync failure updates external sync state to FAILED / ESCALATED
  -> Success: session status becomes COMPLETED
```

TOTP is the simulator substitute for a hardware token. The production delta is the secret provider implementation, not the user-facing API contract.

---

### Technical Constraints

| Constraint | Detail |
| ---------- | ------ |
| MySQL InnoDB | ACID transactions, REPEATABLE READ isolation, `SELECT FOR UPDATE` on position write paths |
| No distributed transactions | Compensating state transitions for FEP-side failures |
| Redis EXPIRE | Session TTL enforced in Redis; no cron cleanup needed for session expiry |
| Trace propagation | `traceparent` + `X-Correlation-Id` on every inter-service call |
| QueryDSL | Required for aggregate queries such as daily sell quantity checks |
| FIX 4.2 (QuickFIX/J) | Used only on the FEP Gateway <-> FEP Simulator segment; internal services stay JSON/HTTP |
| Market data freshness | Every quote snapshot carries `quoteAsOf`; stale quotes are rejected |

---

### Market Data Strategy (Paper Trading)

For this simulator, the external-facing market-data layer is not a settlement or clearing integration. Its role is to:

1. Receive quote, tick, or BBO data
2. Build deterministic quote snapshots for pre-trade validation and valuation
3. Feed the paper-trading execution engine

**Supported data modes:**

- `LIVE`: real-time provider stream normalized into quote events
- `DELAYED`: provider feed with configured delay
- `REPLAY`: deterministic replay for tests and demos

**LIVE provider contract (KIS Open API WebSocket `H0STCNT0`):**

- Real domain: `ws://ops.koreainvestment.com:21000`, paper domain: `ws://ops.koreainvestment.com:31000`
- WebSocket auth requires `approval_key` from `/oauth2/Approval`
- Subscribe/unsubscribe uses header values such as `approval_key`, `custtype`, `tr_type`, and `content-type=utf-8`
- Real-time frames use `encFlag|trId|count|payload`
- Multi-record payloads must be split by `count`
- If `encFlag=1`, the payload is decoded using AES key/IV returned during subscribe success

**Contract requirements:**

- Every quote snapshot includes `symbol`, `bestBid`, `bestAsk`, `lastTrade`, `quoteAsOf`, and `quoteSourceMode`
- `MARKET` pre-check and valuation must use the same `quoteSnapshotId`
- If quote age exceeds `maxQuoteAgeMs`, order prepare fails with a stale-quote validation error
- Replay mode must be deterministic from seed + event index so CI can reproduce behavior exactly

**Detailed provider spec reference:** `_bmad-output/planning-artifacts/fep-gateway/kis-websocket-h0stcnt0-spec.md`

---

### Domain Patterns

**Position Ledger (Canonical Source of Truth):** Local CoreBanking Order Book matching is the canonical execution source for paper trading. Every canonical match writes an `executions` record and mutates `positions` within the same `@Transactional` boundary. Position balance is always derivable as `SUM(BUY executed_qty) - SUM(SELL executed_qty)` per symbol. There is no position mutation without a matching execution record.

**Order State Machine:**

```text
OrderSession (Channel / Redis, TTL 10 min)
  PENDING_NEW -> AUTHED -> EXECUTING -> COMPLETED
                                   -> ESCALATED (post-commit FEP sync failure)
                                   -> FAILED (validation / DB / internal failure)
  EXPIRED (TTL elapsed; RecoveryService reconciles DB state)

Order (CoreBanking / MySQL)
  NEW -> PARTIALLY_FILLED -> FILLED
  NEW -> CANCELED
  NEW -> FAILED (no canonical fill created)
  FILLED + external_sync_status=FAILED/ESCALATED remains a valid local fill
```

> Validation failures such as `ORD-001`, `ORD-002`, and `ORD-003` happen before `orders` is inserted. Circuit-breaker OPEN fallback also creates no order row because the transaction never starts.

**Order Book (price-time priority):** MVP implements limit and market matching with strict price-time priority.

- `LIMIT`: buys sort by price DESC then time ASC; sells sort by price ASC then time ASC
- `MARKET`: sweeps the opposite book from best price outward until quantity is exhausted
- Partial fill is allowed when liquidity is insufficient
- Empty opposite book on a `MARKET` order produces a deterministic no-liquidity rejection

Matching runs synchronously inside CoreBanking `@Transactional` during MVP. Async matching is a Phase 2 option.

**Average Cost Method (MVP fixed):** weighted-average cost basis.

- BUY fill: `newAvg = ((oldQty * oldAvg) + (fillQty * fillPrice)) / (oldQty + fillQty)`
- SELL fill: `avg_cost` remains unchanged while quantity decreases

**PnL Model (MVP):**

- Unrealized PnL = `(markPrice - avg_cost) * quantity`
- Realized PnL = `(sellPrice - avg_cost) * soldQty`
- Fees and taxes are explicitly out of MVP scope

**ClOrdID Idempotency:** `ClOrdID` is client-generated UUID v4 (FIX Tag 11) and stored under a `UNIQUE INDEX`. Duplicate submission must return the original result with HTTP 200 and must never create a second fill.

---

### Compensation Protocol

**Order execution (InnoDB ACID + Order Book path):**

```text
BEGIN TRANSACTION
  1. SELECT position FOR UPDATE
  2. Validate cash / available quantity
  3. INSERT order row (status=NEW, ClOrdID=...)
  4. Run Order Book matching and INSERT execution rows
  5. UPDATE positions
  6. UPDATE order status to FILLED / PARTIALLY_FILLED / NEW
COMMIT
```

If matching finds no counterpart:

- `LIMIT`: the order rests in the book as `NEW`
- `MARKET`: deterministic no-liquidity reject applies with no execution row and no position mutation

FEP is called only after local canonical state is established.

**FEP failure handling (Saga-style):**

- **Circuit breaker OPEN before execution:** no transaction starts, no order is inserted, no position changes, and the `OrderSession` ends as `FAILED`
- **Timeout / HTTP 5xx / reject after local commit:** local fill and position state remain canonical; external sync state becomes `FAILED` or `ESCALATED`
- Recovery/replay updates only external confirmation state and must be idempotent

---

### Risk Simulation (MVP Scope)

**Daily Sell Limit (Position Guard):**

- Per-account configurable maximum sell quantity per day per symbol
- Prepare step rejects when cumulative same-day sell executions exceed the limit
- Error code: `ORD-002 DAILY_SELL_LIMIT_EXCEEDED`

**QueryDSL available-quantity enforcement query:**

```java
Long todaySold = query
    .select(orderExecution.executedQty.sum())
    .from(orderExecution)
    .where(
        orderExecution.accountId.eq(accountId),
        orderExecution.symbol.eq(symbol),
        orderExecution.side.eq(Side.SELL),
        orderExecution.createdAt.goe(LocalDate.now().atStartOfDay())
    )
    .fetchOne();
```

**User-facing message example:**

> Daily sell limit exceeded. Symbol 005930 allows 400 shares today, but the request was for 500 shares.

**Phase 2 expansion:** add more advanced fraud/risk signals, richer user-facing explanations, and configurable review workflows.

---

### Data Retention Policy

| Log Type | Retention | Storage | Mechanism |
| -------- | --------- | ------- | --------- |
| Audit log | 90 days | MySQL `channel_db` | `@Scheduled` purge |
| Security events | 180 days | MySQL `channel_db` | `@Scheduled` purge |
| Order records | 5 years | MySQL `core_db` | Not purged in MVP |
| Execution records | 5 years | MySQL `core_db` | Not purged in MVP |
| Application logs | 30 days | Docker log rotation | Log driver config |

---

### Error Code Taxonomy

**AUTH - Channel Service:**

| Code | Meaning |
| ---- | ------- |
| `AUTH-001` | Invalid credentials |
| `AUTH-002` | Account locked |
| `AUTH-003` | Unauthenticated (missing or invalid session) |
| `AUTH-004` | Withdrawn account |
| `AUTH-005` | Target member not found for admin operations |
| `AUTH-006` | Insufficient privilege |
| `AUTH-007` | Password policy violation |
| `AUTH-009` | TOTP enrollment required |
| `AUTH-010` | Invalid TOTP confirm code |
| `AUTH-011` | TOTP replay detected |
| `AUTH-012` | Reset token invalid or expired |
| `AUTH-013` | Reset token already consumed |
| `AUTH-014` | Password recovery rate limit exceeded |
| `AUTH-015` | New password equals current password |
| `AUTH-016` | Stale session after password change |
| `AUTH-017` | Email already exists |
| `AUTH-018` | Login token expired or already consumed |
| `AUTH-019` | MFA recovery proof or rebind token invalid or expired |
| `AUTH-020` | MFA recovery proof or rebind token replayed or already consumed |
| `AUTH-021` | MFA recovery required before login can continue |
| `AUTH-022` | Recovery challenge proof invalid, expired, mismatched, or malformed |
| `AUTH-023` | Recovery challenge bootstrap unavailable |
| `AUTH-024` | Recovery challenge proof replayed or already consumed |
| `AUTH-025` | Recovery challenge verify unavailable after solve |

**CHANNEL - Channel Service:**

| Code | Meaning |
| ---- | ------- |
| `CHANNEL-001` | Session cookie exists but Redis TTL already expired |
| `CHANNEL-002` | OTP mismatch |
| `CHANNEL-003` | OTP max attempts exceeded |
| `CHANNEL-006` | Ownership mismatch (`clOrdID` / `accountId`) |

**ORD - Order Flow:**

| Code | Meaning |
| ---- | ------- |
| `ORD-001` | Insufficient cash |
| `ORD-002` | Daily sell limit exceeded |
| `ORD-003` | Insufficient position quantity |
| `ORD-004` | Invalid symbol or price |
| `ORD-005` | Quantity exceeds current orderability boundary |
| `ORD-006` | Available cash is insufficient |
| `ORD-007` | Duplicate `ClOrdID` |
| `ORD-008` | Order session not found or expired |
| `ORD-009` | Order session is not executable in its current state |
| `ORD-010` | Duplicate execute blocked while another execution is in flight |
| `ORD-012` | Account status blocked (`FROZEN` / `CLOSED`) |

**CORE - CoreBanking Service:**

| Code | Meaning |
| ---- | ------- |
| `CORE-001` | Account or position not found |
| `CORE-002` | Insufficient position or cash |
| `CORE-003` | Concurrent modification conflict; Channel may retry briefly |
| `CORE-004` | Transaction rollback |

**FEP - FEP Simulator / Gateway:**

| Code | Meaning |
| ---- | ------- |
| `FEP-001` | Exchange unavailable (circuit breaker, pool, logon, or key state) |
| `FEP-002` | Exchange connectivity timeout |
| `FEP-003` | Exchange rejected order |
| `FEP-004` | Invalid FIX session state |

---

### Masked Account / Member Number Format

| Context | Format | Example |
| ------- | ------ | ------- |
| UI display | `[broker]-****[last4]` | `KBS-****4521` |
| Log output | `[firm_code]-****-[last4]` | `KBS-****-4521` |
| Prohibited | Full account number in any log | Never allowed |

**Unit test requirement:** `AccountNumber.masked()` in `channel-common` must guarantee that the full number never appears and the last four digits are preserved.

---

### Order State Machine Test Matrix

| Test Case | Scenario | Expected Result |
| --------- | -------- | --------------- |
| `TC-ORD-01` | Buy order happy path -> `FILLED` | 200, position updated |
| `TC-ORD-02` | OTP wrong once, session remains `PENDING_NEW` | 4xx, session still usable |
| `TC-ORD-03` | OTP wrong three times, session -> `FAILED` | 403 `CHANNEL-003` |
| `TC-ORD-04` | Execute while still `PENDING_NEW` | 409 `ORD-009` |
| `TC-ORD-05` | Execute on `COMPLETED` session | 409 `ORD-009` |
| `TC-ORD-06` | Session TTL expired (>3600s, or not extended before expiry) | 404 `ORD-008` |
| `TC-ORD-07` | Reuse `ClOrdID` | 200 with original result |
| `TC-ORD-08` | Concurrent sell (10 threads, same position) | Exactly 5 FILLED, no oversell |

---

### Database Index Decisions

```sql
-- executions (core_db)
INDEX idx_order_exec_account_date (account_id, side, created_at);

-- orders (core_db)
UNIQUE INDEX idx_clordid (clOrdID);

-- order_sessions (channel_db)
UNIQUE INDEX idx_order_session_id (session_id);

-- audit_log (channel_db)
INDEX idx_audit_user_time (user_id, created_at);
```

These indexes exist to prove the intended access paths for daily-limit queries, idempotency, session lookup, and retention purges.

---

### UX Error Strings (Domain-Mandated)

**Order session expired (`TC-ORD-06`):**

> Your order session expired. Please enter the order details again.

Action: show a restart-order button and discard the stale `orderSessionId`.

**Insufficient position (`ORD-003`):**

> Insufficient holdings. The account currently holds 30 shares, but the request was for 50 shares.

Action: keep the order form open and let the user edit quantity.

**Insufficient cash (`ORD-001`):**

> Insufficient buying power. Available cash is 1,200,000 KRW, while the requested order value is 1,500,000 KRW.

Action: keep the form values visible and highlight the price or quantity field that must change.
## Innovation & Novel Patterns

### Detected Innovation Areas

**1. QueryDSL + Pessimistic Locking Composition**

FIX combines QueryDSL for type-safe aggregate queries with JPA `@Lock(PESSIMISTIC_WRITE)` for concurrent position mutation safety in the same execution path. The critical sequencing rule is deliberate: lock the position row first, then run the daily-sell aggregate query while the position is already protected.

```java
// Step 1: Lock the position row (SELECT FOR UPDATE)
Position pos = positionRepository.findByAccountAndSymbolWithLock(accountId, symbol);

// Step 2: Query the daily sell aggregate
Long todaySold = queryDslExecutionRepository.sumTodaySellQty(accountId, symbol);
// Position is already locked, so concurrent sell mutations are blocked
```

**Why pessimistic over optimistic locking (`@Version`):**

- Typical pessimistic-lock hold time for a single-position update is measured in a few milliseconds
- Optimistic-lock retries would force the user back through a much longer order confirmation path
- Re-entering OTP because of concurrency retry is unacceptable in this domain
- The choice is intentionally opinionated and interview-defensible, not accidental

**Future-proofing for hot symbols:** the schema already anticipates high-contention symbols through `balance_update_mode` (`EAGER`, `DEFERRED`).

- **MVP (`EAGER`)**: standard pessimistic locking, simple and proven
- **Phase 2 (`DEFERRED`)**: insert-only execution log with asynchronous position updates

---

**2. Live-Observable Fault Injection (FEP Chaos Endpoint)**

The FEP simulator exposes a bounded chaos endpoint:

```text
PUT /fep-internal/rules
Body: { "action_type": "TIMEOUT", "delay_ms": 3000, "failure_rate": 0.0 }
```

This lets an interviewer trigger circuit-breaker behavior on demand during a demo. The Resilience4j OPEN state becomes visible in `/actuator/circuitbreakers` within seconds, making failure handling observable instead of theoretical.

---

**3. Order Book Matching + Position Ledger as Architectural Vocabulary**

Every execution produced by the local canonical matcher writes `executions` and mutates `positions` inside the same `@Transactional` boundary. Position state is always derivable as `SUM(BUY executed_qty) - SUM(SELL executed_qty)`, which makes the ledger model inspectable and testable.

The Order Book uses strict price-time priority:

- buys sort by price DESC then timestamp ASC
- sells sort by price ASC then timestamp ASC
- `MARKET` orders sweep the opposite book in that order

For MVP, matching runs as a synchronous in-process scan. Phase 2 may replace this with a more specialized persistent structure such as a sorted set or skip-list-backed book.

Validated by `PositionIntegrityIntegrationTest`, which proves `SUM(BUY executed_qty) - SUM(SELL executed_qty) == positions.quantity` after repeated executions on real InnoDB via Testcontainers.

---

**4. Documented Simulation Boundary (Interface Compliance Without Real Integration)**

Instead of hiding the absence of live KYC, HSM OTP, or exchange hardware, FIX documents each boundary explicitly in the README's `Architecture Decisions` section.

```text
Decision: OTP uses TOTP (RFC 6238) with a Google Authenticator-compatible contract
Why: The flow stays stateless, replay-resistant, and familiar to trading-system users
Simulation boundary: Vault stores the TOTP secret; production replaces only the secret-provider implementation
Interview talking point: "The OTP contract was designed for HSM replaceability"
```

This turns a portfolio limitation into an architectural communication strength.

---

**5. Dual-Audience README as a Guided Journey**

The README is designed as a branching journey for two reviewer types:

```text
Bank / securities interviewer path
  -> sees domain framing in the first screen
  -> opens Security Architecture for OWASP, OTP, session, and FIX 4.2 context
  -> opens Architecture Decisions for simulation-boundary rationale
  -> leaves with the sense that the candidate understands operational banking vocabulary

FinTech interviewer path
  -> clicks the CI badge immediately
  -> opens PositionConcurrencyIntegrationTest and the FEP chaos demo path
  -> runs docker compose and checks Actuator / observability behavior
  -> leaves with the sense that the candidate ships working systems, not just documents
```

---

### Market Context & Competitive Landscape

| Gap in Typical Securities Portfolios | How FIX Addresses It |
| ------------------------------------ | -------------------- |
| Monolith with no service separation | Four deployable services with clear Channel / CoreBanking / FEP boundaries |
| Position modeled as a fragile running counter | `positions` + `executions` ledger model with derivable balance |
| No concurrency proof | `TC-ORD-08` and `PositionIntegrityIntegrationTest` prove oversell protection |
| Auth stops at JWT login | Spring Session + Redis + mandatory password+TOTP login MFA plus conditional order step-up |
| Resilience is claimed but not shown | Resilience4j circuit breaker is demoable through chaos injection and Actuator |
| No exchange protocol knowledge | FIX 4.2 `NewOrderSingle` / `ExecutionReport` path implemented via QuickFIX/J |
| README is only setup instructions | Dual-audience README with architecture, security, and demo paths |

**Why this combination is rare:** many portfolios stop at CRUD plus JWT. FIX intentionally combines service separation, concurrency control, domain-aware security, FIX protocol handling, resilience, and demonstrable tests in one coherent project.

**Searchability strategy:** README and code comments deliberately pair domain vocabulary used by Korean securities teams with standard English systems terminology such as `pessimistic lock`, `Order Book`, `FIX 4.2`, and `circuit breaker`.

---

### Validation Approach

| Innovation Claim | Supporting Test / Artifact | What It Proves |
| ---------------- | -------------------------- | -------------- |
| QueryDSL + locking composition | `PositionConcurrencyIntegrationTest` | No oversell under real concurrent load on InnoDB |
| FEP chaos endpoint | `FepChaosIntegrationTest` + Actuator observation | Circuit-breaker configuration is intentional and visible |
| Position integrity | `PositionIntegrityIntegrationTest` | Ledger-derived position remains correct after repeated executions |
| Simulation boundary narrative | README `Architecture Decisions` | Portfolio constraints are acknowledged and defended clearly |
| Dual-audience README | Interviewer demo script | The repository is navigable by different reviewer personas |

**`PositionConcurrencyIntegrationTest` specification:**  
10 threads submit sell orders for symbol `005930` against a 500-share position. `CountDownLatch` fires them simultaneously, each attempting to sell 100 shares. The expected result is exactly 5 FILLED orders, final `positions.quantity = 0`, and zero oversell outcomes, all verified against real MySQL via Testcontainers.

**`PositionIntegrityIntegrationTest` specification:**  
After N sequential orders across multiple symbols, `positions.quantity >= 0` remains true and `SUM(BUY executed_qty) - SUM(SELL executed_qty) == positions.quantity` holds for every symbol. No orphan executions are allowed.

---

### Risk Mitigation

| Risk | Mitigation |
| ---- | ---------- |
| QueryDSL multi-module APT setup complexity | Week 1 spike validates Q-class generation before feature work |
| Testcontainers cold-start overhead | `.withReuse(true)` plus documented local reuse settings |
| QueryDSL scope creep | MVP limits QueryDSL to a small, justified set of aggregate queries |
| FEP chaos complexity | Keep chaos contract bounded to `action_type`, `delay_ms`, and `failure_rate` |
| Ledger overengineering | MVP uses a minimal but correct execution ledger, not a full accounting journal |
| README quality slipping late in the sprint | Reserve Week 5 as an explicit documentation sprint |

---

### README Structure Specification (Week 5 Deliverable)

The README should keep an 11-section, dual-audience structure:

1. Project headline with a clear portfolio value proposition
2. CI badge row
3. `docker compose up` quick start
4. Architecture diagram (Mermaid)
5. "What FIX Demonstrates" summary
6. Demo script for bank-interviewer and FinTech-interviewer tracks
7. Architecture Decisions
8. Security Architecture
9. Test Coverage and proof tests
10. API Reference overview
11. Module Structure with bounded-context labels

## Distributed Backend Specific Requirements

### Project-Type Overview

FIX is a `distributed-backend-system` built from four deployable Spring Boot services: Channel, CoreBanking, FEP Gateway, and FEP Simulator. The services communicate over REST or FIX 4.2, share no in-process state, and are isolated through Docker Compose networking.

**API versioning strategy:** use explicit path prefixes from day 1.

- External client APIs: `/api/v1/`
- Service-to-service APIs: `/internal/v1/`
- FEP operational / simulator control APIs: `/fep-internal/`

**Rate-limiting strategy:** Bucket4j with Redis backing, applied in a way that is explicit, testable, and easy to explain during review.

---

### API Endpoint Specification

**Channel Service (port 8080, external-facing)**

```text
# Authentication
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
GET    /api/v1/auth/csrf

# Accounts / Portfolio
GET    /api/v1/accounts
GET    /api/v1/accounts/{accountId}
GET    /api/v1/accounts/{accountId}/positions
GET    /api/v1/accounts/{accountId}/cash

# Orders (Prepare -> Authorize -> Execute)
POST   /api/v1/orders/sessions
GET    /api/v1/orders/sessions/{sessionId}
POST   /api/v1/orders/sessions/{sessionId}/otp/verify
POST   /api/v1/orders/sessions/{sessionId}/execute
GET    /api/v1/orders

# Notifications (SSE)
GET    /api/v1/notifications/stream

# Admin (ROLE_ADMIN only)
POST   /api/v1/admin/sessions/force-invalidate
GET    /api/v1/admin/audit-logs
DELETE /api/v1/admin/members/{memberUuid}/sessions
```

**CoreBanking Service (port 8081, Channel-internal only)**

```text
# Order execution + Order Book
POST   /internal/v1/sessions/{sessionId}/execute
GET    /internal/v1/accounts/{accountId}/positions?symbol={symbol}
GET    /internal/v1/accounts/{accountId}/positions
GET    /internal/v1/accounts/{accountId}/cash
GET    /internal/v1/orders/{orderId}/executions
```

**FEP Gateway (port 8083, CoreBanking-internal only)**

```text
POST   /fep/v1/orders
GET    /fep/v1/orders/{clOrdID}/status
GET    /fep-internal/health
```

**FEP Simulator (port 8082, FEP Gateway-internal only)**

```text
# FIX 4.2 TCP session (QuickFIX/J SocketAcceptor)
FIX    [NewOrderSingle 35=D] -> ExecutionReport 35=8
FIX    [OrderCancelRequest 35=F] -> ExecutionReport (CANCELED)

# Chaos control (HTTP)
GET    /fep-internal/health
PUT    /fep-internal/rules
```

---

### Authentication Model

| Layer | Mechanism | Detail |
| ----- | --------- | ------ |
| Channel <-> User | Spring Security session cookie | `SESSION`, `HttpOnly`, `Secure`, `SameSite`, stored in Redis |
| Channel <-> CoreBanking | `X-Internal-Secret` + Docker network | `INTERNAL_API_SECRET` validated on every internal request |
| CoreBanking <-> FEP Gateway | `X-Internal-Secret` + Docker network | Same shared-secret pattern |
| FEP Gateway <-> FEP Simulator | FIX 4.2 TCP session | QuickFIX/J initiator / acceptor pair with heartbeat policy |
| Step-up auth | TOTP (RFC 6238) | 6-digit code, 30-second window, 3-attempt lockout, Vault-stored secret |

**Docker Compose network isolation (two-layer defense):**

```yaml
networks:
  external-net:  # Channel only; port 8080 exposed
  core-net:      # Channel <-> CoreBanking
  gateway-net:   # CoreBanking <-> FEP Gateway
  fep-net:       # FEP Gateway <-> FEP Simulator

services:
  channel-service:
    networks: [external-net, core-net]
    ports: ["8080:8080"]
  corebank-service:
    networks: [core-net, gateway-net]
  fep-gateway:
    networks: [gateway-net, fep-net]
  fep-simulator:
    networks: [fep-net]
  mysql:
    networks: [core-net]
  redis:
    networks: [core-net]
```

**CSRF:** use the Synchronizer Token pattern with `HttpSessionCsrfTokenRepository`. The client fetches `GET /api/v1/auth/csrf` and sends `X-CSRF-TOKEN` on all non-GET requests.

---

### Data Schemas

**channel_db tables:**

| Table | Storage | Notes |
| ----- | ------- | ----- |
| `users` | MySQL | Email auth record, password hash, role, login-attempt counters, TOTP enrollment flags |
| `audit_logs` | MySQL | Actor, action, target, masked account, IP, created time |
| `security_events` | MySQL | Security-relevant events such as lockout and forced logout |
| `notifications` | MySQL | Notification history metadata |
| `order_sessions` | MySQL | Authoritative order-session record keyed by `session_id`; stores account reference, order intent, status, and execution snapshot |
| `sessions` | Redis | Spring Session data for `SESSION`, TTL 30 minutes sliding |
| `totp_keys` | Redis | `ch:totp-used:{memberUuid}:{windowIndex}:{code}`, TTL 60s |
| `otp_attempts` | Redis | `ch:otp-attempts:{sessionId}`, TTL 3600s, initialized to 3 and refreshed with session extension |
| `order_session_cache` | Redis | `ch:order-session:{sessionId}`, TTL 3600s; fast-read cache over MySQL `order_sessions`, owner-only extend refresh supported |
| `txn_locks` | Redis | `ch:txn-lock:{sessionId}`, `NX EX 30` execute-phase lock |
| `otp_debounce` | Redis | `ch:otp-attempt-ts:{sessionId}`, `NX EX 1` debounce key |
| `recovery_locks` | Redis | `ch:recovery-lock:{sessionId}`, `NX EX 120` recovery idempotency lock |

**core_db tables:**

| Table | Storage | Notes |
| ----- | ------- | ----- |
| `accounts` | MySQL | Account header, balance, daily limit, status, and balance-update mode |
| `positions` | MySQL | Symbol quantity and average cost per account |
| `orders` | MySQL | Canonical order row with unique `clOrdID`, order status, and external sync status |
| `executions` | MySQL | Execution ledger rows linked to `orders.id` |
| `position_pnl_snapshots` | MySQL | Derived valuation snapshots by symbol and source mode |
| `order_record_diagnostics` | MySQL | Larger error or replay diagnostics kept separate from hot rows |

---

### Rate Limits

**MVP auth/order write surface with Bucket4j + Redis backing:**

| Endpoint | Limit | Error Response |
| -------- | ----- | -------------- |
| `POST /api/v1/auth/login` | 5 req/min per IP | 429 + `Retry-After` |
| `POST /api/v1/auth/password/forgot` | 5 req/min per IP + 3/15 min per email + 1/5 min mail cooldown | 429 + `Retry-After` |
| `POST /api/v1/auth/password/forgot/challenge` | 5 req/min per IP + 3/10 min per email + 60/min global | 429 + `Retry-After` |
| `POST /api/v1/auth/password/reset` | 10 req/5 min per IP + 5/15 min per token hash + 60/min global | 429 + `Retry-After` |
| `POST /api/v1/orders/sessions/{sessionId}/otp/verify` | 3 attempts per session | 422 `CHANNEL-002`, 403 `CHANNEL-003`, 429 `RATE-001` only for debounce/rate-limit paths |
| `POST /api/v1/orders/sessions` | 10 req/min per user | 429 + remaining quota in response |

**Baseline non-rate-limited in MVP:** `/internal/v1/`, `/fep-internal/`, and most public `GET` endpoints, except explicitly documented session-scoped or admin read APIs.

**Additional note:** password-recovery endpoints also enforce tighter per-email, per-token, cooldown, and endpoint-global protections. The table above is the main public-facing summary.

**OTP clarification:** `POST /api/v1/orders/sessions/{sessionId}/otp/verify` returns HTTP 422 `CHANNEL-002` for mismatch, HTTP 403 `CHANNEL-003` for attempt exhaustion, and HTTP 429 `RATE-001` only for debounce or explicit rate-limit paths.

**OTP / rate-limit interaction:** attempt exhaustion is an application-state outcome, not a Bucket4j outcome. In other words, `CHANNEL-002` and `CHANNEL-003` remain the canonical business responses, while `429 + Retry-After` is reserved for explicit debounce or rate-limit enforcement.

**Epic 12 perimeter interaction (future hardened mode):** Epic 12 may add pre-auth edge IP-based limits for unknown/sensitive routes and temporary deny controls. Those perimeter controls do not replace the application/session/user-level limits above. The stricter rejecting layer wins at runtime, and evidence must record whether rejection occurred at the edge or application layer. Edge-generated denials must emit `enforcement_layer=edge` and the applied `limit_key_type`; application throttles must emit `enforcement_layer=application` with their session/user/object key type in audit or security-event evidence.

---

### Standard Response Envelope

**Success (2xx):**

```json
{
  "success": true,
  "data": {},
  "traceId": "00-4bf92f3577b34da6-00f067aa0ba902b7-01"
}
```

**Error (4xx/5xx):**

```json
{
  "success": false,
  "error": {
    "code": "ORD-002",
    "message": "Daily sell limit exceeded.",
    "detail": {
      "todayUsed": 3200000,
      "dailyLimit": 5000000,
      "remaining": 1800000
    }
  },
  "traceId": "00-4bf92f3577b34da6-00f067aa0ba902b7-01"
}
```

**Implementation:** `@RestControllerAdvice` `GlobalExceptionHandler` converts all exceptions to the standard response envelope. `traceId` is injected from MDC using the incoming `traceparent`.

---

### API Documentation

| Service | Spec Generation Source | Canonical Serving Endpoint |
| ------- | ---------------------- | -------------------------- |
| Channel Service | `generateOpenApiDocs` -> `build/openapi/*.json` | GitHub Pages aggregated Swagger UI |
| CoreBanking Service | `generateOpenApiDocs` -> `build/openapi/*.json` | GitHub Pages aggregated Swagger UI |
| FEP Gateway | `generateOpenApiDocs` -> `build/openapi/*.json` | GitHub Pages aggregated Swagger UI |
| FEP Simulator | `generateOpenApiDocs` -> `build/openapi/*.json` | GitHub Pages aggregated Swagger UI |

`springdoc-openapi` plus build-time spec generation provides the canonical documentation bundle. The final public endpoint is `https://<org>.github.io/<repo>/` after `docs-publish.yml`.

---

### CORS & Environment Configuration

**CORS policy:**

- Development: `allowedOrigins("http://localhost:5173")` with `allowCredentials=true`
- Production (Docker Compose): Nginx reverse-proxies `/api/` to `channel-service:8080`; React is served same-origin, so CORS is not required

**Environment variables (`.env.example` committed to repo; `.env` gitignored):**

```bash
# Channel
SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/channel_db
SPRING_REDIS_HOST=redis
SPRING_SESSION_TIMEOUT=30m
INTERNAL_API_SECRET=dev-internal-secret-change-in-prod
CORS_ALLOWED_ORIGINS=http://localhost:5173
RATE_LIMIT_LOGIN_CAPACITY=5
RATE_LIMIT_LOGIN_REFILL_SECONDS=60

# CoreBanking
SPRING_DATASOURCE_URL=jdbc:mysql://mysql:3306/core_db
SPRING_REDIS_HOST=redis
INTERNAL_API_SECRET=dev-internal-secret-change-in-prod
DAILY_SELL_LIMIT_DEFAULT=500

# FEP Simulator
FEP_CHAOS_ENABLED=false
FEP_CHAOS_ACTION_TYPE=IGNORE
FEP_CHAOS_DELAY_MS=0
FEP_CHAOS_FAILURE_RATE=0

# MySQL
MYSQL_ROOT_PASSWORD=fix-dev-root
```

---

### Test Architecture

**Gradle module test strategy:**

| Module | Test Type | Tools |
| ------ | --------- | ----- |
| `channel-auth` | `@WebMvcTest` | MockMvc, no DB |
| `channel-order` | `@WebMvcTest` | MockMvc, no DB |
| `channel-integration-test` | `@SpringBootTest` | Testcontainers (MySQL + Redis) |
| `corebank-service` | `@WebMvcTest` | MockMvc, no DB |
| `corebank-integration-test` | `@SpringBootTest` | Testcontainers (MySQL + Redis) |

Fast tests (`@WebMvcTest`) and slow tests (`@SpringBootTest` + Testcontainers) run separately in CI:

```text
./gradlew :channel-auth:test :channel-order:test
./gradlew :channel-integration-test:test
```

**Auth test matrix (TC-AUTH):**

| Test Case | Scenario | Expected |
| --------- | -------- | -------- |
| `TC-AUTH-01` | Successful login | 200, `SESSION` HttpOnly cookie |
| `TC-AUTH-02` | Account locks after 5 failed logins | `AUTH-002` account locked |
| `TC-AUTH-03` | Inactive or withdrawn account login | authentication rejection |
| `TC-AUTH-04` | Access `/auth/me` without session | 401 |
| `TC-AUTH-05` | Login rate limit triggered on the 6th request in one minute | 429 Too Many Requests |

**Rate limit test matrix (TC-RATE):**

| Test Case | Scenario | Expected |
| --------- | -------- | -------- |
| `TC-RATE-01` | 6th login attempt from same IP within 1 minute | 429 |
| `TC-RATE-02` | Login succeeds again after refill window | success after bucket refill |
| `TC-RATE-03` | 4th OTP attempt on already failed session | 409 `ORD-009` |

---

### React Web API Client Structure

```text
src/api/
  apiClient.ts
    - axios instance
    - baseURL from VITE_API_BASE_URL
    - withCredentials: true
    - response-envelope unwrapping
    - CSRF session token fetch + X-CSRF-TOKEN interceptor
    - AUTH-003 auto-redirect to /login
  authApi.ts
    - login, logout, me
  accountApi.ts
    - getAccounts, getAccount
  orderApi.ts
    - prepare, verifyOtp, execute, getSession
  notificationApi.ts
    - streamNotifications (SSE / EventSource)
```

Version migration path: changing `VITE_API_BASE_URL` is sufficient because all API modules inherit from the shared client.


## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP approach:** interview-ready portfolio MVP  
**Resource model:** yeongjae, solo developer, 6 weeks

The MVP is complete when every architectural claim in FIX is backed by a passing CI test and a reviewer can independently verify that claim within 5 minutes of opening the repository.

---

### MVP Feature Set (Phase 1 - Week 6 Exit Gate)

**Core user journeys supported:**

- Journey 1: order execution happy path (`PENDING_NEW -> AUTHED -> EXECUTING -> COMPLETED`)
- Journey 2: FEP circuit-breaker failure path (`PENDING_NEW -> AUTHED -> EXECUTING -> FAILED`)
- Journey 3: admin force logout via Redis session invalidation
- Journey 4: portfolio reviewer path across GitHub, CI, demo flow, and Actuator

**Must-have capabilities:**

| Category | MVP Included |
| -------- | ------------ |
| Auth | Login (password+TOTP), TOTP enrollment, logout, Redis session, password recovery, conditional order step-up, force logout |
| Orders | `sessions -> otp/verify -> execute` state machine |
| Position | Atomic position update per execution |
| Idempotency | `clOrdID` unique index + app-layer protection |
| Resilience | Resilience4j circuit breaker on FEP path plus recovery flow |
| Rate Limiting | Bucket4j on login, password recovery, OTP, and order-session creation |
| Observability | Prometheus + Grafana + Micrometer + trace propagation |
| Notifications | SSE stream + DB persistence |
| Admin | Force-invalidate session API |
| Documentation | Swagger UI + dual-audience README |
| Infrastructure | Docker Compose with service/network isolation |
| CI | GitHub Actions with all 7 acceptance scenarios green |
| Frontend | React Web with 5 screens (Login, Account List, Detail, Order, Notifications) |

---

### 7 Non-Negotiable Acceptance Scenarios

All seven must pass in CI before MVP is complete:

| # | Scenario | Layer | Claim Proven |
| - | -------- | ----- | ------------ |
| 1 | Order execution E2E happy path | Channel -> CoreBanking | State machine and trace propagation |
| 2 | Concurrent sell (10 threads) -> exactly 5 FILLED, final `positions.quantity = 0` | CoreBanking | `SELECT FOR UPDATE` locking |
| 3 | OTP failure blocks order execution | Channel | Step-up re-authentication enforcement |
| 4 | Duplicate `clOrdID` returns idempotent result | CoreBanking | No double fill on retry |
| 5 | FEP timeout -> circuit breaker OPEN after 3 failures | CoreBanking + Channel | Resilience4j sliding-window behavior |
| 6 | Session invalidated after logout -> subsequent API call rejected | Channel + Redis | Redis-backed session security |
| 7 | After N orders -> no negative position quantity | CoreBanking | Atomic position update and oversell prevention |

---

### Interview-Ready Exit Gate (Week 6 Checklist)

**System proof**

- [ ] All 7 acceptance scenarios are green in GitHub Actions
- [ ] `docker compose up` reaches first successful API call within 120 seconds
- [ ] JaCoCo thresholds met: channel >= 70%, corebank >= 80%, fep-gateway >= 60%, fep-simulator >= 60%

**Demo readiness (yeongjae speaking points)**

- [ ] Can open `PositionConcurrencyIntegrationTest.java` and explain why pessimistic locking was chosen
- [ ] Can explain why the execution ledger and positions table are both required
- [ ] Can trigger the FEP chaos endpoint live and explain circuit breaker OPEN behavior
- [ ] Can justify why Kafka is future scope rather than MVP scope

**Reviewer experience**

- [ ] README supports a 5-minute dual-audience walkthrough
- [ ] API docs are reachable at `https://<org>.github.io/<repo>/`
- [ ] GitHub Actions badge visibly reflects current CI state

---

### 6-Week Delivery Map

| Week | Primary Deliverable | Verification Signal |
| ---- | ------------------- | ------------------- |
| Week 1 | Gradle skeleton + QueryDSL spike + Flyway V1 | `./gradlew build` succeeds and Q-class generation works |
| Week 2 | CoreBanking domain model + position logic + `PositionIntegrityIntegrationTest` | Internal account/position APIs respond correctly |
| Week 3 | Channel auth + order flow + OTP + Redis + Bucket4j | Full login -> prepare -> OTP -> execute curl flow works |
| Week 4 | FEP simulator + Resilience4j + chaos endpoint + integration tests | Chaos timeout opens circuit breaker in Actuator |
| Week 5 | React Web 5 screens + SSE + README + Swagger | Local UI demo works end-to-end |
| Week 6 | CI green, polish, README finalization, demo readiness | GitHub Actions green and walkthrough script complete |

---

### Post-MVP Features

**Phase 2 - Growth**

- React Native mobile view
- Grafana alert tuning + Alertmanager integration
- Keycloak SSO integration
- More advanced Bucket4j policies beyond IP-based defaults
- Richer admin / operational dashboards beyond the baseline admin console
- SSE polling fallback option

**Phase 3 - Vision**

- Kafka event streaming
- Outbox pattern
- Multi-exchange FEP routing
- k6 or Gatling load-test report

---

### Risk Mitigation Strategy

**Technical risks:**

| Risk | Severity | Mitigation |
| ---- | -------- | ---------- |
| QueryDSL Gradle APT setup complexity | Medium | Validate Q-class generation in Week 1; keep JPQL fallback available |
| Testcontainers cold start / Docker instability | Medium | Verify Docker environment in Week 1 and document local setup clearly |
| React `EventSource` plus session/CORS quirks | Medium | Run Week 5 POC early and keep polling fallback available |
| Resilience4j sliding-window tuning drift | Medium | Lock scenario with explicit integration tests and chaos drills |

**QueryDSL spike fallback (if value stays low):**  
JPQL `@Query` plus `@Lock(PESSIMISTIC_WRITE)` can still support the core MVP claim. QueryDSL remains a growth-path enhancement, not a blocker to correctness.

**Resource-risk fallback for a compressed MVP:**  
If time becomes constrained, the lowest-priority candidates to compress are:

1. Swagger UI polish
2. Advanced Bucket4j configuration breadth
3. SSE enhancements beyond the core happy path
4. React polish beyond the core proof-of-function flow

**CI pipeline structure:**

```yaml
jobs:
  fast-tests:        # @WebMvcTest
  integration-tests: # @SpringBootTest + Testcontainers
  coverage:
    needs: [fast-tests, integration-tests]
    # publishes JaCoCo-based coverage badges
```


## Functional Requirements

> **Capability Contract:** All 61 FRs below define the complete MVP capability contract for FIX. They describe WHAT the system must do, not HOW it is implemented. Password recovery is included in this contract, and post-MVP items remain intentionally excluded from the numbered FR set.

### User Authentication & Session

- **FR-01:** Registered user can authenticate with email, password, and current TOTP credentials before a protected session is issued
- **FR-02:** Authenticated user can terminate their session (logout)
- **FR-03:** System can maintain user session state across multiple requests without re-authentication
- **FR-04:** User can retrieve their own identity and role information from an active session
- **FR-05:** System can expire a user session after a configured period of inactivity
- **FR-06:** System can lock a user account after a configured number of consecutive failed login attempts
- **FR-07:** System can enforce a request rate limit on login attempts per IP address
- **FR-52:** System can reject requests to protected resources from unauthenticated users with an authentication-required response
- **FR-57:** System can accept password recovery initiation requests without revealing whether the submitted account is eligible for reset
- **FR-58:** System can issue a password recovery challenge bootstrap contract with signed challenge token, replay-safe nonce handling, and a bounded TTL
- **FR-59:** System can reset a password with a valid one-time recovery token and atomically consume that token while recording the password rotation timestamp
- **FR-60:** System can invalidate active sessions after a successful password reset so stale follow-up requests are rejected
- **FR-61:** System can enforce dedicated rate limits and anti-enumeration protections for password recovery initiation, challenge, and reset endpoints

### Account Management

- **FR-08:** Authenticated user can view a list of their own trading accounts
- **FR-09:** Authenticated user can view the details of a specific account including masked account number and current balance
- **FR-10:** System can display account numbers in a privacy-preserving masked format in all user-facing surfaces

### Order Initiation & Authorization

- **FR-11:** Authenticated user can initiate an order (buy/sell) by specifying account, symbol, quantity, and side
- **FR-12:** System can validate an order request against available position quantity before proceeding
- **FR-13:** System can validate a SELL order request against the account's configured daily sell limit before proceeding
- **FR-14:** System can validate a time-based one-time code submitted by the user during login MFA or conditional order step-up authentication, using a pre-enrolled TOTP secret (RFC 6238, Google Authenticator-compatible)
- **FR-15:** Authenticated user can submit a one-time code to advance a pending order to authorized state
- **FR-16:** System can enforce a maximum number of OTP verification attempts per order session
- **FR-17:** System can expire a pending order session after a configured time-to-live period
- **FR-18:** Authenticated user can query the current status of a pending order session

### Order Execution & Position

- **FR-19:** System can execute an order and update the corresponding position atomically
- **FR-20:** System can route an order to simulator external-layer service that combines market-data-driven virtual execution and FIX protocol adaptation
- **FR-21:** System can record every order execution as a position update entry
- **FR-22:** System can reject a duplicate order submission and return the original result unchanged
- **FR-23:** System can reconcile failed FEP confirmation without violating canonical local fill/position truth in simulator mode (external sync state tracked separately)
- **FR-24:** System can track an order through discrete status states from initiation to completion or failure
- **FR-25:** System can provide a unique order reference number for every completed or failed order
- **FR-43:** System can protect concurrent position modifications at `(account_id, symbol)` scope such that different symbols do not block each other while no modification can result in negative position quantity (no oversell)
- **FR-44:** System can guarantee that position updates for a single order are recorded atomically so that either both the fill record and position update exist or neither exists
- **FR-55:** System can compute and expose unrealized and realized PnL per symbol using documented formulas and timestamped market data snapshots
- **FR-56:** System can reject order-prepare or valuation requests when quote snapshot freshness exceeds configured staleness threshold

### Fault Tolerance & Resilience

- **FR-26:** System can detect repeated failures on the FEP connection and stop forwarding requests while the failure condition persists
- **FR-27:** System can automatically retry a failed inter-service call a configured number of times before propagating the failure
- **FR-28:** System can expose the current state of fault-tolerance mechanisms (circuit breaker status, recovery scheduler state) via an operational endpoint
- **FR-29:** System can be configured to produce predictable failure responses on the FEP interface for controlled scenario testing
- **FR-54:** System can communicate an order failure to the initiating user with a reason code distinguishing between internal errors, insufficient position, and external network failures

### Notifications & Real-time Updates

- **FR-30:** Authenticated user can receive real-time notifications about the outcome of their order without polling
- **FR-31:** System can persist notification records so that a user who reconnects can retrieve notifications missed during disconnection
- **FR-32:** Authenticated user can view a list of past notifications from their current session

### Security & Audit

- **FR-33:** System can record an audit log entry for every significant user action including actor, action, target, and timestamp
- **FR-34:** System can purge audit log records older than a configured retention period
- **FR-35:** System can enforce CSRF protection on all state-changing requests from browser clients
- **FR-36:** System can prevent credentials, session tokens, and full account numbers from appearing in application logs
- **FR-37:** System can enforce rate limits on OTP verification attempts per order session
- **FR-45:** System can record security-significant events (account lockout, forced session invalidation, OTP exhaustion) separately from general audit logs with an extended retention period
- **FR-46:** System can enforce separate retention policies for audit logs and security events
- **FR-50:** System can record the identity of an administrator who performs privileged actions (session invalidation, audit log access) in the audit trail

### Administration & Operations

- **FR-38:** Administrator can forcibly invalidate all active sessions for a specific user account
- **FR-39:** Administrator can retrieve audit log records filtered by user or time range
- **FR-40:** System can generate and serve interactive API documentation for the Channel Service
- **FR-51:** System can apply a configurable daily sell limit per account with a defined default value (SELL orders only; BUY orders have no daily limit)
- **FR-53:** System can expose health status and operational metrics for each service via a dedicated monitoring endpoint

### Domain Rules

- **FR-47:** System can communicate the remaining daily order capacity to a user when an order is rejected for exceeding the daily limit
- **FR-48:** Authenticated user can view the outcome and reference number of a completed or failed order immediately after execution
- **FR-49:** System can include the source account's current available position quantity in the response when an order is rejected for insufficient position

### Portfolio & Observability

- **FR-41:** Developer can verify full system operation by running a provided startup procedure that requires no manual configuration
- **FR-42:** System can attach a consistent distributed trace identifier to all inter-service requests so that a complete request chain can be reconstructed from logs

> **Post-MVP governance note:** Hardened perimeter design-package maintenance and promotion-evidence review remain outside the numbered 61-FR MVP capability contract. Those future controls are tracked by Epic 12 and enforced through `NFR-S8` and `NFR-S9`.

---

> **Traceability summary:** All 7 acceptance scenarios trace to FRs. All 4 User Journeys fully covered. The 6 baseline React screens remain designable from FRs alone, including the baseline admin console for audit search and force logout, and the password recovery capability contract is included in the MVP auth surface. Dedicated FE/MOB password recovery UX follow-on stories in Epic 1 consume FR-57~61 without introducing additional FRs. Epic 1 follow-on MFA recovery/rebind scope (Story 1.14 / 1.15) is treated as auth-surface hardening that reuses the existing numbered contract across FR-01, FR-03, FR-05, FR-14, FR-33, FR-38, and FR-45; it therefore does not introduce a separate numbered FR, but its executable API/UX contract is fixed in the channel auth planning artifacts. Epic 1 follow-on real recovery-challenge hardening scope (Story 1.16 / 1.17 / 1.18 / 1.19) likewise reuses FR-57~61 as an auth-surface hardening rollout and does not introduce separate numbered FRs; its executable API, UX, and ops evidence contract is fixed in the channel auth planning artifacts. No FR contains implementation details (HOW). Growth-scope capabilities (notification read/filter, richer admin dashboards, Keycloak) intentionally excluded.

---

## Non-Functional Requirements

37 NFRs across 10 categories. Each NFR includes a concrete measurement method to enable objective verification.

### Performance

- **NFR-P1:** Channel-service read endpoints (account list, balance inquiry) must achieve p95 response time <= 500ms under normal load.
  _Measurement: Prometheus `http_server_requests_seconds` queried via PromQL and visualized in Grafana p95 panel (`uri`, `outcome=SUCCESS` filters)._

- **NFR-P2:** Order Prepare endpoint (OTP issuance) must achieve p95 response time <= 1,000ms under normal load.
  _Measurement: Prometheus metric query for `/api/v1/orders/sessions` latency series in Grafana._

- **NFR-P3:** Full system cold start (`docker compose up` from clean state) must complete within 120 seconds on a developer laptop (8GB RAM, 4 cores). Vault + vault-init initialization accounts for the extended window vs. a non-Vault baseline. Spring Boot lazy initialization (`spring.main.lazy-initialization=true`) is permitted.
  _Measurement: `time docker compose up --wait` wall-clock time._

- **NFR-P4:** CoreBanking service must successfully complete 10 concurrent sell order requests without deadlock or oversell within 5 seconds total.
  _Measurement: `PositionConcurrencyIntegrationTest` with 10 threads via `ExecutorService`, all futures resolved <= 5s._

- **NFR-P5:** `@Lock(PESSIMISTIC_WRITE)` row-level lock hold time must remain <= 100ms under normal operating conditions.
  _Measurement: Micrometer custom timer exported to Prometheus and tracked in Grafana lock-time panel._

- **NFR-P6:** Error responses (`4xx`, `5xx`) must meet the same p95 latency SLA as success responses (channel <= 500ms, order <= 1,000ms). Circuit Breaker OPEN-state fallback responses must also comply.
  _Measurement: Prometheus latency series filtered by `outcome=CLIENT_ERROR|SERVER_ERROR`, validated in Grafana comparison panel._

### Security

- **NFR-S1:** All session cookies must be issued with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes.
  _Measurement: Browser DevTools > Application > Cookies; or `curl -I` response headers verification._

- **NFR-S2:** No passwords, session tokens, full account numbers, or OTP values may appear in application log output. API responses must not expose stack traces, SQL queries, or internal class names. `server.error.include-stacktrace=never` must be applied in production profile.
  _Measurement: `docker compose logs | grep -E "(password|token|stacktrace|SQLException)"` returns 0 matches during integration test run._

- **NFR-S3:** CSRF tokens must be validated on all state-changing HTTP requests (POST, PUT, PATCH, DELETE).
  _Measurement: Integration test submits a state-changing request without CSRF token and expects `403 Forbidden`._

- **NFR-S4:** Internal service endpoints (corebank-service:8081, fep-gateway:8083, fep-simulator:8082) must be unreachable from outside the Docker Compose network. Only channel-service:8080 is exposed on host.
  _Measurement: `curl localhost:8081/actuator/health`, `curl localhost:8083/actuator/health`, and `curl localhost:8082/actuator/health` each return `Connection refused`; Docker Compose `ports:` is omitted for corebank, fep-gateway, and fep-simulator._

- **NFR-S5:** Conditional TOTP step-up authentication must enforce a 3-attempt lockout per order session. Order session TTL defaults to 3600 seconds and may be refreshed back to a full 3600-second window through the owner-only extend endpoint while the session is still active. The trusted auth-session window applies only to the initial auto-authorization decision at session creation; on-time extend requests are continuity actions and must not be rejected solely because `lastMfaVerifiedAt` is older than the trusted window. Both TTL and OTP attempt lifecycle are enforced server-side via Redis (`ch:otp-attempts:{sessionId}` counter + `ch:order-session:{sessionId}` TTL).
  _Canonical measurement: Submit 3 incorrect TOTP codes and confirm the session becomes `FAILED`; the 3rd OTP failure returns HTTP 403 `CHANNEL-003`. Submit a 4th OTP attempt on the same session and confirm HTTP 409 `ORD-009` (invalid session state). OTP mismatch remains HTTP 422 `CHANNEL-002`, and HTTP 429 `RATE-001` is only used for debounce or explicit rate-limit cases. For TTL, create a session, confirm `expiresAt` is about 3600 seconds ahead, wait until 60 seconds or less remain or simulate that condition, call `POST /api/v1/orders/sessions/{sessionId}/extend`, confirm the new `expiresAt` is reset to a fresh 3600-second window even when the login MFA is no longer fresh, and verify actual expiry still returns HTTP 404 `ORD-008`._

- **NFR-S6:** GitHub Dependabot or OWASP Dependency-Check must be active. No dependency with CVSS score >= 7.0 may exist on the `main` branch.
  _Measurement: GitHub Security tab > Dependabot alerts shows 0 critical/high alerts._

- **NFR-S7:** All state-changing endpoints must require authenticated session. Requests without a valid session must receive an authentication-required response, not a data response or server error.
  _Measurement: Integration test calls a state-changing endpoint with no session cookie and receives `401 Unauthorized`._

- **NFR-S8:** Any hardened perimeter mode must have a versioned design package defining topology mapping, public route/method contract, trusted proxy extraction rules, service-boundary trust policy, privileged operator access policy, and drill governance before rollout approval.
  _Measurement: Epic 12 documentation package exists, is linked from the Epic 12 index, and is referenced by the rollout proposal or story package._

- **NFR-S9:** Any hardened perimeter promotion must use a full perimeter validation evidence set from the last 7 days. A scenario marked `not-implemented` invalidates the promotion package.
  _Measurement: Release checklist links a DMZ drill summary containing `drill_set_id`, `review_window_id`, owner, environment, execution mode, scenario statuses, rerun lineage (`supersedes_drill_set_id` when applicable), and a rolling four-week same-environment drill history keyed by `week_of`, `review_window_id`, `environment`, latest non-superseded `drill_set_id`, and linked summary. The promotion package must also include unresolved finding review (`finding_id`, severity, owner, `scenario_ids`, disposition, reviewer, risk-acceptance link or mitigation due date). Any required scenario with status `not-implemented` or `fail`, any missing rerun lineage, any missing consecutive four-week linkage, any weekly row that does not use the latest non-superseded set for that window, or any unresolved finding without review disposition blocks promotion._

### Reliability

- **NFR-R1:** All 7 acceptance scenarios defined in the Success Criteria section must pass on every commit to `main` branch in CI.
  _Measurement: GitHub Actions workflow `test` job exits 0; scenario-mapping test classes are all GREEN._

- **NFR-R2:** Resilience4j Circuit Breaker must transition to OPEN state after 3 consecutive failures within a sliding window. Fallback response must be returned immediately while OPEN.
  _Measurement: Integration test injects 3 FEP errors, asserts circuit state = OPEN, and asserts fallback is received on the 4th call._

- **NFR-R3:** All services must recover to full operational status within 60 seconds of Redis restart without manual intervention. In-flight data loss during the outage is acceptable; functional degradation after recovery is not.
  _Measurement: `docker compose restart redis`, wait 60 seconds, run smoke test, and confirm all endpoints are healthy._

- **NFR-R4:** Flyway `validate-on-migrate=true` must be configured. Schema checksum mismatch must cause immediate application startup failure (fail-fast).
  _Measurement: Alter a migration file checksum, run `docker compose up`, and confirm the service exits with `ApplicationContext` load failure._

### Testability and Code Quality

- **NFR-T1:** Channel-service line coverage must be >= 70% as reported by JaCoCo on every CI run.
  _Measurement: GitHub Actions `coverage` job runs `jacocoTestCoverageVerification` and fails the build if below threshold._

- **NFR-T2:** CoreBanking-service line coverage must be >= 80%.
  _Measurement: Same JaCoCo enforcement applies; the higher threshold reflects critical transaction logic._

- **NFR-T3:** FEP-simulator line coverage must be >= 60%.
  _Measurement: JaCoCo report in CI; lower threshold reflects simulator's non-production nature._

- **NFR-T4:** Integration test suite must complete within 8 minutes in CI.
  _Measurement: GitHub Actions `integration-tests` job uses `timeout-minutes: 8`; the build fails on timeout._

- **NFR-T5:** Fast test suite (`@WebMvcTest`, unit tests) must complete within 2 minutes in CI.
  _Measurement: GitHub Actions `fast-tests` job uses `timeout-minutes: 2`._

- **NFR-T6:** `PositionConcurrencyIntegrationTest` class must complete within 20 seconds in CI.
  _Measurement: `@Timeout(20)` JUnit 5 annotation on the test method provides automatic deadlock detection; the test fails if exceeded. NFR-P4 (5s total) is the production performance target, and 20s is the CI deadline accounting for 2-core runner overhead._

- **NFR-T7:** Each integration test class must produce identical results regardless of execution order. Tests must not share mutable database state between methods.
  *Measurement: `./gradlew test --tests "*IntegrationTest*" --rerun-tasks` is executed 3 times in randomized order and remains all GREEN.*

### Maintainability

- **NFR-M1:** Each Gradle module must correspond to exactly one bounded context. Cross-module dependencies must be declared explicitly in `build.gradle`; violations are detectable at compile time via `./gradlew dependencies`.
  _Measurement: Attempt to reference a corebank internal class from channel module without dependency declaration and confirm compilation failure._

- **NFR-M2:** All significant architecture decisions (database isolation strategy, Redis session design, Docker network topology, pessimistic locking rationale) must be documented in the README under a `## Architecture Decisions` section.
  _Measurement: Manual review confirms the README contains the section with at least 5 documented decisions._

- **NFR-M3:** All public Controller-layer methods must have either Javadoc comments or springdoc-openapi `@Operation` annotations describing purpose, parameters, and response codes.
  _Measurement: Code review; Swagger UI displays description for every endpoint._

- **NFR-M4:** No environment-specific values (DB URLs, Redis host, Redis password, service ports) may be hardcoded in source code. All must be externalized via `application.yml` profiles or environment variables. Required environment variables must be listed in a `## Environment Variables` README section with an `application-local.yml.template` file provided.
  _Measurement: `grep -r "localhost:3306\|localhost:6379" src/` returns 0 matches in non-test source._

### Scalability (Portfolio Scope)

- **NFR-SC1:** Docker Compose deployment must support at least 5 concurrent user sessions for demonstration purposes without service degradation.
  _Measurement: 5 concurrent browser sessions all maintain independent authenticated state._

- **NFR-SC2:** Bucket4j rate limit thresholds must be configurable via environment variables without code changes or redeployment.
  _Measurement: Change the environment variable, run `docker compose up`, and verify the new limit is enforced via API calls._

### Data Integrity

- **NFR-D1:** No sell order may result in a negative position quantity or an oversell. This constraint must be verified on every CI run.

  _Measurement: `PositionIntegrityIntegrationTest` asserts:_

  ```java
  assertThat(positions).allMatch(p -> p.getQuantity() >= 0);
  assertThat(sumBuyQty.subtract(sumSellQty)).isEqualByComparingTo(positions.getQuantity());
  // sumBuyQty = SUM(executed_qty WHERE side='BUY'), sumSellQty = SUM(executed_qty WHERE side='SELL')
  ```

- **NFR-D2:** Market-data-backed valuation and MARKET pre-check must use quote snapshots with bounded staleness.
  _Measurement: stale snapshot (`now - quoteAsOf > maxQuoteAgeMs`) causes deterministic validation failure; replay mode generates deterministic `quoteAsOf` values in CI._

### UX

- **NFR-UX1:** The order flow (Step A order draft -> Step B authorization guidance / conditional step-up -> Step C confirmation / execute) must execute within a single modal without full page reload. Navigation between steps must not generate a new Document-type network request.
  _Measurement: In Browser DevTools Network tab, filter by `Doc` type and confirm only the initial page load appears._

- **NFR-UX2:** SSE (Server-Sent Events) connection for real-time notifications must re-establish automatically within 5 seconds of disconnection.
  _Measurement: React implementation uses `setTimeout(connect, 3000)` on `EventSource` error handler; verified by simulating network drop._

- **NFR-UX3:** Order-session expiry affordances must stay out of the user’s way until they matter. Countdown is hidden by default; when 60 seconds or less remain, the order flow shows a non-blocking warning surface with a `세션 연장` CTA; only actual expiry may present a blocking modal.
  _Measurement: During Step A/B/C, no persistent countdown is visible while `remainingSeconds > 60`; at `remainingSeconds <= 60`, a warning surface appears without preventing input; once `expiresAt` passes, a blocking expired-session modal appears and the stale `orderSessionId` is discarded on restart._

### Observability

- **NFR-O1:** Canonical API documentation must be served from GitHub Pages (`https://<org>.github.io/<repo>/`) and expose up-to-date Channel/CoreBank/FEP Gateway/FEP Simulator specs after each `main` merge. All public endpoints must be documented via springdoc-openapi annotations.
  _Measurement: `docs-publish.yml` succeeds, GitHub Pages returns HTTP 200, and selector tabs for Channel/CoreBank/FEP Gateway/FEP Simulator load valid OpenAPI specs._

### Logging

- **NFR-L1:** All services must emit logs in JSON format. Each log entry must include `traceId` and `correlationId` fields populated from the incoming `traceparent` / `X-Correlation-Id` headers via MDC propagation (Logback + Logstash Encoder).
  _Measurement: `docker compose logs channel | python3 -c "import sys,json; [json.loads(l) for l in sys.stdin if l.strip()]"` returns 0 parse errors._

---

> **NFR Traceability summary:** 37 NFRs across 10 categories. Every NFR has a concrete, executable measurement method. Performance NFRs trace to Prometheus/Grafana metrics. Security NFRs trace to integration tests, perimeter design package rules, and Docker network configuration. Reliability NFRs trace to CI pipeline and release evidence freshness. Testability NFRs enforce JaCoCo thresholds and GitHub Actions timeouts. Data integrity verified on every CI run via `PositionIntegrityIntegrationTest`.

### FR <-> NFR Cross-Reference (Key Connections)

| Functional Requirement                     | Non-Functional Requirement                           | Connection                                                                 |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| FR-01~07, FR-52, FR-57~61 (Authentication & Session) | NFR-S1, NFR-S2, NFR-S3, NFR-S7            | Session cookie security, CSRF enforcement, unauthenticated rejection, anti-enumeration |
| FR-01~07, FR-57~61 (Authentication)        | NFR-T1 (Channel >= 70% coverage)                     | Auth and password recovery logic are primary channel test targets          |
| FR-11~18 (Order Initiation & Authorization)       | NFR-S5 (conditional TOTP 3-attempt lockout enforced per session)         | Attempt counter in Redis enforces FR-16 lockout requirement when step-up is required |
| FR-19~25 (Order Execution & Position)     | NFR-D1 (No negative qty, no oversell)         | Every executed order is a `PositionIntegrityIntegrationTest` data point       |
| FR-43 (Concurrent position protection)     | NFR-P4 (10 threads <= 5s), NFR-P5 (lock <= 100ms)    | Concurrency scenario drives both performance and lock NFRs                 |
| FR-44 (Atomic position update)             | NFR-D1, NFR-T2 (CoreBanking >= 80%)                  | Atomicity requires high CoreBanking coverage to verify                     |
| FR-26~29, FR-54 (Fault Tolerance)          | NFR-R2 (CB OPEN after 3 failures)                    | FR defines capability; NFR defines Resilience4j configuration measurement  |
| FR-30~32 (SSE Notifications)               | NFR-UX2 (SSE reconnect <= 5s)                        | Notification streaming capability requires reconnect SLA                   |
| FR-33~37, FR-50 (Security & Audit)         | NFR-S2, NFR-L1                                       | Audit log correctness requires PII masking + JSON log structure            |
| FR-41~42 (Portfolio & Observability)       | NFR-O1 (GitHub Pages API docs 200), NFR-L1 (JSON logs) | Observability claims require both API docs and structured log verification |
| FR-51, FR-53 (Admin operations)            | NFR-S6 (Dependabot), NFR-M2 (Architecture Decisions) | Admin endpoints require supply chain security + documented rationale       |
