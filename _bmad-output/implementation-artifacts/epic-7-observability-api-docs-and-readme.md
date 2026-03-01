# Epic 7: Observability, API Docs & README

> **⚠️ Epic Numbering Note**: This supplemental file was numbered from the securities-order domain and corresponds to **Epic 8 in epics.md: Cross-system Security, Audit, Observability (partial)**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.


## Summary

Swagger UI documents all Channel APIs, X-Correlation-Id propagates through logs of all 3 services, and structured JSON logs allow request chain reconstruction. README provides immediate answers for two interview tracks (Banking/FinTech).

**FRs covered:** FR-40, FR-42, FR-53  
**NFRs covered:** NFR-O1(Swagger 200), NFR-L1(JSON Logs), NFR-M2(README ADR), NFR-M3(API Docs), NFR-M4(Env Externalization)  
**Architecture requirements:** springdoc-openapi SwaggerConfig, logback-spring.xml(JSON + MDC), X-Correlation-Id propagation chain(CorrelationIdFilter→CoreBankClient/FepClient→InternalSecretFilter), Actuator endpoint exposure

---

## Story 7.1: Swagger & OpenAPI Documentation

As a **developer or interviewer**,  
I want interactive API documentation at `/swagger-ui.html` covering all Channel Service endpoints,  
So that I can explore and verify the API without reading source code.

**Depends On:** Story 1.2, Story 2.1 (Controller implementation done)

### Acceptance Criteria

**Given** `GET /swagger-ui.html` (after channel-service startup)  
**When** requested  
**Then** HTTP 200 returned (NFR-O1)  
**And** accessible without authentication (`SecurityConfig.permitAll()`)

**Given** `SwaggerConfig @Configuration`  
**When** config checked  
**Then** dependency: `implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.x'` (Spring Boot 3.x required)  
**And** `springdoc.paths-to-exclude=/actuator/**` set — Actuator endpoints excluded from Swagger  
**And** `OpenAPI` bean definition: title "FIX Channel Service API", version "v1", contact info  
**And** `SecurityScheme` definition: Bearer Token (JWT) auth scheme included  
**And** `springdoc.swagger-ui.operations-sorter: method` set

**Given** All `@RestController` methods  
**When** code review  
**Then** each method includes `@Operation(summary = "...", description = "...", tags = {...})` annotation (NFR-M3, FR-40)  
**And** request/response DTOs include `@Schema(description = "...")` annotation  
**And** error response codes documented via `@ApiResponse` (400, 401, 403, 422, 500)

**Given** `GET /v3/api-docs`  
**When** requested  
**Then** HTTP 200 JSON format OpenAPI 3.0 spec returned  
**And** verification includes all `/api/v1/**` endpoints

**Given** `GET /swagger-ui.html` (after fep-service startup)  
**When** requested  
**Then** HTTP 200 (NFR-O1 — fep-service also provides Swagger)  
**And** documents `/fep/v1/**` and `/fep-internal/**` endpoints

---

## Story 7.2: Structured Logging & Distributed Trace Propagation

As a **developer**,  
I want all services to emit JSON-format logs with traceId and correlationId fields,  
So that a complete request chain can be reconstructed from logs across services.

**Depends On:** Story 0.1 (Service startup)

### Acceptance Criteria

**Given** `logback-spring.xml` config (for all 3 services)  
**When** service startup  
**Then** JSON format log output via `logstash-logback-encoder`  
**And** each log line is valid JSON with fields: `timestamp, level, logger, message, traceId, correlationId, memberId`

**Given** React App → Channel Service (Login request)  
**When** `JwtAuthenticationFilter` processes  
**Then** if `X-Correlation-Id` header missing, generate new UUID; else reuse existing  
**And** inject `correlationId` into MDC  
**And** include `X-Correlation-Id: {UUID}` in response header

**Given** Channel Service → CoreBank call (`RestClient`)  
**When** sending request  
**Then** propagate `X-Correlation-Id` header (FR-42)  
**And** CoreBank `InternalSecretFilter` receives `X-Correlation-Id` → injects into MDC

**Given** CoreBank → FEP call (`FepClient`)  
**When** sending request  
**Then** `FepClient` (`RestClient`) `ClientHttpRequestInterceptor` registered — extracts correlationId from MDC and auto-injects `X-Correlation-Id` header  
**And** `FepClientConfig @Bean`: `RestClient.builder().requestInterceptor(correlationIdInterceptor())` applied

**Given** Full request chain log query (same `correlationId`)  
**When** grep logs across 3 services  
**Then** entire request chain reconstructable using same `correlationId` (NFR-L1)

