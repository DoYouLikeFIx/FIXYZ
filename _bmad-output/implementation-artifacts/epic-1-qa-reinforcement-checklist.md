# Epic 1 QA Reinforcement Checklist

Date: 2026-03-08

## Purpose

This artifact records the shared Epic 1 QA reinforcement evidence referenced by Stories `1.1` through `1.5`. It closes documentation gaps for the FE auth review handoff by linking FE, MOB, and BE ownership explicitly instead of leaving cross-story evidence implicit.

## Verification Snapshot

- `cd FE && pnpm test -- --run` -> PASS (`7` files, `36` tests)
- `cd FE && pnpm build` -> PASS
- `cd FE && pnpm type-check` -> PASS
- `cd FE && pnpm lint` -> PASS
- `cd MOB && npm test` -> PASS (`8` files, `27` tests) on the prior 2026-03-07 parity pass; mobile code was not changed in this rerun
- `cmd /c pnpm --dir FE test -- tests/unit/lib/auth-errors.test.ts tests/unit/lib/axios.test.ts` -> PASS (`16` files, `96` tests) on 2026-03-11 closeout normalization
- `cmd /c npm --prefix MOB test -- tests/unit/auth/auth-errors.test.ts tests/unit/network/errors.test.ts tests/unit/network/csrf.test.ts tests/unit/bootstrap/app-bootstrap.test.ts` -> PASS (`4` files, `35` tests) on 2026-03-11 closeout normalization
- `cd BE && .\\gradlew.bat :channel-service:test --tests "com.fix.channel.integration.ChannelAuthFlowTest" --tests "com.fix.channel.integration.ChannelAuthSessionIntegrationTest" --tests "com.fix.channel.integration.ChannelAuthGuardrailsIntegrationTest" --tests "com.fix.channel.integration.ChannelSessionTimeoutIntegrationTest"` -> BUILD SUCCESSFUL on 2026-03-11
- Current workspace contains BE auth/session and auth-guardrail implementation plus matching integration sources under `BE/channel-service/src/main/**` and `BE/channel-service/src/test/java/com/fix/channel/integration/**`.

## Story Ownership Map

- Story `1.1`: BE registration/login/session issuance baseline and duplicate-login invalidation semantics
- Story `1.2`: BE logout, invalidated session, and inactivity-expiry semantics
- Story `1.3`: FE web login/register/private-route/session-expiry UX
- Story `1.4`: MOB auth flow parity, re-auth navigation, and foreground resume behavior
- Story `1.5`: BE lockout, rate-limit, cooldown/reset, and security-event persistence
- Story `1.6`: FE/MOB auth error standardization hardening across clients

## Shared Session Behavior Matrix

### Valid session

- FE evidence:
  - `FE/tests/integration/App.test.tsx` proves successful login enters `/portfolio`
  - `FE/tests/unit/lib/auth.test.ts` proves session fetch/login/register client paths use the intended auth contract
- MOB evidence:
  - `MOB/tests/e2e/mobile-foundation.e2e.test.ts` proves cookie-session + CSRF bootstrap + protected POST contract
  - `MOB/tests/unit/bootstrap/app-bootstrap.test.ts` proves cold-start bootstrap enters health-check path deterministically
- Ownership:
  - FE UX: Story `1.3`
  - MOB UX: Story `1.4`

### Expired session / auth required

- FE evidence:
  - `FE/tests/integration/App.test.tsx` proves session-expiry warning fallback redirects to login with re-auth guidance
  - `FE/tests/unit/lib/auth-errors.test.ts` proves `AUTH-003`, `CHANNEL-001`, and `AUTH-016` are treated as re-auth conditions
- MOB evidence:
  - `MOB/tests/unit/network/errors.test.ts` proves backend auth/session codes remain intact through mobile normalization
  - `MOB/tests/unit/bootstrap/app-bootstrap.test.ts` proves startup failure behavior is deterministic for missing/failed auth bootstrap paths
- Ownership:
  - FE re-auth UX: Story `1.3`
  - MOB re-auth navigation: Story `1.4`

### Invalidated by new login

