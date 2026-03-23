# DMZ Trust Hardening Design

## Status

This document is planning-only. No Epic 12 service-boundary trust controls or mTLS runtime data plane are currently active in this repository.

## Purpose

Define the intended Story 12.3 contract for internal secret rotation safety and mTLS readiness.

## Documentation-Only Boundary

- Story 12.3 outputs are documentation artifacts and root regression coverage only.
- The Story 12.3 ADR and fixed-pair PoC plan define the future implementation contract; they do not activate runtime mTLS, drill automation, or release-promotion evidence in this repository.
- Future service-boundary runtime controls must arrive through a separate reviewed change set that updates this document, the Story 12.3 artifact, the ADR, and the PoC plan together.

## Dependencies

- Story 0.8 for Vault secret-management baseline
- Story 0.13 for non-local/external Vault operating model
- Story 8.3 for correlation-id propagation across service boundaries
- Story 12.1 for the current Epic 12 network-zone boundary

## Story 0.13 Carried-Forward Constraints

The following Story 0.13 rules are mandatory upstream context for Story 12.3. They are restated here so implementation does not need to infer them from dependency numbers alone.

| Environment class | Allowed Vault mode | Boot-path secret delivery | Local Vault services | Non-local transport rules |
|---|---|---|---|---|
| `local/dev` | local compose-owned Vault bootstrap or other reviewed local-only equivalent | local/dev bootstrap path may use `docker-compose.vault.yml` | `vault` and `vault-init` are allowed only for local/dev bootstrap | non-local transport hardening does not relax future staging/prod requirements |
| `staging/prod` | external Vault only | deploy-time pre-start retrieval plus environment injection only for boot-path secrets | `vault` and `vault-init` must be disabled; enabling them is a fail-closed deployment error | TLS required, CA trust required, hostname/SAN verification required, plaintext `http://` forbidden |

Additional Story 0.13 constraints that remain mandatory for Story 12.3:

- Non-local profiles must not silently fall back to localhost Vault defaults or other local-only secret sources.
- Vault role/policy bootstrap for non-local use remains operator/IaC owned rather than app-runtime owned.
- The current `channel-service` TOTP Vault secret store remains a business-flow Vault client rather than a boot-path secret consumer; it must still follow the same external endpoint, TLS, CA-trust, and hostname-verification rules for non-local environments.
- Story 12.3 evidence expectations must preserve correlation-id traceability for stale-secret rejection and trust-failure review paths in line with Story 8.3.

## Pair-Specific Story 0.13 Posture Mapping

Each in-scope service pair inherits the same Story 0.13 non-local fail-closed posture. The table below makes that inheritance explicit instead of leaving it implied.

| Service pair | `local/dev` posture | `staging/prod` posture | Pair-specific non-local fail-closed notes |
|---|---|---|---|
| `channel-service` -> `corebank-service` | may use compose-bootstrap internal secrets sourced through `docker-compose.vault.yml`; local-only Vault services are permitted only for local/dev bootstrap | external-Vault-only secret source, deploy-time pre-start retrieval plus environment injection for boot-path secret material, TLS/CA-trust/hostname verification required | fail closed if local `vault`/`vault-init` are enabled, if injected boot-path secret material is missing/invalid, or if the trust transport preconditions above are not met |
| `corebank-service` -> `fep-gateway` | may use the same local/dev compose-bootstrap secret path as the rest of the internal service chain | external-Vault-only secret source, deploy-time pre-start retrieval plus environment injection for boot-path secret material, TLS/CA-trust/hostname verification required | fail closed if the pair attempts to reuse local-only fallbacks or localhost Vault defaults in non-local environments |
| `fep-gateway` -> `fep-simulator` control plane | may use local/dev compose-bootstrap secret material only while the simulator remains part of the local/dev bootstrap topology | external-Vault-only secret source, deploy-time pre-start retrieval plus environment injection for boot-path secret material, TLS/CA-trust/hostname verification required | must not special-case the simulator control plane as a non-local local-Vault exception; non-local hardened mode still fails closed on local-Vault dependence, missing injected secrets, or broken trust transport validation |

## Service Pairs in Scope

- `channel-service` -> `corebank-service`
- `corebank-service` -> `fep-gateway`
- `fep-gateway` -> `fep-simulator` control plane

## Validation Workload Profile

The minimum reproducible rotation drill is:

- total valid requests counted toward availability SLO: `500`
- service-pair distribution:
  - `channel-service` -> `corebank-service`: `200`
  - `corebank-service` -> `fep-gateway`: `150`
  - `fep-gateway` -> `fep-simulator` control plane: `150`
- negative stale-secret probes are executed separately and are excluded from the valid-request denominator

Required validation probes:

- `channel-service` -> `corebank-service` authenticated request using the current secret
- `corebank-service` -> `fep-gateway` authenticated request using the current secret
- `fep-gateway` -> `fep-simulator` control-plane authenticated request using the current secret
- health probes for all affected services
- one stale-secret negative probe per service pair after invalidation

## Internal Secret Rotation Contract

- Dual-secret overlap window: 15 minutes
- Old-secret invalidation deadline: within 10 minutes after the 15-minute overlap window closes
- Stale-secret behavior after invalidation: request rejected with auditable failure context
- Rotation ownership: operator-initiated, documented runbook, no hidden ad hoc shell flow

## Validation Contract

Future implementation must define and execute a reproducible drill with:

- minimum 500 service-to-service requests during the validation window
- the exact workload profile above recorded in evidence
- explicit start timestamp (`rotation write acknowledged`)
- explicit success timestamp (`all required probes green on new secret`)
- success thresholds:
  - `5xx <= 0.5%`
  - no continuous outage over 30 seconds

Continuous-outage rule:

- measure per in-scope service pair during the validation window
- a continuous outage begins at the first failed scheduled valid request after the most recent success for that pair
- it ends at the first succeeding scheduled valid request for that pair
- any pair whose failed interval exceeds 30 seconds causes the drill to fail

Availability calculation rule:

- denominator: all valid scheduled requests in the workload profile
- numerator: valid requests that end in transport failure, timeout, or HTTP `5xx`
- excluded from numerator/denominator: planned stale-secret negative probes used to verify rejection behavior

## Stale-Secret Rejection Contract

After the overlap window closes and the previous secret is invalidated:

| Service Pair | Expected HTTP Status | Machine Code | Required Fields |
|---|---|---|---|
| `channel-service` -> `corebank-service` | `401` | `CORE-9401` | `category=STALE_INTERNAL_SECRET`, `correlationId`, `servicePair` |
| `corebank-service` -> `fep-gateway` | `401` | `FEP-9401` | `category=STALE_INTERNAL_SECRET`, `correlationId`, `servicePair` |
| `fep-gateway` -> `fep-simulator` control plane | `401` | `FEP-9401` | `category=STALE_INTERNAL_SECRET`, `correlationId`, `servicePair` |

Evidence for each stale-secret rejection sample must include:

- service pair
- request timestamp
- response status
- machine code
- correlation id
- audit event reference

Target-contract note:

- The stale-secret matrix above is the Epic 12 hardened-mode target contract.
- Planning documents must remain aligned to the `401` rejection contract above; any implementation variance must be documented in the same Story 12.3 change set.

## mTLS Readiness Outputs

Story 12.3 does not require full mTLS rollout. It does require the following documentation-only outputs:

- one ADR at `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md` describing service identity, certificate ownership, trust-distribution model, and non-goals
- one fixed-pair PoC plan at `docs/ops/dmz-mtls-poc-plan.md` for `channel-service` -> `corebank-service`
- explicit statement of what remains out of scope for MVP
- root regression coverage at `tests/edge-gateway/dmz-trust-hardening.test.js`

The fixed-pair PoC output is a planning package only in Story 12.3. It does not mean a runtime PoC or mTLS-capable traffic path is active in this repository today.

## Evidence Requirements

- planning-package evidence for Story 12.3 must include:
  - updated trust-hardening contract in this document
  - ADR reference
  - fixed-pair PoC plan reference
  - stale-secret rejection sample schema
  - validation drill summary schema
- release-promotion evidence remains deferred to Story 12.5 after runtime controls exist

## Implementation Notes

- Future runtime work must update this document, the Story 12.3 artifact, `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md`, and `docs/ops/dmz-mtls-poc-plan.md` in the same change.
- Story 12.3 is not implementation-ready unless Story 0.13 constraints are carried through.
- Any service that cannot emit the rejection contract above must document the variance before Story 12.3 leaves design review.
- Story 12.5 owns drill-governance and release-promotion evidence after the runtime trust controls exist; Story 12.3 remains the design-package prerequisite.
