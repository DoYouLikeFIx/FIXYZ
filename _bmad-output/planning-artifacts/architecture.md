---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-23'
revision: 4
lastRevised: '2026-02-23'
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/planning-artifacts/plan.md"
workflowType: "architecture"
project_name: "FIX"
user_name: "yeongjae"
date: "2026-02-23"
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

Six capability domains, all implemented in `channel-service` unless noted:

| Domain        | Key Capabilities                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| Auth          | Login/logout, Redis session externalization, forced session invalidation (admin), session TTL enforcement             |
| Portfolio     | Authenticated position list with masked account numbers, available cash, position detail per symbol                   |
| Orders        | 3-phase state machine: Prepare → OTP Verify → Execute; Order Book matching (CoreBanking); FEP Gateway routing (FIX 4.2) |
| Notification  | SSE `EventSource` stream — order execution results, position updates, security alerts; session-expiry push event      |
| Admin         | Force-logout (Redis bulk purge), audit log query (`ROLE_ADMIN` only)                                                  |
| Observability | Structured JSON logs, W3C `traceparent` propagation, Actuator metrics/circuit breaker exposure                        |

7 non-negotiable acceptance scenarios drive CI gate:

1. Stock order E2E happy path (Buy → Order Book → FEP FILLED)
2. Concurrent sell (10 threads × 100 shares on 500-share position) → exactly 5 FILLED, available_qty = 0
3. OTP failure blocks order execution
4. Duplicate `ClOrdID` → idempotent result
5. FEP timeout → circuit breaker OPEN after 3 failures
6. Session invalidated after logout → 401 on next call
7. SUM(BUY executed_qty) − SUM(SELL executed_qty) == positions.quantity after N executions

**Test Layer Mapping (Architectural Constraint — prevents false-green mock tests):**

| Scenario                              | Test Layer                                            | Rationale                                               |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| #1 E2E happy path                     | `@SpringBootTest` + MockMvc + Testcontainers          | Full channel→core→fep-gateway→fep-simulator wiring required |
| #2 Concurrent sell (10 threads)       | Testcontainers + `ExecutorService` + `CountDownLatch` | Real InnoDB `select ... for update` on position row     |
| #3 OTP failure blocks                 | Unit test, `OrderSessionService`                      | Pure state machine logic, no I/O                        |
| #4 ClOrdID idempotency                | Integration, real MySQL                               | `UNIQUE INDEX` behavior requires real engine            |
| #5 Circuit breaker OPEN               | Integration + WireMock/FEP stub                       | Resilience4j sliding window config validation           |
| #6 Session invalidated                | Integration, real Redis                               | Key deletion + `SETNX` behaviour requires real Redis    |
| #7 SUM(BUY)−SUM(SELL)==positions.quantity | Testcontainers, N-execution loop                      | Position integrity requires real InnoDB transactions    |

**Non-Functional Requirements:**

| NFR Category                | Requirement                                                                              | Architectural Impact                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Concurrency                 | `SELECT FOR UPDATE` on position writes                                                   | Pessimistic lock on position entity (EAGER mode); QueryDSL daily-sell-limit runs inside lock scope   |
| Concurrent session race     | `AUTHED→EXECUTING` state transition must be atomic                                       | Redis `SET ch:txn-lock:{sessionId} NX EX 30` before CoreBanking call; `NX` failure → `CORE-003`      |
| Security                    | HttpOnly + Secure + SameSite cookie, CSRF Double Submit Cookie, PII masking, step-up OTP | Spring Security + `CookieCsrfTokenRepository` (`XSRF-TOKEN` → `X-XSRF-TOKEN`) + `AccountNumber.masked()` in `channel-common`  |
| Resilience                  | Circuit breaker OPEN after 3 FEP timeouts (Resilience4j `slidingWindowSize=3`); compensating position reversal on post-commit failure | **단일 CB 레이어**: Resilience4j `@CircuitBreaker(name="fep")` on `FepClient` in **corebank-service** — `slidingWindowSize=3`, `failureRateThreshold=100`, `waitDurationInOpenState=10s`. CB OPEN preemptive: no `@Transactional`, no order record, no position change. Post-commit FEP failure: compensating position reversal via `OrderSessionRecoveryService` (corebank-service-owned). CB state: `localhost:8081/actuator/circuitbreakers` |
| Idempotency                 | `ClOrdID` UNIQUE at DB level                                                             | `UNIQUE INDEX idx_clordid (cl_ord_id)` in `core_db.orders`                                          |
| Observability (Demo)        | Actuator selectively exposed for screenshare demo                                        | `circuitbreakers` + `health` endpoints accessible without auth; FEP chaos endpoint robustly designed |
| Rate Limiting               | Login: 5 req/min/IP; OTP: 3/session; Order Prepare: 10 req/min/userId                   | Bucket4j + Redis-backed `Filter` on 3 endpoints only                                                |
| Test Coverage               | CoreBanking ≥ 80%, Channel ≥ 70%, FEP Gateway ≥ 60%, FEP Simulator ≥ 60%                 | JaCoCo in Gradle; real MySQL + Redis via Testcontainers (H2 disqualified for runtime/integration, OpenAPI generation-only profile exception) |
| Cold Start (Demo Guarantee) | `docker compose up` → first API call ≤ 120s (Vault + vault-init initialization accounts for extended window vs. non-Vault baseline) | `depends_on: condition: service_healthy` mandatory; Flyway DDL targeting < 3s total migration time  |

**Scale & Complexity:**

- Primary domain: Distributed backend system (fintech / Korean bank-affiliated securities 채널계/계정계/대외계)
- Complexity level: **High**
- Deployable units: 4 (channel-service:8080, corebank-service:8081, fep-gateway:8083, fep-simulator:8082)
- Databases: 3 MySQL schemas (`channel_db`, `core_db`, `fep_db`) + Redis
- Gradle modules: 6 channel modules + corebank + fep-gateway + fep-simulator + channel-common
- Frontend: React Web (5 screens, demo layer only)
- FIX Protocol: FIX 4.2 via QuickFIX/J (FEP Gateway ↔ FEP Simulator segment only)

---

### Technical Constraints & Dependencies

| Constraint                         | Detail                                                                                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Java 21 + Spring Boot 3.x          | Non-negotiable; baseline for all 4 backend services (`channel-service`, `corebank-service`, `fep-gateway`, `fep-simulator`)                                                                          |
| MySQL InnoDB only                  | H2 disqualified for runtime/integration paths — does not implement `SELECT FOR UPDATE` equivalently; exception: build-time OpenAPI generation profile may use isolated in-memory datasource only for spec emission |
| Testcontainers mandatory           | `MySQLContainer("mysql:8.0")` + `RedisContainer` for all integration tests; `testcontainers.reuse.enable=true` in `~/.testcontainers.properties` is **CI-gate prerequisite**                          |
| No distributed transactions        | Compensating state transitions for FEP order path; InnoDB ACID for order session commit                                                                                                               |
| Redis EXPIRE enforcement           | Session TTL 30min, OTP TTL 600s, OrderSession TTL 600s — no scheduler cleanup                                                                                                                        |
| QueryDSL APT config                | **Week 1 spike required.** Done = `QOrder` generated, confirmed in `build/generated/sources/annotationProcessor`, one working `JPAQueryFactory` query (daily-sell-qty-sum) executing against Testcontainers MySQL |
| `docker compose up` cold start     | `depends_on: condition: service_healthy` on all services; Flyway DDL targeting < 3s migration on cold boot                                                                                            |
| No Keycloak (MVP)                  | Spring Security `AuthenticationProvider` interface used (Spring standard, zero extra cost — enables Keycloak drop-in post-MVP)                                                                        |
| No Kafka (MVP)                     | Synchronous REST between services; Kafka/outbox pattern is vision-phase — no `NotificationPublisher` interface pre-built                                                                              |
| Gradle module dependency direction | `channel-common` = zero Spring dependencies (pure Java only); nothing depends on `channel-service` except entry point                                                                                     |
| X-Internal-Secret filter           | **Copy-paste for MVP across 3 internal services** (~20 lines each: corebank/fep-gateway/fep-simulator); `// TODO: extract to core-common` comment marks each copy; conscious duplication documented here |

---

### Cross-Cutting Concerns Identified

| Concern                  | Scope                                | Implementation                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trace propagation        | All 4 backend services               | `traceparent` + `X-Correlation-Id` headers; MDC injection via `OncePerRequestFilter`                                                                                                                                                                                                                                                                                                        |
| PII masking              | Channel layer (logs + API responses) | `AccountNumber.masked()` in `channel-common`; unit-tested — full number must never appear in output                                                                                                                                                                                                                                                                                         |
| Error code taxonomy      | All services                         | API 응답: `CHANNEL-xxx` / `ORD-xxx` / `CORE-xxx` / `FEP-xxx` / `SYS-xxx` → `GlobalExceptionHandler` → standard response envelope; `AUTH-xxx`는 Spring Security 내부 코드 (RULE-031, P-F5). **FEP RC 코드**: `RC=9001 NO_ROUTE` / `RC=9002 POOL_EXHAUSTED` / `RC=9003 NOT_LOGGED_ON` / `RC=9004 TIMEOUT` / `RC=9005 KEY_EXPIRED` / `RC=9097 ORDER_REJECTED` / `RC=9098 CIRCUIT_OPEN` / `RC=9099 CONCURRENCY_FAILURE`                                                                                                                                                                                                                                                                                                |
| Docker network isolation | Compose layer                        | `external-net` (Channel only, port 8080 exposed), `core-net` (Channel↔CoreBanking), `gateway-net` (CoreBanking↔FEP Gateway:8083), `fep-net` (FEP Gateway↔FEP Simulator:8082); no ports on CoreBanking, FEP Gateway, or FEP Simulator exposed to host                                                                                                                                                                                                                                                                                                                                             |
| Internal API secret      | Service-to-service                   | `X-Internal-Secret` header validated by `OncePerRequestFilter` (copy-paste MVP); `INTERNAL_API_SECRET` env var                                                                                                                                                                                                                                                                              |
| Saga ownership           | Channel ↔ CoreBanking                | **Channel-service is the saga orchestrator** — owns `OrderExecutionService`, calls CoreBanking execute, issues compensating position release on FEP failure; CoreBanking executes Order Book + position mutation atomically                                                                                                                                                                |
| Audit logging            | Channel layer                        | `audit_logs` + `security_events` tables; scheduled purge (90/180 days)                                                                                                                                                                                                                                                                                                                      |
| Rate limiting            | Channel layer                        | Bucket4j Filter on 3 endpoints only (login, OTP verify, order prepare)                                                                                                                                                                                                                                                                                                                   |
| CSRF                     | Channel ↔ React/Mobile               | Double Submit Cookie (`CookieCsrfTokenRepository.withHttpOnlyFalse()`); `GET /api/v1/auth/csrf`로 `XSRF-TOKEN` 발급 후 모든 non-GET에 `X-XSRF-TOKEN` 주입; 로그인 성공 후 재조회 필수 (`changeSessionId()` 후 토큰 재발급) |
| SSE lifecycle            | Channel ↔ Frontend                   | SSE endpoint is session-aware push channel; backend must push session-expiry event proactively before TTL expires; CORS `allowCredentials=true` must explicitly cover `/api/v1/notifications/stream`; production (cross-origin Vercel→EC2): `allowCredentials=true` + exact origins required (`fix-xxx.vercel.app`, `localhost:5173`); `EventSource({ withCredentials: true })` on frontend |
| Demo infrastructure      | Actuator + FEP chaos                 | `circuitbreakers` + `health` accessible without auth for screenshare; `PUT /fep-internal/rules` robustly designed (chaos endpoint is a demo use case, not test-only)                                                                                                                                                                                                                       |
| ADR format               | Architecture document                | Key decisions use lightweight ADR: Context → Decision → Consequences; pessimistic lock rationale and simulation boundaries documented for verbatim interview narration                                                                                                                                                                                                                      |

---

### Intentional Simplifications

_Decisions that look like shortcuts but are deliberate, with the production path documented. Demonstrating this reasoning is a senior engineering signal._

| Simplification                                    | Why Correct for MVP                                                                    | Production Path                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `X-Internal-Secret` copy-pasted across 3 internal services | ~60 lines total; shared library adds Gradle publishing complexity with zero callers | Extract to `core-common` library post-MVP; `// TODO` comment marks each copy           |
| No `NotificationPublisher` interface abstraction  | Kafka is vision-phase; pre-building the interface adds speculative code with no caller | Add interface when Kafka is scoped; `NotificationService` → refactor boundary is clean |
| TOTP (Google Authenticator RFC 6238) instead of SMS OTP | Real-world 2FA UX; no telephony costs; TOTP secret in Vault (NFR-grade key management); `OtpService` interface preserved for replaceability | Replace `TotpOtpService` with HSM-backed TOTP provider; Vault integration unchanged |
| Synchronous REST between services                 | No Kafka needed for 4-backend-service MVP; simpler to reason about and debug during demo | Add Outbox pattern + Kafka when event streaming is scoped                              |
| TLS Credential management (TLS_CERT/LOGON_PASSWORD/ADMIN_TOKEN) in `fep-gateway` | Real PKI/CA infrastructure adds external dependency; DB-managed credential store demonstrates the FIX 4.2 session security pattern (자격증명 생성·갱신·만료 관리) without external CA; `CredentialService` interface preserved for replaceability | Swap `LocalCredentialService` with real PKI/CA integration; `fep_security_keys` 테이블 구조 유지 |
| `fep-simulator` `simulator_rules` 5-action rule engine | `simulator_rules` 테이블(APPROVE/DECLINE/IGNORE/DISCONNECT/MALFORMED_RESP + TTL + 금액/Symbol 매칭)은 단순 3-param mock을 넘어 실제 FEP 장애 유형을 시뮬레이션 — "단순 mock이 아니라 프로토콜 레벨 장애 패턴을 이해한다"는 포트폴리오 신호 | 규칙 엔진 범위는 MVP 완성 후 확장 가능 (Symbol-prefix 매칭, 시간대 스케줄 등) |

---

### Simulation Boundary Table

_Primary framing device for interviewer objections. Each boundary documented as: Interface Contract → Simulator → Production Delta → Talking Point._

| Real Component          | FIX Simulator                                        | Interface Contract                                                            | Production Delta                                                | Talking Point                                              |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| SMS OTP delivery gateway | TOTP via Google Authenticator (RFC 6238); secret in Vault `secret/fix/member/{memberId}/totp-secret` | `OtpService.generateSecret()` / `OtpService.confirmEnrollment()` / `OtpService.verify()` | Add SMS gateway if required; TOTP secret optionally from HSM; Vault stays | "I chose TOTP: stronger 2FA, zero telephony cost, Vault key management" |
| KRX FEP gateway (FIX 4.2)  | **FEP Gateway** (`fep-gateway:8083`) + **FEP Simulator** (`fep-simulator:8082`) — Gateway는 FIX 4.2 변환·라우팅·키 관리를 담당; Simulator는 가상 거래소로 QuickFIX/J SocketAcceptor 역할 + Chaos 주입 | `POST /fep/v1/orders` (JSON/HTTP, CoreBanking→Gateway) → Gateway가 FIX 4.2 `NewOrderSingle(35=D)`로 변환 → Simulator 응답 `ExecutionReport(35=8)` | FEP Gateway의 `fep_institutions.host/port`를 실제 KRX 기관 IP로 교체; `fep_protocol_specs` 기관별 FIX 4.2 필드 명세 커스터마이즈 | "Gateway가 프로토콜 변환·키 관리를 담당하고; CB는 corebank-service FepClient에서 관리; Simulator가 거래소를 모사한다 — 와이어는 교체되지만 아키텍처는 유지된다" |
| KSD (예탁결제원) settlement | Not implemented                                      | Documented boundary in README                                                 | Add `SettlementService` at post-execution step                          | "Settlement boundary is explicit and documented"           |
| 공인인증서 (공동인증서) | Spring Security session cookie                       | `AuthenticationProvider` interface                                            | Swap `AuthenticationProvider` implementation for PKI provider           | "Spring Security abstracts the trust anchor"               |
| Real PII (주민등록번호) | Faker-generated test data                            | `AccountNumber.masked()` utility                                              | No change to masking logic; swap seed data                              | "Masking pattern is production-correct; data is synthetic" |

---

## Starter Template Evaluation

### Primary Technology Domain

Distributed backend system — Gradle multi-module monolith + 3 satellite services (corebank, fep-gateway, fep-simulator) + React demo frontend. Two starters apply: Spring Initializr (backend × 4 services) + Vite (frontend).

---

### Backend — Spring Initializr

**ADR: Spring MVC (servlet stack) over WebFlux**

- **Context:** Four Spring Boot backend services with blocking JPA + `@Transactional` + `@Lock(PESSIMISTIC_WRITE)` data layer.
- **Decision:** All 4 backend services use `spring-boot-starter-web` (servlet stack). WebFlux rejected.
- **Consequences:** `SseEmitter` + `@Async` for SSE (correct for blocking data layer). Mixing reactive controllers with blocking JPA would block the event loop — a production footgun. All services on servlet stack for homogeneity and blocking data layer compatibility.

**Initialization — `channel-service` (boot entry module):**

```bash
spring init \
  --build=gradle \
  --java-version=21 \
  --boot-version=3.4.x \
  --packaging=jar \
  --name=channel-service \
  --group-id=com.fix \  # P-F1: D-017 확정값 반영 (io.github.yeongjae.fix → com.fix)
  --artifact-id=channel-service \
  --dependencies=web,security,data-jpa,data-redis,session,actuator,validation,flyway,mysql \
  channel-service
```

**Dependencies for `corebank-service`:** `web,data-jpa,data-redis,actuator,validation,flyway,mysql`

**Dependencies for `fep-gateway`:** `web,actuator,validation`
**Dependencies for `fep-simulator`:** `web,actuator,validation`

**Additional `build.gradle` dependencies (manually added):**

```groovy
// QueryDSL (APT — entity-owning modules only — see APT placement rule below)
implementation 'com.querydsl:querydsl-jpa:5.x.x:jakarta'
annotationProcessor 'com.querydsl:querydsl-apt:5.x.x:jakarta'

// Resilience4j
implementation 'io.github.resilience4j:resilience4j-spring-boot3:2.x.x'

// Bucket4j (rate limiting, channel-service only)
implementation 'com.giffing.bucket4j.spring.boot.starter:bucket4j-spring-boot-starter:0.x.x'

// springdoc-openapi (channel-service + corebank-service + fep-gateway + fep-simulator for spec generation)
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.x.x'

// Testcontainers (all modules via testing-support)
testImplementation project(':testing-support')
```

**QueryDSL APT Placement Rule:**

> `annotationProcessor 'com.querydsl:querydsl-apt:...:jakarta'` belongs **only on the module that declares `@Entity` classes** (e.g., `corebank-domain`). Q-class output dir: `build/generated/sources/annotationProcessor/java/main`. The consuming module (e.g., `corebank-service`) adds `implementation project(':corebank-domain')` — the Q-classes are resolved transitively. **This is the Week 1 spike's actual complexity**, not dependency resolution.

**Architectural decisions provided by starter:**

