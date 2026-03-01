# Epic 8: Full System Validation & Acceptance Testing

> **⚠️ Epic Numbering Note**: This supplemental file was numbered from the securities-order domain and corresponds to **Epic 10 in epics.md: Full Validation & Release Readiness**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.


## Summary

Verify that all features implemented in Epics 0~7 work correctly in an integrated environment. 7+1 Acceptance Scenarios must pass CI, JaCoCo threshold met, Position Integrity verified (SUM(BUY) − SUM(SELL) == positions.quantity), Concurrency tests passed, and Docker Compose full-stack smoke test passed. Completion of this Epic = MVP Complete = Ready for GitHub release.

**FRs covered:** (No new features — Validation of existing Epics)  
**NFRs covered:** NFR-R1(7 Scenarios CI), NFR-T1~T7(JaCoCo + Timeout), NFR-D1(Position Integrity), NFR-P4(Concurrency 5s), NFR-P6(Error Response SLA), NFR-S4(Internal Network Isolation)

**Validation Scope:**
- Scenario #1: Standard order E2E → OrderControllerIntegrationTest
- Scenario #2: 10-thread Concurrent Sell (500-share position) → PositionConcurrencyIntegrationTest @Timeout(20)
- Scenario #3: OTP Failure → OrderSessionServiceTest
- Scenario #4: duplicate clOrdID → IdempotencyIntegrationTest
- Scenario #5: FEP timeout → CB OPEN → FepCircuitBreakerIntegrationTest
- Scenario #6: Session Refusal after Logout → AuthControllerIntegrationTest
- Scenario #7: SUM(BUY executed_qty) − SUM(SELL executed_qty) == positions.quantity → PositionIntegrityIntegrationTest
- Scenario #8: Direct Call without X-Internal-Secret → SecurityBoundaryTest

---

## Story 8.1: Acceptance Scenario Suite (7+1)

As a **project maintainer**,  
I want all 7+1 acceptance scenarios to pass in CI on every commit to main,  
So that the system's correctness claims are continuously verified.

**Depends On:** All Epics 1~6 completed, Story 7.3 (README completed)

### Acceptance Criteria

**Given** Scenario #1 (Standard order E2E happy path) — `OrderControllerIntegrationTest`  
**When** `POST /api/v1/orders/sessions` → `POST /api/v1/orders/sessions/{sessionId}/otp/verify` → `POST /api/v1/orders/sessions/{sessionId}/execute` full flow (TOTP 3-phase protocol)  
**Then** `ChannelIntegrationTestBase @BeforeEach` performs login + obtains JSESSIONID cookie  
**And** HTTP 200 COMPLETED, returns `orderId`, verifies DB `order_executions` record (`executed_qty`, `executed_price`) + `positions.quantity` updated (NFR-R1)

**Given** Scenario #3 (OTP failure blocks order) — `OrderSessionOtpIntegrationTest`  
**When** Incorrect OTP entered 3 times  
**Then** Include `@DisplayName("Scenario #3: OTP failure blocks order")` annotation  
**And** Session status `FAILED`, execute call returns HTTP 409 `ORD-006`  
**And** Verify no position change

**Given** Scenario #4a (Same member + Duplicate clOrdID) — `IdempotencyIntegrationTest.SameMemberIdempotency`  
**When** Same member attempts session creation twice with same `clOrdID`  
**Then** 2nd request HTTP 200 — Returns existing sessionId (Idempotent)  
**And** Only 1 session record in DB

**Given** Scenario #4b (Different member + Duplicate clOrdID) — `IdempotencyIntegrationTest.CrossMemberSecurity`  
**When** Different member attempts session creation using another's `clOrdID`  
**Then** HTTP 403 `{ code: "AUTH-007" }` (Security Boundary)  
**And** Only 1 session record in DB

**Given** Scenario #5 (FEP timeout → CB OPEN) — `FepCircuitBreakerIntegrationTest`  
**When** WireMock FEP stub timeouts 3 times  
**Then** 4th call verifies WireMock not called + Verify CB state `OPEN`

