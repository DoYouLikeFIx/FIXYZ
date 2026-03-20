# Password Recovery Challenge Runbook

This runbook operationalizes Story `1.19` and the reviewed recovery-challenge baselines from Stories `1.16`, `1.17`, and `1.18`.

## Scope

- Story `1.19` validates and packages lane-scoped evidence for the existing recovery challenge rollout.
- Story `1.19` does not redefine Epic 10 release-gate ownership.
- Stories `1.16`, `1.17`, and `1.18` are treated as frozen reviewed baselines for the same implementation branch while Story `1.19` evidence is collected.

## Frozen baseline contract

The following baseline must not change during Story `1.19` evidence work unless the story is explicitly paused and re-scoped:

- `challengeContractVersion`
- `challengeId`
- `challengeIssuedAtEpochMs`
- `challengeExpiresAtEpochMs`
- proof-of-work payload shape
- `AUTH-022`, `AUTH-023`, `AUTH-024`, `AUTH-025` semantics
- exact legacy-v1 fallback shape
- rollout-flag and challenge-capable cohort routing semantics
- canonical client fail-closed reasons:
  - `unknown-version`
  - `kind-mismatch`
  - `malformed-payload`
  - `mixed-shape`
  - `clock-skew`
  - `validity-untrusted`

If a review blocker requires changing any item above, stop Story `1.19`, refresh the story evidence plan, and re-confirm the updated baselines before resuming.

## Configuration inputs

- Rollout flag: `AUTH_PASSWORD_RECOVERY_CHALLENGE_V2_ENABLED`
- Cohort percentage: `AUTH_PASSWORD_RECOVERY_CHALLENGE_COHORT_PERCENTAGE`
- Cohort salt: `AUTH_PASSWORD_RECOVERY_CHALLENGE_COHORT_SALT`
- Challenge signing secret: `AUTH_PASSWORD_RECOVERY_CHALLENGE_SIGNING_SECRET`
- Challenge observability secret: `AUTH_PASSWORD_RECOVERY_CHALLENGE_OBSERVABILITY_SECRET`
- Local HTTP live validation cookie mode: `SESSION_COOKIE_SECURE=false`

`AUTH_PASSWORD_RECOVERY_CHALLENGE_OBSERVABILITY_SECRET` must be distinct from `AUTH_PASSWORD_RECOVERY_CHALLENGE_SIGNING_SECRET`.
For local HTTP validation lanes, `SESSION_COOKIE_SECURE` must be set to `false` so CSRF-backed forgot-password flows can retain the channel session cookie outside HTTPS-only browser contexts.

## Client fail-closed telemetry path

Canonical collection path for Story `1.19`:

1. FE and MOB emit `password-recovery-challenge-fail-closed` through the shared `__FIXYZ_AUTH_TELEMETRY__` sink.
2. Story `1.19` implements the bridge from that sink into the channel-auth telemetry collector.
3. The collector increments queryable backend counters.
4. Dashboards and support queries read those counters from backend observability, not from client console output.

Required metric:

- `auth.password_recovery.challenge.client_fail_closed`

Required tags:

- `reason`
- `surface`
- `environment`
- `rollout_enabled`
- `challenge_capable_cohort`
- `contract_version`

Transport rules:

- FE uses `navigator.sendBeacon` when available with same-origin `fetch(..., { keepalive: true })` fallback.
- MOB uses the existing auth API client to deliver the same canonical payload to the channel-auth collector.
- Local `console.warn` output is diagnostic-only and is not acceptable release evidence.

Secret-handling rules:

- Do not emit raw proof.
- Do not emit raw challenge token.
- Do not emit raw `challengeId`.
- Do not emit unhashed email.
- `challengeIdHash` must be derived server-side as `hex(HMAC-SHA-256(observabilitySecret, challengeId))[0:24]`.

## Release-evidence baseline clients

Story `1.19` evidence uses the following fixed baselines unless a reviewed update is recorded first:

- Web: Playwright `Desktop Chrome` project from `FE/playwright.config.ts`
- Mobile: Maestro iOS simulator default `iPhone 17` from `MOB/scripts/run-maestro-auth-suite.sh`

If another browser or mobile device is used for evidence, update this runbook and the Story `1.19` artifact before collecting results.

## Enablement sequence

1. Start with `AUTH_PASSWORD_RECOVERY_CHALLENGE_V2_ENABLED=false`.
2. Verify exact legacy-v1 fallback behavior for out-of-cohort traffic.
3. Set the non-production cohort selector so in-cohort and out-of-cohort paths can be reproduced deterministically.
   For local compose validation, either:
   - set `AUTH_PASSWORD_RECOVERY_CHALLENGE_V2_ENABLED=true` and `AUTH_PASSWORD_RECOVERY_CHALLENGE_COHORT_PERCENTAGE=100`, or
   - enable `AUTH_PASSWORD_RECOVERY_CHALLENGE_DETERMINISTIC_OVERRIDE_ENABLED=true` and use `X-Fixyz-Recovery-Challenge-Mode: v2|legacy-v1|disabled`.
4. Enable v2 only for the intended QA or canary cohort.
5. Verify:
   - in-cohort returns v2 with opaque `challengeId`
   - out-of-cohort remains exact legacy-v1
   - fail-closed reasons appear in backend counters
   - bootstrap and verify failure classes remain distinguishable
6. Package timing, FE, MOB, and backend evidence under `_bmad-output/implementation-artifacts/tests/` or a story-owned appendix under the same folder.

## Rollback sequence

1. Set `AUTH_PASSWORD_RECOVERY_CHALLENGE_V2_ENABLED=false` or remove the request from the allowed cohort.
2. Verify `/api/v1/auth/password/forgot/challenge` returns the exact legacy-v1 contract.
3. Verify new counters show `contract_version=legacy-v1` for fallback traffic.
4. Confirm no new v2-only fields appear in client-visible bootstrap responses after rollback.

## Verification checklist

- Anti-enumeration p95 delta remains `<= 80ms` with at least `30` warmed samples per path.
- `AUTH-023` and `AUTH-025` can be forced independently.
- FE and MOB prove exact canonical fail-closed reason labeling.
- FE and MOB preserve redirect continuity.
- Backend evidence distinguishes bootstrap vs verify failure classes.
- Support queries expose `traceId`, `challengeIdHash`, retryability, cohort, rollout state, and contract version without leaking secrets.
