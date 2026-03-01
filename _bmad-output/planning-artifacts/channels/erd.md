# Channel System ERD (Epic 0~8 Consolidated)

This ERD is derived from all epics (0 through 8) and applies two design rules:
1. Every core table has both numeric `PK` and business `UUID`.
2. Stateful behavior is controlled by explicit `status` columns, not inferred only from timestamps.

> **v1.1 Changes**: Added `REFRESH_TOKENS` and `OTP_VERIFICATIONS` tables.
> Fixed amount/balance types to `DECIMAL(19,4)` (consistent with `core_db`).
> Added `last_fail_at` to `MEMBERS`. Updated `COREBANK_ACCOUNTS` to reflect actual `core_db.accounts` schema.

```mermaid
erDiagram
    MEMBERS {
        BIGINT id PK
        CHAR36 member_uuid UK
        VARCHAR50 username UK
        VARCHAR100 email UK
        VARCHAR255 password_hash
        VARCHAR100 name
        VARCHAR20 role "ROLE_USER|ROLE_ADMIN"
        VARCHAR20 status "ACTIVE|LOCKED"
        INT login_fail_count
        DATETIME last_fail_at
        DATETIME locked_at
        BOOLEAN totp_enabled
        DATETIME totp_enrolled_at
        DATETIME created_at
        DATETIME updated_at
        DATETIME deleted_at
    }

    REFRESH_TOKENS {
        BIGINT id PK
        CHAR36 token_uuid UK
        BIGINT member_id FK
        CHAR64 token_hash UK
        VARCHAR255 device_info
        VARCHAR45 ip_address
        DATETIME expires_at
        DATETIME revoked_at
        DATETIME created_at
    }

    OTP_VERIFICATIONS {
        BIGINT id PK
        CHAR36 otp_uuid UK
        BIGINT order_session_id FK_UK
        BIGINT member_id FK
        INT attempt_count
        INT max_attempts
        VARCHAR20 status "PENDING|VERIFIED|EXHAUSTED|EXPIRED"
        DATETIME expires_at
        DATETIME verified_at
        DATETIME created_at
        DATETIME updated_at
    }

    ORDER_SESSIONS {
        BIGINT id PK
        CHAR36 session_uuid UK
        BIGINT member_id FK
        CHAR36 correlation_uuid
        VARCHAR64 client_request_id UK "idempotency key - FIX Tag 11 ClOrdID source"
        VARCHAR20 status "PENDING_NEW|AUTHED|EXECUTING|COMPLETED|FAILED|EXPIRED"
        BIGINT from_account_id "logical FK -> COREBANK_ACCOUNTS.id"
        VARCHAR14 from_account_number "nullable - snapshot for history N+1 prevention"
        VARCHAR20 symbol "FIX Tag 55 - e.g. 005930"
        VARCHAR10 side "FIX Tag 54 - BUY|SELL"
        VARCHAR10 ord_type "FIX Tag 40 - LIMIT|MARKET"
        BIGINT order_qty "FIX Tag 38"
        DECIMAL194 price "FIX Tag 44 - nullable for MARKET orders"
        VARCHAR64 cl_ord_id "FIX Tag 11 assigned by FEP"
        CHAR36 ledger_uuid
        VARCHAR50 fep_reference_id "FIX Tag 37 OrderID"
        VARCHAR50 failure_reason_code
        DECIMAL194 post_execution_balance
        DATETIME executing_started_at "nullable - EXECUTING entry time for timeout"
        DATETIME expires_at
        DATETIME completed_at
        DATETIME created_at
        DATETIME updated_at
    }

    NOTIFICATIONS {
        BIGINT id PK
        CHAR36 notification_uuid UK
        BIGINT member_id FK
        BIGINT order_session_id FK
        VARCHAR50 type "ORDER_FILLED|ORDER_REJECTED|ORDER_CANCELLED|SESSION_EXPIRY|SECURITY_ALERT|ACCOUNT_LOCKED|POSITION_UPDATED"
        VARCHAR20 status "UNREAD|READ|EXPIRED"
        VARCHAR100 title
        TEXT message
        DATETIME read_at
        DATETIME expires_at
        DATETIME created_at
        DATETIME updated_at
        DATETIME deleted_at
    }

    AUDIT_LOGS {
        BIGINT id PK
        CHAR36 audit_uuid UK
        BIGINT member_id FK
        BIGINT order_session_id FK
        VARCHAR50 action "LOGIN_SUCCESS|LOGIN_FAILURE|LOGOUT|OTP_VERIFIED|ACCOUNT_LOCKED|ACCOUNT_UNLOCKED|TOTP_ENROLLED|PASSWORD_CHANGED|ORDER_SUBMITTED|ORDER_EXECUTED|ORDER_FAILED|ORDER_COMPENSATED|ORDER_FILLED|ORDER_REJECTED|ORDER_CANCELLED"
        VARCHAR50 target_type
        VARCHAR100 target_id
        VARCHAR45 ip_address
        TEXT user_agent
        CHAR36 correlation_uuid
        DATETIME created_at
    }

    SECURITY_EVENTS {
        BIGINT id PK
        CHAR36 security_event_uuid UK
        BIGINT member_id FK
        BIGINT admin_member_id FK
        BIGINT order_session_id FK
        VARCHAR50 event_type "ACCOUNT_LOCKED|OTP_MAX_ATTEMPTS|FORCED_LOGOUT|ACCOUNT_UNLOCKED|RATE_LIMIT_LOGIN|RATE_LIMIT_OTP|RATE_LIMIT_ORDER"
        VARCHAR20 status "OPEN|ACKNOWLEDGED|RESOLVED"
        VARCHAR10 severity "LOW|MEDIUM|HIGH|CRITICAL"
        TEXT detail
        VARCHAR45 ip_address
        CHAR36 correlation_uuid
        DATETIME occurred_at
        DATETIME resolved_at
        DATETIME created_at
        DATETIME updated_at
    }

    COREBANK_ACCOUNTS {
        BIGINT id PK
        CHAR36 public_id UK
        BIGINT member_id "logical ref to channel members"
        VARCHAR14 account_number UK
        VARCHAR16 exchange_code
        VARCHAR20 status "ACTIVE|FROZEN|CLOSED"
        DATETIME closed_at
        CHAR3 currency_code
        DECIMAL194 balance
        DECIMAL194 daily_limit
        VARCHAR10 balance_update_mode "EAGER|DEFERRED"
        BIGINT last_synced_ledger_ref
        DATETIME created_at
        DATETIME updated_at
    }

    MEMBERS ||--o{ REFRESH_TOKENS : issues
    MEMBERS ||--o{ OTP_VERIFICATIONS : attempts
    MEMBERS ||--o{ ORDER_SESSIONS : initiates
    MEMBERS ||--o{ NOTIFICATIONS : receives
    MEMBERS ||--o{ AUDIT_LOGS : acts
    MEMBERS ||--o{ SECURITY_EVENTS : triggers
    MEMBERS ||--o{ SECURITY_EVENTS : administers

    ORDER_SESSIONS ||--|| OTP_VERIFICATIONS : requires
    ORDER_SESSIONS ||--o{ NOTIFICATIONS : emits
    ORDER_SESSIONS ||--o{ AUDIT_LOGS : traced_by
    ORDER_SESSIONS ||--o{ SECURITY_EVENTS : escalates

    COREBANK_ACCOUNTS ||--o{ ORDER_SESSIONS : source_account
```

