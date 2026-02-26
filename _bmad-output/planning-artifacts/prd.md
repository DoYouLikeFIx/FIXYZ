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
  subType: "gradle-multi-module-monolith + 2-satellite-simulators"
  domain: "fintech-korean-banking"
  domainDetail: "채널계/계정계/대외계 architecture"
  complexity: "high"
  projectContext: "greenfield"
  targetAudience:
    primary: "Korean tier-1 banks (KB/신한/하나/우리)"
    secondary: "Korean FinTech startups (토스/카카오페이/네이버파이낸셜)"
  timeline: "6 weeks to interview-ready MVP"
  techStack:
    backend: "Java 21 + Spring Boot 3.x + Gradle multi-module"
    dataAccess: "JPA + Query Annotations + QueryDSL"
    database: "MySQL InnoDB (channel_db + core_db)"
    cache: "Redis (Docker Compose from day 1)"
    resilience: "Resilience4j (circuit breaker + retry)"
    session: "Spring Session + Redis"
  frontend:
    mvp: "React Web (5 screens)"
    phase2: "React Native (post-MVP)"
  complianceBoundary: "Simulator only — no real KYC/AML/금융결제원 integration"
  keycloak: false
  deployableUnits:
    - "channel-service (port 8080)"
    - "corebank-service (port 8081)"
    - "fep-simulator (port 8082)"
  acceptanceCriteria:
    - "Same-bank transfer E2E happy path (Channel→CoreBanking)"
    - "Concurrent debit (10 threads) — exactly 5 COMPLETED, balance = ₩0"
    - "OTP failure blocks transfer execution"
    - "Duplicate clientRequestId returns idempotent result"
    - "FEP timeout → circuit breaker OPEN after 3 failures"
    - "Session invalidated after logout — subsequent API call rejected"
    - "After N transfers — SUM(DEBIT) == SUM(CREDIT)"
workflowType: "prd"
---

# Product Requirements Document - FIX

_Complete Product Requirements Document for FIX. Audience: human stakeholders and LLM downstream agents (UX → Architecture → Implementation). All requirements are WHAT-only — implementation details excluded._

**Author:** yeongjae
**Date:** 2026-02-20

## Executive Summary

**FIX** is a `docker compose up`-deployable Korean banking architecture simulator. Three independently deployable services — Channel (채널계), CoreBanking (계정계), FEP simulator (대외계) — built on Java 21 + Spring Boot 3.x, prove production-level engineering decisions: session integrity via Redis externalization, ledger consistency via pessimistic locking, fault tolerance via Resilience4j, and distributed observability via structured JSON logs.

**Target Users:** Korean tier-1 bank hiring managers (KB국민, 신한, 하나, 우리) and FinTech engineering teams (토스, 카카오페이, 네이버파이낸셜) evaluating backend candidates. For the evaluating engineer, FIX provides a coherent, documented system where every architectural claim is backed by a test and every design decision has a documented rationale.

**Problem Solved:** The Korean banking engineering hiring market increasingly tests architecture-level knowledge — why the channel layer does not hold ledger state, why transfers require step-up OTP re-authentication, how a FEP circuit breaker protects the core ledger from external network failures. Most portfolios demonstrate Spring Boot CRUD; FIX demonstrates systems thinking.

### What Makes This Special

FIX is the gap between "I know Spring Boot" and "I understand why a Korean bank's systems are separated the way they are."

**Visible Architecture:** Three-deployable structure (`channel-service:8080`, `corebank-service:8081`, `fep-simulator:8082`) makes the architectural separation literal. The Gradle multi-module layout makes bounded contexts scannable from the GitHub file tree.

**Production Data Access Pattern:** Data access layers use JPA + QueryDSL — the combination found in production Korean banking systems — with `@Lock(PESSIMISTIC_WRITE)` annotations providing explicit `SELECT FOR UPDATE` semantics for concurrent transfer safety.

**Demonstrable Correctness:** Seven non-negotiable acceptance scenarios — covering concurrent ledger integrity, idempotency, double-entry ledger correctness, circuit breaker behavior, and session security — serve as the portfolio's technical proof points.

**Dual-Audience Experience:** A bank interviewer opens the README, navigates to the Security Architecture section, and finds OWASP-referenced audit log specs, session externalization rationale, and PII masking rules — the vocabulary they use internally. A FinTech interviewer scrolls to the CI badge, clicks through to the Testcontainers concurrent transfer test, and sees 10-thread race condition validation passing in GitHub Actions.

## Project Classification

| Attribute               | Value                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------- |
| **Project Type**        | Distributed backend system — Gradle multi-module monolith + 2 satellite simulators |
| **Domain**              | Fintech / Korean banking (채널계/계정계/대외계)                                    |
| **Complexity**          | High — concurrency control, distributed state, resilience, security, observability |
| **Project Context**     | Greenfield portfolio project                                                       |
| **Timeline**            | 6 weeks to interview-ready MVP                                                     |
| **Compliance Boundary** | Simulator only — no real KYC/AML/금융결제원 integration                            |
| **Data Access**         | JPA + `@Query` annotations + QueryDSL                                              |
| **Frontend**            | React Web MVP (5 screens); React Native Phase 2                                    |
| **Keycloak**            | Out of MVP scope                                                                   |

## Success Criteria

### User Success

**yeongjae (Developer / Portfolio Author)**

- Can open any file in the FIX repo during a screenshare, explain what it does, why it is structured that way, and what would break if that design decision changed — without preparation.
- Within 4 weeks of submitting a GitHub link, at least one technical interviewer asks a question referencing a specific implementation detail in FIX (e.g., "I saw you used `SELECT FOR UPDATE` — walk me through that concurrency decision").

**Hiring Manager (Evaluator)**

- Opens the README and finds OWASP-referenced audit log specs, session externalization rationale, and PII masking rules — the vocabulary used internally at Korean banks — within 2 minutes of landing on the repository.
- FinTech-track evaluator clicks the CI badge, views the Testcontainers concurrent transfer test, and sees 10-thread race condition validation passing in GitHub Actions.
- Within 8 weeks of FIX going public on GitHub: at least one technical interview invitation received from a tier-1 bank or FinTech startup where the interviewer has viewed the repository.

### Business Success

- **Portfolio differentiation:** FIX is the only portfolio project in yeongjae's GitHub that demonstrates three-tier banking architecture with running code, live tests, and documented design rationale.
- **Interview conversion:** At least one offer-stage interview at a Korean tier-1 bank (KB국민/신한/하나/우리) OR FinTech startup (토스/카카오페이/네이버파이낸셜) within 3 months of completion.
- **Dual-audience README:** A bank interviewer and a FinTech interviewer both independently confirm the README answers their first three questions without scrolling to documentation links.

### Technical Success

| Metric                      | Target                                                | How Verified                                             |
| --------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Channel p95 response time   | Visible in Actuator, documented in README             | Spring Boot Actuator `/actuator/metrics`                 |
| Transfer failure rate       | Circuit breaker demo scenario scripted and runnable   | Resilience4j OPEN state observable in Actuator           |
| Concurrent debit integrity  | 0 balance errors under 10-thread simultaneous debit   | `@SpringBootTest` + `ExecutorService` test passing in CI |
| Docker cold start           | `docker compose up` → first successful API call ≤ 90s | Documented in README Quick Start                         |
| CoreBanking test coverage   | ≥ 80% line coverage                                   | JaCoCo report in CI                                      |
| Channel test coverage       | ≥ 70% line coverage                                   | JaCoCo report in CI                                      |
| FEP simulator test coverage | ≥ 60% line coverage                                   | JaCoCo report in CI                                      |
| GitHub Actions CI           | All 7 acceptance scenarios green on `main`            | CI badge in README                                       |

