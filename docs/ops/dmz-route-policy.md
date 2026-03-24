# DMZ Route Policy

## Status

Story 12.6 activates the canonical public-edge route contract in the current `edge-gateway` runtime.
Local/dev host exposure from Story 0.7 still exists for convenience, but that path is outside the reviewed public ingress contract.
`/health/channel` is the only public edge-owned health path.
The active runtime scope today is limited to the allowlisted route surface, deterministic method deny, internal-namespace deny, `request_id` propagation in edge-generated responses, and upstream-failure handling.
The normalization, trusted-proxy, rate-limit, and temporary-deny controls documented below remain planned hardening requirements and are not yet enforced by the shipped edge configuration.

## Active Public Edge Allowlist

| Route Prefix | Allowed Methods | Auth Requirement | CSRF Requirement | Notes |
|---|---|---|---|---|
| `/health/channel` | `GET` | none | none | Public edge health probe |
| `/api/v1/auth/csrf` | `GET` | none | none | CSRF bootstrap |
| `/api/v1/auth/register` | `POST` | none | required | Public registration |
| `/api/v1/auth/login` | `POST` | none | required | Public login |
| `/api/v1/auth/session` | `GET` | authenticated session | none | Session status check |
| `/api/v1/auth/logout` | `POST` | authenticated session | required | Authenticated logout |
| `/api/v1/auth/otp/verify` | `POST` | none | required | Login OTP verify |
| `/api/v1/auth/password/forgot` | `POST` | none | required | Password recovery start |
| `/api/v1/auth/password/forgot/challenge` | `POST` | none | required | Password recovery challenge bootstrap |
| `/api/v1/auth/password/forgot/challenge/fail-closed` | `POST` | none | required | Client fail-closed telemetry |
| `/api/v1/auth/password/reset` | `POST` | none | required | Password reset continuation |
| `/api/v1/auth/mfa-recovery/rebind` | `POST` | none | required | Recovery TOTP rebind bootstrap |
| `/api/v1/auth/mfa-recovery/rebind/confirm` | `POST` | none | required | Recovery TOTP rebind confirm |
| `/api/v1/members/me/totp/enroll` | `POST` | authenticated session | required | Authenticated TOTP enroll |
| `/api/v1/members/me/totp/confirm` | `POST` | authenticated session | required | Authenticated TOTP confirm |
| `/api/v1/members/me/totp/rebind` | `POST` | authenticated session | required | Authenticated TOTP rebind bootstrap |
| `/api/v1/orders/sessions` | `POST` | authenticated session | required | Order session create |
| `/api/v1/orders/sessions/{orderSessionId}` | `GET` | authenticated session | none | Order session status |
| `/api/v1/orders/sessions/{orderSessionId}/otp/verify` | `POST` | authenticated session | required | Order session OTP verify |
| `/api/v1/orders/sessions/{orderSessionId}/extend` | `POST` | authenticated session | required | Order session extend |
| `/api/v1/orders/sessions/{orderSessionId}/execute` | `POST` | authenticated session | required | Execute order |
| `/api/v1/notifications` | `GET` | authenticated session | none | Notification list |
| `/api/v1/notifications/{notificationId}/read` | `PATCH` | authenticated session | required | Notification read |
| `/api/v1/notifications/stream` | `GET` | authenticated session | none | Notification stream |

## Legacy Alias Migration Policy

- Legacy `/api/v1/channel/*` edge aliases are not part of the active allowlist.
- If a reviewed migration exception is not active, `/api/v1/channel/*` returns `404 EDGE_ROUTE_NOT_ALLOWED` on `public-edge`.
- Temporary retention requires a reviewed migration contract with exact descendant mappings, synchronized docs/tests, and a cutoff plan.

## Planned Hardening Controls (Not Yet Enforced in Runtime)

The remaining sections capture Story 12.2/12.4 design requirements for later hardening work.
They are not active runtime guarantees in the shipped Story 12.6 edge configuration.

## Canonical URI Matching Rules

When the later hardening controls are implemented, route and method evaluation must use the following normalization rules:

1. Match only against the request path. Scheme, host, and query string are excluded from route selection.
2. Evaluate routes against a canonical path produced by one normalization pass only:
   - malformed percent-encoding is rejected by the current Nginx parser with native `400 Bad Request`; a later normalization hardening pass may replace that with a deterministic FIXYZ error payload if explicitly implemented
   - percent-decode unreserved characters exactly once before route matching
   - double-decoding is prohibited
3. Route matching is case-sensitive after the single decoding pass above.
4. Duplicate slashes are collapsed before evaluation (`//api///v1` -> `/api/v1`).
5. Dot-segment traversal (`/.`, `/..`, encoded dot segments) is rejected before allowlist evaluation with `404 EDGE_ROUTE_NOT_ALLOWED`.
6. Encoded slash or backslash characters (`%2F`, `%5C`, case-insensitive) are rejected before allowlist evaluation with `404 EDGE_ROUTE_NOT_ALLOWED`.
7. A trailing slash is distinct unless the route is explicitly documented with a trailing slash.

## Internal-Only Namespaces (Public Deny Required)

- `/health/corebank`
- `/health/fep-gateway`
- `/health/fep-simulator`
- `/api/v1/corebank/`
- `/api/v1/fep/`
- `/_edge/`
- `/internal/`
- `/admin/`
- `/api/v1/admin/`
- `/ops/dmz/`

Namespace-prefix interpretation rule:

- Any entry ending with `/` is a denied namespace prefix and applies to the exact token and all descendants after canonical normalization.
- Exact-path service health probes remain denied public-edge paths even though they are not namespace prefixes.

## Explicit Deny Rules

- Internal-only namespace requests return `403 EDGE_INTERNAL_NAMESPACE_DENIED`.
- Legacy `/api/v1/channel/*` requests return `404 EDGE_ROUTE_NOT_ALLOWED` unless a reviewed migration exception is active.
- Unknown paths, encoded traversal attempts, and encoded slash/backslash variants return `404 EDGE_ROUTE_NOT_ALLOWED`.
- Malformed percent-encoding currently returns the native Nginx `400 Bad Request` response before the FIXYZ route contract is reached.
- Disallowed methods on allowlisted paths return `404 EDGE_METHOD_NOT_ALLOWED`.
- `HEAD` is not implicitly allowed by a `GET` entry on the `public-edge` contract.
- `OPTIONS` is not implicitly allowed on allowlisted paths.
- Every deny response body includes stable error code and `request_id`.
- Internal-only namespace checks are applied after the canonical normalization rules above so encoded variants cannot bypass the deny contract.

## Abuse Control Thresholds

These thresholds and temporary-deny behaviors are planned controls only; the current edge template does not yet enforce them.

- Unknown routes: `60 req/min/source_identity` with `burst 20`.
- Sensitive routes (`/api/v1/auth/login`, `/api/v1/orders/sessions`, `/api/v1/orders/sessions/{orderSessionId}/otp/verify`, `/api/v1/orders/sessions/{orderSessionId}/execute`): `20 req/min/source_identity` with `burst 5`.
- Temporary deny window: apply 10-minute block when the same normalized `source_identity` triggers 5 or more rate-limit violations within 5 minutes.
- Temporary deny response contract: `403`, stable error code `EDGE_DMZ_TEMP_DENY`, `request_id`, and `Retry-After` equal to the remaining deny TTL in seconds.
- Limiter key policy: use `X-Forwarded-For` only when source proxy IP is trusted; otherwise use `remote_addr`.
- Rate-limit response contract: `429`, `Retry-After: 60`, stable error code `EDGE_RATE_LIMITED`, and `request_id`.
- Perimeter limits are pre-auth edge guardrails and do not replace stricter application/session/user-level limits defined in the product contract.
- Evaluation order for allowlisted business traffic is:
  1. canonical path and namespace validation at edge
  2. edge source-identity-based perimeter limit or temporary deny
  3. upstream application limit keyed by session, user, or business object
- Evidence for abuse scenarios must record `enforcement_layer` (`edge` or `application`) and `limit_key_type` (`source_identity`, `user_id`, `session_id`, or `order_session_id`) so perimeter and application throttles cannot be conflated.
- Edge-generated deny/rate-limit decisions must be written to structured logs or evidence records with `enforcement_layer`, `limit_key_type`, `request_id`, and `source_identity` so the rejecting layer is testable without inferring from prose.
- Reserved future config names: `EDGE_TRUSTED_PROXY_CIDR_1`, `EDGE_TRUSTED_PROXY_CIDR_2` may be used as the minimum configuration contract if implementation resumes.
- Trusted proxy governance: `docs/ops/dmz-trusted-proxies.md`.
- Temporary deny execution contract: `docs/ops/dmz-abuse-response.md`.

## Trusted Client Identity Contract

This trusted-proxy identity contract remains a planned requirement until the edge runtime adds explicit trusted-proxy handling.

- If the immediate source IP is not trusted, ignore `X-Forwarded-For` and use normalized `remote_addr`.
- If the immediate source IP is trusted, client identity must be selected using the algorithm in `docs/ops/dmz-trusted-proxies.md`.
- The chosen client identity must be normalized before rate limiting, temporary deny, and audit logging.

## Privileged Operator Surface Policy

- The DMZ operator interface for Story 12.4 is not part of the public route allowlist above.
- Public edge must continue to deny `/api/v1/admin/`, `/ops/dmz/*`, and any equivalent privileged namespace on the `public-edge` listener.
- If a future HTTP operator surface exists, it must be reachable only through a private admin/control-plane path such as `/ops/dmz/*` on the `private-ops` listener, private ingress, VPN-only endpoint, or equivalent non-public surface.
- CLI or automation-based operator flows are allowed only when they authenticate to the same privileged contract defined in `docs/ops/dmz-admin-access.md`.

## Runtime Expectations

- `edge-gateway` must proxy only the allowlisted routes above to `channel-service`.
- The edge must preserve forwarded headers, cookies, CSRF transport, and `X-Request-Id` propagation.
- `/api/v1/notifications/stream` keeps SSE-specific behavior: `proxy_http_version 1.1`, `proxy_buffering off`, long `proxy_read_timeout`, and `Connection` header handling compatible with the current stream contract.
- Internal service health probes must stay denied on `public-edge`.
- Upstream transport failures continue to return `503 EDGE_UPSTREAM_UNAVAILABLE`.

## Validation Contract

- Validate route presence, deny behavior, TLS/security headers, SSE settings, and upstream-failure handling with `docker/nginx/scripts/validate-edge-gateway.sh`.
- Validate cookie-session bootstrap, CSRF header transport, allowlisted proxy-header directives, and runtime deny behavior for the full public/internal namespace split with `docker/nginx/scripts/validate-edge-gateway.sh`.
- Root regression coverage lives in `tests/edge-gateway/*.test.js`.