> **⚠️ Cross-Schema Boundary — `COREBANK_ACCOUNTS`**: This entity belongs to `core_db` (계정계), **not** `channel_db`. It is rendered in this diagram for cross-service reference clarity only. The channel layer has **no direct DB access** to this table — all reads and writes go through the CoreBanking service API. Relationship lines to `ORDER_SESSIONS` represent **logical FKs**, not physical DB foreign keys.

## Status-driven lifecycle rules

- `MEMBERS.status`
  - `ACTIVE -> LOCKED` when login failure threshold is exceeded.
  - `LOCKED -> ACTIVE` only by admin unlock flow (resets `login_fail_count`).

- `OTP_VERIFICATIONS.status`
  - `PENDING -> VERIFIED` on correct code input.
  - `PENDING -> EXHAUSTED` when `attempt_count >= max_attempts`.
  - `PENDING -> EXPIRED` when `expires_at < NOW()`.

- `ORDER_SESSIONS.status` *(FIX 4.2 주문 세션 — FindingR4-R9)*
  - `PENDING_NEW -> AUTHED -> EXECUTING -> COMPLETED|FAILED|EXPIRED`.
  - `PENDING_NEW|AUTHED -> EXPIRED` by session expiry batch when `expires_at < NOW()`.
  - `EXECUTING -> FAILED` by explicit core failure response or timeout when `executing_started_at < NOW()-30s`.
  - Transition authority is service logic; timestamps are audit evidence, not primary state.

