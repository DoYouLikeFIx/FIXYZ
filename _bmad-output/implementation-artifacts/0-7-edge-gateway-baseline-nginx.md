# Story 0.7: Edge Gateway Baseline (Nginx)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want an Nginx-based edge gateway baseline,
so that TLS termination, upstream routing, and security headers are enforced consistently.

**Depends On:** Story 0.1

## Acceptance Criteria

1. Given the edge decision is Nginx, when baseline is documented, then ADR includes why Nginx was selected and excluded alternatives.
2. Given external requests enter the platform, when Nginx config is applied, then traffic is routed to channel/corebank/fep-gateway/fep-simulator through explicit upstream rules.
3. Given TLS and secure-default requirements, when edge baseline runs, then HTTPS termination and baseline headers (`HSTS`, `X-Content-Type-Options`, `X-Frame-Options`) are enabled.
4. Given upstream health degradation, when backend target is unavailable, then deterministic 5xx behavior and access/error logs are observable.
5. Given foundation-level validation, when smoke tests run, then routing and header expectations are verifiable by scripted checks.

## Tasks / Subtasks

- [ ] Finalize Nginx edge decision and ADR (AC: 1)
  - [ ] Record decision context, constraints, and trade-offs
  - [ ] Capture future migration considerations (if any)
- [ ] Implement Nginx baseline configuration (AC: 2, 3)
  - [ ] Define upstream blocks for each backend service
  - [ ] Define server blocks for TLS termination and HTTP->HTTPS redirect
  - [ ] Define certificate provisioning and renewal mechanism for each environment
  - [ ] Add baseline response header policy
  - [ ] Define explicit public route allowlist and block internal/admin-only endpoints
- [ ] Implement observability and failure behavior (AC: 4)
  - [ ] Configure structured access/error log format
  - [ ] Configure upstream timeout and deterministic failure responses
- [ ] Add validation scripts/tests (AC: 5)
  - [ ] Route smoke checks per service path
  - [ ] Security-header verification checks
  - [ ] TLS certificate chain and expiry validation checks
  - [ ] SSE/EventStream proxy compatibility checks (`proxy_http_version`, buffering/timeout policy)
  - [ ] Unhealthy upstream behavior check

## Dev Notes

### Developer Context Section

- This story establishes the edge layer baseline only; service business logic is out of scope.
- Keep deployment model simple and reproducible in local/dev first.
- Future infra stories (Vault/bootstrap/DB HA) should integrate on top of this edge baseline.

### Technical Requirements

- Nginx config should be environment-driven where needed (hostnames/ports/certs).
- Health and failure observability must be visible in logs.
- Avoid hardcoding secrets/cert private keys in repository files.
- Preserve SSE/EventStream compatibility for notification-related endpoints by explicit proxy settings.
- Expose only approved public routes at edge; internal-only endpoints must remain blocked at gateway layer.

### Architecture Compliance

- Preserve existing service boundary assumptions and upstream names.
- Do not introduce application-layer auth logic in Nginx baseline story.

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/docker/**`
  - `/Users/yeongjae/fixyz/docs/ops/**`
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/**` (story traceability only)

### Testing Requirements

- Minimum checks for completion:
  - Nginx config syntax check passes.
  - Route checks to all target upstreams pass.
  - Security headers are present on representative endpoints.
  - TLS cert validity and renewal behavior are verified in target environment.
  - Internal-only path probes are blocked by edge policy.
  - SSE/EventStream endpoint probe confirms stable streaming behavior through proxy.
  - Unhealthy upstream simulation shows deterministic behavior and logs.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.7)
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/epic-0-project-foundation.md`
- `/Users/yeongjae/fixyz/docker-compose.yml`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story drafted from Epic 0 expansion with Nginx selection locked by user decision.

### Completion Notes List

- Created Story 0.7 as ready-for-dev with Nginx-specific edge baseline scope and acceptance criteria.

### File List

- _bmad-output/implementation-artifacts/0-7-edge-gateway-baseline-nginx.md
