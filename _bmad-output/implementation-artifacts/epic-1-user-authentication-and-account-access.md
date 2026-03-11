# Epic 1: User Authentication & Account Access

> Completed archival artifact. Canonical Epic 1 is complete as of `2026-03-11`. This document preserves earlier implementation context and may diverge from the current canonical contract. For active design truth, refer to `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/channels/api-spec.md`, `_bmad-output/planning-artifacts/ux-design-specification.md`, and `_bmad-output/planning-artifacts/epics.md`.

## Summary

Users can log in and maintain their session via Spring Session Redis-backed session cookies with a 30-minute sliding TTL, safely view their account list and balances, recover access through anti-enumeration password recovery endpoints, and receive an SSE warning notification 5 minutes before session expiry to extend the session. On logout or password reset, active sessions are invalidated.

**FRs covered:** FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, FR-08, FR-09, FR-10, FR-52, FR-57, FR-58, FR-59, FR-60, FR-61  
**Architecture requirements:** SessionConfig(@EnableRedisHttpSession), SpringSessionBackedSessionRegistry, CorrelationIdFilter, AuthService, OtpService (base), SecurityConfig, CorsConfig, Member Entity, Account Entity, ChannelIntegrationTestBase, CoreBankIntegrationTestBase  
**Frontend:** LoginPage.tsx, RegisterPage.tsx, DashboardPage.tsx, App.tsx(Router), PrivateRoute, NavigationBar, useAuthStore.ts, useAccount.ts, lib/axios.ts(SSE + 401 handler)
**Completion snapshot:** Canonical Story `1.1`~`1.10` are complete and Epic 1 is closed in `_bmad-output/implementation-artifacts/sprint-status.yaml`.  
**Retrospective:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-03-11.md`  
**Canonical planning source:** `_bmad-output/planning-artifacts/epics.md` (Epic 1 Story `1.1`~`1.10`)  
**Canonical tracking source:** `_bmad-output/implementation-artifacts/sprint-status.yaml`  
**Usage rule:** This document is supplemental archival context; use canonical Story files and sprint-status keys as the source of truth for completion, implementation tracking, and next-epic handoff.  
**Numbering notice:** Canonical Epic 1 scope now runs through Story `1.10`. Older non-canonical references that previously occupied `1.7`~`1.9` are relabeled below as supplemental references to avoid ID collisions.  
**Alignment hint:** Numbered sections below are preserved for historical traceability only. Canonical Story 1.1/1.2/1.3/1.4/1.5/1.6/1.7/1.8/1.9/1.10 retain ownership for all active implementation and maintenance work.  
**Recovery cleanup note:** Canonical password-reset-token terminalization and retention behavior now belongs to Story `1.10`; treat any older recovery persistence wording in this historical artifact as supplemental only.  
**Verification baseline:** Party-mode QA reinforcement is reflected in canonical Story files; validate against canonical Story artifacts because the previous local helper script is not part of this repository.

> **Common Error Format (GlobalExceptionHandler):** All error responses follow the `{ code: string, message: string, timestamp: ISO8601, path: string }` structure. `@ControllerAdvice` `GlobalExceptionHandler` handles this consistently.

---

## Story 1.1: Member Registration API

As a **new user**,  
I want to register with my email, password, and name,  
So that I can create an account and immediately have a trading account ready to use.

### Acceptance Criteria

**Given** `POST /api/v1/auth/register` receives `{ email, password, name }` with valid data  
**When** the email does not already exist  
**Then** member record is created with `ROLE_USER`, `ACTIVE` status  
**And** password is stored as BCrypt hash (>=12 rounds)  
**And** Register API always assigns `ROLE_USER` (`ROLE_ADMIN` is only created via direct DB seed)  
**And** corebank-service `POST /internal/v1/portfolio` is called to auto-create one default trading account (FR-52)  
**And** HTTP 201 returned: `{ memberUuid, email, name, createdAt }`

**Given** corebank `POST /internal/v1/portfolio` call fails with 5xx or timeout  
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
**And** a secure authenticated session cookie is issued  
**And** `sessionFixation().changeSessionId()` rotates any temporary pre-login session id to a new authenticated session id  
**And** `maximumSessions(1)` force-expires the previous session on re-login with the same account  
**And** HTTP 200 returned: `{ memberUuid, email, name }`  
**And** loaded only from `REDIS_PASSWORD` environment variable (no hardcoding in code)

**Given** login with incorrect password  
**When** authentication fails  
**Then** HTTP 401 `{ code: "INVALID_CREDENTIALS" }` returned, no session issued

**Given** login with non-existent email  
**When** `UserDetailsService` throws `UsernameNotFoundException`  
**Then** HTTP 401 returned (same message prevents email enumeration, NFR-S2)

**Given** 5 consecutive login failures from the same IP  
**When** 6th `POST /api/v1/auth/login` request  
**Then** HTTP 429 returned (Redis Bucket4j IP rate-limit)

**Given** 5 consecutive login failures for the same account (email)  
**When** 6th login attempt  
**Then** account status changed to `LOCKED`, HTTP 401 `{ code: "ACCOUNT_LOCKED" }` returned  
**And** login not possible even with correct password (admin unlock required; implemented in Epic 6)

**Given** protected endpoint called with the issued authenticated session cookie  
**When** `HttpSessionSecurityContextRepository` processes  
**Then** session is retrieved from Redis, `MemberDetails` is registered in `SecurityContext`, and TTL resets to 30 minutes

**Given** new session B login with same account (while existing session A exists)  
**When** `maximumSessions(1)` triggers  
**Then** API call with session A returns HTTP 401 `{ code: "SESSION_EXPIRED_BY_NEW_LOGIN" }`  
**And** session B operates normally

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + Redis)  
**When** login integration test runs  
**Then** valid credentials login confirms a secure session cookie is received  
**And** session fixation defense confirms the pre-login and post-login session ids differ

---

## Story 1.3: Explicit Logout & Session Expiry Notification

As an **authenticated user**,  
I want to explicitly log out and receive advance warning before my session expires,  
So that my session is securely terminated and I can extend it if needed.

**Depends On:** Story 1.2

### Acceptance Criteria

**Given** `POST /api/v1/auth/logout` call (valid authenticated session)  
**When** processed  
**Then** `HttpSession.invalidate()` immediately deletes the server-side Spring Session record  
**And** the session cookie is expired immediately  
**And** HTTP 204 returned

**Given** API call protected by the same session after logout  
**When** Spring Session lookup  
**Then** missing Redis session state causes HTTP 401 immediately (no TTL wait unlike JWT)

**Given** Redis `notify-keyspace-events=Ex` configured + `SessionExpiryListener` enabled  
**When** Session TTL remaining <=300 seconds is detected (`@Scheduled(fixedDelay=60_000)`)  
**Then** SSE event `session-expiry { remainingSeconds: 300 }` sent  
**And** Client toast: "Automatic logout in 5 minutes."

**Given** User clicks "Continue" and `GET /api/v1/auth/session` is called  
**When** Spring Session check  
**Then** Session TTL reset to 30 minutes (sliding)  
**And** HTTP 200 returned

**Given** SSE connection lost (network error)  
**When** EventSource reconnection attempts 3 times (backoff 5s, 10s, 30s) all fail  
**Then** Client timer (25 minutes after last activity) displays warning

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + Redis)  
**When** Logout integration test runs  
**Then** HTTP 401 confirmed on API call protected by the former session after logout

---

## Legacy Reference: Account List & Balance Inquiry (scope now Epic 2)

As a **logged-in user**,  
I want to view my account list and real-time balances,  
So that I know how much money I have before initiating an order.

**Depends On:** Story 0.1 (corebank startup), Story 1.2 (Spring Session authentication)

### Acceptance Criteria

**Given** `GET /api/v1/portfolio` call (valid authenticated session)  
**When** channel-service calls corebank-service `GET /internal/v1/members/{memberUuid}/portfolio`  
**Then** request includes `X-Internal-Secret: {INTERNAL_API_SECRET}` header (NFR-S4)  
**And** corebank-service returns HTTP 403 for internal API requests without the header  
**And** HTTP 200: `[ { accountId, accountNumber, balance, currency, createdAt } ]`  
**And** balance reflects real-time DB value (no cache, FR-08)

**Given** member with 0 accounts queried  
**When** request processed  
**Then** HTTP 200, empty array `[]` returned

**Given** `GET /api/v1/portfolio/{accountId}/balance` call (own account)  
**When** request processed  
**Then** HTTP 200: `{ accountId, balance, pendingAmount, currency, balanceAsOf }` (DECIMAL(19,4) scale)  
**And** `balance` is canonical available balance, `pendingAmount` is reservation context for pending orders  
**And** if external contract exposes `availableBalance`, it is alias-only (`availableBalance == balance`)

**Given** query by account ID owned by another member  
**When** ownership verification fails  
**Then** HTTP 403 returned

---

## Legacy Reference: Order History Inquiry (scope now Epic 2)

As a **logged-in user**,  
I want to view my order history in a paginated and filterable list,  
So that I can track my financial activity.

**Depends On:** Story 1.4

### Acceptance Criteria

**Given** `GET /api/v1/orders?page=0&size=20` call (valid authenticated session)  
**When** channel-service queries the order_session table  
**Then** HTTP 200: `{ content: [...], totalElements, totalPages, page, size }`  
**And** each item: `{ orderId, symbol, side, quantity, price, status, createdAt }`  
**And** sorted by `createdAt DESC`

**Given** `GET /api/v1/orders/{orderId}` call (own order)  
**When** ownership check passes  
**Then** HTTP 200: full details including `{ ..., clOrdID, completedAt, failReason }`

**Given** query by another member's order ID  
**When** ownership verification fails  
**Then** HTTP 403 returned

**Given** `GET /api/v1/orders?status=FILLED`  
**When** query executes  
**Then** only FILLED status orders returned

**Given** `GET /api/v1/orders?symbol=005930`  
**When** query executes  
**Then** only orders for symbol 005930 returned  
**And** all orders returned when `symbol` not specified

**Given** `GET /api/v1/orders?page=-1` or `size=0`  
**When** request processed  
**Then** HTTP 400 returned (invalid page parameters)

---

## Legacy Reference: Profile & Password Change (scope split across canonical Story 1.2 and Story 1.7)

As a **logged-in user**,  
I want to view my profile and change my password,  
So that I can manage my account security.

**Depends On:** Story 1.3 (Logout + Spring Session structure)

### Acceptance Criteria

**Given** `GET /api/v1/members/me` call (valid authenticated session)  
**When** request processed  
**Then** HTTP 200: `{ memberUuid, email, name, role, createdAt }` (password hash excluded)

**Given** `PATCH /api/v1/members/me/password` with `{ currentPassword, newPassword }`  
**When** `currentPassword` matches the stored BCrypt hash  
**Then** `newPassword` updated as BCrypt hash  
**And** all active Spring Session records for the member are invalidated (force re-login on all devices)  
**And** HTTP 204 returned

**Given** incorrect `currentPassword` entered  
**When** BCrypt comparison fails  
**Then** HTTP 400 `{ code: "CURRENT_PASSWORD_MISMATCH" }`

**Given** `newPassword` shorter than 8 characters  
**When** Bean Validation executes  
**Then** HTTP 400 validation error returned

---

## Story 1.7: Password Recovery API

As a **locked-out or forgetful user**,  
I want a secure password recovery API,  
So that I can regain access without leaking whether my account exists.

**Depends On:** Story 1.1, Story 1.2, Story 1.5, Story 1.6

### Acceptance Criteria

**Given** `POST /api/v1/auth/password/forgot`  
**When** any normalized email is submitted  
**Then** the API always returns the fixed `202 Accepted` recovery envelope  
**And** only eligible accounts receive an asynchronously issued reset email

**Given** `POST /api/v1/auth/password/forgot/challenge`  
**When** challenge bootstrap is requested  
**Then** the API returns the fixed `200 OK` challenge contract with signed challenge token, `ttl=300s`, and replay-safe nonce handling

**Given** `POST /api/v1/auth/password/reset` with a valid reset token and a password different from the current password  
**When** the request succeeds  
**Then** password hash update, `password_changed_at` update, and reset-token consume happen atomically  
**And** active sessions are invalidated and stale follow-up requests are rejected with `AUTH-016`  
**And** HTTP 204 returned

**Given** invalid, expired, consumed, same-password, or rate-limited recovery requests  
**When** the API rejects the operation  
**Then** contracted error codes `AUTH-012` through `AUTH-015` and `Retry-After` semantics are returned without revealing account eligibility

---

## Supplemental Reference A: Frontend Auth Pages & Private Route

As a **user**,  
I want login/register pages with proper route protection and navigation,  
So that unauthenticated users cannot access protected sections of the app.

### Acceptance Criteria

**Given** user accesses `/login`  
**When** login page renders  
**Then** email and password fields displayed  
**And** on successful login, member info saved to `useAuthStore` (session cookie automatically managed by the browser) then redirect to `/`

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

**Given** `<PrivateRoute>` wrapping routes requiring authentication (`/`, `/orders`, etc.)  
**When** an unauthenticated user accesses  
**Then** redirect to `/login` (optionally saving returnTo)

**Given** `<NavBar>` renders (authenticated user)  
**When** displayed  
**Then** contains email, account list link, order history link, logout button  
**And** on logout click, `POST /api/v1/auth/logout` called then `useAuthStore` member reset to null

---

## Supplemental Reference B: TOTP Enrollment (Google Authenticator)

As an **authenticated user**,  
I want to register my Google Authenticator app to my account,  
So that I can use TOTP-based step-up authentication when initiating orders.

**Depends On:** Story 1.2 (Spring Session authentication), Story 1.6 (password verification pattern)

### Acceptance Criteria

**Given** `POST /api/v1/members/me/totp/enroll` (valid authenticated session, `member.totp_enabled = false`)  
**When** enrollment initiation request  
**Then** `TotpOtpService.generateSecret()` generates a Base32 encoded secret (`com.warrenstrange:googleauth:1.5.0` library)  
**And** Secret stored at Vault path `secret/fix/member/{memberUuid}/totp-secret` (FR-TOTP-04; DB storage prohibited)  
**And** `member.totp_enabled = false` maintained (before confirmEnrollment)  
**And** HTTP 200: `{ qrUri: "otpauth://totp/FIX:{email}?secret={base32Secret}&issuer=FIX", expiresAt }` with the secret included only once in this response

**Given** `POST /api/v1/members/me/totp/confirm` with `{ totpCode: "123456" }`  
**When** user submits first code after registering QR in Google Authenticator app  
**Then** `TotpOtpService.confirmEnrollment(memberUuid, totpCode)` executes  
**And** Vault retrieves the memberUuid secret and performs RFC 6238 TOTP verification (plus/minus 1 window allowed)  
**And** verification success updates `member.totp_enabled = true` and `member.totp_enrolled_at = NOW()`  
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
**Then** Vault TOTP secret for the memberUuid is deleted  
**And** `member.totp_enabled = false`, `member.totp_enrolled_at = null` reset  
**And** HTTP 204 returned

**DB Flyway migration (`V?__add_totp_fields_to_member.sql`):**
```sql
ALTER TABLE member ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE member ADD COLUMN totp_enrolled_at TIMESTAMP NULL;
```

**Given** `ChannelIntegrationTestBase` (Testcontainers MySQL + WireMock Vault)  
**When** TOTP Enrollment flow integration test runs  
**Then** enroll returns a QR URI, confirm succeeds, and `totp_enabled=true` is verified  
**And** confirm attempted with incorrect code verifies HTTP 401 `AUTH-010`  
**And** DELETE totp confirms `totp_enabled=false`

---

## Supplemental Reference C: Frontend SSE Session Expiry & Error UX

As a **logged-in user**,  
I want to receive advance warning before my session expires and for session errors to be clearly communicated,  
So that I can extend my session or be gracefully redirected to login.

**Depends On:** Supplemental Reference B, Supplemental Reference A, Story 1.3

### Acceptance Criteria

**Given** SSE `session-expiry { remainingSeconds: 300 }` event received  
**When** client EventSource listener executes  
**Then** Toast "You will be automatically logged out in 5 minutes. Would you like to continue?" displayed  
**And** clicking "Keep session" calls `GET /api/v1/auth/session`, resetting session TTL to 30 minutes

**Given** HTTP 401 response received (session expired)  
**When** Axios response interceptor executes (less than 10 lines)  
**Then** if `SESSION_EXPIRED_BY_NEW_LOGIN` code: "Your session has been terminated because you logged in from another device." toast  
**And** for other 401s: "Your session has expired. Please log in again." toast displayed once  
**And** redirect to `/login` (prevent infinite loop)

**Given** SSE EventSource connection dropped  
**When** 3 reconnection attempts (backoff 5s, 10s, 30s) all fail  
**Then** client self-timer (25 minutes after last activity) warning displayed

**Given** Playwright (or Cypress) E2E test environment configured  
**When** login, account list, and logout flow are executed  
**Then** structure ready to confirm normal response at each step  
**Note:** Actual E2E scenario implementation completed in Epic 8
