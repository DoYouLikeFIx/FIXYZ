# Epic 3: Fault Tolerance & FEP Resilience

> **⚠️ Epic Numbering Note**: This supplemental file was numbered from the securities-order domain and corresponds to **Epic 6 in epics.md: External Resilience, Chaos, Replay/Recovery Ops**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.


## Summary

When the external FEP interface fails repeatedly, Resilience4j Circuit Breaker automatically opens to protect core banking. FepChaosController allows runtime control of failure scenarios (delay, failure rate, mode). Scenario #5 (CB OPEN after 3 failures) passes.

**FRs covered:** FR-26, FR-28, FR-29  
**FR-27 reclassification:** FR-27 (automatic retry) is covered by `OrderSessionRecoveryService` (responsible for distributed retry) instead of `FepClient` `@Retry`. See [ADR-FEP-RETRY-001]  
**Architecture requirements:** FepClient(@CircuitBreaker, **no-Retry**), Resilience4j settings (slidingWindow=3), FepSimulatorService([SIMULATION]), FepChaosController(PUT /fep-internal/rules), FepChaosConfig, FepIntegrationTestBase

> **[ADR-FEP-RETRY-001] Decision not to apply FepClient Retry**  
> **Decision:** `@Retry` not applied to `FepClient`. FR-27 (automatic retry) is covered by `OrderSessionRecoveryService`.  
> **Rationale:** When `@Retry` is nested inside `@CircuitBreaker`, with `maxAttempts: 2`, a single execute request is recorded as 2 failures in the CB sliding window → breaking the determinism of Scenario #5 conditions.

> **[ADR-CB-INTERNAL-001] Circuit Breaker not applied to CoreBankClient**  
> **Decision:** Circuit Breaker and Retry are not applied to the `channel-service → corebank-service` path.  
> **Rationale:** Since this is internal communication within the same Docker Compose network, corebank connection failures are handled at the infrastructure level. OrderSession FSM + RecoveryScheduler handles EXECUTING timeouts.

---

## Story 3.1: FEP Simulator — Service & Chaos Controller

As a **developer**,  
I want the FEP simulator to support runtime chaos configuration (delay, failure mode, failure rate),  
So that I can demonstrate circuit breaker behavior during interviews without code changes.

**Depends On:** Story 0.1 (FEP Gateway/FEP Simulator Startup)

### Acceptance Criteria

**Given** `POST /fep/v1/orders` with `{ clOrdID, symbol, side, qty, price }`  
**When** `FepSimulatorService` processes (chaos config OFF)  
**Then** HTTP 200: `{ status: "ACCEPTED", clOrdID: UUID, processedAt: ISO8601 }`  
**And** if `clOrdID` is a non-existent orderId: `{ status: "REJECTED", reason: "INVALID_ACCOUNT" }` (simulation)  
**And** requests without `X-Internal-Secret` header → HTTP 403 (NFR-S4)

**Given** `PUT /fep-internal/rules` with `{ action_type: "TIMEOUT", delay_ms: 3000, failure_rate: 0.0 }` (ROLE_ADMIN)  
**When** chaos config applied  
**Then** subsequent `POST /fep/v1/orders` requests delayed by `delay_ms` then `ReadTimeoutException` occurs  
**And** HTTP 200: `{ action_type: "TIMEOUT", delay_ms: 3000, failure_rate: 0.0 }`

**Given** `PUT /fep-internal/rules` with `{ action_type: "REJECT", failure_rate: 1.0 }`  
**When** chaos config applied  
**Then** all subsequent requests return HTTP 200 `{ status: "REJECTED", reason: "EXCHANGE_REFUSED" }`

**Given** `PUT /fep-internal/rules` with `{ action_type: "IGNORE", delay_ms: 0, failure_rate: 0 }`  
**When** normal recovery config  
**Then** chaos disabled, normal responses resume

**Given** `GET /fep-internal/rules`  
**When** current chaos config queried  
**Then** HTTP 200: `{ action_type, delay_ms, failure_rate }` current config values returned (FR-29)

**Given** `GET /fep/v1/orders/{clOrdID}/status` (Story 4.3 recovery scheduler integration)  
**When** Story 4.3 `OrderSessionRecoveryService` re-queries FEP status  
**Then** if `clOrdID` was previously processed successfully in FEP Simulator → `{ clOrdID, status: "ACCEPTED", processedAt }` returned  
**And** if `clOrdID` does not exist in FEP → `{ clOrdID, status: "UNKNOWN" }` returned (HTTP 200 — recovery scheduler checks shape in branch logic)  
**And** only requests with `X-Internal-Secret` header allowed  
**And** `Map<String, FepOrderRecord> processedOrders` stored internally in `FepSimulatorService` (ConcurrentHashMap)

