# Story 0.13: Vault Production Separation and External Operations

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want Vault to run as an external production service instead of local compose-owned containers,
so that CI/runtime secret retrieval uses hardened operational controls and production-safe failure handling.

**Depends On:** Story 0.8, Story 0.9

## Acceptance Criteria

1. Given production/staging environments are used, when CI workflows resolve secrets, then GitHub Actions OIDC -> Vault JWT login succeeds against external Vault endpoint over TLS and does not rely on local `vault`/`vault-init` containers.
2. Given branch risk policy, when protected branches (`main`, `release/*`) run workflows listed in `.github/vault-protected-workflows.txt`, then any Vault resolution failure causes fail-closed pipeline termination with no degraded bypass; policy check fails if allowlist entries do not map to existing workflow files.
3. Given runtime service startup in non-local environments, when app stack boots, then secrets are injected by a single approved method: deploy-time pre-start retrieval + environment injection using AppRole credentials; application processes do not perform direct Vault fetch on boot path.
4. Given bootstrap ownership requirements, when a new environment is provisioned, then one-time Vault role/policy setup is executed through operator-owned process (runbook or IaC), and application runtime/CI never require root token exposure.
5. Given least-privilege constraints, when Vault roles/policies are applied, then CI remains read-only, runtime remains read-only, rotation remains write-scoped to dedicated role, and token TTL limits are enforced as: CI `token_ttl=5m`, `token_max_ttl=15m`; runtime `token_ttl=5m`, `token_max_ttl=30m`, `secret_id_ttl=24h`; rotation `token_ttl=5m`, `token_max_ttl=15m`, `secret_id_ttl=1h`.
6. Given network and transport security requirements, when CI/runtime clients connect to Vault, then certificate trust validation is explicit (`VAULT_CACERT` or equivalent), hostname/SAN verification is mandatory, and plaintext transport (`http://`) is disallowed for non-local environments.
7. Given reliability requirements, when external Vault outage drill is executed, then environment decision matrix is enforced: protected branches and production runtime are fail-fast only; degraded mode is allowed only for non-protected/local simulation paths and must be explicitly documented.
8. Given audit/compliance requirements, when secret read/write operations occur in external Vault mode, then actor/path metadata is retained and evidence is stored with minimum retention `>=90 days` and immutable artifact storage policy.
9. Given migration safety requirements, when local-dev baseline transitions to external Vault mode for staging/prod, then cutover checklist and rollback path are executable with quantitative gates: all required probes green within `<=300s`, `0` critical secret-auth errors, and rollback trigger on gate breach.
10. Given local developer experience requirements, when engineers run local bootstrap, then `docker-compose.vault.yml` remains available as local-only path and production/non-local profiles hard-fail if local Vault services (`vault`, `vault-init`) are enabled via deploy guard `scripts/vault/validate-nonlocal-profile.sh`.
11. Given secret rotation operations, when a critical secret is rotated in external mode, then propagation contract is explicit: new value becomes effective after next deployment/restart cycle within `<=15m` and runbook documents required restart sequence.
12. Given secret-handling controls, when CI/deploy scripts retrieve secrets, then `set -x` is disallowed, secret values are masked, secret env vars are unset in orchestrator shell immediately after process/container start handoff, and secrets are never printed to logs or evidence artifacts.
13. Given delivery-scope constraints, when this story is executed, then scope is limited to guardrails, policy enforcement, and one cutover rehearsal; full certificate automation platform build-out and long-term SIEM pipeline integration are explicitly deferred to a follow-up story.

## Tasks / Subtasks

- [ ] Define external Vault operating model and cutover boundaries (AC: 1, 3, 4, 7, 9, 10, 11, 13)
  - [ ] Define environment matrix (`local/dev` vs `staging/prod`) and allowed modes
  - [ ] Define outage decision matrix (`fail-fast only` vs `allowed degraded`)
  - [ ] Define ownership boundary between app repo automation and Vault platform operators
  - [ ] Define rollback triggers and fallback decision tree during cutover
  - [ ] Record this-story vs follow-up-story scope boundary in runbook