| Decision    | Value                                             |
| ----------- | ------------------------------------------------- |
| Web layer   | Spring MVC (servlet stack) — `SseEmitter` for SSE |
| Security    | Spring Security 6.x (Lambda DSL config)           |
| Session     | Spring Session Redis (`@EnableRedisHttpSession`)  |
| Data access | Spring Data JPA + Hibernate 6.x                   |
| Migrations  | Flyway auto-run on startup                        |
| Metrics     | Micrometer + Actuator auto-configured             |
| JSON        | Jackson (via `spring-boot-starter-web`)           |
| Test base   | JUnit 5 + MockMvc + `@SpringBootTest`             |

---

### Frontend — Vite + React + TypeScript

**Package manager: pnpm**

```bash
pnpm create vite@latest fix-web -- --template react-ts
cd fix-web

pnpm add axios react-router-dom zustand
pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom
```

**Day-1 required config — `vite.config.ts`:**

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8080", // dev-only; irrelevant in production build
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

**Day-1 required — `src/test/setup.ts` (EventSource mock):**

```ts
// EventSource not available in jsdom — must be stubbed globally
class MockEventSource {
  /* ... */
}
vi.stubGlobal("EventSource", MockEventSource);
```

**Day-1 required — `src/utils/format.ts`:**

```ts
// Korean ₩ formatter — used in Portfolio List, Portfolio Detail, Order Flow (3+ screens)
export const formatKRW = (amount: number): string =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(
    amount,
  );
```

**Testing constraint — OTP auto-submit tests:**

> `userEvent.type(input, '123456')` required (character-by-character, triggers auto-submit logic). `fireEvent.change(input, {target: {value: '123456'}})` insufficient — does not trigger keystroke handlers.

**Architectural decisions provided by starter:**

| Decision | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| Bundler  | Vite 6.x (fast HMR)                                               |
| Language | TypeScript (strict mode)                                          |
| React    | 19.x                                                              |
| Routing  | `react-router-dom` v7                                             |
| HTTP     | `axios` with CSRF interceptor + `withCredentials: true`           |
| SSE      | Native `EventSource({ withCredentials: true })`                   |
| Testing  | Vitest + `@testing-library/react` + `@testing-library/user-event` |
| Proxy    | Vite dev proxy → `http://localhost:8080` (dev only)               |

---

### Deployment Architecture

**Two-mode operation:**

| Mode      | Frontend                       | Backend                                  | Cookie SameSite | CORS                       |
| --------- | ------------------------------ | ---------------------------------------- | --------------- | -------------------------- |
| Local dev | `pnpm dev` (:5173, Vite proxy) | `docker compose up` (:8080)              | `Strict`        | Not needed (proxy)         |
| Deployed  | Vercel (`fix-xxx.vercel.app`)  | AWS EC2 t3.small (`fix-api.example.com`) | `None; Secure`  | Required, explicit origins |

**AWS EC2 deployment:**

- Instance: t3.small (~$15-20/mo)
- Same `docker-compose.yml` used locally runs on EC2 via SSH
- `docker compose up -d` on EC2 — no translation layer, no task definitions
- MySQL + Redis run as compose services on EC2 (sufficient for portfolio traffic)
- Security group: port 8080 open to internet (or behind reverse proxy); ports 8081/8082/8083 internal only

**Vercel deployment:**

- Detects pnpm via `pnpm-lock.yaml` automatically — no config needed
- Build command: `pnpm run build`; Output: `dist/`
- Environment variable set in Vercel dashboard: `VITE_API_BASE_URL=https://fix-api.example.com`

**Profile-scoped `SameSite` cookie (Spring Security):**

```yaml
# application-local.yml
server.servlet.session.cookie.same-site: strict

# application-deploy.yml
server.servlet.session.cookie.same-site: none
server.servlet.session.cookie.secure: true
```

**CORS config (channel-service — cross-origin deployed mode):**

```java
.allowedOrigins("https://fix-xxx.vercel.app", "http://localhost:5173")
.allowCredentials(true)
// Note: wildcard '*' forbidden when allowCredentials=true
```

**`axios` global config (`src/lib/axios.ts`):**

```ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true, // required for cross-origin session cookie in deployed mode
});
```

**Environment variables:**

```bash
# .env.local (gitignored — local dev)
VITE_API_BASE_URL=http://localhost:8080

# .env.production (❌ git 커밋 금지 — Vercel 대시보드 환경변수 UI 주입, RULE-049)  # P-F3
VITE_API_BASE_URL=https://fix-api.example.com
```

---

### Canonical Project File Tree

> ⚠️ **P-F2**: 아래는 초기 설계 참고용 구버전 트리입니다. **실제 구현 기준은 아래 '최종 확정 Gradle 모듈 구조 (7개)'** 및 '완전한 프로젝트 디렉토리 트리' 섹션을 따르세요.

```
fix/                              ← root Gradle project (8-module 확정 구조: core-common, testing-support, channel-domain, channel-service, corebank-domain, corebank-service, fep-gateway, fep-simulator)
  settings.gradle.kts             ← includes all submodules
  build.gradle.kts                ← root buildscript (version catalog only, no plugins applied)
  core-common/                    ← Pure Java: 공통 상수/예외/유틸 (zero Spring deps)
  testing-support/                ← Shared Testcontainers fixtures (testImplementation only)
    src/test/java/
      TestContainerConfig.java    ← singleton MySQLContainer + RedisContainer (.withReuse(true))
  channel-domain/                 ← 채널 JPA Entity 모듈
  channel-service/                ← Spring Boot entry (channel-service:8080)
  corebank-domain/                ← JPA entities + repositories (APT target for QueryDSL)
  corebank-service/               ← Spring Boot entry (corebank-service:8081)
  fep-gateway/                    ← Spring Boot entry (fep-gateway:8083)
  fep-simulator/                  ← Spring Boot entry (fep-simulator:8082)
  fix-frontend/                   ← Vite + React + TypeScript (pnpm)
    src/
      lib/axios.ts                ← axios instance (withCredentials, baseURL from env)
      utils/format.ts             ← formatKRW() and shared formatters
      test/setup.ts               ← EventSource mock stub
  docker-compose.yml              ← channel + corebank + fep-gateway + fep-simulator + mysql + redis
  .env.example                    ← committed; .env gitignored
  .github/
    workflows/
      ci.yml                      ← 7 acceptance scenarios green on main
```

---

### Seed Data Strategy

**Flyway profile-scoped seed migration:**

```
src/main/resources/
  db/
    migration/          ← V0~V3 migration SQL (all profiles)
    seed/               ← R__seed_data.sql (dev + test profiles only)  ← P-D2: Repeatable, 체크섬 변경 시 재실행
```

**Spring config:**

```yaml
# application-local.yml + application-test.yml
spring.flyway.locations: classpath:db/migration,classpath:db/seed

# application-deploy.yml (AWS EC2)
spring.flyway.locations: classpath:db/migration
```

**Seed data guarantees deterministic test scenarios:**

- `accountId=1`: position 500주 (005930 삼성전자), available_qty=500, cash ₩5,000,000 (10-thread concurrency SELL test target)
- `userId=1` (`user` / `user@fix.com`): registered OTP secret, active session-capable user
- `accountId=2`: 도착 포트폴리오 (BUY 주문 수신 대상), cash ₩10,000,000
- 모든 세션 수신 데이터는 `core_db.positions`; `user` 자격증명은 `channel_db.members`

---

### Week 1 Foundation Stories

_Architecture cannot be validated until all 5 pass. These are the exit criteria for Sprint 1._

| Story                             | Done Condition                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1.1 Gradle multi-module scaffold | All modules compile; `channel-service` starts on :8080; `settings.gradle.kts` includes all modules; dependency direction rules verified                                                                           |
| S1.2 QueryDSL APT spike           | `QOrder` generated in `corebank-domain`; confirmed in `build/generated/sources/annotationProcessor`; one `JPAQueryFactory` query (daily-sell-qty-sum) runs against Testcontainers MySQL                |
| S1.3 `testing-support` module     | Singleton `MySQLContainer` + `RedisContainer` with `.withReuse(true)`; one test from each of `channel-service` and `corebank-service` uses shared containers; `testcontainers.reuse.enable=true` documented in README |
| S1.4 Docker Compose local         | `docker compose up` → all 4 backend services healthy; `depends_on: condition: service_healthy` confirmed; cold start ≤ 120s (Vault + vault-init baseline); `pnpm dev` connects via Vite proxy             |
| S1.5 Vite + React scaffold        | `fix-web/` created; Vite proxy configured; `vitest.setup.ts` with `EventSource` mock; `formatKRW()` utility in `src/utils/format.ts`; seed data migration runs on `test` profile                              |

---

## Core Architectural Decisions

### Decision Index

_Flat reference for implementers. Every named decision, rule, and ADR. Reference from story tickets by ID (e.g. `RULE-001`, `D-014`)._

**Decisions (D-XXX) — What we chose:**

| ID    | Decision                                                                                        | Section                     |
| ----- | ----------------------------------------------------------------------------------------------- | --------------------------- |
| D-001 | `RestClient` for service-to-service HTTP                                                        | API & Communication         |
| D-002 | Tailwind CSS for frontend styling                                                               | Frontend Architecture       |
| D-003 | Lombok enabled (with entity safety rules)                                                       | Data Architecture           |
| D-004 | Matrix Build CI (4 parallel jobs per service)                                                   | Infrastructure & Deployment |
| D-005 | `FepClient` as Spring bean for AOP proxy (`@CircuitBreaker`)                                    | API & Communication         |
| D-006 | Manual DTO mapping for MVP (< 10 entity types)                                                  | Data Architecture           |
| D-007 | `application.yml` throughout all 4 backend services                                             | Infrastructure & Deployment |
| D-008 | `NotificationContext` (React Context + `useReducer`) for SSE global state                       | Frontend Architecture       |
| D-009 | Symbol format validated in Channel (`^\d{6}$` KRX 표준); duplicate-order guard `ORD-004`         | API & Communication         |
| D-010 | Structured JSON logging via `logstash-logback-encoder`                                          | Infrastructure & Deployment |
| D-011 | `BCryptPasswordEncoder` strength 12; Argon2 post-MVP upgrade path                               | Auth & Security             |
| D-012 | WireMock for `FepClient` circuit breaker tests; FEP chaos endpoint = demo/manual only           | Infrastructure & Deployment |
| D-013 | Dual-write notifications: DB persist first, then SSE push                                       | API & Communication         |
| D-014 | Jackson global config: ISO-8601 dates, `NON_NULL`, `FAIL_ON_UNKNOWN_PROPERTIES: false`          | API & Communication         |
| D-015 | Actuator: `health,info,metrics,circuitbreakers` exposed; `/actuator/**` excluded from auth      | Infrastructure & Deployment |
| D-016 | Redis key naming convention: `{svc}:{domain}:{id}`                                              | Data Architecture           |
| D-017 | Package convention: `com.fix.{service}.{module}.{layer}` (Step 6: `io.github.*` → `com.fix.*` 변경)              | Data Architecture           |
| D-018 | `GlobalExceptionHandler` hierarchy: exception → HTTP status → error code                        | API & Communication         |
| D-019 | `SseEmitter` timeout = `Long.MAX_VALUE`; lifecycle managed by session events                    | API & Communication         |
| D-020 | Seed: `demo` (포지션 005930 500주, 현금 ₩5M), `admin` (ROLE_ADMIN); fixed credentials                                     | Data Architecture           |
| D-021 | API versioning enforced at `SecurityConfig` path matchers (not just controller annotations)     | Auth & Security             |
| D-022 | Password policy: min 8 chars, 1 uppercase, 1 digit, 1 special; `AUTH-007`                       | Auth & Security             |
| D-023 | `useEffect` + `axios` for data fetching; React Router `loader` not used                         | Frontend Architecture       |
| D-024 | Global `ErrorBoundary` catch-all; per-screen `try/catch` → inline error state; no toast library | Frontend Architecture       |
| D-025 | Decision numbering: `D-XXX` / `ADR-XXX` / `RULE-XXX`                                            | Architecture Document       |

**Rules (RULE-XXX) — How we enforce:**

| ID       | Rule                                                                                                                   | Section                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| RULE-001 | `@Transactional` on service layer only; repositories transaction-free                                                  | Data Architecture           |
| RULE-002 | `MockMvc` only; `WebTestClient` forbidden; `spring-boot-starter-webflux` must not appear in test classpath             | Infrastructure & Deployment |
| RULE-003 | TC-ORD-08 test method must NOT use `@Transactional`; cleanup via `@AfterEach` SQL reset                                | Infrastructure & Deployment |
| RULE-004 | CI triggers: `push main` + `pull_request → main`; PRs blocked if CI fails                                              | Infrastructure & Deployment |
| RULE-005 | Trunk-based branching; `main` always deployable; feature branches `feat/{name}`; no long-lived `develop`               | Infrastructure & Deployment |
| RULE-006 | QueryDSL `annotationProcessor` on entity-owning module only (`corebank-domain`)                                        | Data Architecture           |
| RULE-007 | `channel-common` = zero Spring dependencies (pure Java); nothing depends on `channel-service` except entry point           | Data Architecture           |
| RULE-008 | `X-Internal-Secret` filter copy-pasted MVP (3 internal services: corebank/fep-gateway/fep-simulator); each copy has `// TODO: extract to core-common` | Auth & Security             |
| RULE-009 | Lombok JPA entity: `@EqualsAndHashCode` forbidden; `@ToString` with lazy collections forbidden                         | Data Architecture           |
| RULE-010 | `@SpringBootTest` in `channel-service` module only; other modules use `@ExtendWith(MockitoExtension.class)`                | Infrastructure & Deployment |
| RULE-011 | `@Valid` on `@RequestBody`; `@Validated` for path/query params; never on service layer                                 | API & Communication         |
| RULE-012 | Permit `/swagger-ui/**`, `/v3/api-docs/**` in `SecurityConfig.permitAll()` for local/dev profiles only; keep docs disabled in prod | Auth & Security             |
| RULE-013 | `@EnableAsync` on `ChannelAppConfig`; `NotificationService.push()` `@Async`; `SyncTaskExecutor` in tests               | API & Communication         |
| RULE-014 | Docker healthcheck: MySQL `start_period: 30s`; Redis `start_period: 5s`; both required                                 | Infrastructure & Deployment |
| RULE-015 | OTP attempt debounce: `SET ch:otp-attempt-ts:{orderSessionId} NX EX 1`; key exists → HTTP 429 `RATE-001`, no attempt consumed | Auth & Security             |
| RULE-016 | Testcontainers: fresh containers per CI job (GitHub-hosted VMs); `reuse=true` local dev only                           | Infrastructure & Deployment |
| RULE-017 | JaCoCo thresholds enforced via `jacocoTestCoverageVerification` in each module's `build.gradle`; build fails at source | Infrastructure & Deployment |
| RULE-018 | Stack trace never in response body; `traceId` from MDC always in response envelope                                     | API & Communication         |
| RULE-019 | `@Async` SSE integration tests use `SyncTaskExecutor` via `@TestConfiguration @Primary`                                | Infrastructure & Deployment |
| RULE-077 | TOTP secret must be stored exclusively in Vault (`secret/fix/member/{memberId}/totp-secret`); DB or Redis storage forbidden (FR-TOTP-04) | Auth & Security             |
| RULE-078 | `TotpOtpService` must accept `Clock` via constructor injection; production wires `Clock.systemUTC()`, tests wire `Clock.fixed()` for deterministic TOTP window tests | Auth & Security             |

> ⚠️ P-E1: 원래 RULE-020/021 자리에 TOTP 규칙이 중복 등록되어 있었음. 실제 `### RULE-020` = Spring Bean Stereotype, `### RULE-021` = record vs class DTO — 번호 충돌 해소를 위해 RULE-077/078로 재부여.

**Architecture Decision Records (ADR-XXX) — Full rationale:**

| ID      | Title                                                          | Section           |
| ------- | -------------------------------------------------------------- | ----------------- |
| ADR-001 | Pessimistic Locking over Optimistic Locking for position writes | Data Architecture |

---

### ADR-001: Pessimistic Locking over Optimistic Locking for Position Writes

**Context:**
`corebank-service` handles concurrent position mutations — Order Book SELL execution consumes `available_qty` in the `positions` table. Two standard JPA approaches exist: optimistic locking (`@Version` column, retry on `OptimisticLockingFailureException`) and pessimistic locking (`@Lock(LockModeType.PESSIMISTIC_WRITE)`, InnoDB `SELECT FOR UPDATE`).

**Decision:**
Use `@Lock(LockModeType.PESSIMISTIC_WRITE)` on the `findBySymbol` query in `PositionRepository` (symbol-level row lock). All position write paths acquire this lock before any mutation. QueryDSL daily-sell-limit aggregate query runs after the position row is locked.
(Note: **DEFERRED** mode is reserved for Phase 2 Hot Symbols).

```java
// PositionRepository.java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT p FROM Position p WHERE p.accountId = :accountId AND p.symbol = :symbol")
Optional<Position> findBySymbolWithLock(@Param("accountId") Long accountId, @Param("symbol") String symbol);

// OrderExecutionService.java — lock sequence
Position position = positionRepository.findBySymbolWithLock(accountId, symbol);  // SELECT FOR UPDATE
Long todaySellQty = orderRepository.sumTodaySellQty(accountId, symbol);          // shared lock sufficient (position already locked)
```

**Consequences:**

- ✅ No retry logic required — lock serializes concurrent access; exactly one writer at a time
- ✅ Lock hold time ~5–15ms (InnoDB row lock on single position row) — acceptable for order execution latency
- ✅ Prevents phantom reads on `available_qty` field under concurrent load — TC-ORD-08 (`10 threads × SELL 100주 on 500주 position`) provable with real InnoDB: exactly 5 FILLED, `available_qty = 0`
- ✅ QueryDSL daily-sell-limit runs inside lock scope — no phantom sell aggregation
- ❌ Under extreme contention (thousands of concurrent sell orders on same symbol), throughput degrades linearly — acceptable for portfolio scale; documented in README
- ❌ `@Version` optimistic retry would force OTP re-entry on conflict — unacceptable UX in securities order flow (30–120s user cost per retry)
- **Interview talking point:** _"낙관적 락은 여기에서 잘못된 선택이다 — 재시도 비용은 주문 재인증(OTP)이지 밀리초 백오프가 아니다. 도메인의 레이턴시 허용치에 맞는 락을 선택했다."

---

### Data Architecture

**D-003 — Lombok (entity safety rules)**

Enabled on all services. `annotationProcessor 'org.projectlombok:lombok'` in all `build.gradle` files.

| Annotation                     | JPA Entity                                                | DTO/POJO |
| ------------------------------ | --------------------------------------------------------- | -------- |
| `@Getter`                      | ✅ Safe                                                   | ✅ Safe  |
| `@Setter`                      | ✅ Safe (selective)                                       | ✅ Safe  |
| `@NoArgsConstructor`           | ✅ Required by JPA                                        | ✅ Safe  |
| `@AllArgsConstructor`          | ✅ Safe                                                   | ✅ Safe  |
| `@Builder`                     | ✅ Safe                                                   | ✅ Safe  |
| `@EqualsAndHashCode`           | ❌ **Forbidden** — triggers lazy proxy                    | ✅ Safe  |
| `@ToString` (with collections) | ❌ **Forbidden** — N+1 on lazy fields                     | ✅ Safe  |
| `@ToString(exclude={...})`     | ✅ Safe if collections excluded                           | ✅ Safe  |
| `@Data`                        | ❌ **Forbidden** on entities (includes EqualsAndHashCode) | ✅ Safe  |

