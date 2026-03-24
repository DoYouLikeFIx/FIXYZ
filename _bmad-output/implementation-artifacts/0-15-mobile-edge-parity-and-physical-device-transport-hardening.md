# Story 0.15: Mobile Edge Parity and Physical-Device Transport Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile release owner,
I want mobile runtime modes that distinguish local direct-connect convenience from edge-first validation,
so that simulator workflows stay fast while shared QA and physical-device traffic can move toward the intended public ingress safely.

**Depends On:** Story 0.4, Story 0.7, Story 12.6

## Acceptance Criteria

1. Given local simulator or emulator development, when no explicit edge profile or base-URL override is configured, then MOB may continue to use the current direct `channel-service:8080` host matrix for developer convenience.
2. Given shared QA, edge-validation, or physical-device flows, when `MOB_API_INGRESS_MODE=edge` is configured and `MOB_EDGE_BASE_URL` is provided, then MOB resolves that HTTPS edge base URL instead of plain `http://<LAN_IP>:8080`.
3. Given physical-device startup or any explicit base-URL override resolves to a non-localhost base URL, when session-cookie policy would otherwise require `SameSite=None; Secure`, then MOB fails fast on unsafe plaintext transport unless the named dev-only bypass `MOB_ALLOW_INSECURE_DEV_BASE_URL=true` is set in a development runtime and documented.
4. Given MOB runs in edge mode, when it performs CSRF bootstrap, login, logout, session refresh, order-session APIs, and notification APIs, then cookie-session and CSRF behavior remain functional without a separate non-canonical client contract.
5. Given MOB subscribes to notifications through edge mode, when transient disconnects or app-resume events occur, then SSE reconnect, missed-notification backfill, and stream recovery continue to follow the existing mobile notification contract.
6. Given mobile verification runs, when CI or release-readiness validation executes, then at least one automated lane or scripted verification path covers edge mode through `MOB_API_INGRESS_MODE=edge` plus `MOB_EDGE_BASE_URL` (or the matching launch arguments) in addition to the existing direct-connect simulator lane; satisfying this AC with only `MOB_API_BASE_URL` or `mobApiBaseUrl` override coverage is not sufficient.
7. Given mobile runtime documentation is reviewed, when Story 0.15 is completed, then `MOB/README.md` and runtime-option docs explicitly distinguish direct-dev mode, edge mode, and physical-device prerequisites.

## Tasks / Subtasks

- [x] Separate mobile runtime modes for direct-dev versus edge validation (AC: 1, 2, 7)
  - [x] Add `MOB_API_INGRESS_MODE` as the canonical ingress selector with allowed values `direct` and `edge`
  - [x] Add `MOB_EDGE_BASE_URL` as the required edge URL input when ingress mode is `edge`
  - [x] Add matching launch arguments `mobApiIngressMode` and `mobEdgeBaseUrl`
  - [x] Preserve existing simulator and emulator defaults when no edge mode is selected
  - [x] Keep `MOB_API_BASE_URL` override as the highest-precedence escape hatch for controlled testing rather than the primary mode selector
- [x] Harden physical-device transport and cookie policy (AC: 2, 3, 7)
  - [x] Detect unsafe plaintext physical-device combinations before auth bootstrap begins
  - [x] Introduce `MOB_ALLOW_INSECURE_DEV_BASE_URL` as the only named dev-only bypass if plaintext LAN testing must remain possible
  - [x] Add matching launch argument `mobAllowInsecureDevBaseUrl` for dev automation only
  - [x] Enforce the same transport-safety checks for `MOB_API_BASE_URL` overrides unless that named dev-only bypass is active
  - [x] Document the supported HTTPS prerequisites for shared QA and physical-device flows
- [x] Verify canonical API parity through edge mode (AC: 4, 5)
  - [x] Exercise auth, order-session, and notification APIs through the edge base URL
  - [x] Confirm notification stream URL generation and reconnect logic still work in edge mode
  - [x] Preserve direct-connect behavior for existing simulator automation