- `NOTIFICATIONS.status`
  - `UNREAD -> READ` by user action.
  - `UNREAD|READ -> EXPIRED` by retention policy.

- `SECURITY_EVENTS.status`
  - `OPEN -> ACKNOWLEDGED -> RESOLVED` for security operation workflow.
  - `OPEN -> RESOLVED` allowed for direct admin close.

## Constraint summary

- Every table uses:
  - `id` (BIGINT UNSIGNED PK, internal join/performance)
  - `*_uuid` or `*_hash` (CHAR(36)/CHAR(64) UK, external API reference/idempotency-safe exposure)
- Cross-schema references (`ORDER_SESSIONS` → `COREBANK_ACCOUNTS`) are logical FKs by service boundary.
- TOTP secret is not stored in DB (Vault-managed); DB keeps only enrollment state (`totp_enabled`, `totp_enrolled_at`).
- OTP code values are not stored in DB — validated in-memory (Redis/cache) only.
- `REFRESH_TOKENS.token_hash` stores SHA-256 hash only; raw token value never persisted.
- Amount/balance fields use `DECIMAL(19,4)` consistent with `core_db`.
- `DATETIME(6)` used consistently for microsecond precision.
- Soft delete (`deleted_at`) is applied selectively:
  - Applied: `MEMBERS`, `NOTIFICATIONS`
  - Not applied (immutable/forensic record): `ORDER_SESSIONS`, `AUDIT_LOGS`, `SECURITY_EVENTS`
  - Lifecycle by status column: `REFRESH_TOKENS` (revoked_at), `OTP_VERIFICATIONS` (status)
  - Snapshot fields in `ORDER_SESSIONS`:
    - `from_account_number`, `symbol` — captured at request time to avoid cross-schema N+1 in history queries.
  - Soft delete means `deleted_at IS NOT NULL`.
  - Default read query must include `deleted_at IS NULL`.
  - Physical delete is allowed only by explicit retention/archival job.
- `MEMBERS`
  - Soft deleted member cannot authenticate and is excluded from normal member queries.
  - Existing order/audit/security history remains preserved by design.
- `NOTIFICATIONS`
  - User-side hide/delete action can set `deleted_at`; history retained for ops retention window.

## Table-by-table details

### 1) `MEMBERS`

- Purpose
  - Identity/authentication anchor for channel users and admins.
  - Owns account-level security state (lockout, TOTP enrollment flag).
- PK + UUID usage
  - `id`: internal joins and index efficiency.
  - `member_uuid`: external-safe identifier for APIs/log correlation.
- Important columns
  - `role`: authorization boundary (`ROLE_USER`, `ROLE_ADMIN`).
  - `status`: account lifecycle state (`ACTIVE`, `LOCKED`).
  - `login_fail_count`, `locked_at`: lockout control source of truth.
  - `totp_enabled`, `totp_enrolled_at`: step-up auth enrollment state only (secret is in Vault).
  - `deleted_at`: member soft delete marker.
- Status policy
  - `ACTIVE -> LOCKED`: failed login threshold exceeded.
  - `LOCKED -> ACTIVE`: admin unlock action only.