**D-006 — Manual DTO mapping**

No MapStruct. All entity↔DTO conversions are explicit `toDto()` / `fromDto()` static methods or constructors. Sufficient for < 10 entity types. MapStruct deferred to post-MVP if mapping count exceeds 30.

**D-016 — Redis key naming convention**

`{service-prefix}:{domain}:{identifier}` — prevents key collision between `channel-service` and `corebank-service` sharing the same Redis instance.

| Key                   | Pattern                                                          | TTL                 |
| --------------------- | ----------------------------------------------------------------- | ------------------- |
| Spring Session        | `spring:session:sessions:{sessionId}` (Spring Session managed)  | 30 min (sliding)    |
| Session index         | `spring:session:index:...:{memberId}` (principal index)         | 30 min              |
| Order session         | `ch:order-session:{orderSessionId}`                              | 600s                |
| TOTP replay guard     | `ch:totp-used:{memberId}:{windowIndex}:{code}`                   | 60s                 |
| Order execute lock    | `ch:txn-lock:{sessionId}`                                        | 30s                 |
| Rate limit bucket     | `ch:ratelimit:{endpoint}:{identifier}`                           | per Bucket4j config |
| OTP attempt debounce  | `ch:otp-attempt-ts:{orderSessionId}`                             | 1s                  |
| OTP attempt counter   | `ch:otp-attempts:{sessionId}`                                    | 600s (SET NX EX 600 — matches order session TTL) |
| Idempotency key       | `ch:idempotency:{clOrdID}`                                       | 600s                |
| Recovery scheduler lock | `ch:recovery-lock:{sessionId}`                                 | 120s (NX — prevents double-processing of same EXECUTING session) |
| FDS IP fail count     | `fds:ip-fail:{ip}`                                               | 10 min              |
| FDS device            | `fds:device:{memberId}`                                          | 30 days             |

> **삭제된 키 (JWT 우온시 폐기)**: `rt:{memberId}:{tokenUUID}` (Refresh Token), `session:{jti}` (AT Blacklist) — Spring Session 전환으로 불필요

**D-017 — Package naming convention**

`com.fix.{service}.{module}.{layer}`

> ⚠️ Step 6 변경: `io.github.yeongjae.fix.*` → `com.fix.*` (포트폴리오 프로젝트에 OSS 배포 관례 과분)

Layer suffixes: `controller`, `service`, `repository`, `domain`, `dto`, `config`, `filter`, `exception`

Examples:

- `com.fix.channel.order.service.OrderExecutionService`
- `com.fix.channel.order.domain.OrderSession`
- `com.fix.corebank.order.repository.OrderRepository`
- `com.fix.common.error.ErrorCode`

**D-020 — Seed data**

`R__seed_data.sql` — Flyway Repeatable migration, active on `dev` and `test` profiles only. (P-D2: Versioned `V2__seed_test_data.sql`과 혼동 주의 — 파일트리 기준 `R__` 사용)

| userId | username | email           | password     | role         |
| ------ | -------- | --------------- | ------------ | ------------ |
| 1      | `user`   | `user@fix.com`  | `Test1234!`  | `ROLE_USER`  |
| 2      | `admin`  | `admin@fix.com` | `Admin1234!` | `ROLE_ADMIN` |
status   | mode  |
| --------- | ------ | --------------- | ---------- | -------- | ----- |
| 1         | 1      | `110-1234-5678` | ₩1,000,000 | ACTIVE   | EAGER |
| 2         | 1      | `110-8765-4321` | ₩500,000   | ACTIVE   | EAGER |
| 3         | 2      | `110-1111-2222` | ₩0         | ACTIVE   | EAGER |
| 3         | 2      | `110-1111-2222` | ₩0         | 주식매매계좌 (admin account)                   |

---

### Authentication & Security

**D-011 — Password hashing**

`BCryptPasswordEncoder` strength 12. Injected as `@Bean PasswordEncoder` in `SecurityConfig`. Argon2 documented as post-MVP upgrade:

```java
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
}
```

**D-022 — Password validation rule**

Regex: `^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$`

Error code: `AUTH-007 PASSWORD_POLICY_VIOLATION`. Applied via `@Pattern` on `LoginRequest.password` DTO field. Seed passwords (`Test1234!`, `Admin1234!`) comply.

**RULE-015 — OTP attempt debounce**

Before consuming an OTP attempt: `SET ch:otp-attempt-ts:{orderSessionId} NX EX 1`. If key exists → return HTTP 429 `RATE-001` without decrementing attempt counter. Prevents accidental lockout from rapid auto-submit (UX spec: 6-digit auto-submit on completion).

**RULE-008 — X-Internal-Secret filter (conscious duplication)**

`OncePerRequestFilter` validates `X-Internal-Secret` header on `corebank-service`, `fep-gateway`, and `fep-simulator`. Copy-pasted ~20 lines in each service. Each copy has:

```java
// TODO: extract to core-common when adding a 4th service
```

**D-021 — API versioning at SecurityConfig**

URL prefix enforced at `SecurityConfig` path matchers, not just controller annotations. Filter ordering:

1. `InternalSecretFilter` → validates `/internal/v1/**` and `/fep-internal/**` before reaching controllers
2. Spring Security session auth → validates `/api/v1/**` (except per `permitAll()` list)
3. `permitAll()` → `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/csrf`, `/actuator/health`, `/actuator/circuitbreakers` (+ `/swagger-ui/**`, `/v3/api-docs/**` in local/dev profiles only)
   > ℹ️ `/api/v1/auth/register` — login-flow.md Story 1.1에서 MVP에 포함됨 (BCrypt 해싱 + corebank 계좌 자동 생성)

---

### API & Communication Patterns

**D-001 — RestClient**

Spring 6.1+ synchronous HTTP client. Used for all service-to-service calls (Channel→CoreBanking, CoreBanking→FEP). Replaces deprecated `RestTemplate`; `WebClient` rejected (wrong stack for blocking JPA).

**D-005 — FepClient as Spring bean (AOP proxy requirement)**

`FepClient` must be a Spring-managed `@Component`. `@CircuitBreaker(name="fep", fallbackMethod="fepFallback")` on the service method — not on the `RestClient` call directly. Non-bean usage or same-class internal calls bypass AOP proxy → circuit breaker silently does nothing.

```java
@Component
public class FepClient {
    @CircuitBreaker(name = "fep", fallbackMethod = "fepFallback")
    public FepResponse send(FepOrderRequest req) {
        return restClient.post()...;  // RestClient call to fep-gateway:8083
    }
    private FepResponse fepFallback(FepOrderRequest req, Exception e) {
        // CB OPEN preemptive — no @Transactional was started, no order record, no position touched
        // Returns RC=9098 CIRCUIT_OPEN to caller (FepOrderService)
        return FepResponse.circuitOpen();
    }
}
```

**D-009 — Account number validation**

Validated in `OrderService.prepare()` before any CoreBanking call:

- Format: `^\d{6}$` (symbol code — KRX 6자리 숫자) → fail with `ORD-004 SYMBOL_INVALID`
- Qty range guard: `qty < 1 || qty > availableQty` → `ORD-004`
  > ⚠️ P-C3: 종목 코드 검증은 `SymbolValidator` 유틸리티로 분리 — 서비스 내 하드코딩 금지

**D-013 — Notification dual-write**

`NotificationService.send()` sequence:

1. Write to `channel_db.notifications` (DB persist — durable)
2. Push to `SseEmitter` registry (real-time delivery)

If SSE push fails (client disconnected), DB record still exists. `GET /api/v1/notifications` serves paginated history from DB. SSE stream delivers real-time additions only.

**D-014 — Jackson global config**

`JacksonConfig @Configuration` in each service entry module:

```java
@Bean
public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
    return builder -> builder
        .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        .featuresToDisable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
        .serializationInclusion(JsonInclude.Include.NON_NULL);  // on data field only
}
```

Date format: ISO-8601 (`2026-02-23T14:32:11Z`). camelCase (not snake_case). Null fields omitted from `data` object.

**D-018 — GlobalExceptionHandler hierarchy**

`@RestControllerAdvice GlobalExceptionHandler` — all services:

| Exception                                  | HTTP | Error Code           |
| ------------------------------------------ | ---- | -------------------- |
| `BusinessException` (base)                 | 400  | from exception field |
| `AuthenticationException`                  | 401  | `AUTH-003`           |
| `AccessDeniedException`                    | 403  | `AUTH-006`           |
| `ResourceNotFoundException`                | 404  | from exception field |
| `OptimisticLockingFailureException`        | 409  | `CORE-003`           |
| `DataIntegrityViolationException` (UNIQUE) | 409  | `ORD-007`            |
| `MethodArgumentNotValidException`          | 422  | `VALIDATION-001`     |
| `Exception` (catch-all)                    | 500  | `SYS-001`            |

> ⚠️ P-D1: catch-all 코드를 `SYSTEM-001` → `SYS-001`로 통일 (RULE-031 에러코드 표 기준).

Stack trace never in response body (RULE-018). `traceId` always injected from MDC.

**D-019 — SseEmitter lifecycle**

```java
new SseEmitter(Long.MAX_VALUE);  // no timeout
```

Lifecycle managed by:

- `SseEmitter.onCompletion()` → remove from emitter registry
- `SseEmitter.onTimeout()` → remove from emitter registry (guard)
- Session expiry event pushed before TTL expiry → client receives event, UI shows Korean expiry message → emitter closed

**RULE-013 — @Async for SSE push**

```java
// ChannelAppConfig.java
@EnableAsync
@Configuration
public class ChannelAppConfig {
    @Bean
    public TaskExecutor sseTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("sse-");
        return executor;
    }
}

// Test override:
@TestConfiguration
static class SyncExecutorConfig {
    @Bean @Primary
    TaskExecutor sseTaskExecutor() { return new SyncTaskExecutor(); }
}
```

---

### Frontend Architecture

**D-002 — Tailwind CSS**

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

Configured via `vite.config.ts` plugin. No separate `tailwind.config.js` needed (Tailwind v4). Korean banking aesthetic: neutral palette, tight spacing, no rounded corners on primary actions (bank convention).

**D-008 — NotificationContext**

Single `EventSource` instance owned by `NotificationContext`. Prevents duplicate connections across screens. Order Flow uses local `useReducer(orderReducer, initialState)` — no global state for form steps.

```tsx
// src/context/NotificationContext.tsx
const NotificationContext = createContext<NotificationState>(...);
export function NotificationProvider({ children }) {
  const [notifications, dispatch] = useReducer(notificationReducer, []);
  useEffect(() => {
    const es = new EventSource(`${import.meta.env.VITE_API_BASE_URL}/api/v1/notifications/stream`,
      { withCredentials: true });
    es.onmessage = e => dispatch({ type: 'ADD', payload: JSON.parse(e.data) });
    return () => es.close();
  }, []);
  return <NotificationContext.Provider value={{ notifications, dispatch }}>{children}</NotificationContext.Provider>;
}
```

**D-023 — Data fetching pattern**

`useEffect` + `axios` for all route-level data fetching. React Router v7 `loader` not used (complicates axios interceptor setup; reduces Network tab debuggability for FinTech interviewer demo).

**D-024 — Error boundary strategy**

- `<ErrorBoundary>` wraps `<App />` — catch-all for unhandled React errors
- All expected API errors (ORD-001, AUTH-003, FEP-003, etc.) handled inline per UX spec Korean messages
- No toast library — inline error `<div>` per screen per UX spec exactly

---

### Infrastructure & Deployment

**D-004 — Matrix Build CI**

Four parallel GitHub Actions jobs: `channel-service`, `corebank-service`, `fep-gateway`, `fep-simulator`. Each job runs on isolated GitHub-hosted runner VM — no Testcontainers port conflicts. Fresh containers per job is correct (not reuse).

JaCoCo thresholds per service enforced in `build.gradle` via `jacocoTestCoverageVerification` (RULE-017):

```groovy
jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit { minimum = 0.80 }  // corebank: 80%
            // channel-service: 0.70, fep-gateway: 0.60, fep-simulator: 0.60
        }
    }
}
check.dependsOn jacocoTestCoverageVerification
```

CI badge row in README: `[build]` `[coverage-channel]` `[coverage-core]` `[coverage-fep-gateway]` `[coverage-fep-simulator]`

**CI trigger (RULE-004):**

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

**D-007 — application.yml throughout**

All 4 backend services use YAML config exclusively. No `.properties` files except `gradle.properties`. Profiles: `local` (dev), `test` (CI/Testcontainers), `deploy` (AWS EC2).

**D-010 — Structured logging**

`logstash-logback-encoder` in all 4 backend services:

```groovy
implementation 'net.logstash.logback:logstash-logback-encoder:7.x'
```

`logback-spring.xml` per service (in `src/main/resources` of each entry module):

- Dev profile: `CONSOLE_LOG_PATTERN` (human-readable)
- Deploy profile: `LogstashEncoder` (JSON)
- `traceId` auto-included via MDC (set by `TracingFilter` from `traceparent` header)

**D-015 — Actuator exposure**

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,circuitbreakers
  endpoint:
    health:
      show-details: always
# /actuator/** excluded from Spring Security auth filter
# /actuator/shutdown NOT exposed (default)
```

CoreBank exposes `health` + `metrics` only (internal — no public Actuator demo surface).

**D-012 — WireMock for circuit breaker tests**

```groovy
testImplementation 'org.wiremock:wiremock-standalone:3.x.x'
```

`FepClient` integration tests in `channel-service` use WireMock to simulate FEP timeout. FEP chaos endpoint (`PUT /fep-internal/rules`) reserved for demo screenshare and manual verification — not in automated CI.

**D-019 — Docker healthcheck specs**

```yaml
# MySQL
healthcheck:
  test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p$$MYSQL_ROOT_PASSWORD"]
  interval: 5s
  timeout: 3s
  retries: 10
  start_period: 30s  # InnoDB buffer pool + Flyway init

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 3s
  timeout: 2s
  retries: 10
  start_period: 5s
```

`start_period: 30s` on MySQL is critical — MySQL takes 20–25s to initialize on first boot. Without it, healthcheck fails during init, Docker marks container unhealthy, dependent services never start.

**RULE-005 — Branch strategy**

Trunk-based with short-lived feature branches:

- `main` always deployable (CI green required)
- Feature branches: `feat/channel-auth`, `feat/order-state-machine`, `feat/fep-circuit-breaker`
- No long-lived `develop` branch
- Merge via PR with CI gate (RULE-004)

---

## Implementation Patterns & Consistency Rules

> **작성 기준일:** 2026-02-23 | **Party Mode:** 9 라운드 (에이전트 10인 참여) | **총 RULE:** RULE-020 ~ RULE-075

### Decision Index 추가항목 (Step 5 — RULE-020 ~ RULE-075)

| ID       | 설명                                      |
| -------- | ----------------------------------------- |
| RULE-020 | Spring Bean Stereotype 사용 규칙          |
| RULE-021 | record vs class DTO 선택 기준             |
| RULE-022 | @ParameterizedTest 의무 적용 시나리오     |
| RULE-023 | AssertJ 강제 사용                         |
| RULE-024 | Gradle 모듈 의존성 방향                   |
| RULE-025 | 레이어 간 객체 변환 지점                  |
| RULE-026 | OrderSession 상태 전환 규칙            |
| RULE-027 | AsyncStateWrapper 로딩/에러 패턴          |
| RULE-028 | formatKRW 금액 포맷 강제                  |
| RULE-029 | OTP 입력 UX 패턴                          |
| RULE-030 | BusinessConstants 비즈니스 규칙 상수 위치 |
| RULE-031 | 표준 에러 응답 구조                       |
| RULE-032 | FepClient 구현 패턴                       |
| RULE-033 | 민감 데이터 마스킹                        |
| RULE-034 | 시뮬레이션 코드 표시                      |
| RULE-035 | ApiResponse<T> TypeScript 타입            |
| RULE-036 | @Transactional 경계 규칙                  |
| RULE-037 | Resilience4j 설정 위치                    |
| RULE-038 | 예외 계층 구조                            |
| RULE-039 | 서비스 메서드 시그니처 패턴               |
| RULE-040 | bootRun/bootJar 실행 모듈 제한            |
| RULE-041 | Flyway 마이그레이션 파일 규칙             |
| RULE-042 | SseEmitter 테스트 패턴                    |
| RULE-043 | QueryDSL 쿼리 작성 위치                   |
| RULE-044 | Spring Security 필터 테스트 패턴          |
| RULE-045 | NotificationContext SSE lifecycle         |
| RULE-046 | Order Flow useReducer 상태 타입        |
| RULE-047 | axios 단일 인스턴스 인터셉터 패턴         |
| RULE-048 | application.yml 프로파일 구조             |
| RULE-049 | .env / VITE\_ 환경변수 관리               |
| RULE-050 | Conventional Commits 형식                 |
| RULE-051 | 브랜치 네이밍 규칙                        |
| RULE-052 | 로컬 개발 환경 세팅 순서                  |
| RULE-053 | JPA N+1 방지 패턴                         |
| RULE-054 | Redis 캐싱 전략                           |
| RULE-055 | 인덱스 전략 패턴                          |
| RULE-056 | 도메인 용어 Glossary                      |
| RULE-057 | (거부됨 — lint 빌드 실패 강제 제외)       |
| RULE-058 | 페이지네이션/정렬 패턴                    |
| RULE-059 | Jib Docker 이미지 빌드                    |
| RULE-060 | Swagger/OpenAPI 문서화 패턴               |
| RULE-061 | API 경로 버전 관리                        |
| RULE-062 | FIX 테스트 피라미드                       |
| RULE-063 | WireMock 설정 및 재사용 패턴              |
| RULE-064 | 테스트 메서드 한국어 명명                 |
| RULE-065 | React Hook Form + Zod 폼 패턴             |
| RULE-066 | Tailwind 반응형 breakpoint 기준           |
| RULE-067 | 접근성(a11y) 최소 요건                    |
| RULE-068 | Actuator 보안 및 포트 분리                |
| RULE-069 | Graceful Shutdown 패턴                    |
| RULE-070 | HikariCP 커넥션 풀 설정                   |
| RULE-071 | 주문 요청 Idempotency 패턴 (ClOrdID)      |
| RULE-072 | OrderSession 만료 처리                    |
| RULE-073 | 포지션 동시성 3중 보호 구조               |
| RULE-074 | 서비스 배포 순서                          |
| RULE-075 | docker-compose healthcheck 표준           |
| RULE-076 | 인증 상태 Zustand `useAuthStore` 패턴   |

---

### ⚡ Quick Reference — Do / Don't

| 영역          | ✅ DO                                       | ❌ DON'T                             |
| ------------- | ------------------------------------------- | ------------------------------------ |
| DTO           | `record` for req/res                        | `class` for API DTO                  |
| Entity        | `class` + `@Entity`                         | `record` + `@Entity`                 |
| Service 반환  | Optional 언래핑 후 반환                     | `Optional<T>` 전파                   |
| Assertion     | `assertThat(x).isEqualTo(y)`                | `assertEquals(y, x)`                 |
| 금액 표시     | `formatKRW(amount)`                         | `amount.toLocaleString()`            |
| 상태 전환     | `OrderSessionService.transition()`          | 직접 Redis SET                       |
| 모듈 의존     | `service → domain → (없음)`                 | `service → 타 서비스 domain`         |
| 로딩 UI       | `<LoadingSpinner />` 컴포넌트               | `{loading && <div>}` inline          |
| 로그 레벨     | ERROR = 시스템 장애만                       | ERROR = 비즈니스 예외                |
| API 응답      | `{ success, data, error }` envelope         | naked entity 반환                    |
| 비즈니스 상수 | `BusinessConstants.MAX_SELL_QTY_PER_ORDER`  | magic number 인라인                  |
| 도메인 용어   | `Order`, `Member`, `Position`               | `Transaction`, `User`, `BankAccount` |
| 폼 유효성     | React Hook Form + Zod                       | `useState` 수동 검사                 |
| axios 호출    | `lib/axios.ts` 인스턴스                     | `axios.get()` 직접 호출              |
| Docker 빌드   | Jib Gradle 태스크                           | 단순 fat JAR Dockerfile              |

---

### ⚠️ Most Violated Patterns — Top 10 경고

| 순위 | 위반 패턴                               | 올바른 패턴                | 관련 RULE |
| ---- | --------------------------------------- | -------------------------- | --------- |
| 1    | `@Entity` record 사용                   | `class` + `@Entity`        | RULE-021  |
| 2    | Service에서 `Optional<T>` 반환 전파     | `orElseThrow`로 언래핑     | RULE-021  |
| 3    | 통합 테스트 `@Transactional` 롤백 의존  | `@AfterEach` DELETE        | RULE-036  |
| 4    | `assertEquals()` 사용                   | `assertThat().isEqualTo()` | RULE-023  |
| 5    | magic number 인라인 (5000000 등)        | `BusinessConstants`        | RULE-030  |
| 6    | domain 모듈 → 타 service domain 의존    | 의존성 방향 준수           | RULE-024  |
| 7    | Controller에서 Entity 직접 반환         | Response DTO 변환          | RULE-025  |
| 8    | 개별 컴포넌트 `EventSource` 생성        | `NotificationContext`      | RULE-045  |
| 9    | `axios.get()` 직접 호출                 | `lib/axios.ts` 인스턴스    | RULE-047  |
| 10   | 도메인 용어 혼용 (Transaction/Transfer) | Glossary 준수              | RULE-056  |

---

### Naming Patterns

#### 데이터베이스

- 테이블: `snake_case` 복수형 (`order_sessions`, `positions`)
- 컬럼: `snake_case` (`created_at`, `available_qty`)
- 인덱스: `idx_{table}_{columns}` (`idx_order_session_status`)
- Flyway: `V{N}__{snake_case_description}.sql` (더블 언더스코어 필수)

#### Java

- 클래스: `PascalCase` | 메서드/변수: `camelCase` | 상수: `UPPER_SNAKE_CASE`
- 테스트: `{ClassName}Test` (단위) / `{ClassName}IntegrationTest` (통합)
- 패키지: `com.fix.{service}.{layer}` (예: `com.fix.channel.service`)

#### TypeScript

- 컴포넌트: `PascalCase.tsx` | 훅: `use{Feature}.ts` | CSS prefix: `fix-{component}`
- 페이지: `{Feature}Page.tsx` | 공통 컴포넌트: `components/common/`

---

### Structure Patterns

#### Java 테스트 구조

```
src/test/java/
  unit/
    com/fix/{service}/service/{Name}Test.java
  integration/
    com/fix/{service}/controller/{Name}IntegrationTest.java