- [x] Expand tests and validation coverage (AC: 1, 2, 3, 6)
  - [x] Update environment and runtime-option unit tests
  - [x] Add or update mobile runtime tests for unsafe physical-device configuration
  - [x] Add at least one scripted edge-mode verification lane or release-readiness check
  - [x] Extend at least one existing live harness (`MOB/tests/e2e/mobile-auth-live.e2e.test.ts`, `MOB/tests/e2e/mobile-order-live.e2e.test.ts`, `MOB/tests/e2e/mobile-mfa-recovery-live.e2e.test.ts`, or `MOB/scripts/run-maestro-auth-suite.sh` with `MOB/e2e/maestro/auth-live/*`) so it exercises `MOB_API_INGRESS_MODE=edge` plus `MOB_EDGE_BASE_URL` rather than validating edge mode only through `MOB_API_BASE_URL`
- [x] Synchronize documentation and implementation records (AC: 6, 7)
  - [x] Update `MOB/README.md`
  - [x] Update story artifacts and references that describe the host matrix and runtime modes

## Dev Notes

### Developer Context Section

- `MOB/src/config/environment.ts` currently resolves:
  - `android-emulator -> http://10.0.2.2:8080`
  - `ios-simulator -> http://localhost:8080`
  - `physical-device -> http://<LAN_IP>:8080`
- `resolveSessionCookiePolicy()` currently treats non-localhost hosts as `sameSite: "None"` and `secure: true`, which conflicts with the current plaintext physical-device URL and is not a safe release baseline.
- `createMobileNetworkRuntime()` bootstraps CSRF directly against the resolved base URL (`GET /api/v1/auth/csrf`) and reuses that base for cookie-session and state-changing APIs.
- FE and MOB already use canonical `/api/v1/auth/*`, `/api/v1/orders/*`, and `/api/v1/notifications/*` paths. Story 0.15 should switch ingress mode, not create a separate mobile-only API surface.
- Story 0.15 depends on Story 12.6. Edge mode should not become the default validation path until canonical edge routing exists.
- Existing reusable live verification candidates already accept caller-supplied base URLs:
  - `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-order-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-mfa-recovery-live.e2e.test.ts`
  - `MOB/scripts/run-maestro-auth-suite.sh` with `MOB/e2e/maestro/auth-live/*`
- Story 0.15 should upgrade at least one of those lanes so edge validation proves the canonical ingress-selector contract, not only a raw `MOB_API_BASE_URL` / `mobApiBaseUrl` escape hatch.
- The canonical ingress selector for this story is `MOB_API_INGRESS_MODE`:
  - `direct` = existing simulator/emulator or dev host-matrix behavior
  - `edge` = resolve `MOB_EDGE_BASE_URL` for ingress validation
  - `MOB_API_BASE_URL` remains a higher-precedence escape hatch for controlled overrides, but it is not the primary mode-selection mechanism and does not bypass transport-safety rules by itself
- The only named plaintext bypass allowed by this story is `MOB_ALLOW_INSECURE_DEV_BASE_URL=true`, and it is development-only.

### Technical Requirements

- Runtime selection should clearly distinguish:
  - direct-dev mode for local simulator/emulator convenience
  - edge mode for shared QA and intended ingress validation
  - physical-device prerequisites for safe session/cookie transport
- `MOB_API_INGRESS_MODE` is the canonical ingress selector for Story 0.15 and should be wired through runtime options and launch arguments before any optional override handling.
- Exact launch-argument names for Story 0.15 are:
  - `mobApiIngressMode` for `MOB_API_INGRESS_MODE`
  - `mobEdgeBaseUrl` for `MOB_EDGE_BASE_URL`
  - `mobAllowInsecureDevBaseUrl` for `MOB_ALLOW_INSECURE_DEV_BASE_URL`