- Integrity/security rules
  - `username`, `email` unique.
  - `password_hash` only (no plaintext), never exposed in response/log.
  - Soft deleted rows are filtered by `deleted_at IS NULL` in normal auth/user flows.

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT | PK | NO | Internal index/join key |
| `member_uuid` | UUID | UK | NO | Public reference and API key |
| `username` | VARCHAR(50) | UK | NO | User login ID |
| `email` | VARCHAR(100) | UK | NO | User contact and recovery email |
| `password_hash` | VARCHAR(255) | | NO | Bcrypt/Argon2 hash of password |
| `name` | VARCHAR(100) | | NO | Member full name |
| `role` | VARCHAR(20) | | NO | `ROLE_USER` or `ROLE_ADMIN` |
| `status` | VARCHAR(20) | | NO | `ACTIVE`, `LOCKED` |
| `login_fail_count` | INT UNSIGNED | | NO | Consecutive failures (Lazy reset logic applied) |
| `last_fail_at` | DATETIME(6) | | YES | Timestamp of last failed login attempt |
| `locked_at` | DATETIME(6) | | YES | Timestamp when account was locked |
| `totp_enabled` | BOOLEAN | | NO | Whether 2FA is active (Default: false) |
| `totp_enrolled_at` | DATETIME(6) | | YES | Timestamp of TOTP activation |
| `created_at` | DATETIME(6) | | NO | Record creation time |
| `updated_at` | DATETIME(6) | | NO | Last update time |
| `deleted_at` | DATETIME(6) | | YES | Soft delete timestamp (NULL if active) |

### 2) `REFRESH_TOKENS`

- Purpose
  - Persists JWT Refresh Token lifecycle in DB to enforce Token Rotation and forced revocation.
  - Supports multi-device session management and full-session invalidation on lock/logout.
- PK + UUID usage
  - `id`: fast sequential lookup.
  - `token_uuid`: stable external token reference for logs and audit.
- Important columns
  - `token_hash`: SHA-256 hash only — original token is never stored.
  - `revoked_at`: explicit invalidation marker; NULL means active.
  - `expires_at`: primary validity window.
- Integrity rules
  - Valid token condition: `revoked_at IS NULL AND expires_at > NOW()`.
  - No soft delete: lifecycle managed by `revoked_at` and `expires_at` columns.

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT UNSIGNED | PK | NO | Internal index key |
| `token_uuid` | CHAR(36) | UK | NO | External token reference |
| `member_id` | BIGINT UNSIGNED | FK | NO | Token owner |
| `token_hash` | CHAR(64) | UK | NO | SHA-256 hash of raw token (no plaintext) |
| `device_info` | VARCHAR(255) | | YES | Device/browser context (optional) |
| `ip_address` | VARCHAR(45) | | YES | Issuing request IP |
| `expires_at` | DATETIME(6) | | NO | Expiration deadline |
| `revoked_at` | DATETIME(6) | | YES | Explicit revocation timestamp (logout/rotation) |
| `created_at` | DATETIME(6) | | NO | Token issuance time |

### 3) `OTP_VERIFICATIONS`

- Purpose
  - Tracks OTP attempt count and verification state per order session (1:1).
  - Ensures max-attempt enforcement and EXHAUSTED → Security Event escalation.
- PK + UUID usage
  - `id`: internal key.
  - `otp_uuid`: stable audit reference for a specific OTP event.
- Important columns
  - `order_session_id`: unique — one session has exactly one OTP record.
  - `attempt_count`: current tally against `max_attempts`.
  - `status`: verification state machine source of truth.
  - OTP code itself is NOT stored — validated in-memory (Redis/cache) only.
- Status policy
  - `PENDING → VERIFIED`: correct code entered.
  - `PENDING → EXHAUSTED`: `attempt_count >= max_attempts`.
  - `PENDING → EXPIRED`: `expires_at < NOW()`.
- Integrity rules
  - `UK(order_session_id)` ensures duplicate OTP issuance is impossible at DB level.

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT UNSIGNED | PK | NO | Internal key |
| `otp_uuid` | CHAR(36) | UK | NO | External OTP event reference |
| `order_session_id` | BIGINT UNSIGNED | UK + FK | NO | Parent order session (1:1) |
| `member_id` | BIGINT UNSIGNED | FK | NO | Attempting member |
| `attempt_count` | INT UNSIGNED | | NO | Current attempt tally |
| `max_attempts` | INT UNSIGNED | | NO | Policy ceiling (default 3) |
| `status` | VARCHAR(20) | | NO | `PENDING`, `VERIFIED`, `EXHAUSTED`, `EXPIRED` |
| `expires_at` | DATETIME(6) | | NO | OTP validity deadline |
| `verified_at` | DATETIME(6) | | YES | Successful verification timestamp |
| `created_at` | DATETIME(6) | | NO | Record creation |
| `updated_at` | DATETIME(6) | | NO | Last state change |