```

> ❌ 금지: 소스 파일과 테스트 파일 co-location

#### React 프로젝트 구조

```
src/
  pages/          # 라우트 단위 페이지
  components/
    order/        # 주문 관련 컴포넌트
    common/       # 공통 컴포넌트 (AsyncStateWrapper, LoadingSpinner 등)
  context/        # NotificationContext 등 전역 상태
  hooks/          # use{Feature}.ts 커스텀 훅
  lib/            # axios.ts, schemas/ (Zod)
  utils/          # formatters.ts (formatKRW 등)
  types/          # api.ts (ApiResponse<T>), order.ts 등
  test/           # 테스트 픽스처, MSW 핸들러
```

#### Gradle 의존성 스코프

| 스코프                | 사용                               |
| --------------------- | ---------------------------------- |
| `implementation`      | 런타임 + 컴파일 의존성             |
| `testImplementation`  | 테스트 전용                        |
| `annotationProcessor` | QueryDSL APT (`corebank-domain`만) |
| `runtimeOnly`         | 드라이버 등 런타임만 필요          |

---

### RULE-020: Spring Bean Stereotype

```java
// @Repository = JPA Repository 인터페이스 또는 QueryDSL RepositoryImpl만
// @Service    = 비즈니스 로직 (트랜잭션 경계)
// @Component  = 유틸리티 Bean (예: RestClient 래퍼, Properties)
// @Controller/@RestController = 웹 레이어만
```

### RULE-021: record vs class DTO

```java
// 요청/응답 DTO → record (불변, Jackson 2.12+ 직접 지원)
// 영속성 엔티티 → class + @Entity (record는 @Entity 금지)
// 내부 커맨드/이벤트 객체 → record

// Optional 반환 패턴:
// Repository 레이어: Optional<T> 반환 허용
// Service 레이어:   Optional 언래핑 → orElseThrow(NotFoundException::new) — 전파 금지
// Controller 레이어: Optional 직접 반환 금지
```

### RULE-022: @ParameterizedTest 의무 적용

```java
// 필수 적용:
// - 입력 유효성 검사 (valid/invalid 케이스 ≥ 3)
// - HTTP 상태 코드 분기 (401/403/404/422 동일 엔드포인트)
// - 수량 경계값 (0주, 음수, 최대 주문 한도)
```

### RULE-023: AssertJ 강제

```java
// 모든 assertion → AssertJ (assertThat)
// ❌ 금지: assertEquals(), assertTrue(), assertNull()
```

### RULE-024: Gradle 모듈 의존성 방향

```
channel-service  →  channel-domain  →  (없음)
corebank-service →  corebank-domain →  (없음)
fep-gateway      →  (없음)
fep-simulator    →  (없음)
*-service        →  core-common
*-domain         →  core-common
testing-support  →  core-common, *-domain

❌ 금지: service → 다른 서비스의 domain
❌ 금지: domain → 자체 service
❌ 금지: core-common → 어떤 도메인 모듈
```

### RULE-025: 레이어 간 객체 변환 지점

```
Controller  → Service:    Request DTO → Command 변환 (Controller 책임)
Service     → Domain:     도메인 팩토리 메서드 또는 생성자
Service     → Repository: Entity 직접 전달
Service     → Controller: Response DTO 변환 (Service 책임)

❌ 금지: Controller가 Entity 직접 반환
❌ 금지: Repository가 DTO 반환
```

### RULE-026: OrderSession 상태 전환

```java
// 상태 전환은 반드시 OrderSessionService 내부에서만 수행
void transition(String orderSessionId, OrderSessionStatus expected, OrderSessionStatus next)
// → 내부에서 Redis key 합성: "ch:order-session:" + orderSessionId  (P-F4: ID만 전달, key 합성은 서비스 내부 책임)
// → Redis SETNX 또는 WATCH/MULTI로 원자성 보장
// → expected 불일치 시 InvalidSessionStateException
// ❌ 금지: Controller/다른 Service에서 직접 상태 값 SET

// 허용 전환 FSM (주문 도메인 확정값)
// PENDING_NEW  → AUTHED        (정상 OTP 검증)
// PENDING_NEW  → FAILED        (OTP 시도 초과)
// PENDING_NEW  → EXPIRED       (@Scheduled 10분 TTL)
// AUTHED       → EXECUTING     (Redis SETNX ch:txn-lock 획득 직전)
// AUTHED       → EXPIRED       (@Scheduled 10분 TTL)
// EXECUTING    → COMPLETED     (Order Book 체결 + FEP 성공 — orders.status=FILLED, OrderSession=COMPLETED)
// EXECUTING    → FAILED        (FEP 실패/보상 트랜잭션 완료 — orders.status=FAILED, sub_status=COMPENSATED)
```

### RULE-027: AsyncStateWrapper 로딩/에러 패턴

```tsx
// components/common/AsyncStateWrapper.tsx
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
return <>{data && <ActualContent data={data} />}</>;

// ❌ 금지: inline {loading && <div>로딩 중...</div>} 혼용
// ❌ 금지: 컴포넌트마다 다른 spinner UI
```

### RULE-028: formatKRW 금액 포맷

```ts
// utils/formatters.ts — 유일한 금액 포맷 진입점
export const formatKRW = (amount: number): string =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(
    amount,
  );

// ❌ 금지: amount.toLocaleString(), `${amount}원`, 수동 콤마 삽입
// ❌ 금지: 서버에서 포맷된 문자열 수신 (숫자로 받아서 클라이언트 포맷)
```

### RULE-029: OTP 입력 UX 패턴

```tsx
// 1. 6개 별도 <input maxLength={1}> 박스 — aria-label="Authentication code digit {n}"
// 2. 각 박스에서 숫자 외 입력 즉시 차단 (onKeyDown에서 preventDefault)
// 3. 마지막 자리 입력 시 자동 제출 (OTP auto-submit, Story 2.3 AC)
// 4. 붙여넣기 허용 (onPaste에서 숫자만 추출하여 각 박스 배분)
// 5. 1초 debounce는 서버 측 — 프론트는 박스 disable만 담당
```

### RULE-030: BusinessConstants

```java
// core-common 모듈의 BusinessConstants 클래스에만 정의
public final class BusinessConstants {
    public static final long MAX_ORDER_AMOUNT_KRW  = 5_000_000L;
    public static final int  OTP_EXPIRY_SECONDS       = 600;  // ch:otp-attempts TTL (= order session TTL)
    public static final int  SESSION_EXPIRY_SECONDS   = 600;  // ch:order-session TTL
    public static final int  OTP_MAX_ATTEMPTS         = 3;
    private BusinessConstants() {}
}
// ❌ 금지: magic number 인라인 사용
```

### RULE-031: 표준 에러 응답 구조

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CORE-003",
    "message": "잔액이 부족합니다.",
    "detail": "Insufficient position for order",
    "timestamp": "2026-02-23T10:30:00Z"
  }
}
```

#### 비즈니스 에러 코드 표준 목록

> ⚠️ **이중 체계 주의**: `AUTH-xxx`는 Spring Security `AuthenticationException` 슬로에서만 사용하는 내부 코드. 
> API 응답 body의 모든 비즈니스 에러는 아래 `CHANNEL-xxx` / `CORE-xxx` / `FEP-xxx` / `SYS-xxx` 코드를 사용한다.

| 코드        | HTTP | 설명                      | 발생 위치        |
| ----------- | ---- | ------------------------- | ---------------- |
| CHANNEL-001 | 401  | 세션 없음/만료            | channel-service  |
| CHANNEL-002 | 422  | OTP 불일치                | channel-service  |
| CHANNEL-003 | 429  | OTP 시도 초과 (3회 초과 시) | channel-service  |
| CHANNEL-004 | 409  | 이미 진행 중인 주문 세션  | channel-service  |
| CHANNEL-005 | 400  | 주문 수량 유효성 오류     | channel-service  |
| RATE-001    | 429  | OTP 시도 디바운스 (1s burst guard 활성, 시도 횟수 미차감) | channel-service  |
| CORE-001    | 404  | 종목 없음                 | corebank-service |
| CORE-002    | 422  | 보유수량 부족                 | corebank-service |
| CORE-003    | 409  | 포지션 잠금 획득 실패       | corebank-service |
| CORE-004    | 500  | 트랜잭션 롤백 (내부 DB 오류)     | corebank-service |
| CORE-005    | 404  | 종목 코드 없음            | corebank-service |
| FEP-001     | 504  | FEP 응답 타임아웃 / HTTP 5xx (보상 트랜잭션 실행됨)         | corebank-service |
| FEP-002     | 422  | FEP 거부 응답 (REJECTED\_BY\_FEP, FIX ExecutionReport MsgType=j — 보상 트랜잭션 실행됨) | corebank-service |
| FEP-003     | 503  | FEP 서비스 불가 (CB Open — fallback 즉시 반환, FEP 호출 없음, 포지션 무변동) | corebank-service |
| SYS-001     | 500  | 내부 시스템 오류          | 전체             |
| ORD-004     | 422  | 종목코드 형식 오류 또는 수량 범위 초과 | channel-service  |
| ORD-007     | 409  | `clOrdID` 중복 — 멱등성 위반 (FR-22) | channel-service  |
| VALIDATION-001 | 422 | 요청 필드 유효성 오류 (`@Valid` 실패) | 전체             |

### RULE-032: FepClient 구현 패턴

```java
@Component
@Slf4j
public class FepClient {
    // @CircuitBreaker AOP 프록시 요구 → final 클래스 금지
    // RestClient 사용 (WebClient 금지 — D-011)

    @CircuitBreaker(name = "fep", fallbackMethod = "orderFallback")
    public FepOrderResponse requestOrder(FepOrderRequest req) { ... }

    private FepOrderResponse orderFallback(FepOrderRequest req, Exception ex) {
        // 항상 FEP_UNAVAILABLE 에러 코드 반환 (임의 성공 응답 금지)
    }
}
// ❌ 금지: RestTemplate 직접 사용, WebClient 사용, @CircuitBreaker 없는 FEP 호출
```

### RULE-033: 민감 데이터 마스킹

```java
// 로그에 민감 데이터 직접 출력 금지
// MaskingUtils.maskAccountNumber("110-123-456789") → "110-***-456789"
// 적용: 계좌번호, 주민번호, 전화번호

// @ToString.Exclude + @JsonIgnore 의무 적용:
// - Account.accountNumber (로그 출력 시 MaskingUtils 경유)
// - Member.password (절대 직렬화 금지)
```

### RULE-034: 시뮬레이션 코드 표시

```java
// [SIMULATION] FEP 응답을 실제 FEP 서버 없이 Mock 처리
// [SIMULATION] 계좌 잔액 업데이트를 Transaction 없이 Redis에서만 처리
// ❌ 금지: 시뮬레이션 로직이 실제 비즈니스 로직과 혼재
```

### RULE-035: ApiResponse<T> TypeScript 타입

```ts
// types/api.ts — 프로젝트 전역 단일 정의
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string; // 한국어
    detail: string; // 영어 기술
    timestamp: string; // ISO-8601
  } | null;
}
// axios 인터셉터에서 AxiosResponse<ApiResponse<T>> 언래핑
// ❌ 금지: any 타입 응답 처리, response.data 직접 접근 (인터셉터 우회)
```

### RULE-036: @Transactional 경계

```java
// ✅ 허용: @Service 클래스의 public 메서드
// ✅ 허용: @Transactional(readOnly = true) — 조회 전용 메서드 필수 표시
// ❌ 금지: @Controller/@RestController 메서드
// ❌ 금지: @Repository 구현 클래스
// ❌ 금지: private 메서드 (AOP 프록시 우회)
// ❌ 금지: 통합 테스트 클래스 레벨 (false green 방지)
// 특수: OrderSessionService의 Redis 연산 → @Transactional 미적용
```

### RULE-037: Resilience4j 설정 위치

```yaml
# application.yml에서만 — 코드 내 @Bean CircuitBreakerConfig 금지
resilience4j:
  circuitbreaker:
    instances:
      fep:
        slidingWindowSize: 3
        failureRateThreshold: 100
        waitDurationInOpenState: 10s
        permittedNumberOfCallsInHalfOpenState: 3
```

### RULE-038: 예외 계층 구조

```
FixException (abstract, RuntimeException)
├── BusinessException (비즈니스 규칙 위반 → 4xx)
│   ├── InvalidSessionStateException       → 409
│   ├── InsufficientBalanceException       → 422
│   ├── OtpVerificationException           → 422
│   ├── DailySellLimitExceededException → 422
│   └── AccountNotFoundException           → 404
└── SystemException (시스템 장애 → 5xx)
    ├── FepCommunicationException          → 503
    └── DataIntegrityException             → 500

// RULE-038: 위 계층 외 임의 예외 클래스 생성 금지
// GlobalExceptionHandler: BusinessException → 4xx, SystemException → 5xx 자동 매핑
```

### RULE-039: 서비스 메서드 시그니처

```java
// ✅ 올바른 패턴
public OrderResultResponse initiateOrder(InitiateOrderCommand command) { }
public SessionStatusResponse getSessionStatus(String sessionId) { }

// ❌ 금지: HttpServletRequest, BindingResult 등 웹 레이어 타입을 파라미터로
// ❌ 금지: 서비스에 Request DTO 직접 전달 (RULE-025 연계)
```

### RULE-040: bootRun/bootJar 모듈 제한

```groovy
// *-domain/build.gradle 필수:
bootJar { enabled = false }
jar     { enabled = true  }
// ❌ 금지: domain 모듈에서 bootJar 활성화
```

### RULE-041: Flyway 마이그레이션 파일

```sql
-- 파일명: V{N}__{snake_case}.sql (더블 언더스코어)
-- 예: V1__create_member_table.sql

-- 각 파일 상단 주석 필수:
-- Author: [이름]
-- Date: YYYY-MM-DD
-- Description: [변경 내용 한 줄]

-- ❌ 금지: 롤백 불가능한 컬럼 삭제 (MVP 기간)
-- ❌ 금지: 프로시저/트리거
-- 성능 기준: DDL 실행 < 3s
```

### RULE-042: SseEmitter 테스트 패턴

```java
@TestConfiguration
class TestAsyncConfig {
    @Bean(name = "taskExecutor")
    public Executor syncExecutor() {
        return new SyncTaskExecutor(); // @Async를 동기로 실행
    }
}
// MockMvc SSE 테스트:
// .andExpect(request().asyncStarted())
// .andExpect(content().contentType(MediaType.TEXT_EVENT_STREAM))
// ❌ 금지: Thread.sleep()으로 비동기 결과 대기
// ❌ 금지: SseEmitter.complete() 없이 테스트 종료
```

### RULE-043: QueryDSL 쿼리 위치

```java
// 단순 조회 → Spring Data JPA 메서드 (QueryDSL 금지)
// 복잡 조건 → QueryDSL (RepositoryImpl에만)

// QueryDSL 사용 기준:
// - WHERE 조건 3개 이상 동적 조합
// - LEFT JOIN 포함 조회
// - 집계 함수 (SUM, COUNT GROUP BY)

// ❌ 금지: @Query JPQL 해결 가능 쿼리에 QueryDSL 남용
// ❌ 금지: Service에서 JPAQueryFactory 직접 주입
```

