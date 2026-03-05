# Story 1.7: BE Password Forgot/Reset API

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a locked-out user,
I want a secure password forgot/reset API,
so that I can recover account access without admin intervention.

## Acceptance Criteria

1. Given `POST /api/v1/auth/password/forgot` with `username`, when request is processed, then API always returns the same `202 Accepted` response envelope and fixed body contract regardless of account existence or account status.
2. Given forgot request processing (including challenge-required branches), when synchronous API work completes, then response-time side-channel is bounded by policy: minimum response floor 400ms, jitter 0~50ms, and p95 latency delta between existent/non-existent/challenge branches <= 80ms in controlled integration benchmark.
3. Given a reset request is eligible (ACTIVE or AUTH-002 lock state), when token is issued, then only one active reset token per member is allowed and any previous active token is invalidated atomically.
4. Given token persistence schema, when DB migration is applied, then one-active-token invariant is enforced at DB level with `active_slot` domain constraint (`active_slot IS NULL OR active_slot = 1`) and unique key `(member_uuid, active_slot)` where active row uses `active_slot=1` and terminal rows set `NULL`.
5. Given token issuance, when persistence occurs, then only `HMAC-SHA-256(token, reset_token_pepper)` is stored (no raw token persistence), token entropy is >= 256 bits, and fixed TTL is 15 minutes.
6. Given member is WITHDRAWN/DEACTIVATED/ADMIN_SUSPENDED/POLICY_LOCKED or username does not exist, when forgot request is called, then API still returns same `202` response but no reset token and no outbound email is sent.
7. Given `POST /api/v1/auth/password/reset` with `{ token, newPassword }`, when token is valid and unconsumed and unexpired, then password hash is updated with BCrypt and token is marked consumed in the same DB transaction.
8. Given successful reset, when account lock reason is credential-failure lock (`AUTH-002` path), then failed-attempt counters are reset and lock state transitions to ACTIVE; non-credential lock/suspension states remain unchanged.
9. Given successful reset, when Spring Session principal sessions exist, then all active sessions for member are invalidated after commit with retry policy, and if purge retries are exhausted, `password_changed_at` session-version guard rejects pre-reset sessions until purge succeeds.
10. Given reset API receives token-state failures or throttling conditions, when request is handled, then deterministic auth error mapping is strictly separated without revealing member identity: invalid/expired token -> `AUTH-012 (401)`, already-consumed token -> `AUTH-013 (409)`, rate-limit exceeded -> `AUTH-014 (429)` (+`Retry-After`).
11. Given non-GET auth security policy, when forgot/challenge/reset endpoints are called, then CSRF token is required (no CSRF exemption) and clients bootstrap via `GET /api/v1/auth/csrf` before submit.
12. Given CSRF bootstrap failure (`403`) on forgot/challenge/reset submit, when client receives forbidden response, then client re-fetches CSRF once and retries submit once using same payload; second failure is surfaced as terminal error UX.
13. Given abuse patterns, when thresholds are exceeded, then deterministic rate limits are enforced with explicit windows: forgot (`per-IP: 5/min`, `per-username: 3/15min`, `mail-cooldown-key(usernameHash): 1/5min`), forgot-challenge (`per-IP: 5/min`, `per-username: 3/10min`, `endpoint-global: 60/min`), reset (`per-IP: 10/5min`, `per-tokenHash: 5/15min`, `endpoint-global: 60/min`).
14. Given email transport failure, when async sender fails, then bounded retry/backoff + DLQ policy is applied, idempotency key dedupe prevents duplicate sends per token, security event is recorded, and API sync response remains generic `202`.
15. Given canonical error taxonomy and FE/MOB mapping, when new reset errors are introduced, then channel-service API spec + canonical error table are updated in same change set and linked FE/MOB follow-up artifacts are created before story is marked Done.
16. Given reset link generation, when URL is created, then origin is selected from explicit allowlist, route path is fixed (`/reset-password`), and allowed query parameters are exactly `token` (all others rejected).
17. Given token lifecycle operations, when system runs, then expired/consumed token cleanup job executes every 15 minutes, processes `500` rows per batch with bounded multi-batch catch-up, uses indexed predicates, and retains terminal token rows for 30 days for audit before purge.
18. Given successful reset and delayed session purge, when authenticated request arrives, then auth filter compares `sessionIssuedAt` with `password_changed_at` and rejects stale sessions with deterministic auth error `AUTH-016 (401)` until purge completion.
19. Given observability and compliance rules, when flow executes, then raw password/raw token are never logged and auditable security events are persisted with correlation id.
20. Given username input for forgot/rate-limit keys, when request is handled, then username is normalized (`trim` + lowercase + Unicode NFKC) before lookup and bucket-key calculation to prevent normalization bypass.
21. Given password reset request, when `newPassword` equals current password hash match, then reset is rejected with deterministic validation error (`AUTH-015`, `422`).
22. Given reset token generation, when token is created, then token format is URL-safe Base64 without padding from 32 random bytes (43 chars), server always derives candidate hashes for all allowed pepper versions (active + previous), resolves token row via fixed-shape indexed lookup (`token_hash IN (:activeHash,:previousHash)`), and executes constant-time verification in fixed order without early-exit.
23. Given token expiry check, when server validates token, then ±60s clock-skew tolerance is applied consistently across issue/validate paths.
24. Given pepper key rotation, when token hash is verified, then active + previous pepper key versions are supported during rotation window and token row stores `pepper_version`.
25. Given audit event persistence, when forgot/reset lifecycle events are recorded, then minimum schema is enforced: `{eventType, memberUuid|null, usernameHash, outcome, reasonCode|null, traceId, ipHash, userAgentHash, hashKeyVersion, occurredAt}`.
26. Given successful reset transaction, when password hash is updated, then `password_changed_at` is updated in the same DB transaction as password-hash update and token consume.
27. Given forgot/reset concurrency, when issuing and invalidating tokens, then lock order is fixed across both flows as `member FOR UPDATE -> active token FOR UPDATE` to prevent deadlocks.
28. Given username-targeted distributed abuse (distinct-IP cardinality >= 20 within 10 minutes on same normalized username hash), when threshold is exceeded, then reset-mail send requires challenge proof and non-proved requests keep generic `202` without mail side effects.
29. Given cleanup backlog exceeds one batch, when scheduler runs every 15 minutes, then bounded catch-up loop is applied (no unbounded while-loop), run-level limits are enforced, and backlog threshold breach emits alert metric.
30. Given dependency baselines, when implementing this story, then versions are resolved from repository BOM/parent build and direct version pinning of Spring Security or Spring Mail artifacts is not introduced by this story.
31. Given distributed-abuse challenge mode, when forgot is called for challenged username hash, then challenge contract is deterministic: request carries required `challengeToken` + `challengeAnswer` for challenged buckets (optional otherwise), token is server-issued signed blob with TTL 5 minutes and single-use nonce, and verification failure/expiry/missing-challenge still returns same generic `202` body with no mail side effect.
32. Given stale-session fail-safe and audit hashing operations, when key rotation occurs, then dual-read window is supported for previous key version for 30 days and runbook defines cutover/retirement without breaking historical event lookup.
33. Given `POST /api/v1/auth/password/forgot/challenge`, when request is processed, then endpoint returns fixed `200` response contract with anti-enumeration parity (same body/timing envelope regardless of account existence/status) and never discloses account eligibility.
34. Given Spring Security configuration is finalized, when CSRF ignore list is evaluated, then forgot/challenge/reset endpoints are not included in any CSRF-exempt matcher and CI security test fails if matcher drift occurs.
35. Given challenge token includes usernameHash binding, when submitted `username` does not match token binding or token is invalid/expired/replayed, then forgot API still returns same generic `202` body, records security event, and performs no token/email side effects.
36. Given cleanup backlog controls, when scheduler operates, then defaults are fixed as `batchSize=500`, `maxBatchesPerRun=8`, `maxRunSeconds=20`, and `backlogAlertThresholdRows=10000`, and batches are processed oldest-first by `expires_at`.
37. Given member password version guard, when migration is applied, then `channel_db.members` table adds `password_changed_at DATETIME(3) NOT NULL`, backfills existing rows from `updated_at` (fallback `created_at`), and creates index on `(member_uuid, password_changed_at)`.
38. Given emergency dependency CVE override path, when temporary direct pin is introduced, then it requires Security Lead + BE Lead approval record, expiry <= 14 days, rollback issue link, and CI fails builds with expired override metadata.
39. Given audit forensics beyond active rotation windows, when historical event verification is required after dual-read window, then retired audit-hash keys remain KMS-wrapped and read-restricted for full audit-retention period and are not used for new writes.
40. Given challenge token single-use policy, when challenge token is issued and verified, then nonce state is persisted in Redis with atomic consume semantics and replay attempts are deterministically rejected.
41. Given forgot API generic response contract, when request is accepted, then response always includes fixed recovery hint block `{ "challengeEndpoint": "/api/v1/auth/password/forgot/challenge", "challengeMayBeRequired": true }` regardless of account/challenge state.
42. Given CSRF retry path is executed, when client performs one-time retry after re-fetching CSRF, then request payload/idempotency fields are preserved exactly (no mutation) and second `403` is terminal UX error.
43. Given challenge abuse controls, when forgot-challenge endpoint is hit, then endpoint-global limit is enforced (`endpoint-global: 60/min`) in addition to per-IP/per-username limits.
44. Given distributed abuse threshold tuning, when challenge gate decision is made, then adaptive thresholding is applied using baseline traffic profile (minimum floor remains 20 distinct IP / 10min) and automatic cooldown release occurs when abuse signal decays.
45. Given reset token verification path, when valid/invalid/expired/consumed token is processed, then verification branch timing is equalized by reset-validation floor 120ms with jitter 0~20ms before deterministic error mapping.