### Measurable Outcomes — 7 Non-Negotiable Acceptance Scenarios

All seven must pass in CI before the MVP is considered complete:

| #   | Scenario                                                        | Layer                 | Architectural Claim Proven                                 |
| --- | --------------------------------------------------------------- | --------------------- | ---------------------------------------------------------- |
| 1   | Same-bank transfer E2E happy path                               | Channel → CoreBanking | State machine, distributed REST call, trace ID propagation |
| 2   | Concurrent debit (10 threads) — exactly 5 COMPLETED, balance = ₩0  | CoreBanking           | `SELECT FOR UPDATE` InnoDB locking correctness             |
| 3   | OTP failure blocks transfer execution                           | Channel               | Step-up re-authentication enforcement                      |
| 4   | Duplicate `clientRequestId` returns idempotent result           | CoreBanking           | No double-debit on retry                                   |
| 5   | FEP timeout → circuit breaker OPEN after 3 failures             | FEP Simulator         | Resilience4j sliding window circuit breaker                |
| 6   | Session invalidated after logout — subsequent API call rejected | Channel + Redis       | Redis session security                                     |
| 7   | After N transfers — `SUM(DEBIT) == SUM(CREDIT)`                 | CoreBanking           | Double-entry ledger integrity                              |

## Product Scope

### MVP — Minimum Viable Product (Week 6 Exit Gate)

- GitHub Actions CI: 7 acceptance scenarios GREEN on main branch
- `docker compose up` cold start ≤ 90s to first API response
- Three deployable services wired: `channel-service`, `corebank-service`, `fep-simulator`
- React Web 5-screen demo functional (Login, Account List, Account Detail, Transfer Flow, Notification Feed)
- README with architecture diagram, dual-audience demo script, Quick Start section, CI badge
- Flyway migration history: `V1__init.sql` through final schema version
- Audit log, PII masking, and session security documented with OWASP references

### Growth Features (Post-MVP)

- React Native mobile view (responsive demo for mobile-first interviewers)
- Prometheus + Grafana dashboard (visual observability demo)
- Keycloak SSO integration (demonstrates enterprise IDP awareness)
- Advanced rate limiting and fraud detection simulation

### Vision (Future)

- Kafka event streaming replacing synchronous internal calls (MSA migration story)
- Outbox pattern for reliable event delivery
- Multi-bank simulation (multiple FEP endpoints, routing logic)
- Load testing report with k6 or Gatling

## User Journeys

### Journey 1 — 지수, Same-Bank Transfer (Primary Happy Path)

**Persona:** 지수 (Jisu), 26, recent graduate working at a Seoul startup. Pays shared apartment rent monthly to a housemate at the same bank.

**Opening Scene:** 지수 opens the FIX web app on her laptop on the 25th of the month. She remembers she needs to send this month's rent before midnight. She logs in with her credentials — the session establishes instantly (JSESSIONID stored in Redis, HttpOnly cookie set).

**Rising Action:** The Account List screen loads her 보통예금 account with balance ₩1,240,000. She taps "이체" and enters ₩450,000, her housemate's account number (same bank). The Prepare step validates her balance against CoreBanking — sufficient. A `transferSessionId` is returned and stored in Redis with a 10-minute TTL. The UI advances to Step B.

**Climax:** She enters her 6-digit TOTP OTP. The system validates it against her registered secret. The OTP is correct — the session advances to AUTHED. She taps 확인. The Execute step fires: Channel calls CoreBanking, CoreBanking acquires a `SELECT FOR UPDATE` lock on her account row, debits ₩450,000, credits her housemate's account — single atomic transaction. DB commits.

**Resolution:** The screen shows: "이체 완료. 거래번호: fix-ch-20260225-a1b2c3." The trace ID is visible. Within 2 seconds, a green SSE notification appears in her notification feed: "₩450,000이 [하우스메이트 계좌 ****4521]로 이체되었습니다."

**Capabilities Revealed:** Session management, TOTP step-up auth, transfer state machine (REQUESTED → EXECUTING → COMPLETED), same-bank ledger atomicity, SSE notification, distributed trace ID.

---

### Journey 2 — 지수, Interbank Transfer Failure (Primary Failure Path)

**Persona:** Same 지수. This time sending ₩200,000 to a friend at 하나은행 (different bank).

**Opening Scene:** Same login flow. 지수 enters the amount and selects "타행이체." The destination account is a 하나은행 account. FIX detects this as an interbank transfer — it will route through the FEP simulator.

**Rising Action:** Prepare step succeeds — transferSessionId issued, balance sufficient. OTP confirmed — session AUTHED. She taps 확인 for Execute. CoreBanking records the transfer as `REQUESTED` in the DB. It then calls the FEP simulator at `fep-simulator:8082`.

**Climax:** The FEP simulator is configured to simulate a 3-second delay (exceeding the 2-second timeout). Resilience4j fires a `CallNotPermittedException` on the 3rd consecutive timeout — the circuit breaker transitions to `OPEN`. CoreBanking catches the fallback, marks the transfer `FAILED`, does NOT debit the source account, records a `FAILED` ledger event.

**Resolution:** The UI receives a failure response. The screen shows: "송금 처리 중 오류가 발생했습니다. 거래번호 fix-ch-20260225-x9y8z7을 보관하세요. **잔액은 차감되지 않았습니다.**" An SSE notification arrives: "이체 실패 — 타행 연결 오류." The circuit breaker OPEN state is visible in `/actuator/circuitbreakers`. The transfer row in the DB shows `status: FAILED`, `clientRequestId` still unique — re-submitting the same request returns the existing FAILED result without creating a new transfer.

**Capabilities Revealed:** FEP timeout handling, Resilience4j circuit breaker, idempotency key protection, compensating state transition, failure UX messaging, audit log of failure event.

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

**Climax:** The channel service calls `redisTemplate.delete("spring:session:jisu-001:*")` — all Redis session keys for that user are atomically purged. Any in-flight request using her session immediately receives `401 Unauthorized`.

**Resolution:** The audit log records: `ADMIN_FORCE_LOGOUT | userId: jisu-001 | adminId: hyunseok | reason: suspicious_concurrent_login | timestamp: 2026-02-25T14:32:11Z`. 지수's next page load redirects to the login screen with message "보안을 위해 로그아웃되었습니다."

**Capabilities Revealed:** Admin role endpoint, Redis session bulk invalidation, audit log with admin actor, 401 propagation on invalidated session.

---

### Journey 4 — Portfolio Reviewer Journey

---

### Journey 4 — Portfolio Reviewer Journey

> ⚠️ _Non-standard journey type unique to the portfolio nature of this project. Maps how technical evaluators experience FIX as a portfolio artifact._

**Bank Interviewer Lens (KB/신한/하나/우리 senior engineer):**
Opens GitHub repo → scans module structure (`channel-auth`, `channel-transfer`, `channel-common`) → opens `AuditLogService.java`, sees PII masking on account numbers → opens `TransferService.java`, sees `@Lock(PESSIMISTIC_WRITE)` on the balance query → opens `V1__init.sql`, sees `ledger_entry` double-entry schema → opens README Security section, finds OWASP Logging Cheat Sheet reference.
**Assessment:** _"This candidate understands why we separate channel and ledger."_