### RULE-044: Security 필터 테스트 패턴

```java
// ✅ 인증 필요 엔드포인트 → @WithMockUser + MockMvc
// ✅ JWT 파싱 로직 → JwtProvider 단위 테스트
// ✅ 인증 실패 → MockMvc without @WithMockUser

@Test
@WithMockUser(username = "test-user-id", roles = "USER")
void 인증된_사용자는_주문_세션을_조회할_수_있다() { }

@Test
void 인증_없이_보호된_엔드포인트_접근시_401_반환() { }

// ❌ 금지: @TestConfiguration으로 Security 체인 완전 대체
```

### RULE-045: NotificationContext SSE Lifecycle

```tsx
// context/NotificationContext.tsx 필수 구현:
// 1. useEffect → new EventSource('/api/notifications/stream', { withCredentials: true })
// 2. 언마운트 시 eventSource.close() (cleanup 필수)
// 3. onerror → 재연결 backoff: 3s → 6s → 12s → 실패 상태 UI
// 4. onmessage → useReducer dispatch

// ❌ 금지: 개별 컴포넌트에서 EventSource 생성
// ❌ 금지: 무한 재연결 루프
```

### RULE-046: Order Flow useReducer 상태 타입

```ts
type OrderStep =
  | "INPUT"
  | "CONFIRM"
  | "OTP"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILURE"
  | "EXPIRED"; // 세션 만료 시 (백엔드 EXPIRED 응답) — "세션이 만료되었습니다. 다시 시작해 주세요." 문구 + RESET 유도

// 프론트엔드 OrderStep ⇔ 백엔드 OrderStatus 매핑 (P-B5)
// INPUT       : 세션 미생성 (클라이언트 상태만)
// OTP         : PENDING_NEW  (세션 생성 완료, 사용자 OTP 입력 대기)
// CONFIRM     : AUTHED       (OTP 검증 성공, 최종 주문 제출 대기)
// PROCESSING  : EXECUTING    (주문 실행 중)
// SUCCESS     : COMPLETED    (OrderSession 완료 / orders.status=FILLED)
// FAILURE     : FAILED       (주문 실패)
// EXPIRED     : EXPIRED      (세션 만료 — 타임아웃 또는 OTP 시도 초과)

type OrderAction =
  | { type: "PROCEED_TO_CONFIRM"; payload: OrderFormData }
  | { type: "REQUEST_OTP" }
  | { type: "SUBMIT_OTP"; payload: string }
  | { type: "FEP_RESULT"; payload: FepResult }
  | { type: "RESET" };

// ❌ 금지: step을 string으로 관리
// ❌ 금지: isConfirming, isOtpSent 등 boolean 플래그 별도 관리
```

### RULE-047: axios 단일 인스턴스

```ts
// lib/axios.ts — 단일 생성, 전역 공유
// 필수 설정:
// 1. baseURL: import.meta.env.VITE_API_BASE_URL
// 2. withCredentials: true
// 3. 요청 인터셉터: X-Correlation-Id 헤더 (crypto.randomUUID())
// 4. 응답 인터셉터: ApiResponse<T> 언래핑 + 401 → 로그인 리다이렉트

// ❌ 금지: axios.get() 직접 사용
// ❌ 금지: 컴포넌트마다 별도 인스턴스 생성
```

### RULE-048: application.yml 프로파일 구조

```
application.yml           — 공통 (모든 환경)
application-local.yml     — 로컬 Docker Compose
application-test.yml      — Testcontainers (CI)
application-prod.yml      — AWS EC2

// 민감 값 → 절대 하드코딩 금지
// 로컬: docker-compose.yml environment 주입
// 프로덕션: EC2 systemd 환경변수 또는 AWS Parameter Store
// 테스트: @DynamicPropertySource로 Testcontainers URL 주입
```

### RULE-049: .env / VITE\_ 환경변수

```bash
# .env.local       — 로컬 개발 (gitignore)
# .env.production  — Vercel 환경변수 UI 주입 (파일 커밋 금지)

# 필수 변수:
# VITE_API_BASE_URL=http://localhost:8080   (local)
# VITE_API_BASE_URL=https://api.fix.example.com  (prod)

# ❌ 금지: process.env 사용 (Vite 미지원)
# ❌ 금지: VITE_ 접두사 없는 변수
# ❌ 금지: .env.production 파일 git 커밋
```

### RULE-050: Conventional Commits

```
# 형식: <type>(<scope>): <subject>
#
# type: feat | fix | refactor | test | docs | chore | style
# scope: channel | corebank | fep-gateway | fep-simulator | core-common | frontend | infra | ci
#
# 예시:
# feat(channel): add OTP verification endpoint
# fix(corebank): resolve pessimistic lock timeout on order
# test(channel): add @ParameterizedTest for OTP boundary cases

# ❌ 금지: "fix bug", "update code", "WIP"
# ❌ 금지: 한 커밋에 여러 scope 혼합
```

### RULE-051: 브랜치 네이밍

```
main                              — 항상 배포 가능
feat/<scope>/<short-desc>         — 기능 개발
fix/<scope>/<short-desc>          — 버그 수정
chore/<desc>                      — 설정/인프라

# 예: feat/channel/otp-verification
# 브랜치 수명: 최대 2일 (trunk-based)
# PR squash merge 권장
# ❌ 금지: main 직접 push
```

### RULE-052: 로컬 개발 환경 세팅 순서

```bash
# 1. docker compose up -d mysql redis     # 인프라 먼저
# 2. ./gradlew :channel-service:bootRun   # Flyway 자동 실행
# 3. pnpm install && pnpm dev             # 프론트엔드

# 헬스체크: GET http://localhost:8080/actuator/health → {"status":"UP"}
# ❌ 금지: 서비스 먼저 기동 후 DB 연결 실패
# ❌ 금지: actuator endpoint를 prod에서 public 노출 (RULE-068 연계)
```

### RULE-053: JPA N+1 방지

```java
// application.yml 필수:
// spring.jpa.properties.hibernate.default_batch_fetch_size: 100
// spring.jpa.open-in-view: false  (필수 명시)

// ✅ 연관 엔티티 함께 조회: @EntityGraph 또는 fetch join
// ✅ QueryDSL: .leftJoin(account.member, member).fetchJoin()
// ❌ 금지: @OneToMany 컬렉션 EAGER 로딩
// ❌ 금지: 루프 내부에서 연관 엔티티 접근
```

### RULE-054: Redis 캐싱 전략

```java
// @Cacheable 적용 대상 (MVP):
// - 계좌 기본 정보 조회 (TTL 60s)
// - 종목코드 유효성 결과 (TTL 30s)

// 캐시 키: {service}:{entity}:{id} (예: corebank:account:ACC-001)
// ❌ 금지: 포지션, 주문 상태 등 실시간 데이터에 @Cacheable
// ❌ 금지: @CacheEvict 없는 @Cacheable

// application.yml:
// spring.cache.type: redis
// spring.cache.redis.time-to-live: 60000
```

### RULE-055: 인덱스 전략

```sql
-- WHERE 절 자주 사용 컬럼: 단일 인덱스
-- 복합 조건: 복합 인덱스 (카디널리티 높은 것 먼저)
-- 명명: idx_{table}_{columns}
-- ❌ 금지: 모든 컬럼에 인덱스 (Insert 성능 저하)
-- ❌ 금지: EXPLAIN 없이 V2+ 마이그레이션 인덱스 추가
```

### RULE-056: 도메인 용어 Glossary

| 한국어      | 영어 (코드 사용)         | ❌ 금지 동의어                   |
| ----------- | ------------------------ | -------------------------------- |
| 주문        | Order                    | Transfer, Transaction, Remittance |
| 주문 세션   | OrderSession             | OrderTransaction, TxSession   |
| 계좌        | Account                  | BankAccount, BankAcc             |
| 회원/고객   | Member                   | User, Customer, Client           |
| 포지션        | Position                 | Balance, Amount (단독), Funds    |
| 매도 주문   | SellOrder (side=SELL)    | Withdrawal, Debit                |
| 매수 주문   | BuyOrder (side=BUY)      | Deposit, Credit                  |
| OTP         | Otp (클래스), otp (변수) | OneTimePassword, Pin             |
| 인증        | Authentication           | Verification (코드 내)           |
| FEP 연동    | FepRequest/FepResponse   | ExternalRequest, BankRequest     |
| 매도 한도   | DailySellLimit           | MaxTransfer, TransferCap         |
| 회로 차단기 | CircuitBreaker           | Breaker, CB                      |

### RULE-058: 페이지네이션/정렬 패턴

```java
@GetMapping("/orders")
public ApiResponse<Page<OrderSummaryResponse>> getOrders(
    @PageableDefault(size = 20, sort = "createdAt", direction = DESC) Pageable pageable
) { ... }

// 응답: content, totalElements, totalPages, number(0-based), size
// ❌ 금지: offset/limit 직접 파라미터
// ❌ 금지: size > 100 허용
```

### RULE-059: Jib Docker 이미지 빌드

```groovy
plugins {
    id 'com.google.cloud.tools.jib' version '3.4.0'
}
jib {
    from { image = 'eclipse-temurin:21-jre-alpine' }
    to   { image = "fix/${project.name}:${version}" }
    container {
        jvmFlags = ['-Xmx512m', '-Dspring.profiles.active=prod']
        ports = ['8080']
    }
}
// ❌ 금지: fat JAR COPY 단순 Dockerfile
// ❌ 금지: root 유저로 컨테이너 실행
```

### RULE-060: Swagger/OpenAPI 설정

```yaml
# application-local.yml:
# springdoc.api-docs.enabled: true
# application-prod.yml:
# springdoc.api-docs.enabled: false  (필수 비활성화)

# SecurityConfig: /swagger-ui/**, /v3/api-docs/** → local만 permitAll
# Canonical API docs serving endpoint: GitHub Pages (`https://<org>.github.io/<repo>/`) via docs-publish workflow
# ✅ @Operation(summary, description) — 모든 public 엔드포인트
# ❌ 금지: prod 배포 후 /v3/api-docs 외부 노출
```

### RULE-061: API 버전 관리

```java
// 모든 컨트롤러: @RequestMapping("/api/v1/...")
// MVP 기간: v1 고정, v2 없음
// 버전 업 기준: 기존 응답 구조 파괴적 변경 시만
// ❌ 금지: 컨트롤러마다 다른 버전
// ❌ 금지: Header 기반 버전 관리
// ❌ 금지: /api/ 없는 경로 직접 노출
```

### RULE-062: FIX 테스트 피라미드

```
Layer 3 — E2E: 0개 (MVP 제외, 수동 검증)
Layer 2 — 통합 테스트 (*IntegrationTest.java)
  └ @SpringBootTest + MockMvc + Testcontainers + WireMock
  └ 목표: Happy Path 1 + 주요 에러 케이스 2/엔드포인트
Layer 1 — 단위 테스트 (*Test.java)
  └ JUnit 5 + Mockito + AssertJ
  └ 서비스 레이어 커버리지 목표 ≥ 80%
Layer 0 — 정적 분석 (경고만, 빌드 실패 없음)

// 원칙: 통합 테스트 > 단위 테스트 (실제 DB 사용 가능)
// ❌ 금지: @WebMvcTest Controller 단위 테스트
```

### RULE-063: WireMock 설정

```java
// testing-support 모듈에 WireMockIntegrationTest 추상 클래스 제공
public abstract class WireMockIntegrationTest {
    protected static WireMockServer wireMockServer;

    @BeforeAll static void startWireMock() {
        wireMockServer = new WireMockServer(options().dynamicPort());
        wireMockServer.start();
    }
    @AfterAll  static void stopWireMock() { wireMockServer.stop(); }
    @BeforeEach void resetMappings()      { wireMockServer.resetAll(); }
}
// ❌ 금지: @MockBean FepClient (실제 HTTP 통신 패턴 검증 불가)
// ❌ 금지: 각 테스트마다 WireMockServer 새로 생성
```

### RULE-064: 테스트 메서드 명명

```java
// 한국어 메서드명 허용 (가독성 우선)
@Test void 잔액_부족_시_InsufficientBalanceException_발생() { }
@Test void 주문_요청_성공_시_200_응답과_세션ID_반환() { }
@Test void 보유수량_부족_주문_시_422_응답과_CORE002_에러_코드_반환() { }

// ❌ 금지: testTransfer(), test1(), shouldWork()
```

### RULE-065: React Hook Form + Zod

```tsx
const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<OrderFormData>({ resolver: zodResolver(orderSchema) });

// Zod 스키마 위치: lib/schemas/order.schema.ts
// 에러 표시: <span role="alert">{errors.amount?.message}</span>
// ❌ 금지: onSubmit 수동 유효성 검사
// ❌ 금지: useState로 각 필드 에러 개별 관리
```

### RULE-066: Tailwind 반응형 breakpoint

```
// FIX: 데스크톱 우선 (증권사 시뮬레이터)
// 최소 지원: 768px | 컨테이너 최대: max-w-2xl mx-auto
// md: (768px~) | lg: (1024px~) | sm: (640px~)
// ❌ 금지: px 직접 사용 (style={{ width: '500px' }})
// ❌ 금지: 모바일 전용 뷰 별도 구현 (MVP 범위 초과)
```

### RULE-067: 접근성 최소 요건

```tsx
// 필수 항목:
// 1. 버튼: aria-label (아이콘만)
// 2. 입력 필드: <label htmlFor> 연결 or aria-label
// 3. 에러 메시지: role="alert"
// 4. 로딩 상태: aria-busy="true"
// 5. 모달: role="dialog" + aria-modal="true"

// <input aria-label="주문 수량 (주)" inputMode="numeric" />
// ❌ 금지: <div onClick={}> — button 사용
// ❌ 금지: 색상만으로 정보 전달
```

### RULE-068: Actuator 보안 설정

```yaml
management:
  server:
    port: 8090 # 관리 포트 분리 (8081은 corebank-service 앱 포트 — 충돌 방지)
  endpoints:
    web:
      exposure:
        include: health,info,metrics   # MVP: prometheus 제외 (post-MVP Future Enhancement)
  endpoint:
    health:
      show-details: when-authorized

# EC2 SG: 8090 포튨 외부 미개방
# ❌ 금지: include: "*"
# ❌ 금지: management.port = 8080 (동일 포트)
# ❌ 금지: management.port = 8081 (corebank-service 앱 포트와 충돌)
```

### RULE-069: Graceful Shutdown

```yaml
# application.yml:
server:
  shutdown: graceful
spring:
  lifecycle:
    timeout-per-shutdown-phase: 30s

# docker-compose.yml:
# stop_grace_period: 35s

# 이유: 주문 체결 중 강제 종료 → EXECUTING 상태 고착 방지
# OrderSessionRecoveryService @PostConstruct: 재시작 후 EXECUTING 세션 → FAILED 전환
```

### RULE-070: HikariCP 커넥션 풀 (EC2 t3.small)

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10 # 2vCPU × 5
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000

# Redis:
# spring.data.redis.lettuce.pool.max-active: 8
# 4서비스 × 10 = 40 connections < MySQL max_connections 151 (안전)
# ❌ 금지: maximum-pool-size > 20
```

### RULE-071: 주문 요청 Idempotency (ClOrdID)

```java
// 헤더: X-ClOrdID: <client UUID v4>  (FIX Tag 11 새셸)
// Redis: SET ch:idempotency:{clOrdID} {orderSessionId} NX EX 600
// NX 성공 → 신규 처리
// NX 실패 → 기존 orderSessionId 반환 (200, 재처리 없음)

// ✅ 적용 대상: POST /api/v1/orders/sessions만
// ❌ 금지: 모든 POST에 적용 (Over-engineering)
```

### RULE-072: OrderSession 만료 처리

```java
// Redis TTL 만료 = 세션 자연 소멸 → CHANNEL-001 반환

// @PostConstruct — 재시작 즉시 복구 (서비스 재배포 시 고착 세션 즉시 처리)
//   → EXECUTING 상태인 세션을 스캔 후 FAILED 전환 (멱등성 보장: EXECUTING인 경우만)

// @Scheduled(fixedDelay = 60s) — 런타임 주기 감시 (이상 상태 감지)
//   → EXECUTING + created_at > 10분 → FAILED 강제 전환
//   → PENDING_NEW + created_at > 10분 → EXPIRED 전환
//   → AUTHED   + created_at > 10분 → EXPIRED 전환
//   멱등성 보장: 해당 상태인 경우만 전환, DB 업데이트 실패 시 에러 로그 후 skip
// DB 정합성 유지 — Redis TTL 자연 소멸만으로는 DB에 상태가 영구 잔존할 수 있음
```

### RULE-073: 포지션 동시성 3중 보호

```
1. Redis SETNX order execute lock: SET ch:txn-lock:{sessionId} NX EX 30 (RULE-026)
2. JPA @Lock(PESSIMISTIC_WRITE) on PositionRepository.findBySymbolWithLock (ADR-001)
3. @Transactional(isolation = REPEATABLE_READ)

// 락 획득 실패 시 재시도 없음 → 즉시 CORE-003 반환
// ❌ 금지: 낙관적 락(@Version)으로 대체 — ADR-001 위반
```

### RULE-074: 서비스 배포 순서 (AWS EC2)

```bash
# 배포 순서:
# 1. corebank-service (Flyway 실행)
# 2. fep-gateway
# 3. fep-simulator
# 4. channel-service

docker compose pull
docker compose up -d corebank-service
# healthcheck 확인 후:
docker compose up -d fep-gateway
docker compose up -d fep-simulator
docker compose up -d channel-service

# 롤백: docker compose up -d --no-deps {service}:{이전_태그}
# ❌ 금지: docker compose up -d (전체 동시 기동)
```

### RULE-075: docker-compose healthcheck 표준

```yaml
services:
  mysql:
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s # InnoDB + Flyway 초기화 대기

  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  corebank-service:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/actuator/health"]  # P-E2: 8081은 앱 포트 — management port 8090 사용 (RULE-068)
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 60s # Spring Boot 기동 시간 고려
    depends_on:
      mysql: { condition: service_healthy }
      redis: { condition: service_healthy }

# ❌ 금지: depends_on 없는 서비스 정의
# ❌ 금지: start_period 없는 Spring 서비스
```

---

### RULE-076: 인증 상태 Zustand useAuthStore 패턴

```ts
// store/useAuthStore.ts — Zustand 전역 인증 스토어
import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  member: Member | null;
  login: (member: Member) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  member: null,
  login: (member) => set({ isAuthenticated: true, member }),
  logout: () => set({ isAuthenticated: false, member: null }),
}));

// 소비 패턴:
// hooks/useAuth.ts: export const useAuth = () => useAuthStore();
// 컴포넌트:        const { isAuthenticated, login } = useAuth();
// axios 인터셉터:  useAuthStore.getState().logout();  ← Context 없이 호출 가능

// ✅ Zustand 장점: Provider 불필요, 인터셉터에서 직접 접근 가능
// ❌ 금지: 인증 상태를 컴포넌트 useState 또는 AuthContext.Provider로 관리
// ❌ 금지: useAuthStore를 NotificationContext 등 다른 Context에 중첩

// 📌 앱 시작 시 세션 복원 (P-C1):
//    App.tsx useEffect(() => {
//      api.get<Member>('/auth/me')
//        .then(({ data }) => login(data))
//        .catch(() => {});   // 미인증 무시 — 로그인 페이지로 redirect는 PrivateRoute가 처리
//    }, []);
//    → 새로고침 후 Zustand 초기화, HTTP-only 쿠키 유효 시 isAuthenticated: true 복원
```