## Tasks / Subtasks

- [ ] Define API contracts and DTOs (AC: 1, 6, 9, 10, 15, 18, 31, 33, 34, 35, 41, 42)
  - [ ] Add `POST /api/v1/auth/password/forgot` request/response contract
  - [ ] Add `POST /api/v1/auth/password/reset` request/response contract
  - [ ] Extend forgot request contract for challenge mode: `{ username, challengeToken?, challengeAnswer? }`
  - [ ] Define challenge bootstrap contract (e.g., `POST /api/v1/auth/password/forgot/challenge`) with response `{ challengeToken, challengeType, challengeTtlSeconds }`
  - [ ] Fix challenge bootstrap response contract parity and body shape independent of account existence/status
  - [ ] Keep response envelope and error-shape aligned with existing auth API conventions
  - [ ] Include fixed forgot recovery hint block in all `202` responses: `{ challengeEndpoint, challengeMayBeRequired }`
  - [ ] Update API docs/spec for CSRF-required semantics on these endpoints

- [ ] Implement forgot flow with anti-enumeration and equalized latency (AC: 1, 2, 6, 27, 28, 31, 35, 41)
  - [ ] Always return same `202` body for all username/account outcomes
  - [ ] Apply minimum processing time floor (400ms) and bounded jitter (0~50ms) for normal + challenge-required branches
  - [ ] Shift account-specific side effects (token/email) to async pipeline
  - [ ] Apply same lock order used by reset flow (`member FOR UPDATE -> active token FOR UPDATE`) for token invalidation/issue path
  - [ ] Add distributed-abuse guard: high distinct-IP attempts per normalized username hash require challenge proof before mail send
  - [ ] Define challenge proof validation rules (issuer, signature algorithm, TTL=5m, single-use nonce, replay denylist)
  - [ ] Enforce username-binding validation between submitted username and challenge token hash binding
  - [ ] Enforce generic response body contract:
    - [ ] `{ \"success\": true, \"data\": { \"accepted\": true, \"message\": \"If the account is eligible, a reset email will be sent.\", \"recovery\": { \"challengeEndpoint\": \"/api/v1/auth/password/forgot/challenge\", \"challengeMayBeRequired\": true } }, \"error\": null, \"traceId\": \"...\" }`

