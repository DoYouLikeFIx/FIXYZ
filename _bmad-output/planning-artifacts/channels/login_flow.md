# FIX Login Flow Reference

> **Version**: Party Mode Round 2~4 decisions reflected
> **Auth Model**: Spring Session Redis (`SESSION`) replaces JWT access-token stateless auth
> **Scope**: Let's Encrypt TLS + nginx, Redis AUTH, and baseline FDS rules
> **Session Policy**: 30-minute inactivity timeout with a 5-minute expiry warning via SSE
> **MVP Constraint**: single Redis instance for MVP; Sentinel/HA is post-MVP
> **Primary Reader**: implementation developer and technical interviewer
---

## End-to-End Flow Summary

```
[Register] -> [Login] -> [Session issued: SESSION cookie] -> [Protected API calls]
                 |
                 +-> [TOTP enrollment]
                       -> [Secret stored in Vault]
                       -> [QR scan + confirm]

[Session active: 30 minutes sliding TTL]
       -> [SSE expiry warning at 5 minutes remaining]
       -> [Keep session] or [Expire and redirect to /login]
```

### Key Differences from the Old JWT Access-Token Model

| Topic | Previous (JWT AT) | Current (Spring Session) | Why it changed |
|------|--------------------|--------------------------|----------------|
| Immediate invalidation | Access token remained valid until expiry | `deleteById()` invalidates immediately | Better operational security |
| Server-side control | No canonical server session | Full Redis-backed session control | Supports logout, force logout, and expiry policy |
| Silent refresh | Required | Removed | Simpler client flow |
| Duplicate login policy | Hard to enforce cleanly | `maximumSessions(1)` | Prevents account sharing and stale sessions |
| Session fixation defense | Limited | `changeSessionId()` | Stronger security baseline |
| Client token handling | Client managed token state | Browser manages `SESSION` automatically | Less code and less leakage risk |

---

## 1. Registration (Story 1.1)

### Endpoint
```
POST /api/v1/auth/register
```

### Request

```json
{
  "email": "user@example.com",
  "password": "Test1234!",
  "name": "Hong Gil-dong"
}
```

### Processing Flow

```
Client
  -> POST /api/v1/auth/register
  -> nginx (TLS termination)
  -> channel-service (AuthController)
  -> Bean Validation (@Valid)
     - email: @Email, @NotBlank
     - password: strong password regex
     - invalid input -> HTTP 400 with field-level details
  -> duplicate email check (MemberRepository)
     - duplicate -> HTTP 409 { code: "MEMBER_ALREADY_EXISTS" }
  -> BCrypt hash (strength=12)
  -> create member with ROLE_USER / ACTIVE
  -> call corebank-service to auto-create default portfolio/account
     - internal call failure -> member rollback -> HTTP 503 { code: "ACCOUNT_CREATION_FAILED" }
  -> HTTP 201 { memberUuid, email, name, createdAt }
     - no session is issued during registration
```

### Security Rules

| Topic | Rule |
|------|------|
| Password policy | At least 8 chars with uppercase, digit, and special character |
| Hashing | BCrypt strength=12 |
| Role policy | Registration always creates `ROLE_USER`; `ROLE_ADMIN` is seed-only |
| Internal API | `X-Internal-Secret` is mandatory |

---

## 2. Login (Story 1.2)

### Endpoint
```
POST /api/v1/auth/login
```

### Request

```json
{
  "email": "user@example.com",
  "password": "Test1234!"
}
```

### Processing Flow

