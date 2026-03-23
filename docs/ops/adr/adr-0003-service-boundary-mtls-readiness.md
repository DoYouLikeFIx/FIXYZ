# ADR-0003: Service Boundary mTLS Readiness for Internal Trust Hardening

- Status: Proposed
- Date: 2026-03-24
- Story: 12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness

## Context

Epic 12 is currently documentation-only. Story 12.3 defines the future service-boundary trust contract for east-west traffic without reintroducing runtime trust-hardening code into the repository yet.

The current trust baseline relies on internal-secret authentication and the external Vault operating model from Story 0.13. Any mTLS readiness work must preserve those non-local rules:

- `staging` and `prod` are `external-vault-only`
- boot-path secrets in non-local environments use deploy-time pre-start retrieval plus environment injection
- local `vault` and `vault-init` remain local/dev-only bootstrap services
- non-local Vault transport requires TLS, CA trust, and hostname/SAN verification
- the existing `channel-service` TOTP Vault integration remains a business-flow Vault client and must follow the same non-local transport rules

## Decision

Future hardened mode will use an explicit service-identity model for internal service boundaries.

- Identity unit: one service certificate identity per backend service boundary participant (`channel-service`, `corebank-service`, `fep-gateway`, `fep-simulator`)
- Initial readiness scope: fixed proof-of-concept pair `channel-service` -> `corebank-service`
- Certificate ownership: operator or platform PKI process, not ad hoc app-runtime bootstrap
- Trust-distribution model: reviewed CA bundle and service certificate material distributed through the non-local external-Vault/TLS operating model rather than compose-local bootstrap for `staging/prod`
- Failure posture: hostname/SAN mismatch, trust-chain failure, expired certificate, or missing trust material must fail closed
- Transitional trust posture: the Story 12.3 stale-secret rejection contract remains required until a later reviewed runtime change explicitly supersedes the internal-secret control for a given service pair
- Evidence posture: trust-failure and success-path review must preserve correlation-id traceability compatible with Story 8.3

## Alternatives

- Service-mesh-first rollout: deferred because it introduces a broader platform change than Story 12.3 needs
- Application-managed self-signed certificates: rejected because it conflicts with Story 0.13 ownership and non-local trust-governance goals
- Full multi-pair rollout in one change: deferred to avoid mixing readiness design with runtime rollout

## Non-Goals

- No runtime mTLS rollout in this story
- No new Epic 12 service-boundary runtime overlay in this repository
- No certificate-issuance automation or PKI bootstrap implementation in this story
- No service-mesh adoption decision in this story
- No expansion of the PoC scope beyond `channel-service` -> `corebank-service`
- No release-gate drill evidence; Story 12.5 owns promotion evidence after runtime controls exist

## Consequences

- Short term: Story 12.3 stays documentation-only while making the future mTLS direction concrete enough for implementation planning.
- Long term: a future reviewed runtime change can implement the fixed-pair PoC and later widen service coverage without changing the trust-governance model defined here.