- [ ] Implement challenge bootstrap endpoint with anti-enumeration parity (AC: 33, 34, 40, 43)
  - [ ] Add `POST /api/v1/auth/password/forgot/challenge` controller/service path
  - [ ] Require CSRF and keep response contract fixed for all account outcomes
  - [ ] Apply same timing envelope policy used by forgot API
  - [ ] Issue signed challenge token with nonce + usernameHash binding + ttlSeconds=300
  - [ ] Enforce challenge endpoint rate limits (`per-IP: 5/min`, `per-username: 3/10min`, `endpoint-global: 60/min`)
  - [ ] Persist and atomically consume challenge nonce in Redis for single-use guarantee

- [ ] Implement single active token policy in DB (AC: 3, 4, 5, 17, 27)
  - [ ] Add `password_reset_tokens` table in `channel_db` (authoritative store)
  - [ ] Persist only token hash (`HMAC-SHA-256` with server-side pepper), never raw token; enforce entropy >= 256 bits
  - [ ] Add DB guard for one active token/member (`active_slot` + unique `(member_uuid, active_slot)`)
  - [ ] Add DB domain/check constraint: `active_slot IS NULL OR active_slot = 1`
  - [ ] Invalidate prior active token before issuing new token (same transaction, member row lock order fixed)
  - [ ] Enforce TTL=15m and consumed-state fields
  - [ ] Add scheduled purge policy (every 15m, `batchSize=500`, `maxBatchesPerRun=8`, `maxRunSeconds=20`, keep terminal rows 30 days, alert above `10000` rows)

