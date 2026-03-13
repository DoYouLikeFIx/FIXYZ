# Epic 1 Follow-on: Real Password Recovery Challenge Story Set

Status: dev-ready

Date: 2026-03-13

Owner lane: Epic 1 - Channel Auth & Session Platform

## Why this stays in Epic 1

This follow-on work hardens the existing password recovery lane rather than introducing a new perimeter-security platform.

- It extends the current `POST /api/v1/auth/password/forgot/challenge` contract.
- It extends the contract established in Story `1.7` and is consumed by the FE/MOB recovery lanes established in Story `1.8` and Story `1.9`.
- It changes auth and recovery behavior before it changes DMZ or edge policy.

Use Epic 12 instead only if the work expands into site-wide bot-defense, WAF policy, cross-entrypoint challenge policy, or perimeter operations owned primarily by Security/Ops.

## Scope

- Replace the current placeholder-style recovery challenge with a real verifiable challenge provider.
- Keep the provider pluggable so the lane can support future `captcha` rollout without rewriting the recovery flow.
- Keep the first rollout intentionally small: deliver a local verifiable `proof-of-work` challenge first, then add `captcha` only as a later extension if needed.
- Preserve anti-enumeration, CSRF, rate limiting, transient-token handling, and redirect continuity already delivered in Epic 1.
- Preserve the existing FE/MOB auth error standardization lane so newly added recovery-challenge codes do not drift across clients.

## Non-goals

- No global login, register, or order-entry challenge rollout in this follow-on set.
- No DMZ/WAF redesign.
- No provider-specific hardcoding in FE or MOB beyond the contract needed to render and submit the challenge.

## Proposed Story Set

### Story 1.16: BE Real Password Recovery Challenge Provider & Verification

As a channel platform owner,
I want password recovery challenge bootstrap and verification backed by a real challenge provider,
so that the recovery lane resists abuse with verifiable challenge proof instead of placeholder validation.

Acceptance criteria:

1. Given `POST /api/v1/auth/password/forgot/challenge`, when the configured proof-of-work provider is available, the rollout flag is enabled, and the request matches the explicit challenge-capable cohort rule, then the API returns a real challenge bootstrap contract with provider-backed payload, opaque `challengeId`, `challengeType=proof-of-work`, TTL, replay-safe challenge identity, and enough work-bundle data for FE/MOB to solve the proof without inventing local contract fields.
2. Given the proof-of-work MVP rollout is enabled, when bootstrap succeeds, then the contract includes `challengeContractVersion=2`, `challengeIssuedAtEpochMs`, `challengeExpiresAtEpochMs`, and a discriminated `challengePayload.kind=proof-of-work` bundle containing canonical solver fields: `algorithm=SHA-256`, `seed`, `difficultyBits`, `answerFormat=nonce-decimal`, `inputTemplate={seed}:{nonce}`, `inputEncoding=utf-8`, `successCondition.type=leading-zero-bits`, and `successCondition.minimum=difficultyBits`.
3. Given `POST /api/v1/auth/password/forgot` with `challengeToken` and scalar `challengeAnswer`, when the proof is valid for the original exact submitted email payload and challenge instance, then challenge-gated submits require both challenge fields together, the backend performs normalization server-side for account lookup, verifies a server-derived digest of the exact raw submitted email string in addition to the normalized-email binding, the forgot flow proceeds without breaking the existing anti-enumeration response contract, and clients are not required to implement normalization logic.
4. Given the challenge bootstrap is requested for a known or unknown email under CSRF-valid, non-rate-limited conditions, when the backend returns the response, then the response shape, status, and anti-enumeration timing behavior remain parity-safe regardless of account existence, with a measured p95 delta of `<= 80ms` between known, unknown, and challenge-gated paths using the Story `1.7` benchmark method.
5. Given invalid, expired, mismatched, or malformed challenge proof, when the backend rejects the request, then it returns deterministic recovery-challenge business code `AUTH-022` and does not disclose account eligibility.
6. Given replayed or already consumed challenge proof, when the backend rejects the request, then it returns deterministic terminal business code `AUTH-024` so clients can clear stale challenge state instead of offering an unsafe blind retry.
7. Given challenge bootstrap cannot be issued because the provider bootstrap path is unavailable, when the backend cannot issue or sign a fresh challenge bundle, then it returns deterministic bootstrap-unavailable code `AUTH-023` and records audit or security evidence without leaking secrets.
8. Given a challenge answer cannot be verified because the verifier path is unavailable after the user already solved work, when the backend cannot complete verification deterministically, then it returns deterministic verify-unavailable code `AUTH-025` so clients can clear the current challenge and require a restart of challenge bootstrap instead of blind retry.
9. Given a v2 challenge bundle is returned, when the backend validates that bundle, then `challengeToken` cryptographically binds `challengeContractVersion`, `challengeId`, `challengeType`, `challengeIssuedAtEpochMs`, `challengeExpiresAtEpochMs`, the full `challengePayload`, replay-safe challenge identity, the normalized-email-hash binding derived server-side from the submitted email, and a submitted-email digest derived server-side from the exact raw submitted email string, and any token/body divergence or exact-email-string drift is rejected with `AUTH-022`.
10. Given a new challenge is issued within the same recovery-flow scope (`csrf session` + normalized-email-hash binding derived server-side), when the backend creates the newer bundle, then any earlier outstanding unconsumed challenge in that scope is terminalized immediately so only the latest challenge remains valid.
11. Given the MVP rollout uses `proof-of-work` first, when difficulty is configured for rollout beyond QA or canary cohorts, then the chosen `difficultyBits` profile is calibration-backed and satisfies the canonical web and mobile baseline solve budgets defined in the UX specification.
12. Given the MVP rollout uses `proof-of-work` first, when the service starts, then the proof-of-work implementation is wired through a single `PasswordRecoveryChallengeProvider` abstraction, unsupported provider types are rejected by configuration rather than branching controller logic, and the real challenge path is protected by a rollout flag plus an explicit server-side challenge-capable cohort rule so BE-first deployment can keep the exact legacy Story `1.7` challenge contract active until Story `1.17` and Story `1.18` are shipped.
13. Given issue or verify attempts, when telemetry is emitted, then metrics, audit entries, and correlation-ready logs distinguish issue, verify success, invalid proof, replay rejection, bootstrap unavailable, verify unavailable, rollout-flag state, challenge-capable cohort, and contract version.