### 4) `ORDER_SESSIONS`

- Purpose
  - Main order workflow aggregate for the channel layer.
  - Represents FIX 4.2 order intent, OTP gate, execution, and final result.
- PK + UUID usage
  - `id`: relational joins and paging.
  - `session_uuid`: public order-session reference.
- Important columns
  - `status`: order state machine.
  - `client_request_id`: idempotency key (duplicate prevention) — source for FIX Tag 11 ClOrdID.
  - `from_account_id`: logical sender account ref (cross-schema).
  - `symbol`, `side`, `ord_type`, `order_qty`, `price`: FIX 4.2 order parameters.
  - `cl_ord_id`: FIX Tag 11 ClOrdID assigned by FEP after order submission.
  - `ledger_uuid`, `fep_reference_id`: completion and exchange traceability.
  - `failure_reason_code`: structured failure reason.
  - `post_execution_balance`: completed response replay without recalculation.
  - `expires_at`: session validity boundary.
- Status policy
  - `PENDING_NEW -> AUTHED -> EXECUTING -> COMPLETED|FAILED|EXPIRED`.
  - State transitions are explicit service operations, not timestamp inference.
- Integrity rules
  - `client_request_id` unique.
  - Must keep status/result fields consistent (e.g., `COMPLETED` requires `ledger_uuid`).
  - No soft delete: order execution history is treated as immutable financial evidence. (FindingR3-R9)

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT UNSIGNED | PK | NO | Internal index key |
| `session_uuid` | CHAR(36) | UK | NO | Public API reference |
| `member_id` | BIGINT UNSIGNED | FK | NO | References `MEMBERS.id` |
| `correlation_uuid` | CHAR(36) | | NO | Trace ID for observability |
| `client_request_id` | VARCHAR(64) | UK | NO | Idempotency key from client |
| `status` | VARCHAR(20) | | NO | `PENDING_NEW`, `AUTHED`, `EXECUTING`, `COMPLETED`, `FAILED`, `EXPIRED` |
| `from_account_id` | BIGINT UNSIGNED | | NO | Sender account (logical ref to core_db.accounts.id) |
| `from_account_number` | VARCHAR(14) | | YES | Sender account number snapshot at order time; avoids Core API re-query for history display |
| `symbol` | VARCHAR(20) | | NO | Stock symbol — FIX Tag 55 (e.g. 005930) |
| `side` | VARCHAR(10) | | NO | Order direction — FIX Tag 54: BUY or SELL |
| `ord_type` | VARCHAR(10) | | NO | Order type — FIX Tag 40: LIMIT or MARKET |
| `order_qty` | BIGINT UNSIGNED | | NO | Order quantity — FIX Tag 38 |
| `price` | DECIMAL(19,4) | | YES | Order price — FIX Tag 44; required for LIMIT, NULL for MARKET |
| `cl_ord_id` | VARCHAR(64) | | YES | FIX Tag 11 ClOrdID assigned by FEP after order submission |
| `ledger_uuid` | CHAR(36) | | YES | Ledger posting UUID (on success) |
| `fep_reference_id` | VARCHAR(50) | | YES | Exchange/FEP order reference — FIX Tag 37 OrderID |
| `failure_reason_code` | VARCHAR(50) | | YES | Standardized error code if FAILED |
| `post_execution_balance` | DECIMAL(19,4) | | YES | Sender balance snapshot for idempotent response replay |
| `executing_started_at` | DATETIME(6) | | YES | Timestamp when session entered EXECUTING state; independent timeout baseline (not overridden by other `updated_at` changes) |
| `expires_at` | DATETIME(6) | | NO | Session timeout deadline |
| `completed_at` | DATETIME(6) | | YES | When final state was reached |
| `created_at` | DATETIME(6) | | NO | Session start time |
| `updated_at` | DATETIME(6) | | NO | Last state change time |

### 5) `NOTIFICATIONS`

- Purpose
  - Durable notification store for SSE + reconnect fallback.
  - User-visible event history and read-state tracking.
