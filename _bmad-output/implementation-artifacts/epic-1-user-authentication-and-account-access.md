# Epic 1: User Authentication & Account Access

## Summary

Users can log in and maintain their session via Spring Session Redis (JSESSIONID HttpOnly cookie with 30-minute sliding TTL), safely view their account list and balances, and receive an SSE warning notification 5 minutes before session expiry to extend the session. On logout, the session is immediately invalidated. The React app's Router + PrivateRoute + NavigationBar are built.

**FRs covered:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-52  
**Architecture requirements:** SessionConfig(@EnableRedisHttpSession), SpringSessionBackedSessionRegistry, CorrelationIdFilter, AuthService, OtpService (base), SecurityConfig, CorsConfig, Member Entity, Account Entity, ChannelIntegrationTestBase, CoreBankIntegrationTestBase  
**Frontend:** LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx, App.tsx(Router), PrivateRoute, NavigationBar, useAuthStore.ts, useAccount.ts, lib/axios.ts(SSE + 401 handler)

> **Common Error Format (GlobalExceptionHandler):** All error responses follow the `{ code: string, message: string, timestamp: ISO8601, path: string }` structure. `@ControllerAdvice` `GlobalExceptionHandler` handles this consistently.

---

## Story 1.1: Member Registration API

As a **new user**,  
I want to register with my email, password, and name,  
So that I can create an account and immediately have a bank account ready to use.

### Acceptance Criteria

**Given** `POST /api/v1/auth/register` receives `{ email, password, name }` with valid data  
**When** the email does not already exist  
**Then** member record is created with `ROLE_USER`, `ACTIVE` status  
**And** password is stored as BCrypt hash (≥12 rounds)  
**And** Register API always assigns `ROLE_USER` (`ROLE_ADMIN` is only created via direct DB seed)  
**And** corebank-service `POST /internal/v1/accounts` is called to auto-create one default current account (FR-52)  
**And** HTTP 201 returned: `{ memberId, email, name, createdAt }`

**Given** corebank `POST /internal/v1/accounts` call fails with 5xx or timeout  
**When** exception occurs  
**Then** member save is also rolled back, HTTP 503 `{ code: "ACCOUNT_CREATION_FAILED" }` returned

**Given** `POST /api/v1/auth/register` with duplicate email  
**When** the email already exists  
**Then** HTTP 409 `{ code: "MEMBER_ALREADY_EXISTS" }` returned

**Given** invalid input (empty email, password shorter than 8 characters)  
**When** Bean Validation executes  
**Then** HTTP 400 with field-level error details

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL)  
**When** integration test runs  
**Then** successful registration, duplicate email, and validation failure cases all pass

---

## Story 1.2: Login & Spring Session Issuance

As a **registered user**,  
I want to log in with my email and password and receive a session cookie,  
So that I can authenticate subsequent API calls automatically.

### Acceptance Criteria

**Given** `POST /api/v1/auth/login` with valid credentials  
**When** Spring Security processes authentication  
**Then** session is stored in Spring Session Redis (30-minute sliding TTL)  
**And** `Set-Cookie: JSESSIONID={sessionId}; HttpOnly; Secure; SameSite=Strict` response header is set  
**And** `sessionFixation().changeSessionId()` — temporary session ID before login → new session ID issued (session fixation attack prevention)  
**And** `maximumSessions(1)` — on re-login with same account, existing session is force-expired  
**And** HTTP 200 returned: `{ memberId, email, name }`  
**And** loaded only from `REDIS_PASSWORD` environment variable (no hardcoding in code)

**Given** login with incorrect password  
**When** authentication fails  
**Then** HTTP 401 `{ code: "INVALID_CREDENTIALS" }` returned, no session issued

**Given** login with non-existent email  
**When** `UserDetailsService` throws `UsernameNotFoundException`  
**Then** HTTP 401 returned (same message — prevents email enumeration, NFR-S2)

**Given** 5 consecutive login failures from the same IP  
**When** 6th `POST /api/v1/auth/login` request  
**Then** HTTP 429 returned (Redis Bucket4j IP rate-limit)

