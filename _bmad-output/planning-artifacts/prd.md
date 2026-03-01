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
  domainDetail: "채널계/계정계/대외계 architecture (은행계 증권사 도메인)"
  complexity: "high"
  projectContext: "greenfield"
  targetAudience:
    primary: "Korean bank-affiliated securities firms (KB증권/신한투자증권/미래에셋/삼성증권)"
    secondary: "Korean FinTech startups (토스증권/카카오페이증권/키움증권)"
  timeline: "6 weeks to interview-ready MVP"
  techStack:
    backend: "Java 21 + Spring Boot 3.x + Gradle multi-module"
    dataAccess: "JPA + Query Annotations + QueryDSL"
    database: "MySQL InnoDB (channel_db + core_db + fep_db)"
    cache: "Redis (Docker Compose from day 1)"
    resilience: "Resilience4j (circuit breaker; retry handled by OrderSessionRecoveryService)"
    session: "Spring Session + Redis"
    fixProtocol: "FIX 4.2 via QuickFIX/J (FEP Gateway ↔ FEP Simulator)"
  frontend:
    mvp: "React Web (5 screens)"
    phase2: "React Native (post-MVP)"
  complianceBoundary: "Simulator only — no real KRX/KSD/금융투자협회 integration"
  keycloak: false
  deployableUnits:
    - "channel-service (port 8080)"
    - "corebank-service (port 8081)"
    - "fep-gateway (port 8083)"
    - "fep-simulator (port 8082)"
  acceptanceCriteria:
    - "Stock order E2E happy path (Channel→CoreBanking→Order Book→FEP Gateway→FEP Simulator→FILLED)"
    - "Concurrent sell order (10 threads × 100 shares on 500-share position) — exactly 5 FILLED (Order status), final positions.quantity = 0"
    - "OTP failure blocks order execution"
    - "Duplicate ClOrdID returns idempotent result"
    - "FEP Simulator TIMEOUT 3회 (slidingWindowSize=3) → Resilience4j CB OPEN → Channel RC=9098 → UI fallback"
    - "Session invalidated after logout — subsequent API call rejected"
    - "After N executions — SUM(BUY executed_qty) − SUM(SELL executed_qty) == positions.quantity for each symbol"
workflowType: "prd"
---

# Product Requirements Document - FIX

_Complete Product Requirements Document for FIX. Audience: human stakeholders and LLM downstream agents (UX → Architecture → Implementation). All requirements are WHAT-only — implementation details excluded._

**Author:** yeongjae
**Date:** 2026-02-20

## Executive Summary

**FIX** is a `docker compose up`-deployable Korean bank-affiliated securities exchange simulator. Four independently deployable services — Channel (채널계), CoreBanking (계정계), FEP Gateway (대외계 게이트웨이), FEP Simulator (가상 거래소) — built on Java 21 + Spring Boot 3.x, prove production-level engineering decisions: session integrity via Redis externalization, position consistency via pessimistic locking, fault tolerance via Resilience4j and FEP Gateway circuit breaker, FIX 4.2 protocol translation via QuickFIX/J, Order Book matching engine, and distributed observability via structured JSON logs.

**Target Users:** Korean bank-affiliated securities firm hiring managers (KB증권, 신한투자증권, 미래에셋, 삼성증권) and FinTech engineering teams (토스증권, 카카오페이증권, 키움증권) evaluating backend candidates. For the evaluating engineer, FIX provides a coherent, documented system where every architectural claim is backed by a test and every design decision has a documented rationale.

**Problem Solved:** The Korean bank-affiliated securities engineering hiring market tests architecture-level knowledge — why the channel layer does not hold position state, why order execution requires step-up OTP re-authentication, how a FEP circuit breaker protects the CoreBanking (계정계) from exchange connectivity failures, and how FIX 4.2 (the KRX-standard protocol) models real exchange communication. Most portfolios demonstrate Spring Boot CRUD; FIX demonstrates systems thinking at the intersection of banking security and securities trading.

### What Makes This Special

FIX is the gap between "I know Spring Boot" and "I understand why a 은행계 증권사's systems are separated the way they are."

**Visible Architecture:** Four-deployable structure (`channel-service:8080`, `corebank-service:8081`, `fep-gateway:8083`, `fep-simulator:8082`) makes the architectural separation literal — 채널계(session/auth/order intake) / 계정계(Order Book + position management) / 대외계(FIX 4.2 KRX routing). The Gradle multi-module layout makes bounded contexts scannable from the GitHub file tree.

**Production Data Access Pattern:** Data access layers use JPA + QueryDSL — the combination found in production Korean securities systems — with `@Lock(PESSIMISTIC_WRITE)` annotations providing explicit `SELECT FOR UPDATE` semantics for concurrent position mutation safety (같은 종목 동시 매도 방어).

**Demonstrable Correctness:** Seven non-negotiable acceptance scenarios — covering concurrent position integrity, ClOrdID idempotency, execution ledger correctness, FIX 4.2 circuit breaker behavior, and session security — serve as the portfolio's technical proof points.

**Dual-Audience Experience:** A 은행계 증권사 interviewer opens the README, navigates to the Security Architecture section, and finds OWASP-referenced audit log specs, OTP step-up rationale, PII masking rules, and FIX 4.2 session state machine documentation — the vocabulary they use internally. A FinTech interviewer scrolls to the CI badge, clicks through to the Testcontainers concurrent sell-order test, and sees 10-thread race condition validation on a 500-share position passing in GitHub Actions.

## Project Classification

| Attribute               | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Project Type**        | Distributed backend system — Gradle multi-module monolith + 3 satellite services (corebank, fep-gateway, fep-simulator) |
| **Domain**              | Fintech / Korean bank-affiliated securities exchange (채널계/계정계/대외계)                |
| **Complexity**          | High — concurrency control, Order Book matching, FIX 4.2, resilience, security, observability |
| **Project Context**     | Greenfield portfolio project                                                       |
| **Timeline**            | 6 weeks to interview-ready MVP                                                     |
| **Compliance Boundary** | Simulator only — no real KRX/KSD/금융투자협회 integration                          |
| **Data Access**         | JPA + `@Query` annotations + QueryDSL                                              |
| **FIX Protocol**        | FIX 4.2 via QuickFIX/J — FEP Gateway ↔ FEP Simulator segment only                 |
| **Frontend**            | React Web MVP (5 screens); React Native Phase 2                                    |
| **Keycloak**            | Out of MVP scope                                                                   |

## Success Criteria

### User Success

**yeongjae (Developer / Portfolio Author)**

- Can open any file in the FIX repo during a screenshare, explain what it does, why it is structured that way, and what would break if that design decision changed — without preparation.
- Within 4 weeks of submitting a GitHub link, at least one technical interviewer asks a question referencing a specific implementation detail in FIX (e.g., "I saw you used `SELECT FOR UPDATE` on the position row — walk me through that concurrency decision").

**Hiring Manager (Evaluator)**

- Opens the README and finds OWASP-referenced audit log specs, session externalization rationale, PII masking rules, and FIX 4.2 session state machine documentation — the vocabulary used internally at Korean bank-affiliated securities firms — within 2 minutes of landing on the repository.
- FinTech-track evaluator clicks the CI badge, views the Testcontainers concurrent sell-order test, and sees 10-thread race condition validation on a 500-share position passing in GitHub Actions.
- Within 8 weeks of FIX going public on GitHub: at least one technical interview invitation received from a bank-affiliated securities firm or FinTech securities startup where the interviewer has viewed the repository.

### Business Success

- **Portfolio differentiation:** FIX is the only portfolio project in yeongjae's GitHub that demonstrates three-tier 은합계 증권사 architecture (채널계/계정계/대외계) with running code, live tests, and documented design rationale.
- **Interview conversion:** At least one offer-stage interview at a Korean bank-affiliated securities firm (KB증권/신한투자증권/미래에셋/삼성증권) OR FinTech securities startup (토스증권/카카오페이증권/키움증권) within 3 months of completion.
- **Dual-audience README:** A 은합계 증권사 interviewer and a FinTech interviewer both independently confirm the README answers their first three questions without scrolling to documentation links.

### Technical Success

| Metric                      | Target                                                | How Verified                                             |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Channel p95 response time   | Visible in Actuator, documented in README             | Spring Boot Actuator `/actuator/metrics`                 |
| Order execution failure rate | Circuit breaker demo scenario scripted and runnable   | Resilience4j OPEN state observable in Actuator           |
| Concurrent sell integrity   | 0 over-sell events under 10-thread simultaneous sell  | `@SpringBootTest` + `ExecutorService` test passing in CI |
| Docker cold start           | `docker compose up` → first successful API call ≤ 120s | Documented in README Quick Start (Vault + vault-init initialization accounts for extended window) |
| CoreBanking test coverage   | ≥ 80% line coverage                                   | JaCoCo report in CI                                      |
| Channel test coverage       | ≥ 70% line coverage                                   | JaCoCo report in CI                                      |
| FEP simulator test coverage | ≥ 60% line coverage                                   | JaCoCo report in CI                                      |
| GitHub Actions CI           | All 7 acceptance scenarios green on `main`            | CI badge in README                                       |

### Measurable Outcomes — 7 Non-Negotiable Acceptance Scenarios

All seven must pass in CI before the MVP is considered complete:

| #   | Scenario                                                        | Layer                  | Architectural Claim Proven                                          |
| --- | --------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| 1   | Stock order E2E happy path (Buy → Order Book match → FILLED)   | Channel → CoreBanking → FEP | Order state machine, FIX 4.2 Execution Report, trace ID propagation |
| 2   | Concurrent sell (10 threads × 100 shares on 500-share position) — exactly 5 FILLED (Order status), final positions.quantity = 0 | CoreBanking           | `SELECT FOR UPDATE` on position row; over-sell impossible           |
| 3   | OTP failure blocks order execution                              | Channel               | Step-up re-authentication enforcement before market order           |
| 4   | Duplicate `ClOrdID` returns idempotent result                   | CoreBanking           | No double-fill on retry; `UNIQUE INDEX idx_clordid`                 |
| 5   | FEP Simulator `TIMEOUT` 규칙 3회 (slidingWindowSize=3) → Resilience4j CB `OPEN` → Channel `RC=9098 CIRCUIT_OPEN` 수신 → UI fallback 메시지 표시 | CoreBanking + Channel | Resilience4j sliding window CB (no position change — CB preemptive fallback) |
| 6   | Session invalidated after logout — subsequent API call rejected | Channel + Redis       | Redis session security                                              |
| 7   | After N executions — `SUM(BUY executed_qty) − SUM(SELL executed_qty) == positions.quantity` for each symbol | CoreBanking           | Position ledger integrity; no phantom fill, no over-sell            |