```
Client
  -> POST /api/v1/auth/login
  -> nginx (TLS termination)
  -> channel-service
  -> Bucket4j login rate-limit in Redis
     - `ch:ratelimit:login:{IP}` > 5 req/min -> HTTP 429
  -> FdsService.analyze(FdsContext{LOGIN_ATTEMPT, ip, userAgent})
     - suspicious result may return HTTP 403 { code: "FDS_BLOCKED" }
  -> Spring Security UsernamePasswordAuthenticationFilter
  -> MemberDetailsService.loadUserByUsername(email)
     - unknown email -> HTTP 401 { code: "INVALID_CREDENTIALS" } to prevent enumeration
  -> account status check
     - LOCKED -> HTTP 401 { code: "ACCOUNT_LOCKED" }
  -> BCrypt comparison
     - mismatch -> increment failure count and return HTTP 401 { code: "INVALID_CREDENTIALS" }
  -> successful authentication
  -> `sessionFixation().changeSessionId()`
  -> persist Spring Session in Redis
     - key: `spring:session:sessions:{sessionId}`
     - TTL: 30 minutes sliding
     - value: `{ memberUuid, email, roles, loginAt }`
  -> update device fingerprint baseline
  -> HTTP 200
     - body: `{ memberUuid, email, name }`
     - no access token or refresh token in body
     - cookie: `SESSION={sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/`
```

### Success Response

```json
{
  "memberUuid": "m-uuid-xxxx",
  "email": "user@fix.com",
  "name": "Hong Gil-dong"
}
```

### Error Response Summary

| Scenario | HTTP | code |
|---------|------|------|
| Wrong password | 401 | `INVALID_CREDENTIALS` |
| Unknown email | 401 | `INVALID_CREDENTIALS` |
| Locked account | 401 | `ACCOUNT_LOCKED` |
| IP rate-limit exceeded | 429 | rate-limit response |
| FDS blocked request | 403 | `FDS_BLOCKED` |

> **Note**: Password reset is handled by the dedicated recovery flow in Story 1.7. Account unlock remains an admin flow outside this section.
### Spring Session Configuration (`SecurityConfig`)

```java
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)
public class SessionConfig {

    @Bean
    public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
        return new GenericJackson2JsonRedisSerializer();
    }

    // [W1] Required for `maximumSessions(1)` when sessions are stored in Redis.
    @Bean
    public SpringSessionBackedSessionRegistry<?> sessionRegistry(
            FindByIndexNameSessionRepository<?> sessionRepository) {
        return new SpringSessionBackedSessionRegistry<>(sessionRepository);
    }
}

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final SpringSessionBackedSessionRegistry<?> sessionRegistry;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.sessionManagement(s -> s
            .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
            .sessionFixation().changeSessionId()
            .maximumSessions(1)
            .sessionRegistry(sessionRegistry)
            .maxSessionsPreventsLogin(false)
            .expiredSessionStrategy(event -> {
                event.getResponse().setStatus(401);
                event.getResponse().setContentType("application/json");
                event.getResponse().setCharacterEncoding("UTF-8");
                event.getResponse().getWriter().write(
                    "{\"code\":\"SESSION_EXPIRED_BY_NEW_LOGIN\",\"message\":\"Your session ended because the account was used on another device.\"}");
            })
        );
        return http.build();
    }
}
```

> **[W3] MVP note:** one Redis instance is acceptable for MVP. Sentinel / HA is a post-MVP hardening task.
>
> **[MA2] Device policy:** MVP allows a single active session. A later phase may relax this to a configurable device count.

> **[M1] Session fixation verification (OWASP A07)**
> ```gherkin
> Scenario: SESSION cookie rotates after login
>   Given GET /api/v1/auth/csrf issued SESSION=A
>   When  POST /api/v1/auth/login succeeds
>   Then  the response sets SESSION != A
>   And   SESSION=A can no longer access protected APIs
> ```

> **[Q7] Duplicate-login kick-out verification**
> ```gherkin
> Scenario: A second login invalidates the first session
>   Given session A is already logged in
>   When  the same account logs in again and receives session B
>   Then  session A receives HTTP 401 with code SESSION_EXPIRED_BY_NEW_LOGIN
>   And   session B continues to work normally
> ```

---

## 3. Protected API Calls (Spring Session Automatic Handling)

```text
Client
  -> GET /api/v1/accounts
  -> Browser automatically sends Cookie: SESSION={sessionId}
  -> nginx
  -> channel-service
  -> Spring Security loads SecurityContext from Redis session
     - missing or expired session -> HTTP 401 { code: "UNAUTHORIZED" }
     - active session -> sliding TTL refreshed to 30 minutes
  -> Controller executes business logic
  -> Response returned
```

> **Implementation note:** `JwtAuthenticationFilter` is removed. Spring Session owns session lookup, TTL refresh, and invalidation.

### Public Paths in `SecurityConfig`

```text
/api/v1/auth/login
/api/v1/auth/register
/api/v1/auth/csrf
/swagger-ui/**
/v3/api-docs/**
/actuator/health
/actuator/circuitbreakers
```

> **[S6] SSE remains authenticated:** `/api/v1/notifications/sse/**` is not a public path. The browser must already hold a valid `SESSION` cookie or the connection receives HTTP 401.
>
> `/api/v1/auth/refresh` is intentionally removed. There is no silent refresh endpoint in the Spring Session model.

---

## 4. Session Expiry Warning (Supplemental Reference C)

Silent refresh is fully removed. Instead, the server warns the user when the Redis-backed session has five minutes or less remaining, and the client decides whether to keep the session alive.

### Server-Side Expiry Warning

```java
@Component
public class SessionExpiryListener implements MessageListener {

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();
        if (expiredKey.startsWith("spring:session:sessions:")) {
            String sessionId = expiredKey.replace("spring:session:sessions:", "");
            notificationService.closeBySessionId(sessionId);
        }
    }
}

@Bean
public RedisMessageListenerContainer redisContainer(
        RedisConnectionFactory factory,
        SessionExpiryListener sessionExpiryListener) {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(factory);
    container.addMessageListener(
        sessionExpiryListener,
        new PatternTopic("__keyevent@*__:expired")
    );
    return container;
}

@Scheduled(fixedDelay = 60_000)
public void checkSessionExpiry() {
    activeSseConnections.forEach((sessionId, emitter) -> {
        String memberUuid = sessionToMember.get(sessionId);
        if (memberUuid == null) return;

        sessionRepository.findByPrincipalName(memberUuid)
            .values()
            .forEach(session -> {
                long remainingSecs = session.getMaxInactiveInterval().getSeconds()
                    - Duration.between(session.getLastAccessedTime(), Instant.now()).getSeconds();

                if (remainingSecs > 0 && remainingSecs <= 300) {
                    notificationService.push(sessionId, new SessionExpiryEvent(remainingSecs));
                } else if (remainingSecs <= 0) {
                    notificationService.closeBySessionId(sessionId);
                }
            });
    });
}
```

```yaml
# redis.conf or docker command
notify-keyspace-events: "Ex"
```

### Client 401 Handling (`src/lib/axios.ts`)

```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const code = error.response.data?.code;
      if (code === 'SESSION_EXPIRED_BY_NEW_LOGIN') {
        showToast('Your session ended because the account was used on another device.');
      } else {
        showToast('Your session has expired. Please log in again.');
      }
      authStore.clearMember();
      navigate('/login');
    }
    return Promise.reject(error);
  }
);
```

### SSE Warning UX

```text
1. Server emits `session-expiry { remainingSeconds: 300 }`
2. UI shows: "Automatic logout in 5 minutes."
3. User can call `GET /api/v1/auth/session` to refresh the sliding TTL
4. If the user does nothing, the next protected request returns HTTP 401
5. If SSE fails entirely, the client falls back to a local timer and retries EventSource 3 times (5s, 10s, 30s)
```

> **Why this UX matters:** in financial systems the user should see that the session is expiring. Hidden silent refresh weakens security visibility and makes forced logout harder to reason about.

---

## 5. Logout (Story 1.3)

```text
POST /api/v1/auth/logout
Cookie: SESSION={sessionId}
  -> channel-service
  -> SecurityContextHolder.clearContext()
  -> HttpSession.invalidate()
  -> Redis deletes `spring:session:sessions:{sessionId}`
  -> Response sets `SESSION=; Max-Age=0; Path=/`
  -> HTTP 204
```

> **Operational effect:** a logged-out session fails immediately on the next API call. There is no 30-minute grace period like the old JWT access-token model.

---

## 6. Account Lock (Story 1.2 Sub-Scenario)

```text
5 consecutive failures on the same account
  -> member.failedLoginCount >= 5
  -> member.status = LOCKED
  -> HTTP 401 { code: "ACCOUNT_LOCKED" }
  -> security event written
  -> FDS failure counter also updated
```

Administrative unlock remains a separate flow:

```text
POST /api/v1/admin/members/{memberUuid}/unlock
  -> member.status = ACTIVE
  -> failedLoginCount = 0
  -> security event written with admin actor
```

---

## 7. Frontend Auth State Management (Supplemental Reference A)

### Session Ownership Model

| Storage | Allowed | Why |
|--------|---------|-----|
| `SESSION` HttpOnly cookie | Yes | Browser-managed, not readable from JavaScript |
| `localStorage` | No | XSS exposure |
| `sessionStorage` | No | XSS exposure |
| In-memory access token | Removed | Not needed in the Spring Session model |

### Minimal Auth State

```typescript
interface AuthState {
  member: MemberInfo | null;
  isAuthenticated: boolean;
}

// Login success stores `{ memberUuid, email, name }` only.
// The browser attaches `SESSION` automatically.
```

### Axios Configuration

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// CSRF header is attached explicitly by the frontend.
// Authorization headers are no longer used.
```

### Protected Routes

```text
/login                 public
/register              public
/                      protected
/orders                protected
/settings/totp/*       protected
```

---

## 8. Cookie Security Settings

| Attribute | Value | Purpose |
|----------|-------|---------|
| `HttpOnly` | `true` | Prevents JavaScript cookie access |
| `Secure` | `true` in deploy, `false` locally | HTTPS-only in real environments |
| `SameSite` | `Strict` locally, `None; Secure` for cross-origin deploys | CSRF baseline defense |
| `Path` | `/` | Makes the session available to all app routes |
| `Max-Age` | browser-session default | Cookie disappears when the browser session ends |

```yaml
# application-local.yml
server.servlet.session.cookie.same-site: strict
server.servlet.session.cookie.http-only: true
server.servlet.session.cookie.secure: false

# application-deploy.yml
server.servlet.session.cookie.same-site: none
server.servlet.session.cookie.secure: true
```

---

## 9. CSRF Defense

```text
Synchronizer Token pattern (`HttpSessionCsrfTokenRepository`)
  1. Server stores CSRF token in the session
  2. Client calls GET /api/v1/auth/csrf
  3. React attaches `X-CSRF-TOKEN` on all non-GET requests
  4. Server compares header token with session token
  5. Third-party sites cannot forge the session-bound token
```

```java
http.csrf(csrf -> csrf
    .csrfTokenRepository(new HttpSessionCsrfTokenRepository())
    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
);
```

> **[W2] Login transition note:** `GET /api/v1/auth/csrf` can create a pre-login session. After successful login, `changeSessionId()` rotates the session ID, so the frontend must re-fetch the CSRF token once after login before sending protected mutations.

---

## 10. Sequence Diagrams

### Initial Login

```text
Browser -> nginx -> channel-service -> Redis
POST /api/v1/auth/login
  -> rate limit
  -> FDS analysis
  -> password verification
  -> changeSessionId()
  -> persist Spring Session in Redis
  -> HTTP 200 { memberUuid, email, name }
  -> Set-Cookie: SESSION=...; HttpOnly
```

### Session Expiry Warning

```text
Browser -> channel-service -> Redis
SSE connected
  -> scheduler checks remaining TTL
  -> when remaining TTL <= 300s, emit `session-expiry`
  -> user may call GET /api/v1/auth/session
  -> sliding TTL returns to 30 minutes
```

### Logout

```text
Browser -> channel-service -> Redis
POST /api/v1/auth/logout
  -> invalidate HttpSession
  -> delete Redis session
  -> clear SESSION cookie
  -> next protected API call returns 401
```

### Admin Force Logout

```java
@DeleteMapping("/members/{memberUuid}/sessions")
public ResponseEntity<Void> forceLogout(@PathVariable String memberUuid) {
    sessionRepository.findByPrincipalName(memberUuid)
        .keySet()
        .forEach(sessionRepository::deleteById);

    securityEventService.record(FORCED_LOGOUT, memberUuid, adminId);
    return ResponseEntity.noContent().build();
}
```

---

## 11. Environment Variables

| Variable | Purpose | Example |
|---------|---------|---------|
| `REDIS_PASSWORD` | Redis AUTH password | `STRONG_REDIS_PASS_HERE` |
| `SESSION_COOKIE_SECURE` | Local `false`, deploy `true` | `true` |
| `VITE_API_BASE_URL` | Frontend API base URL | `https://fix-api.example.com` |
| `VAULT_ADDR` | Vault address | `http://vault:8200` |
| `VAULT_TOKEN` | Dev token | `dev-root-token` |
| `VAULT_ROLE_ID` | Prod AppRole Role ID | `<uuid>` |
| `VAULT_SECRET_ID` | Prod AppRole Secret ID | `<uuid>` |
| `INTERNAL_API_SECRET` | Internal service auth header value | `CHANGE_ME_INTERNAL_SECRET` |

> `JWT_SECRET` is intentionally removed from this architecture.
>
> If `REDIS_PASSWORD` is missing, application startup must fail fast.
>
> Vault connectivity failure only blocks TOTP enrollment / verification paths. It must not block login itself.

---

## 12. Redis Key Inventory

| Key Pattern | TTL | Purpose |
|------------|-----|---------|
| `spring:session:sessions:{sessionId}` | 30 min sliding | Canonical Spring Session state |
| `spring:session:index:...:{memberUuid}` | 30 min | Principal lookup for admin force logout |
| `ch:ratelimit:login:{IP}` | Bucket-managed | Login rate limiting |
| `ch:totp-used:{memberUuid}:{window}:{code}` | 60s | TOTP replay guard |
| `fds:ip-fail:{ip}` | 10 min | FDS failed-login tracking |
| `fds:device:{memberUuid}` | 30 days | FDS device baseline |
| `fds:order-velocity:{memberUuid}` | 10 min | FDS order-frequency tracking |

```yaml
redis:
  image: redis:7-alpine
  command: >
    --requirepass ${REDIS_PASSWORD}
    --save 60 1
    --appendonly yes
    --notify-keyspace-events Ex
```

> Legacy JWT keys such as refresh-token buckets and access-token blacklists are removed from the design.
>
> Audit and security-event retention still requires a database archival plan outside Redis.

---

## 13. TOTP Enrollment Flow (Story 1.8)

> **Purpose:** TOTP is a prerequisite for order execution, not for basic login.

### Access Policy

| Capability | TOTP not enrolled | TOTP enrolled |
|-----------|-------------------|---------------|
| Login and session issuance | Allowed | Allowed |
| Account / portfolio reads | Allowed | Allowed |
| Settings changes | Allowed | Allowed |
| Order execution | Blocked with `AUTH-009` and `enrollUrl` | Allowed |

### Endpoints

| Method | Path | Purpose |
|-------|------|---------|
| `POST` | `/api/v1/members/me/totp/enroll` | Generate secret, store in Vault, return QR URI |
| `POST` | `/api/v1/members/me/totp/confirm` | Confirm first TOTP code and finish enrollment |
| `GET` | `/api/v1/members/me/totp/status` | Return enrollment status |
| `DELETE` | `/api/v1/members/me/totp` | Disable TOTP after password confirmation |

> Enrollment is idempotent while `totp_enabled=false`. Once TOTP is enabled, the user must delete it before re-enrolling.
>
> `DELETE /totp` requires `{ "password": "current-password" }` and must verify with `BCrypt.matches()`.

### Enrollment Summary

```text
1. POST /totp/enroll
   -> validate session
   -> generate Base32 secret
   -> store `secret/fix/member/{memberUuid}/totp-secret` in Vault
   -> return `otpauth://...` QR URI and expiry hint

2. User scans QR code in Google Authenticator

3. POST /totp/confirm
   -> read secret from Vault
   -> verify RFC 6238 code
   -> set `totp_enabled=true`
   -> redirect user back to the order flow or dashboard
```

### Error Cases

| Scenario | HTTP | code |
|---------|------|------|
| Invalid confirm code | 401 | `AUTH-010` |
| Enroll requested after TOTP already enabled | 409 | domain conflict response |
| Order attempted before enrollment | 403 | `AUTH-009` with `enrollUrl` |

```sql
ALTER TABLE member ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE member ADD COLUMN totp_enrolled_at TIMESTAMP NULL;
```

---

## 14. Vault Secret Management

### Overview

| Topic | Value |
|------|-------|
| Vault library | `org.springframework.vault:spring-vault-core` |
| TOTP library | `com.warrenstrange:googleauth:1.5.0` |
| KV mount | `secret/` (KV v2) |
| Secret path | `secret/fix/member/{memberUuid}/totp-secret` |
| Forbidden storage | DB and Redis |

### Secret Operations

| Operation | Vault API | Trigger |
|----------|-----------|---------|
| Store secret | `PUT /v1/secret/fix/member/{memberUuid}/totp-secret` | TOTP enroll |
| Read secret | `GET /v1/secret/fix/member/{memberUuid}/totp-secret` | TOTP confirm and order OTP verify |
| Delete secret | `DELETE /v1/secret/fix/member/{memberUuid}/totp-secret` | TOTP disable |

```java
public interface OtpService {
    TotpEnrollResult generateSecret(String memberUuid);
    boolean confirmEnrollment(String memberUuid, String code);
    OtpVerifyResult verify(String sessionId, String code, String memberUuid);
}
```

> Inject `Clock` into `TotpOtpService` so the time window can be tested deterministically with `Clock.fixed(...)`.

### Replay Guard

```text
Redis key: ch:totp-used:{memberUuid}:{windowIndex}:{code}
TTL: 60 seconds
Behavior:
  1. TOTP verification succeeds
  2. Redis SET NX stores the used code for the current 30-second window
  3. Reuse in the same window returns HTTP 401 { code: "AUTH-011" }
```

---

## 15. nginx + Let's Encrypt TLS

```nginx
server {
    listen 80;
    server_name fix-api.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name fix-api.example.com;

    ssl_certificate     /etc/letsencrypt/live/fix-api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fix-api.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass       http://localhost:8080;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d fix-api.example.com
```

```yaml
server:
  forward-headers-strategy: native
```

---

## 16. Baseline FDS Rules

> **Goal:** use the existing Redis and audit-log footprint to provide an interview-ready fraud-detection baseline without adding a separate service.

### Rules

| Rule ID | Condition | Decision | Backing Store |
|--------|-----------|----------|---------------|
| `FDS-001` | 10 failed logins from the same IP within 10 minutes | `BLOCK` | `fds:ip-fail:{ip}` |
| `FDS-002` | New device fingerprint for known member | `MONITOR` | `fds:device:{memberUuid}` |
| `FDS-003` | Login during high-risk overnight window | `MONITOR` | rule-only |
| `FDS-004` | Order amount > 3x 90-day max | `CHALLENGE` | audit-log query |
| `FDS-005` | 3 order attempts in 10 minutes on same member | `CHALLENGE` | `fds:order-velocity:{memberUuid}` |

### Decisions

| Decision | Effect | Audit/Security Event |
|---------|--------|----------------------|
| `ALLOW` | Continue normally | none |
| `MONITOR` | Continue and record signal | `FDS_TRIGGERED` |
| `CHALLENGE` | Require additional verification | `FDS_TRIGGERED` |
| `BLOCK` | Return HTTP 403 `FDS_BLOCKED` and optionally invalidate session | `FDS_BLOCKED` |

### Integration Points

```text
AuthService.login() -> FdsService.analyze(LOGIN_ATTEMPT)
OrderSessionService.initiate() -> FdsService.analyze(ORDER_INITIATED)
```

---

## 17. Implementation File Map

### Files Removed from the JWT Model

| Old File | Reason |
|---------|--------|
| `auth/service/JwtProvider.java` | JWT issuance removed |
| `auth/filter/JwtAuthenticationFilter.java` | Replaced by Spring Session |
| Auth refresh endpoint code | Silent refresh removed |

### Files Added or Changed

| Component | Path |
|----------|------|
| Auth controller | `channel-service/.../auth/controller/AuthController.java` |
| Session config | `channel-service/.../config/SessionConfig.java` |
| Security config | `channel-service/.../config/SecurityConfig.java` |
| FDS service | `channel-service/.../security/fds/FdsService.java` |
| FDS rules | `channel-service/.../security/fds/rule/` |
| OTP service interface | `channel-service/.../order/service/OtpService.java` |
| TOTP implementation | `channel-service/.../order/service/TotpOtpService.java` |
| TOTP controller | `channel-service/.../auth/controller/TotpController.java` |
| Vault config | `channel-service/.../config/VaultConfig.java` |
| Axios instance | `fix-web/src/lib/axios.ts` |
| Auth context | `fix-web/src/contexts/AuthContext.tsx` |
| Login page | `fix-web/src/pages/LoginPage.tsx` |
| Private route | `fix-web/src/router/PrivateRoute.tsx` |
| TOTP enroll page | `fix-web/src/pages/settings/TotpEnrollPage.tsx` |

---

## 18. Definition of Done (DoD)

### Functional Completion

- [ ] Register, login, and logout flows work end-to-end.
- [ ] TOTP enrollment and order step-up verification work end-to-end.
- [ ] Admin forced logout works via `DELETE /api/v1/admin/members/{memberUuid}/sessions`.

### Security Verification

- [ ] Session fixation test passes (`[M1]`).
- [ ] Duplicate-login kick-out test passes (`[Q7]`).
- [ ] Frontend re-fetches CSRF token after login (`[W2]`).
- [ ] TOTP replay guard test passes.

### Infrastructure Verification

- [ ] Deploy profile enables Redis TLS where required.
- [ ] Startup fails when `REDIS_PASSWORD` is missing.
- [ ] Redis `notify-keyspace-events Ex` is enabled.
- [ ] nginx certificate issuance and renewal are documented and tested.

### Code Quality

- [ ] Auth/security packages meet the target unit-test coverage.
- [ ] FDS queries and Redis TTL behavior are covered by smoke tests.
- [ ] Dev-only tooling is protected by local/dev profiles.
- [ ] Legacy JWT classes and refresh flow are fully removed.

### Documentation

- [ ] Security-event retention policy is documented.
- [ ] Single-device session policy is documented for MVP.
## Password Recovery Flow Addendum (Canonical Story 1.7, 2026-03-05)

### Flow A: Forgot Request (`POST /api/v1/auth/password/forgot`)

1. Normalize email: `NFKC(trim(email)).toLowerCase(Locale.ROOT)`
2. Apply rate limits (`per-IP`, `per-email`, `mail-cooldown`) and challenge gate decision
3. If challenge-gated, require `challengeToken + challengeAnswer` validation
4. Always return fixed `202` response envelope (no eligibility disclosure)
5. If account is eligible and policy passes, issue reset token asynchronously and dispatch email

### Flow B: Challenge Bootstrap (`POST /api/v1/auth/password/forgot/challenge`)

1. Return fixed `200` contract regardless of account existence/status
2. Issue signed challenge token (`ttl=300s`) with email-hash binding
3. Persist nonce in Redis using atomic create (`SET NX EX 300`)
4. Enforce challenge endpoint rate limits (`per-IP`, `per-email`, `endpoint-global`)

### Flow C: Reset (`POST /api/v1/auth/password/reset`)

1. Derive token hash with active+previous pepper versions
2. Validate token state under equalized timing policy (`120ms + jitter 0~20ms`)
3. In one DB transaction:
   - update `members.password_hash`
   - update `members.password_changed_at`
   - mark reset token consumed
4. Post-commit: invalidate active sessions; if delayed, auth filter blocks stale sessions via `AUTH-016`

### Security Notes

- CSRF is mandatory for forgot/challenge/reset.
- CSRF retry policy for all password recovery submits: one re-fetch + one retry only.
- Retry must preserve payload/idempotency fields exactly.
- Challenge replay is blocked by Redis atomic nonce consume.
