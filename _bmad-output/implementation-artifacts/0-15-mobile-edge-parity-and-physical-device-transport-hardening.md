# Story 0.15: Mobile Edge Parity and Physical-Device Transport Hardening

Status: ready-for-dev

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
6. Given mobile verification runs, when CI or release-readiness validation executes, then at least one automated lane or scripted verification path covers edge mode in addition to the existing direct-connect simulator lane.
7. Given mobile runtime documentation is reviewed, when Story 0.15 is completed, then `MOB/README.md` and runtime-option docs explicitly distinguish direct-dev mode, edge mode, and physical-device prerequisites.

## Tasks / Subtasks

- [ ] Separate mobile runtime modes for direct-dev versus edge validation (AC: 1, 2, 7)
  - [ ] Add `MOB_API_INGRESS_MODE` as the canonical ingress selector with allowed values `direct` and `edge`
  - [ ] Add `MOB_EDGE_BASE_URL` as the required edge URL input when ingress mode is `edge`
  - [ ] Add matching launch arguments `mobApiIngressMode` and `mobEdgeBaseUrl`
  - [ ] Preserve existing simulator and emulator defaults when no edge mode is selected
  - [ ] Keep `MOB_API_BASE_URL` override as the highest-precedence escape hatch for controlled testing rather than the primary mode selector
- [ ] Harden physical-device transport and cookie policy (AC: 2, 3, 7)
  - [ ] Detect unsafe plaintext physical-device combinations before auth bootstrap begins
  - [ ] Introduce `MOB_ALLOW_INSECURE_DEV_BASE_URL` as the only named dev-only bypass if plaintext LAN testing must remain possible
  - [ ] Add matching launch argument `mobAllowInsecureDevBaseUrl` for dev automation only
  - [ ] Enforce the same transport-safety checks for `MOB_API_BASE_URL` overrides unless that named dev-only bypass is active
  - [ ] Document the supported HTTPS prerequisites for shared QA and physical-device flows
- [ ] Verify canonical API parity through edge mode (AC: 4, 5)
  - [ ] Exercise auth, order-session, and notification APIs through the edge base URL
  - [ ] Confirm notification stream URL generation and reconnect logic still work in edge mode
  - [ ] Preserve direct-connect behavior for existing simulator automation
- [ ] Expand tests and validation coverage (AC: 1, 2, 3, 6)
  - [ ] Update environment and runtime-option unit tests
  - [ ] Add or update mobile runtime tests for unsafe physical-device configuration
  - [ ] Add at least one scripted edge-mode verification lane or release-readiness check
- [ ] Synchronize documentation and implementation records (AC: 6, 7)
  - [ ] Update `MOB/README.md`
  - [ ] Update story artifacts and references that describe the host matrix and runtime modes

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
- When `MOB_API_INGRESS_MODE=edge`, startup must require `MOB_EDGE_BASE_URL` and must fail fast if it is missing, non-HTTPS, or otherwise unsafe.
- The unsafe combination to guard explicitly is a non-localhost plaintext base URL paired with cookie policy that requires `Secure`.
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
  - `MOB/README.md`

### Testing Requirements

- Verify direct-dev defaults remain unchanged for `android-emulator` and `ios-simulator` when no edge mode is configured.
- Verify unsafe plaintext physical-device configuration fails deterministically or requires an explicit documented dev-only override.
- Verify edge-mode base URL resolution, cookie policy, and CSRF bootstrap behavior with automated unit coverage.
- Verify at least one scripted integration or release-readiness path runs mobile auth/order/notification calls against the edge base URL.
- Verify notification stream URL generation and reconnect behavior remain correct in both direct-dev and edge modes.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story 0.15 now defines the mobile runtime split between direct-dev convenience and safe edge-first validation, and implementation is unblocked because canonical public edge routing from Story 12.6 is now complete.

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

### File List

- _bmad-output/implementation-artifacts/0-15-mobile-edge-parity-and-physical-device-transport-hardening.md
