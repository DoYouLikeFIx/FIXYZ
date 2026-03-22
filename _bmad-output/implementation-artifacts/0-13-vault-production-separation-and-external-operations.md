# Story 0.13: Vault Production Separation and External Operations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want non-local Vault usage to be separated from local compose-owned services,
so that staging/production secret delivery uses external Vault contracts, fail-closed guardrails, and explicit ownership boundaries.

**Depends On:** Story 0.8, Story 0.9

## Acceptance Criteria

1. Given staging/production environments are used, when CI workflows resolve platform secrets, then GitHub Actions OIDC -> Vault JWT login succeeds against an external Vault endpoint over TLS, and protected workflows fail closed without degraded bypass.
2. Given protected workflow policy is defined, when `.github/vault-protected-workflows.txt` is validated, then every entry maps to an existing workflow file and policy checks fail on broken or stale allowlist entries.
3. Given runtime service startup in non-local environments, when the application stack boots, then secrets are delivered only by deploy-time pre-start retrieval plus environment injection using AppRole credentials, and deployment fails if local `vault` or `vault-init` services are enabled for non-local profiles.
4. Given Story 0.9 local bootstrap assumptions exist, when the non-local environment matrix is reviewed, then staging/production are explicitly marked `external-vault-only`, while `docker-compose.vault.yml` remains a local/dev-only bootstrap path.
5. Given repository-owned Vault integrations are inventoried, when non-local Vault rules are applied, then boot-path secret delivery and application-owned business-flow Vault clients are classified explicitly; the current `channel-service` TOTP Vault client is documented as a business-flow client that must follow the same external endpoint/TLS policy but is not replaced by startup env injection in this story.
6. Given least-privilege and bootstrap ownership constraints, when Vault roles/policies are provisioned, then one-time role/policy setup is owned by operator process or IaC, CI/runtime never require root token exposure, and TTL/capability contracts for CI/runtime/rotation remain enforced.
7. Given service/application configuration is hardened for non-local use, when secret-related defaults are evaluated, then local-only secret fallbacks and localhost Vault defaults are removed or explicitly profile-gated so non-local profiles fail closed on missing or invalid secret configuration.
8. Given repository guardrail coverage requirements, when tests and runbooks are reviewed, then failure taxonomy, deterministic exit codes/log signatures, HTTPS-only/CA trust/hostname verification, secret-log safety rules, and the explicit handoff to Story 0.14 are documented and regression-protected.

## Tasks / Subtasks

- [x] Define non-local Vault operating model and scope boundary (AC: 3, 4, 5, 8)
  - [x] Define environment matrix (`local/dev` vs `staging/prod`) and allowed Vault modes
  - [x] Explicitly supersede Story 0.9 local-Vault assumptions for non-local environments
  - [x] Inventory repository-owned Vault call sites and classify them as `boot-path injection` vs `business-flow client`
  - [x] Record Story 0.13 vs Story 0.14 boundary in the external-operations runbook
- [x] Harden CI protected-workflow guardrails for external Vault (AC: 1, 2, 6, 8)
  - [x] Add `.github/vault-protected-workflows.txt`
  - [x] Enforce allowlist integrity against real workflow files
  - [x] Update protected-branch policy so Vault resolution failures are fail-closed
  - [x] Define Vault resolution failure taxonomy (`OIDC`, `jwt login`, `TLS trust`, `hostname/SAN mismatch`, `timeout/unreachable`, `KV read`)
  - [x] Define deterministic exit codes (`10`..`19`) and `VAULT_RESOLUTION_ERROR:<TYPE>` log signatures
  - [x] Enforce HTTPS-only Vault endpoint policy plus CA trust and hostname verification checks, including allowlisted workflow policy validation
  - [x] Add secret-log safety guards (`set -x` prohibition, masking, and local secret cleanup contract)
- [x] Separate non-local runtime startup from local Vault bootstrap (AC: 3, 4, 7)
  - [x] Add deploy guard `scripts/vault/validate-nonlocal-profile.sh`
  - [x] Update compose/profile strategy so non-local paths do not depend on `vault-init`
  - [x] Keep `docker-compose.vault.yml` intact as the local-only bootstrap path
  - [x] Define deploy-time secret retrieval + env injection contract for non-local mode
  - [x] Remove or profile-gate local secret fallbacks and localhost Vault defaults for non-local profiles