- [ ] Implement reset flow with transactional correctness (AC: 7, 8, 10, 18, 26, 27)
  - [ ] Resolve token by hash with `FOR UPDATE` and validate expiry/consumed state
  - [ ] Update password hash, `password_changed_at`, and token consumed state in one DB transaction
  - [ ] Clear auth-failure lock/counters only for `AUTH-002` lock reason
  - [ ] Keep non-credential lock/suspension/deactivated states unchanged
  - [ ] Lock order for concurrency safety: `member FOR UPDATE` -> `active token FOR UPDATE` -> update password+token+passwordChangedAt

- [ ] Implement token verification constant-time multi-version path (AC: 22, 24, 45)
  - [ ] Always derive active+previous pepper candidate hashes in fixed order
  - [ ] Resolve token row using indexed `IN` lookup over both candidates
  - [ ] Perform fixed-order constant-time comparison across candidate set without early-exit
  - [ ] Ensure metrics/logs do not expose which pepper version matched
  - [ ] Apply reset-validation timing floor (`120ms`, jitter `0~20ms`) for valid/invalid/expired/consumed outcomes

- [ ] Invalidate all sessions after successful reset (AC: 9, 18, 26)
  - [ ] Purge member sessions via Spring Session principal index/session registry after commit
  - [ ] Add bounded retries and alert path if invalidation retries are exhausted
  - [ ] Enforce `password_changed_at` session-version guard in authentication filter for all protected endpoints until purge complete (`AUTH-016`, `401`)

- [ ] Implement abuse controls and async mail resilience (AC: 13, 14, 19, 28, 35, 43, 44)
  - [ ] Configure forgot limits: per-IP and per-username windows
  - [ ] Configure forgot-challenge limits: per-IP, per-username, endpoint-global windows
  - [ ] Configure reset limits: per-IP, per-tokenHash, endpoint-global windows
  - [ ] Implement async email retry/backoff and DLQ routing
  - [ ] Add send dedupe key (`password-reset:{memberUuid}:{tokenHash}`) to prevent duplicate mail on retries
  - [ ] Add mail cooldown guard (`1 email / 5 min`) keyed by normalized username hash for all requests (existence-agnostic)
  - [ ] Ensure cooldown guard does not become permanent denial: require challenge proof path for high-cardinality distributed abuse scenario
  - [ ] Use explicit challenge activation threshold floor: distinct IPs >= 20 within 10 minutes per normalized username hash
  - [ ] Add adaptive thresholding and cooldown-release policy based on baseline traffic profile
  - [ ] Persist security events for request accepted, token issued, reset success/failure, mail failure
  - [ ] Persist security events for challenge validation mismatch/expiry/replay outcomes
  - [ ] Ensure logging redaction for password/token and query/body/header sanitization

- [ ] Harden reset URL generation (AC: 16, 19)
  - [ ] Build reset link from configured allowlisted frontend base URL only
  - [ ] Ignore request `Host`/`X-Forwarded-*` for reset URL origin selection
  - [ ] Fix route to `/reset-password` and allow only `token` query parameter (reject all other query/redirect params)
  - [ ] Enforce token query parser policy: URL-decoding strict mode, max length 128 chars, charset base64url-only, invalid format treated as `AUTH-012`

- [ ] Update canonical taxonomy and client mappings (AC: 10, 15, 18)
  - [ ] Register new auth error codes in canonical API error table
  - [ ] Register fixed HTTP mappings (`AUTH-012:401`, `AUTH-013:409`, `AUTH-014:429`, `AUTH-016:401`)
  - [ ] Synchronize FE/MOB auth error mapping contract (Story 1.6 continuity) via linked follow-up artifacts
  - [ ] Include acceptance evidence that BE canonical docs are updated in same PR and FE/MOB follow-up links exist

- [ ] Specify audit pseudonymization and key lifecycle (AC: 25)
  - [ ] Use keyed hash (HMAC-SHA-256) for `usernameHash`, `ipHash`, `userAgentHash`
  - [ ] Store `hashKeyVersion` in audit payload and support key rotation runbook
  - [ ] Ensure hash key material is separate from reset-token pepper
  - [ ] Define dual-read key rotation window (30 days) for historical query compatibility

- [ ] Define cleanup backlog control and observability (AC: 17, 29, 36)
  - [ ] Implement bounded catch-up loop (`batchSize=500`, `maxBatchesPerRun=8`, `maxRunSeconds=20`) while scheduler cadence remains every 15 minutes
  - [ ] Emit backlog gauge/alert when retained terminal rows exceed `backlogAlertThresholdRows=10000`
  - [ ] Preserve 30-day retention while preventing unbounded growth during incident recovery

