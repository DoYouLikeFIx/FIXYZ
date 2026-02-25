# Epic 3: Fault Tolerance & FEP Resilience

## Summary

When the external FEP interface fails repeatedly, Resilience4j Circuit Breaker automatically opens to protect core banking. FepChaosController allows runtime control of failure scenarios (delay, failure rate, mode). Scenario #5 (CB OPEN after 3 failures) passes.

**FRs covered:** FR-26, FR-28, FR-29  
**FR-27 reclassification:** FR-27 (automatic retry) is covered by `TransferSessionRecoveryService` (responsible for distributed retry) instead of `FepClient` `@Retry`. See [ADR-FEP-RETRY-001]  
**Architecture requirements:** FepClient(@CircuitBreaker, **no-Retry**), Resilience4j settings (slidingWindow=3), FepSimulatorService([SIMULATION]), FepChaosController(PUT /fep-internal/config, POST /fep-internal/simulate-failures), FepChaosConfig, FepIntegrationTestBase

> **[ADR-FEP-RETRY-001] Decision not to apply FepClient Retry**  
> **Decision:** `@Retry` not applied to `FepClient`. FR-27 (automatic retry) is covered by `TransferSessionRecoveryService`.  
> **Rationale:** When `@Retry` is nested inside `@CircuitBreaker`, with `maxAttempts: 2`, a single execute request is recorded as 2 failures in the CB sliding window → breaking the determinism of Scenario #5 conditions.

> **[ADR-CB-INTERNAL-001] Circuit Breaker not applied to CoreBankClient**  
> **Decision:** Circuit Breaker and Retry are not applied to the `channel-service → corebank-service` path.  
> **Rationale:** Since this is internal communication within the same Docker Compose network, corebank connection failures are handled at the infrastructure level. TransferSession FSM + RecoveryScheduler handles EXECUTING timeouts.

---

## Story 3.1: FEP Simulator — Service & Chaos Controller

As a **developer**,  
I want the FEP simulator to support runtime chaos configuration (delay, failure mode, failure rate),  
So that I can demonstrate circuit breaker behavior during interviews without code changes.

**Depends On:** Story 0.1 (FEP Service Startup)

### Acceptance Criteria

**Given** `POST /fep/v1/interbank/transfer` with `{ fromBankCode, toBankCode, toAccountNumber, amount, referenceId }`  
**When** `FepSimulatorService` processes (chaos config OFF)  
**Then** HTTP 200: `{ status: "ACCEPTED", fepReferenceId: UUID, processedAt: ISO8601 }`  
**And** if `referenceId` is a non-existent transferId: `{ status: "REJECTED", reason: "INVALID_ACCOUNT" }` (simulation)  
**And** requests without `X-Internal-Secret` header → HTTP 403 (NFR-S4)

**Given** `PUT /fep-internal/config` with `{ mode: "TIMEOUT", delayMs: 3000, failureRate: 0.0 }` (ROLE_ADMIN)  
**When** chaos config applied  
**Then** subsequent `POST /fep/v1/interbank/transfer` requests delayed by `delayMs` then `ReadTimeoutException` occurs  
**And** HTTP 200: `{ mode: "TIMEOUT", delayMs: 3000, failureRate: 0.0 }`

**Given** `PUT /fep-internal/config` with `{ mode: "FAILURE", failureRate: 1.0 }`  
**When** chaos config applied  
**Then** all subsequent requests return HTTP 500 `{ status: "SYSTEM_ERROR" }`

**Given** `PUT /fep-internal/config` with `{ mode: "NORMAL" }`  
**When** normal recovery config  
**Then** chaos disabled, normal responses resume

**Given** `GET /fep-internal/config`  
**When** current chaos config queried  
**Then** HTTP 200: `{ mode, delayMs, failureRate }` current config values returned (FR-29)

**Given** `GET /fep/v1/transfer/{referenceId}/status` (Story 4.3 recovery scheduler integration)  
**When** Story 4.3 `TransferSessionRecoveryService` re-queries FEP status  
**Then** if `referenceId` was previously processed successfully in FEP Simulator → `{ referenceId, status: "ACCEPTED", processedAt }` returned  
**And** if `referenceId` does not exist in FEP → `{ referenceId, status: "UNKNOWN" }` returned (HTTP 200 — recovery scheduler checks shape in branch logic)  
**And** only requests with `X-Internal-Secret` header allowed  
**And** `Map<String, FepTransactionRecord> processedTransfers` stored internally in `FepSimulatorService` (ConcurrentHashMap)

**Given** `POST /fep-internal/simulate-failures?count={N}` (demo convenience)  
**When** CB demonstration needs to be quickly prepared during demo  
**Then** `FEP Simulator` internally simulates N dummy `FepRequest` failures, injecting N failures into CB sliding window  
**And** if `N ≥ slidingWindowSize(3)`, CB enters `OPEN` state immediately after call  
**And** requests without `X-Internal-Secret` header → HTTP 403  
**And** `@Operation(hidden = true)` — not exposed in Swagger  
**And** HTTP 200: `{ injectedFailures: N, circuitBreakerState: "OPEN|CLOSED" }`  
**And** FAILURE mode temporarily applied via `try-finally` block and **must be restored**  
**And** dummy request `referenceId` generated as `"sim-dummy-{UUID}"` format → not recorded in `processedTransfers` map

> **[Design Note]** `processedTransfers` is stored in application memory (ConcurrentHashMap). When `FepSimulator` restarts, the map is cleared and the recovery scheduler may receive UNKNOWN and execute compensating credits. This is an acceptable trade-off within portfolio scope — in actual production, persist in Redis or DB.

**Given** `FepIntegrationTestBase` (SpringBootTest + WireMock)  
**When** FEP simulator integration test  
**Then** NORMAL, TIMEOUT, FAILURE mode switching and response verification pass  
**And** `GET /fep/v1/transfer/{referenceId}/status` — ACCEPTED/UNKNOWN response verification  
**And** `POST /fep-internal/simulate-failures?count=3` → CB OPEN state verification

---

## Story 3.2: Circuit Breaker — Resilience4j Integration

As a **backend system**,  
I want the circuit breaker to open automatically after 3 consecutive FEP failures,  
So that corebank-service is protected from cascading FEP outages.

**Depends On:** Story 3.1, Story 0.1

### Acceptance Criteria

**Given** `FepClient` bean declared with `@CircuitBreaker(name = "fep", fallbackMethod = "fepFallback")` (**`@Retry` not applied** — [ADR-FEP-RETRY-001])  
**When** `InterbankTransferService.send()` called  
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

**Given** FEP chaos config `mode: TIMEOUT` (ReadTimeoutException occurs)  
**When** `InterbankTransferService.send()` called 3 consecutive times (all timeout)  
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
