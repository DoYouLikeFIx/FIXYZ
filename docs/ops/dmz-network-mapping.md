# DMZ Network Mapping

## Status

Story 12.6 updates the public edge route surface, but the full Epic 12 network segmentation overlay is not yet shipped.

## Current Baseline (Active Runtime)

The current runtime topology still inherits the Story 0.7 local/dev baseline:

- Network: `fix-net`
- Host-exposed services:
  - `channel-service:8080`
  - `edge-gateway:80/443`
- Loopback-only operator surfaces:
  - `prometheus:127.0.0.1:9090`
  - `grafana:127.0.0.1:3000`
- Always-on services without direct host port exposure:
  - `corebank-service`
  - `fep-gateway`
  - `fep-simulator`
  - `mysql`
  - `redis`
- Profile-scoped baseline services without direct host port exposure:
  - `vault`
  - `vault-init`
  - `redis-recovery-probe`

Profile notes:

- `vault` and `vault-init` are part of the local baseline only when the `local-vault` profile is enabled.
- `redis-recovery-probe` is present only when the `ops-drills` profile is enabled.
- `prometheus` and `grafana` are present only when the `observability` profile is enabled and remain loopback-bound operator surfaces rather than reviewed public ingress.

Public-ingress note:

- `edge-gateway` is the reviewed public ingress contract.
- Direct host exposure of `channel-service:8080` remains a local/dev convenience path and is not part of the reviewed public ingress contract.
- Canonical `/api/v1/auth/*`, `/api/v1/members/me/totp/*`, `/api/v1/orders/sessions*`, and `/api/v1/notifications*` routes are now available on the public edge.
- Legacy `/api/v1/channel/*` forwarding is denied by default on the public edge unless a reviewed migration contract says otherwise.

## Current Edge-Visible Public Routes

| Public edge route family | Current behavior | Runtime target |
|---|---|---|
| `/health/channel` | only public edge-owned health path | proxied to `channel-service` health |
| `/api/v1/auth/*` | canonical public auth surface | proxied to `channel-service` with route-specific method enforcement |
| `/api/v1/members/me/totp/*` | canonical public MFA surface | proxied to `channel-service` with route-specific method enforcement |
| `/api/v1/orders/sessions*` | canonical public order-session surface | proxied to `channel-service` with route-specific method enforcement |
| `/api/v1/notifications*` | canonical public notification surface | proxied to `channel-service`; SSE remains enabled on `/api/v1/notifications/stream` |

## Current Edge Deny-Only Surface

| Public edge path | Current behavior | Reason |
|---|---|---|
| `/health/corebank` | deterministic public-edge deny | internal-only service probe |
| `/health/fep-gateway` | deterministic public-edge deny | internal-only service probe |
| `/health/fep-simulator` | deterministic public-edge deny | internal-only service probe |
| `/api/v1/channel/*` | deterministic public-edge deny by default | legacy alias; temporary retention requires a reviewed migration contract |
| `/api/v1/corebank/*` | deterministic public-edge deny | internal CoreBank API namespace |
| `/api/v1/fep/*` | deterministic public-edge deny | internal FEP API namespace |
| `/_edge/*` | deterministic public-edge deny | edge-private diagnostics stay non-public |
| `/internal/*` | deterministic public-edge deny | internal operator namespace |
| `/admin/*` | deterministic public-edge deny | privileged namespace |
| `/api/v1/admin/*` | deterministic public-edge deny | versioned privileged namespace |
| `/ops/dmz/*` | deterministic public-edge deny | operator control-plane namespace |

## Target DMZ Design

Epic 12 keeps the intended future segmentation model documented even though the runtime overlay has not shipped yet:

| Review zone | Owner services | Host exposure in hardened mode | Allowed ingress/egress |
|---|---|---|---|
| Edge zone | `edge-gateway` | `80/443` only | External clients -> `edge-gateway`; `edge-gateway` -> `channel-service` |
| Application zone | `channel-service` | None directly on host | `edge-gateway` -> `channel-service`; `channel-service` -> `corebank-service`, `mysql`, `redis`, Vault boundary |
| Core private zone | `corebank-service`, `fep-gateway`, `fep-simulator`, `mysql`, `redis`, `vault`, `vault-init`, `redis-recovery-probe` | None | `channel-service` -> private dependencies; `corebank-service` -> `fep-gateway`; `fep-gateway` -> `fep-simulator`; profile-scoped drill/bootstrap traffic stays private-only |

Service-level allowed flow inventory for the future hardened topology:

| Source | Allowed destination | Purpose | Canonical lane |
|---|---|---|---|
| External clients | `edge-gateway` | Public HTTPS ingress | `external-net` |
| `edge-gateway` | `channel-service` | Public API and `/health/channel` proxying only | `external-net` |
| `channel-service` | `corebank-service` | Internal channel -> core business API calls | `core-net` |
| `channel-service` | `mysql` | Channel persistence | `core-net` |
| `channel-service` | `redis` | Session and cache state | `core-net` |
| `channel-service` | Vault boundary | Secret/bootstrap dependency; local dev may use `vault`, non-local must follow Story 0.13 | `core-net` |
| `corebank-service` | `mysql` | Core banking persistence | `core-net` |
| `corebank-service` | `fep-gateway` | Internal order and market integration calls | `gateway-net` |
| `corebank-service` | Vault boundary | Secret/bootstrap dependency; local dev may use `vault`, non-local must follow Story 0.13 | `core-net` |
| `fep-gateway` | `mysql` | Gateway persistence only if the reviewed runtime keeps shared-MySQL coupling | reviewed private lane attachment must be documented in the runtime change |
| `fep-gateway` | `fep-simulator` | FIX/data-plane and control-plane integration | `fep-net` |
| `fep-gateway` | Vault boundary | Secret/bootstrap dependency if retained by the reviewed runtime; local dev may use `vault`, non-local must follow Story 0.13 | reviewed private lane attachment or platform-specific secret path documented with the runtime change |
| `fep-simulator` | `mysql` | Simulator persistence only if the reviewed runtime keeps direct DB coupling for local/staging support paths | reviewed private lane attachment must be documented in the runtime change |
| `fep-simulator` | Vault boundary | Secret/bootstrap dependency when retained in the reviewed runtime | reviewed private lane attachment or platform-specific secret path documented with the runtime change |
| `vault-init` | `vault` | Local bootstrap only when `local-vault` is enabled | `core-net` |
| `redis-recovery-probe` | `redis` | Recovery drill access only when `ops-drills` is enabled | `core-net` |

## Canonical Lane Reconciliation

Epic 12 uses three review zones, but the architecture document still uses four canonical lanes.
The relationship must stay explicit:

- The `edge` and `application` review zones intentionally share `external-net`; this is a governance split over one runtime lane, not an undocumented shortcut.
- Epic 12 intentionally collapses `core-net`, `gateway-net`, and `fep-net` into one `core-private` review zone for review and ownership only.

| Epic 12 Review Zone | Canonical Architecture Lane Mapping | Notes |
|---|---|---|
| Edge zone | `external-net` | `edge-gateway` owns the public 80/443 contract in hardened mode |
| Application zone | `external-net` and `core-net` | `channel-service` terminates the downstream side of `external-net` and the upstream side of `core-net` |
| Core private zone | `core-net`, `gateway-net`, and `fep-net` | `corebank-service`, `fep-gateway`, `fep-simulator`, `mysql`, `redis`, and profile-scoped Vault/drill services stay on internal lanes only |

Service-to-zone and lane mapping reference:

| Service | Review zone | Canonical lane attachment | Notes |
|---|---|---|---|
| `edge-gateway` | `edge` | `external-net` | Public ingress owner |
| `channel-service` | `application` | `external-net`, `core-net` | Direct host exposure removed in hardened mode |
| `corebank-service` | `core-private` | `core-net`, `gateway-net` | Internal-only service |
| `fep-gateway` | `core-private` | `gateway-net`, `fep-net` | Internal-only service |
| `fep-simulator` | `core-private` | `fep-net` | Internal-only service |
| `mysql` | `core-private` | `core-net` by default | Shared private dependency; any extra lane attachment must be explicitly reviewed and documented |
| `redis` | `core-private` | `core-net` | Shared private dependency |
| `vault` | `core-private` | `core-net` by default | Local-only when `local-vault` profile is enabled; non-local Vault boundaries must follow Story 0.13 |
| `vault-init` | `core-private` | `core-net` | Local bootstrap only when `local-vault` profile is enabled |
| `redis-recovery-probe` | `core-private` | `core-net` | Drill/recovery utility only when `ops-drills` profile is enabled |

Non-local Vault note:

- Story 0.13 remains authoritative for external/non-local Vault boundaries.
- If future DMZ implementation targets staging/prod, the network plan must show how the external Vault boundary replaces local `vault` and `vault-init` assumptions.

## Future Implementation Requirements

When the runtime overlay is introduced, the reviewed change must:

1. Use a repository-owned DMZ deployment overlay reviewed together with the base runtime definition for the same environment.
2. Default to `docker-compose.dmz.yml` only if the reviewed implementation resumes with Docker Compose; any non-compose runtime surface requires an ADR in the same change.
3. Preserve the current Story 0.7 topology until the new runtime specification is approved and validated.
4. Document host-exposure changes, service membership, verification evidence, and rollback behavior in the same change as the runtime specification.
5. Include explicit verification steps for host-exposed surface, east-west connectivity, private dependency reachability, and rollback success.
6. Use the following rollback triggers for any future DMZ rollout:
   - `channel-service` or any private service is reachable on an unintended direct host port
   - `edge-gateway` cannot reach `channel-service` for approved public routes or `/health/channel`
   - any required private dependency flow (`channel-service` -> `corebank-service`/`mysql`/`redis`/Vault boundary, `corebank-service` -> `fep-gateway`, `fep-gateway` -> `fep-simulator`) fails validation
   - runtime lane attachments do not match the documented review-zone/lane mapping in this file
   - Story 0.13 external-Vault assumptions for non-local environments are missing, stale, or contradicted by the runtime change
7. Rollback action: remove the reviewed DMZ overlay or replacement manifest from deployment, restore the plain Story 0.7 runtime invocation, and confirm the baseline host exposure and edge route inventory match this document again.
8. Include an explicit note if non-local environments use additional platform-specific manifests outside this repository.

## Migration Planning Notes

- Treat this document as the canonical topology design for Story 12.1 and the current topology reference for Story 12.6.
- Any future runtime change must update this document together with the implementation change.
