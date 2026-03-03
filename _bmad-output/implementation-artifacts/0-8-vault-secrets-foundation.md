# Story 0.8: Vault Secrets Foundation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want a Vault-based secrets baseline,
so that infrastructure and application secrets are centrally managed with auditable access.

**Depends On:** Story 0.1

## Acceptance Criteria

1. Given Vault baseline is enabled, when secret paths are provisioned, then app and infra credentials are read from Vault-managed paths instead of committed static files.
2. Given runtime and CI identity requirements, when policies are configured, then least-privilege access is enforced per service/repository role.
3. Given secret rotation needs, when a rotation drill is performed, then at least one critical secret rotates without user-visible outage.
4. Given auditability requirements, when secret operations occur, then Vault audit logs capture read/write access with actor and path metadata.
5. Given failure/availability risks, when Vault is unreachable, then fallback behavior is explicit (fail-fast or controlled degraded mode) and documented.

## Tasks / Subtasks

- [ ] Define Vault baseline architecture and path policy (AC: 1, 2)
  - [ ] Define secret path conventions by domain/service
  - [ ] Define role/policy matrix with least privilege
- [ ] Configure Vault auth and policy integration (AC: 2)
  - [ ] Configure GitHub Actions OIDC auth method for CI
  - [ ] Configure AppRole auth method for runtime services
  - [ ] Bind repository/service identities to scoped policies
- [ ] Integrate app/runtime config with Vault reads (AC: 1, 5)
  - [ ] Replace static secret references with Vault retrieval flow
  - [ ] Document fail-fast/degraded behavior on Vault unavailability
- [ ] Implement rotation and audit verification (AC: 3, 4)
  - [ ] Run rotation drill for one critical secret
  - [ ] Validate audit log visibility and retention expectation
  - [ ] Execute Vault-unreachable chaos check and verify documented fallback behavior

## Dev Notes

### Developer Context Section

- This story establishes secret-management foundation only; broader infra provisioning is handled in Story 0.9.
- Keep bootstrap path simple for local/dev and reproducible for CI/staging.
- No plain-text secrets should appear in repository files, logs, or docs examples.

### Technical Requirements

- Use Vault KV v2 or equivalent versioned secret engine.
- Access model must support short-lived auth credentials.
- Document and test token/lease renewal semantics if used.
- Auth method is fixed for this story:
  - CI: GitHub Actions OIDC -> Vault JWT/OIDC auth role mapping
  - Runtime: Vault AppRole with short TTL and rotation policy

### Architecture Compliance

- Preserve separation of concerns: secret management at platform layer, domain logic unchanged.
- Align secret key naming with existing service/env conventions.

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/docker/**`
  - `/Users/yeongjae/fixyz/docs/ops/**`
  - `/Users/yeongjae/fixyz/.github/**` (if CI secret retrieval flow requires workflow changes)
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/**` (story traceability)

### Testing Requirements

- Minimum checks for completion:
  - Vault policy tests validate least-privilege access.
  - Secret retrieval works in representative runtime and CI path.
  - Rotation drill evidence is captured.
  - Audit log captures expected operations.
  - Vault-unreachable scenario is tested and matches documented fail-fast/degraded behavior.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.8)
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/epic-0-project-foundation.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story drafted from Epic 0 expansion requirements for centralized secret management.

### Completion Notes List

- Created Story 0.8 as ready-for-dev with Vault baseline, rotation, and audit criteria.

### File List

- _bmad-output/implementation-artifacts/0-8-vault-secrets-foundation.md
