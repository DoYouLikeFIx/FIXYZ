# Story 12.6: Canonical Public Edge Route Enablement

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform security owner,
I want `edge-gateway` to expose the canonical public channel routes used by clients,
so that web and mobile can validate against the intended hardened ingress instead of relying on legacy `/api/v1/channel/*` aliases or direct `channel-service:8080` access.

**Depends On:** Story 0.7, Story 7.7, Story 12.1, Story 12.2

## Acceptance Criteria

1. Given the public edge receives requests for canonical channel routes, when the request path and method match the Story 12.6 route inventory (`GET /api/v1/auth/csrf`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/session`, `POST /api/v1/auth/logout`, `POST /api/v1/auth/otp/verify`, `POST /api/v1/auth/password/forgot`, `POST /api/v1/auth/password/forgot/challenge`, `POST /api/v1/auth/password/forgot/challenge/fail-closed`, `POST /api/v1/auth/password/reset`, `POST /api/v1/auth/mfa-recovery/rebind`, `POST /api/v1/auth/mfa-recovery/rebind/confirm`, `POST /api/v1/members/me/totp/enroll`, `POST /api/v1/members/me/totp/confirm`, `POST /api/v1/members/me/totp/rebind`, `POST /api/v1/orders/sessions`, `GET /api/v1/orders/sessions/{orderSessionId}`, `POST /api/v1/orders/sessions/{orderSessionId}/otp/verify`, `POST /api/v1/orders/sessions/{orderSessionId}/extend`, `POST /api/v1/orders/sessions/{orderSessionId}/execute`, `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{notificationId}/read`, `GET /api/v1/notifications/stream`), then `edge-gateway` proxies them to `channel-service` while preserving forwarded headers, request IDs, cookie transport, CSRF headers, and current upstream-failure behavior.
2. Given a request targets a Story 12.6 allowlisted path with a method outside the fixed route inventory above, when the edge evaluates the request, then it returns the Story 12.2 deterministic method deny contract (`404 EDGE_METHOD_NOT_ALLOWED`) without forwarding the request upstream.
3. Given a client connects to `/api/v1/notifications/stream` through edge, when the SSE stream is established, then proxy buffering is disabled, long-lived reads are allowed, and reconnect behavior remains compatible with the current notification contract.
4. Given internal-only namespaces remain outside the public perimeter, when a request targets `/api/v1/corebank/*`, `/api/v1/fep/*`, `/_edge/*`, `/internal/*`, or `/admin/*`, then the edge continues to return the documented deterministic deny behavior from Story 12.2.
5. Given the active baseline still exposes `/api/v1/channel/*`, when Story 12.6 is implemented, then the alias migration state is explicit: either canonical routes become primary while the alias is retained temporarily under a documented migration contract, or the alias is denied with synchronized docs/tests and a cutoff plan.
6. Given canonical route parity is implemented, when order-session and MFA paths are reviewed, then edge routing matches the currently shipped controller and client contract, including `/api/v1/orders/sessions/{orderSessionId}/otp/verify` and `/api/v1/members/me/totp/*`, unless a reviewed cross-lane API migration updates BE, FE, MOB, and design docs in the same change.
7. Given edge validation runs, when CI or scripted gateway validation executes, then canonical auth, MFA, order-session, notification-list, notification-read, and notification-stream paths are covered together with deterministic deny behavior for disallowed namespaces and methods.
8. Given DMZ design and runbook artifacts are reviewed, when Story 12.6 is completed, then `docs/ops/dmz-route-policy.md`, `docs/ops/dmz-network-mapping.md`, edge validation scripts, and related implementation records reflect canonical route support and the current alias policy.

## Tasks / Subtasks

- [ ] Freeze the Story 12.6 canonical route inventory and route-parity gaps (AC: 1, 5, 6, 8)
  - [ ] Cross-check `AuthController`, `MemberController`, `OrderSessionController`, `NotificationController`, and `ChannelSecurityPaths`
  - [ ] Cross-check FE and MOB client calls so the edge contract matches shipped runtime usage
  - [ ] Record explicit treatment for any public controller path that falls outside the fixed Story 12.6 route inventory
- [ ] Implement canonical edge routing and method enforcement in Nginx (AC: 1, 2, 3, 4, 6)
  - [ ] Add canonical `/api/v1/auth/*`, `/api/v1/orders/*`, and `/api/v1/notifications/*` locations needed by current BE/FE/MOB flows
  - [ ] Add canonical `/api/v1/members/me/totp/*` locations needed by current FE/MOB MFA flows
  - [ ] Enforce the per-route allowed-method contract at the edge instead of relying on upstream rejection
  - [ ] Preserve SSE-specific proxy behavior for `/api/v1/notifications/stream`
  - [ ] Keep internal namespace denies and `/health/channel` behavior intact
- [ ] Resolve legacy alias migration policy (AC: 5, 8)
  - [ ] Decide whether `/api/v1/channel/*` is denied immediately or retained temporarily with explicit descendant mapping
  - [ ] Remove any unsupported catch-all alias behavior from the hardened contract
- [ ] Expand validation automation and root regression coverage (AC: 2, 3, 4, 7)
  - [ ] Update `docker/nginx/scripts/validate-edge-gateway.sh`
  - [ ] Update `tests/edge-gateway/nginx-baseline.test.js`
  - [ ] Update `tests/edge-gateway/dmz-perimeter-policy.test.js` and any route-inventory assertions affected by the new canonical surface
  - [ ] Add route-by-route allowlisted-method and method-deny regression checks
- [ ] Synchronize DMZ documentation and handoff artifacts (AC: 5, 8)
  - [ ] Update `docs/ops/dmz-route-policy.md`
  - [ ] Update `docs/ops/dmz-network-mapping.md`
  - [ ] Update Epic 12 implementation-artifact index and story references as needed

## Dev Notes

### Developer Context Section

- Unlike Stories 12.1 through 12.5, Story 12.6 is not documentation-only. It is the first Epic 12 follow-on intended to reintroduce reviewed runtime edge behavior on top of the Story 0.7 baseline.
- The current public-edge baseline still forwards channel traffic through `/api/v1/channel/*` in `docker/nginx/templates/fixyz-edge.conf.template`, while FE and MOB already call canonical `/api/v1/auth/*`, `/api/v1/orders/*`, and `/api/v1/notifications/*` paths directly against `channel-service`.
- `docs/ops/dmz-route-policy.md` currently documents a target-state matrix that does not fully match the shipped controller surface. In particular:
  - current BE/FE/MOB order OTP flow uses `/api/v1/orders/sessions/{orderSessionId}/otp/verify`
  - FE and MOB currently use `/api/v1/members/me/totp/enroll`, `/api/v1/members/me/totp/confirm`, and `/api/v1/members/me/totp/rebind` for MFA flows
  - `NotificationController` exposes `GET /api/v1/notifications`, `GET /api/v1/notifications/stream`, and `PATCH /api/v1/notifications/{notificationId}/read`
  - `AuthController` exposes additional public password-recovery and MFA-recovery routes beyond the minimal mobile-login path
- Story 12.6 freezes the minimum canonical edge inventory to the exact routes listed in AC1. Expanding that list requires a reviewed story update or synchronized BE/FE/MOB/API-doc change rather than a silent implementation choice.
- Password-recovery and MFA-recovery routes remain intentionally in scope even though some originating feature stories are still `review`, because current FE and MOB code already depend on those public endpoints. Story 12.6 is preserving the shipped public contract at the edge, not broadening product scope.
- Story 12.6 should use current controller and client reality as the runtime parity source of truth, then update DMZ docs in the same change. It must not silently invent a new edge-only route shape.

### Technical Requirements

- Canonical route enablement must be implemented in `docker/nginx/templates/fixyz-edge.conf.template` and validated by `docker/nginx/scripts/validate-edge-gateway.sh`.
- Canonical edge routing should inventory currently implemented public channel-service endpoints from:
  - `BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/controller/MemberController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/controller/OrderSessionController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java`
- The fixed Story 12.6 route inventory is:
  - `GET /api/v1/auth/csrf`
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `GET /api/v1/auth/session`
  - `POST /api/v1/auth/logout`
  - `POST /api/v1/auth/otp/verify`
  - `POST /api/v1/auth/password/forgot`
  - `POST /api/v1/auth/password/forgot/challenge`
  - `POST /api/v1/auth/password/forgot/challenge/fail-closed`
  - `POST /api/v1/auth/password/reset`
  - `POST /api/v1/auth/mfa-recovery/rebind`
  - `POST /api/v1/auth/mfa-recovery/rebind/confirm`
  - `POST /api/v1/members/me/totp/enroll`
  - `POST /api/v1/members/me/totp/confirm`
  - `POST /api/v1/members/me/totp/rebind`
  - `POST /api/v1/orders/sessions`
  - `GET /api/v1/orders/sessions/{orderSessionId}`
  - `POST /api/v1/orders/sessions/{orderSessionId}/otp/verify`
  - `POST /api/v1/orders/sessions/{orderSessionId}/extend`
  - `POST /api/v1/orders/sessions/{orderSessionId}/execute`
  - `GET /api/v1/notifications`
  - `PATCH /api/v1/notifications/{notificationId}/read`
  - `GET /api/v1/notifications/stream`
- The route inventory must remain aligned with active client usage in:
  - `FE/src/api/authApi.ts`
  - `FE/src/api/orderApi.ts`
  - `FE/src/api/notificationApi.ts`
  - `MOB/src/api/auth-api.ts`
  - `MOB/src/api/order-api.ts`
  - `MOB/src/api/notification-api.ts`
- If implementation needs to proxy an additional canonical public route not listed above, Story 12.6 must be updated first so the route addition is explicit in acceptance criteria, docs, and validation scope.
- The edge implementation must enforce allowlisted methods route-by-route. It is not sufficient to proxy a path and rely on upstream application errors for unsupported methods.
- SSE requirements for `/api/v1/notifications/stream`:
  - `proxy_http_version 1.1`
  - `proxy_buffering off`
  - long `proxy_read_timeout`
  - `Connection` header handling compatible with current stream behavior
- Deterministic deny behavior from Story 12.2 must remain intact for internal namespaces and disallowed methods.
- If legacy `/api/v1/channel/*` alias support is retained temporarily, the implementation must define exact supported descendants rather than keeping an unconstrained catch-all forwarder.
- Story 12.6 should preserve the current upstream failure behavior (`EDGE_UPSTREAM_UNAVAILABLE`) and structured request-id propagation already present in the baseline edge config.

### Architecture Compliance

- Preserve Story 0.7 as the active ingress baseline until this story lands; update runtime and DMZ docs together in the same reviewed change.
- Do not expand public access to private namespaces such as `/api/v1/corebank/*`, `/api/v1/fep/*`, `/_edge/*`, `/internal/*`, or `/admin/*`.
- Keep channel-service controllers as the source of truth for proxied route shapes. Avoid edge-side rewrites that diverge from FE/MOB/BE contracts.
- Keep route-by-route method contracts at the edge aligned to Story 12.2 deterministic deny semantics.
- Story 0.15 depends on this story. Do not assume mobile default-mode changes happen in the same change set.

### File Structure Requirements

- Expected touched areas:
  - `docker/nginx/templates/fixyz-edge.conf.template`
  - `docker/nginx/scripts/validate-edge-gateway.sh`
  - `tests/edge-gateway/nginx-baseline.test.js`
  - `tests/edge-gateway/dmz-perimeter-policy.test.js`
  - `docs/ops/dmz-route-policy.md`
  - `docs/ops/dmz-network-mapping.md`
  - `_bmad-output/implementation-artifacts/12-6-canonical-public-edge-route-enablement.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Reference inputs:
  - `BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/controller/MemberController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/controller/OrderSessionController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java`
  - `BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java`
  - `FE/src/api/authApi.ts`
  - `FE/src/api/orderApi.ts`
  - `FE/src/api/notificationApi.ts`
  - `MOB/src/api/auth-api.ts`
  - `MOB/src/api/order-api.ts`
  - `MOB/src/api/notification-api.ts`

### Testing Requirements

- Verify canonical route locations exist for the current public auth, MFA, order-session, and notification APIs required by FE/MOB/live auth flows.
- Verify the canonical notification SSE location keeps buffering disabled and long-lived reads enabled.
- Verify disallowed methods on allowlisted paths are rejected by the edge with the Story 12.2 method-deny contract instead of being proxied upstream.
- Verify internal namespaces remain denied and the legacy alias policy is explicit and regression-protected.
- Verify `docker/nginx/scripts/validate-edge-gateway.sh` checks canonical routes instead of only the legacy alias surface.
- Verify DMZ documentation and route-policy regressions reflect the new canonical public-edge contract and no longer describe the old state as current once implementation lands.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story 12.6 now defines the runtime re-entry contract for canonical public edge routing and the required parity/docs safeguards.

### References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/epic-12-financial-dmz-boundary-and-perimeter-hardening.md`
- `docs/ops/dmz-route-policy.md`
- `docs/ops/dmz-network-mapping.md`
- `docker/nginx/templates/fixyz-edge.conf.template`
- `docker/nginx/scripts/validate-edge-gateway.sh`
- `tests/edge-gateway/nginx-baseline.test.js`
- `tests/edge-gateway/dmz-perimeter-policy.test.js`
- `BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java`
- `BE/channel-service/src/main/java/com/fix/channel/controller/MemberController.java`
- `BE/channel-service/src/main/java/com/fix/channel/controller/OrderSessionController.java`
- `BE/channel-service/src/main/java/com/fix/channel/controller/NotificationController.java`
- `BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java`
- `FE/src/api/authApi.ts`
- `FE/src/api/orderApi.ts`
- `FE/src/api/notificationApi.ts`
- `MOB/src/api/auth-api.ts`
- `MOB/src/api/order-api.ts`
- `MOB/src/api/notification-api.ts`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Completion Notes List

- Added Story 12.6 as the Epic 12 runtime re-entry story for canonical public edge routing.
- Captured the current route-shape mismatch between the DMZ design docs and shipped BE/FE/MOB contracts so implementation can reconcile them explicitly.

### File List

- _bmad-output/implementation-artifacts/12-6-canonical-public-edge-route-enablement.md