**Given** `CorrelationIdPropagationTest` (Integration Test)  
**When** execute E2E order request  
**Then** Verify headers in Channel → CoreBank WireMock:
```java
channelWireMock.verify(postRequestedFor(urlEqualTo("/internal/v1/orders"))
    .withHeader("X-Correlation-Id", matching("[a-f0-9\\-]{36}")));
fepWireMock.verify(postRequestedFor(urlEqualTo("/fep/v1/orders"))
    .withHeader("X-Correlation-Id", matching("[a-f0-9\\-]{36}")));
```
**And** verify same `correlationId` UUID propagated 3-hops (Channel → CoreBank → FEP)

---

## Story 7.3: README & Portfolio Documentation

As an **interviewer or developer**,  
I want the README to answer the first 3 technical questions within the first screen,  
So that I can evaluate the project's depth without asking.

**Depends On:** Story 8.3 (Final review)

### Acceptance Criteria

**Given** GitHub Repository README.md (top)  
**When** First screen (above the fold)  
**Then** Display CI badges (`ci-channel`, `ci-corebank`, `ci-fep`, `ci-frontend`), JaCoCo coverage badge  
**And** Architecture Diagram (Mermaid) — Channel:8080, CoreBanking:8081, FEP:8082, MySQL, Redis relationships  
**And** Quick Start 3-command section:
```bash
cp .env.example .env
docker compose up
# → Access localhost:8080
```

**Given** Bank Interviewer Track section (README)  
**When** Reading  
**Then** "Why Pessimistic Lock?" → Summary of ADR-001 + interview speaking points  
**And** "How does OTP work?" → Explanation of simulation boundary (TOTP RFC 6238 via Google Authenticator vs production HSM-backed token device; secret replaceability via Vault)  
**And** "Position Integrity?" → Link to Scenario #7 (SUM(BUY executed_qty) − SUM(SELL executed_qty) == positions.quantity)  
**And** 5-minute Demo Script:
```bash
# 1. Normal Order
curl -X POST .../auth/login → Get JSESSIONID
curl -X POST .../orders/sessions → sessionId
curl -X POST .../otp/verify (Valid TOTP)
curl -X POST .../execute → COMPLETED
# 2. OTP Failure x3 → FAILED
curl -X POST .../otp/verify (Wrong Code) ×3 → AUTH-005
# 3. Admin Session Invalidation
curl -X DELETE .../admin/members/{memberId}/sessions (admin@fix.com)
```

**Given** FinTech Interviewer Track section (README)  
**When** Reading  
**Then** Link to Swagger UI (`localhost:8080/swagger-ui.html`)  
**And** DevTools verification guide: Network tab → Check `EventStream`  
**And** Actuator Circuit Breaker Demo Script:
```bash
# Step 1: Configure FEP Simulator → TIMEOUT mode (all FEP calls will timeout after 3000ms)
curl -X PUT "http://localhost:8082/fep-internal/rules" \
     -H "Content-Type: application/json" \
     -d '{"action_type":"TIMEOUT","delay_ms":3000,"failure_rate":1.0}'
# Step 2: Trigger 3 order executions via FIX web UI (or via channel-service execute endpoint)
#         Each will ReadTimeoutException → Resilience4j records failure; slidingWindowSize=3
#         After 3rd failure: CB transitions CLOSED → OPEN
# Step 3: Check CB State (corebank-service — Resilience4j @CircuitBreaker(name="fep") lives here)
curl http://localhost:8081/actuator/circuitbreakers
# → confirm fep.state: "OPEN"
# Step 4: Restore FEP Simulator to normal
curl -X PUT "http://localhost:8082/fep-internal/rules" \
     -H "Content-Type: application/json" \
     -d '{"action_type":"IGNORE","delay_ms":0,"failure_rate":0.0}'
```

**Given** ADR File Organization  
**When** `docs/adr/` directory created  
**Then** Write each ADR as separate file: `docs/adr/ADR-001-pessimistic-lock.md`, `ADR-TOTP-SEC-001.md`, `ADR-FEP-RETRY-001.md`, `ADR-CB-INTERNAL-001.md`, `ADR-SSE-REGISTRY-001.md`  
**And** ADR File Format: `# Title / ## Status / ## Context / ## Decision / ## Consequences`  
**And** Direct links to each file in README ADR Index

**Given** README Quick Start Vault Guide  
**When** after `docker compose up`  
**Then** Explicitly state Vault UI access: `http://localhost:8200` → Token: `root-token`  
**And** Guide for manual seed user TOTP registration:
```
otpauth://totp/FIX:user%40fix.com?secret=JBSWY3DPEHPK3PXP&issuer=FIX
```
**And** Windows compatibility commands:
```bash
# Linux/Mac
cp .env.example .env
# Windows PowerShell
Copy-Item .env.example .env
```

**Given** CONTRIBUTING.md  
**When** Checked  
**Then** Conventional Commits format, Branch naming (`feat/`, `fix/`, `test/`), PR Merge Strategy (Squash merge) defined