**FinTech Interviewer Lens (토스/카카오페이/네이버파이낸셜 backend engineer):**
Opens GitHub repo → clicks CI badge → sees Testcontainers concurrent transfer test green → opens `TransferConcurrencyTest.java`, sees `ExecutorService` spinning 10 threads → opens `application.yml`, sees Resilience4j sliding window config → runs `docker compose up`, calls the transfer API, injects a timeout via FEP chaos endpoint → watches circuit breaker OPEN in Actuator.
**Assessment:** _"This candidate writes tests that prove the hard stuff."_

**Capabilities Revealed:** README structure, Actuator exposure, CI badge integration, FEP chaos/test endpoint, QueryDSL + JPA lock annotation code visibility.

---

### Journey Requirements Summary

| Capability                                              | Revealed By Journey |
| ------------------------------------------------------- | ------------------- |
| Session management (Redis externalization)              | J1, J3, J4          |
| TOTP step-up OTP                                        | J1, J2              |
| Transfer state machine (REQUESTED→EXECUTING→COMPLETED)  | J1, J2              |
| Same-bank atomic ledger transaction                     | J1                  |
| FEP interbank routing + timeout                         | J2                  |
| Resilience4j circuit breaker + sliding window           | J2, J4              |
| Idempotency key (`clientRequestId`)                     | J2                  |
| SSE/WebSocket notification                              | J1, J2              |
| Admin force-logout (Redis session bulk purge)           | J3                  |
| Audit log with actor + PII masking                      | J3, J4              |
| Distributed trace ID (`traceparent`)                    | J1, J2              |
| FEP chaos/test endpoint                                 | J4                  |

## Domain-Specific Requirements

### Compliance Boundary Declaration

FIX is a **simulator** — it models regulatory obligations without real-world compliance exposure.

| Real Banking Component      | FIX Simulator Equivalent                 | Why Sufficient for Interview                   |
| --------------------------- | ---------------------------------------- | ---------------------------------------------- |
| HSM-backed OTP token device | Redis-stored `SecureRandom` 6-digit code | Tests the auth flow, not the HSM               |
| 금융결제원 FEP gateway      | `fep-simulator` service on port 8082     | Tests the circuit breaker, not the wire        |
| KYC/AML screening           | Not implemented                          | Out of MVP; documented boundary                |
| 공인인증서 (공동인증서)     | Spring Security session cookie           | Tests session management pattern               |
| Real PII (주민등록번호)     | Faker-generated test data                | No compliance risk; masking still demonstrated |

Real KYC/AML, PCI DSS, and 금융결제원 integration are explicitly out of scope. The FEP simulator documents the interface contract without a real network connection. No real PII is stored — test data only; masking patterns are fully demonstrated.

---

### Security Standards (In Scope)

| Standard                         | Application in FIX                                                       |
| -------------------------------- | ------------------------------------------------------------------------ |
| OWASP Authentication Cheat Sheet | Step-up re-authentication (OTP) required for transfer execution          |
| OWASP CSRF                       | Signed Double-Submit Cookie or Spring Security CSRF token                |
| OWASP Logging Cheat Sheet        | No tokens/passwords/PII in logs; account numbers masked to last 4 digits |
| Spring Security Cookie           | HttpOnly + Secure + SameSite=Strict cookie attributes                    |

---

### OTP Lifecycle Specification

The transfer flow uses a three-phase protocol with two Redis key structures:

```
Phase 1 — Prepare
  POST /api/transfers/prepare
  → Creates TransferSession (Redis key: txn-session:{transferSessionId})
  → TTL: 600 seconds (10 min)
  → Status: REQUESTED
  → Returns: transferSessionId + OTP challenge meta

Phase 2 — OTP Verify
  POST /api/transfers/{transferSessionId}/verify-otp
  → Validates OTP (Redis key: otp:{userId}:{nonce}, TTL: 180 seconds)
  → OTP value: SecureRandom.nextInt(1_000_000), zero-padded to 6 digits
  → On success: TransferSession status → AUTHED
  → On failure (≥ 3 attempts): session → FAILED, OTP slot locked 30 sec

Phase 3 — Execute
  POST /api/transfers/{transferSessionId}/execute
  → Requires session in AUTHED state (403 TRF-005 if REQUESTED or FAILED)
  → CoreBanking acquires @Lock(PESSIMISTIC_WRITE) on source account row
  → Ledger debit + credit posted atomically within @Transactional
  → Transfer Status: REQUESTED → EXECUTING → COMPLETED (or FAILED)
  → Session status → COMPLETED or FAILED
```

The OTP simulator replaces a real HSM-backed token device with a `SecureRandom`-generated 6-digit code stored in Redis. The interface contract is faithful; the trust anchor is replaced for portfolio use.

---

### Technical Constraints

| Constraint                  | Detail                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------- |
| MySQL InnoDB                | ACID, REPEATABLE READ isolation, `SELECT FOR UPDATE` on all balance write paths    |
| No distributed transactions | Compensating state transitions for interbank failure paths                         |
| Redis EXPIRE                | Session TTL enforced at cache layer; no schedule needed for session cleanup        |
| Trace propagation           | `traceparent` + `X-Correlation-Id` headers on all inter-service calls              |
| QueryDSL                    | Required for daily-limit aggregate queries; not replaceable with plain JPQL in MVP |

---

### Domain Patterns

**Double-Entry Ledger:** Every transfer produces exactly two `ledger_entry` rows (one DEBIT, one CREDIT) within the same `@Transactional` boundary. No balance mutation without a corresponding ledger pair.

**Transfer State Machine:**

```(Session)
                  ↘ EXECUTING (Transfer) → COMPLETED
                                      ↘ FAILED (interbank FEP failure, OTP exhaust
                  ↘ FAILED (interbank FEP failure, OTP exhausted, session TTL expired)
```

**Idempotency Key:** `clientRequestId` (UUID v4, client-generated) stored as `UNIQUE INDEX` on `transfer_record`. Duplicate submission returns the original result with HTTP 200 — no second debit.

---

### Compensation Protocol

**Same-bank transfer (InnoDB ACID):**

```
BEGIN TRANSACTION
  1. SELECT account WHERE id=source FOR UPDATE
  2. Validate: balance >= amount, status=ACTIVE
  3. INSERT ledger_entry (DEBIT, source, amount)
  4. UPDATE account SET balance -= amount WHERE id=source
  5. SELECT account WHERE id=dest FOR UPDATE
  6. INSERT ledger_entry (CREDIT, dest, amount)
  7. UPDATE account SET balance += amount WHERE id=dest
  8. INSERT transfer_record (status=COMPLETED)
COMMIT
```

If Step 6 fails (destination account frozen), Spring `@Transactional` rolls back the entire transaction atomically — no manual compensation needed.

**Interbank transfer (Saga pattern):**

- Channel debits source account via CoreBanking (committed)
- FEP call fails (timeout / FEP-001) → Channel issues compensating CREDIT call to CoreBanking
- Compensating credit has its own `clientRequestId`
- Transfer record: `REQUESTED → FAILED` with sub-status `COMPENSATED`
- FEP simulator triggers failure 30% of calls (configurable) to make the compensation path demonstrable

---