## Product Scope

### MVP — Minimum Viable Product (Week 6 Exit Gate)

- GitHub Actions CI: 7 acceptance scenarios GREEN on main branch
- `docker compose up` cold start ≤ 120s to first API response
- Four deployable services wired: `channel-service`, `corebank-service`, `fep-gateway`, `fep-simulator`
- React Web 5-screen demo functional (Login, Portfolio View, Order Entry, Order Flow, Notification Feed)
- README with architecture diagram, dual-audience demo script, Quick Start section, CI badge
- Flyway migration history: `V1__init.sql` through final schema version across 3 schemas
- Audit log, PII masking, and session security documented with OWASP references

### Growth Features (Post-MVP)

- React Native mobile view (responsive demo for mobile-first interviewers)
- Prometheus + Grafana dashboard (visual observability demo)
- Keycloak SSO integration (demonstrates enterprise IDP awareness)
- Advanced rate limiting and fraud detection simulation

### Vision (Future)

- Kafka event streaming replacing synchronous internal calls (MSA migration story)
- Outbox pattern for reliable event delivery
- Multi-exchange simulation (multiple FEP endpoints, routing logic)
- Load testing report with k6 or Gatling

## User Journeys

### Journey 1 — 지수, Stock Buy Order (Primary Happy Path)

**Persona:** 지수 (Jisu), 28, retail investor using a KB증권-style web HTS (Home Trading System). Wants to buy 100 shares of a listed stock.

**Opening Scene:** 지수 opens the FIX web app on her laptop. She logs in with her credentials — the session establishes instantly (JSESSIONID stored in Redis, HttpOnly cookie set). The Portfolio View screen loads her holdings: 현금 ₩5,000,000, 보유 종목 없음.

**Rising Action:** She clicks "주문 입력" and selects 매수(Buy), enters 종목코드 005930(삼성전자), 수량 100주, 가격 ₩75,000(지정가). The Prepare step validates available cash against CoreBanking — ₩7,500,000 required, ₩5,000,000 available → insufficient. She adjusts to 60주 (₩4,500,000). Prepare succeeds — `orderSessionId` returned and stored in Redis with 10-minute TTL. UI advances to Step B.

**Climax:** She enters her 6-digit TOTP OTP. The system validates it against her registered secret. The OTP is correct — the session advances to `AUTHED`. She taps 주문 확인. The Execute step fires: Channel calls CoreBanking (계정계), CoreBanking acquires `SELECT FOR UPDATE` lock on her position row for 005930, creates an order record (`status=NEW`), places it into the Order Book. The Order Book matches the order at ₩75,000 — `ExecutionReport(OrdStatus=FILLED)` produced. CoreBanking then calls FEP Gateway at `fep-gateway:8083`; Gateway translates to FIX 4.2 `NewOrderSingle(35=D)` and forwards to FEP Simulator at `fep-simulator:8082`. Simulator responds with FIX `ExecutionReport(35=8, OrdStatus=FILLED)`. DB commits — position updated, cash settled.

**Resolution:** The screen shows: "매수 체결 완료. 주문번호: fix-ord-20260225-a1b2c3 | 체결가: ₩75,000 × 60주." The trace ID is visible. Within 2 seconds, a green SSE notification appears: "005930 삼성전자 60주 체결 완료 — 평균단가 ₩75,000."

**Capabilities Revealed:** Session management, TOTP step-up auth, order state machine (NEW → FILLED), Order Book price-time priority matching, FIX 4.2 NewOrderSingle/ExecutionReport exchange, position locking, SSE notification, distributed trace ID.

---

### Journey 2 — 지수, Exchange Connectivity Failure (Primary Failure Path)

**Persona:** Same 지수. Attempting to sell 50 shares of 005930.

**Opening Scene:** Same login flow. 지수 selects 매도(Sell), 50주, 시장가(Market Order). Prepare succeeds — available position validated (50주 confirmed). OTP confirmed — `AUTHED`. She taps 주문 확인.

**Rising Action:** Execute fires. Channel calls CoreBanking. The simulator has been pre-configured via `PUT /fep-internal/rules { "action_type": "TIMEOUT", "delay_ms": 3000 }` — 3 previous requests already timed out, exhausting the Resilience4j `slidingWindowSize=3` failure window.

**Climax:** After 3 consecutive FEP timeouts (Resilience4j `slidingWindowSize=3`, `failureRateThreshold=100`), the circuit breaker transitions to `OPEN`. On this Execute call, the CB fallback fires immediately — no `@Transactional` is started, no order record is inserted, no position is touched. The fallback returns `RC=9098 CIRCUIT_OPEN` to Channel. Channel marks the `OrderSession FAILED`.

**Resolution:** The UI receives a failure response. The screen shows: "주문 처리 중 오류가 발생했습니다. 주문번호 fix-ord-20260225-x9y8z7을 보관하세요. **보유 수량은 변동되지 않았습니다.**" An SSE notification arrives: "매도 주문 실패 — 거래소 연결 오류." The circuit breaker OPEN state is visible at `localhost:8081/actuator/circuitbreakers`. No order row was created (CB OPEN preemptive — `@Transactional` never started). `ClOrdID` is still unique — re-submitting the same request returns the same `OrderSession FAILED` response.

**Capabilities Revealed:** CB preemptive fallback (no order created, no position change), Resilience4j circuit breaker OPEN state, ClOrdID idempotency on FAILED session, failure UX messaging, audit log of failure event.

---

### Journey 3 — 현석, Admin Force-Logout (Security Ops)

**Persona:** 현석 (Hyunseok), Security Operations engineer. Receives an alert that a customer's account shows suspicious simultaneous logins from two different IP addresses.

**Opening Scene:** 현석 identifies 지수's `userId` from the security event log. He calls the admin API directly (API-only in MVP — no admin UI):

```bash
curl -X POST https://fix-channel/api/v1/admin/sessions/force-invalidate \
  -b "JSESSIONID={admin-session-id}" \
  -H "X-CSRF-TOKEN: {csrf-token}" \
  -d '{"userId": "jisu-001", "reason": "suspicious_concurrent_login"}'
```

**Climax:** The channel service calls `redisTemplate.delete("spring:session:jisu-001:*")` — all Redis session keys for that user are atomically purged. Any in-flight request using her session immediately receives `401 Unauthorized`. Pending orders in `PENDING_NEW` state are automatically cancelled by CoreBanking compensation logic.

**Resolution:** The audit log records: `ADMIN_FORCE_LOGOUT | userId: jisu-001 | adminId: hyunseok | reason: suspicious_concurrent_login | timestamp: 2026-02-25T14:32:11Z`. 지수's next page load redirects to the login screen with message "보안을 위해 로그아웃되었습니다."

**Capabilities Revealed:** Admin role endpoint, Redis session bulk invalidation, audit log with admin actor, 401 propagation on invalidated session, pending order compensation on forced logout.

---

### Journey 4 — Portfolio Reviewer Journey

> ⚠️ _Non-standard journey type unique to the portfolio nature of this project. Maps how technical evaluators experience FIX as a portfolio artifact._

**은행계 증권사 Interviewer Lens (KB증권/신한투자증권 senior engineer):**
Opens GitHub repo → scans module structure (`channel-auth`, `channel-order`, `channel-common`) → opens `AuditLogService.java`, sees PII masking on account numbers → opens `OrderExecutionService.java`, sees `@Lock(PESSIMISTIC_WRITE)` on the position query → opens `V1__init.sql`, sees `positions` + `order_executions` schema → opens `FIX42SessionAdapter.java`, sees `NewOrderSingle` → `ExecutionReport` mapping → opens README Security section, finds OWASP Logging Cheat Sheet reference.
**Assessment:** _"This candidate understands why we separate 채널계 and 계정계, and why we use FIX 4.2 to talk to KRX."_

**FinTech Interviewer Lens (토스증권/키움증권 backend engineer):**
Opens GitHub repo → clicks CI badge → sees Testcontainers concurrent sell-order test green → opens `PositionConcurrencyIntegrationTest.java`, sees `ExecutorService` spinning 10 threads on 500-share position → opens `application.yml`, sees Resilience4j sliding window config → runs `docker compose up`, submits a buy order, injects timeout via FEP chaos endpoint → watches circuit breaker OPEN in Actuator.
**Assessment:** _"This candidate writes tests that prove the hard stuff — and knows FIX 4.2."_

**Capabilities Revealed:** README structure, Actuator exposure, CI badge integration, FEP chaos/test endpoint, Order Book matching engine, FIX 4.2 session state machine code visibility.

---

### Journey Requirements Summary

| Capability                                              | Revealed By Journey |
| ------------------------------------------------------- | ------------------- |
| Session management (Redis externalization)              | J1, J3, J4          |
| TOTP step-up OTP                                        | J1, J2              |
| Order state machine (PENDING_NEW→AUTHED→EXECUTING→COMPLETED/FAILED/EXPIRED)   | J1, J2              |
| Order Book price-time priority matching                 | J1                  |
| FIX 4.2 NewOrderSingle / ExecutionReport exchange       | J1, J2              |
| FEP exchange routing + timeout                          | J2                  |
| Resilience4j circuit breaker + sliding window           | J2, J4              |
| ClOrdID idempotency                                     | J2                  |
| SSE real-time notification                              | J1, J2              |
| Admin force-logout (Redis session bulk purge)           | J3                  |
| Audit log with actor + PII masking                      | J3, J4              |
| Distributed trace ID (`traceparent`)                    | J1, J2              |
| FEP chaos/test endpoint                                 | J4                  |

## Domain-Specific Requirements

### Compliance Boundary Declaration

FIX is a **simulator** — it models regulatory obligations without real-world compliance exposure.

