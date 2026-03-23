# DMZ Network Mapping

## Status

This document is a design artifact only. As of 2026-03-07, no Epic 12-specific DMZ runtime profile is shipped in this repository.

## Current Baseline (Active Runtime)

The active runtime baseline remains Story 0.7:

- Network: `fix-net`
- Host-exposed services:
  - `channel-service:8080`
  - `edge-gateway:80/443`
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

- `vault` and `vault-init` are part of the Story 0.7 local baseline only when the `local-vault` profile is enabled.
- `redis-recovery-probe` is present only when the `ops-drills` profile is enabled for recovery/drill work.

Public-ingress note:

- `edge-gateway` is the intended public ingress contract.
- Direct host exposure of `channel-service:8080` exists in the current local/dev baseline and must be treated as a convenience path, not the future hardened perimeter contract.
- The current Story 0.7 edge configuration still contains legacy proxy paths for internal health/API namespaces and a gateway-specific `/api/v1/channel/*` path shape. Epic 12 treats both as baseline exceptions, and the `/api/v1/channel/*` alias must be removed from hardened public ingress unless a reviewed migration ADR carries it temporarily with an explicit cutoff plan.

Current edge-visible baseline paths and exceptions:

This inventory is derived from the active Story 0.7 edge configuration in `docker/nginx/templates/fixyz-edge.conf.template`.

| Current edge-visible path | Current behavior in Story 0.7 baseline | Epic 12 treatment |
|---|---|---|
| `/health/channel` | proxied to `channel-service` health | keep as the reviewed edge-owned health path; do not reclassify as an internal namespace route |
| `/health/corebank` | proxied to `corebank-service` health | remove from public edge in hardened mode |
| `/health/fep-gateway` | proxied to `fep-gateway` health | remove from public edge in hardened mode |
| `/health/fep-simulator` | proxied to `fep-simulator` health | remove from public edge in hardened mode |
| `/api/v1/channel/notifications/stream` | explicit edge alias to channel SSE stream | replace with canonical `/api/v1/notifications/stream` or carry only under an ADR-backed migration exception |
| `/api/v1/channel/*` | legacy gateway-side alias for remaining channel traffic | deny/remove from hardened public ingress by default; only a reviewed migration ADR may carry it temporarily with synchronized spec updates and cutoff date |
| `/api/v1/corebank/*` | proxied to internal CoreBank API namespace | remove from public edge in hardened mode |
| `/api/v1/fep/gateway/*` | proxied to internal FEP Gateway API namespace | remove from public edge in hardened mode |
| `/api/v1/fep/simulator/*` | proxied to internal FEP Simulator API namespace | remove from public edge in hardened mode |
| `/_edge/upstream-probe` | diagnostic probe routed by edge only | keep private or remove from public listener |

## Target DMZ Design

Epic 12 keeps the intended future segmentation model documented even though the runtime assets were removed:

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

- Decision: Epic 12 does not introduce a new canonical lane between edge and channel. The `edge` and `application` review zones intentionally share `external-net`; that is an explicit governance split over one runtime lane, not an undocumented deployment shortcut.
- Decision: Epic 12 intentionally collapses `core-net`, `gateway-net`, and `fep-net` into one `core-private` review zone for review and ownership purposes only. Runtime changes must keep the underlying canonical lanes explicit even when the review package groups them together.

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

When Epic 12 implementation resumes, the new runtime change must use the following runtime-spec contract:

1. Runtime specification type: a repository-owned DMZ deployment overlay reviewed together with the base runtime definition for the same environment.
2. If the local/staging path uses Docker Compose, the repository-owned overlay filename defaults to `docker-compose.dmz.yml`; any non-compose runtime surface requires an ADR in the same change that names the replacement manifest type and ownership boundary.
3. Preserve the current Story 0.7 baseline until the new runtime specification is approved and validated.
4. Document host-exposure changes, service membership, verification evidence, and rollback behavior in the same change as the runtime specification.
5. Include explicit verification steps for:
   - host-exposed surface
   - east-west connectivity
   - private dependency reachability
   - rollback success
6. Use the following rollback triggers for any future DMZ rollout:
   - `channel-service` or any private service is reachable on an unintended direct host port
   - `edge-gateway` cannot reach `channel-service` for approved public routes or `/health/channel`
   - any required private dependency flow (`channel-service` -> `corebank-service`/`mysql`/`redis`/Vault boundary, `corebank-service` -> `fep-gateway`, `fep-gateway` -> `fep-simulator`) fails validation
   - runtime lane attachments do not match the documented review-zone/lane mapping in this file
   - Story 0.13 external-Vault assumptions for non-local environments are missing, stale, or contradicted by the runtime change
7. Rollback action: remove the reviewed DMZ overlay or replacement manifest from deployment, restore the plain Story 0.7 runtime invocation, and confirm the baseline host exposure and edge route inventory match this document again.
8. Include an explicit note if non-local environments use additional platform-specific manifests outside this repository.

## Migration Planning Notes

- Treat this document as the canonical topology design for Story 12.1.
- Story 12.1 must explicitly name the future repository-owned runtime specification. `docker-compose.dmz.yml` is only the default if the reviewed implementation resumes with Docker Compose.
- Any future runtime change must update this document together with the implementation change.
