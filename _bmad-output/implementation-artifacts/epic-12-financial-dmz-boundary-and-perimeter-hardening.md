# Epic 12: Financial DMZ Boundary and Perimeter Hardening

> Documentation-only package. On 2026-03-07, repository-local Epic 12 runtime assets were removed; the active runtime baseline for topology and ingress ownership remains Story 0.7.

## Purpose

This file is the Epic 12 index for planning, story routing, and documentation ownership.
It exists so Epic 12 can remain fully specified without keeping partial or misleading implementation code in the repository.

## Current State

- No DMZ compose overlay is active in this repository.
- No DMZ-specific ingress template is active in this repository.
- No DMZ drill workflow automation is active in this repository.
- Epic 12 currently exists as design, governance, and handoff documentation only.
- The current Story 0.7 controller scaffold is intentionally partial and must not be mistaken for the canonical public API contract described in PRD, channel API specs, or UX planning artifacts.

## Canonical Sources

- Canonical epic numbering and summary: `_bmad-output/planning-artifacts/epics.md`
- Detailed story handoff documents:
  - `_bmad-output/implementation-artifacts/12-1-dmz-network-segmentation-profile.md`
  - `_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md`
  - `_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness.md`
  - `_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations.md`
  - `_bmad-output/implementation-artifacts/12-5-dmz-security-drill-and-evidence-gate.md`

## Priority and Scope Controls

- Default priority: Medium
- Low-priority fallback requires explicit risk acceptance record: `docs/ops/risk-acceptance/<YYYYMMDD>-epic12.md`
- Story 0.7 remains baseline owner for TLS termination, base security headers, and baseline edge routing.
- Story 0.13 is the required external-Vault planning dependency before Story 12.4 can move into implementation.
- Product-level anchors: `FR-57`, `FR-58`, `NFR-S8`, `NFR-S9` in `_bmad-output/planning-artifacts/prd.md`

## Documentation Package

- `docs/ops/dmz-network-mapping.md`
- `docs/ops/dmz-route-policy.md`
- `docs/ops/dmz-abuse-response.md`
- `docs/ops/dmz-trusted-proxies.md`
- `docs/ops/dmz-trust-hardening.md`
- `docs/ops/dmz-admin-access.md`
- `docs/ops/dmz-drill-governance.md`
- `docs/ops/dmz-release-checklist-template.md`
- `docs/ops/evidence/dmz/README.md`
- `docs/ops/risk-acceptance/README.md`

## Resumption Conditions

When Epic 12 implementation resumes:

1. Reintroduce runtime assets only through a new reviewed change set.
2. Update the relevant design documents in the same change as the code.
3. Recreate verification automation only after the underlying runtime controls exist.
4. Keep privileged DMZ operator surfaces out of the public edge contract.
5. Treat this file and the Epic 12 story files as the documentation baseline for new implementation work.

## Removed Runtime Assets

The following repository-local implementation assets were intentionally removed on 2026-03-07:

- `docker-compose.dmz.yml`
- `docker/nginx/templates/fixyz-edge-dmz.conf.template`
- `.github/workflows/dmz-security-drill.yml`

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `docs/ops/adr/adr-0001-edge-gateway-nginx.md`
- `docker-compose.yml`
- `docker/nginx/templates/fixyz-edge.conf.template`