| Real Securities Component               | FIX Simulator Equivalent                                   | Why Sufficient for Interview                            |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| HSM-backed OTP token device             | TOTP via Google Authenticator (RFC 6238, Vault-stored secret) | Tests the auth flow and replaceability pattern; HSM = Vault secret provider swap |
| KRX FEP gateway (FIX 4.2 over leased line) | `fep-simulator` on port 8082 (QuickFIX/J SocketAcceptor)  | Tests FIX 4.2 session + CB, not the physical wire       |
| KSD (예탁결제원) settlement             | Not implemented                                            | Out of MVP; documented boundary                         |
| 금융투자협회 reporting                  | Not implemented                                            | Out of MVP; documented boundary                         |
| 공인인증서 (공동인증서)                  | Spring Security session cookie                             | Tests session management pattern                        |
| Real PII (주민등록번호, 계좌번호)        | Faker-generated test data                                  | No compliance risk; masking still demonstrated          |

Real KYC/AML, KRX/KSD integration, and 금융투자협회 reporting are explicitly out of scope. The FEP simulator documents the FIX 4.2 interface contract without a real network connection. No real PII is stored — test data only; masking patterns are fully demonstrated.

---

### Security Standards (In Scope)

| Standard                         | Application in FIX                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| OWASP Authentication Cheat Sheet | Step-up re-authentication (OTP) required for order execution                           |
| OWASP CSRF                       | Signed Double-Submit Cookie or Spring Security CSRF token                              |
| OWASP Logging Cheat Sheet        | No tokens/passwords/PII in logs; account/member numbers masked to last 4 digits        |
| Spring Security Cookie           | HttpOnly + Secure + SameSite=Strict cookie attributes                                  |

---

### OTP Lifecycle Specification

The order flow uses a three-phase protocol with TOTP (RFC 6238) step-up authentication:

```
Phase 1 — Prepare
  POST /api/v1/orders/sessions
  → Validates available cash / available_qty against CoreBanking
  → Creates OrderSession (Redis key: ch:order-session:{sessionId})
  → TTL: 600 seconds (10 min)
  → Status: PENDING_NEW
  → Initializes ch:otp-attempts:{sessionId} = 3 (NX EX 600)
  → Returns: sessionId + expiresAt

Phase 2 — TOTP Verify
  POST /api/v1/orders/sessions/{sessionId}/otp/verify
  → Validates TOTP code (RFC 6238, ±1 window, Google Authenticator compatible)
  → Secret: Vault key: secret/fix/member/{memberId}/totp-secret
  → Replay prevention: ch:totp-used:{memberId}:{windowIndex}:{code} TTL 60s
  → Attempt tracking: ch:otp-attempts:{sessionId} (DECR; lockout at 0)
  → Debounce: ch:otp-attempt-ts:{sessionId} NX EX 1 (1s burst guard)
  → On success: OrderSession status → AUTHED
  → On failure (≥ 3 attempts): session → FAILED

Phase 3 — Execute
  POST /api/v1/orders/sessions/{sessionId}/execute
  → Requires session in AUTHED state:
     - PENDING_NEW → 409 ORD-005 (session not in AUTHED state; OTP step not yet completed)
     - EXECUTING (with active ch:txn-lock) → 409 CORE-003 (concurrent execute; lock NX failure)
     - EXECUTING (ch:txn-lock expired, Recovery not yet run) → 409 ORD-005 (execution in progress; wait for Recovery Service resolution)
     - FAILED or COMPLETED → 409 ORD-006 (already in terminal state)
     - EXPIRED / Redis key missing → 404 ORD-005 (session not found)
  → On execute start: session status → EXECUTING
  → CoreBanking acquires @Lock(PESSIMISTIC_WRITE) on position row for the symbol
  → Order placed into Order Book; matching runs synchronously within @Transactional
  → FEP Gateway called with FIX 4.2 NewOrderSingle(35=D)
  → Order Status: NEW → FILLED / PARTIALLY_FILLED (unmatched orders remain NEW in Order Book)
  → FEP failure (post-commit): FILLED → FAILED, sub_status=COMPENSATED
  → On success: session status → COMPLETED
  → On failure (FEP/DB error + compensation): session status → FAILED
```

TOTP replaces a real HSM-backed token device. The TOTP interface contract (RFC 6238, 6-digit, 30s window) is faithful to production HTS OTP patterns. Secret replaceability is documented: production delta is a Vault secret injection strategy change, not an API contract change.

---

### Technical Constraints

| Constraint                  | Detail                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| MySQL InnoDB                | ACID, REPEATABLE READ isolation, `SELECT FOR UPDATE` on all position write paths                    |
| No distributed transactions | Compensating state transitions for FEP exchange failure paths                                       |
| Redis EXPIRE                | Session TTL enforced at cache layer; no schedule needed for session cleanup                         |
| Trace propagation           | `traceparent` + `X-Correlation-Id` headers on all inter-service calls                               |
| QueryDSL                    | Required for position aggregate queries (daily sell qty sum); not replaceable with plain JPQL in MVP |
| FIX 4.2 (QuickFIX/J)        | FEP Gateway ↔ FEP Simulator segment only; internal JSON/HTTP used for Channel → CoreBanking → FEP Gateway |

---

### Domain Patterns

**Position Ledger:** Every execution produces an `order_executions` record plus a `position` row mutation within the same `@Transactional` boundary. Position balance is always derivable as `SUM(BUY executed_qty) − SUM(SELL executed_qty)` per symbol. No position mutation without a corresponding execution record.

**Order State Machine:**

```
OrderSession (Channel/Redis, TTL 10 min)
  PENDING_NEW → AUTHED → EXECUTING → COMPLETED
                                     → FAILED (FEP/DB error + compensation)
  EXPIRED (TTL 600s 만료 시 Redis 키 삭제, DB status → EXPIRED by RecoveryService)
                         ↑
                  Order (CoreBanking/MySQL)
                  NEW → FILLED
                      → PARTIALLY_FILLED → FILLED / CANCELLED
                      → FAILED (Recovery: unmatched NEW — FEP never reached; no position change)
                  FILLED → FAILED, sub_status=COMPENSATED (FEP post-commit failure — timeout/5xx/REJECTED; compensating reversal applied)
```

> **Note:** Validation failures (ORD-001/002/003) occur before Order INSERT — no Order record is created. CB OPEN preemptive fallback also creates no Order record (no `@Transactional` started).

**Order Book (price-time priority):** MVP implements limit orders with price-time priority matching. Buy orders match against the lowest available ask; sell orders match against the highest available bid. Matching runs synchronously within CoreBanking `@Transactional` for the MVP; async matching is Phase 2.

**ClOrdID Idempotency:** `ClOrdID` (UUID v4, client-generated, FIX Tag 11) stored as `UNIQUE INDEX` on `orders`. Duplicate submission returns the original result with HTTP 200 — no double fill.

---

### Compensation Protocol

**Order execution (InnoDB ACID — Order Book path):**

```
BEGIN TRANSACTION
  1. SELECT position WHERE symbol=X AND accountId=Y FOR UPDATE  -- (SELL: validates available_qty)
  2. Validate: available_qty >= order_qty (SELL) / cash >= qty × price (BUY)
  3. INSERT orders (status=NEW, ClOrdID=...)
  4. Run Order Book matching — INSERT order_executions (executed_qty, executed_price, side, symbol, account_id, created_at)
  5. UPDATE positions SET quantity = quantity +/- executed_qty, avg_price recalculated
  6. UPDATE orders SET status=FILLED / PARTIALLY_FILLED
COMMIT
```

If Order Book matching finds no counterpart (no match), order remains `NEW` and sits in the book. FEP leg is called after local match.

**FEP exchange failure (Saga pattern):**

- **CB OPEN (preemptive):** If Resilience4j CB state = `OPEN` when execute is called, fallback fires immediately — no `@Transactional` started, no order inserted, no position change → `OrderSession FAILED` (FEP-003)
- **FEP timeout / HTTP 5xx / REJECTED (post-commit):** CoreBanking atomically commits order as `FILLED` (positions updated, `order_executions` inserted within `@Transactional`) → FEP Gateway call fails after commit → compensating position reversal in new `@Transactional` (reverse position delta, unlock position)
- Compensating reversal has its own idempotency key
- Order record: `NEW → FILLED → FAILED` with sub-status `COMPENSATED`
- FEP simulator triggers failure configurable % of calls to make compensation path demonstrable

---

### Risk Simulation (MVP Scope)

**Daily Sell Limit (Position Guard):**

- Per-account configurable maximum sell qty per day per symbol
- Prepare step rejects if cumulative today’s sell executions exceed limit
- Error code: `ORD-002 DAILY_SELL_LIMIT_EXCEEDED`

**QueryDSL available-qty enforcement query:**

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

**User-facing message (Korean):**

> 일일 매도 한도를 초과하였습니다. (005930 오늘 매도: 400주 / 한도: 500주)

**Phase 2 (Post-MVP):** 실시간 리스크 스코어링, 비정상 소실 탐지, 패턴 분석.

---

### Data Retention Policy

| Log Type          | Retention | Storage              | Mechanism           |
| ----------------- | --------- | -------------------- | ------------------- |
| Audit log         | 90 days   | MySQL `channel_db`   | `@Scheduled` purge  |
| Security events   | 180 days  | MySQL `channel_db`   | `@Scheduled` purge  |
| Order records     | 5 years   | MySQL `core_db`      | Never purged in MVP |
| Execution records | 5 years   | MySQL `core_db`      | Never purged in MVP |
| Application logs  | 30 days   | Docker log rotation  | Log driver config   |

---

### Error Code Taxonomy

**AUTH — Channel Service:**

| Code       | Meaning                             |
| ---------- | ----------------------------------- |
| `AUTH-001` | Invalid credentials                 |
| `AUTH-002` | Account locked (max login attempts) |
| `AUTH-003` | Session expired (Spring Session TTL)       |
| `AUTH-004` | TOTP code invalid (±1 window mismatch)     |
| `AUTH-005` | Maximum OTP attempts exceeded (session locked after 3 failures) |
| `AUTH-006` | Insufficient privilege                     |
| `AUTH-007` | Access denied (clOrdID ownership mismatch) |
| `AUTH-009` | TOTP not enrolled — enrollment required    |
| `AUTH-010` | TOTP confirm code invalid (enrollment verification failure) |
| `AUTH-011` | TOTP code already used (replay prevention) |

**ORD — Order Flow (Channel):**

| Code      | Meaning                                          |
| --------- | ------------------------------------------------ |
| `ORD-001` | Insufficient cash (BUY)                          |
| `ORD-002` | Daily sell limit exceeded                        |
| `ORD-003` | Insufficient position qty (SELL)                 |
| `ORD-004` | Invalid symbol or price                          |
| `ORD-005` | Order session not found (expired/404) or not authorized for execution (not in AUTHED state) |
| `ORD-006` | Order session already in terminal state (FAILED or COMPLETED)  |
| `ORD-007` | Duplicate `ClOrdID` (idempotency)                              |