- [ ] Align dependency governance with repository baseline (AC: 30, 38)
  - [ ] Reuse versions from repository BOM/parent build (`BE/build.gradle`)
  - [ ] Default: do not add direct Spring Security/Mail version pins in this story implementation
  - [ ] Exception path: emergency CVE override is allowed only with security-approval record + expiry date + rollback issue link
  - [ ] Store override metadata at `BE/gradle/dependency-override-metadata.yml`
  - [ ] Add CI check to fail builds if override metadata is missing/expired

- [ ] Add member password version-column migration details (AC: 26, 37)
  - [ ] Create migration for `password_changed_at DATETIME(3) NOT NULL` on `channel_db.members`
  - [ ] Backfill from `updated_at` (fallback `created_at`) for existing rows
  - [ ] Add index `(member_uuid, password_changed_at)` for session-version checks

- [ ] Add tests (AC: 1-45)
  - [ ] Unit: token generation entropy, hashing, expiry, one-time consume
  - [ ] Integration: uniform `202` body for existent/non-existent/suspended users
  - [ ] Integration: timing envelope guard (floor 400ms, p95 delta <= 80ms under controlled test)
  - [ ] Integration: challenge bootstrap endpoint anti-enumeration parity and timing envelope (`existent/non-existent/challenged`)
  - [ ] Integration: concurrent forgot requests enforce single active token
  - [ ] Integration: invalid/expired/replayed token paths and deterministic codes
  - [ ] Integration: successful reset clears AUTH-002 lock and rotates password hash
  - [ ] Integration: session invalidation across multi-session member
  - [ ] Integration: fail-safe session-version guard blocks pre-reset sessions when purge is delayed (all protected endpoints)
  - [ ] Integration: `password_changed_at` updated atomically with password/token consume (single transaction assertion)
  - [ ] Integration: forgot/reset lock-order consistency under contention (deadlock regression)
  - [ ] Integration: CSRF required behavior on forgot/challenge/reset
  - [ ] Integration: CSRF `403` one-refetch/one-retry behavior on forgot/challenge/reset submit endpoints
  - [ ] Integration: CSRF retry preserves request payload/idempotency fields exactly
  - [ ] Integration: reset page CSRF bootstrap failure -> one re-fetch + one retry behavior
  - [ ] Integration: rate-limit `N-1/N/N+1` boundaries for all dimensions (forgot, forgot-challenge, reset) including challenge endpoint-global
  - [ ] Integration: reset URL origin pinned to allowlist + query allowlist (`token` only) + host-header poisoning negative test
  - [ ] Integration: invalid reset-link token query parsing (overlength/invalid charset/bad decode) maps to `AUTH-012`
  - [ ] Integration: mail retry + dedupe + DLQ behavior
  - [ ] Integration: member-level mail cooldown behavior
  - [ ] Integration: distributed username-targeted abuse enters challenge-required mail-send gate without breaking generic 202 API parity
  - [ ] Integration: adaptive challenge threshold and cooldown-release behavior under decaying abuse signal
  - [ ] Integration: challenge contract validity (signed token, TTL, single-use nonce, replay denial) and failure paths keep generic 202/no-mail
  - [ ] Integration: challenge username-binding mismatch always returns generic 202 and no token/email side effects
  - [ ] Integration: canonical error taxonomy + FE/MOB mapping sync checks
  - [ ] Integration: token cleanup schedule, index usage, retention behavior, and backlog catch-up bounded-loop controls
  - [ ] Integration: cleanup defaults enforcement (`maxBatchesPerRun=8`, `maxRunSeconds=20`, `backlogAlertThresholdRows=10000`)
  - [ ] Integration: username normalization parity (`USER01`, `user01`, unicode variants) for lookup + rate-limit key
  - [ ] Integration: `newPassword == currentPassword` rejection path (`AUTH-015`, `422`)
  - [ ] Unit: token format/length constraints (32 bytes -> 43 chars base64url no padding)
  - [ ] Unit: constant-time verification path coverage
  - [ ] Integration: reset token validation branch timing floor (`120ms`, jitter `0~20ms`) for valid/invalid/expired/consumed paths
  - [ ] Integration: clock skew tolerance boundary (`-60s`, `+60s`, `+61s`)
  - [ ] Integration: pepper rotation compatibility (`active` + `previous` key versions)
  - [ ] Integration: audit event payload schema completeness checks (including `hashKeyVersion`)
  - [ ] Integration: audit hash key rotation dual-read window compatibility
  - [ ] Integration: retired audit-hash key retrieval from KMS-wrapped store for long-retention forensic verification
  - [ ] CI: expired CVE override metadata causes build failure
  - [ ] Regression: no raw password/token in logs and audit events captured