### Fraud Simulation (MVP Scope)

**Daily Transfer Limit:**

- Per-account configurable; default ₩5,000,000
- Prepare step rejects if cumulative today's DEBIT ledger entries exceed limit
- Error code: `TRF-002 TRANSFER_DAILY_LIMIT_EXCEEDED`
- Response body includes remaining limit

**QueryDSL daily-limit enforcement query:**

```java
Long todayTotal = query
    .select(ledgerEntry.amount.sum())
    .from(ledgerEntry)
    .where(
        ledgerEntry.accountId.eq(accountId),
        ledgerEntry.entryType.eq(EntryType.DEBIT),
        ledgerEntry.createdAt.goe(LocalDate.now().atStartOfDay())
    )
    .fetchOne();
```

**User-facing message (Korean):**

> 일일 이체 한도를 초과하였습니다. (오늘 사용: ₩3,200,000 / 한도: ₩5,000,000)

**Phase 2 (Post-MVP):** Real-time fraud scoring, velocity checks, pattern detection.

---

### Data Retention Policy

| Log Type         | Retention | Storage             | Mechanism           |
| ---------------- | --------- | ------------------- | ------------------- |
| Audit log        | 90 days   | MySQL `channel_db`  | `@Scheduled` purge  |
| Security events  | 180 days  | MySQL `channel_db`  | `@Scheduled` purge  |
| Transfer records | 5 years   | MySQL `core_db`     | Never purged in MVP |
| Application logs | 30 days   | Docker log rotation | Log driver config   |

---

### Error Code Taxonomy

**AUTH — Channel Service:**

| Code       | Meaning                             |
| ---------- | ----------------------------------- |
| `AUTH-001` | Invalid credentials                 |
| `AUTH-002` | Account locked (max login attempts) |
| `AUTH-003` | Session expired                     |
| `AUTH-004` | OTP invalid                         |
| `AUTH-005` | OTP expired                         |
| `AUTH-006` | Insufficient privilege              |

**TRF — Transfer Flow:**

| Code      | Meaning                                   |
| --------- | ----------------------------------------- |
| `TRF-001` | Insufficient balance                      |
| `TRF-002` | Daily transfer limit exceeded             |
| `TRF-003` | Source account frozen/inactive            |
| `TRF-004` | Destination account invalid               |
| `TRF-005` | Transfer session expired (>10 min TTL)    |
| `TRF-006` | Transfer session already confirmed        |
| `TRF-007` | Duplicate `clientRequestId` (idempotency) |

**CORE — CoreBanking Service:**

| Code       | Meaning                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| `CORE-001` | Account not found                                                         |
| `CORE-002` | Insufficient balance (ledger check)                                       |
| `CORE-003` | Concurrent modification conflict → Channel retries 2× with 100 ms backoff |
| `CORE-004` | Transaction rollback                                                      |

**FEP — FEP Simulator:**

| Code      | Meaning                   |
| --------- | ------------------------- |
| `FEP-001` | Interbank timeout         |
| `FEP-002` | Destination bank rejected |
| `FEP-003` | Circuit breaker OPEN      |
| `FEP-004` | Invalid routing number    |

---

### Masked Account Number Format

| Context    | Format                         | Example             |
| ---------- | ------------------------------ | ------------------- |
| UI display | `[은행명] ****[last 4 digits]` | `국민은행 ****4521` |
| Log output | `[bank_code]-****-[last4]`     | `KB-****-4521`      |
| Prohibited | Full account number in any log | —                   |

**Unit test specification:**  
`AccountNumber.masked()` in `channel-common` module:

- Asserts the full account number never appears in the masked string
- Asserts the result ends with the correct 4-digit suffix
- Placed in `channel-common` module (shared across all channel sub-modules)

---

### Transfer State Machine Test Matrix