- [ ] Harden CI OIDC integration for external Vault (AC: 1, 2, 5, 6, 12)
  - [ ] Add `.github/vault-protected-workflows.txt` and enforce it in CI policy checks
  - [ ] Validate allowlist entries reference existing workflow files (fail policy on broken mapping)
  - [ ] Update workflow policy so protected branches fail closed on all Vault resolution failures
  - [ ] Define Vault resolution failure taxonomy (`OIDC token fetch`, `jwt login`, `TLS trust`, `hostname mismatch`, `network timeout`, `kv read`)
  - [ ] Define deterministic exit codes/log signatures for each taxonomy item
  - [ ] Add/verify CA trust configuration handling for Vault TLS validation
  - [ ] Enforce HTTPS-only Vault endpoint policy and hostname verification checks in workflow guardrails
  - [ ] Set timeout/retry policy (`connect_timeout=3s`, `read_timeout=5s`, `max_attempts=3`, backoff `2s`,`5s`)
  - [ ] Add secret-log safety guards (`set -x` prohibition, mask/unset requirements)
  - [ ] Keep JWT claim binding stable (`repository`, `job_workflow_ref`, and branch constraint if required)
- [ ] Separate runtime startup from local Vault containers for non-local profiles (AC: 3, 10, 11, 12)
  - [ ] Introduce or update compose/profile strategy so production paths do not depend on `vault-init`
  - [ ] Add deploy guard `scripts/vault/validate-nonlocal-profile.sh` that fails if `vault`/`vault-init` services are present or enabled
  - [ ] Keep local bootstrap path intact via `docker-compose.vault.yml`
  - [ ] Implement deploy-time secret retrieval + env injection contract for external Vault mode (single approach, no sidecar/startup-fetch split)
  - [ ] Define env var lifecycle timing (mask, process handoff, unset in orchestrator shell)
  - [ ] Document rotation-to-runtime propagation SLA (`<=15m`) and required restart sequence
- [ ] Establish operator bootstrap procedure for roles/policies (AC: 4, 5, 6)
  - [ ] Document/apply external Vault policy and role provisioning sequence
  - [ ] Confirm runtime and CI flows do not require root token at execution time
  - [ ] Validate TTL and capability constraints for all relevant roles
- [ ] Implement external-mode outage and audit verification runbooks (AC: 7, 8, 9)
  - [ ] Add outage drill procedure for external Vault connectivity failure scenarios
  - [ ] Add audit evidence collection instructions, immutable storage implementation (`S3 Object Lock Compliance mode` or equivalent WORM), and retention metadata (`>=90d`)
  - [ ] Define required probes list and critical secret-auth error classification table
  - [ ] Define certificate rotation rollback trigger and downtime SLO (`<=300s` total cutover impact)
  - [ ] Execute cutover rehearsal and capture evidence artifacts with quantitative gate results
- [ ] Add contract tests and guardrails (AC: 1, 2, 3, 6, 7, 10, 11, 12)
  - [ ] Add tests asserting protected-branch fail-closed behavior using workflow allowlist file
  - [ ] Add tests asserting Vault failure taxonomy paths all fail closed on protected branches
  - [ ] Add tests asserting exit code/log-signature mapping per failure type
  - [ ] Add tests asserting timeout/retry policy (`3s/5s`, attempts=3, `2s/5s` backoff) is enforced
  - [ ] Add tests asserting production profile has no local `vault-init` dependency and enforces non-local guard
  - [ ] Add tests asserting local-only Vault path remains documented and isolated
  - [ ] Add tests/assertions for HTTPS-only, CA trust, and hostname verification enforcement
  - [ ] Add tests/assertions for env var lifecycle timing and post-start shell unset behavior
  - [ ] Add checks ensuring scripts never leak secrets (`set -x` blocked, masking/unset verified)

## Dev Notes

### Developer Context Section

- Story 0.8 established Vault baseline with local bootstrap and foundational policies; this story separates operational responsibility for non-local environments.
- Keep local developer productivity intact while making staging/prod behavior production-safe.
- Avoid introducing static secret fallbacks during migration; preserve explicit fail-fast semantics for protected paths.
- Scope boundary for this story:
  - In scope: policy enforcement, runtime/CI guardrails, one cutover rehearsal, runbook and verification artifacts.
  - Out of scope (follow-up story): full certificate issuance automation stack and long-horizon SIEM pipeline integration.

### Technical Requirements

- External Vault contract:
  - Non-local environments must use externally managed Vault endpoint (TLS required).
  - CI OIDC auth path remains `auth/jwt/login` with scoped role.
  - Runtime auth uses AppRole credentials in deploy-time pre-start retrieval step only (application process does not query Vault directly at boot).
