# DMZ Network Mapping

## Status

This document is a design artifact only. As of 2026-03-07, no Epic 12-specific DMZ runtime profile is shipped in this repository.

## Current Baseline (Active Runtime)

The active runtime baseline remains Story 0.7:

- Network: `fix-net`
- Host-exposed services:
  - `channel-service:8080`
  - `edge-gateway:80/443`
- Services without direct host port exposure:
  - `corebank-service`
  - `fep-gateway`
  - `fep-simulator`
  - `mysql`
  - `redis`
  - `vault`
  - `vault-init`
  - `redis-recovery-probe`

Public-ingress note:

- `edge-gateway` is the intended public ingress contract.
- Direct host exposure of `channel-service:8080` exists in the current local/dev baseline and must be treated as a convenience path, not the future hardened perimeter contract.
- The current Story 0.7 edge configuration still contains legacy proxy paths for internal health/API namespaces and a gateway-specific `/api/v1/channel/*` path shape. Epic 12 treats both as baseline exceptions, and the `/api/v1/channel/*` alias must be removed from hardened public ingress unless a reviewed migration ADR carries it temporarily with an explicit cutoff plan.

Current edge-visible baseline exceptions:

This inventory is derived from the active Story 0.7 edge configuration in `docker/nginx/templates/fixyz-edge.conf.template`.

| Current edge-visible path | Current behavior in Story 0.7 baseline | Epic 12 treatment |
|---|---|---|
| `/health/corebank` | proxied to `corebank-service` health | remove from public edge in hardened mode |
| `/health/fep-gateway` | proxied to `fep-gateway` health | remove from public edge in hardened mode |
| `/health/fep-simulator` | proxied to `fep-simulator` health | remove from public edge in hardened mode |
| `/api/v1/corebank/*` | proxied to internal CoreBank API namespace | remove from public edge in hardened mode |
| `/api/v1/fep/gateway/*` | proxied to internal FEP Gateway API namespace | remove from public edge in hardened mode |
| `/api/v1/fep/simulator/*` | proxied to internal FEP Simulator API namespace | remove from public edge in hardened mode |
| `/_edge/upstream-probe` | diagnostic probe routed by edge only | keep private or remove from public listener |
| `/api/v1/channel/*` | gateway-specific alias path shape for channel traffic | deny/remove from hardened public ingress by default; only a reviewed migration ADR may carry it temporarily with synchronized spec updates and cutoff date |

## Target DMZ Design

Epic 12 keeps the intended future segmentation model documented even though the runtime assets were removed:

| Zone | Intended Owner | Public Exposure | Allowed Upstream/Downstream |
|---|---|---|---|
| Edge zone | `edge-gateway` or successor ingress tier | `80/443` only | External clients -> edge; edge -> application zone |
| Application zone | `channel-service` | None directly on host in DMZ mode | Edge -> channel; channel -> core private dependencies |
| Core private zone | `corebank-service`, `fep-gateway`, `fep-simulator`, stateful dependencies, Vault services | None | Channel -> private services; service-to-service east-west traffic only |

## Canonical Lane Reconciliation

Epic 12 uses three review zones, but the architecture document still uses four canonical lanes.
The relationship must stay explicit:

| Epic 12 Review Zone | Canonical Architecture Lane Mapping | Notes |
|---|---|---|
| Edge zone | `external-net` | `edge-gateway` owns the public 80/443 contract in hardened mode |
| Application zone | `external-net` and `core-net` | `channel-service` terminates the downstream side of `external-net` and the upstream side of `core-net` |
| Core private zone | `core-net`, `gateway-net`, and `fep-net` | `corebank-service`, `fep-gateway`, `fep-simulator`, and local stateful dependencies stay on internal lanes only |

Non-local Vault note:

- Story 0.13 remains authoritative for external/non-local Vault boundaries.
- If future DMZ implementation targets staging/prod, the network plan must show how the external Vault boundary replaces local `vault` and `vault-init` assumptions.

## Future Implementation Requirements

When Epic 12 implementation resumes, the new runtime change must:

1. Reintroduce a repository-owned DMZ runtime specification in this repository.
2. If the local/staging path uses Docker Compose, the default filename is `docker-compose.dmz.yml`; any non-compose runtime surface requires an ADR in the same change.
3. Preserve the current Story 0.7 baseline until the new runtime specification is approved and validated.
4. Document host-exposure changes, service membership, and rollback triggers in the same change as the runtime specification.
5. Include explicit verification steps for:
   - host-exposed surface
   - east-west connectivity
   - private dependency reachability
   - rollback success
6. Include an explicit note if non-local environments use additional platform-specific manifests outside this repository.

## Migration Planning Notes

- Treat this document as the canonical topology design for Story 12.1.
- Story 12.1 must explicitly name the future repository-owned runtime specification. `docker-compose.dmz.yml` is only the default if the reviewed implementation resumes with Docker Compose.
- Any future runtime change must update this document together with the implementation change.