**Given** Scenario #6 (Session invalidated after logout) — `AuthControllerIntegrationTest`  
**When** Call protected API with same JSESSIONID after logout  
**Then** HTTP 401 `UNAUTHORIZED` (Verify Redis Spring Session key deletion)

**Given** Scenario #7 (Position Integrity) — `PositionIntegrityIntegrationTest` (corebank-service integration test)  
**When** N sequential orders executed across multiple symbols + M compensating reversals  
**Then** `SUM(order_executions.executed_qty WHERE side='BUY') − SUM(order_executions.executed_qty WHERE side='SELL') == positions.quantity` per symbol (NFR-D1)  
**And** `positions.quantity >= 0` invariant holds for all symbols (no over-sell)  
**And** Verify all `order_executions.order_id` IS NOT NULL and references an `orders` record with `orders.status = 'FILLED'` (JOIN verification: no execution record is orphaned from a FILLED order)  
**And** Execute in `ci-corebank.yml`

**Given** Scenario #8 (Security boundary) — `SecurityBoundaryTest (@Nested)`  
**When** Direct call to `corebank-service:8081/internal/v1/**` without X-Internal-Secret header  
**Then** HTTP 403

**Given** `ci.yml` GitHub Actions (NFR-R1)  
**When** `push main` / `pull_request → main`  
**Then** PR merge allowed only if all 7+1 scenarios pass  
**And** JaCoCo threshold check — `main` branch only condition:
```yaml
- name: Check JaCoCo Coverage
  if: github.ref == 'refs/heads/main'
  run: ./gradlew jacocoTestCoverageVerification
```
**And** New `@Tag("concurrency")` — Concurrency correctness test (Blocking execution on PR + main)  
**And** Separate `@Tag("slow")` tests into distinct CI step:
```yaml
- name: Run slow tests
  if: github.ref == 'refs/heads/main'
  run: ./gradlew test -Pgroups=slow
```
**And** Include `@DisplayName("Scenario #N: ...")` annotation in each scenario test class

**Given** `ci-channel.yml`, `ci-corebank.yml`, `ci-fep.yml`, `ci-frontend.yml` (4 workflows)  
**When** Push changes to each service  
**Then** Run CI only for that service in parallel  
**And** JaCoCo Reports: channel ≥ 70% (NFR-T1), corebank ≥ 80% (NFR-T2), fep ≥ 60% (NFR-T3)

---

## Story 8.2: Performance & Concurrency Validation

As a **system**,  
I want concurrent order attempts to complete without deadlock or data corruption,  
So that the pessimistic locking strategy is proven under load.

**Depends On:** Story 4.1 (PESSIMISTIC_WRITE), Story 8.1

### Acceptance Criteria