---

### 파일 생성 보일러플레이트

```java
// Java Service 최소 구조:
@Slf4j
@Service
@RequiredArgsConstructor
public class XxxService {
    // 1. final 필드 (의존성)
    // 2. public 메서드 (외부 계약)
    // 3. private 메서드 (내부 구현)
}
```

```tsx
// React 컴포넌트 최소 구조:
// 1. import (external → internal → styles)
// 2. type Props = { ... }
// 3. export default function XxxPage({ ... }: Props) { }
// 4. 내부 헬퍼 함수 (컴포넌트 내부에 위치)
```

---

### MDC 로그 포맷 표준

```json
{
  "@timestamp": "2026-02-23T10:30:00.000Z",
  "level": "INFO",
  "logger": "com.fix.channel.service.OrderService",
  "message": "Order session state transition: AUTHED → EXECUTING",
  "traceId": "abc123",
  "spanId": "def456",
  "userId": "user-uuid",
  "sessionId": "sess-uuid",
  "stack_trace": null
}
// MDC 설정: OncePerRequestFilter → finally 블록에서 MDC.clear()
// 로그 레벨: ERROR=시스템 장애 | WARN=비즈니스 위반 | INFO=상태 전환 | DEBUG=prod 비활성
```

---

### PR 체크리스트

**백엔드:**

- [ ] RULE-020: @Service/@Repository/@Component 바르게 사용
- [ ] RULE-021: API DTO가 record로 정의
- [ ] RULE-022: 경계값 테스트에 @ParameterizedTest 사용
- [ ] RULE-023: assertThat 사용 (assertEquals 금지)
- [ ] RULE-024: 모듈 의존성 방향 올바름
- [ ] RULE-025: Controller가 Entity 직접 반환하지 않음
- [ ] RULE-030: 비즈니스 규칙 상수 → BusinessConstants
- [ ] RULE-036: @Transactional → Service public 메서드만
- [ ] RULE-056: 도메인 용어 Glossary 준수

**프론트엔드:**

- [ ] RULE-027: 로딩/에러 → AsyncStateWrapper 패턴
- [ ] RULE-028: 금액 → formatKRW() 사용
- [ ] RULE-035: ApiResponse<T> 타입 사용
- [ ] RULE-047: lib/axios.ts 인스턴스 사용

---

### Definition of Done — 패턴 준수 기준

1. 해당 레이어 RULE 전체 준수
2. 단위 테스트 커버리지 ≥ 80% (서비스 레이어)
3. 통합 테스트: Happy Path 1개 + 주요 에러 케이스 최소 1개
4. PR 체크리스트 모든 항목 확인
5. `architecture.md` 패턴과 상충 코드 없음

---

### Day 1 Quick Start 체크리스트

- [ ] 1. Decision Index에서 관련 D-XXX/RULE-XXX 확인
- [ ] 2. Glossary에서 도메인 용어 확인 (RULE-056)
- [ ] 3. 레이어 흐름 확인: Controller → Service → Repository
- [ ] 4. 모듈 의존성 방향 확인 (RULE-024)
- [ ] 5. DTO record 사용 여부 (RULE-021)
- [ ] 6. 비즈니스 상수 → BusinessConstants (RULE-030)
- [ ] 7. 에러 코드 표준 목록에서 코드 선택 (RULE-031)
- [ ] 8. 테스트: assertThat + @ParameterizedTest 해당 여부 (RULE-022, 023)
- [ ] 9. 프론트: ApiResponse<T> + formatKRW (RULE-035, 028)
- [ ] 10. PR 전: PR 체크리스트 전항목 확인

---

### 패턴 예외 처리

RULE 위반이 정당화되는 경우 (성능 최적화, 외부 라이브러리 제약):

1. 코드 내 주석: `// PATTERN-EXCEPTION: [이유] [날짜]`
2. ADR 문서 생성 (ADR-XXX 형식)
3. `architecture.md` Intentional Simplifications 섹션 업데이트

---

### YAGNI — MVP에서 구현 금지 목록

- ❌ Kafka/이벤트 버스 (NotificationPublisher 제거 — Step 2 결정)
- ❌ Redis Pub/Sub 클러스터링
- ❌ Spring WebFlux/Reactive (D-002 결정)
- ❌ 서비스 디스커버리 (Eureka 등)
- ❌ CQRS 패턴
- ❌ Saga 오케스트레이터
- ❌ OAuth2 외부 제공자 (Keycloak — Step 2 결정)
- ❌ Kubernetes (EC2 Docker Compose로 충분)
- ❌ 전문 APM (Datadog/NewRelic — Actuator+prometheus로 충분)
- ❌ JPA Multi-tenancy

---

### AI 에이전트 강제 체크포인트 15개

코드 생성 시 아래 위반 발견 즉시 재생성:

1. RULE-021: DTO는 record, Entity는 class
2. RULE-024: 모듈 의존성 방향 위반 없음
3. RULE-025: Controller → DTO 변환 위치 준수
4. RULE-030: 비즈니스 규칙 상수 → BusinessConstants만
5. RULE-036: @Transactional → Service public 메서드만
6. RULE-038: 예외 → FixException 계층 내에서만
7. RULE-056: 도메인 용어 Glossary 준수
8. RULE-035: ApiResponse<T> 타입 사용
9. RULE-046: OrderStep union type + useReducer
10. RULE-047: lib/axios.ts 단일 인스턴스
11. RULE-028: 금액 → formatKRW()만
12. RULE-065: 폼 → React Hook Form + Zod
13. RULE-048/049: 환경변수 관리 — 민감값 yml 하드코딩 금지(백엔드), `.env.production` git 커밋 금지(프론트)
14. RULE-068: Actuator management port → 8090 (8081은 corebank-service 앱 포트 — 충돌 금지)
15. RULE-069: Graceful Shutdown → 30s 설정
16. RULE-076: 인증 상태 → `useAuthStore()` (Zustand) 사용, AuthContext 금지

---

### 문서 유지보수 규칙

- 새 RULE 추가 시: Decision Index 업데이트 필수
- 새 ADR 생성 시: 관련 D-XXX에 `→ [ADR-XXX]` 참조 추가
- 구현 중 패턴 변경 발견 시: `progress.md`에 기록 후 다음 스프린트 반영
- `revision` frontmatter: 의미 있는 변경마다 +1
- PATTERN-EXCEPTION 주석 사용 시: ADR 생성 + Intentional Simplifications 업데이트

---

## Project Structure & Boundaries

> **작성 기준일:** 2026-02-23 | **Party Mode:** 9 라운드 (에이전트 10인 참여)
> **핵심 수정:** Flyway 위치(R1), FepClient 위치(R1), fep-domain 폐기(R6), D-017 패키지 통일(R8)

### 아키텍처 결정 업데이트 기록 (Step 6)

| 항목              | 변경 전                    | 변경 후                  | 이유                                     |
| ----------------- | -------------------------- | ------------------------ | ---------------------------------------- |
| D-017 패키지      | `io.github.yeongjae.fix.*` | `com.fix.*`              | 포트폴리오 프로젝트에 OSS 배포 관례 과분 |
| fep-domain 모듈   | 별도 Gradle 모듈           | fep-simulator 내부 패키지  | corebank가 공유 불필요                 |
| Flyway channel_db | corebank-service 아래      | channel-service 아래     | 스키마 소유권 정정                       |
| FepClient 위치    | fep-gateway/client/        | corebank-service/client/ | 호출자가 소유                            |

---

### 최종 확정 Gradle 모듈 구조 (8개)

| 모듈               | 역할                | Spring Boot | 포트 | Flyway        | QueryDSL APT |
| ------------------ | ------------------- | ----------- | ---- | ------------- | ------------ |
| `core-common`      | 공통 상수/예외/유틸 | ❌          | —    | ❌            | ❌           |
| `testing-support`  | TC/WireMock 공유    | ❌          | —    | ❌            | ❌           |
| `channel-domain`   | 채널 JPA Entity     | ❌          | —    | ❌            | ❌           |
| `channel-service`  | 채널 서비스 진입점  | ✅          | 8080 | ✅ channel_db | ❌           |
| `corebank-domain`  | 코어뱅킹 Entity     | ❌          | —    | ❌            | ✅           |
| `corebank-service` | 코어뱅킹 진입점     | ✅          | 8081 | ✅ core_db    | ❌           |
| `fep-gateway`      | FEP 게이트웨이      | ✅          | 8083 | ❌            | ❌           |
| `fep-simulator`    | FEP 시뮬레이터      | ✅          | 8082 | ❌            | ❌           |

---

### 완전한 프로젝트 디렉토리 트리

```
fix/                                          # 모노레포 루트
├── .github/
│   └── workflows/
│       ├── ci-channel.yml                    # matrix job 1
│       ├── ci-corebank.yml                   # matrix job 2
│       ├── ci-fep-gateway.yml                # matrix job 3
│       ├── ci-fep-simulator.yml              # matrix job 4
│       └── ci-frontend.yml                   # Vite + Vitest (R2)
├── .gitignore                                # *.env, build/, .gradle/, node_modules/
├── README.md                                 # Quick Start, 아키텍처 개요
├── CONTRIBUTING.md                           # 브랜치/커밋/PR 컨벤션 (R6)
├── docker-compose.yml                        # mysql, redis, 4서비스 + 네트워크
├── docker-compose.override.yml               # 로컬 포트 바인딩 (gitignore)
├── .env.example                              # 모든 환경변수 키 (값 빈칸)
├── build.gradle                              # 루트 공통 설정 (subprojects)
├── settings.gradle                           # 7개 모듈 include
├── gradle.properties                         # JVM args, parallel, caching
├── gradle/
│   ├── libs.versions.toml                    # 버전 카탈로그 (R6)
│   └── wrapper/
│       └── gradle-wrapper.properties
├── gradlew / gradlew.bat
├── config/
│   └── checkstyle/
│       └── checkstyle.xml                    # 경고만 (RULE-057 거부 반영)
├── scripts/                                  # 운영 스크립트 (R5)
│   ├── deploy.sh                             # EC2 SSH 배포 (RULE-074 순서)
│   ├── rollback.sh
│   └── seed-reset.sh
│
├── core-common/
│   ├── build.gradle                          # java-library (Spring 의존성 없음)
│   └── src/main/java/com/fix/common/
│       ├── constants/
│       │   ├── BusinessConstants.java         # RULE-030 (주문한도, OTP TTL 등)
│       │   └── HttpConstants.java             # X-Internal-Secret 등 헤더 상수 (R1)
│       ├── entity/
│       │   └── BaseTimeEntity.java            # @MappedSuperclass (R8)
│       ├── exception/
│       │   ├── FixException.java              # abstract root (RULE-038)
│       │   ├── BusinessException.java
│       │   ├── SystemException.java
│       │   ├── InvalidSessionStateException.java   → 409
│       │   ├── InsufficientBalanceException.java   → 422
│       │   ├── OtpVerificationException.java       → 422
│       │   ├── DailySellLimitExceededException     → 422
│       │   ├── AccountNotFoundException.java       → 404
│       │   ├── FepCommunicationException.java      → 503
│       │   └── DataIntegrityException.java         → 500
│       ├── dto/
│       │   └── ApiResponse.java               # { success, data, error } RULE-031
│       └── util/
│           └── MaskingUtils.java              # RULE-033
│
├── testing-support/
│   ├── build.gradle
│   └── src/main/java/com/fix/testing/
│       ├── config/
│       │   ├── TestContainersConfig.java      # Singleton MySQL+Redis (R1)
│       │   └── TestAsyncConfig.java           # SyncTaskExecutor RULE-042
│       ├── fixture/
│       │   ├── MemberFixture.java
│       │   ├── PositionFixture.java
│       │   └── OrderSessionFixture.java
│       ├── wiremock/
│       │   └── WireMockIntegrationTest.java   # RULE-063
│       └── assertion/
│           └── ApiResponseAssertions.java     # assertSuccess/assertError (R4)
│
├── channel-domain/
│   ├── build.gradle                           # bootJar disabled (RULE-040)
│   └── src/
│       ├── main/java/com/fix/channel/domain/
│       │   ├── entity/
│       │   │   ├── Member.java
│       │   │   └── OrderSession.java           # R8: 핵심 필드 명시
│       │   ├── vo/
│       │   │   └── OrderSessionStatus.java     # PENDING_NEW/AUTHED/EXECUTING/COMPLETED/FAILED/EXPIRED
│       │   └── repository/
│       │       ├── MemberRepository.java
│       │       └── OrderSessionRepository.java
│       └── test/java/com/fix/channel/domain/
│
├── channel-service/
│   ├── build.gradle
│   └── src/
│       ├── main/
│       │   ├── java/com/fix/channel/
│       │   │   ├── ChannelApplication.java
│       │   │   ├── config/
│       │   │   │   ├── SecurityConfig.java     # Spring Session + CORS + CookieCsrfTokenRepository + permitAll
│       │   │   │   ├── CorsConfig.java         # profile별 allowedOrigins (R5)
│       │   │   │   ├── SessionConfig.java      # @EnableRedisHttpSession + SpringSessionBackedSessionRegistry (R5)
│       │   │   │   ├── JpaConfig.java          # @EnableJpaAuditing (R5)
│       │   │   │   ├── RedisConfig.java
│       │   │   │   ├── RestClientConfig.java   # CoreBankClient용 RestClient
│       │   │   │   ├── AsyncConfig.java        # @EnableAsync + ThreadPoolTaskExecutor
│       │   │   │   ├── SchedulerConfig.java    # @EnableScheduling (R1/R4)
│       │   │   │   └── RateLimitConfig.java    # Bucket4j (R4)
│       │   │   ├── controller/
│       │   │   │   ├── AuthController.java     # /api/v1/auth/** (POST /login, POST /logout, POST /register, GET /csrf, GET /session)
│       │   │   │   ├── OrderController.java # /api/v1/orders/**
│       │   │   │   ├── NotificationController.java   # /api/v1/notifications/stream
│       │   │   │   └── AdminController.java    # GET /api/v1/admin/audit-logs, DELETE /api/v1/admin/members/{memberId}/sessions (ROLE_ADMIN R4)
│       │   │   ├── service/
│       │   │   │   ├── AuthService.java
│       │   │   │   ├── OtpService.java
│       │   │   │   ├── OrderSessionService.java     # transition() RULE-026
│       │   │   │   ├── OrderExecutionService.java   # Saga orchestrator (Channel ⇔ CoreBanking)
│       │   │   │   ├── SseNotificationService.java   # @Async
│       │   │   │   ├── AuditLogService.java    # R4
│       │   │   │   └── OrderSessionRecoveryService.java  # @Scheduled RULE-072
│       │   │   ├── dto/
│       │   │   │   ├── request/
│       │   │   │   │   ├── LoginRequest.java         # record
│       │   │   │   │   ├── OtpVerifyRequest.java     # record
│       │   │   │   │   └── PrepareOrderRequest.java  # record (ClOrdID, symbol, side, qty)
│       │   │   │   ├── response/
│       │   │   │   │   ├── LoginResponse.java        # record
│       │   │   │   │   ├── OrderSessionResponse.java # orderSessionId, status, clOrdID
│       │   │   │   │   ├── SessionStatusResponse.java
│       │   │   │   │   └── AuditLogResponse.java     # record (R4)
│       │   │   │   └── command/
│       │   │   │       └── PrepareOrderCommand.java  # record (RULE-039)
│       │   │   ├── security/
│       │   │   │   ├── JwtProvider.java
│       │   │   │   ├── JwtAuthenticationFilter.java  # OncePerRequestFilter + MDC
│       │   │   │   └── CustomUserDetailsService.java
│       │   │   ├── filter/
│       │   │   │   └── RateLimitFilter.java    # login/OTP/order-prepare (R4)
│       │   │   ├── client/
│       │   │   │   └── CoreBankClient.java     # RestClient 래퍼 → corebank-service
│       │   │   └── exception/
│       │   │       └── GlobalExceptionHandler.java
│       │   └── resources/
│       │       ├── application.yml
│       │       ├── application-local.yml
│       │       ├── application-test.yml        # @DynamicPropertySource 전용
│       │       ├── application-prod.yml
│       │       ├── logback-spring.xml           # D-010 구조화 로깅 (R3)
│       │       └── db/
│       │           ├── migration/
│       │           │   ├── V0__create_member_table.sql
│       │           │   ├── V1__create_order_session_table.sql
│       │           │   ├── V2__create_audit_log_table.sql    # R4
│       │           │   └── V3__create_notification_table.sql # R9
│       │           └── seed/
│       │               └── R__seed_data.sql                  # test/dev profile용 (반복 실행)
│       └── test/
│           ├── unit/com/fix/channel/
│           │   ├── service/
│           │   │   ├── AuthServiceTest.java
│           │   │   ├── OtpServiceTest.java
│           │   │   └── OrderSessionServiceTest.java  # Scenario #3
│           │   └── security/
│           │       └── JwtProviderTest.java
│           └── integration/com/fix/channel/
│               ├── ChannelIntegrationTestBase.java      # R1
│               └── controller/
│                   ├── AuthControllerIntegrationTest.java        # Scenario #6
│                   ├── OrderControllerIntegrationTest.java       # Scenario #1
│                   ├── NotificationControllerIntegrationTest.java
│                   └── IdempotencyIntegrationTest.java           # Scenario #4 (R4)
│
├── corebank-domain/
│   ├── build.gradle                           # annotationProcessor (RULE-043)
│   └── src/
│       ├── main/java/com/fix/corebank/domain/
│       │   ├── entity/
│       │   │   ├── Account.java               # @ToString.Exclude (RULE-033)
│       │   │   └── OrderHistory.java
│       │   ├── repository/
│       │   │   ├── AccountRepository.java     # @Lock(PESSIMISTIC_WRITE)
│       │   │   ├── AccountRepositoryCustom.java
│       │   │   └── AccountRepositoryImpl.java  # QueryDSL (RULE-043)
│       │   └── vo/
│       │       └── AccountStatus.java
│       └── test/
│
├── corebank-service/
│   ├── build.gradle
│   └── src/
│       ├── main/
│       │   ├── java/com/fix/corebank/
│       │   │   ├── CoreBankApplication.java
│       │   │   ├── config/
│       │   │   │   ├── SecurityConfig.java    # X-Internal-Secret 검증
│       │   │   │   ├── JpaConfig.java         # @EnableJpaAuditing + JPAQueryFactory (R5)
│       │   │   │   └── RedisConfig.java
│       │   │   ├── controller/
│       │   │   │   ├── AccountController.java
│       │   │   │   └── OrderController.java
│       │   │   ├── service/
│       │   │   │   ├── AccountService.java    # @Transactional(readOnly=true)
│       │   │   │   └── OrderService.java      # @Lock PESSIMISTIC_WRITE ADR-001
│       │   │   ├── dto/
│       │   │   │   ├── request/
│       │   │   │   │   └── OrderExecuteRequest.java
│       │   │   │   └── response/
│       │   │   │       ├── AccountResponse.java
│       │   │   │       └── OrderExecuteResponse.java
│       │   │   ├── client/
│       │   │   │   └── FepClient.java         # @CircuitBreaker RULE-032 (R1 이동)
│       │   │   ├── security/
│       │   │   │   └── InternalSecretFilter.java  # X-Internal-Secret (R1)
│       │   │   └── exception/
│       │   │       └── GlobalExceptionHandler.java
│       │   └── resources/
│       │       ├── application.yml
│       │       ├── application-local.yml
│       │       ├── application-test.yml
│       │       ├── application-prod.yml
│       │       ├── logback-spring.xml
│       │       └── db/
│       │           ├── migration/
│       │           │   ├── V1__create_member_table.sql
│       │           │   ├── V2__create_account_table.sql
│       │           │   └── V3__create_order_history_table.sql
│       │           └── seed/
│       │               └── R__seed_data.sql   # Repeatable (R2/R4)
│       └── test/
│           ├── unit/com/fix/corebank/service/
│           │   ├── AccountServiceTest.java
│           │   └── OrderServiceTest.java
│           └── integration/com/fix/corebank/
│               ├── CoreBankIntegrationTestBase.java          # R5
│               └── controller/
│                   ├── AccountControllerIntegrationTest.java
│                   ├── OrderControllerIntegrationTest.java
│                   ├── ConcurrentOrderIntegrationTest.java    # Scenario #2 (R4)
│                   ├── FepCircuitBreakerIntegrationTest.java  # Scenario #5 (R4)
│                   └── LedgerIntegrityIntegrationTest.java    # Scenario #7 (R4)
│
├── fep-simulator/                             # fep-domain 흡수 (R6)
│   ├── build.gradle
│   └── src/
│       ├── main/
│       │   ├── java/com/fix/fep/
│       │   │   ├── FepApplication.java
│       │   │   ├── domain/                    # fep-domain 내부 통합 (R6)
│       │   │   │   ├── vo/FepOrderStatus.java
│       │   │   │   ├── dto/FepOrderRequest.java
│       │   │   │   └── dto/FepOrderResponse.java
│       │   │   ├── config/
│       │   │   │   ├── SecurityConfig.java
│       │   │   │   └── FepChaosConfig.java    # latency, failureRate, mode (R4)
│       │   │   ├── controller/
│       │   │   │   ├── FepController.java     # /api/v1/fep/order
│       │   │   │   └── FepChaosController.java # PUT /fep-internal/rules (R4)
│       │   │   ├── service/
│       │   │   │   └── FepSimulatorService.java # [SIMULATION] RULE-034
│       │   │   └── security/
│       │   │       └── InternalSecretFilter.java
│       │   └── resources/
│       │       ├── application.yml
│       │       ├── application-local.yml
│       │       ├── application-prod.yml
│       │       └── logback-spring.xml
│       └── test/
│           ├── unit/com/fix/fep/service/
│           │   └── FepSimulatorServiceTest.java
│           └── integration/com/fix/fep/
│               ├── FepIntegrationTestBase.java              # R5
│               └── controller/
│                   └── FepControllerIntegrationTest.java
│
└── fix-frontend/
    ├── package.json                           # pnpm 관리
    ├── pnpm-lock.yaml
    ├── vite.config.ts                         # proxy + vitest 설정
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── .eslintrc.json                         # 경고만
    ├── .prettierrc
    ├── .env.local                             # gitignore (RULE-049)
    ├── .env.example                           # VITE_API_BASE_URL=
    ├── vercel.json                            # SPA 라우팅 rewrites (R5)
    ├── vitest.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx                            # BrowserRouter + NotificationProvider; useEffect → GET /api/v1/auth/me로 Zustand 초기화 (새로고침 시 쿠키 유효 판별)
        ├── pages/
        │   ├── LoginPage.tsx                  # useAuthStore.login(), Zod 검증
        │   ├── PortfolioPage.tsx              # usePortfolio(), useNotification()
        │   ├── OrderPage.tsx                  # useOrder() useReducer
        │   └── AdminPage.tsx                  # 감사 로그 조회, 강제 로그아웃 (ROLE_ADMIN 전용, P-C4)
        ├── components/
        │   ├── order/
        │   │   ├── OrderInputForm.tsx         # React Hook Form + Zod (RULE-065)
        │   │   ├── OrderConfirm.tsx
        │   │   ├── OtpInput.tsx               # RULE-029
        │   │   ├── OrderProcessing.tsx
        │   │   ├── OrderResult.tsx
        │   │   └── __tests__/
        │   │       ├── OrderInputForm.test.tsx
        │   │       ├── OtpInput.test.tsx       # userEvent.type
        │   │       └── OrderResult.test.tsx
        │   └── common/
        │       ├── AsyncStateWrapper.tsx       # RULE-027
        │       ├── LoadingSpinner.tsx
        │       ├── ErrorMessage.tsx
        │       ├── NavigationBar.tsx
        │       ├── PrivateRoute.tsx            # 인증 보호 래퍼 (R2)
        │       ├── ErrorBoundary.tsx           # D-024
        │       ├── KrwAmountDisplay.tsx        # formatKRW 래퍼 (R2)
        │       └── __tests__/
        │           └── AsyncStateWrapper.test.tsx
        ├── context/
        │   ├── NotificationContext.tsx         # SSE lifecycle RULE-045
        │   └── __tests__/
        │       └── NotificationContext.test.tsx  # R5
        ├── store/
        │   ├── useAuthStore.ts                 # Zustand: isAuthenticated, member, login(), logout() (P-B1)
        │   └── __tests__/
        │       └── useAuthStore.test.ts        # login/logout 상태 전환 단위 테스트 (P-C6)
        ├── hooks/
        │   ├── useOrder.ts                    # useReducer RULE-046
        │   ├── useAuth.ts                      # useAuthStore wrapper: const useAuth = () => useAuthStore()
        │   ├── usePortfolio.ts
        │   ├── useNotification.ts              # NotificationContext 소비 (R2)
        │   └── __tests__/
        │       └── useOrder.test.ts
        ├── lib/
        │   ├── axios.ts                        # 단일 인스턴스 RULE-047
        │   └── schemas/
        │       ├── order.schema.ts
        │       └── auth.schema.ts
        ├── types/
        │   ├── api.ts                          # ApiResponse<T> RULE-035
        │   ├── order.ts                        # OrderStep union RULE-046
        │   ├── portfolio.ts
        │   └── auth.ts                         # LoginRequest, Member (R9)
        ├── utils/
        │   └── formatters.ts                   # formatKRW RULE-028
        └── test/
            ├── setup.ts                        # jsdom + EventSource mock
            ├── fixtures/
            │   ├── orderFixtures.ts
            │   └── portfolioFixtures.ts
            └── __mocks__/
                └── axios.ts
```