**Note:** CB OPEN is triggered by 3 actual TIMEOUT failures through corebank-service's `FepClient`. The FEP chaos endpoint (`PUT /fep-internal/rules { action_type: "TIMEOUT", delay_ms: 3000 }`) sets the simulator into TIMEOUT mode; executing 3 orders causes Resilience4j to exhaust `slidingWindowSize=3` and transition `CLOSED → OPEN`.

> **[Design Note]** `processedOrders` is stored in application memory (ConcurrentHashMap). When `FepSimulator` restarts, the map is cleared and the recovery scheduler may receive UNKNOWN and execute compensating reversals. This is an acceptable trade-off within portfolio scope — in actual production, persist in Redis or DB.

**Given** `FepIntegrationTestBase` (SpringBootTest + WireMock)  
**When** FEP simulator integration test  
**Then** IGNORE, TIMEOUT, REJECT mode switching and response verification pass  
**And** `GET /fep/v1/orders/{clOrdID}/status` — ACCEPTED/UNKNOWN response verification  
**And** `PUT /fep-internal/rules` TIMEOUT mode + 3 WireMock timeout stubs via FEP → CB OPEN state verification

---

## Story 3.2: Circuit Breaker — Resilience4j Integration

As a **backend system**,  
I want the circuit breaker to open automatically after 3 consecutive FEP failures,  
So that corebank-service is protected from cascading FEP outages.

**Depends On:** Story 3.1, Story 0.1

### Acceptance Criteria

**Given** `FepClient` bean declared with `@CircuitBreaker(name = "fep", fallbackMethod = "fepFallback")` (**`@Retry` not applied** — [ADR-FEP-RETRY-001])  
**When** `FepOrderService.send()` called  
**Then** `FepClient` confirmed to be invoked via Spring AOP proxy  
**And** confirmed that `resilience4j.retry` setting is absent from `application.yml`

**Given** `application.yml` Resilience4j configuration  
**When** config file confirmed  
**Then** the following values are exactly set:
```yaml
resilience4j.circuitbreaker.instances.fep:
  slidingWindowType: COUNT_BASED
  slidingWindowSize: 3
  failureRateThreshold: 100
  waitDurationInOpenState: 10s
  permittedNumberOfCallsInHalfOpenState: 1
  registerHealthIndicator: true
```

**Given** FEP chaos config `action_type: "TIMEOUT"` (ReadTimeoutException occurs)  
**When** `FepOrderService.send()` called 3 consecutive times (all timeout)  
**Then** after 3rd failure, CB state transitions `CLOSED → OPEN`  
**And** 4th call is not forwarded to FEP, fallback immediately executed (FR-26)  
**And** fallback: `{ status: "CIRCUIT_OPEN", reason: "FEP_UNAVAILABLE" }` returned

**Given** `waitDurationInOpenState` (10s) elapsed in CB OPEN state  
**When** next request  
**Then** CB transitions to `HALF_OPEN` → 1 test request forwarded to FEP  
**And** on success, recovers to `CLOSED`; on failure, back to `OPEN`

**Given** `GET /actuator/circuitbreakers`  
**When** CB state queried  
**Then** HTTP 200: `{ circuitBreakers: [{ name: "fep", state: "OPEN|CLOSED|HALF_OPEN", failureRate: N }] }` (FR-28)  
**And** accessible without authentication (`permitAll()` — for demo screenshare)

**Given** `application-test.yml` Resilience4j test profile override  
**When** `@SpringBootTest` + `@ActiveProfiles("test")` environment  
**Then** `waitDurationInOpenState: 1s` — reduced from 10s → 1s in test environment

**Given** `FepCircuitBreakerIntegrationTest` (Testcontainers + WireMock for FEP stub)  
**When** Scenario #5 CB OPEN test runs  
**Then** WireMock returns 3 consecutive timeout stubs  
**And** CB `OPEN` state entry verified (Actuator API or `CircuitBreakerRegistry`)  
**And** confirmed that FEP WireMock stub is not called on 4th call (verify 0 invocations)

**Given** CB OPEN → HALF_OPEN → CLOSED recovery path test  
**When** `Thread.sleep(1100)` wait after CB OPEN (based on `waitDurationInOpenState: 1s` override)  
**Then** CB `HALF_OPEN` transition verified  
**And** WireMock FEP stub switched to normal response, 1 request after → CB `CLOSED` recovery verified

**Given** `GET /actuator/health` on channel-service  
**When** CB OPEN state  
**Then** `components.fep.status: "CIRCUIT_OPEN"` included (health indicator registered)