**CORE — CoreBanking (계정계) Service:**

| Code       | Meaning                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| `CORE-001` | Account/position not found                                                 |
| `CORE-002` | Insufficient position or cash (position check)                             |
| `CORE-003` | Concurrent modification conflict → Channel retries 2× with 100 ms backoff |
| `CORE-004` | Transaction rollback                                                       |

**FEP — FEP Simulator / FEP Gateway:**

| Code      | Meaning                              |
| --------- | ------------------------------------ |
| `FEP-001` | Exchange connectivity timeout        |
| `FEP-002` | Exchange rejected order (MsgType=j)  |
| `FEP-003` | Circuit breaker OPEN (RC=9098)       |
| `FEP-004` | Invalid FIX session state            |

---

### Masked Account / Member Number Format

| Context    | Format                             | Example               |
| ---------- | ---------------------------------- | --------------------- |
| UI display | `[증권사명] ****[last 4 digits]`   | `KB증권 ****4521`      |
| Log output | `[firm_code]-****-[last4]`         | `KBS-****-4521`       |
| Prohibited | Full account number in any log     | —                     |

**Unit test specification:**  
`AccountNumber.masked()` in `channel-common` module:

- Asserts the full account number never appears in the masked string
- Asserts the result ends with the correct 4-digit suffix
- Placed in `channel-common` module (shared across all channel sub-modules)

---

### Order State Machine Test Matrix

| Test Case  | Scenario                                                | Expected Result                          |
| ---------- | ------------------------------------------------------- | ---------------------------------------- |
| TC-ORD-01  | Buy order E2E happy path → `FILLED`                   | 200, position updated                    |
| TC-ORD-02  | OTP wrong 1× — session stays `PENDING_NEW`            | 4xx, session intact                      |
| TC-ORD-03  | OTP wrong 3× — session → `FAILED`                    | 401 AUTH-005, session locked             |
| TC-ORD-04  | Execute on `PENDING_NEW` (skip OTP)                     | 409 ORD-005 Session not authed           |
| TC-ORD-05  | Execute on `COMPLETED` (already done)                   | 409 ORD-006 Already confirmed            |
| TC-ORD-06  | Session TTL expired (>600s) — status call              | 404 ORD-005 Session not found            |
| TC-ORD-07  | `ClOrdID` reuse (idempotency)                           | 200 with original FILLED response        |
| TC-ORD-08  | Concurrent sell (10 threads, same position)             | Exactly 5 FILLED, 5 OrderSession FAILED (ORD-003 — over-sell prevented; no order inserted) |

---

### Database Index Decisions

```sql
-- order_executions (core_db)
-- Covers QueryDSL daily-limit query: account_id + side + date range
INDEX idx_order_exec_account_date (account_id, side, created_at);

-- orders (core_db)
-- Defense-in-depth idempotency guarantee at DB level (beyond app-layer check)
UNIQUE INDEX idx_clordid (clOrdID);

-- order_sessions (channel_db)
-- UNIQUE INDEX idx_order_session_id (session_id);  -- enforces session_id uniqueness at DB level
-- Redis cache (ch:order-session:{sessionId}, TTL 600s) mirrors MySQL row for fast reads;
-- MySQL is authoritative; @Scheduled recovery service handles stuck EXECUTING sessions

-- audit_log (channel_db)
-- Optimizes @Scheduled purge: DELETE WHERE created_at < (NOW() - 90 days)
INDEX idx_audit_user_time (user_id, created_at);
```

---

### UX Error Strings (Domain-Mandated)

**Order session expired (TC-ORD-06):**

> ⚠️ 주문 세션이 만료되었습니다. 보안을 위해 주문 정보를 다시 입력해 주세요.

Action: `[처음으로]` button → 주문 입력 화면으로 돌아감 (orderSessionId 삭제, 새 세션 시작)

**Insufficient position (ORD-003):**

> ❌ 보유 수량이 부족합니다. 매도 가능 수량: 30주 / 주문 수량: 50주

Action: `[확인]` → 주문 수량 수정 화면

**Insufficient cash (ORD-001):**

> ❌ 주문 가능한 현금이 부족합니다. 가용 현금: ₩3,200,000 / 필요 금액: ₩4,500,000

Action: `[확인]` → 수량 또는 단가 수정 화면

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. QueryDSL + Pessimistic Locking Composition**

FIX combines QueryDSL (type-safe aggregate queries — daily sell qty enforcement) with JPA `@Lock(PESSIMISTIC_WRITE)` (concurrent position mutation safety) within the same data access layer. The critical design insight: the position row must be locked first (entity fetch with `PESSIMISTIC_WRITE`), then the daily sell aggregate query runs — InnoDB shared lock on execution rows is sufficient after the position is locked.

```java
// Step 1: Lock the position row (SELECT FOR UPDATE)
Position pos = positionRepository.findByAccountAndSymbolWithLock(accountId, symbol);

// Step 2: Query the daily sell aggregate (no additional lock needed)
Long todaySold = queryDslExecutionRepository.sumTodaySellQty(accountId, symbol);
// Position already locked — concurrent sell mutations blocked
```

**Why pessimistic over optimistic locking (`@Version`):**

- Pessimistic lock hold time for single-position sell update: ~5–15ms (InnoDB row lock)
- Optimistic lock retry cost with user re-authentication: 30–120 seconds
- Retry requiring OTP re-entry is unacceptable UX in an order execution flow
- `@Version`-based optimistic locking is the wrong choice for this domain — a justified, documented decision

**Future-Proofing (Hot Symbol Strategy):**
The schema anticipates high-concurrency "Hot Symbols" (e.g., IPO day) via `position_update_mode` ENUM (`EAGER`, `DEFERRED`).
- **MVP (EAGER):** Standard pessimistic locking (User A waits for User B). Simple, correct, proven.
- **Phase 2 (DEFERRED):** Insert-only execution log; position updated asynchronously. The schema supports this via `update_mode` column, but MVP implementation is strictly `EAGER` to prove deadlock-free concurrency first.

---

**2. Live-Observable Fault Injection (FEP Chaos Endpoint)**

The FEP simulator exposes a configurable chaos endpoint:

```
PUT /fep-internal/rules
Body: { "action_type": "TIMEOUT", "delay_ms": 3000, "failure_rate": 0.0 }
```

An interviewer can trigger circuit breaker state transitions on demand during a screenshare. The Resilience4j OPEN state becomes observable in `/actuator/circuitbreakers` within seconds. Exactly 3 configurable parameters (action_type, delay_ms, failure_rate) keep scope bounded within the 6-week timeline.

---

**3. Order Book Matching Engine + Position Ledger as Architectural Vocabulary**

Every execution produces an `order_executions` record and mutates the `positions` row within the same `@Transactional` boundary. Any position is always derivable as `SUM(BUY executed_qty) − SUM(SELL executed_qty)`. The portfolio signals: "I know why securities systems don't store position as a simple counter update, and I implemented both Order Book matching and position integrity correctly."

The Order Book uses price-time priority: buy orders are sorted by price DESC then timestamp ASC; sell orders by price ASC then timestamp ASC. Matching runs as a synchronous in-process scan of open orders for MVP — optimized to a persistent sorted data structure (skip list / sorted set) in Phase 2.

Validated by `PositionIntegrityIntegrationTest`: `SUM(BUY executed_qty) − SUM(SELL executed_qty) == positions.quantity` after N executions, InnoDB-verified via Testcontainers.

---

**4. Documented Simulation Boundary (Interface Compliance Without Real Integration)**

Instead of hiding the absence of real KYC/FEP/OTP hardware as a weakness, FIX documents each simulation boundary explicitly in a README "Architecture Decisions" section:

```
Decision: OTP uses TOTP (RFC 6238) via Google Authenticator-compatible library
Why: TOTP is stateless, replay-resistant, and matches 증권사 실보 HTS OTP UX
Simulation boundary: Vault stores TOTP secret; production delta = HSM-backed Vault role
Interview talking point: "I designed the OTP interface for HSM replaceability"
```

This transforms a portfolio limitation into an architectural communication skill.

---

**5. Dual-Audience README as UX Branching Journey**

The README is a branching user journey, not a document. Two distinct mental models are served in sequence:

```
은합계 증권사 Interviewer path:
  Header → "채널계/계정계/대외계" in first paragraph
  → "Security Architecture" section → OWASP refs + OTP step-up + FIX 4.2 session state machine
  → "Architecture Decisions" → simulation boundary table
  → Assessment: "This person speaks our language"

FinTech Interviewer path:
  Header → CI badge (click immediately)
  → PositionConcurrencyIntegrationTest.java → ExecutorService + CountDownLatch on 500-share position
  → docker compose up → FEP chaos demo → Actuator circuit breaker
  → Assessment: "This person ships working code — and knows FIX 4.2"
```

---

### Market Context & Competitive Landscape

| Gap in Existing Korean Portfolios          | How FIX Addresses It                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Monolith — no service separation            | Four deployable services; 채널계/계정계/대외계 scannable from GitHub file tree without reading code |
| Position = running counter (fragile)        | `positions` + `order_executions` — position derivable from SUM; Order Book matching demonstrated     |
| No concurrency tests                        | `TC-ORD-08` + `PositionIntegrityIntegrationTest` — CI green, InnoDB-verified                                   |
| Auth = JWT only (no step-up)               | Spring Session Redis + OTP step-up at order execution — 증권사 실보 HTS OTP 패턴                    |
| No resilience pattern demonstrated          | Resilience4j circuit breaker — OPEN state live-observable in Actuator                               |
| No FIX/exchange protocol knowledge          | FIX 4.2 via QuickFIX/J — `NewOrderSingle` / `ExecutionReport` exchange with FEP Simulator          |
| README = setup instructions only            | Dual-audience README with branching discovery path + Architecture Decisions                           |

**Why this combination is rare:** Most Korean portfolio projects targeting securities firm employment demonstrate CRUD + JWT. Projects attempting securities domain knowledge typically: (a) use a monolith with no service separation, (b) implement position as a running counter, or (c) omit concurrency tests and FIX protocol entirely. FIX is the first portfolio to combine all seven portfolio differentiators correctly and simultaneously, with each claim backed by a passing CI test.

