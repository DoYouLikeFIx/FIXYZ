# Epic 6: Security, Audit & Administration

> **⚠️ Epic Numbering Note**: This supplemental file was numbered from the securities-order domain and corresponds to **Epic 8 in epics.md: Cross-system Security, Audit, Observability**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.


## Summary

All user actions are recorded in audit logs, and administrators can force session invalidation and view audit history. PII (account numbers, passwords) is not exposed in logs. CSRF protection, Rate Limiting, and Account Lockout are all functional.

**FRs covered:** FR-33, FR-34, FR-35, FR-36, FR-37, FR-38, FR-39, FR-45, FR-46, FR-50, FR-51  
**Architecture requirements:** AuditLogService, AdminController(/api/v1/admin/** ROLE_ADMIN), V2 Flyway(audit_log table), RateLimitFilter(Bucket4j), SessionConfig, MaskingUtils, R__seed_data.sql(admin@fix.com ROLE_ADMIN seed), Actuator security

---

## Story 6.1: Audit Logging & PII Masking

As a **system**,  
I want every significant user action to be recorded in an audit log with actor, action, target, and timestamp,  
So that security investigations can reconstruct the complete event chain.

**Depends On:** Story 1.2 (Authentication), Story 4.1 (Order execution)

### Acceptance Criteria

**Given** User login success/failure, logout, order session creation, OTP issuance/verification, order execution, account inquiry  
**When** Each action executes  
**Then** `AuditEvent` domain event publish → processed by `AuditLogEventListener` via `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async`  
**And** Audit INSERT after order TX commit → independent of order rollback (best-effort)  
**And** `channel_db.audit_logs` INSERT  
**And** Fields: `id, member_id, action (ENUM), target_id, ip_address, user_agent, created_at`  
**And** `action` ENUM: `LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, ORDER_INITIATED, OTP_ISSUED, OTP_VERIFIED, OTP_FAILED, ORDER_EXECUTED, ORDER_FAILED, ORDER_COMPENSATED`  
**And** `ORDER_COMPENSATED`: Recorded when Story 4.3 RecoveryScheduler executes compensating transaction  
**And** Mandatory logging on `@Async` failure: `log.error("AUDIT_FAIL: action={}, memberId={}", event.getAction(), event.getMemberId(), ex)`

**Given** Security-critical events (account lockout, OTP limit exceeded, forced session invalidation)  
**When** Event occurs  
**Then** Recorded in separate `channel_db.security_events` table (FR-45)  
**And** `security_events` retention period: 180 days (audit_logs: 90 days, FR-46)

**Given** Audit log retention expiry (`@Scheduled`)  
**When** Runs daily at midnight  
**Then** Delete records where `audit_logs.created_at` < now - 90 days (FR-34)  
**And** Delete records where `security_events.created_at` < now - 180 days (FR-46)

**Given** Application log output (Logback)  
**When** Order execution log recorded  
**Then** Full account number (`^\d{10,14}$` pattern) not output in logs — `MaskingUtils.maskAccountNumber()` applied (NFR-S2, FR-36)  
**And** Password, OTP values, JSESSIONID values not output in logs  
**And** Account number masking format: `110-****-5678` (first 3 digits + ** + last 4 digits)

**Given** `MaskingUtilsTest` (Unit Test)  
**When** Full account number / password string input  
**Then** Masking application verification (Regex based)

**Given** `Flyway V2__create_audit_log_table.sql` (channel_db)  
**When** Service startup  
**Then** `audit_logs`, `security_events` tables creation

---

## Story 6.2: Admin API — Session Invalidation & Audit Query

As an **administrator**,  
I want to force-invalidate user sessions and query audit logs,  
So that I can respond to security incidents and investigate suspicious activity.

**Depends On:** Story 6.1, Story 1.2 (ROLE_ADMIN)

### Acceptance Criteria

**Given** `DELETE /api/v1/admin/members/{memberId}/sessions` (ROLE_ADMIN)  
**When** Forced session invalidation request  
**Then** `FindByIndexNameSessionRepository.findByPrincipalName(memberId)` → sessionId set O(1) lookup (No SCAN)  
**And** `sessionRepository.deleteById(sessionId)` delete each session  
**And** Record `FORCED_LOGOUT` event in `security_events` table (NFR-50 — include Admin ID)  
**And** HTTP 204 returned

**Given** Access `/api/v1/admin/**` with ROLE_USER token  
**When** Authority verification  
**Then** HTTP 403 `{ code: "AUTH-006", message: "Access denied." }`

**Given** `GET /api/v1/admin/audit-logs?memberId={id}&from={ISO8601}&to={ISO8601}&page=0&size=20`  
**When** Audit log query (ROLE_ADMIN)  
**Then** HTTP 200 Pagination: `{ content: [{ auditId, memberId, action, targetId, ipAddress, createdAt }], totalElements, ... }` (FR-39)

**Given** `GET /api/v1/admin/members/{memberId}/locked`  
**When** Lock status query (ROLE_ADMIN)  
**Then** HTTP 200: `{ memberId, status: "LOCKED|ACTIVE", lockedAt, failedAttempts }`

**Given** `POST /api/v1/admin/members/{memberId}/unlock`  
**When** Account unlock (ROLE_ADMIN)  
**Then** `member.status = ACTIVE`, `failedAttempts = 0` reset (FR-06 unlock)  
**And** Record `ACCOUNT_UNLOCKED` in `security_events` (include Admin ID)  
**And** HTTP 204 returned

**Given** Initial admin account seed data  
**When** `docker compose up` or Flyway migration executions  
**Then** `admin@fix.com / Admin1234!` account exists as `ROLE_ADMIN` in `channel_db.members`

**Given** `ChannelIntegrationTestBase` (Testcontainers)  
**When** Admin API integration test  
**Then** ROLE_USER account accessing admin API → 403 verified  
**And** ROLE_ADMIN invalidating session then user refresh → 401 verified

---

## Story 6.3: Rate Limiting, CSRF & Security Boundary

As a **system**,  
I want to enforce rate limits on sensitive endpoints, CSRF protection on all state-changing requests, and block direct access to internal endpoints,  
So that abuse, CSRF attacks, and network bypass attempts are all rejected.

**Depends On:** Story 1.2, Story 2.1, Story 2.2

### Acceptance Criteria

**Given** `RateLimitFilter` (Bucket4j + Redis-backed) applied endpoints  
**When** Check configuration  
**Then** Applied only to 3 endpoints:
- `POST /api/v1/auth/login`: 5 req/min/IP
- `POST /api/v1/orders/sessions/{id}/otp/verify`: 3 times/session
- `POST /api/v1/orders/sessions`: 10 req/min/userId

**Given** Rate limit exceeded  
**When** Request received  
**Then** HTTP 429 `{ code: "RATE-001", message: "Rate limit exceeded.", retryAfterSeconds: N }`  
**And** `Retry-After: N` response header included

**Given** Bucket4j Redis integration config  
**When** Check `RateLimitConfig @Configuration`  
**Then** `bucket4j-redis` dependency added (`io.github.bucket4j:bucket4j-redis`)  
**And** `ProxyManager<String>` Bean definition: `Bucket4jRedisProxyManager` with Lettuce RedisClient

**Given** Rate limit settings externalized to environment variables (NFR-SC2)  
**When** Check `application.yml`  
**Then** References env vars with defaults like `${RATE_LIMIT_LOGIN_MAX:5}`, `${RATE_LIMIT_OTP_MAX:3}`

**Given** CSRF token initialization  
**When** React app initial mount (`App.tsx useEffect`)  
**Then** Call `GET /api/v1/csrf` (No auth required, `SecurityConfig.permitAll()`)  
**And** Spring Security automatically issues `XSRF-TOKEN` cookie  
**And** `CookieCsrfTokenRepository.withHttpOnlyFalse()` configured — readable by JavaScript  
**And** `JSESSIONID` keeps `HttpOnly=true`

**Given** React app POST/PATCH/DELETE requests  
**When** Axios interceptor executes  
**Then** `X-XSRF-TOKEN` header automatically injected (CSRF Double-Submit Cookie)  
**And** Request without `X-XSRF-TOKEN` header → HTTP 403 (FR-35)

**Given** `curl corebank-service:8081/internal/v1/portfolio` (No X-Internal-Secret header)  
**When** Request sent  
**Then** HTTP 403 returned (NFR-S4, FR-52)

**Given** `SecurityBoundaryTest` (`@Nested` — Scenario #8)  
**When** Direct call to internal API without X-Internal-Secret  
**Then** `corebank-service:8081/internal/**` → 403 verification  
**And** `fep-simulator:8082/fep/**` → 403 verification  
**And** With correct X-Internal-Secret → Success verification

**Given** `RateLimitIntegrationTest` (Testcontainers Redis)  
**When** 6 consecutive login attempts (same IP)  
**Then** HTTP 429 returned on 6th request

**Given** Rate Limit + Circuit Breaker test isolation  
**When** `RateLimitIntegrationTest` / `FepCircuitBreakerIntegrationTest` execution  
**Then** `@DirtiesContext(classMode = AFTER_CLASS)` applied to each test class — Avoid CB state pollution

---

## Story 6.4: Vault TOTP Secret Migration (FR-TOTP-04)

As a **system security requirement**,  
I want TOTP secrets to be stored exclusively in HashiCorp Vault instead of the application database,  
So that TOTP secrets are never exposed even in the event of a database breach.

> **ADR Reference:** Replace the interim solution (`@EncryptedColumn` AES-256) from Epic 0 with Vault in this story. See [ADR-TOTP-SEC-001].

**Depends On:** Story 2.2 (TotpOtpService interface), Story 6.1 (Security auditing), Story 0.1 (docker-compose infra)

### Acceptance Criteria

**Given** HashiCorp Vault container added to `docker-compose.yml`  
**When** `docker compose up` executed  
**Then** Vault container `vault:1.15` starts in dev mode `VAULT_DEV_ROOT_TOKEN_ID=root-token`  
**And** `vault-init` container starts after `depends_on: vault` + `healthcheck` complete  
**And** `vault-init.sh` — idempotent script:
  - Skip if `vault kv get secret/fix/config` succeeds, otherwise run `vault secrets enable -path=secret kv-v2`
  - Seed user (`memberId=1`) TOTP secret conditional injection: `vault kv put secret/fix/member/1/totp-secret secret="JBSWY3DPEHPK3PXP"` only if 404
  - **Safe to re-run on restart (Idempotency guaranteed)**
**And** `channel-service` starts after `depends_on: vault` health check passes

> **Design Note:** Vault dev mode resets memory on restart, deleting stored secrets. For demo environment, use `docker compose stop && docker compose start` instead of `docker compose restart`.

**Given** `spring-vault-core` dependency added to `channel-service/build.gradle`  
**When** `channel-service` startup  
**Then** `spring.cloud.vault.token=root-token` (externalized via `VAULT_TOKEN`)  
**And** `spring.cloud.vault.host`, `spring.cloud.vault.port` configured via env vars

**Given** `VaultTotpSecretService implements TotpSecretRepository` implementation  
**When** TOTP secret save/retrieve  
**Then** `PUT /v1/secret/data/fix/member/{memberId}/totp-secret` → Save `{ secret: Base32EncodedKey }`  
**And** `GET /v1/secret/data/fix/member/{memberId}/totp-secret` → Retrieve secret  
**And** Existing `@EncryptedColumn` based `DatabaseTotpSecretRepository` disabled via `@Profile("!vault")` guard  
**And** `TotpOtpService` only references `TotpSecretRepository` interface — no service code change on implementation swap

**Given** Migration of existing `@EncryptedColumn` DB stored TOTP secrets  
**When** Startup with Vault active profile  
**Then** `VaultMigrationRunner` (`@EventListener(ApplicationReadyEvent)`, `@Profile("vault")`): Idempotent execution  
**And** For each member: **skip** if already in Vault (no duplicate write)  
**And** Do not NULL the DB column immediately — Mark migration completion with `totp_secret_migrated_at DATETIME` column

**Given** Vault connection failure (at channel-service startup)  
**When** Vault health check fails  
**Then** `channel-service` startup failure — TOTP function must not start without Vault

**Given** WireMock Vault stub added to `testing-support`  
**When** Extending `ChannelIntegrationTestBase`  
**Then** `@DynamicPropertySource` injects `spring.cloud.vault.host=localhost`, port = WireMock port  
**And** `GET /v1/secret/data/fix/member/*/totp-secret` stub automatically registered to return Base32 test secret

**Given** `GET /actuator/health`  
**When** Vault connection normal  
**Then** Includes `components.vault.status: "UP"` (Spring Vault automatic health indicator)