**Given** `PositionConcurrencyIntegrationTest` (Testcontainers MySQL — Scenario #2)  
**When** 10 threads concurrently attempt SELL of 100qty each on symbol 005930 (500-share position) using `ExecutorService` + `CountDownLatch`  
**Then** Include `@DisplayName("Scenario #2: Concurrent sell — PESSIMISTIC_WRITE position integrity")` annotation  
**And** Apply `@Tag("concurrency")`  
**And** Exactly 5 orders `FILLED`, remaining 5 OrderSession `FAILED` (HTTP 422 ORD-003 Insufficient position qty — SELL qty check before INSERT; no order record created)  
**And** `positions.quantity == 0` after all threads complete (NFR-D1: no over-sell)  
**And** `SUM(order_executions.executed_qty WHERE side='SELL') == 500` — exactly 500 shares sold  
**And** Total execution time ≤ 20s (Generous for 2-core CI runner) — Apply `@Timeout(20)` annotation

**Given** p95 Response Time Validation  
**When** Measure Account List query after 50 warm-up calls  
**Then** Apply `@Tag("perf")` — `main` branch only  
**And** p95 ≤ 500ms (NFR-P1)

**Given** Error Response (4xx, 5xx) SLA Measurement  
**When** Measure 50 invalid login attempts (`@Tag("perf")`)  
**Then** p95 ≤ 500ms (NFR-P6)

**Given** `@Lock PESSIMISTIC_WRITE` lock hold time measurement test  
**When** Measure execution time of single order  
**Then** Measure using `StopWatch`:
```java
StopWatch sw = new StopWatch();
sw.start();
orderService.executeOrder(sessionId, memberId);
sw.stop();
log.info("Lock hold time: {}ms", sw.getTotalTimeMillis());
assertThat(sw.getTotalTimeMillis()).isLessThan(100);
```
**And** Verify lock hold time ≤ 100ms (NFR-P5)

---

## Story 8.3: Docker Integration & Final Polish

As a **developer**,  
I want the full Docker Compose stack to pass smoke tests and the README to be demo-ready,  
So that any interviewer can verify the system within 5 minutes of cloning the repository.

**Depends On:** Story 8.1, Story 7.3

### Acceptance Criteria

**Given** `docker compose up` (using `.env.example` based `.env`)  
**When** Startup within 120s (NFR-P3 — Increased 90s → 120s due to Vault + vault-init addition)  
**Then** `GET localhost:8080/actuator/health` → `{"status":"UP"}` (channel-service)  
**And** `GET localhost:8081/actuator/health` → `{"status":"UP"}` (corebank-service)  
**And** `GET localhost:8082/actuator/health` → `{"status":"UP"}` (fep-simulator)  
**And** `GET localhost:8080/swagger-ui.html` → HTTP 200 (NFR-O1)

**Given** Docker Compose Port Exposure Structure  
**When** Check `compose.yml` (base)  
**Then** `corebank-service`, `fep-simulator`, `vault` services have **NO** `ports:` section — No direct external access  
**And** Dev ports (`8081:8081`, `8082:8082`, `8200:8200`) opened only in `docker-compose.override.yml`  
**And** CI Environment: `docker compose -f compose.yml up` (without override) — No internal service exposure

**Given** Docker Compose Network Isolation Verification  
**When** `curl localhost:8081` from host (base compose without override)  
**Then** Connection refused (NFR-S4 — Internal service isolation)

**Given** JSON Log Parsing Verification  
**When** Run `docker compose logs channel-service | head -5 | python3 -c "import sys,json; [json.loads(l) for l in sys.stdin]"`  
**Then** JSON parsing succeeds without error (NFR-L1)  
**And** Windows alternative (`jq`):
```bash
docker compose logs channel-service | head -5 | jq -R 'fromjson?' | jq -s '. | length'
```

**Given** Seed Data Verification  
**When** Login test after `docker compose up`  
**Then** `POST /api/v1/auth/login` with `{ email: "user@fix.com", password: "Test1234!" }` → HTTP 200  
**And** `POST /api/v1/auth/login` with `{ email: "admin@fix.com", password: "Admin1234!" }` → HTTP 200

**Given** 5 Concurrent User Sessions Simulation (NFR-SC1)  
**When** Concurrent login from 5 independent browser/curl sessions  
**Then** All issue independent session cookies, each account query returns normal response

**Given** Dependabot Configuration (NFR-S6)  
**When** Check `.github/dependabot.yml`  
**Then** Gradle + pnpm dependency auto-update config exists  
**And** `dependencyCheckAnalyze` — separated into weekly scheduled workflow:
```yaml
# .github/workflows/security-scan.yml
schedule:
  - cron: '0 2 * * 0'   # Every Sunday 02:00 UTC
```
**And** Verify `main` branch has no dependencies with CVSS ≥ 7.0

**Given** README Quick Start Final Review  
**When** Execute steps in fresh clone environment  
**Then** Verify full stack startup with only 3 commands  
**And** Login credentials (`user@fix.com / Test1234!`) explicitly stated in README  
**And** 5-minute Verification Checklist:
```
□ docker compose up (Complete < 2min)
□ localhost:8080/swagger-ui.html → HTTP 200
□ Login → Order → SSE Notification Receive (Complete < 2min)
□ PUT localhost:8082/fep-internal/rules (body: {"action_type":"TIMEOUT","delay_ms":3000,"failure_rate":0.0}) → trigger order 3회 via localhost:8080 → GET localhost:8081/actuator/circuitbreakers → verify state="OPEN" (< 1min)
```
