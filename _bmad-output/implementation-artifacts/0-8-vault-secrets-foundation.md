# Story 0.8: Vault Secrets Foundation

Status: review

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

- [x] Define Vault baseline architecture and path policy (AC: 1, 2)
  - [x] Define secret path conventions by domain/service
  - [x] Define role/policy matrix with least privilege
- [x] Configure Vault auth and policy integration (AC: 2)
  - [x] Configure GitHub Actions OIDC auth method for CI
  - [x] Configure AppRole auth method for runtime services
  - [x] Bind repository/service identities to scoped policies
- [x] Integrate app/runtime config with Vault reads (AC: 1, 5)
  - [x] Replace static secret references with Vault retrieval flow
  - [x] Document fail-fast/degraded behavior on Vault unavailability
- [x] Implement rotation and audit verification (AC: 3, 4)
  - [x] Run rotation drill for one critical secret
  - [x] Validate audit log visibility and retention expectation
  - [x] Execute Vault-unreachable chaos check and verify documented fallback behavior
- [x] Review Follow-ups (AI)
  - [x] [AI-Review][High] Make bootstrap secret seeding idempotent so `vault-init` does not overwrite rotated values on every restart (`docker/vault/init/vault-bootstrap.sh:57`, `docker/vault/scripts/check-vault-unreachable.sh:55`).
  - [x] [AI-Review][High] Fix rotation runbook/auth model mismatch: current documented AppRole-based rotation cannot write because runtime policy is read-only (`docs/ops/vault-secrets-foundation.md:90`, `docker/vault/policies/runtime-internal-secret.hcl:1`).
  - [x] [AI-Review][High] Align compose fail-fast guards with bootstrap flow: required `INTERNAL_SECRET` interpolation currently blocks `docker compose up -d vault vault-init` before secret retrieval (`docker-compose.yml:88`, `docs/ops/vault-secrets-foundation.md:43`).
  - [x] [AI-Review][Medium] Verify Vault binary integrity in CI before installation to reduce supply-chain risk (`.github/workflows/docs-publish.yml:41`).
  - [x] [AI-Review][Medium] Replace brittle JWT bound claim on workflow display name with stable claim(s) (`job_workflow_ref`/`ref`) to avoid auth breakage on workflow rename (`docker/vault/init/vault-bootstrap.sh:86`).
  - [x] [AI-Review][Medium] Make chaos script assert post-restart readiness (Vault healthy + `vault-init` exit code) instead of reporting completion immediately after `docker start` (`docker/vault/scripts/check-vault-unreachable.sh:55`).

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

- `npm run test:vault` (red phase): failed as expected before implementation (`5/5` failing checks).
- `npm test` and `npm run lint:{collab-webhook,edge-gateway,vault}`: all green after implementation.
- `docker compose up -d vault vault-init` with local env bootstrap values.
- Live drill verification:
  - AppRole read success from `secret/fix/shared/core-services/internal-secret`
  - Rotation with operator token: `rotation_ok secret/fix/shared/core-services/internal-secret 2026-03-03T04:36:48Z`
  - Chaos drill: Vault stopped -> read fails -> Vault restarted (`check-vault-unreachable.sh`)
  - Audit tail verified from `/vault/file/audit.log`
- Review follow-up validation:
  - `npm test` passed after applying 6 review follow-up fixes.
  - `docker compose -f docker-compose.vault.yml config` passed.
  - `npm run lint:{collab-webhook,edge-gateway,vault}` all passed.

### Completion Notes List

- Implemented Vault foundation assets under `docker/vault/**`:
  - KV v2 bootstrap, audit device enablement, JWT/OIDC role bootstrap, AppRole bootstrap, and least-privilege policy files.