## Dev Notes

### Developer Context Section

- Canonical epic currently lists Story 1.1~1.6 for Epic 1; this story extends Epic 1 with deferred password recovery scope.
- Existing planning note says password reset is out of MVP and previously admin-only unlock; this story introduces controlled self-service reset.
- This story MUST preserve existing Spring Session + CSRF + auth error contract behavior and integrate with Story 1.5/1.6 guardrails.

### Technical Requirements

- Endpoint contracts:
  - `POST /api/v1/auth/password/forgot`
    - Request: `{ "username": "user01", "challengeToken": "<optional>", "challengeAnswer": "<optional>" }` (`challengeToken/challengeAnswer` are required when challenge gate is active for that normalized username hash)
    - Response: `202 Accepted` generic body (identical across outcomes)
    - Response body contract (fixed):
      - `{ "success": true, "data": { "accepted": true, "message": "If the account is eligible, a reset email will be sent.", "recovery": { "challengeEndpoint": "/api/v1/auth/password/forgot/challenge", "challengeMayBeRequired": true } }, "error": null, "traceId": "<id>" }`
  - `POST /api/v1/auth/password/forgot/challenge`
    - Request: `{ "username": "user01" }`
    - Response: `200 OK`, `{ "challengeToken": "<signed blob>", "challengeType": "proof-of-work|captcha", "challengeTtlSeconds": 300 }`
    - `challengeToken` constraints: server-signed, contains nonce + issuedAt + expiresAt + usernameHash binding, single-use nonce
    - Nonce persistence/consume: Redis key `ch:pwdreset:challenge:nonce:{nonce}` with TTL 300s; issue path uses `SET key value NX EX 300`, verify path uses atomic consume script (get+del in one operation) to prevent replay
    - `challengeType` is deployment-configured and not selected by account existence/status
    - Anti-enumeration parity: fixed response body + timing envelope independent of account existence/status
  - `POST /api/v1/auth/password/reset`
    - Request: `{ "token": "<raw token>", "newPassword": "Test1234!" }`
    - Response: `204 No Content` on success
  - Username normalization rule (forgot + buckets + audit hash input):
    - `normalizedUsername = NFKC(trim(username)).toLowerCase(Locale.ROOT)`

- Authoritative token storage (single strategy): MySQL `channel_db.password_reset_tokens`.
  - No Redis token persistence for reset tokens.
  - Suggested schema fields:
    - `id` (PK)
    - `member_uuid`
    - `token_hash` (UNIQUE)
    - `issued_at`
    - `expires_at`
    - `consumed_at` (nullable)
    - `request_ip` (masked form)
    - `request_user_agent_hash`
    - `active_slot` (TINYINT NULL, active=1, terminal=NULL)
    - `pepper_version` (SMALLINT NOT NULL)
  - Operational invariant: one active token/member. New issue invalidates previous active token in transaction.
  - DB guard: unique key `(member_uuid, active_slot)`; active row uses `1`, terminal rows set `NULL` (multiple terminal rows allowed).
  - DB domain guard: `CHECK (active_slot IS NULL OR active_slot = 1)`.
  - Transaction lock order: `member` row first, then active token row to prevent deadlock and duplicate-active-token race.

- Lock-state transition policy:
  - On successful reset, clear login-failure counters and unlock only credential-failure lock (`AUTH-002`).
  - Do not reactivate withdrawn/admin-suspended/policy-locked accounts.
  - Reject password reuse where new password equals current password (`AUTH-015`, `422`).

- Side-channel policy:
  - Forgot API minimum response time floor: 400ms.
  - Added jitter range: 0~50ms.
  - Security benchmark target: existent/non-existent/challenge branches p95 latency delta <= 80ms in controlled test.
  - Token verification algorithm: always derive active+previous candidate hashes in fixed order, execute indexed `IN` lookup using both candidates, and perform fixed-order constant-time candidate-set compare without early-exit.
  - Reset token validation path timing policy: floor 120ms, jitter 0~20ms for valid/invalid/expired/consumed paths before response mapping.

- Error semantics (must be registered in canonical table before implementation merge):
  - `AUTH-012` reset token invalid or expired (`401`)
  - `AUTH-013` reset token already consumed (`409`)
  - `AUTH-014` forgot/challenge/reset rate limit exceeded (`429`, include `Retry-After`)
  - `AUTH-015` new password equals current password (`422`)
  - `AUTH-016` stale session after password change (`401`)