- PK + UUID usage
  - `id`: fast pagination/order operations.
  - `notification_uuid`: external-safe event reference.
- Important columns
  - `type`: domain event classification (`ORDER_FILLED`, `ORDER_REJECTED`, `ORDER_CANCELLED`, `SESSION_EXPIRY`, `SECURITY_ALERT`, `ACCOUNT_LOCKED`, `POSITION_UPDATED`).
  - `status`: read lifecycle (`UNREAD`, `READ`, `EXPIRED`).
  - `order_session_id`: optional linkage to order session context.
  - `read_at`, `expires_at`: read/retention control points.
  - `deleted_at`: user/admin soft delete marker.
- Status policy
  - `UNREAD -> READ`: explicit user action.
  - `UNREAD|READ -> EXPIRED`: retention cleanup policy.
- Integrity rules
  - Notification persistence is primary; SSE delivery failure must not lose DB record.
  - Soft delete hides records in UI while avoiding immediate hard delete.

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT UNSIGNED | PK | NO | Internal index/join key |
| `notification_uuid` | CHAR(36) | UK | NO | Public reference ID |
| `member_id` | BIGINT UNSIGNED | FK | NO | Recipient member |
| `order_session_id` | BIGINT UNSIGNED | FK | YES | Associated order session if applicable |
| `type` | VARCHAR(50) | | NO | Event category identifier |
| `status` | VARCHAR(20) | | NO | `UNREAD`, `READ`, `EXPIRED` |
| `title` | VARCHAR(100) | | NO | Notification summary/headline |
| `message` | TEXT | | NO | Detailed notification body |
| `read_at` | DATETIME(6) | | YES | When user marked as read |
| `expires_at` | DATETIME(6) | | YES | Retention/display timeout |
| `created_at` | DATETIME(6) | | NO | When event occurred |
| `updated_at` | DATETIME(6) | | NO | Last state update |
| `deleted_at` | DATETIME(6) | | YES | Soft delete timestamp |

### 6) `AUDIT_LOGS`

- Purpose
  - Immutable audit trail of user/system actions for investigation and admin query.
- PK + UUID usage
  - `id`: efficient chronological paging.
  - `audit_uuid`: stable external log reference.
- Important columns
  - `action`: normalized action taxonomy (login/otp/order lifecycle).
  - `member_id`: actor identity.
  - `target_type`, `target_id`: target object linkage.
  - `correlation_uuid`: cross-service request chain.
  - `ip_address`, `user_agent`: forensic context.
- Operational policy
  - Append-only (no in-place business mutation).
  - Retention purge job removes old rows by policy window.
  - No soft delete: audit records are forensic evidence.

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT | PK | NO | Chronological key |
| `audit_uuid` | CHAR(36) | UK | NO | Compliance reference |
| `member_id` | BIGINT UNSIGNED | FK | YES | Actor (NULL if system action) |
| `order_session_id` | BIGINT UNSIGNED | FK | YES | Related order session |
| `action` | VARCHAR(50) | | NO | `LOGIN_SUCCESS`, `ORDER_SUBMITTED`, `ORDER_EXECUTED`, `ORDER_FILLED`, `ORDER_REJECTED`, `ORDER_CANCELLED`, etc. |
| `target_type` | VARCHAR(50) | | YES | Entity affected (e.g., `MEMBER`, `ORDER`) |
| `target_id` | VARCHAR(100) | | YES | ID of the target entity |
| `ip_address` | VARCHAR(45) | | YES | Client IP (IPv4/IPv6) |
| `user_agent` | TEXT | | YES | Client device/browser signature |
| `correlation_uuid` | CHAR(36) | | YES | Distributed trace ID |
| `created_at` | DATETIME(6) | | NO | Exact timestamp of occurrence |

### 7) `SECURITY_EVENTS`

- Purpose
  - Dedicated security-incident stream separated from general audit.
  - Supports incident workflow and privileged operation tracking.
- PK + UUID usage
  - `id`: operational query performance.
  - `security_event_uuid`: stable incident reference.
