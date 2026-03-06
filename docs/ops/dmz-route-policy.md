# DMZ Route and Method Policy

## Scope

This policy applies to the DMZ deployment profile and extends the edge baseline in Story 0.7.
Default profile behavior remains unchanged during migration.

## Public Route and Method Matrix

| Route Prefix | Allowed Methods | Notes |
|---|---|---|
| `/health/channel` | `GET` | Health probe through edge |
| `/api/v1/channel/auth/register` | `POST` | Public registration |
| `/api/v1/channel/auth/csrf` | `GET` | CSRF bootstrap |
| `/api/v1/channel/auth/login` | `POST` | Public login |
| `/api/v1/channel/auth/logout` | `POST` | Authenticated logout |
| `/api/v1/channel/auth/session` | `GET` | Session status check |
| `/api/v1/channel/orders/sessions` | `POST` | Order session create |
| `/api/v1/channel/orders/sessions/{orderSessionId}/otp` | `POST` | OTP verify |
| `/api/v1/channel/orders/sessions/{orderSessionId}/execute` | `POST` | Execute order |
| `/api/v1/channel/orders/sessions/{orderSessionId}/cancel` | `POST` | Session cancel |
| `/api/v1/channel/orders/sessions/{orderSessionId}` | `GET` | Session status polling |
| `/api/v1/channel/orders` | `GET` | Order history list |
| `/api/v1/channel/notifications/stream` | `GET` | Notification stream |
| `/api/v1/channel/notifications` | `GET` | Notification list |

## Internal-Only Namespaces (Public Deny Required)

- `/health/corebank`
- `/health/fep-gateway`
- `/health/fep-simulator`
- `/api/v1/corebank/`
- `/api/v1/fep/gateway/`
- `/api/v1/fep/simulator/`
- `/api/v1/admin/`
- `/_edge/upstream-probe`
- `^/(internal|admin)/`

## Explicit Deny Rules

- Return `403` for any request to internal-only namespaces.
- Return `404` for unknown paths that are not in the allowlist.
- Return `404` for disallowed methods on allowlisted paths.
- Every deny response body includes stable error code and `request_id`.

## Abuse Control Thresholds

- Unknown routes: `60 req/min/IP` with `burst 20`.
- Sensitive routes (`/api/v1/channel/auth/login`, `/api/v1/channel/orders/sessions`, `/api/v1/channel/orders/sessions/{orderSessionId}/otp`, `/api/v1/channel/orders/sessions/{orderSessionId}/execute`, `/api/v1/channel/orders/sessions/{orderSessionId}/cancel`): `20 req/min/IP` with `burst 5`.
- Temporary deny window: apply 10-minute block when the same IP triggers 5 or more rate-limit violations within 5 minutes.
- Temporary deny response contract: `403` with stable error code `EDGE_DMZ_TEMP_DENY` and `request_id`.
- Limiter key policy: use `X-Forwarded-For` only when source proxy IP is trusted; otherwise use `remote_addr`.
- Rate-limit response contract: `429`, `Retry-After: 60`, stable error code `EDGE_RATE_LIMITED`, and `request_id`.
- Trusted proxy source of truth: `EDGE_TRUSTED_PROXY_CIDR_1`, `EDGE_TRUSTED_PROXY_CIDR_2` in `docker-compose.dmz.yml` (safe defaults: `127.0.0.1/32`, `::1/128`).
- Trusted proxy governance: `docs/ops/dmz-trusted-proxies.md`.
- Temporary deny execution contract: `docs/ops/dmz-abuse-response.md`.
- Runtime denylist execution path: `/usr/local/bin/dmz-temp-denylist.sh`.

## Validation Contract

- Every deny/rate-limit response must include request id and stable error code.
- Weekly DMZ drill must include route-method deny, internal-namespace deny, and abuse threshold scenarios.
- Weekly DMZ drill also reports `stale-secret-rejection` and `admin-credential-ttl-expiry`; these are tracked as `pending` while Story 12.3/12.4 stay `backlog` unless `DMZ_ENFORCE_TRUST_SCENARIOS=true`.
- Weekly drill owner and scheduler are defined in `.github/workflows/dmz-security-drill.yml` (`SEC`).