- Updated runtime compose configuration so `INTERNAL_SECRET` must be injected from Vault (fail-fast startup guard, no static fallback).
- Added CI OIDC -> Vault JWT login flow to docs publish workflow with controlled degraded mode when Vault is not configured.
- Added operational runbook with path conventions, role/policy matrix, rotation/audit procedures, and Vault-unreachable fallback behavior.
- Captured rotation drill evidence in `docs/ops/evidence/vault-rotation-drill.log`.
- Added Vault contract tests (`tests/vault/vault-baseline.test.js`) and npm scripts for test/lint automation.
- Applied all 6 AI review follow-ups:
  - bootstrap secret seed is now idempotent
  - dedicated rotation role/policy added and runbook aligned
  - bootstrap flow moved to `docker-compose.vault.yml` to avoid runtime-secret interpolation blockers
  - CI Vault binary checksum verification added
  - JWT role binding updated to stable `job_workflow_ref` claim
  - chaos script now validates post-restart readiness (`vault` health + `vault-init` exit code)

### File List

- .env.example
- .github/workflows/docs-publish.yml
- _bmad-output/implementation-artifacts/0-8-vault-secrets-foundation.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- docker-compose.override.yml
- docker-compose.yml
- docker-compose.vault.yml
- docker/vault/init/vault-bootstrap.sh
- docker/vault/policies/ci-docs-publish.hcl
- docker/vault/policies/ops-rotation-internal-secret.hcl
- docker/vault/policies/runtime-internal-secret.hcl
- docker/vault/scripts/check-vault-unreachable.sh
- docker/vault/scripts/read-internal-secret.sh
- docker/vault/scripts/rotate-internal-secret.sh
- docs/ops/evidence/vault-rotation-drill.log
- docs/ops/vault-secrets-foundation.md
- package.json
- tests/vault/vault-baseline.test.js

## Change Log

- 2026-03-03: Implemented Vault secrets baseline (KV v2 + policy + auth), integrated CI OIDC/AppRole access model, removed static internal-secret defaults, added runbook and live drill evidence, and validated with automated tests/lint.
- 2026-03-03: Senior Developer Review (AI) completed - outcome `Changes Requested`, 6 follow-up items added (3 High, 3 Medium).
- 2026-03-03: Resolved all 6 Senior Developer Review follow-up items and returned story status to `review`.

## Senior Developer Review (AI)

### Review Date

2026-03-03

### Reviewer

GPT-5 Codex (Adversarial Review Mode)

### Outcome

Changes Requested

### Summary

- Total findings: 6
- High severity: 3
- Medium severity: 3
- Low severity: 0
- Git vs Story File List discrepancies: 0

### Acceptance Criteria Validation

- AC1 (Vault-managed secret path usage): **Partial** - baseline path/policy exist, but compose bootstrap flow currently requires pre-set `INTERNAL_SECRET`, which undermines the documented retrieval-first flow.
- AC2 (least privilege for runtime/CI identity): **Partial** - least-privilege policies exist, but JWT bound claim coupling to workflow display name is fragile and can break CI auth unexpectedly.
- AC3 (rotation without user-visible outage): **Partial** - rotation execution exists, but bootstrap re-seeds secret on restart and runbook uses a non-writable AppRole path for rotation.
- AC4 (audit actor/path metadata): **Implemented** - audit device and evidence captured.
- AC5 (explicit Vault-unreachable fallback): **Partial** - behavior documented, but chaos script does not enforce post-restart readiness validation and fallback verification is not strict.

### Action Items

- [ ] [High] Prevent secret overwrite on restart by making bootstrap seed idempotent.
- [ ] [High] Correct rotation auth/runbook path (operator role/token or dedicated rotate policy).
- [ ] [High] Resolve compose interpolation blocking bootstrap-first secret retrieval flow.
- [ ] [Medium] Add checksum/signature verification for Vault CLI install in CI.
- [ ] [Medium] Use stable JWT claims for Vault role binding instead of workflow display-name claim.
- [ ] [Medium] Add strict readiness checks in chaos drill restart path.