- [x] Establish operator bootstrap and application-owned Vault client policy (AC: 5, 6, 7)
  - [x] Document/apply operator-owned external Vault policy and role provisioning sequence
  - [x] Confirm CI/runtime flows do not require root token at execution time
  - [x] Validate TTL and capability constraints for CI/runtime/rotation scopes
  - [x] Document `channel-service` TOTP Vault client as a business-flow integration that must align to external endpoint/TLS policy while broader migration stays deferred
- [x] Add contract tests and readiness documentation (AC: 1, 2, 3, 7, 8)
  - [x] Add tests asserting protected-branch fail-closed behavior using workflow allowlist file
  - [x] Add tests asserting allowlist integrity fails on non-existent workflow entries
  - [x] Add tests asserting failure taxonomy exit codes and log-signature mapping
  - [x] Add tests asserting non-local profiles reject local `vault`/`vault-init` dependency
  - [x] Add tests/assertions for local-only fallback gating and non-local fail-closed defaults
  - [x] Add checks ensuring secret-handling scripts never leak secrets (`set -x` blocked, masking/unset behavior verified)
  - [x] Publish `docs/ops/vault-external-operations.md` with explicit handoff to Story 0.14

## Dev Notes

### Developer Context Section

- Story 0.8 established the local Vault baseline; Story 0.13 converts that into an explicit non-local contract and guardrail story.
- Story 0.9 currently models `staging` around local `vault` and `vault-init`; this story must make the non-local override explicit instead of leaving it implicit.
- This story is the upstream contract anchor for Epic 12 dependencies. Cutover rehearsal, immutable evidence capture, and propagation measurements are intentionally moved to Story 0.14.
- Hidden dependency that must be handled explicitly:
  - `channel-service` production profile currently enables a direct Vault-backed TOTP secret store. This story must classify it as a business-flow Vault client and align its non-local endpoint/TLS policy, even though startup env injection only governs platform boot-path secrets.

### Technical Requirements

- Non-local Vault contract:
  - `staging` and `prod` must use an externally managed Vault endpoint over TLS.
  - Local compose-owned `vault` and `vault-init` remain supported only for local/dev bootstrap via `docker-compose.vault.yml`.
  - Story 0.9 `staging` component matrix/bootstrap assumptions must be updated or explicitly superseded for non-local profiles.
- CI contract:
  - Protected branches: `main`, `release/*`
  - Protected workflows: enumerated in `.github/vault-protected-workflows.txt`
  - In GitHub Actions, protected-branch and allowlist inputs must be derived from repository-owned workflow metadata, not workflow-defined env overrides.
  - Protected-branch failures must be fail-closed for:
    - OIDC token fetch failure
    - `auth/jwt/login` failure
    - TLS trust/chain failure
    - certificate hostname/SAN mismatch
    - network timeout/unreachable Vault
    - KV read failure for required path
  - Failure outputs:
    - exit codes: `10`(OIDC), `11`(jwt login), `12`(TLS trust), `13`(SAN mismatch), `14`(timeout/unreachable), `15`(KV read)
    - log signature prefix: `VAULT_RESOLUTION_ERROR:<TYPE>`
- Runtime boot-path contract:
  - Non-local startup uses deploy-time pre-start retrieval and environment injection only.
  - Non-local deploy guard must fail if local `vault`/`vault-init` services are present or enabled.
  - Secret environment variables must be masked where applicable and process-local secret material must be cleared immediately after handoff completes.
- Application-owned Vault client contract:
  - Current known repo-owned direct Vault client: `channel-service` TOTP Vault secret store.
  - It remains a business-flow client in Story 0.13 scope, but must align to the same non-local external endpoint, TLS verification, and ownership boundary rules.
  - Migration away from direct runtime business-flow Vault access is deferred unless required by a later story.
- TTL and capability contract:
  - CI JWT role: `token_ttl=5m`, `token_max_ttl=15m`
  - Runtime AppRole: `token_ttl=5m`, `token_max_ttl=30m`, `secret_id_ttl=24h`
  - Rotation AppRole: `token_ttl=5m`, `token_max_ttl=15m`, `secret_id_ttl=1h`
- Configuration hardening contract:
  - Local-only secret fallbacks and localhost Vault defaults must not silently apply to non-local profiles.
  - A profile-gated local fallback is acceptable only when it is impossible to activate in `staging`/`prod`.