- CSRF policy:
  - Forgot/challenge/reset remain non-GET endpoints under CSRF protection.
  - Clients must call `GET /api/v1/auth/csrf` before forgot/challenge/reset submit.
  - Client fallback (all password recovery submits): on CSRF `403`, re-fetch CSRF once and retry same request once only; second `403` is terminal.
  - Retry integrity: retry request must preserve original payload/idempotency fields exactly.

- Abuse-threshold policy:
  - Challenge activation floor: distinct IPs >= 20 within 10 minutes per normalized username hash.
  - Adaptive control: dynamic threshold/scoring uses recent baseline traffic and decays automatically to release challenge mode when abuse signal drops.
  - Forgot-challenge endpoint also has endpoint-global limiter: `60/min`.

- URL safety:
  - Reset link origin is from explicit configuration allowlist; request host headers are not trusted for link generation.
  - Reset route path fixed to `/reset-password`; allowed query parameters are exactly `token` and all others are rejected.
  - `token` query validation: base64url-only charset, max length 128, strict decode failure treated as invalid token (`AUTH-012`).

- Token retention:
  - Cleanup scheduler runs every 15 minutes.
  - Delete batch size: 500 rows/batch.
  - Per-run catch-up controls: `maxBatchesPerRun=8`, `maxRunSeconds=20`.
  - Alert threshold: `backlogAlertThresholdRows=10000`.
  - Batch ordering: oldest `expires_at` first.
  - Required index set: `(expires_at)`, `(consumed_at)`, `(member_uuid, active_slot)`.
  - Consumed/expired tokens retained for 30 days for audit, then purged.
  - Token expiry validation applies clock-skew tolerance ±60s.
  - Pepper rotation supports `active` + `previous` key versions; rows carry `pepper_version`.

- Session fail-safe:
  - Auth filter enforces `sessionIssuedAt >= password_changed_at` for all protected endpoints.
  - `password_changed_at` must be updated in same DB transaction as password hash update and token consume.
  - If condition fails, reject with deterministic auth error `AUTH-016 (401)` and force re-authentication.

- Audit event contract:
  - Required event payload fields: `{eventType, memberUuid|null, usernameHash, outcome, reasonCode|null, traceId, ipHash, userAgentHash, hashKeyVersion, occurredAt}`.
  - `usernameHash/ipHash/userAgentHash` use keyed HMAC-SHA-256 pseudonymization key (separate from token pepper) with rotation support.
  - Hash-key rotation policy: active+previous key dual-read for 30 days, then previous key retired per runbook.
  - Long-retention forensic policy: retired keys are KMS-wrapped, read-restricted, and retained for full audit-retention period for verification only.

- CVE override governance:
  - Temporary direct dependency pin is exceptional and requires Security Lead + BE Lead approval metadata.
  - Override metadata is stored in `BE/gradle/dependency-override-metadata.yml` and includes approvers, expiry date (<=14 days), and rollback issue URL.
  - CI quality gate fails if override metadata is missing or expired.

### Architecture Compliance

- Keep implementation in `channel-service` auth boundary and reuse `GlobalExceptionHandler` conventions.
- Spring Session remains the session authority; session invalidation after reset is mandatory.
- Rate limiting follows Bucket4j + Redis-backed strategy already used in channel auth lane.
- Logging/PII masking requirements from security/audit stories apply unchanged.

### Library / Framework Requirements

- Baseline is repository-managed build configuration (`BE/build.gradle`) and Spring Boot BOM alignment.
- Metadata check date: 2026-03-05.
  - Spring Boot plugin baseline in repo: `3.4.13` (source of managed dependency versions).
  - Spring Security and Spring Mail versions must be consumed from Boot-managed BOM; this story must not introduce direct version pins.
  - `bucket4j_jdk17-core` reference version for compatibility check: `8.16.1` (subject to BOM/parent constraints).

### File Structure Requirements

