# DMZ Route and Method Policy

## Status

This is a target-state design document only. No Epic 12-specific DMZ route policy is currently enforced by repository-local runtime assets.

## Scope

This policy defines the intended perimeter contract if Epic 12 implementation resumes.
The active runtime baseline remains Story 0.7.
This document governs the `public-edge` listener only.
Canonical public API paths must preserve the existing product/API contract (`/api/v1/auth/*`, `/api/v1/orders/*`, `/api/v1/notifications*`). Any edge-specific prefix or rewrite must be introduced through an ADR and reflected across PRD, architecture, and channel API specs in the same change.

## Current Story 0.7 Direct Channel-Service Scaffold Surface

The active Story 0.7 channel-service scaffold currently exposes only this subset of direct public controller paths:

- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/orders/sessions`
- `GET /api/v1/orders/sessions`
- `GET /api/v1/notifications/stream`

These direct scaffold routes are baseline behavior, not the canonical Epic 12 hardened contract.
The route matrix below remains the target-state public contract derived from the product/API specifications.

## Current Story 0.7 Edge Alias Surface

The active Story 0.7 `edge-gateway` does not yet expose the canonical product API paths directly.
Instead, channel traffic on the public edge currently uses the legacy alias namespace:

- `/api/v1/channel/*`

Legacy edge alias handling:

- `/api/v1/channel/*` is a baseline-only edge alias, not a canonical product API path.
- Future hardened public-edge policy must remove and deny `/api/v1/channel/*` by default.
- The only allowed exception is a reviewed migration ADR that preserves the alias temporarily and updates PRD, architecture, channel API specs, and release checklist cutoff rules in the same change.
- Internal health/API namespace exceptions that are currently edge-visible remain documented separately under `Internal-Only Namespaces (Public Deny Required)` because Epic 12 hardening must remove them from the public listener.

Current scaffold divergence to reconcile:

- `POST /api/v1/auth/otp/verify` is a scaffold-only public path and must not silently become part of the hardened perimeter contract unless the product/API specs are updated in the same change.
- `GET /api/v1/orders/sessions` is a scaffold-only path shape and must be reconciled with the canonical session-status path contract before hardened edge rules are implemented.
- Public edge currently routes channel traffic through `/api/v1/channel/*` instead of canonical `/api/v1/auth/*`, `/api/v1/orders/*`, and `/api/v1/notifications/*` paths. Hardened mode must remove that alias or carry it forward only through an ADR-backed migration contract.
- Routes present in the canonical matrix but absent from the current scaffold remain part of the intended product contract and must not be treated as "deny by design" without product/API review.

Current Story 0.7 parity inventory against the canonical target contract:

| Canonical target route | Current direct scaffold | Current public-edge baseline | Reconciliation note |
|---|---|---|---|
| `/health/channel` | not a controller route | exposed directly | remains an edge health path |
| `/api/v1/auth/register` | absent | absent | target contract only; not deny-by-design |
| `/api/v1/auth/csrf` | present | absent | current edge does not expose canonical auth namespace |
| `/api/v1/auth/login` | present | absent | current edge does not expose canonical auth namespace |
| `/api/v1/auth/logout` | absent | absent | target contract only; not deny-by-design |
| `/api/v1/auth/session` | absent | absent | target contract only; current scaffold has no parity endpoint |
| `/api/v1/orders/sessions` `POST` | present | absent | current edge does not expose canonical order namespace |
| `/api/v1/orders/sessions/{orderSessionId}/otp` | absent | absent | current scaffold instead exposes `POST /api/v1/auth/otp/verify` |
| `/api/v1/orders/sessions/{orderSessionId}/execute` | absent | absent | target contract only; not deny-by-design |
| `/api/v1/orders/sessions/{orderSessionId}/cancel` | absent | absent | target contract only; not deny-by-design |
| `/api/v1/orders/sessions/{orderSessionId}` `GET` | absent | absent | current scaffold instead exposes query-based `GET /api/v1/orders/sessions` |
| `/api/v1/orders` | absent | absent | target contract only; not deny-by-design |
| `/api/v1/orders/cb-status` | absent | absent | target contract only; not deny-by-design |
| `/api/v1/notifications/stream` | present | alias-only via `/api/v1/channel/notifications/stream` | canonical path missing on edge baseline |
| `/api/v1/notifications` | absent | absent | target contract only; not deny-by-design |

Current Story 0.7 edge alias-to-canonical mapping status:

| Current edge path | Intended canonical target | Mapping status in Story 0.7 |
|---|---|---|
| `/api/v1/channel/notifications/stream` | `/api/v1/notifications/stream` | only route with a concrete intended canonical successor |
| `/api/v1/channel/*` catch-all | none approved | no reviewed route-by-route mapping exists; every descendant other than `/api/v1/channel/notifications/stream` must be treated as unsupported legacy forwarding side effect and removed/denied in hardened mode unless an ADR defines explicit per-route migration rules |

## Public Route and Method Matrix

| Route Prefix | Allowed Methods | Auth Requirement | CSRF Requirement | Notes |
|---|---|---|---|---|
| `/health/channel` | `GET` | none | none | Health probe through edge |
| `/api/v1/auth/register` | `POST` | none | required | Public registration |
| `/api/v1/auth/csrf` | `GET` | none | none | CSRF bootstrap |
| `/api/v1/auth/login` | `POST` | none | required | Public login |
| `/api/v1/auth/logout` | `POST` | authenticated session | required | Authenticated logout |
| `/api/v1/auth/session` | `GET` | authenticated session | none | Session status check |
| `/api/v1/orders/sessions` | `POST` | authenticated session | required | Order session create |
| `/api/v1/orders/sessions/{orderSessionId}/otp` | `POST` | authenticated session | required | OTP verify |
| `/api/v1/orders/sessions/{orderSessionId}/execute` | `POST` | authenticated session | required | Execute order |
| `/api/v1/orders/sessions/{orderSessionId}/cancel` | `POST` | authenticated session | required | Session cancel |
| `/api/v1/orders/sessions/{orderSessionId}` | `GET` | authenticated session | none | Session status polling |
| `/api/v1/orders` | `GET` | authenticated session | none | Order history list |
| `/api/v1/orders/cb-status` | `GET` | authenticated session | none | Circuit-breaker status poll after reconnect |
| `/api/v1/notifications/stream` | `GET` | authenticated session | none | Notification stream |
| `/api/v1/notifications` | `GET` | authenticated session | none | Notification list |

## Canonical URI Matching Rules

Route and method evaluation must use the following normalization rules:

1. Match only against the request path. Scheme, host, and query string are excluded from route selection.
2. Evaluate routes against a canonical path produced by one normalization pass only:
   - reject malformed percent-encoding with `404 EDGE_ROUTE_NOT_ALLOWED`
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
- `/api/v1/fep/gateway/`
- `/api/v1/fep/simulator/`
- `/api/v1/admin/`
- `/ops/dmz/`
- `/_edge/upstream-probe`
- `/internal/`
- `/admin/`

Namespace-prefix interpretation rule:

- Any entry ending with `/` is a denied namespace prefix and applies to the exact token and all descendants after canonical normalization. For example, `/api/v1/admin/` means `/api/v1/admin`, `/api/v1/admin/`, and `/api/v1/admin/**` are all denied with the internal-namespace contract.
- Exact-path entries without a trailing slash (for example `/_edge/upstream-probe`) remain exact-path denies only.

## Explicit Deny Rules

- Internal-only namespace requests return `403 EDGE_INTERNAL_NAMESPACE_DENIED`.
- Unknown paths, malformed encodings, encoded traversal attempts, and encoded slash/backslash variants return `404 EDGE_ROUTE_NOT_ALLOWED`.
- Disallowed methods on allowlisted paths return `404 EDGE_METHOD_NOT_ALLOWED`.
- Every deny response body includes stable error code and `request_id`.
- Internal-only namespace checks are applied after the canonical normalization rules above so encoded variants (for example `%61dmin`) cannot bypass the deny contract.
- Legacy `/api/v1/channel/*` edge aliases are not part of the hardened public allowlist. If a reviewed migration exception is not active, they must be denied on `public-edge` with the same deterministic route-deny contract.

## Abuse Control Thresholds

- Unknown routes: `60 req/min/source_identity` with `burst 20`.
- Sensitive routes (`/api/v1/auth/login`, `/api/v1/orders/sessions`, `/api/v1/orders/sessions/{orderSessionId}/otp`, `/api/v1/orders/sessions/{orderSessionId}/execute`, `/api/v1/orders/sessions/{orderSessionId}/cancel`): `20 req/min/source_identity` with `burst 5`.
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
- Reserved future config names: `EDGE_TRUSTED_PROXY_CIDR_1`, `EDGE_TRUSTED_PROXY_CIDR_2` may be used as the minimum configuration contract if implementation resumes. Future topology may extend beyond two entries, but the owning change must document that extension explicitly.
- Trusted proxy governance: `docs/ops/dmz-trusted-proxies.md`.
- Temporary deny execution contract: `docs/ops/dmz-abuse-response.md`.

## Trusted Client Identity Contract

- If the immediate source IP is not trusted, ignore `X-Forwarded-For` and use normalized `remote_addr`.
- If the immediate source IP is trusted, client identity must be selected using the algorithm in `docs/ops/dmz-trusted-proxies.md`.
- The chosen client identity must be normalized before rate limiting, temporary deny, and audit logging.

## Privileged Operator Surface Policy

- The DMZ operator interface for Story 12.4 is not part of the public route allowlist above.
- Public edge must continue to deny `/api/v1/admin/`, `/ops/dmz/*`, and any equivalent privileged namespace on the `public-edge` listener.
- If a future HTTP operator surface exists, it must be reachable only through a private admin/control-plane path such as `/ops/dmz/*` on the `private-ops` listener, private ingress, VPN-only endpoint, or equivalent non-public surface.
- CLI or automation-based operator flows are allowed only when they authenticate to the same privileged contract defined in `docs/ops/dmz-admin-access.md`.

## Implementation Expectations

- Future runtime implementation must return the documented status codes, stable error codes, and `request_id` fields exactly as written here.
- Future ingress configuration may use Nginx or another edge tier, but it must preserve this public route and deny contract.
- This document is authoritative for Story 12.2 until code is reintroduced.
- Temporary deny responses must also include the normalized client identity or a stable deny-record reference in evidence artifacts.

## Validation Contract

- Every deny/rate-limit response must include request id and stable error code.
- Future DMZ drill governance must include route-method deny, internal-namespace deny, abuse threshold, temporary deny, `trusted-proxy-untrusted-spoof-rejected`, `trusted-proxy-malformed-chain-fallback`, and `trusted-proxy-rightmost-hop-selection` scenarios.
- Planning-only reviews may note `not-implemented` scenarios, but those results must never be treated as release-promotion evidence.
- Ownership, cadence, and promotion-gate rules are defined in `docs/ops/dmz-drill-governance.md`.