- Security transport contract:
  - Explicit CA trust configuration (`VAULT_CACERT` or equivalent, including JVM truststore configuration for direct application clients)
  - GitHub OIDC requests continue to use platform trust; Vault-specific CA material must apply only to Vault TLS validation
  - Hostname/SAN verification required
  - Plaintext `http://` forbidden for non-local Vault addresses

### Architecture Compliance

- Preserve separation of concerns:
  - App repository owns integration contracts, guardrails, and validations.
  - External Vault provisioning for non-local use is operator/IaC owned, not ad hoc runtime bootstrap.
- Do not mix this story with the actual cutover rehearsal/evidence execution work; that moves to Story 0.14.
- Keep Story 0.13 as the mandatory upstream contract story referenced by Epic 12 planning documents.

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/.github/workflows/docs-publish.yml`
  - `/Users/yeongjae/fixyz/.github/vault-protected-workflows.txt`
  - `/Users/yeongjae/fixyz/scripts/vault/validate-nonlocal-profile.sh`
  - `/Users/yeongjae/fixyz/docker-compose.yml` (or environment/profile-specific compose files)
  - `/Users/yeongjae/fixyz/docker-compose.vault.yml`
  - `/Users/yeongjae/fixyz/docker/vault/scripts/**`
  - `/Users/yeongjae/fixyz/scripts/infra-bootstrap/component-matrix.yaml`
  - `/Users/yeongjae/fixyz/scripts/infra-bootstrap/bootstrap.sh`
  - `/Users/yeongjae/fixyz/scripts/infra-bootstrap/validate-nginx-vault.sh`
  - `/Users/yeongjae/fixyz/docs/ops/vault-secrets-foundation.md`
  - `/Users/yeongjae/fixyz/docs/ops/vault-external-operations.md`
  - `/Users/yeongjae/fixyz/tests/vault/**`
  - `/Users/yeongjae/fixyz/BE/channel-service/src/main/resources/application*.yml`
  - `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/TotpProperties.java`
  - `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/VaultTotpSecretStore.java`
  - `/Users/yeongjae/fixyz/BE/corebank-service/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/BE/fep-gateway/src/main/resources/application.yml`
  - `/Users/yeongjae/fixyz/BE/fep-simulator/src/main/resources/application.yml`

### Testing Requirements

- Minimum checks for completion:
  - Protected branch/workflow matrix from `.github/vault-protected-workflows.txt` is fail-closed when Vault is unreachable or misconfigured.
  - Allowlist integrity check fails on non-existent workflow entries.
  - Vault failure taxonomy exit codes (`10`..`19`) and `VAULT_RESOLUTION_ERROR:<TYPE>` log signatures are validated.
  - HTTPS-only, CA trust, and hostname verification checks are validated for CI and non-local runtime configuration.
  - Non-local runtime profile does not depend on compose-local `vault-init` container.
  - `scripts/vault/validate-nonlocal-profile.sh` fails when local Vault services are enabled for non-local use, including compose profile, compose file, and explicit service-targeting paths.
  - Local-only secret fallbacks and localhost Vault defaults are removed or profile-gated so non-local configurations fail closed.
  - Secret retrieval scripts/workflows pass no-leak checks (`set -x` absent, masking/cleanup behavior regression-protected).
  - `channel-service` TOTP Vault client classification and non-local endpoint/TLS alignment are documented and regression-protected, including custom truststore support for external Vault CA trust.

### References

- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-8-vault-secrets-foundation.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-9-additional-infrastructure-bootstrap.md`
- `/Users/yeongjae/fixyz/docs/ops/vault-secrets-foundation.md`
- `/Users/yeongjae/fixyz/scripts/infra-bootstrap/component-matrix.yaml`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/resources/application.yml`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/resources/application-prod.yml`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/TotpProperties.java`
- `/Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/VaultTotpSecretStore.java`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/epic-0-project-foundation.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- 2026-03-20: Story readiness review found hidden direct-Vault client scope, implicit Story 0.9 staging-contract override, over-large delivery scope, and non-local fallback ambiguity.
- 2026-03-20: Story revised to become the explicit non-local contract/guardrail story; heavy cutover rehearsal and immutable-evidence execution moved to Story 0.14.
- 2026-03-20: Implemented protected-workflow Vault resolver, non-local deploy guard, local-Vault profile gating, staging matrix override, and external-operations runbook.
- 2026-03-20: Hardened channel-service prod/staging secret profiles and added non-local TOTP Vault guard plus regression coverage.

### Completion Notes List

- Added `.github/vault-protected-workflows.txt` and `.github/scripts/vault/resolve-internal-secret.sh` so protected workflows resolve `INTERNAL_SECRET` through external Vault with allowlist validation, fail-closed exit codes, TLS guardrails, masking, and shell cleanup.
- Updated `.github/workflows/docs-publish.yml` to materialize CA trust, invoke the protected-workflow resolver, and keep controlled degraded mode limited to non-protected flows.
- Introduced `scripts/vault/validate-nonlocal-profile.sh`, updated `docker-compose.yml` so `vault`/`vault-init` are `local-vault` opt-in only, and removed app-service runtime coupling to `vault-init`.
- Updated `scripts/infra-bootstrap/component-matrix.yaml`, `scripts/infra-bootstrap/check-parity.sh`, and `scripts/infra-bootstrap/validate-nginx-vault.sh` so staging is explicitly `external-vault-only` while local Vault bootstrap remains in `docker-compose.vault.yml`.
- Published `docs/ops/vault-external-operations.md` and cross-linked the existing Vault/bootstrap runbooks with the Story 0.14 handoff.
- Hardened non-local service configuration with new `application-staging.yml` files, strict prod/staging secret injection, and profile-gated local fallback behavior.
- Added `VaultTotpSecretStoreProfileGuard` plus updated client wiring so `channel-service` TOTP Vault usage and internal-secret flows fail closed in non-local profiles while local/test contexts stay deterministic.
- Validation executed: `npm run lint:vault`, `npm run test:vault`, `npm run test:infra-bootstrap`, `npm test`, `./gradlew :channel-service:test --tests 'com.fix.channel.config.VaultTotpSecretStoreProfileGuardTest' --tests 'com.fix.channel.controller.ChannelProdTotpSecretStoreProfileTest' :channel-service:compileJava :corebank-service:compileJava :fep-gateway:compileJava :fep-simulator:compileJava`, `npm run test:be:critical-contract-suites`.

### File List

- _bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- .github/vault-protected-workflows.txt
- .github/scripts/vault/resolve-internal-secret.sh
- .github/workflows/docs-publish.yml
- .env.example
- docker-compose.yml
- package.json
- scripts/vault/validate-nonlocal-profile.sh
- scripts/infra-bootstrap/component-matrix.yaml
- scripts/infra-bootstrap/check-parity.sh
- scripts/infra-bootstrap/validate-nginx-vault.sh
- docs/ops/vault-external-operations.md
- docs/ops/vault-secrets-foundation.md
- docs/ops/infrastructure-bootstrap-runbook.md
- tests/vault/vault-external-operations.test.js
- tests/infra-bootstrap/bootstrap-baseline.test.js
- BE/channel-service/src/main/resources/application.yml
- BE/channel-service/src/main/resources/application-local.yml
- BE/channel-service/src/main/resources/application-prod.yml
- BE/channel-service/src/main/resources/application-staging.yml
- BE/channel-service/src/main/java/com/fix/channel/config/TotpProperties.java
- BE/channel-service/src/main/java/com/fix/channel/config/VaultTotpSecretStoreProfileGuard.java
- BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java
- BE/channel-service/src/main/java/com/fix/channel/client/HttpCorebankProvisioningClient.java
- BE/channel-service/src/test/java/com/fix/channel/config/VaultTotpSecretStoreProfileGuardTest.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelProdTotpSecretStoreProfileTest.java
- BE/corebank-service/src/main/resources/application-prod.yml
- BE/corebank-service/src/main/resources/application-staging.yml
- BE/corebank-service/src/main/java/com/fix/corebank/client/FepClient.java
- BE/corebank-service/src/main/java/com/fix/corebank/security/InternalSecretFilter.java
- BE/fep-gateway/src/main/resources/application-prod.yml
- BE/fep-gateway/src/main/resources/application-staging.yml
- BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/fix/FepSimulatorTraceBridgeClient.java
- BE/fep-gateway/src/main/java/com/fix/fepgateway/security/InternalSecretFilter.java
- BE/fep-simulator/src/main/resources/application-prod.yml
- BE/fep-simulator/src/main/resources/application-staging.yml
- BE/fep-simulator/src/main/java/com/fix/fepsimulator/security/InternalSecretFilter.java

### Change Log

- 2026-03-20: Implemented Story 0.13 external Vault guardrails, non-local bootstrap separation, service profile hardening, contract tests, and operator runbook handoff to Story 0.14.