- Expected touch points:
  - `BE/gradle/dependency-override-metadata.yml`
  - `BE/channel-service/src/main/resources/db/migration/channel/V*__member_password_changed_at.sql`
  - `BE/channel-service/src/main/resources/db/migration/channel/V*__password_changed_at_backfill.sql`
  - `BE/channel-service/src/main/java/com/fix/channel/auth/controller/AuthController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/auth/service/PasswordResetService.java`
  - `BE/channel-service/src/main/java/com/fix/channel/auth/service/PasswordResetMailDispatchService.java`
  - `BE/channel-service/src/main/java/com/fix/channel/auth/dto/PasswordForgotRequest.java`
  - `BE/channel-service/src/main/java/com/fix/channel/auth/dto/PasswordResetRequest.java`
  - `BE/channel-service/src/main/java/com/fix/channel/config/SecurityConfig.java`
  - `BE/channel-service/src/main/java/com/fix/channel/config/RateLimitConfig.java`
  - `BE/channel-service/src/main/java/com/fix/channel/config/GlobalExceptionHandler.java`
  - `BE/channel-service/src/main/resources/application*.yml`
  - `BE/channel-service/src/main/resources/db/migration/channel/V*__password_reset_tokens.sql`
  - `BE/channel-service/src/test/**`

### Testing Requirements

- Mandatory tests:
  - Anti-enumeration body parity across account outcomes.
  - Timing-envelope assertion (floor 400ms, p95 delta <= 80ms) for forgot API under controlled test harness.
  - Fixed generic response body contract assertion for forgot API.
  - One-active-token invariant under concurrent forgot requests.
  - `active_slot` domain constraint rejects invalid values (only `1` or `NULL`).
  - Invalid/expired/consumed token negative paths.
  - Password update + token consume in same transaction behavior.
  - AUTH-002 lock clear on reset; suspended/deactivated unaffected.
  - Post-reset all-session invalidation with multi-session fixture.
  - Session-version fail-safe guard blocks pre-reset sessions if purge is delayed.
  - CSRF required behavior on forgot/challenge/reset endpoints.
  - CSRF one-retry fallback behavior on forgot/challenge/reset submits.
  - Multi-dimensional rate-limit boundaries (`N-1/N/N+1`) including forgot-challenge endpoint dimensions.
  - Reset URL allowlist enforcement + host-header poisoning negative test.
  - Reset URL token query parsing strictness (`maxLen`, base64url charset, decode failure).
  - Mail retry/backoff + dedupe-key + DLQ behavior.
  - Username-hash keyed mail cooldown guard verification (existence-agnostic).
  - Canonical error taxonomy and FE/MOB mapping synchronization checks in same change set.
  - Token cleanup schedule and retention policy checks.
  - Purge batch/index usage verification under large fixture.
  - Cleanup backlog catch-up bounded-loop and alert metric checks.
  - Query allowlist strictness check for reset URL generation (`token` only).
  - Password-change transaction atomicity check for `password_changed_at`.
  - Deadlock regression for consistent lock order across forgot/reset flows.
  - Audit hash pseudonymization key versioning and rotation compatibility checks.
  - Challenge bootstrap + verify contract compatibility and replay denial checks.
  - Challenge nonce Redis atomic consume/replay-block behavior checks.
  - Fixed forgot recovery hint block contract parity checks.
  - Distributed username-targeted abuse challenge-gate behavior checks.
  - Adaptive threshold activation/release behavior checks under rising/decaying abuse traffic.
  - Challenge username-binding mismatch handling parity checks.
  - CVE override metadata CI gate checks.
  - Reset token validation branch timing equalization checks (`120ms` floor, `0~20ms` jitter).
  - Log redaction and audit event persistence verification.

### Previous Story Intelligence

- Story 1.5 guardrails require strict abuse-control boundary testing.
- Story 1.6 requires deterministic auth error semantics and FE/MOB mapping parity.

### Git Intelligence Summary

- Recent repository trend is planning/docs-heavy; this story must produce concrete runtime artifacts (controller/service/migration/tests), not docs-only output.

### Latest Tech Information

- OWASP Forgot Password guidance incorporated:
  - Uniform external responses
  - Strong expiring single-use tokens
  - No automatic login after password reset

### Project Context Reference

- `project-context.md` not found in repository scan.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Adversarial issues from prior round integrated into implementation-ready story spec.

### References

- `_bmad-output/planning-artifacts/channels/login_flow.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/implementation-artifacts/1-5-be-auth-guardrails-lockout-rate-limit.md`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- https://repo.maven.apache.org/maven2/com/bucket4j/bucket4j_jdk17-core/maven-metadata.xml

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story regenerated after adversarial review findings integration.

### Completion Notes List

- Added lock-state resolution rules and single-storage strategy.
- Added anti-enumeration timing hardening and host-header safe URL policy.
- Added transactional semantics, session invalidation retry policy, and canonical code-sync requirement.

### File List

- C:/Users/SSAFY/FIXYZ/_bmad-output/implementation-artifacts/1-7-be-password-forgot-reset-api.md