**Given** 5 consecutive login failures for the same account (email)  
**When** 6th login attempt  
**Then** account status changed to `LOCKED`, HTTP 401 `{ code: "ACCOUNT_LOCKED" }` returned  
**And** login not possible even with correct password (admin unlock required — implemented in Epic 6)

**Given** protected endpoint called with issued JSESSIONID cookie  
**When** `HttpSessionSecurityContextRepository` processes  
**Then** session retrieved from Redis → `MemberDetails` registered in `SecurityContext` → TTL reset to 30 minutes

**Given** new session B login with same account (while existing session A exists)  
**When** `maximumSessions(1)` triggers  
**Then** API call with session A returns HTTP 401 `{ code: "SESSION_EXPIRED_BY_NEW_LOGIN" }`  
**And** session B operates normally

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + Redis)  
**When** login integration test runs  
**Then** valid credentials login confirms JSESSIONID cookie received  
**And** session fixation defense: JSESSIONID replaced before/after login confirmed

---

## Story 1.3: Explicit Logout & Session Expiry Notification

As an **authenticated user**,  
I want to explicitly log out and receive advance warning before my session expires,  
So that my session is securely terminated and I can extend it if needed.

**Depends On:** Story 1.2

### Acceptance Criteria

**Given** `POST /api/v1/auth/logout` call (valid JSESSIONID cookie)  
**When** processed  
**Then** `HttpSession.invalidate()` → Redis `spring:session:sessions:{sessionId}` immediately deleted  
**And** `Set-Cookie: JSESSIONID=; Max-Age=0; Path=/` (cookie immediately expired)  
**And** HTTP 204 returned

**Given** API call protected by same JSESSIONID after logout  
**When** Spring Session lookup  
**Then** Redis key missing → HTTP 401 returned immediately (no TTL wait unlike JWT)

**Given** Redis `notify-keyspace-events=Ex` configured + `SessionExpiryListener` enabled  
**When** Session TTL remaining ≤ 300 seconds detected (`@Scheduled(fixedDelay=60_000)`)  
**Then** SSE event `session-expiry { remainingSeconds: 300 }` sent  
**And** Client toast: "Automatic logout in 5 minutes."

**Given** User clicks "Continue" → `GET /api/v1/auth/session` called  
**When** Spring Session check  
**Then** Session TTL reset to 30 minutes (sliding)  
**And** HTTP 200 returned

**Given** SSE connection lost (network error)  
**When** EventSource reconnection attempts 3 times (backoff 5s, 10s, 30s) all fail  
**Then** Client timer (25 minutes after last activity) displays warning

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + Redis)  
**When** Logout integration test runs  
**Then** HTTP 401 confirmed on API call protected by JSESSIONID after logout

---

## Story 1.4: Account List & Balance Inquiry

As a **logged-in user**,  
I want to view my account list and real-time balances,  
So that I know how much money I have before initiating a transfer.

**Depends On:** Story 0.1 (corebank startup), Story 1.2 (Spring Session authentication)

### Acceptance Criteria

**Given** `GET /api/v1/accounts` call (valid JSESSIONID cookie)  
**When** channel-service → corebank-service `GET /internal/v1/members/{memberId}/accounts` call  
**Then** request includes `X-Internal-Secret: {INTERNAL_API_SECRET}` header (NFR-S4)  
**And** corebank-service returns HTTP 403 for internal API requests without the header  
**And** HTTP 200: `[ { accountId, accountNumber, balance, currency, createdAt } ]`  
**And** balance reflects real-time DB value (no cache, FR-08)

**Given** member with 0 accounts queried  
**When** request processed  
**Then** HTTP 200, empty array `[]` returned

**Given** `GET /api/v1/accounts/{accountId}/balance` call (own account)  
**When** request processed  
**Then** HTTP 200: `{ accountId, balance, pendingAmount, currency, asOf }`  
**And** `balance` is available balance after deducting PENDING transfers, `pendingAmount` is the amount pending withdrawal

**Given** query by account ID owned by another member  
**When** ownership verification fails  
**Then** HTTP 403 returned

---

## Story 1.5: Transfer History Inquiry