- Branch policy contract:
  - Protected branch/workflow scope for fail-closed policy:
    - branches: `main`, `release/*`
    - workflows: enumerated in `.github/vault-protected-workflows.txt`
    - allowlist integrity rule: each entry must map to an existing workflow file; broken entries fail policy check
  - Protected branch pipelines must not proceed in degraded mode when Vault resolution fails.
  - Degraded mode may remain optional only for explicitly non-protected/local simulation contexts.
  - Vault resolution failure taxonomy (all fail-closed on protected branches):
    - OIDC token fetch failure
    - `auth/jwt/login` failure
    - TLS trust/chain failure
    - certificate hostname/SAN mismatch
    - network timeout/unreachable Vault
    - KV read failure for required path
  - Failure taxonomy must map to deterministic outputs:
    - exit codes: `10`(OIDC), `11`(jwt login), `12`(TLS trust), `13`(SAN mismatch), `14`(timeout/unreachable), `15`(KV read)
    - log signature prefix: `VAULT_RESOLUTION_ERROR:<TYPE>`
  - Timeout/retry policy:
    - `connect_timeout=3s`
    - `read_timeout=5s`
    - `max_attempts=3`
    - retry backoff schedule: `2s`, `5s`
- Runtime injection contract:
  - Non-local environments use deploy-time pre-start retrieval (`read-internal-secret.sh` equivalent) and env injection before app startup.
  - Runtime application process does not perform ad hoc direct Vault fetch on boot path in this story scope.
  - Rotation propagation SLA: after secret rotation, next deployment/restart reflects new secret within `<=15m`.
  - Rotation SLA measurement:
    - start: `t0 = timestamp of successful rotation write response`
    - end: `t1 = first timestamp when all required probes pass with rotated secret`
    - condition: `t1 - t0 <= 15m`
- Secret contract:
  - Keep existing path conventions from Story 0.8 (`secret/fix/shared/...`) unless a migration mapping is explicitly documented.
  - Runtime and CI must not require root token in normal operation.
  - Secret handling controls:
    - `set -x` not allowed in secret retrieval/injection steps
    - secret values must be masked in CI logs
    - secret env variables must be unset in orchestrator shell immediately after process/container start handoff completes
    - secret values must not appear in evidence artifacts
- TTL contract:
  - CI JWT role: `token_ttl=5m`, `token_max_ttl=15m`
  - Runtime AppRole: `token_ttl=5m`, `token_max_ttl=30m`, `secret_id_ttl=24h`
  - Rotation AppRole: `token_ttl=5m`, `token_max_ttl=15m`, `secret_id_ttl=1h`
- Security contract:
  - Enforce TLS certificate verification in CI/runtime clients for non-local environments.
  - Enforce hostname/SAN validation and reject certificate mismatch.
  - Enforce HTTPS-only Vault address policy for non-local environments.
  - Certificate lifecycle controls:
    - document CA distribution path for CI/runtime
    - document certificate rotation procedure and validation checklist
    - define rollback trigger: any failed validation probe or handshake mismatch during rotation rehearsal
    - define downtime SLO during certificate cutover: cumulative impact `<=300s`
  - Keep capability boundaries (`read` vs `create/update`) and TTL constraints aligned to least privilege.
- Outage decision contract:
  - Protected branches and production runtime: fail-fast only
  - Non-protected/local simulation: degraded mode allowed only with explicit operator acknowledgement and documented rationale
- Audit contract:
  - external Vault audit evidence retention `>=90 days`
  - immutable storage policy for retained audit artifacts
  - accepted immutable implementations: `S3 Object Lock (Compliance mode)` or equivalent WORM storage with retention lock
- Cutover gate contract:
  - required probes list:
    - `channel-service /actuator/health`
    - `corebank-service /actuator/health`
    - `fep-gateway /actuator/health`
    - `fep-simulator /actuator/health`
    - one runtime secret read probe using deploy-time injection contract
  - critical secret-auth errors (must be zero):
    - `403`/`permission denied` on required Vault auth/read path
    - TLS handshake validation failure
    - missing required secret value at startup gate
    - Vault auth token acquisition failure after max retries
  - success gate: all required probes green within `<=300s` and `0` critical secret-auth errors
  - rollback trigger: any success gate breach or unresolved Vault auth error

### Architecture Compliance

- Preserve separation of concerns:
  - App repository defines integration contracts and validation checks.
  - Vault platform provisioning for production lives in operator process (runbook/IaC), not ad hoc app runtime bootstrap.