- FE evidence:
  - `FE/tests/unit/lib/auth-errors.test.ts` proves `AUTH-016` is recognized as a re-auth condition
- MOB evidence:
  - `MOB/tests/unit/network/errors.test.ts` proves `AUTH-016` survives transport normalization for downstream router/store handling
- Ownership:
  - BE invalidation semantics: Story `1.1`
  - FE/MOB user-facing handling: Stories `1.3` and `1.4`

### Logout after call

- Current evidence:
  - Ownership is recorded, but no FE or MOB logout automation exists in the current workspace snapshot
  - `MOB/README.md` and foundation network code confirm cookie-session is transport-managed and not persisted client-side
- Ownership:
  - BE invalidation contract: Story `1.2`
  - FE logout UX: out of Story `1.3` scope
  - MOB logout UX: Story `1.4`

### App/browser resume

- FE evidence:
  - `FE/src/App.tsx` re-checks session on bootstrap
  - `FE/tests/integration/App.test.tsx` proves session-expiry stream reconnect and reconnect cleanup are deterministic
- MOB evidence:
  - `MOB/tests/unit/network/csrf.test.ts` proves `onForegroundResume()` refreshes auth bootstrap state
  - `MOB/tests/unit/bootstrap/app-bootstrap.test.ts` proves resume-adjacent bootstrap failures are deterministic
- Ownership:
  - FE browser re-entry semantics: Story `1.3`
  - MOB app resume semantics: Story `1.4`

## Lockout and Rate-Limit Boundary Traceability

### Client contract evidence captured in this pass

- FE evidence:
  - `FE/tests/unit/lib/auth-errors.test.ts` proves canonical FE copy exists for `AUTH-002` and `RATE-001`
- MOB evidence:
  - `MOB/tests/unit/network/errors.test.ts` proves mobile normalization preserves backend auth/security codes for downstream handling

### Server-side replay and persistence owner

- Story `1.5` owns the executable evidence for:
  - IP rate-limit `N-1`, `N`, `N+1`
  - account lockout `N-1`, `N`, `N+1`
  - locked-account denial with correct password until admin unlock
  - cooldown/reset behavior
  - security-event persistence on lockout
- Source references:
  - `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`
  - `_bmad-output/planning-artifacts/epics.md` (Epic 1 canonical story map)
  - `BE/channel-service/src/main/java/com/fix/channel/service/AuthService.java`
  - `BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthGuardrailsIntegrationTest.java`
  - `BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthSessionIntegrationTest.java`

### Workspace status note

- The current workspace now contains the backend guardrail implementation and targeted integration coverage.
- The 2026-03-11 closeout rerun confirmed the targeted Gradle test task completes successfully in this workspace, while the generated XML reports still annotate some container-backed integration cases as skipped in the local environment.
- This checklist therefore records both executable source/test ownership and the final Epic 1 closeout normalization instead of leaving Story `1.5` evidence unresolved.

## Correlation Contract Sample

This is a contract sample, not a captured production log.

- Client-visible FE message:
  - `로그인 시도가 잠겨 있습니다. 잠시 후 다시 시도해 주세요.`
- Backend error code:
  - `AUTH-002`
- FE capture points:
  - `FE/src/lib/auth-errors.ts` maps the backend code to user-facing copy
  - `FE/src/lib/axios.ts` preserves `code` and `traceId` on `NormalizedApiError`
  - `FE/tests/unit/lib/axios.test.ts` proves `traceId` is normalized from the backend envelope
- Server-side owner for the corresponding security event/log:
  - Story `1.5` for lockout event persistence
  - Story `8.3` for backend correlation-id propagation
  - Stories `8.5` and `8.6` for client-side correlation surfacing

## Resolution Summary

- FE/MOB parity evidence is now recorded in one shared matrix.
- The missing Epic 1 checklist reference now exists at the path all Epic 1 stories already cite.
- Story `1.3` no longer needs a local follow-up for lockout/correlation ownership; that dependency is now traced explicitly to Story `1.5` and Epic `8.x` correlation stories.
- Story `1.1`, `1.2`, `1.4`, `1.5`, and `1.6` Quinn reinforcement review items were normalized to resolved during Epic 1 closeout on 2026-03-11.
