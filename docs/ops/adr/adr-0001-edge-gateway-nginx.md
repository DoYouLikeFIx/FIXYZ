# ADR-0001: Edge Gateway Baseline with Nginx

- Status: Accepted
- Date: 2026-03-03
- Story: 0-7-edge-gateway-baseline-nginx

## Context

The platform needs a single edge entry point that enforces TLS termination, HTTP-to-HTTPS redirect, baseline security headers, explicit upstream routing, deterministic 5xx behavior, and SSE-compatible proxy settings. The initial rollout must be simple to run with Docker Compose and easy to validate through scripted checks.

## Decision

Use **Nginx** as the baseline edge gateway for Story 0.7.

Nginx will provide:
- TLS termination on `:443` and redirect from `:80`
- Explicit upstream routing to `channel-service`, `corebank-service`, `fep-gateway`, and `fep-simulator`
- Security headers (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`)
- Deterministic upstream failure response contract
- Structured access/error logging and health route proxies

## Alternatives

- Traefik: Better dynamic service discovery and built-in ACME experience, but adds operational model changes not needed for this baseline.
- Envoy: Powerful policy/extensibility and modern data-plane features, but heavier than required for foundation story scope.
- Cloud-managed edge (e.g., ALB/API Gateway only): Useful later, but not aligned with local/dev parity and in-repo baseline validation requirements.

## Trade-offs

- Pros:
  - Stable and widely understood runtime with clear configuration model
  - Strong fit for deterministic reverse-proxy behavior and header policy enforcement
  - Works well with current Compose-based environment and scripted validation
- Cons:
  - Static config and template management overhead versus controller-based gateways
  - Certificate lifecycle and advanced policy automation require additional scripting/integration
  - Fewer built-in service discovery features compared with cloud-native gateway stacks

## Consequences

- Short term: Fast baseline delivery with predictable behavior and testability.
- Long term: Keep migration path open to Traefik/Envoy/cloud edge if dynamic routing, richer policy control, or fleet-wide gateway automation becomes a requirement.