As a **logged-in user**,  
I want to view my transfer history in a paginated and filterable list,  
So that I can track my financial activity.

**Depends On:** Story 1.4

### Acceptance Criteria

**Given** `GET /api/v1/transfers?page=0&size=20` call (valid JSESSIONID cookie)  
**When** channel-service queries the transfer_session table  
**Then** HTTP 200: `{ content: [...], totalElements, totalPages, page, size }`  
**And** each item: `{ transferId, fromAccount, toAccount, amount, status, createdAt }`  
**And** sorted by `createdAt DESC`

**Given** `GET /api/v1/transfers/{transferId}` call (own transfer)  
**When** ownership check passes  
**Then** HTTP 200: full details including `{ ..., fepReferenceId, completedAt, failReason }`

**Given** query by another member's transfer ID  
**When** ownership verification fails  
**Then** HTTP 403 returned

**Given** `GET /api/v1/transfers?status=COMPLETED`  
**When** query executes  
**Then** only COMPLETED status transfers returned

**Given** `GET /api/v1/transfers?direction=SENT` or `direction=RECEIVED`  
**When** query executes  
**Then** `SENT` → returns only transfers where `fromAccountId` is own account  
**And** `RECEIVED` → returns only transfers where `toAccountId` is own account  
**And** all transfers returned when `direction` not specified

**Given** `GET /api/v1/transfers?page=-1` or `size=0`  
**When** request processed  
**Then** HTTP 400 returned (invalid page parameters)

---

## Story 1.6: Profile & Password Change

As a **logged-in user**,  
I want to view my profile and change my password,  
So that I can manage my account security.

**Depends On:** Story 1.3 (Logout + Spring Session structure)

### Acceptance Criteria

**Given** `GET /api/v1/members/me` call (valid JSESSIONID cookie)  
**When** request processed  
**Then** HTTP 200: `{ memberId, email, name, role, createdAt }` (password hash excluded)

**Given** `PATCH /api/v1/members/me/password` with `{ currentPassword, newPassword }`  
**When** `currentPassword` matches the stored BCrypt hash  
**Then** `newPassword` updated as BCrypt hash  
**And** all Redis keys matching `refresh:{memberId}:*` pattern deleted (force re-login on all devices)  
**And** HTTP 204 returned

**Given** incorrect `currentPassword` entered  
**When** BCrypt comparison fails  
**Then** HTTP 400 `{ code: "CURRENT_PASSWORD_MISMATCH" }`

**Given** `newPassword` shorter than 8 characters  
**When** Bean Validation executes  
**Then** HTTP 400 validation error returned

---

## Story 1.7: Frontend — Auth Pages & Private Route

As a **user**,  
I want login/register pages with proper route protection and navigation,  
So that unauthenticated users cannot access protected sections of the app.

### Acceptance Criteria

**Given** user accesses `/login`  
**When** login page renders  
**Then** email and password fields displayed  
**And** on successful login, member info saved to `useAuthStore` (JSESSIONID automatically managed by browser cookie) then redirect to `/`

**Given** login failure (HTTP 401)  
**When** response received  
**Then** "Please check your email or password" inline error message displayed (below input field, no toast)

**Given** login button clicked, waiting for response  
**When** API call in progress  
**Then** button disabled + loading spinner displayed (prevents double-click)

**Given** user accesses `/register`  
**When** registration page renders  
**Then** name, email, password fields displayed  
**And** on success, redirect to `/login`

**Given** `<PrivateRoute>` wrapping routes requiring authentication (`/`, `/transfers`, etc.)  
**When** an unauthenticated user accesses  
**Then** redirect to `/login` (optionally saving returnTo)

**Given** `<NavBar>` renders (authenticated user)  
**When** displayed  
**Then** contains username, account list link, transfer history link, logout button  
**And** on logout click, `POST /api/v1/auth/logout` called then `useAuthStore` member reset to null

---

## Story 1.8: TOTP Enrollment (Google Authenticator)

As an **authenticated user**,  
I want to register my Google Authenticator app to my account,  
So that I can use TOTP-based step-up authentication when initiating transfers.

**Depends On:** Story 1.2 (Spring Session authentication), Story 1.6 (password verification pattern)