---

### 아키텍처 경계 정의

#### 서비스 간 통신 경계

| 경계                               | 통신 방식       | 인증               | 네트워크     |
| ---------------------------------- | --------------- | ------------------ | ------------ |
| Vercel → channel-service           | HTTPS REST      | Spring Session Cookie | external-net |
| channel-service → corebank-service | HTTP REST       | X-Internal-Secret  | core-net     |
| corebank-service → fep-gateway     | HTTP REST       | X-Internal-Secret  | gateway-net  |
| fep-gateway → fep-simulator        | HTTP REST       | X-Internal-Secret  | fep-net      |
| channel-service → SSE Client       | HTTP long-lived | Session Cookie     | external-net |
| CI → EC2                           | SSH             | SSH Key            | 인터넷       |

#### Docker Compose 네트워크 격리 (R3)

```yaml
networks:
  external-net: # channel-service ↔ 외부
  core-net: # channel-service ↔ corebank-service
  gateway-net: # corebank-service ↔ fep-gateway
  fep-net: # fep-gateway ↔ fep-simulator

services:
  channel-service:
    networks: [external-net, core-net]
    ports: ["8080:8080"]
  corebank-service:
    networks: [core-net, gateway-net]
    # ports 없음
  fep-gateway:
    networks: [gateway-net, fep-net]
    # ports 없음
  fep-simulator:
    networks: [fep-net]
    # ports 없음

volumes:
  mysql-data: # 데이터 영속화 (R8)
  redis-data:
```

#### 데이터 경계

| 스키마     | 소유 서비스      | Flyway 위치                    | Flyway 파일             |
| ---------- | ---------------- | ------------------------------ | ----------------------- |
| channel_db | channel-service  | channel-service/db/migration/  | V0~V3 (4개)             |
| core_db    | corebank-service | corebank-service/db/migration/ | V1~V3 + R\_\_seed (4개) |
| Redis      | 전체 공유        | —                              | 키 prefix: `ch:`, `cb:` |

---

### Member 핵심 필드 (P-8)

```java
@Entity @Table(name = "members")
public class Member extends BaseTimeEntity {
    @Id @GeneratedValue(strategy = IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 50)
    private String username;
    @Column(nullable = false, unique = true, length = 100)
    private String email;
    @Column(nullable = false)
    private String password;              // BCrypt strength 12
    @Column(nullable = false, length = 50)
    private String name;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberStatus status;          // ACTIVE | LOCKED
    @Column(nullable = false)
    private int loginFailCount;           // 로그인 실패 카운터
    private LocalDateTime lockedAt;       // NULLABLE — 잠금 시각
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberRole role;              // ROLE_USER | ROLE_ADMIN
}
```

---

### OrderSession 핵심 필드 (R8)

```java
@Entity @Table(name = "order_sessions")
public class OrderSession extends BaseTimeEntity {
    @Id @GeneratedValue(strategy = IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 36)
    private String orderSessionId;        // UUID (ch:order-session key suffix)
    @Column(nullable = false, unique = true, length = 36)
    private String clOrdID;               // FIX Tag 11 — Idempotency RULE-071 (UUID v4)
    @Column(nullable = false)
    private Long memberId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderSessionStatus status;    // PENDING_NEW/AUTHED/EXECUTING/COMPLETED/FAILED/EXPIRED
    private Long accountId;               // 포지션 보유 계좌 ID
    private String symbol;                // 종목코드 (005930)
    @Enumerated(EnumType.STRING)
    private OrderSide side;               // BUY / SELL
    private Integer qty;                  // 주문 수량
    private Long price;                   // 주문 단가 (원)
    @Column(length = 36)
    private String correlationId;         // X-Correlation-Id
    private String fepReferenceId;        // P-9: NULLABLE — FEP 참조 ID
    private String failReason;            // P-9: NULLABLE — 실패 사유
    private LocalDateTime completedAt;    // P-9: NULLABLE — 체결 완료 시각
}
```

---

### settings.gradle (최종)

```groovy
rootProject.name = 'fix'
include(
    'core-common',
    'testing-support',
    'channel-domain',
    'channel-service',
    'corebank-domain',
    'corebank-service',
    'fep-gateway',
    'fep-simulator'     // fep-domain 폐기됨 (R6)
)
```

---

### .env.example (루트 — docker-compose용)

```bash
# DB
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=fix_db
CHANNEL_DB_URL=jdbc:mysql://mysql:3306/channel_db
CORE_DB_URL=jdbc:mysql://mysql:3306/core_db

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=              # Redis AUTH 비밀번호 (필수 — RULE-079)

# Security
INTERNAL_API_SECRET=          # X-Internal-Secret (32자 이상)

# Vault (TOTP secret 저장)
VAULT_ADDR=http://vault:8200
VAULT_TOKEN=                  # dev root token

# CORS
ALLOWED_ORIGINS=https://fix-xxx.vercel.app

# Frontend (.env.local)
VITE_API_BASE_URL=http://localhost:8080
```

---

### GitHub Actions Secrets 목록

| Secret 이름           | 용도                    |
| --------------------- | ----------------------- |
| `EC2_HOST`            | EC2 퍼블릭 IP/도메인    |
| `EC2_SSH_KEY`         | EC2 PEM 키              |
| `INTERNAL_API_SECRET` | X-Internal-Secret       |
| `REDIS_PASSWORD`      | Redis AUTH 비밀번호      |
| `MYSQL_ROOT_PASSWORD` | MySQL root 패스워드     |
| `VAULT_TOKEN`         | HashiCorp Vault dev token |
| `VERCEL_TOKEN`        | Vercel 자동 배포 (선택) |

---

### 7대 Acceptance Scenario → 테스트 파일 매핑 (R4)

| Scenario                          | 테스트 파일                         | 서비스         |
| ---------------------------------- | ------------------------------------ | -------------- |
| #1 Order E2E (매수 happy path)     | `OrderControllerIntegrationTest`     | channel        |
| #2 Concurrent SELL 10 threads      | `OrderConcurrencyIntegrationTest`    | corebank       |
| #3 OTP failure blocks              | `OrderSessionServiceTest`            | channel (unit) |
| #4 Duplicate ClOrdID               | `IdempotencyIntegrationTest`         | channel        |
| #5 FEP timeout → CB OPEN           | `FepCircuitBreakerIntegrationTest`   | corebank       |
| #6 Session invalidated             | `AuthControllerIntegrationTest`      | channel        |
| #7 SUM(BUY executed_qty)-SUM(SELL executed_qty)==pos.quantity | `PositionIntegrityIntegrationTest`   | corebank       |

---

### application-test.yml 필수 패턴 (R7)

```yaml
# 모든 *-service/src/main/resources/application-test.yml
spring:
  flyway:
    locations: classpath:db/migration,classpath:db/seed
  jpa:
    properties:
      hibernate:
        show_sql: false
# Testcontainers URL: @DynamicPropertySource로 주입 (하드코딩 금지)
# ❌ 금지: spring.datasource.url=jdbc:tc:mysql:... (TC shorthand)
```

---

### Day 1 Scaffold 순서 (R3)

```
Phase 1 — 인프라 기반:
  1. settings.gradle (7개 모듈)
  2. core-common/ (BusinessConstants, FixException, BaseTimeEntity)
  3. testing-support/ (TestContainersConfig, WireMockIntegrationTest)
  4. docker-compose.yml (mysql, redis만)

Phase 2 — 도메인 레이어:
  5. channel-domain/ (Member, OrderSession)
  6. corebank-domain/ (Position, Order + QueryDSL APT)
  7. fep-gateway/domain/ (GatewayRequest/Response, FIX 4.2 라우팅)
  8. fep-simulator/domain/ (FepOrderRequest/Response, FIX 4.2 시뮬레이션)

Phase 3 — 서비스 레이어 (동시 작업 가능):
  8. channel-service/ (Application + SecurityConfig + Flyway)
  9. corebank-service/ (Application + SecurityConfig + Flyway)
  10. fep-gateway/ (Application + FepGatewayController)
  11. fep-simulator/ (Application + FepChaosController)

Phase 4 — 프론트엔드:
  11. fix-frontend/ (Vite + lib/axios.ts + types/api.ts + vercel.json)
```

---

### PRD 6대 기능 도메인 파일 커버 확인

| 기능 도메인               | 주요 파일                                                              | 상태 |
| ------------------------- | ---------------------------------------------------------------------- | ---- |
| Auth (로그인/세션)        | AuthController, AuthService, JwtProvider, SecurityConfig               | ✅   |
| Portfolio (포지션 조회)  | PortfolioController, PositionService, PositionRepositoryImpl           | ✅   |
| Orders (주문 3단계)       | OrderController, OrderSessionService, OrderExecutionService, FepClient | ✅   |
| Notification (SSE)        | NotificationController, SseNotificationService, NotificationContext    | ✅   |
| Admin (감사/강제로그아웃) | AdminController, AuditLogService                                       | ✅   |
| Observability             | logback-spring.xml, application.yml (Actuator), JaCoCo                 | ✅   |

---

### Step 6 완결 선언

- **Party Mode:** 9 라운드, 에이전트 10인 전원 참여
- **총 파일 정의:** 백엔드 ~90개, 프론트엔드 ~45개, 설정/스크립트 ~25개
- **핵심 수정 이력:**
  - R1: Flyway channel_db → channel-service 이동 (버그)
  - R1: FepClient → corebank-service/client/ 이동 (버그)
  - R2: React Router + PrivateRoute 추가
  - R3: Docker 네트워크 격리, Day 1 Scaffold 순서
  - R4: 7대 Scenario 매핑, AdminController, RateLimitFilter, FepChaosController
  - R5: CorsConfig, SessionConfig, vercel.json, IntegrationTestBase 전 서비스
  - R6: fep-domain 폐기, libs.versions.toml, 데모 시나리오 Cross-Check
  - R7: application-test.yml 패턴, Flyway 전체 목록, Day 0 체크리스트
  - R8: 패키지명 com.fix.\* 통일, docker 볼륨, BaseTimeEntity, OrderSession 필드
  - R9: AuthContext 명세, 페이지 책임 범위, AdminController 엔드포인트

---

## Architecture Validation Results

> **검증 기준일:** 2026-02-23 | **Party Mode:** 9 라운드 (에이전트 9인 참여) | **수락 결정:** Q-7-1~21

---

### Step 7 Party Mode 수락 결정 이력

| #       | 결정 내용                                                                                                         | 우선도       | 라운드 |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| Q-7-1   | InternalSecretFilter 부재 = 설계 의도 (channel-service는 ingress)                                                 | Important    | R1     |
| Q-7-2   | `@Nested SecurityBoundaryTest` — CoreBankIntegrationTestBase에 추가                                               | Important    | R1     |
| Q-7-3   | testing-support build.gradle: TC + WireMock `api` scope (전이 클래스패스)                                         | **Critical** | R1     |
| Q-7-4   | ApiResponseAssertions도 `api` scope (Q-7-3에 포함)                                                                | Recommended  | R1     |
| Q-7-5   | R\_\_seed_data.sql에 `admin@fix.com` ROLE_ADMIN 시드 계정 1건                                                     | Important    | R2     |
| Q-7-6   | Sprint DoD 정의 → Implementation Handoff 추가                                                                     | Important    | R2     |
| Q-7-7   | SSE 실패 fallback: 재연결 3회 → 에러 표시 + 수동 새로고침                                                         | Important    | R2     |
| Q-7-8   | GET /api/v1/orders = SSE 폴백 API 명시                                                                            | Recommended  | R2     |
| Q-7-9   | corebank-domain build.gradle: QueryDSL 5.x `:jakarta` 분류자 4행 명시                                             | **Critical** | R3     |
| Q-7-10  | ADR 빠른 참조 테이블 (위치 인덱스)                                                                                | Recommended  | R3     |
| Q-7-11  | X-Correlation-Id 전파 체인: 생성(CorrelationIdFilter/Spring Session 필터) → 전파(CoreBankClient/FepClient) → 수신(InternalSecretFilter MDC) | **Critical** | R4     |
| Q-7-12  | DESIGN-DECISION-018: CoreBankClient no-CB/no-Retry (근거: FSM + RecoveryScheduler)                                | Important    | R4     |
| Q-7-13  | Actuator 보안: `health,info,metrics` expose, `/actuator/health` permitAll, 나머지 ROLE_ADMIN                      | Important    | R5     |
| Q-7-14  | docker-compose.override.yml 최소 내용: mysql:3306, redis:6379, 8081, 8082, 8083 호스트 노출                       | Important    | R5     |
| Q-7-15  | OrderService.execute() 트랜잭션 경계: FEP 호출 트랜잭션 외부, DB 기록 트랜잭션 내부                              | **Critical** | R6     |
| Q-7-16  | 매도 한도 검증 위치: channel-service OrderSessionService.initiate() (세션 생성 전)                               | Important    | R6     |
| Q-7-17  | GET /api/v1/orders/{sessionId} — 세션 상태 조회 엔드포인트 (SessionStatusResponse)                               | Important    | R7     |
| Q-7-18  | Integration Test 격리: @Transactional 금지, @Sql cleanup 또는 deleteAll()                                         | **Critical** | R7     |
| Q-7-19B | ~~JWT Refresh Token (Option B)~~ **폐기** — Spring Session Redis로 대체 (login-flow.md 참조)                              | 구조 변경  | R8/R9  |
| Q-7-20  | ~~Silent Refresh~~ **폐기** — SSE 세션 만료 알림 + 401 핸들러로 대체 (login-flow.md 참조)                             | 구조 변경  | R9     |
| Q-7-21  | Redis 키 네임스페이스 정리: `spring:session:*`, `ch:*` (JWT 관련 키 제거)                                    | Recommended  | R9     |