- `MOB_API_BASE_URL` and launch-argument overrides in `MOB/src/config/runtime-options.ts` must remain supported and continue to take precedence over defaults as explicit escape hatches, but they must still pass the same transport-safety validation as any other resolved base URL.
- `MOB_ALLOW_INSECURE_DEV_BASE_URL` is the only approved bypass for plaintext non-localhost URLs and must be ignored outside development runtime or simulator/device QA lanes explicitly marked dev-only.
- Preserve the current deterministic `MOB-CONFIG-001` error for direct physical-device startup when neither `lanIp` nor an explicit override is available.
- Add deterministic fail-fast configuration errors for Story 0.15:
  - `MOB-CONFIG-002` when `MOB_API_INGRESS_MODE=edge` is selected without `MOB_EDGE_BASE_URL`
  - `MOB-CONFIG-003` when edge mode provides a malformed or non-HTTPS `MOB_EDGE_BASE_URL`
  - `MOB-CONFIG-004` when the resolved base URL is a non-localhost plaintext origin that would require `SameSite=None; Secure` and the approved dev-only bypass is not active in an allowed development runtime
- If `MOB_ALLOW_INSECURE_DEV_BASE_URL` is provided outside an allowed development runtime, startup should ignore the bypass and still fail with `MOB-CONFIG-004`.
- When `MOB_API_INGRESS_MODE=edge`, startup must require `MOB_EDGE_BASE_URL` and must fail fast if it is missing, non-HTTPS, or otherwise unsafe.
- The unsafe combination to guard explicitly is a non-localhost plaintext base URL paired with cookie policy that requires `Secure`.
- AC6 should be satisfied by extending one or more of these existing verification lanes:
  - `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-order-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-mfa-recovery-live.e2e.test.ts`
  - `MOB/scripts/run-maestro-auth-suite.sh` with `MOB/e2e/maestro/auth-live/*`