**Bilingual searchability:** Code comments and README use Korean domain vocabulary (`주문`, `채널계`, `계정계`, `대외계`) alongside English technical vocabulary (`pessimistic lock`, `Order Book`, `FIX 4.2`, `circuit breaker`) — surfacing in both Korean securities engineer and FinTech startup searches.

---

### Validation Approach

| Innovation Claim               | Supporting Test                                                              | What It Proves                                                                |
| ------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| QueryDSL + locking composition | `PositionConcurrencyIntegrationTest` (10 threads, exactly 5 FILLED, positions.quantity = 0)       | Lock prevents phantom reads; real InnoDB via Testcontainers — H2 disqualified |
| FEP chaos endpoint             | `FepChaosIntegrationTest` — triggers OPEN state, asserts Actuator response   | Circuit breaker config correct, not accidental                                |
| Position integrity             | `PositionIntegrityIntegrationTest` — `positions.quantity >= 0` invariant + no oversell after N concurrent orders | Lock prevents oversell; real InnoDB via Testcontainers — H2 disqualified    |
| Simulation boundary narrative  | README "Architecture Decisions" pre-empts interviewer objection              | —                                                                             |
| Dual-audience README           | Bank interviewer demo script (5 steps, 5 min, screenshare-ready)             | —                                                                             |

**`PositionConcurrencyIntegrationTest` specification (Fixed 5):**

- 10 threads simultaneous sell order for symbol 005930 (삼성전자) with 500qty available
- `CountDownLatch` fires all threads simultaneously; each thread sells 100qty
- Assert: exactly 5 FILLED, final positions.quantity = 0, 0 oversell results
- Real InnoDB via `MySQLContainer("mysql:8.0")` — H2 does not implement `SELECT FOR UPDATE` equivalently

**`PositionIntegrityIntegrationTest` — 7th Acceptance Scenario:**
After N sequential sell orders across multiple symbols:
`positions.quantity >= 0` invariant holds; `SUM(order_executions.executed_qty WHERE side='BUY') − SUM(order_executions.executed_qty WHERE side='SELL') == positions.quantity` per symbol
No orphan executions, no oversell state — proves pessimistic lock + position update is atomically maintained.

---

### Risk Mitigation

| Risk                                             | Mitigation                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| QueryDSL Gradle multi-module APT config          | Week 1 spike — validate Q-class generation before feature work; `annotationProcessor` on entity module only      |
| Testcontainers cold start (8+ min without reuse) | `.withReuse(true)` + `testcontainers.reuse.enable=true` in `~/.testcontainers.properties`; in README Quick Start |
| QueryDSL scope creep                             | MVP: exactly 2 QueryDSL queries (daily-limit sum + ledger aggregate); expand post-MVP                            |
| FEP chaos complexity                             | Fixed 3 config params: `action_type`, `delay_ms`, `failure_rate`                                                        |
| Ledger overengineering                           | MVP: 2-entry per order execution only; no compound journal entries                                                      |
| README dual-audience failing                     | Week 5 dedicated documentation sprint — README is Week 5 deliverable, not Week 6 afterthought                    |

---

### README Structure Specification (Week 5 Deliverable)

11-section structure, dual-audience validated:

1. Project headline (≤ 8 words) — "Korean Banking Architecture Simulator — Run It Now"
2. CI badge row: `[build]` `[coverage-channel]` `[coverage-core]` `[coverage-fep]`
3. `docker compose up` Quick Start (3 commands, copy-pasteable)
4. Architecture diagram (Mermaid — 3 services + MySQL + Redis)
5. "What FIX Demonstrates" — 6-item list, dual-audience vocabulary
6. Demo Script — two tracks: Bank Interviewer Track (5 steps, 5 min) + FinTech Interviewer Track (5 steps, 5 min)
7. Architecture Decisions — simulation boundary table (5 rows) + pessimistic lock rationale
8. Security Architecture — OWASP refs, session externalization, PII masking
9. Test Coverage — JaCoCo badge + `PositionConcurrencyIntegrationTest` description
10. API Reference — key endpoints with status codes (not full Swagger)
11. Module Structure — Gradle multi-module tree annotated with bounded context labels

## Distributed Backend Specific Requirements

### Project-Type Overview

FIX is a `distributed-backend-system` — three independently deployable Spring Boot services communicating over REST, sharing no in-process state, separated by Docker Compose network isolation.

**API Versioning strategy:** URL path prefix — `/api/v1/` (Channel external), `/internal/v1/` (service-to-service), `/fep-internal/` (FEP ops). Version prefix applies from day 1 — no migration burden in MVP.

**Rate Limiting strategy:** Bucket4j (`bucket4j-spring-boot-starter`) + Redis backend, applied as a Spring `Filter` — explicit, testable, explainable at interview.

---

### API Endpoint Specification

**Channel Service (port 8080) — 채널계 — external-facing**

```
# Authentication
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
GET    /api/v1/auth/csrf                           → CSRF token (required before login)

# Accounts / Portfolio
GET    /api/v1/accounts                              → account list (authenticated user)
GET    /api/v1/accounts/{accountId}                  → account detail + masked number
GET    /api/v1/accounts/{accountId}/positions         → portfolio holdings
GET    /api/v1/accounts/{accountId}/cash             → available cash

# Orders (3-phase: Prepare → OTP Verify → Execute)
POST   /api/v1/orders/sessions                      → create OrderSession (PENDING_NEW)
POST   /api/v1/orders/sessions/{sessionId}/otp/verify → validate TOTP → AUTHED
POST   /api/v1/orders/sessions/{sessionId}/execute   → execute order → NEW/FILLED/FAILED
GET    /api/v1/orders/sessions/{sessionId}/status    → session status query
GET    /api/v1/orders                               → order history (authenticated user)

# Notifications (SSE)
GET    /api/v1/notifications/stream                  → Server-Sent Events (EventSource)

# Admin (ROLE_ADMIN only)
POST   /api/v1/admin/sessions/force-invalidate
GET    /api/v1/admin/audit-logs
DELETE /api/v1/admin/members/{memberId}/sessions  → force-invalidate specific member session
```

**CoreBanking Service (port 8081) — 계정계 — Channel-internal only**

```
# Order execution + Order Book
POST   /internal/v1/sessions/{sessionId}/execute       → Order Book match + FEP Gateway call (orderId generated internally)
GET    /internal/v1/accounts/{accountId}/positions?symbol={symbol}   → position for specific symbol (SELL qty validation)
GET    /internal/v1/accounts/{accountId}/positions   → all positions for account (portfolio view)
GET    /internal/v1/accounts/{accountId}/cash        → available cash balance
GET    /internal/v1/orders/{orderId}/executions      → execution history
```

**FEP Gateway (port 8083) — 대외계 게이트웨이 — CoreBanking-internal only**

```
POST   /fep/v1/orders                               → FIX 4.2 NewOrderSingle(35=D) forwarding
GET    /fep/v1/orders/{clOrdID}/status              → order processing result (ACCEPTED|REJECTED|UNKNOWN) — used by Recovery Service (Story 4.3)
GET    /fep-internal/health
```

**FEP Simulator (port 8082) — 가상 거래소 — FEP Gateway-internal only**

```
# FIX 4.2 TCP session (QuickFIX/J SocketAcceptor)
FIX    [NewOrderSingle 35=D]                         → responds with ExecutionReport 35=8
FIX    [OrderCancelRequest 35=F]                     → responds with ExecutionReport (CANCELLED)

# Chaos control (HTTP)
GET    /fep-internal/health
PUT    /fep-internal/rules                           → chaos config update; body: {"action_type": "TIMEOUT"|"REJECT"|"IGNORE", "delay_ms": N, "failure_rate": N}
```
---

### Authentication Model

| Layer                    | Mechanism                                    | Detail                                                                                    |
| ------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Channel ↔ User           | Spring Security session cookie               | JSESSIONID, HttpOnly + Secure + SameSite=Strict, stored in Redis                          |
| Channel ↔ CoreBanking    | `X-Internal-Secret` header + Docker network  | `INTERNAL_API_SECRET` env var; `OncePerRequestFilter` validates on every internal request |
| CoreBanking ↔ FEP Gateway | `X-Internal-Secret` header + Docker network  | Same secret; FEP Gateway verifies on inbound requests                                     |
| FEP Gateway ↔ FEP Sim    | FIX 4.2 TCP session (QuickFIX/J)             | SocketInitiator(Gateway) ↔ SocketAcceptor(Simulator); `HeartBeat=30`                     |
| Step-up auth             | TOTP (RFC 6238, Google Authenticator, 6-digit, 30s window) | Required before order execute; 3-attempt lockout; Vault-stored secret |

**Docker Compose network isolation (2-layer defense):**

```yaml
networks:
  external-net:  # Channel only — port 8080 exposed
  core-net:      # Channel ↔ CoreBanking
  gateway-net:   # CoreBanking ↔ FEP Gateway:8083
  fep-net:       # FEP Gateway ↔ FEP Simulator:8082

services:
  channel-service:
    networks: [external-net, core-net]
    ports: ["8080:8080"]
  corebank-service:
    networks: [core-net, gateway-net]  # no ports — external access impossible
  fep-gateway:
    networks: [gateway-net, fep-net]   # no ports — external access impossible
  fep-simulator:
    networks: [fep-net]                # no ports — external access impossible
  mysql:
    networks: [core-net]               # shared by channel_db + core_db + fep_db schemas
  redis:
    networks: [core-net]               # shared by channel-service session + order cache
```

**CSRF:** Double Submit Cookie pattern — `CookieCsrfTokenRepository.withHttpOnlyFalse()`; React axios interceptor reads `XSRF-TOKEN` cookie and injects `X-XSRF-TOKEN` header on all non-GET requests.

---

### Data Schemas

**channel_db tables:**