Recommended implementation notes:

- Introduce a `PasswordRecoveryChallengeProvider` abstraction with one real proof-of-work implementation and one local/dev-safe implementation.
- Keep nonce replay protection and email binding even when the provider does its own verification.
- For the proof-of-work MVP, the canonical solver equation is `sha256(utf8(seed + ":" + nonce))` and the proof is valid only when the resulting digest has at least `difficultyBits` leading zero bits. `nonce` is serialized as an unsigned base-10 string with no separators or sign.
- `challengeToken` must bind `challengeId`, the full returned v2 bundle, the normalized-email-hash binding, and a submitted-email digest derived server-side from the exact raw email string; token/body divergence or exact-email-string drift is a server-detected `AUTH-022` contract error.
- `challengeId` is the opaque active challenge identity surfaced to FE/MOB; a newer distinct `challengeId` replaces the previous transient challenge state, while exact legacy v1 fallback omits `challengeId`.
- `challengeType` and `challengePayload.kind` must match. Unknown contract version or discriminator mismatch is also a fail-closed contract error.
- The only valid legacy v1 fallback shape is `challengeToken + challengeType + challengeTtlSeconds` with all v2-only fields absent; a partial or mixed bundle is malformed and must fail closed.
- `challengeTtlSeconds` is informational only. The authoritative validity window is `challengeIssuedAtEpochMs` to `challengeExpiresAtEpochMs`.
- The backend normalizes the submitted email server-side. FE and MOB preserve the originally submitted email string verbatim between bootstrap and challenged forgot submit.
- The staged rollout needs both a global feature flag and a server-side challenge-capable cohort selector. Out-of-cohort requests keep the exact legacy v1 contract.
- Use the server-issued `challengeIssuedAtEpochMs` and `challengeExpiresAtEpochMs` as the authoritative validity window. FE/MOB may use monotonic timers locally, but if validity cannot be guaranteed after background or resume they must discard the challenge and request a fresh one. Apply a `5s` expiry safety margin before starting or resuming solve work. If estimated clock skew between local receipt time and `challengeIssuedAtEpochMs` exceeds `30s`, clients fail closed and refresh.
- `challengeAnswer` remains the proof-of-work submit field and `challengeAnswerPayload` stays out of scope for this story set. Future adapters may add a discriminated `challengeAnswerPayload` without changing the endpoint path; until then, dual-field or payload-based submits are malformed.
- When the exact legacy v1 shape is returned, server-side metrics and logs label the contract version as `legacy-v1`.
- Canonical error additions for this story:
  - `AUTH-022`: invalid, expired, mismatched, or malformed recovery challenge proof
  - `AUTH-023`: recovery challenge bootstrap unavailable
  - `AUTH-024`: replayed or already consumed recovery challenge proof
  - `AUTH-025`: recovery challenge verify unavailable after solve