- The chosen edge-validation lane must drive `MOB_API_INGRESS_MODE=edge` plus `MOB_EDGE_BASE_URL` (or `mobApiIngressMode` plus `mobEdgeBaseUrl`) and must not rely solely on `MOB_API_BASE_URL` or `mobApiBaseUrl`.
- Edge-mode parity should cover the currently shipped mobile contract, including:
  - `GET /api/v1/auth/csrf`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/logout`
  - `GET /api/v1/auth/session`
  - `POST /api/v1/orders/sessions`
  - `POST /api/v1/orders/sessions/{orderSessionId}/otp/verify`
  - `POST /api/v1/orders/sessions/{orderSessionId}/extend`
  - `GET /api/v1/orders/sessions/{orderSessionId}`
  - `POST /api/v1/orders/sessions/{orderSessionId}/execute`
  - `GET /api/v1/notifications`
  - `PATCH /api/v1/notifications/{notificationId}/read`
  - `GET /api/v1/notifications/stream`
- Notification stream URL generation must continue to derive from the resolved base URL so edge mode and direct mode share the same downstream notification behavior.
- Do not weaken the existing mobile security contract:
  - no raw session-cookie persistence in app storage
  - no raw CSRF token persistence beyond in-memory transport use
  - no production reliance on plaintext-device shortcuts

### Architecture Compliance

- Preserve Story 0.4 mobile foundation defaults for local development while adding a more explicit ingress-mode contract.
- Keep mobile API usage aligned to canonical backend paths; avoid adding mobile-only endpoint rewrites or aliases.
- Default transition should be staged: add edge mode first, verify it, and only then consider changing defaults in a later reviewed change if desired.
- Do not couple Story 0.15 to unrelated FE or BE runtime changes beyond the Story 12.6 edge dependency.

### File Structure Requirements

- Expected touched areas:
  - `MOB/src/config/environment.ts`
  - `MOB/src/config/runtime-options.ts`
  - `MOB/src/network/create-mobile-network-runtime.ts`
  - `MOB/src/api/notification-api.ts`
  - `MOB/tests/unit/config/environment.test.ts`
  - `MOB/tests/unit/config/runtime-options.test.ts`
  - `MOB/tests/unit/api/notification-api.test.ts`
  - `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-order-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-mfa-recovery-live.e2e.test.ts`
  - `MOB/scripts/run-maestro-auth-suite.sh`
  - `MOB/e2e/maestro/auth-live/*`
  - `MOB/README.md`
  - `_bmad-output/implementation-artifacts/0-15-mobile-edge-parity-and-physical-device-transport-hardening.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Reference inputs:
  - `_bmad-output/implementation-artifacts/0-4-mob-mobile-foundation-scaffold.md`
  - `_bmad-output/implementation-artifacts/12-6-canonical-public-edge-route-enablement.md`
  - `MOB/src/config/environment.ts`
  - `MOB/src/config/runtime-options.ts`
  - `MOB/src/network/create-mobile-network-runtime.ts`
  - `MOB/src/api/order-api.ts`
  - `MOB/src/api/notification-api.ts`
  - `MOB/tests/unit/api/notification-api.test.ts`
  - `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-order-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-mfa-recovery-live.e2e.test.ts`
  - `MOB/scripts/run-maestro-auth-suite.sh`
  - `MOB/e2e/maestro/auth-live/`
  - `MOB/README.md`

### Testing Requirements

- Verify direct-dev defaults remain unchanged for `android-emulator` and `ios-simulator` when no edge mode is configured.
- Verify unsafe plaintext physical-device configuration fails deterministically with `MOB-CONFIG-004` or requires an explicit documented dev-only override.
- Verify `MOB_API_INGRESS_MODE=edge` without `MOB_EDGE_BASE_URL` fails with `MOB-CONFIG-002`, and malformed or non-HTTPS `MOB_EDGE_BASE_URL` fails with `MOB-CONFIG-003`.
- Verify edge-mode base URL resolution, cookie policy, and CSRF bootstrap behavior with automated unit coverage.
- Verify at least one scripted integration or release-readiness path runs mobile auth/order/notification calls against the edge base URL through the ingress selector contract, not only through `MOB_API_BASE_URL` / `mobApiBaseUrl`.
- Verify notification stream URL generation and reconnect behavior remain correct in both direct-dev and edge modes.

### Story Completion Status

- Status set to `done`.
- Completion note: Story 0.15 implementation, QA validation, and review-fix follow-ups are complete, so edge-mode mobile/client parity is now an active prerequisite lane for Story 12.5 promotion evidence.

### References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/epic-0-project-foundation.md`
- `_bmad-output/implementation-artifacts/0-4-mob-mobile-foundation-scaffold.md`
- `_bmad-output/implementation-artifacts/12-6-canonical-public-edge-route-enablement.md`
- `MOB/src/config/environment.ts`
- `MOB/src/config/runtime-options.ts`
- `MOB/src/network/create-mobile-network-runtime.ts`
- `MOB/src/api/order-api.ts`
- `MOB/src/api/notification-api.ts`
- `MOB/tests/unit/config/environment.test.ts`
- `MOB/tests/unit/config/runtime-options.test.ts`
- `MOB/README.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Completion Notes List

- Added Story 0.15 as the Epic 0 follow-on for mobile ingress-mode parity and physical-device transport hardening.
- Captured the current plaintext-LAN plus secure-cookie mismatch so implementation can fail safe instead of preserving an accidental production path.
- Clarified the required edge-validation harness options and deterministic `MOB-CONFIG-002` through `MOB-CONFIG-004` fail-fast contract so implementation can proceed without ambiguity.
- Implemented direct-vs-edge runtime selection, edge base URL validation, and pre-bootstrap transport hardening in the mobile runtime/config path.
- Added deterministic unit coverage for edge resolution, transport-safety failures, and edge-mode CSRF bootstrap, plus updated live harnesses so edge verification can run through `MOB_API_INGRESS_MODE=edge` and `MOB_EDGE_BASE_URL`.
- Remediated review feedback by making boolean launch-arg overrides authoritative for the dev-only plaintext bypass, tightening edge validation to HTTPS origins only, and preventing `LIVE_API_BASE_URL` from masking the canonical edge-mode live harness lane.
- Closed the adversarial follow-up review by sharing ingress parsing between app runtime and live harness code, failing fast on invalid ingress mode / malformed `MOB_LAN_IP` / malformed `MOB_API_BASE_URL`, enabling the direct physical-device live lane, and rejecting override-plus-edge conflicts in the live harness.
- Updated `MOB/README.md` to distinguish direct-dev mode, edge mode, and the dev-only plaintext bypass contract for physical-device workflows.
- Validation: `npm.cmd test -- tests/unit/config/environment.test.ts tests/unit/config/runtime-options.test.ts tests/unit/network/create-mobile-network-runtime.test.ts tests/e2e/live-runtime-config.test.ts tests/e2e/mobile-auth-live.e2e.test.ts tests/e2e/mobile-order-live.e2e.test.ts tests/e2e/mobile-mfa-recovery-live.e2e.test.ts` passed with live suites skipped when env was unset; previous `npm.cmd test -- tests/unit/bootstrap/app-bootstrap.test.ts` validation still stands; `npm.cmd run lint` passed.
- QA follow-up validation restored declared dev dependencies with `npm.cmd ci` and then passed `npm.cmd test` (`309 passed`, `5 skipped` live-env-gated tests), `npm.cmd run typecheck`, and `npm.cmd run lint` in `MOB`.
- Final review-fix validation passed `npm.cmd test -- tests/unit/config/environment.test.ts tests/unit/config/runtime-options.test.ts tests/unit/auth/create-mobile-auth-runtime.test.ts tests/e2e/live-runtime-config.test.ts tests/unit/network/create-mobile-network-runtime.test.ts`, `npm.cmd test` (`319 passed`, `5 skipped` live-env-gated tests), `npm.cmd run typecheck`, and `npm.cmd run lint`.
- Story status advanced to `done` after QA `PASS`, closed adversarial follow-up findings, and final review-fix verification confirmed no remaining blockers.

### File List

- MOB/README.md
- MOB/src/config/environment.ts
- MOB/src/config/runtime-option-parsing.ts
- MOB/src/config/runtime-options.ts
- MOB/src/network/create-mobile-network-runtime.ts
- MOB/tests/e2e/live-runtime-config.ts
- MOB/tests/e2e/live-runtime-config.test.ts
- MOB/tests/e2e/mobile-auth-live.e2e.test.ts
- MOB/tests/e2e/mobile-mfa-recovery-live.e2e.test.ts
- MOB/tests/e2e/mobile-order-live.e2e.test.ts
- MOB/tests/unit/auth/create-mobile-auth-runtime.test.ts
- MOB/tests/unit/bootstrap/app-bootstrap.test.ts
- MOB/tests/unit/config/environment.test.ts
- MOB/tests/unit/config/runtime-options.test.ts
- MOB/tests/unit/network/create-mobile-network-runtime.test.ts
- _bmad-output/implementation-artifacts/0-15-mobile-edge-parity-and-physical-device-transport-hardening.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-03-24: Implemented mobile direct/edge ingress selection, deterministic transport-safety failures, edge-aware live verification helpers, and updated runtime documentation for Story 0.15.
- 2026-03-24: Addressed review feedback for Story 0.15 by fixing launch-arg/env precedence for the plaintext bypass, requiring HTTPS origin-only edge URLs, and locking the live harness so edge mode is not masked by `LIVE_API_BASE_URL`.
- 2026-03-24: Added QA wiring coverage for edge-mode auth/notification runtime construction and re-verified the full MOB test, typecheck, and lint gates after restoring declared dev dependencies.
- 2026-03-24: Promoted Story 0.15 to `done` after the QA `PASS` gate and final review-fix verification closed the remaining readiness blocker for Story 12.5.

## QA Results

### Reviewer

- Quinn (QA Engineer), 2026-03-24

### Gate Decision

- PASS

### Acceptance Criteria Validation

1. AC1 (direct-dev defaults preserved): PASS
   - Evidence: `MOB/tests/unit/config/environment.test.ts` keeps the `android-emulator` and `ios-simulator` host-matrix defaults intact when no edge mode is selected.
2. AC2 (edge selector resolves HTTPS ingress): PASS
   - Evidence: `MOB/tests/unit/config/environment.test.ts`, `MOB/tests/unit/config/runtime-options.test.ts`, and `MOB/tests/e2e/live-runtime-config.test.ts` cover edge selection, required `MOB_EDGE_BASE_URL`, and canonical edge-lane resolution.
3. AC3 (unsafe plaintext transport fails fast unless explicit dev-only bypass is active): PASS
   - Evidence: `MOB/tests/unit/config/environment.test.ts`, `MOB/tests/unit/config/runtime-options.test.ts`, and `MOB/tests/unit/network/create-mobile-network-runtime.test.ts` verify deterministic `MOB-CONFIG-002` through `MOB-CONFIG-004` behavior plus bypass precedence.
4. AC4 (auth/order/notification API parity through edge mode): PASS
   - Evidence: `MOB/tests/unit/network/create-mobile-network-runtime.test.ts` proves edge-mode CSRF bootstrap uses the resolved edge base URL, and `MOB/tests/unit/auth/create-mobile-auth-runtime.test.ts` verifies auth bootstrap plus account/order/notification wiring reuse that same canonical edge base URL.
5. AC5 (notification reconnect/backfill/stream recovery parity): PASS
   - Evidence: `MOB/tests/unit/api/notification-api.test.ts` verifies canonical stream URL derivation from the resolved base URL, and `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx` exercises live notification delivery, reconnect backfill, retry exhaustion guidance, and mark-read rollback behavior.
6. AC6 (automated edge-mode verification lane uses selector contract, not only raw override): PASS
   - Evidence: `MOB/tests/e2e/live-runtime-config.test.ts` verifies `MOB_API_INGRESS_MODE=edge` plus `MOB_EDGE_BASE_URL` drive the live harness lane, `MOB_API_BASE_URL` no longer masks the canonical selector path in edge mode, and `MOB_RUNTIME_TARGET=physical-device` plus `MOB_LAN_IP` exercise the direct physical-device lane without bypassing the shared contract.
7. AC7 (runtime docs distinguish direct, edge, and physical-device prerequisites): PASS
   - Evidence: `MOB/README.md` now documents direct-dev mode, edge mode, explicit overrides, and plaintext-bypass prerequisites separately.

### Executed Verification

- `npm.cmd ci`
- `npm.cmd test -- tests/unit/auth/create-mobile-auth-runtime.test.ts tests/unit/config/environment.test.ts tests/unit/config/runtime-options.test.ts tests/unit/network/create-mobile-network-runtime.test.ts tests/e2e/live-runtime-config.test.ts tests/unit/api/notification-api.test.ts tests/unit/order/AuthenticatedHomeScreen.test.tsx`
- `npm.cmd test`
- `npm.cmd run typecheck`
- `npm.cmd run lint`

### Findings

- None.

### Notes

- `npm.cmd ci` restored the repo-declared `MOB` dev dependencies in the local workspace; no tracked manifest changes were required.
- Live backend suites remain intentionally environment-gated and were skipped without `LIVE_*` / edge-runtime variables.
- Final adversarial review-fix pass closed the remaining Story 0.15 findings without opening new blocking issues.
- QA evidence is also summarized in `_bmad-output/implementation-artifacts/tests/test-summary.md`.