### Acceptance Criteria

**Given** `POST /api/v1/members/me/totp/enroll` (valid JSESSIONID cookie, `member.totp_enabled = false`)  
**When** enrollment initiation request  
**Then** `TotpOtpService.generateSecret()` → Base32 encoded secret generated (`com.warrenstrange:googleauth:1.5.0` library)  
**And** Secret stored at Vault path `secret/fix/member/{memberId}/totp-secret` (FR-TOTP-04 — DB storage prohibited)  
**And** `member.totp_enabled = false` maintained (before confirmEnrollment)  
**And** HTTP 200: `{ qrUri: "otpauth://totp/FIX:{email}?secret={base32Secret}&issuer=FIX", expiresAt }` — secret included only once in this response

**Given** `POST /api/v1/members/me/totp/confirm` with `{ totpCode: "123456" }`  
**When** user submits first code after registering QR in Google Authenticator app  
**Then** `TotpOtpService.confirmEnrollment(memberId, totpCode)` executes  
**And** Vault retrieves memberId secret → RFC 6238 TOTP verification (±1 window allowed)  
**And** verification success → `member.totp_enabled = true`, `member.totp_enrolled_at = NOW()` updated  
**And** HTTP 200: `{ message: "Google OTP registration is complete." }`

**Given** confirmEnrollment attempted with incorrect totpCode  
**When** TOTP code mismatch  
**Then** HTTP 401 `{ code: "AUTH-010", message: "The authentication code is incorrect. Please check the current code in your app." }`  
**And** `totp_enabled = false` maintained (retry possible)

**Given** `GET /api/v1/members/me/totp/status`  
**When** request processed  
**Then** HTTP 200: `{ totpEnabled: true/false, enrolledAt: "2026-02-24T10:00:00Z" | null }`

**Given** `DELETE /api/v1/members/me/totp` with `{ currentPassword }` (TOTP reset request)  
**When** password confirmation passes (BCrypt verification)  
**Then** Vault TOTP secret for the memberId deleted  
**And** `member.totp_enabled = false`, `member.totp_enrolled_at = null` reset  
**And** HTTP 204 returned

**DB Flyway migration (`V?__add_totp_fields_to_member.sql`):**
```sql
ALTER TABLE member ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE member ADD COLUMN totp_enrolled_at TIMESTAMP NULL;
```

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + WireMock Vault)  
**When** TOTP Enrollment flow integration test runs  
**Then** enroll → QR URI received → confirm → `totp_enabled=true` confirmed  
**And** confirm attempted with incorrect code → HTTP 401 AUTH-010 verified  
**And** DELETE totp → `totp_enabled=false` confirmed

---

## Story 1.9: Frontend — SSE Session Expiry & Error UX

As a **logged-in user**,  
I want to receive advance warning before my session expires and for session errors to be clearly communicated,  
So that I can extend my session or be gracefully redirected to login.

**Depends On:** Story 1.8, Story 1.7, Story 1.3

### Acceptance Criteria

**Given** SSE `session-expiry { remainingSeconds: 300 }` event received  
**When** client EventSource listener executes  
**Then** Toast "You will be automatically logged out in 5 minutes. Would you like to continue?" displayed  
**And** clicking "Keep session" button calls `GET /api/v1/auth/session` → session TTL reset to 30 minutes

**Given** HTTP 401 response received (session expired)  
**When** Axios response interceptor executes (less than 10 lines)  
**Then** if `SESSION_EXPIRED_BY_NEW_LOGIN` code: "Your session has been terminated because you logged in from another device." toast  
**And** for other 401s: "Your session has expired. Please log in again." toast displayed once  
**And** redirect to `/login` (prevent infinite loop)

**Given** SSE EventSource connection dropped  
**When** 3 reconnection attempts (backoff 5s, 10s, 30s) all fail  
**Then** client self-timer (25 minutes after last activity) warning displayed

**Given** Playwright (or Cypress) E2E test environment configured  
**When** login → account list → logout flow executed  
**Then** structure ready to confirm normal response at each step  
**Note:** Actual E2E scenario implementation completed in Epic 8