### Story 1.17: FE Web Real Password Recovery Challenge UX

As a locked-out web user,
I want the browser password recovery screen to render and submit a real proof-of-work challenge,
so that I can complete recovery without provider-specific confusion or broken browser behavior.

Depends On: Story `1.6`, Story `1.8`, Story `1.16`

Acceptance criteria:

1. Given the recovery challenge branch is entered, when the browser receives the exact legacy v1 bootstrap shape (`challengeToken + challengeType + challengeTtlSeconds` only) it preserves Story `1.8` behavior, and when it receives `challengeType=proof-of-work` with `challengeContractVersion=2` it renders the correct proof-of-work interaction without changing the existing forgot-password lane structure.
2. Given the user completes the proof-of-work interaction, when the browser submits the follow-up forgot request, then `challengeToken` and scalar `challengeAnswer` are sent through the existing recovery contract, `challengeAnswerPayload` remains absent in the current rollout, the original submitted email payload is preserved unchanged, and raw proof is not persisted to browser storage, analytics, or logs.
3. Given a CSRF failure on challenge bootstrap or challenged forgot submit, when the browser receives raw `403 Forbidden`, then it preserves the existing one-refresh and one-retry policy with identical payload and does not introduce silent extra retries.
4. Given `AUTH-022`, `AUTH-023`, `AUTH-024`, or `AUTH-025`, when the browser receives those outcomes, then it follows the canonical next-action contract: `AUTH-022` refreshes the challenge, `AUTH-023` retries later with `Retry-After` backoff when present and otherwise shows generic retry-later guidance with no auto-retry, `AUTH-024` clears stale state and refreshes the challenge, and `AUTH-025` clears the current challenge and requires a full challenge restart, while honoring `Retry-After` guidance where applicable and never trapping the user in blind retry loops.
5. Given challenge expiry, replay rejection, verify-path failure, or a newly issued challenge bundle on the same route, when the browser transitions to the latest challenge instance identified by a newer distinct `challengeId`, then stale challenge state is replaced deterministically only when the new bundle carries a strictly greater authoritative `challengeIssuedAtEpochMs`, equal authoritative timestamps with distinct ids fail closed and refresh, and only the most recent challenge remains active.
6. Given `challengeContractVersion` is unknown, `challengeType` and `challengePayload.kind` do not match, the proof-of-work payload is malformed, a partial mixed v1/v2 bundle is received, estimated clock skew against `challengeIssuedAtEpochMs` exceeds `30s`, or validity cannot be trusted after background or resume, when the browser cannot trust the active challenge, then it fails closed, clears active challenge state, offers fresh challenge refresh guidance instead of attempting or resuming a local solve, and records the exact canonical fail-closed telemetry reason including `mixed-shape`, `clock-skew`, or `validity-untrusted` when applicable.
7. Given the user entered the password recovery lane with a protected-route redirect intent, when the browser traverses challenge bootstrap, challenged forgot submit, reset, and return-to-login success, then the original redirect intent remains preserved end to end.
8. Given regression and live test coverage, when verification runs, then the browser proves happy path, invalid proof, replayed proof, expired proof, bootstrap unavailable, verify unavailable, `Retry-After` guidance, unknown contract fail-closed behavior, `clock-skew` fail-closed behavior, `validity-untrusted` fail-closed behavior, exact canonical fail-closed reason labeling, authoritative issue-time replacement ordering including equal-timestamp collision fail-close, and redirect-preserving recovery completion.

Recommended implementation notes:

- Keep rendering contract-driven and narrow. Do not let challenge implementation details leak into the rest of the auth flow.
- Keep browser message semantics aligned with the shared auth error contract before Mobile consumes the same codes.
- Treat partial mixed v1/v2 bundles as malformed fail-closed state, not as legacy fallback.
- Emit client-side telemetry for fail-closed bundle rejection reasons using the canonical labels in `docs/contracts/recovery-challenge-fail-closed.json`: `unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, `validity-untrusted`.
- Order active-challenge replacement by authoritative `challengeIssuedAtEpochMs`; equal timestamps with distinct `challengeId` are malformed and must fail closed with refresh guidance.
- Web solve UX must stay within the canonical supported-browser budget of p95 `<= 4s` and p99 `<= 6s`, with visible progress within `150ms`.

### Story 1.18: MOB Mobile Real Password Recovery Challenge UX

As a locked-out mobile user,
I want the native password recovery screen to render and submit a real proof-of-work challenge,
so that I can complete recovery without browser-only behavior or broken mobile state handling.

Depends On: Story `1.6`, Story `1.9`, Story `1.16`

Acceptance criteria:

1. Given the recovery challenge branch is entered, when the app receives the exact legacy v1 bootstrap shape (`challengeToken + challengeType + challengeTtlSeconds` only) it preserves Story `1.9` behavior, and when it receives `challengeType=proof-of-work` with `challengeContractVersion=2` it renders the correct native proof-of-work interaction without changing the existing recovery lane semantics.
2. Given the user completes the proof-of-work interaction, when the app submits the follow-up forgot request, then `challengeToken` and scalar `challengeAnswer` are sent through the existing recovery contract, `challengeAnswerPayload` remains absent in the current rollout, the original submitted email payload is preserved unchanged, and raw proof is not persisted to keychain, async storage, analytics, or logs.
3. Given a CSRF failure on challenge bootstrap or challenged forgot submit, when the app receives raw `403 Forbidden`, then it preserves the existing one-refresh and one-retry policy with identical payload and does not introduce silent extra retries.
4. Given `AUTH-022`, `AUTH-023`, `AUTH-024`, or `AUTH-025`, when the app receives those outcomes, then it follows the canonical next-action contract: `AUTH-022` refreshes the challenge, `AUTH-023` retries later with `Retry-After` backoff when present and otherwise shows generic retry-later guidance with no auto-retry, `AUTH-024` clears stale state and refreshes the challenge, and `AUTH-025` always clears the current challenge before a restart path is offered, while honoring `Retry-After` guidance where applicable and avoiding stale-proof loops or back-stack dead ends.
5. Given the proof-of-work solve is in progress, when the user cancels, backgrounds the app, or resumes after foreground restoration, then the client remains responsive, never blocks the main UI thread, progress becomes visible within `150ms`, cancel input is acknowledged within `250ms`, p95 solve time stays `<= 5s` and p99 solve time stays `<= 8s` on the documented baseline mobile devices used for release evidence, and the client either resumes the still-valid challenge or clears it with an explicit refresh CTA if validity cannot be guaranteed from the authoritative server timestamps with a `5s` expiry safety margin or estimated clock skew beyond `30s`.
6. Given `challengeContractVersion` is unknown, `challengeType` and `challengePayload.kind` do not match, the proof-of-work payload is malformed, a partial mixed v1/v2 bundle is received, estimated clock skew against `challengeIssuedAtEpochMs` exceeds `30s`, or validity cannot be trusted after background or resume, when the app receives that bundle, then it fails closed, clears active challenge state, offers fresh challenge refresh guidance instead of attempting or resuming a local solve, and records the exact canonical fail-closed telemetry reason including `mixed-shape`, `clock-skew`, or `validity-untrusted` when applicable.
7. Given challenge expiry, replay rejection, verify-path failure, or a newly issued challenge bundle on the same recovery route, when the app transitions to the latest challenge instance identified by a newer distinct `challengeId`, then stale challenge state is replaced deterministically only when the new bundle carries a strictly greater authoritative `challengeIssuedAtEpochMs`, equal authoritative timestamps with distinct ids fail closed and refresh, and only the most recent challenge remains active.
8. Given the user entered the password recovery lane with a protected-route redirect intent, when the app traverses challenge bootstrap, challenged forgot submit, reset, and return-to-login success, then the original redirect intent remains preserved end to end.
9. Given regression and live test coverage, when verification runs, then mobile proves happy path, invalid proof, replayed proof, expired proof, bootstrap unavailable, verify unavailable, `Retry-After` guidance, unknown contract fail-closed behavior, `clock-skew` fail-closed behavior, `validity-untrusted` fail-closed behavior, exact canonical fail-closed reason labeling, authoritative issue-time replacement ordering including equal-timestamp collision fail-close, deterministic return-to-login continuity, and background or resume safety.

Recommended implementation notes:

- Keep native rendering contract-driven and narrow. Do not let challenge implementation details leak into the rest of the auth flow.
- Preserve the existing mobile recovery route semantics and avoid introducing browser-only assumptions.
- Treat partial mixed v1/v2 bundles as malformed fail-closed state, not as legacy fallback.
- Emit client-side telemetry for fail-closed bundle rejection reasons using the canonical labels in `docs/contracts/recovery-challenge-fail-closed.json`: `unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, `validity-untrusted`.
- Order active-challenge replacement by authoritative `challengeIssuedAtEpochMs`; equal timestamps with distinct `challengeId` are malformed and must fail closed with refresh guidance.

