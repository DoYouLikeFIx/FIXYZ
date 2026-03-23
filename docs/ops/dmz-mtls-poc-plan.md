# DMZ mTLS PoC Plan

## Status

This document is planning-only. No Story 12.3 mTLS proof-of-concept runtime asset is currently active in this repository.

## Purpose

Define the fixed-pair Story 12.3 proof-of-concept scope for future mTLS implementation without reintroducing runtime code in the current change.

## Fixed Pair

- `channel-service` -> `corebank-service`

## Dependencies

- `docs/ops/dmz-trust-hardening.md`
- `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md`
- Story 0.13 external Vault operating model
- Story 8.3 correlation-id propagation
- Story 12.1 DMZ network-zone boundary

## Documentation-Only Scope

Story 12.3 PoC output is a planning package only. The fixed-pair PoC does not mean:

- runtime mTLS traffic is enabled
- certificate material exists in the repository
- a release gate or drill automation is active
- additional service pairs are in scope

## Planned PoC Contract

- Boundary: authenticated internal traffic from `channel-service` to `corebank-service`
- Service identity model:
  - one certificate identity for `channel-service`
  - one certificate identity for `corebank-service`
  - reviewed SAN/hostname expectations for both peers
- Certificate ownership:
  - issuance and renewal remain operator/platform owned
  - non-local trust material distribution must follow the Story 0.13 external-Vault model
- Boot-path expectations:
  - any boot-path trust material required for non-local rollout must use deploy-time pre-start retrieval plus environment injection
  - non-local profiles fail closed if local `vault` or `vault-init` services are enabled
- Failure expectations:
  - trust-chain failure
  - hostname/SAN mismatch
  - expired certificate
  - missing trust material
  - each failure mode must map to auditable evidence and preserve correlation-id traceability

## Planned Outputs For The Future Runtime Change

- one reviewed runtime change set limited to the fixed pair
- config-surface inventory for certificate, trust bundle, and hostname-verification inputs
- rollback triggers and rollback procedure for the fixed pair
- validation checklist for successful handshake, fail-closed behavior, and correlation-aware evidence

## Deferred Items

- `corebank-service` -> `fep-gateway`
- `fep-gateway` -> `fep-simulator`
- service-mesh adoption or sidecar-based trust distribution
- fleet-wide certificate lifecycle automation
- Story 12.5 release-promotion evidence packaging

## Implementation Notes

- Any future runtime PoC must update this document, `docs/ops/dmz-trust-hardening.md`, the ADR, and the Story 12.3 artifact in the same reviewed change set.
- If the fixed-pair runtime PoC cannot preserve the Story 12.3 fail-closed posture or Story 0.13 non-local Vault rules, the variance must be documented before implementation proceeds.