---

### Coherence Validation ✅

**Decision Compatibility:**
Java 21 + Spring Boot 3.4.x + MySQL 8.0 + Redis 7 + Resilience4j 2.x + React 19 + Vite 6 — 모든 기술 조합 상호 호환 확인. QueryDSL 5.x Jakarta 전환(`:jakarta` 분류자) 완료. Testcontainers CI/로컬 분리(reuse 플래그) 설계 반영.

**Pattern Consistency:**

- 패키지: `com.fix.{service}.{layer}` 전 7모듈 일관 ✅
- `ApiResponse<T>` 래퍼: 전 서비스 동일 ✅
- `@DynamicPropertySource`: 3개 IntegrationTestBase 동일 ✅
- `X-Internal-Secret` + `X-Correlation-Id`: HttpConstants.java 상수화 ✅
- Redis 키 prefix: `spring:session:*` (Spring Session), `ch:*` (channel-service 도메인 키) — 네임스페이스 충돌 없음 ✅

**Structure Alignment:**
Gradle 모듈 경계 = Docker network 경계 = 보안 경계 3중 일치. Flyway 위치 교차 오염 없음. fep-domain 흡수 — 단일 소비자 설계 타당.

---

### Requirements Coverage Validation ✅

**PRD 6대 기능 도메인:** 6/6 아키텍처 지원 확인
**7+1대 Acceptance Scenario:** 8/8 매핑 확인 (Scenario #8: SecurityBoundaryTest Q-7-2)
**Non-Functional Requirements:** 동시성·보안·복원력·관찰가능성 모두 아키텍처적 지원 확인

---

### Implementation Readiness Validation ✅

**Decision Completeness:** ADR 18건 이상, RULE 40건 이상, Q-7 추가 결정 21건 문서화
**Structure Completeness:** 백엔드 ~92개, 프론트엔드 ~46개 파일 명세
**Pattern Completeness:** 에러/트랜잭션/테스트/SSE/JWT Refresh/correlationId 전파 패턴 전수 명세

---

### 신규 아키텍처 결정 (Step 7 확정)

#### DESIGN-DECISION-018: CoreBankClient no-CB/no-Retry (Q-7-12)

```
결정: channel-service의 CoreBankClient에 Resilience4j CB/Retry 없음
근거:
  - channel-service는 OrderSession FSM으로 상태를 관리
  - corebank-service 실패 시 세션을 FAILED로 전환
  - OrderSessionRecoveryService(@Scheduled)가 EXECUTING 장기 잔류 세션 재시도
  - FEP CB와의 차이: FEP는 외부 거래소 시뮬레이션(불안정), corebank는 내부 신뢰 서비스
면접 답변: "CoreBankClient에 CB가 없는 이유는 세션 FSM + Recovery Scheduler가
            재시도 역할을 담당하기 때문입니다."
```

#### X-Correlation-Id 전파 체인 (Q-7-11)

```
헤더명: X-Correlation-Id (HttpConstants.CORRELATION_ID_HEADER)
생성: CorrelationIdFilter (channel-service, OncePerRequestFilter)
      - 외부 요청에 헤더 없으면 UUID.randomUUID() 신규 생성
      - MDC.put("correlationId", correlationId)
      (참고: JwtAuthenticationFilter 제거 — Spring Session이 모든 세션 검증 처리)
전파: CoreBankClient, FepClient → HTTP 요청 헤더에 MDC 값 삽입
수신: InternalSecretFilter (corebank-service, fep-gateway, fep-simulator)
      - request.getHeader("X-Correlation-Id") → MDC.put("correlationId", ...)
logback-spring.xml 패턴: [%X{correlationId}] 포함
```

#### ~~JWT Refresh Token 설계 (Q-7-19B)~~ — **폐기**

> ⚠️ **이 설계는 Spring Session Redis 전환으로 폐기되었습니다.**  
> 중간 결정 근거: 세션 즉각 무효화 뺈리티, 서버 완전 통제, JwtAuthFilter 제거로 코드 단순화, 부수 AT Blacklist 키 불필요.  
> **현행 인증 설계**: login-flow.md 참조 — Spring Session Redis (`JSESSIONID` HttpOnly 쿠키, 30분 슬라이딩 TTL).

#### ~~Silent Refresh 패턴 (Q-7-20)~~ — **폐기**

> ⚠️ **이 패턴은 폐기되었습니다.**  
> 대체: SSE `session-expiry` 이벤트로 5분 전 알림 → 사용자 "5분 후 자동 로그아웃" 토스트 표시.  
> **현행 401 핸들러**: login-flow.md 참조 — `authStore.clearMember()` + `/login` redirect (제거 코드 10줄 미만).

#### OrderService 트랜잭션 경계 (Q-7-15)

```
올바른 순서:
  1. @Transactional 시작
  2. Position 보유수량 검증 (@Lock PESSIMISTIC_WRITE)
  3. 수량 차감 + OrderHistory PENDING 기록
  4. @Transactional 커밋 (DB Lock 해제)
  5. @Transactional 외부에서 FepClient.call() 호출
  6. FEP 응답에 따라 새 @Transactional로 주문 상태 업데이트 — FEP 성공: orders.status=FILLED, OrderSession=COMPLETED;
     FEP 실패: 보상 트랜잭션(orders.status=FAILED, sub_status=COMPENSATED), OrderSession=FAILED

금지: FepClient.call()을 @Transactional 내부에서 호출
근거: HTTP 대기 시간 동안 DB Lock 점유 → 동시성 저하
```

#### 매도 한도 검증 위치 (Q-7-16)

```
검증 위치: channel-service OrderSessionService.initiate()
검증 시점: OrderSession 생성 전
상수: BusinessConstants.DAILY_SELL_LIMIT
예외: DailySellLimitExceededException → 422
근거: channel-service = 비즈니스 게이트키퍼
      corebank-service = 기술 실행자 (한도 재검증 불필요)
```

#### Integration Test 격리 전략 (Q-7-18)

```
금지: @Transactional 통합 테스트에 사용
이유: SSE(@Async) 테스트에서 다른 스레드가 같은 트랜잭션 불가

대신 사용:
Option A: @Sql(scripts = "classpath:cleanup.sql",
           executionPhase = AFTER_TEST_METHOD)
Option B: @BeforeEach void cleanup() { repository.deleteAll(); }

권장: Option B (간단, 대부분의 통합 테스트에 충분)
```

#### Actuator 보안 설정 (Q-7-13)

```yaml
# 전 서비스 application.yml 공통
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: when-authorized

# SecurityConfig: Spring Security 설정
.requestMatchers("/actuator/health").permitAll()
.requestMatchers("/actuator/**").hasRole("ADMIN")
```

#### Redis 키 네임스페이스 (Q-7-21)

| prefix                              | 용도                    | TTL  |
| ----------------------------------- | ----------------------- | ---- |
| `spring:session:sessions:{id}`      | Spring Session 저장소  | 30분 |
| `spring:session:index:...:{mbr}`    | principal 인덱스      | 30분 |
| `ch:totp-used:{memberId}:{w}:{c}`   | TOTP Replay Guard       | 60s  |
| `ch:otp-attempts:{tSessionId}`      | OTP 시도 횟수 카운터 | 600s (order session TTL과 동일) |
| `ch:order-session:{tSessionId}`     | 주문 세션 상태         | 600s |
| `ch:ratelimit:{endpoint}:{id}`      | Bucket4j Rate Limit     | Bucket4j 관리 |
| `fds:ip-fail:{ip}`                  | FDS IP 실패 카운터   | 10분 |

> **삭제된 키 (JWT 폐기)**: `otp:{memberId}` (OTP 코드), `session:{jti}` (AT Blacklist), `rt:{memberId}:{uuid}` (Refresh Token)

#### testing-support build.gradle `api` scope (Q-7-3)

```groovy
// testing-support/build.gradle
plugins { id 'java-library' }
dependencies {
    // api scope: 소비 모듈의 testImplementation에 전이됨
    api "org.testcontainers:mysql:${versions.testcontainers}"
    api "org.testcontainers:junit-jupiter:${versions.testcontainers}"
    api "org.wiremock:wiremock-standalone:${versions.wiremock}"
    api "org.assertj:assertj-core"
    // ApiResponseAssertions도 api scope (Q-7-4)
}
```

#### corebank-domain QueryDSL Jakarta 설정 (Q-7-9)

```groovy
// corebank-domain/build.gradle
dependencies {
    implementation "com.querydsl:querydsl-jpa:${versions.querydsl}:jakarta"
    annotationProcessor "com.querydsl:querydsl-apt:${versions.querydsl}:jakarta"
    annotationProcessor "jakarta.persistence:jakarta.persistence-api"
    annotationProcessor "jakarta.annotation:jakarta.annotation-api"
}
// 주의: :jakarta 분류자 없으면 javax.* 바인딩 → Spring Boot 3.x 런타임 오류
```

#### Scenario #8: SecurityBoundaryTest (Q-7-2)

```java
// CoreBankIntegrationTestBase 내부
@Nested
class SecurityBoundaryTest {
    @Test
    void directCallWithoutInternalSecret_returns403() {
        mockMvc.perform(post("/internal/order")
            // X-Internal-Secret 헤더 없음
        ).andExpect(status().isForbidden());
    }
}
```

#### docker-compose.override.yml (Q-7-14)

```yaml
# docker-compose.override.yml (로컬 개발 전용, .gitignore)
services:
  mysql:
    ports: ["3306:3306"]
  redis:
    ports: ["6379:6379"]
  corebank-service:
    ports: ["8081:8081"]
  fep-gateway:
    ports: ["8083:8083"]
  fep-simulator:
    ports: ["8082:8082"]
```

#### InternalSecretFilter 부재 설계 의도 (Q-7-1)

```
channel-service: InternalSecretFilter 없음 — 의도적 설계
이유: channel-service는 외부 요청 ingress
      내부 서비스로부터 받는 호출 없음
      미적용이 버그가 아님을 명시

corebank-service: InternalSecretFilter 있음 (channel → corebank)
fep-gateway: InternalSecretFilter 있음 (corebank → fep-gateway)
fep-simulator: InternalSecretFilter 있음 (fep-gateway → fep-simulator)
```

#### Sprint DoD (Q-7-6)

```
Definition of Done (모든 Story):
- [ ] Unit 테스트 통과 (JUnit 5, Mockito)
- [ ] Integration 테스트 통과 (Testcontainers)
- [ ] JaCoCo line coverage ≥ 70%
- [ ] Checkstyle 경고만 (빌드 실패 없음, RULE-057)
- [ ] PR 1건당 1 Story 원칙
- [ ] architecture.md 결정과 충돌 없음
```

#### SSE 실패 Fallback 정책 (Q-7-7)

```typescript
// NotificationContext.tsx — SSE 재연결 전략
const MAX_RETRY = 3;
let retryCount = 0;

eventsource.onerror = () => {
  if (retryCount < MAX_RETRY) {
    retryCount++;
    // 지수 백오프로 재연결 시도
    setTimeout(() => reconnect(), 1000 * retryCount);
  } else {
    // 3회 실패 → 에러 표시 + 수동 새로고침 안내
    setNotificationError("연결이 끊어졌습니다. 페이지를 새로고침해 주세요.");
    eventsource.close();
  }
};
// SSE 폴백: GET /api/v1/orders (Q-7-8)
// 페이지 새로고침 시 OrderHistoryPage에서 자동 호출됨
```

#### ADR 빠른 참조 테이블 (Q-7-10)

| ADR   | 결정 요약                          | 위치          |
| ----- | ---------------------------------- | ------------- |
| D-001 | Pessimistic Lock for 포지션 동시성   | Step 4        |
| D-002 | Spring Boot 3.4.x + Java 21        | Step 3        |
| D-003 | Gradle 멀티 모듈 (7개)             | Step 3/6      |
| D-004 | MySQL InnoDB (단일 DB)             | Step 3        |
| D-005 | Redis (OTP/세션/RT)                | Step 3        |
| D-006 | JWT HttpOnly Cookie                | Step 4        |
| D-007 | Resilience4j CB (FEP만)            | Step 4        |
| D-008 | RecoveryScheduler (EXECUTING 복구) | Step 4        |
| D-009 | SSE (단방향 알림)                  | Step 4        |
| D-010 | 구조화 로깅 + correlationId MDC    | Step 5        |
| D-011 | Testcontainers (통합 테스트)       | Step 5        |
| D-012 | React 19 + Vite 6 + TypeScript     | Step 3        |
| D-013 | Zod + React Hook Form              | Step 5        |
| D-014 | pnpm + Vercel 배포                 | Step 3        |
| D-015 | Docker Compose (단일 EC2)          | Step 3        |
| D-016 | fep-domain 폐기 (fep-simulator 내부) | Step 6 R6     |
| D-017 | 패키지명 com.fix.\*                | Step 6 R8     |
| D-018 | CoreBankClient no-CB/no-Retry      | Step 7 Q-7-12 |

---

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] 프로젝트 컨텍스트 분석 (Step 1-2)
- [x] 규모 및 복잡도 평가 (단일 EC2, 포트폴리오 MVP)
- [x] 기술 제약사항 식별 (Java 21, Spring Boot 3.x)
- [x] Cross-cutting 관심사 매핑 (보안, 로깅, 복원력, JWT Refresh)

**✅ Architectural Decisions**

- [x] 핵심 결정 ADR D-001~D-018 문서화
- [x] 기술 스택 전체 버전 명시
- [x] 통합 패턴 정의 (REST, SSE, X-Internal-Secret, X-Correlation-Id)
- [x] 성능/동시성 설계 (@Lock, Redis TTL, 트랜잭션 경계 Q-7-15)

**✅ Implementation Patterns**

- [x] 명명 규칙 확정 (D-017, com.fix.\*)
- [x] 구조 패턴 정의 (RULE-XXX 시리즈)
- [x] 통신 패턴 명세 (REST, SSE, CB, Spring Session 쿠키 기반 인증)
- [x] 프로세스 패턴 (에러 처리, 트랜잭션 경계, 테스트 격리)

**✅ Project Structure**

- [x] 전체 디렉토리 트리 정의
- [x] 컴포넌트 경계 확정 (7 Gradle 모듈)
- [x] 통합 포인트 매핑 (Docker network 3개)
- [x] 요구사항 → 파일 매핑 완료

---

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

- Step 7 Party Mode 9라운드, 에이전트 9인 참여
- Q-7-1~21 결정 사항 전수 근거 있는 선택
- Critical Gap: 0건
- Day 1 빌드 차단 이슈: 0건 (Q-7-3, Q-7-9 해결)

**Key Strengths:**

1. 7개 Gradle 모듈 = Docker 네트워크 = 보안 경계 3중 일치
2. OrderSession FSM 7+1대 Scenario 전수 커버
3. X-Correlation-Id 전파 체인 — 3개 서비스 로그 추적 완전
4. Spring Session Redis — `JSESSIONID` HttpOnly 쿠키, 30분 슬라이딩 TTL, 즉각 세션 무효화, log-flow.md 완전 명세
5. 트랜잭션 경계 명시 — DB Lock과 HTTP 호출 분리

**Areas for Future Enhancement (post-MVP):**

1. Kafka 기반 비동기 알림 파이프라인 (SSE 대체)
2. 타사 증권사 라우팅 (현재 설계 범위 밖, 의도적 제외)
3. Grafana + Prometheus 관찰가능성 스택

---

### Implementation Handoff

**AI Agent Guidelines:**

- 신규 파일은 `com.fix.{service}.{layer}` 패키지 규칙 준수
- `InternalSecretFilter`는 corebank-service + fep-gateway + fep-simulator에만 배치 (channel-service 제외 의도적)
- `BaseTimeEntity`는 core-common에서 상속
- `@DynamicPropertySource` 방식만 허용 — TC shorthand URL(`jdbc:tc:`) 금지
- `ApiResponse<T>` 래퍼 모든 컨트롤러 응답에 적용
- FepClient.call()을 `@Transactional` 내부에서 호출 금지 (Q-7-15)
- Integration Test에 `@Transactional` 사용 금지 (Q-7-18)
- correlationId는 `X-Correlation-Id` 헤더로 전파 (Q-7-11)
- 인증 상태는 **Zustand `useAuthStore`** 전역 스토어 사용 — `AuthContext.Provider` 미사용 (P-B1)
- `useAuth.ts` 훈 = `export const useAuth = () => useAuthStore()` 래퍼
- ❌ 금지: 컴포넌트에서 `auth state`를 `useState` 또는 `Context`로 별도 관리

**Sprint DoD:**

- [ ] Unit 테스트 통과, Integration 테스트 통과
- [ ] JaCoCo line coverage ≥ 70%
- [ ] Checkstyle 경고만 (RULE-057)
- [ ] PR 1건당 1 Story

**First Implementation Priority (Day 1 Phase 1):**

```bash
1. settings.gradle (7개 모듈)
2. core-common/ (java-library, RULE-007)
3. testing-support/ (api scope TC + WireMock, Q-7-3)
4. docker-compose.yml + docker-compose.override.yml (Q-7-14)
```

---

### Step 7 완결 선언

- **작성 기준일:** 2026-02-23
- **Party Mode:** 9 라운드 (에이전트 9인 참여)
- **수락 결정:** Q-7-1~21 (21건)
- **Critical Gap:** 0건
- **구현 차단 이슈:** 0건
- **PRD 6대 도메인:** 6/6 커버
- **Acceptance Scenario:** 8/8 (Scenario #1~7 + SecurityBoundaryTest)
- **ADR:** D-001~D-018 (18건)
- **신규 구현 명세:** Spring Session Redis, SSE 세션 만료 알림, correlationId 전파, 트랜잭션 경계, 테스트 격리
- **아키텍처 상태:** ✅ READY FOR IMPLEMENTATION