| Table               | Storage | Notes                                                        |
| ------------------- | ------- | ------------------------------------------------------------ |
| `users`             | MySQL   | id, email (UNIQUE), username, password_hash, role, login_attempts, locked_at, totp_enabled (BOOLEAN DEFAULT false), totp_enrolled_at (TIMESTAMP NULL) |
| `audit_logs`        | MySQL   | id, user_id, action, target, masked_account, ip, created_at  |
| `security_events`   | MySQL   | id, user_id, event_type, detail, ip, created_at              |
| `notifications`     | MySQL   | id, user_id, message, type, read, created_at                 |
| `order_sessions`    | MySQL   | id, session_id (UUID UNIQUE), user_id (FK→users.id), account_id (cross-DB ref→core_db.accounts.id; no InnoDB FK — same-schema FK not possible across `channel_db`/`core_db`), symbol, side (BUY/SELL), qty, price, cl_ord_id, status (ENUM: PENDING_NEW/AUTHED/EXECUTING/COMPLETED/FAILED/EXPIRED), execution_snapshot (JSON nullable — orderId/executedQty/executedPrice/positionQty after completion), created_at, updated_at |
| `sessions`          | Redis   | Spring Session — JSESSIONID, TTL 30 min                      |
| `totp_keys`         | Redis   | key: `ch:totp-used:{memberId}:{windowIndex}:{code}`, TTL 60s (replay prevention) |
| `otp_attempts`      | Redis   | key: `ch:otp-attempts:{sessionId}`, TTL 600s (attempt counter, init=3) |
| `order_session_cache` | Redis   | key: `ch:order-session:{sessionId}`, TTL 600s — fast-read cache; authoritative state in MySQL `order_sessions` |
| `txn_locks`         | Redis   | key: `ch:txn-lock:{sessionId}`, NX EX 30 (execute-phase concurrency lock; Story 4.2) |
| `otp_debounce`      | Redis   | key: `ch:otp-attempt-ts:{sessionId}`, NX EX 1 (1s burst guard; consumed on every OTP attempt before decrementing otp_attempts counter) |
| `recovery_locks`    | Redis   | key: `ch:recovery-lock:{sessionId}`, NX EX 120 (Recovery scheduler idempotency; prevents double-processing of same EXECUTING session) |

**core_db tables:**

| Table                         | Storage | Notes                                                                                                    |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `accounts`                    | MySQL   | id, user_id, account_number, balance, daily_sell_limit (default: env DAILY_SELL_LIMIT_DEFAULT=500), status(ACTIVE/FROZEN/CLOSED), update_mode(EAGER/DEFERRED) |
| `positions`                   | MySQL   | id, account_id, symbol, quantity, avg_price, updated_at                                                   |
| `orders`                      | MySQL   | id, clOrdID(**UNIQUE**), account_id, symbol, side, qty, price, status(NEW/FILLED/PARTIALLY_FILLED/FAILED), sub_status(COMPENSATED nullable), created_at, updated_at |
| `order_executions`            | MySQL   | id, order_id (FK → orders.id), account_id, symbol, side, **executed_qty**, **executed_price**, created_at |
| `order_execution_diagnostics` | MySQL   | order_execution_id, detail (TEXT) — long error messages/stack traces separated to optimize row size       |

---

### Rate Limits

**MVP scope — 3 endpoints only (Bucket4j Filter, Redis-backed):**

| Endpoint                                        | Limit                  | Error Response                                       |
| ----------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| `POST /api/v1/auth/login`                                   | 5 req/min per IP       | 429 + `Retry-After` header                           |
| `POST /api/v1/orders/sessions/{sessionId}/otp/verify`      | 3 attempts per session | 429 (app-layer AUTH-004/005 fires first in practice) |
| `POST /api/v1/orders/sessions`                              | 10 req/min per userId  | 429 + remaining quota in body                        |

**Not rate-limited in MVP:** all `GET` endpoints, `/internal/v1/`, `/fep-internal/`.

**OTP / rate limit interaction:** App-layer 3-attempt OTP lockout (`session → FAILED`) fires before Bucket4j bucket empties. TC-RATE-03 documents this intentional ordering.

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
    "message": "일일 주문 한도를 초과하였습니다.",
    "detail": {
      "todayUsed": 3200000,
      "dailyLimit": 5000000,
      "remaining": 1800000
    }
  },
  "traceId": "00-4bf92f3577b34da6-00f067aa0ba902b7-01"
}
```

**Implementation:** `@RestControllerAdvice` `GlobalExceptionHandler` converts all exceptions to above format. `traceId` injected from MDC via `traceparent` header.

---

### API Documentation

| Service             | Swagger UI                      | API Docs                                |
| ------------------- | ------------------------------- | --------------------------------------- |
| Channel Service     | ✅ Enabled (`/swagger-ui.html`) | ✅ `/api-docs`                          |
| CoreBanking Service | ❌ Disabled (internal)          | ✅ `/api-docs` (generated, not exposed) |
| FEP Simulator       | ✅ Enabled (chaos config demo)  | ✅ `/api-docs`                          |

`springdoc-openapi` + Spring Boot 3.x. README Quick Start step 3: `http://localhost:8080/swagger-ui.html` after `docker compose up`.

---

### CORS & Environment Configuration

**CORS policy:**

- Development: `allowedOrigins("http://localhost:5173")` + `allowCredentials=true` (Vite dev server)
- Production (Docker Compose): Nginx reverse proxy — `/api/` → `channel-service:8080`; React served same-origin; CORS not needed

**Environment variables (`.env.example` — committed to repo; `.env` — gitignored):**

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

| Module                      | Test Type         | Tools                          |
| --------------------------- | ----------------- | ------------------------------ |
| `channel-auth`              | `@WebMvcTest`     | MockMvc, no DB                 |
| `channel-order`             | `@WebMvcTest`     | MockMvc, no DB                 |
| `channel-integration-test`  | `@SpringBootTest` | Testcontainers (MySQL + Redis) |
| `corebank-service`          | `@WebMvcTest`     | MockMvc, no DB                 |
| `corebank-integration-test` | `@SpringBootTest` | Testcontainers (MySQL + Redis) |

Fast tests (`@WebMvcTest`) and slow tests (`@SpringBootTest` + Testcontainers) run separately in CI:

```
./gradlew :channel-auth:test :channel-order:test           # fast — ~10s
./gradlew :channel-integration-test:test                   # slow — ~60s
```

**Auth test matrix (TC-AUTH):**

| Test Case  | Scenario                  | Expected                        |
| ---------- | ------------------------- | ------------------------------- |
| TC-AUTH-01 | 정상 로그인               | 200, JSESSIONID HttpOnly cookie |
| TC-AUTH-02 | 잘못된 비밀번호 5회       | AUTH-002 account locked         |
| TC-AUTH-03 | 잠긴 계정 로그인          | AUTH-002                        |
| TC-AUTH-04 | 로그아웃 후 `/auth/me`    | 401                             |
| TC-AUTH-05 | Rate limit 초과 (6th/min) | 429 Too Many Requests           |

**Rate limit test matrix (TC-RATE):**

| Test Case  | Scenario                       | Expected                                     |
| ---------- | ------------------------------ | -------------------------------------------- |
| TC-RATE-01 | 6번째 로그인 (동일 IP, 1분 내) | 429                                          |
| TC-RATE-02 | 1분 후 재시도                  | 정상 (bucket refill)                         |
| TC-RATE-03 | OTP 4번째 시도                 | 409 ORD-006 (session in FAILED terminal state; app-layer fires before Bucket4j) |

---

### React Web API Client Structure

```
src/api/
  apiClient.ts         → axios instance, baseURL from VITE_API_BASE_URL,
                          withCredentials:true, response envelope unwrapping,
                          XSRF-TOKEN → X-XSRF-TOKEN interceptor,
                          AUTH-003 auto-redirect to /login
  authApi.ts           → login, logout, me
  accountApi.ts        → getAccounts, getAccount
  orderApi.ts          → prepare, verifyOtp, execute, getSession
  notificationApi.ts   → streamNotifications (SSE / EventSource)
```

Version migration path: `VITE_API_BASE_URL` base change only — all 4 API files inherit automatically.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Interview-Ready Portfolio MVP
**Resource:** yeongjae, solo developer, 6 weeks

The MVP is complete when every architectural claim in FIX is backed by a passing CI test and a recruiter can independently verify that claim within 5 minutes of opening the GitHub repository.

---

### MVP Feature Set (Phase 1 — Week 6 Exit Gate)

**Core User Journeys Supported:**

- Journey 1: 지수 — Order execution happy path (PENDING_NEW → AUTHED → EXECUTING → COMPLETED)
- Journey 2: 지수 — FEP Circuit Breaker failure (PENDING_NEW → AUTHED → EXECUTING → FAILED)
- Journey 3: 현석 — Admin force-logout (Redis session bulk invalidation)
- Journey 4: Portfolio reviewer — GitHub scan → demo → Actuator verification

**Must-Have Capabilities:**

| Category       | MVP Included                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| Auth           | Login, logout, session (Redis), OTP step-up, force-logout                    |
| Orders         | sessions → otp/verify → execute state machine (PENDING_NEW → AUTHED → EXECUTING → COMPLETED)|
| Position       | Position update record per order execution                                   |
| Idempotency    | `clOrdID` UNIQUE index + app-layer check                             |
| Resilience     | Resilience4j circuit breaker (FEP path); distributed retry via OrderSessionRecoveryService |
| Rate Limiting  | Bucket4j — 3 endpoints (login, OTP, sessions)                                |
| Observability  | Spring Actuator, Micrometer, `traceparent` propagation                       |
| Notifications  | SSE stream + DB persistence (`notifications` table)                          |
| Admin          | Force-invalidate session API (ROLE_ADMIN)                                    |
| Documentation  | Swagger UI (Channel + FEP), dual-audience README                             |
| Infrastructure | Docker Compose (6+ containers: 4 services + MySQL + Redis; 4-network isolation) |
| CI             | GitHub Actions — 7 acceptance scenarios green                                |
| Frontend       | React Web — 5 screens (Login, Account List, Detail, Order, Notifications)    |

---

### 7 Non-Negotiable Acceptance Scenarios

All seven must pass in CI before MVP is complete:

| #   | Scenario                                                        | Layer                 | Claim Proven                       |
| --- | --------------------------------------------------------------- | --------------------- | ---------------------------------- |
| 1   | Order execution E2E happy path                                  | Channel → CoreBanking | State machine, trace propagation   |
| 2   | Concurrent sell (10 threads) — exactly 5 FILLED (Order status), final positions.quantity = 0 | CoreBanking         | `SELECT FOR UPDATE` InnoDB locking |
| 3   | OTP failure blocks order execution                              | Channel               | Step-up re-auth enforcement        |
| 4   | Duplicate `clOrdID` returns idempotent result           | CoreBanking           | No double-fill on retry            |
| 5   | FEP timeout → circuit breaker OPEN after 3 failures             | CoreBanking + Channel | Resilience4j sliding window        |
| 6   | Session invalidated after logout — subsequent API call rejected | Channel + Redis       | Redis session security             |
| 7   | After N orders — no negative position quantity                  | CoreBanking           | Atomic position update, no oversell|

