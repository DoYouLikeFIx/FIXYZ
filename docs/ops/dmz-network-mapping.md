# DMZ Network Mapping

## Purpose

Map current default topology and DMZ profile topology without ambiguity.

## Default Profile (`docker-compose.yml`)

- Network: `fix-net`
- Host-exposed:
  - `channel-service:8080`
  - `edge-gateway:80/443`
- Internal-only:
  - `corebank-service`
  - `fep-gateway`
  - `fep-simulator`

## DMZ Profile (`docker-compose.dmz.yml`)

Logical zones are mapped to architecture lanes:

| DMZ Logical Zone | Runtime Network | Architecture Lane Mapping |
|---|---|---|
| Edge zone | `dmz-edge-net` | `external-net` |
| Application zone | `dmz-app-net` | `core-net` |
| Core private zone | `core-private-net` | `gateway-net` + `fep-net` |

Implementation notes:

- `docker-compose.dmz.yml` uses Compose merge tags to enforce DMZ isolation:
  - `ports: !reset []` for `channel-service`
  - `networks: !override [...]` for DMZ-scoped services to drop inherited `fix-net`
- Internal dependencies (`mysql`, `redis`, `vault`, `vault-init`, `redis-recovery-probe`) are moved to `core-private-net` so channel/core/fep services retain private connectivity without host exposure.

## Migration Steps

1. Keep default profile unchanged for baseline compatibility.
2. Enable DMZ overlay with `docker compose -f docker-compose.yml -f docker-compose.dmz.yml up -d`.
3. Validate host exposure change: only edge publishes `80/443`, internal services no host ports.
4. Validate network isolation: `channel-service`, `corebank-service`, `fep-gateway`, `fep-simulator`, `edge-gateway` are not attached to `fix-net`.
5. Validate private dependency reachability: `channel-service` and `corebank-service` can resolve and connect to `mysql`, `redis`, and `vault` on `core-private-net`.
6. Validate route policy and drill evidence before promotion.
7. Rollback by removing DMZ overlay file from compose invocation.