- Important columns
  - `event_type`: security signal category (lockout, OTP max attempts, force logout, rate limits, etc.).
  - `status`: response workflow (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`).
  - `severity`: triage priority.
  - `member_id`, `admin_member_id`: subject and privileged actor trace.
  - `occurred_at`, `resolved_at`: incident timeline markers.
- Status policy
  - `OPEN -> ACKNOWLEDGED -> RESOLVED` via security/admin operations.
- Integrity rules
  - Keep event details structured (`detail`) for incident reconstruction.
  - Retention policy longer than general audit where required.
  - No soft delete: security-event timeline must remain tamper-resistant.

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT | PK | NO | Internal index key |
| `security_event_uuid` | CHAR(36) | UK | NO | Incident workflow ID |
| `event_type` | VARCHAR(50) | | NO | `ACCOUNT_LOCKED`, `OTP_MAX_ATTEMPTS`, etc. |
| `status` | VARCHAR(20) | | NO | `OPEN`, `ACKNOWLEDGED`, `RESOLVED` |
| `severity` | VARCHAR(10) | | NO | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `member_id` | BIGINT UNSIGNED | FK | YES | Subject member (if applicable) |
| `admin_member_id` | BIGINT UNSIGNED | FK | YES | Admin who took action (if applicable) |
| `order_session_id` | BIGINT UNSIGNED | FK | YES | Related order session event (if applicable) |
| `detail` | TEXT | | YES | JSON or text dump of incident context |
| `ip_address` | VARCHAR(45) | | YES | Source IP of the event |
| `correlation_uuid` | CHAR(36) | | YES | Trace identifier |
| `occurred_at` | DATETIME(6) | | NO | Time of incident |
| `resolved_at` | DATETIME(6) | | YES | When status became RESOLVED |
| `created_at` | DATETIME(6) | | NO | Record ingestion time |
| `updated_at` | DATETIME(6) | | NO | Last update time |

### 8) `COREBANK_ACCOUNTS` (Referenced External Domain — core_db)

- Purpose
  - CoreBank-owned account table (`core_db.accounts`) referenced logically by channel order sessions.
  - Shown here for cross-schema clarity; channel does NOT own or directly mutate this table.
- PK + UUID usage
  - `id`: internal relational key in `core_db`.
  - `public_id`: external-safe account reference (matches `core_db.accounts.public_id`).
- Important columns
  - `balance`: DECIMAL(19,4) derived cache; channel reads via Core API, never writes directly.
  - `daily_limit`: per-account daily trading limit (validated in core_db via ledger SUM).
  - `status`: account availability (`ACTIVE`, `FROZEN`, `CLOSED`).
  - `balance_update_mode`: `EAGER` vs `DEFERRED` — Hot Account strategy flag.
- Integration policy
  - Channel layer calls Core API; account row locks and ledger writes happen inside `core_db`.
  - Cross-schema link is logical (service boundary), enforced by API/business checks, not DB FK.

#### Field Specifications

| Column Name | Type | Key | Nullable | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | BIGINT UNSIGNED | PK | NO | Core ledger internal ID |
| `public_id` | CHAR(36) | UK | NO | Public account identifier (external-safe UUID) |
| `member_id` | BIGINT UNSIGNED | | NO | Owner member (logical ref to channel `members.id`) |
| `account_number` | VARCHAR(14) | UK | NO | Unique account number (digits only, 10~14) |
| `exchange_code` | VARCHAR(16) | | NO | Exchange code (FIX Tag 207 SecurityExchange). e.g. KRX, KOSDAQ |
| `status` | VARCHAR(20) | | NO | `ACTIVE`, `FROZEN`, `CLOSED` |
| `closed_at` | DATETIME(6) | | YES | Account closure timestamp |
| `currency_code` | CHAR(3) | | NO | Currency (default `KRW`) |
| `balance` | DECIMAL(19,4) | | NO | Derived balance cache (CHECK >= 0) |
| `daily_limit` | DECIMAL(19,4) | | NO | Max daily sell order value cap (CHECK > 0) |
| `balance_update_mode` | VARCHAR(10) | | NO | `EAGER` or `DEFERRED` (Hot Account strategy) |
| `last_synced_ledger_ref` | BIGINT UNSIGNED | | YES | DEFERRED mode watermark for Read-Repair |
| `created_at` | DATETIME(6) | | NO | Account creation date |
| `updated_at` | DATETIME(6) | | NO | Last balance/status change |