---

### Interview-Ready Exit Gate (Week 6 Checklist)

**코드 완성도:**

- [ ] 7 acceptance scenarios — GitHub Actions 그린
- [ ] `docker compose up` → 120초 이내 첫 API 응답
- [ ] JaCoCo: channel ≥ 70%, corebank ≥ 80%, fep ≥ 60%

**설명 준비도 (yeongjae 기준):**

- [ ] `PositionConcurrencyIntegrationTest.java` 라인 단위 설명 가능
- [ ] "왜 pessimistic lock?" 15초 이내 답변
- [ ] "order_executions 스키마를 왜 이렇게 설계했나?" 30초 이내 답변
- [ ] FEP chaos endpoint 라이브 데모 (스크린셰어 중 30초 이내 CB OPEN)
- [ ] "Kafka 안 쓴 이유?" — README Architecture Decisions에 문서화

**포트폴리오 노출도:**

- [ ] README dual-audience 5분 탐색 완료 (직접 타이머 테스트)
- [ ] `http://localhost:8080/swagger-ui.html` 정상 작동
- [ ] GitHub Actions badge — 마지막 CI 실행 그린

---

### 6-Week Delivery Map

| 주     | 핵심 deliverable                                                                    | 주차 말 체험 가능한 것                                           |
| ------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Week 1 | Gradle skeleton + QueryDSL spike + Flyway V1                                        | `./gradlew build` 그린 + Q클래스 생성 확인                       |
| Week 2 | CoreBanking 도메인 + position + order state machine + `PositionIntegrityIntegrationTest` | `curl localhost:8081/internal/v1/accounts/1/positions` → 포지션 반환 |
| Week 3 | Channel auth + order flow + OTP + Redis + Bucket4j                               | 전체 주문 flow (login → prepare → OTP → execute) curl로 완성     |
| Week 4 | FEP simulator + Resilience4j + chaos endpoint + integration tests                   | FEP chaos=timeout → Actuator circuitbreaker OPEN 확인            |
| Week 5 | React Web 5 screens + `ApplicationEventPublisher` SSE + README + Swagger            | `http://localhost:5173` → Login → Order → 알림 수신           |
| Week 6 | CI green (7 scenarios) + polish + README 최종화 + demo 연습                         | GitHub Actions 배지 그린 + 5분 README 탐색 완료                  |

---

### Post-MVP Features

**Phase 2 — Growth (Post-MVP):**

- React Native mobile view (responsive demo for mobile-first interviewers)
- Prometheus + Grafana dashboard (visual observability demo)
- Keycloak SSO integration (enterprise IDP awareness)
- Bucket4j advanced: user-level rate limit (현재 IP-level)
- 알림 읽음 처리 클릭 이벤트 + 필터링 UI
- SSE → polling fallback option

**Phase 3 — Vision (Future):**

- Kafka event streaming (MSA migration story)
- Outbox pattern (reliable event delivery)
- Multi-exchange FEP routing (multiple FEP endpoints)
- k6/Gatling load test report

---

### Risk Mitigation Strategy

**Technical Risks:**

| 리스크                                          | 확률 | 대응                                        |
| ----------------------------------------------- | ---- | ------------------------------------------- |
| QueryDSL Gradle APT 설정 1주 초과               | 낮음 | JPQL `@Query` fallback — 타임라인 영향 0일  |
| Testcontainers 로컬 Docker 환경 미비            | 낮음 | Week 1에 Docker 환경 먼저 검증              |
| React `EventSource` + JSESSIONID CORS 조합 이슈 | 중간 | Week 5 초 POC; 실패 시 5초 polling fallback |
| Resilience4j sliding window 설정 오류           | 낮음 | 공식 문서 설정 그대로; test로 검증          |

**QueryDSL spike fallback (확률 < 20%):**
JPQL `@Query` + `@Lock(PESSIMISTIC_WRITE)`로 대체 → Innovation claim은 "명시적 Lock 조합"으로 재프레이밍. QueryDSL은 Growth로 이동. 타임라인 영향 없음.

**Resource Risk — "4주 최소 MVP" fallback 순서 (필요 시):**

1. Swagger UI 제거 (의존성만 삭제)
2. Bucket4j 제거 (app-layer AUTH-002로 충분)
3. SSE → 5초 polling 대체
4. React Web → Postman 컬렉션 대체

**CI Pipeline Structure:**

```yaml
jobs:
  fast-tests: # @WebMvcTest — ~30초
    runs-on: ubuntu-latest
  integration-tests: # @SpringBootTest + Testcontainers — ~3분
    services: [mysql:8.0, redis:7]
  coverage:
    needs: [fast-tests, integration-tests]
    # JaCoCo → 3개 coverage badge
```

## Functional Requirements

> **Capability Contract:** 아래 54개 FR이 FIX MVP의 완전한 능력 계약입니다. 여기 없는 기능은 MVP에 존재하지 않습니다. 각 FR은 WHAT(무엇을 할 수 있는가)만 정의하며 HOW(어떻게 구현)를 포함하지 않습니다.

### User Authentication & Session

- **FR-01:** Registered user can authenticate with email and password credentials
- **FR-02:** Authenticated user can terminate their session (logout)
- **FR-03:** System can maintain user session state across multiple requests without re-authentication
- **FR-04:** User can retrieve their own identity and role information from an active session
- **FR-05:** System can expire a user session after a configured period of inactivity
- **FR-06:** System can lock a user account after a configured number of consecutive failed login attempts
- **FR-07:** System can enforce a request rate limit on login attempts per IP address
- **FR-52:** System can reject requests to protected resources from unauthenticated users with an authentication-required response

### Account Management

- **FR-08:** Authenticated user can view a list of their own trading accounts
- **FR-09:** Authenticated user can view the details of a specific account including masked account number and current balance
- **FR-10:** System can display account numbers in a privacy-preserving masked format in all user-facing surfaces

### Order Initiation & OTP

- **FR-11:** Authenticated user can initiate an order (buy/sell) by specifying account, symbol, quantity, and side
- **FR-12:** System can validate an order request against available position quantity before proceeding
- **FR-13:** System can validate a SELL order request against the account's configured daily sell limit before proceeding
- **FR-14:** System can validate a time-based one-time code submitted by the user during step-up authentication, using a pre-enrolled TOTP secret (RFC 6238, Google Authenticator-compatible)
- **FR-15:** Authenticated user can submit a one-time code to advance a pending order to authorized state
- **FR-16:** System can enforce a maximum number of OTP verification attempts per order session
- **FR-17:** System can expire a pending order session after a configured time-to-live period
- **FR-18:** Authenticated user can query the current status of a pending order session

### Order Execution & Position

- **FR-19:** System can execute an order and update the corresponding position atomically
- **FR-20:** System can route an order to an external exchange via the FEP interface
- **FR-21:** System can record every order execution as a position update entry
- **FR-22:** System can reject a duplicate order submission and return the original result unchanged
- **FR-23:** System can compensate a failed FEP order by reverting the position change on the source account
- **FR-24:** System can track an order through discrete status states from initiation to completion or failure
- **FR-25:** System can provide a unique order reference number for every completed or failed order
- **FR-43:** System can protect concurrent position modifications for the same account such that the final position reflects exactly the sum of successful operations and no modification succeeds that would result in a negative position quantity (no oversell)
- **FR-44:** System can guarantee that position updates for a single order are recorded atomically — either both the fill record and position update exist or neither exists

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

---

> **Traceability summary:** All 7 acceptance scenarios trace to FRs. All 4 User Journeys fully covered. All 5 React screens designable from FRs alone. No FR contains implementation details (HOW). Growth-scope capabilities (notification read/filter, admin UI, Keycloak) intentionally excluded.

---

## Non-Functional Requirements

35 NFRs across 10 categories. Each NFR includes a concrete measurement method to enable objective verification.

### Performance

- **NFR-P1:** Channel-service read endpoints (account list, balance inquiry) must achieve p95 response time ≤ 500ms under normal load.
  _Measurement: Spring Boot Actuator `http.server.requests` metric filtered by `uri` and `outcome=SUCCESS`._

- **NFR-P2:** Order Prepare endpoint (OTP issuance) must achieve p95 response time ≤ 1,000ms under normal load.
  _Measurement: Actuator `http.server.requests` metric for `/api/v1/orders/sessions`._

- **NFR-P3:** Full system cold start (`docker compose up` from clean state) must complete within 120 seconds on a developer laptop (8GB RAM, 4 cores). Vault + vault-init initialization accounts for the extended window vs. a non-Vault baseline. Spring Boot lazy initialization (`spring.main.lazy-initialization=true`) is permitted.
  _Measurement: `time docker compose up --wait` — wall-clock time._

- **NFR-P4:** CoreBanking service must successfully complete 10 concurrent sell order requests without deadlock or oversell within 5 seconds total.
  _Measurement: `PositionConcurrencyIntegrationTest` — 10 threads via `ExecutorService`, all futures resolved ≤ 5s._

- **NFR-P5:** `@Lock(PESSIMISTIC_WRITE)` row-level lock hold time must remain ≤ 100ms under normal operating conditions.
  _Measurement: Micrometer custom timer around the locked transaction block; logged to Actuator metrics._

- **NFR-P6:** Error responses (`4xx`, `5xx`) must meet the same p95 latency SLA as success responses (channel ≤ 500ms, order ≤ 1,000ms). Circuit Breaker OPEN-state fallback responses must also comply.
  _Measurement: Actuator `http.server.requests` filtered by `outcome=CLIENT_ERROR` and `outcome=SERVER_ERROR`._

### Security

- **NFR-S1:** All session cookies must be issued with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes.
  _Measurement: Browser DevTools → Application → Cookies; or `curl -I` response headers verification._

- **NFR-S2:** No passwords, session tokens, full account numbers, or OTP values may appear in application log output. API responses must not expose stack traces, SQL queries, or internal class names. `server.error.include-stacktrace=never` must be applied in production profile.
  _Measurement: `docker compose logs | grep -E "(password|token|stacktrace|SQLException)"` → 0 matches during integration test run._

