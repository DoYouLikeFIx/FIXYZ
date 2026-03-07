# Story 12.2: Edge Perimeter Policy Hardening

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a security engineer,
I want a documented DMZ perimeter contract,
so that future implementation has an explicit allowlist, deny behavior, abuse policy, and trusted-proxy governance target.

**Depends On:** Story 0.7, Story 7.7, Story 12.1

## Acceptance Criteria

1. Given public route exposure requirements, when `docs/ops/dmz-route-policy.md` is reviewed, then the allowed route/method matrix is complete and explicit.
2. Given perimeter deny behavior, when the policy is reviewed, then unknown paths, disallowed methods, internal namespaces, and temporary deny responses all have deterministic contracts.
3. Given abuse control requirements, when the design is reviewed, then thresholds, temporary deny behavior, and evidence expectations are documented.
4. Given trusted client identity requirements, when the design is reviewed, then trusted-proxy governance and future configuration ownership are documented.

## Tasks / Subtasks

- [ ] Finalize public route and method matrix (AC: 1)
  - [ ] Inventory current Story 0.7 scaffold-only public paths separately from the canonical target matrix
- [ ] Finalize canonical URI normalization and route matching rules (AC: 1, 2)
- [ ] Finalize deny and response contracts (AC: 2)
- [ ] Finalize abuse response and evidence contract (AC: 3)
- [ ] Finalize trusted-proxy governance contract (AC: 4)
  - [ ] Define multi-proxy hop selection and IP normalization rules
  - [ ] Define temporary deny operator interface contract and idempotency rule
  - [ ] Define public-edge exclusion for privileged operator surfaces

## Dev Notes

### Developer Context Section

- Runtime enforcement has been removed from the repository; this story now carries the authoritative design target only.

### Technical Requirements

- Route matching must define normalization, encoded-path handling, and trailing-slash behavior explicitly.
- Route matching must define single-pass decoding, malformed-encoding rejection, and encoded internal-path handling explicitly.
- Public route policy must preserve canonical product API paths unless an ADR-approved rewrite contract is documented.
- Current Story 0.7 scaffold-only public routes must be inventoried separately from the canonical target contract.
- Current Story 0.7 `edge-gateway` alias surface (`/api/v1/channel/*`) must be documented separately from the direct controller scaffold and must default to deny/remove in hardened mode unless an ADR-backed migration exception is approved.
- The missing canonical-route coverage inventory must be route-by-route and must not collapse absent endpoints into a single prose sentence.
- Public route policy must encode auth/session and CSRF posture per route instead of method-only allowlists.
- Public deny contracts must remain deterministic:
  - unknown path: `404 EDGE_ROUTE_NOT_ALLOWED`
  - disallowed method: `404 EDGE_METHOD_NOT_ALLOWED`
  - internal namespace: `403 EDGE_INTERNAL_NAMESPACE_DENIED`
  - rate limited: `429`
  - temporary deny: `403 EDGE_DMZ_TEMP_DENY`
- Trusted client identity extraction must define multi-proxy chain parsing and canonical IP normalization.
- Temporary deny management must define authentication, authorization, idempotency, `Retry-After`, and minimum response fields.
- Perimeter rate limits must define how they coexist with stricter application/session/user-level limits.
- Edge-generated denies and rate limits must emit evidence fields proving which layer enforced the rejection.
- Privileged operator surfaces must stay outside the public edge allowlist.

### Architecture Compliance

- Preserve Story 0.7 edge baseline while adding hardened perimeter rules.
- Keep error, request-id, and audit contracts aligned with existing edge/error-envelope standards.

### File Structure Requirements

- Expected touched areas when implementation resumes:
  - `/Users/yeongjae/fixyz/docs/ops/dmz-route-policy.md`
  - `/Users/yeongjae/fixyz/docs/ops/dmz-trusted-proxies.md`
  - `/Users/yeongjae/fixyz/docs/ops/dmz-abuse-response.md`
  - `/Users/yeongjae/fixyz/docker/nginx/templates/fixyz-edge.conf.template`
  - a newly reviewed ingress-specific runtime artifact only if the implementation change explicitly reintroduces one

### Testing Requirements

- Verify canonical route matching against path normalization edge cases.
- Verify legacy `/api/v1/channel/*` edge alias is documented as baseline-only and excluded from the hardened public allowlist unless an ADR exception is present.
- Verify trusted proxy extraction across single-hop and multi-hop XFF chains.
- Verify temporary deny interface returns the documented deny record fields and honors idempotency.
- Verify deny/rate-limit contracts emit stable status codes, error codes, `request_id`, and `Retry-After` where required.
- Verify trusted-proxy spoofing, malformed-chain fallback, and right-most non-trusted hop scenarios are part of the future drill set.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story 12.2 now includes deterministic path-matching and trusted-proxy requirements.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-route-policy.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-abuse-response.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-trusted-proxies.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Completion Notes List

- Story documentation created after removing repository-local Epic 12 runtime assets.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md
