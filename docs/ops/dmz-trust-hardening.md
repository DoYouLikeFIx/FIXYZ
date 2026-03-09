# DMZ Trust Hardening Design

## Status

This document is planning-only. No Epic 12 trust-hardening runtime controls are currently active in this repository.

## Purpose

Define the intended Story 12.3 contract for internal secret rotation safety and mTLS readiness.

## Dependencies

- Story 0.8 for Vault secret-management baseline
- Story 0.13 for non-local/external Vault operating model
- Story 8.3 for correlation-id propagation across service boundaries

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

Story 12.3 does not require full mTLS rollout. It does require:

- one ADR describing service identity, certificate ownership, trust-distribution model, and non-goals
- one proof-of-concept for the fixed service pair `channel-service` -> `corebank-service`
- explicit statement of what remains out of scope for MVP

## Evidence Requirements

- rotation plan
- validation drill summary
- stale-secret rejection sample
- ADR reference
- PoC reference for `channel-service` -> `corebank-service`

## Implementation Notes

- Future runtime work must update this document and the story artifact in the same change.
- Story 12.3 is not implementation-ready unless Story 0.13 constraints are carried through.
- Any service that cannot emit the rejection contract above must document the variance before Story 12.3 leaves design review.