### Story 1.19: Recovery Challenge Abuse-Defense Validation & Ops Evidence

As a platform operator,
I want lane-scoped validation and operational evidence for the recovery challenge lane,
so that abuse-defense hardening is measurable and supportable in production-like environments.

Acceptance criteria:

1. Given the real proof-of-work provider rollout, when automated verification runs, then BE integration tests cover known and unknown email parity, replay rejection, expiry, bootstrap unavailable, verify unavailable, exact-email drift rejection, rate-limit boundaries, deterministic fresh-issue `challengeId` rotation, and monotonic authoritative issue timestamps for fresh bundles; request-mutation harness coverage owns malformed submit-shape rejection (`challengeAnswerPayload` or dual-field PoW submit) plus mutated client-stack paths unreachable from normal FE/MOB UI; and FE plus MOB E2E cover fail-closed malformed-bundle handling, `clock-skew` and `validity-untrusted` bundle rejection, exact canonical fail-closed reason labeling, QA/canary cohort fallback, v2 `challengeId` consumption versus legacy-v1 absence, challenge replacement ordering including equal-timestamp collision fail-close, and redirect-preserving recovery completion.
2. Given provider-backed recovery traffic, when observability data is emitted, then dashboards or queryable metrics expose bootstrap rate, verify success rate, verify failure rate, replay rejection count, bootstrap-unavailable count, verify-unavailable count, and client fail-closed bundle-rejection counts broken down by the exact canonical rejection reason (`unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, `validity-untrusted`) by environment, rollout-flag state, challenge-capable cohort, and challenge contract version, using canonical labels `2` and `legacy-v1`.
3. Given support or incident response, when logs and audit records are reviewed, then correlation id, safe `challengeIdHash` correlation using the canonical HMAC-derived format, challenge outcome category, retryability, rollout-flag state, challenge-capable cohort, challenge contract version, and the exact client fail-closed bundle-rejection reason are visible without exposing raw proof, raw token, raw `challengeId`, or unhashed email.
4. Given configuration changes provider settings, when deployment documentation is consulted, then there is a short operator runbook for staged enablement, feature-flag rollback, QA/canary cohort selection, deterministic non-production cohort forcing for validation, degraded mode, legacy-v1 versus v2 cutover rules, and test verification steps.
5. Given anti-enumeration evidence is produced, when timing analysis is reviewed, then the story set includes the Story `1.7` benchmark method with at least `30` warmed samples per path and a slowest-versus-fastest p95 delta of `<= 80ms` across known, unknown, and challenge-gated forgot paths.
6. Given story closeout, when QA evidence is packaged, then the story set includes traceable proof that the real challenge rollout preserved the existing anti-enumeration and recovery redirect guarantees from Stories `1.7` to `1.9`.
7. Given failure-mode verification, when the story is reviewed, then an injectable harness or provider failpoint proves `AUTH-023` and `AUTH-025` can be forced independently.
8. Given Epic 10 remains the final release gate, when this story is completed, then it produces lane-scoped evidence only and does not by itself redefine release readiness ownership.

## Suggested Delivery Order

1. Story `1.16` first to lock the backend contract and error taxonomy.
2. Story `1.17` second so Web consumes one stable contract.
3. Story `1.18` third so Mobile consumes the same stable contract.
4. Story `1.19` last to attach operational evidence and lane confidence.

## Suggested Ownership

- `1.16`: CH
- `1.17`: FE
- `1.18`: MOB
- `1.19`: CH + FE + MOB + QA

## Locked MVP Decision

- The first follow-on rollout uses local verifiable `proof-of-work`.
- `captcha` remains an additive future adapter after the proof-of-work lane is stable.
- `AUTH-022`, `AUTH-023`, `AUTH-024`, and `AUTH-025` must land in the shared canonical auth contract before Story `1.17` or `1.18` implementation starts.
