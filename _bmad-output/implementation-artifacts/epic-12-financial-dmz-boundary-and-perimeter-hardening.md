# Epic 12: Financial DMZ Boundary and Perimeter Hardening

> Supplemental index artifact for Epic 12. Canonical story and acceptance-criteria authority is `_bmad-output/planning-artifacts/epics.md` only.

## Purpose

This file exists to track Epic 12 scope, priority policy, references, and implementation handoff pointers without duplicating canonical AC text.

## Canonical Source

- Epic summary and story hints: `_bmad-output/planning-artifacts/epics.md` (Epic 12 section)
- Detailed stories and ACs: `_bmad-output/planning-artifacts/epics.md` (Detailed Epics & Stories -> Epic 12)

## Priority and Scope Controls

- Default priority: Medium
- Low-priority fallback requires explicit risk acceptance record: `docs/ops/risk-acceptance/<YYYYMMDD>-epic12.md`
- Story 0.7 remains baseline owner for TLS termination, base security headers, and baseline edge routing.
- Epic 12 adds DMZ hardening and operations controls on top of that baseline.

## Story Routing

- Story definitions and ACs are intentionally not duplicated here.
- Use `epics.md` as the only source for Story 12.1 through Story 12.5.

## Related Operational Documents

- `docs/ops/dmz-route-policy.md`
- `docs/ops/dmz-network-mapping.md`
- `docs/ops/dmz-abuse-response.md`
- `docs/ops/dmz-trusted-proxies.md`
- `docs/ops/risk-acceptance/README.md`
- `docs/ops/evidence/dmz/README.md`
- `.github/workflows/dmz-security-drill.yml`

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `docs/ops/adr/adr-0001-edge-gateway-nginx.md`
- `docker-compose.yml`
- `docker-compose.dmz.yml`
- `docker/nginx/templates/fixyz-edge.conf.template`
- `docker/nginx/templates/fixyz-edge-dmz.conf.template`