| Test Case | Scenario                  EXECUTING → COMPLETED` | 200, balance debited              |
| TC-TRF-02 | OTP wrong 1× — session stays `AUTHED`            | 4xx, session intact               |
| TC-TRF-03 | OTP wrong 3× — session → `FAILED`                | 4xx TRF-005, session locked       |
| TC-TRF-04 | Execute on `REQUESTED` (skip OTP)                | 403 TRF-005 Session not authed    |
| TC-TRF-05 | Execute on `COMPLETED` (already done)            | 409 TRF-006 Already confirmed     |
| TC-TRF-06 | Prepare after session TTL expired                | 410 TRF-005 Session expired       |
| TC-TRF-07 | `clientRequestId` reuse (idempotency)            | 200 with original COMPLETED response|
| TC-TRF-08 | Concurrent execute (2 threads, same `sessionId`) | Exactly 1 COMPLETED, 1 CORE-003   |

**TC-TRF-08 implementation note:** `CountDownLatch` fires both threads simultaneously. Assert `resultStream.filter(r -> r.status == COMPLE

**TC-TRF-08 implementation note:** `CountDownLatch` fires both threads simultaneously. Assert `resultStream.filter(r -> r.status == COMPLETED).count() == 1`. Requires Testcontainers (MySQL + Redis) + `ExecutorService`.

---

### Database Index Decisions

```sql
-- ledger_entry (core_db)
-- Covers QueryDSL daily-limit query: account_id + entry_type + date range
INDEX idx_ledger_account_date (account_id, entry_type, created_at);

-- transfer_record (core_db)
-- Defense-in-depth idempotency guarantee at DB level (beyond app-layer check)
UNIQUE INDEX idx_idempotency (client_request_id);

-- transfer_session — stored in Redis only
-- TTL handles expiry automatically; no DB cleanup schedule needed
-- Trade-off: session not durable across Redis restart (acceptable in MVP)

-- audit_log (channel_db)
-- Optimizes @Scheduled purge: DELETE WHERE created_at < (NOW() - 90 days)
INDEX idx_audit_user_time (user_id, created_at);
```

---

### UX Error Strings (Domain-Mandated)

**Session expired (TC-TRF-06):**

> ⚠️ 이체 세션이 만료되었습니다. 보안을 위해 이체 정보를 다시 입력해 주세요.

Action: `[처음으로]` button → 이체 화면으로 돌아감 (transferSessionId 삭제, 새 세션 시작)

**Insufficient balance (TRF-001):**

> ❌ 잔액이 부족합니다. 출금 계좌 잔액: ₩1,230,000 / 이체 금액: ₩2,000,000

Action: `[확인]` → 이체 금액 수정 화면

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. QueryDSL + Pessimistic Locking Composition**

FIX combines QueryDSL (type-safe aggregate queries — daily debit sum enforcement) with JPA `@Lock(PESSIMISTIC_WRITE)` (concurrent balance mutation safety) within the same data access layer. The critical design insight: the account row must be locked first (entity fetch with `PESSIMISTIC_WRITE`), then the ledger aggregate query runs — InnoDB shared lock on ledger rows is sufficient after the account is locked.

```java
// Step 1: Lock the account entity row (SELECT FOR UPDATE)
Account source = accountRepository.findByIdWithLock(accountId);

// Step 2: Query the daily ledger aggregate (no additional lock needed)
Long todayTotal = queryDslLedgerRepository.sumTodayDebits(accountId);
// Account already locked — concurrent mutations blocked
```

**Why pessimistic over optimistic locking (`@Version`):**

- Pessimistic lock hold time for single-account balance update: ~5–15ms (InnoDB row lock)
- Optimistic lock retry cost with user re-authentication: 30–120 seconds
- Retry requiring OTP re-entry is unacceptable UX in a banking transfer flow
- `@Version`-based optimistic locking is the wrong choice for this domain — a justified, documented decision

**Future-Proofing (Hot Account Strategy):**
The schema anticipates high-concurrency "Hot Accounts" (e.g., charity fund collection) via `balance_update_mode` ENUM (`EAGER`, `DEFERRED`).
- **MVP (EAGER):** Standard pessimistic locking (User A waits for User B). Simple, correct, proven.
- **Phase 2 (DEFERRED):** Insert-only ledger for deposits; balance updated asynchronously. The schema supports this via `update_mode` column, but MVP implementation is strictly `EAGER` to prove deadlock-free concurrency first.

This deliberate tool-boundary decision mirrors production Korean banking systems. Most junior portfolios use JPA or QueryDSL, not both with documented rationale for each.

---

**2. Live-Observable Fault Injection (FEP Chaos Endpoint)**

The FEP simulator exposes a configurable chaos endpoint:

```
GET /fep-internal/config?mode=timeout&delay_ms=3000&failure_rate=30
```

An interviewer can trigger circuit breaker state transitions on demand during a screenshare. The Resilience4j OPEN state becomes observable in `/actuator/circuitbreakers` within seconds. Exactly 3 configurable parameters (mode, delay_ms, failure_rate) keep scope bounded within the 6-week timeline.

---

**3. Double-Entry Ledger as Architectural Vocabulary**

Every balance mutation produces a `ledger_entry` pair (DEBIT + CREDIT) within the same `@Transactional` boundary. Any account balance is always derivable as `SUM(credits) - SUM(debits)` — no running total on the account row. The portfolio signals: "I know why banks don't store balance as a column update, and I implemented the alternative correctly."

Validated by `LedgerBalanceIntegrityTest`: `SUM(DEBIT) == SUM(CREDIT)` after N transfers, InnoDB-verified via Testcontainers.

---

**4. Documented Simulation Boundary (Interface Compliance Without Real Integration)**

Instead of hiding the absence of real KYC/FEP/OTP hardware as a weakness, FIX documents each simulation boundary explicitly in a README "Architecture Decisions" section:

```
Decision: OTP is simulated via Redis + SecureRandom
Why: Faithful interface contract; HSM not available in portfolio context
Production delta: Replace OTP service bean with HSM-backed provider; contract unchanged
Interview talking point: "I designed the interface for replaceability"
```

This transforms a portfolio limitation into an architectural communication skill.

---

**5. Dual-Audience README as UX Branching Journey**

The README is a branching user journey, not a document. Two distinct mental models are served in sequence:

```
Bank Interviewer path:
  Header → "채널계/계정계/대외계" in first paragraph
  → "Security Architecture" section → OWASP refs + Korean compliance vocabulary
  → "Architecture Decisions" → simulation boundary table
  → Assessment: "This person speaks our language"

FinTech Interviewer path:
  Header → CI badge (click immediately)
  → TransferConcurrencyTest.java → ExecutorService + CountDownLatch
  → docker compose up → FEP chaos demo → Actuator circuit breaker
  → Assessment: "This person ships working code"
```

---

### Market Context & Competitive Landscape

| Gap in Existing Korean Portfolios  | How FIX Addresses It                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Monolith — no service separation   | Three deployable services; structure scannable from GitHub file tree without reading code |
| Balance = running total (fragile)  | `ledger_entry` double-entry — balance derivable from SUM queries                          |
| No concurrency tests               | TC-TRF-08 + `LedgerBalanceIntegrityTest` — CI green, InnoDB-verified                      |
| Auth = JWT only (no step-up)       | Spring Session Redis + OTP step-up at transfer — 전자금융거래법 Article 6 intent         |
| No resilience pattern demonstrated | Resilience4j circuit breaker — OPEN state live-observable in Actuator                     |
| README = setup instructions only   | Dual-audience README with branching discovery path + Architecture Decisions               |

**Why this combination is rare:** Most Korean portfolio projects targeting bank employment demonstrate CRUD + JWT. Projects attempting banking domain knowledge typically: (a) use a monolith with no service separation, (b) implement balance as a running total, or (c) omit concurrency tests entirely. FIX is the first portfolio to combine all six portfolio differentiators correctly and simultaneously, with each claim backed by a passing CI test.

**Bilingual searchability:** Code comments and README use Korean domain vocabulary (`이체`, `채널계`, `계정계`) alongside English technical vocabulary (`pessimistic lock`, `double-entry ledger`, `circuit breaker`) — surfacing in both Korean banking engineer and FinTech startup searches.

---

### Validation Approach

| Innovation Claim               | Supporting Test                                                              | What It Proves                                                                |
| ------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| QueryDSL + locking composition | `TransferConcurrencyTest` (10 threads, exactly 5 COMPLETED, balance = ₩0)       | Lock prevents phantom reads; real InnoDB via Testcontainers — H2 disqualified |
| FEP chaos endpoint             | `FepChaosIntegrationTest` — triggers OPEN state, asserts Actuator response   | Circuit breaker config correct, not accidental                                |
| Double-entry ledger            | `LedgerBalanceIntegrityTest` — `SUM(DEBIT) == SUM(CREDIT)` after N transfers | No orphan entries, no half-posted state                                       |
| Simulation boundary narrative  | README "Architecture Decisions" pre-empts interviewer objection              | —                                                                             |
| Dual-audience README           | Bank interviewer demo script (5 steps, 5 min, screenshare-ready)             | —                                                                             |

**`TransferConcurrencyTest` specification (Fixed 5):**

- 10 threads × ₩200,COMPLE debit on account with ₩1,000,000 balance
- `CountDownLatch` fires all threads simultaneously
- Assert: exactly 5 COMPLETED, final balance = ₩0, 0 negative balance results
- Real InnoDB via `MySQLContainer("mysql:8.0")` — H2 does not implement `SELECT FOR UPDATE` equivalently

**`LedgerBalanceIntegrityTest` — 7th Acceptance Scenario:**
After N sequential transfers across multiple accounts:
`SUM(ledger_entry.amount WHERE entry_type=DEBIT) == SUM(ledger_entry.amount WHERE entry_type=CREDIT)`
No orphan entries, no half-posted state — proves double-entry ledger is atomically maintained.

---

### Risk Mitigation

| Risk                                             | Mitigation                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| QueryDSL Gradle multi-module APT config          | Week 1 spike — validate Q-class generation before feature work; `annotationProcessor` on entity module only      |
| Testcontainers cold start (8+ min without reuse) | `.withReuse(true)` + `testcontainers.reuse.enable=true` in `~/.testcontainers.properties`; in README Quick Start |
| QueryDSL scope creep                             | MVP: exactly 2 QueryDSL queries (daily-limit sum + ledger aggregate); expand post-MVP                            |
| FEP chaos complexity                             | Fixed 3 config params: `mode`, `delay_ms`, `failure_rate`                                                        |
| Ledger overengineering                           | MVP: 2-entry per transfer only; no compound journal entries                                                      |
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
9. Test Coverage — JaCoCo badge + `TransferConcurrencyTest` description
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

# Accounts
GET    /api/v1/accounts                              → account list (authenticated user)
GET    /api/v1/accounts/{accountId}                  → account detail + masked number

# Transfers
POST   /api/v1/transfers/prepare                     → create TransferSession (REQUESTED)
POST   /api/v1/transfers/{sessionId}/verify-otp      → validate OTP → AUTHED
POST   /api/v1/transfers/{sessionId}/execute         → execute transfer → COMPLETED/FAILED
GET    /api/v1/transfers/{sessionId}                 → session status query

# Notifications (SSE)
GET    /api/v1/notifications/stream                  → Server-Sent Events (EventSource)

# Admin (ROLE_ADMIN only)
POST   /api/v1/admin/sessions/force-invalidate
GET    /api/v1/admin/audit-logs
```

**CoreBanking Service (port 8081) — 계정계 — Channel-internal only**

```
POST   /internal/v1/accounts/{accountId}/transfer/prepare
POST   /internal/v1/accounts/{accountId}/transfer/execute
GET    /internal/v1/accounts/{accountId}/balance
GET    /internal/v1/accounts/{accountId}/ledger
```

**FEP Simulator (port 8082) — 대외계 — CoreBanking-internal only**

```
POST   /fep/v1/interbank/transfer              → interbank routing
GET    /fep-internal/health
GET    /fep-internal/config                    → chaos config read
PUT    /fep-internal/config                    → chaos config update
GET    /fep-internal/circuitbreaker-status     → current CB state
```

---

### Authentication Model

| Layer                 | Mechanism                                   | Detail                                                                                    |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Channel ↔ User        | Spring Security session cookie              | JSESSIONID, HttpOnly + Secure + SameSite=Strict, stored in Redis                          |
| Channel ↔ CoreBanking | `X-Internal-Secret` header + Docker network | `INTERNAL_API_SECRET` env var; `OncePerRequestFilter` validates on every internal request |
| CoreBanking ↔ FEP     | `X-Internal-Secret` header + Docker network | Same secret; FEP verifies on inbound requests                                             |
| Step-up auth          | OTP (6-digit, Redis TTL 180s)               | Required before transfer execute; 3-attempt lockout                                       |

**Docker Compose network isolation (2-layer defense):**

```yaml
networks:
  external-net: # Channel only — port 8080 exposed
  core-net: # Channel ↔ CoreBanking
  fep-net: # CoreBanking ↔ FEP

services:
  channel-service:
    networks: [external-net, core-net]
    ports: ["8080:8080"]
  corebank-service:
    networks: [core-net, fep-net] # no ports — external access impossible
  fep-simulator:
    networks: [fep-net] # no ports — external access impossible
```

**CSRF:** Double Submit Cookie pattern — `CookieCsrfTokenRepository.withHttpOnlyFalse()`; React axios interceptor reads `XSRF-TOKEN` cookie and injects `X-XSRF-TOKEN` header on all non-GET requests.

---

### Data Schemas

**channel_db tables:**

| Table               | Storage | Notes                                                        |
| ------------------- | ------- | ------------------------------------------------------------ |
| `users`             | MySQL   | id, username, password_hash, role, login_attempts, locked_at |
| `audit_logs`        | MySQL   | id, user_id, action, target, masked_account, ip, created_at  |
| `security_events`   | MySQL   | id, user_id, event_type, detail, ip, created_at              |
| `notifications`     | MySQL   | id, user_id, message, type, read, created_at                 |
| `sessions`          | Redis   | Spring Session — JSESSIONID, TTL 30 min                      |
| `otp_records`       | Redis   | key: `otp:{userId}:{nonce}`, TTL 180s                        |
| `transfer_sessions` | Redis   | key: `txn-session:{sessionId}`, TTL 600s                     |

**core_db tables:**

| Table                         | Storage | Notes                                                                                                    |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `accounts`                    | MySQL   | id, user_id, account_number, balance, status(ACTIVE/FROZEN/CLOSED), update_mode(EAGER/DEFERRED)          |
| `ledger_entries`              | MySQL   | id, account_id, entry_type(DEBIT/CREDIT), amount, transfer_id, created_at                                |
| `transfer_records`            | MySQL   | id, client_request_id(UNIQUE), status(REQUESTED/EXECUTING/COMPLETED/FAILED/COMPENSATED), transfer_type   |
| `transfer_record_diagnostics` | MySQL   | transfer_record_id, detail (TEXT) — long error messages/stack traces separated to optimize row size      |

---

### Rate Limits

**MVP scope — 3 endpoints only (Bucket4j Filter, Redis-backed):**

| Endpoint                                        | Limit                  | Error Response                                       |
| ----------------------------------------------- | ---------------------- | ---------------------------------------------------- |
| `POST /api/v1/auth/login`                       | 5 req/min per IP       | 429 + `Retry-After` header                           |
| `POST /api/v1/transfers/{sessionId}/verify-otp` | 3 attempts per session | 429 (app-layer AUTH-004/005 fires first in practice) |
| `POST /api/v1/transfers/prepare`                | 10 req/min per userId  | 429 + remaining quota in body                        |

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
    "code": "TRF-002",
    "message": "일일 이체 한도를 초과하였습니다.",
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
DAILY_TRANSFER_LIMIT=5000000

# FEP Simulator
FEP_CHAOS_MODE=none
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
| `channel-transfer`          | `@WebMvcTest`     | MockMvc, no DB                 |
| `channel-integration-test`  | `@SpringBootTest` | Testcontainers (MySQL + Redis) |
| `corebank-service`          | `@WebMvcTest`     | MockMvc, no DB                 |
| `corebank-integration-test` | `@SpringBootTest` | Testcontainers (MySQL + Redis) |

Fast tests (`@WebMvcTest`) and slow tests (`@SpringBootTest` + Testcontainers) run separately in CI:

```
./gradlew :channel-auth:test :channel-transfer:test        # fast — ~10s
./gradlew :channel-integration-test:test                   # slow — ~60s
```

**Auth test matrix (TC-AUTH):**

| Test Case  | Scenario                  | Expected                        |
| ---------- | ------------------------- | ------------------------------- |
| TC-AUTH-01 | 정상 로그인               | 200, JSESSIONID HttpOnly cookie |
| TC-AUTH-02 | 잘못된 비밀번호 3회       | AUTH-002 account locked         |
| TC-AUTH-03 | 잠긴 계정 로그인          | AUTH-002                        |
| TC-AUTH-04 | 로그아웃 후 `/auth/me`    | 401                             |
| TC-AUTH-05 | Rate limit 초과 (6th/min) | 429 Too Many Requests           |

**Rate limit test matrix (TC-RATE):**

| Test Case  | Scenario                       | Expected                                     |
| ---------- | ------------------------------ | -------------------------------------------- |
| TC-RATE-01 | 6번째 로그인 (동일 IP, 1분 내) | 429                                          |
| TC-RATE-02 | 1분 후 재시도                  | 정상 (bucket refill)                         |
| TC-RATE-03 | OTP 4번째 시도                 | 403 FAILED (app-layer fires before Bucket4j) |

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
  transferApi.ts       → prepare, verifyOtp, execute, getSession
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

- Journey 1: 지수 — Same-bank transfer happy path (REQUESTED → EXECUTING → COMPLETED)
- Journey 2: 지수 — Interbank FEP failure + circuit breaker (REQUESTED → FAILED)
- Journey 3: 현석 — Admin force-logout (Redis session bulk invalidation)
- Journey 4: Portfolio reviewer — GitHub scan → demo → Actuator verification

**Must-Have Capabilities:**

| Category       | MVP Included                                                                 |
| -------------- | ---------------------------------------------------------------------------- |
| Auth           | Login, logout, session (Redis), OTP step-up, force-logout                    |
| Transfers      | Prepare → verify-OTP → execute state machine (REQUESTED → EXECUTING → COMPLETED)|
| Ledger         | Double-entry `ledger_entry` pair per transfer                                |
| Idempotency    | `clientRequestId` UNIQUE index + app-layer check                             |
| Resilience     | Resilience4j circuit breaker + retry (FEP path)                              |
| Rate Limiting  | Bucket4j — 3 endpoints (login, OTP, prepare)                                 |
| Observability  | Spring Actuator, Micrometer, `traceparent` propagation                       |
| Notifications  | SSE stream + DB persistence (`notifications` table)                          |
| Admin          | Force-invalidate session API (ROLE_ADMIN)                                    |
| Documentation  | Swagger UI (Channel + FEP), dual-audience README                             |
| Infrastructure | Docker Compose (5 containers, 3-network isolation)                           |
| CI             | GitHub Actions — 7 acceptance scenarios green                                |
| Frontend       | React Web — 5 screens (Login, Account List, Detail, Transfer, Notifications) |

---

### 7 Non-Negotiable Acceptance Scenarios

All seven must pass in CI before MVP is complete:

| #   | Scenario                                                        | Layer                 | Claim Proven                       |
| --- | --------------------------------------------------------------- | --------------------- | ---------------------------------- |
| 1   | Same-bank transfer E2E happy path                               | Channel → CoreBanking | State machine, trace propagation   |
| 2   | Concurrent debit (10 threads) — exactly 5 COMPLETED, balance = ₩0  | CoreBanking           | `SELECT FOR UPDATE` InnoDB locking |
| 3   | OTP failure blocks transfer execution                           | Channel               | Step-up re-auth enforcement        |
| 4   | Duplicate `clientRequestId` returns idempotent result           | CoreBanking           | No double-debit on retry           |
| 5   | FEP timeout → circuit breaker OPEN after 3 failures             | FEP Simulator         | Resilience4j sliding window        |
| 6   | Session invalidated after logout — subsequent API call rejected | Channel + Redis       | Redis session security             |
| 7   | After N transfers — `SUM(DEBIT) == SUM(CREDIT)`                 | CoreBanking           | Double-entry ledger integrity      |

---

### Interview-Ready Exit Gate (Week 6 Checklist)

**코드 완성도:**

- [ ] 7 acceptance scenarios — GitHub Actions 그린
- [ ] `docker compose up` → 90초 이내 첫 API 응답
- [ ] JaCoCo: channel ≥ 70%, corebank ≥ 80%, fep ≥ 60%

**설명 준비도 (yeongjae 기준):**

- [ ] `TransferConcurrencyTest.java` 라인 단위 설명 가능
- [ ] "왜 pessimistic lock?" 15초 이내 답변
- [ ] "ledger_entry 스키마를 왜 이렇게 설계했나?" 30초 이내 답변
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
| Week 2 | CoreBanking 도메인 + ledger + transfer state machine + `LedgerBalanceIntegrityTest` | `curl localhost:8081/internal/v1/accounts/1/balance` → 잔액 반환 |
| Week 3 | Channel auth + transfer flow + OTP + Redis + Bucket4j                               | 전체 이체 flow (login → prepare → OTP → execute) curl로 완성     |
| Week 4 | FEP simulator + Resilience4j + chaos endpoint + integration tests                   | FEP chaos=timeout → Actuator circuitbreaker OPEN 확인            |
| Week 5 | React Web 5 screens + `ApplicationEventPublisher` SSE + README + Swagger            | `http://localhost:5173` → Login → Transfer → 알림 수신           |
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
- Multi-bank FEP routing (multiple FEP endpoints)
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

- **FR-01:** Registered user can authenticate with username and password credentials
- **FR-02:** Authenticated user can terminate their session (logout)
- **FR-03:** System can maintain user session state across multiple requests without re-authentication
- **FR-04:** User can retrieve their own identity and role information from an active session
- **FR-05:** System can expire a user session after a configured period of inactivity
- **FR-06:** System can lock a user account after a configured number of consecutive failed login attempts
- **FR-07:** System can enforce a request rate limit on login attempts per IP address
- **FR-52:** System can reject requests to protected resources from unauthenticated users with an authentication-required response

### Account Management

- **FR-08:** Authenticated user can view a list of their own bank accounts
- **FR-09:** Authenticated user can view the details of a specific account including masked account number and current balance
- **FR-10:** System can display account numbers in a privacy-preserving masked format in all user-facing surfaces

### Transfer Initiation & OTP

- **FR-11:** Authenticated user can initiate a money transfer by specifying source account, destination, and amount
- **FR-12:** System can validate a transfer request against available balance before proceeding
- **FR-13:** System can validate a transfer request against the account's configured daily transfer limit
- **FR-14:** System can generate and deliver a one-time verification code to the initiating user for step-up authentication
- **FR-15:** Authenticated user can submit a one-time code to advance a pending transfer to authorized state
- **FR-16:** System can enforce a maximum number of OTP verification attempts per transfer session
- **FR-17:** System can expire a pending transfer session after a configured time-to-live period
- **FR-18:** Authenticated user can query the current status of a pending transfer session

### Transfer Execution & Ledger

- **FR-19:** System can execute a money transfer between two accounts at the same bank atomically
- **FR-20:** System can route a transfer to an external bank via the interbank FEP interface
- **FR-21:** System can record every balance movement as a paired debit and credit ledger entry
- **FR-22:** System can reject a duplicate transfer submission and return the original result unchanged
- **FR-23:** System can compensate a failed interbank transfer by restoring the debited amount to the source account
- **FR-24:** System can track a transfer through discrete status states from initiation to completion or failure
- **FR-25:** System can provide a unique transaction reference number for every completed or failed transfer
- **FR-43:** System can protect concurrent balance modifications for the same account such that the final balance reflects exactly the sum of successful operations and no modification succeeds that would result in a negative balance
- **FR-44:** System can guarantee that debit and credit ledger entries for a single transfer are recorded atomically — either both exist or neither exists

### Fault Tolerance & Resilience

- **FR-26:** System can detect repeated failures on the interbank FEP connection and stop forwarding requests while the failure condition persists
- **FR-27:** System can automatically retry a failed inter-service call a configured number of times before propagating the failure
- **FR-28:** System can expose the current state of fault-tolerance mechanisms (circuit breaker status, retry counters) via an operational endpoint
- **FR-29:** System can be configured to produce predictable failure responses on the interbank interface for controlled scenario testing
- **FR-54:** System can communicate a transfer failure to the initiating user with a reason code distinguishing between internal errors, insufficient balance, and external network failures

### Notifications & Real-time Updates

- **FR-30:** Authenticated user can receive real-time notifications about the outcome of their transfer without polling
- **FR-31:** System can persist notification records so that a user who reconnects can retrieve notifications missed during disconnection
- **FR-32:** Authenticated user can view a list of past notifications from their current session

### Security & Audit

- **FR-33:** System can record an audit log entry for every significant user action including actor, action, target, and timestamp
- **FR-34:** System can purge audit log records older than a configured retention period
- **FR-35:** System can enforce CSRF protection on all state-changing requests from browser clients
- **FR-36:** System can prevent credentials, session tokens, and full account numbers from appearing in application logs
- **FR-37:** System can enforce rate limits on OTP verification attempts per transfer session
- **FR-45:** System can record security-significant events (account lockout, forced session invalidation, OTP exhaustion) separately from general audit logs with an extended retention period
- **FR-46:** System can enforce separate retention policies for audit logs and security events
- **FR-50:** System can record the identity of an administrator who performs privileged actions (session invalidation, audit log access) in the audit trail

### Administration & Operations

- **FR-38:** Administrator can forcibly invalidate all active sessions for a specific user account
- **FR-39:** Administrator can retrieve audit log records filtered by user or time range
- **FR-40:** System can generate and serve interactive API documentation for the Channel Service
- **FR-51:** System can apply a configurable daily transfer limit per account with a defined default value
- **FR-53:** System can expose health status and operational metrics for each service via a dedicated monitoring endpoint

### Domain Rules

- **FR-47:** System can communicate the remaining daily transfer capacity to a user when a transfer is rejected for exceeding the daily limit
- **FR-48:** Authenticated user can view the outcome and reference number of a completed or failed transfer immediately after execution
- **FR-49:** System can include the source account's current available balance in the response when a transfer is rejected for insufficient funds

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

- **NFR-P2:** Transfer Prepare endpoint (OTP issuance) must achieve p95 response time ≤ 1,000ms under normal load.
  _Measurement: Actuator `http.server.requests` metric for `/api/transfers/prepare`._

- **NFR-P3:** Full system cold start (`docker compose up` from clean state) must complete within 90 seconds on a developer laptop (8GB RAM, 4 cores). Spring Boot lazy initialization (`spring.main.lazy-initialization=true`) is permitted.
  _Measurement: `time docker compose up --wait` — wall-clock time._

- **NFR-P4:** CoreBanking service must successfully complete 10 concurrent transfer requests without deadlock or data corruption within 5 seconds total.
  _Measurement: `TransferConcurrencyTest` — 10 threads via `ExecutorService`, all futures resolved ≤ 5s._

- **NFR-P5:** `@Lock(PESSIMISTIC_WRITE)` row-level lock hold time must remain ≤ 100ms under normal operating conditions.
  _Measurement: Micrometer custom timer around the locked transaction block; logged to Actuator metrics._

- **NFR-P6:** Error responses (`4xx`, `5xx`) must meet the same p95 latency SLA as success responses (channel ≤ 500ms, transfer ≤ 1,000ms). Circuit Breaker OPEN-state fallback responses must also comply.
  _Measurement: Actuator `http.server.requests` filtered by `outcome=CLIENT_ERROR` and `outcome=SERVER_ERROR`._

### Security

- **NFR-S1:** All session cookies must be issued with `HttpOnly`, `Secure`, and `SameSite=Strict` attributes.
  _Measurement: Browser DevTools → Application → Cookies; or `curl -I` response headers verification._

- **NFR-S2:** No passwords, session tokens, full account numbers, or OTP values may appear in application log output. API responses must not expose stack traces, SQL queries, or internal class names. `server.error.include-stacktrace=never` must be applied in production profile.
  _Measurement: `docker compose logs | grep -E "(password|token|stacktrace|SQLException)"` → 0 matches during integration test run._

- **NFR-S3:** CSRF tokens must be validated on all state-changing HTTP requests (POST, PUT, PATCH, DELETE).
  _Measurement: Integration test — submit state-changing request without CSRF token → expect `403 Forbidden`._

- **NFR-S4:** Internal service endpoints (corebank-service:8081, fep-simulator:8082) must be unreachable from outside the Docker Compose network. Only channel-service:8080 is exposed on host.
  _Measurement: `curl localhost:8081/actuator/health` → `Connection refused`; Docker Compose `ports:` omitted for corebank and fep._

- **NFR-S5:** OTP TTL must be ≤ 180 seconds. Transfer session TTL must be ≤ 600 seconds. Both enforced server-side via Redis TTL.
  _Measurement: Issue OTP, wait 181s, attempt transfer → expect `410 Gone` or equivalent rejection._

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

- **NFR-T6:** `TransferConcurrencyTest` class must complete within 10 seconds.
  _Measurement: `@Timeout(10)` JUnit 5 annotation on the test method — automatic deadlock detection; test fails if exceeded._

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

- **NFR-D1:** No transfer operation may result in a negative account balance or an unmatched ledger entry (debit without corresponding credit or vice versa). This constraint must be verified on every CI run.

  _Measurement: `LedgerBalanceIntegrityTest` asserts:_

  ```java
  assertThat(accounts).allMatch(a -> a.getBalance() >= 0);
  assertThat(totalDebits).isEqualByComparingTo(totalCredits);
  ```

### UX

- **NFR-UX1:** The transfer flow (Step A → B → C) must execute within a single modal without full page reload. Navigation between steps must not generate a new Document-type network request.
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

> **NFR Traceability summary:** 35 NFRs across 10 categories. Every NFR has a concrete, executable measurement method. Performance NFRs trace to Actuator metrics. Security NFRs trace to integration tests and Docker network configuration. Reliability NFRs trace to CI pipeline. Testability NFRs enforce JaCoCo thresholds and GitHub Actions timeouts. Data integrity verified on every CI run via `LedgerBalanceIntegrityTest`.

### FR ↔ NFR Cross-Reference (Key Connections)

| Functional Requirement                     | Non-Functional Requirement                           | Connection                                                                 |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| FR-01~07, FR-52 (Authentication & Session) | NFR-S1, NFR-S2, NFR-S3, NFR-S7                       | Session cookie security, CSRF enforcement, unauthenticated rejection       |
| FR-01~07 (Authentication)                  | NFR-T1 (Channel ≥ 70% coverage)                      | Auth logic is primary channel test target                                  |
| FR-11~18 (Transfer Initiation & OTP)       | NFR-S5 (OTP TTL ≤ 180s)                              | TTL enforcement is the measurable form of FR-17                            |
| FR-19~25 (Transfer Execution & Ledger)     | NFR-D1 (No negative balance, matched ledger)         | Every executed transfer is a `LedgerBalanceIntegrityTest` data point       |
| FR-43 (Concurrent balance protection)      | NFR-P4 (10 threads ≤ 5s), NFR-P5 (lock ≤ 100ms)      | Concurrency scenario drives both performance and lock NFRs                 |
| FR-44 (Atomic debit+credit)                | NFR-D1, NFR-T2 (CoreBanking ≥ 80%)                   | Atomicity requires high CoreBanking coverage to verify                     |
| FR-26~29, FR-54 (Fault Tolerance)          | NFR-R2 (CB OPEN after 3 failures)                    | FR defines capability; NFR defines Resilience4j configuration measurement  |
| FR-30~32 (SSE Notifications)               | NFR-UX2 (SSE reconnect ≤ 5s)                         | Notification streaming capability requires reconnect SLA                   |
| FR-33~37, FR-50 (Security & Audit)         | NFR-S2, NFR-L1                                       | Audit log correctness requires PII masking + JSON log structure            |
| FR-41~42 (Portfolio & Observability)       | NFR-O1 (Swagger 200), NFR-L1 (JSON logs)             | Observability claims require both API docs and structured log verification |
| FR-51, FR-53 (Admin operations)            | NFR-S6 (Dependabot), NFR-M2 (Architecture Decisions) | Admin endpoints require supply chain security + documented rationale       |