- Preserve fail-fast startup guard for runtime secret requirements.
- Do not regress Story 0.8 auditability and rotation controls while changing deployment topology.
- Documentation source-of-truth rule:
  - `docs/ops/vault-secrets-foundation.md` remains baseline design reference.
  - `docs/ops/vault-external-operations.md` contains external-ops delta only.
  - Any duplicated section must include explicit cross-reference and same-change sync checklist entry.

### Library/Framework Requirements

- Reuse existing shell + Vault CLI integration pattern in repository scripts/workflows.
- Avoid adding new secret-management client libraries unless required by deployment platform constraints.
- Keep policy definitions compatible with current Vault auth engines (`jwt`, `approle`).

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/.github/workflows/docs-publish.yml`
  - `/Users/yeongjae/fixyz/.github/vault-protected-workflows.txt`
  - `/Users/yeongjae/fixyz/scripts/vault/validate-nonlocal-profile.sh`
  - `/Users/yeongjae/fixyz/docker-compose.yml` (or environment/profile-specific compose files)
  - `/Users/yeongjae/fixyz/docker-compose.vault.yml` (local-only baseline path)
  - `/Users/yeongjae/fixyz/docker/vault/scripts/**`
  - `/Users/yeongjae/fixyz/docs/ops/vault-secrets-foundation.md`
  - `/Users/yeongjae/fixyz/docs/ops/vault-external-operations.md`
  - `/Users/yeongjae/fixyz/docs/ops/**` (external Vault cutover/outage/audit runbooks)
  - `/Users/yeongjae/fixyz/tests/vault/**`

### Testing Requirements

- Minimum checks for completion:
  - CI OIDC secret resolution works against external Vault endpoint in staging-like validation.
  - Protected branch/workflow matrix from `.github/vault-protected-workflows.txt` is verified as fail-closed when Vault is unreachable/misconfigured.
  - Workflow allowlist integrity check fails if `.github/vault-protected-workflows.txt` contains non-existent workflow file entries.
  - Vault failure taxonomy (`OIDC`, JWT login, TLS chain, SAN mismatch, timeout, KV read) each fails closed on protected branches.
  - Failure taxonomy exit codes (`10`..`15`) and `VAULT_RESOLUTION_ERROR:<TYPE>` log signatures are validated.
  - Timeout/retry policy is validated (`connect_timeout=3s`, `read_timeout=5s`, attempts=`3`, backoff `2s`,`5s`).
  - Non-local runtime profile does not depend on compose-local `vault-init` container.
  - `scripts/vault/validate-nonlocal-profile.sh` fails deployment if local Vault services are enabled.
  - Non-local runtime path uses deploy-time pre-start secret injection only (single approved approach).
  - HTTPS-only + CA trust + hostname verification checks are validated in CI and runtime configuration.
  - Certificate rotation rehearsal validates trust continuity without policy bypass.
  - Certificate rotation rollback trigger and downtime SLO (`<=300s`) are validated.
  - Secret retrieval scripts/workflows pass no-leak checks (`set -x` not present, masking/unset behavior verified).
  - Local developer flow via `docker-compose.vault.yml` remains functional and documented.
  - External-mode outage drill verifies decision matrix behavior (prod/protected fail-fast only; non-protected/local degraded optional by policy).
  - Vault role/policy capability and TTL checks pass for CI/runtime/rotation scopes.
  - Audit retrieval procedure yields actor/path evidence with immutable storage implementation (`S3 Object Lock Compliance mode` or equivalent) and retention `>=90d`.
  - Cutover rehearsal passes quantitative gates (`<=300s`, `0` critical auth errors); rollback trigger behavior is tested.
  - Rotation propagation rehearsal measures `t1 - t0 <=15m` using defined formula (`t0`: rotation success response time, `t1`: first all-probe green time with rotated secret).

### References

- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-8-vault-secrets-foundation.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-9-additional-infrastructure-bootstrap.md`
- `/Users/yeongjae/fixyz/docs/ops/vault-secrets-foundation.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/epic-0-project-foundation.md` (Story 0.8/0.9 continuity)
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0 baseline decomposition)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story drafted as post-0.8 follow-up for externalized Vault operations in non-local environments.

### Completion Notes List

- Created Story 0.13 as ready-for-dev with explicit external Vault cutover, fail-closed matrix, quantitative gates, and operational guardrails.

### File List

- _bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md