- **NFR-S3:** CSRF tokens must be validated on all state-changing HTTP requests (POST, PUT, PATCH, DELETE).
  _Measurement: Integration test — submit state-changing request without CSRF token → expect `403 Forbidden`._

- **NFR-S4:** Internal service endpoints (corebank-service:8081, fep-gateway:8083, fep-simulator:8082) must be unreachable from outside the Docker Compose network. Only channel-service:8080 is exposed on host.
  _Measurement: `curl localhost:8081/actuator/health` → `Connection refused`; `curl localhost:8083/actuator/health` → `Connection refused`; Docker Compose `ports:` omitted for corebank, fep-gateway, and fep-simulator._

- **NFR-S5:** TOTP step-up authentication must enforce a 3-attempt lockout per order session. Order session TTL must be ≤ 600 seconds. Both enforced server-side via Redis (`ch:otp-attempts:{sessionId}` counter + `ch:order-session:{sessionId}` TTL).
  _Measurement: Submit 3 incorrect TOTP codes → session → `FAILED`, execute call returns 409 ORD-006. Submit 4th OTP attempt on the same (now FAILED) session → HTTP 409 ORD-006 (session is in terminal FAILED state; OTP verify endpoint returns ORD-006, not AUTH-005). Session TTL: create session, wait 601s, status query → 404 ORD-005._

- **NFR-S6:** GitHub Dependabot or OWASP Dependency-Check must be active. No dependency with CVSS score ≥ 7.0 may exist on the `main` branch.
  _Measurement: GitHub Security tab → Dependabot alerts → 0 critical/high alerts._

- **NFR-S7:** All state-changing endpoints must require authenticated session. Requests without a valid session must receive an authentication-required response — not a data response or server error.
  _Measurement: Integration test — call state-changing endpoint with no session cookie → `401 Unauthorized`._

### Reliability

- **NFR-R1:** All 7 acceptance scenarios defined in the Success Criteria section must pass on every commit to `main` branch in CI.
  _Measurement: GitHub Actions workflow — `test` job exits 0; scenario-mapping test classes all GREEN._

- **NFR-R2:** Resilience4j Circuit Breaker must transition to OPEN state after 3 consecutive failures within a sliding window. Fallback response must be returned immediately while OPEN.
  _Measurement: Integration test — inject 3 FEP errors → assert circuit state = OPEN → assert fallback received on 4th call._

- **NFR-R3:** All services must recover to full operational status within 60 seconds of Redis restart without manual intervention. In-flight data loss during the outage is acceptable; functional degradation after recovery is not.
  _Measurement: `docker compose restart redis` → wait 60s → run smoke test → all endpoints healthy._

- **NFR-R4:** Flyway `validate-on-migrate=true` must be configured. Schema checksum mismatch must cause immediate application startup failure (fail-fast).
  _Measurement: Alter a migration file checksum → `docker compose up` → service exits with `ApplicationContext` load failure._

### Testability and Code Quality

- **NFR-T1:** Channel-service line coverage must be ≥ 70% as reported by JaCoCo on every CI run.
  _Measurement: GitHub Actions `coverage` job — `jacocoTestCoverageVerification` task fails build if below threshold._

- **NFR-T2:** CoreBanking-service line coverage must be ≥ 80%.
  _Measurement: Same JaCoCo enforcement — higher threshold reflects critical transaction logic._

- **NFR-T3:** FEP-simulator line coverage must be ≥ 60%.
  _Measurement: JaCoCo report in CI; lower threshold reflects simulator's non-production nature._

- **NFR-T4:** Integration test suite must complete within 8 minutes in CI.
  _Measurement: GitHub Actions `integration-tests` job — `timeout-minutes: 8` annotation; build fails on timeout._

- **NFR-T5:** Fast test suite (`@WebMvcTest`, unit tests) must complete within 2 minutes in CI.
  _Measurement: GitHub Actions `fast-tests` job — `timeout-minutes: 2`._

- **NFR-T6:** `PositionConcurrencyIntegrationTest` class must complete within 20 seconds in CI.
  _Measurement: `@Timeout(20)` JUnit 5 annotation on the test method — automatic deadlock detection; test fails if exceeded. NFR-P4 (5s total) is the production performance target; 20s is the CI deadline accounting for 2-core runner overhead._

- **NFR-T7:** Each integration test class must produce identical results regardless of execution order. Tests must not share mutable database state between methods.
  *Measurement: `./gradlew test --tests "*IntegrationTest*" --rerun-tasks` executed 3 times in randomized order — all GREEN.*

### Maintainability

- **NFR-M1:** Each Gradle module must correspond to exactly one bounded context. Cross-module dependencies must be declared explicitly in `build.gradle`; violations are detectable at compile time via `./gradlew dependencies`.
  _Measurement: Attempt to reference a corebank internal class from channel module without dependency declaration → compilation failure._

- **NFR-M2:** All significant architecture decisions (database isolation strategy, Redis session design, Docker network topology, pessimistic locking rationale) must be documented in the README under a `## Architecture Decisions` section.
  _Measurement: Manual review — README contains the section with at least 5 documented decisions._

- **NFR-M3:** All public Controller-layer methods must have either Javadoc comments or springdoc-openapi `@Operation` annotations describing purpose, parameters, and response codes.
  _Measurement: Code review; Swagger UI displays description for every endpoint._

- **NFR-M4:** No environment-specific values (DB URLs, Redis host, Redis password, service ports) may be hardcoded in source code. All must be externalized via `application.yml` profiles or environment variables. Required environment variables must be listed in a `## Environment Variables` README section with an `application-local.yml.template` file provided.
  _Measurement: `grep -r "localhost:3306\|localhost:6379" src/` → 0 matches in non-test source._

### Scalability (Portfolio Scope)

- **NFR-SC1:** Docker Compose deployment must support at least 5 concurrent user sessions for demonstration purposes without service degradation.
  _Measurement: 5 concurrent browser sessions — all maintain independent authenticated state._

- **NFR-SC2:** Bucket4j rate limit thresholds must be configurable via environment variables without code changes or redeployment.
  _Measurement: Change env var → `docker compose up` → verify new limit enforced via API calls._

### Data Integrity

- **NFR-D1:** No sell order may result in a negative position quantity or an oversell. This constraint must be verified on every CI run.

  _Measurement: `PositionIntegrityIntegrationTest` asserts:_

  ```java
  assertThat(positions).allMatch(p -> p.getQuantity() >= 0);
  assertThat(sumBuyQty.subtract(sumSellQty)).isEqualByComparingTo(positions.getQuantity());
  // sumBuyQty = SUM(executed_qty WHERE side='BUY'), sumSellQty = SUM(executed_qty WHERE side='SELL')
  ```

### UX

- **NFR-UX1:** The order flow (Step A → B → C) must execute within a single modal without full page reload. Navigation between steps must not generate a new Document-type network request.
  _Measurement: Browser DevTools Network tab — filter by `Doc` type; only the initial page load appears._

- **NFR-UX2:** SSE (Server-Sent Events) connection for real-time notifications must re-establish automatically within 5 seconds of disconnection.
  _Measurement: React implementation uses `setTimeout(connect, 3000)` on `EventSource` error handler; verified by simulating network drop._

### Observability

- **NFR-O1:** `GET /swagger-ui.html` must return HTTP 200 for both channel-service (port 8080) and fep-simulator (port 8082) after service startup. All public endpoints must be documented via springdoc-openapi annotations.
  _Measurement: `curl -o /dev/null -w "%{http_code}" localhost:8080/swagger-ui.html` → `200`._

### Logging

- **NFR-L1:** All services must emit logs in JSON format. Each log entry must include `traceId` and `correlationId` fields populated from the incoming `traceparent` / `X-Correlation-Id` headers via MDC propagation (Logback + Logstash Encoder).
  _Measurement: `docker compose logs channel | python3 -c "import sys,json; [json.loads(l) for l in sys.stdin if l.strip()]"` → 0 parse errors._

---

> **NFR Traceability summary:** 35 NFRs across 10 categories. Every NFR has a concrete, executable measurement method. Performance NFRs trace to Actuator metrics. Security NFRs trace to integration tests and Docker network configuration. Reliability NFRs trace to CI pipeline. Testability NFRs enforce JaCoCo thresholds and GitHub Actions timeouts. Data integrity verified on every CI run via `PositionIntegrityIntegrationTest`.

### FR ↔ NFR Cross-Reference (Key Connections)

| Functional Requirement                     | Non-Functional Requirement                           | Connection                                                                 |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| FR-01~07, FR-52 (Authentication & Session) | NFR-S1, NFR-S2, NFR-S3, NFR-S7                       | Session cookie security, CSRF enforcement, unauthenticated rejection       |
| FR-01~07 (Authentication)                  | NFR-T1 (Channel ≥ 70% coverage)                      | Auth logic is primary channel test target                                  |
| FR-11~18 (Order Initiation & OTP)       | NFR-S5 (TOTP 3-attempt lockout enforced per session)         | Attempt counter in Redis enforces FR-16 lockout requirement               |
| FR-19~25 (Order Execution & Position)     | NFR-D1 (No negative qty, no oversell)         | Every executed order is a `PositionIntegrityIntegrationTest` data point       |
| FR-43 (Concurrent position protection)     | NFR-P4 (10 threads ≤ 5s), NFR-P5 (lock ≤ 100ms)      | Concurrency scenario drives both performance and lock NFRs                 |
| FR-44 (Atomic position update)                | NFR-D1, NFR-T2 (CoreBanking ≥ 80%)                   | Atomicity requires high CoreBanking coverage to verify                     |
| FR-26~29, FR-54 (Fault Tolerance)          | NFR-R2 (CB OPEN after 3 failures)                    | FR defines capability; NFR defines Resilience4j configuration measurement  |
| FR-30~32 (SSE Notifications)               | NFR-UX2 (SSE reconnect ≤ 5s)                         | Notification streaming capability requires reconnect SLA                   |
| FR-33~37, FR-50 (Security & Audit)         | NFR-S2, NFR-L1                                       | Audit log correctness requires PII masking + JSON log structure            |
| FR-41~42 (Portfolio & Observability)       | NFR-O1 (Swagger 200), NFR-L1 (JSON logs)             | Observability claims require both API docs and structured log verification |
| FR-51, FR-53 (Admin operations)            | NFR-S6 (Dependabot), NFR-M2 (Architecture Decisions) | Admin endpoints require supply chain security + documented rationale       |
