# External Vault Operations Runbook

## Scope

Story `0-13-vault-production-separation-and-external-operations` moves non-local environments to an `external-vault-only` contract.

- Protected workflow allowlist: `.github/vault-protected-workflows.txt`
- Protected workflow resolver: `.github/scripts/vault/resolve-internal-secret.sh`
- Non-local profile guard: `scripts/vault/validate-nonlocal-profile.sh`
- Local bootstrap baseline remains documented in `docs/ops/vault-secrets-foundation.md`

This runbook covers staging/prod expectations where Vault is operator-managed and is not bootstrapped from local `vault` or `vault-init` containers.

## Environment Contract

- `dev` and other local workflows may opt into Docker Vault with `COMPOSE_PROFILES=local-vault`.
- One-person non-local preparation may also use the repository-owned AWS single-node Docker Vault profile documented in `docs/ops/vault-external-dev-server.md`.
- `staging` and `prod` must keep `local-vault` disabled and must target an externally managed Vault endpoint.
- Application services receive `INTERNAL_SECRET` before startup; they do not wait on `vault-init`.
- `channel-service` runs a business-flow TOTP Vault client and therefore also requires:
  - `AUTH_TOTP_VAULT_BASE_URL`
  - `AUTH_TOTP_VAULT_TOKEN`

## AWS Single-Node Dev Server Profile

Story `0.14` now carries an explicit low-cost preparation profile for engineers who cannot provision an HA external Vault cluster during development.

- target shape: AWS `t3.medium` + `gp3 50GB`
- deployment asset: `docker-compose.vault-external-dev.yml`
- host-local env template: `docs/ops/vault-external-dev.env.template`
- bring-up helper: `scripts/vault/bootstrap-external-dev-server.sh`
- make targets: `vault-external-dev-init-env`, `vault-external-dev-up`, `vault-external-dev-status`, `vault-external-dev-exports`, `vault-external-dev-planning-review`, `vault-external-dev-live`
- storage mode: persistent single-node `raft`
- bootstrap helper: `docker/vault/init/vault-single-node-bootstrap.sh`
- intended use: AppRole wiring checks, audit-log dry runs, rotation dry runs, `planning-review` preparation evidence, and repository-owned `live-external` completion evidence under `dev-docker-single-node`

Guardrails for this profile:

- it is non-prod and single-node only
- it may produce both `planning-review` artifacts and Story `0.14` done-state evidence when the execution mode is `live-external` and the environment is `dev-docker-single-node`
- it must not be relabeled as `staging-like`
- it does not prove HA or staging/prod equivalence

Bring-up sequence:

```bash
make vault-external-dev-init-env
make vault-external-dev-up

make vault-external-dev-status
make vault-external-dev-exports
```

Then resolve the shared secret through the existing helper:

```bash
export INTERNAL_SECRET="$(
  VAULT_ADDR="${VAULT_ADDR}" \
  VAULT_RUNTIME_ROLE_ID="${VAULT_RUNTIME_ROLE_ID}" \
  VAULT_RUNTIME_SECRET_ID="${VAULT_RUNTIME_SECRET_ID}" \
  ./docker/vault/scripts/read-internal-secret.sh
)"
```

For the full operator checklist and recovery notes, continue with `docs/ops/vault-external-dev-server.md`.

## Protected GitHub Workflow Behavior

1. Add the workflow path to `.github/vault-protected-workflows.txt`.
2. Protected branches invoke `.github/scripts/vault/resolve-internal-secret.sh` when Vault is configured; workflows may explicitly enter documented degraded mode before invocation when the repository does not provide `VAULT_ADDR`.
3. Protected flows fail closed once the resolver is invoked when:
   - the allowlist file is missing, empty, or contains a stale workflow path
   - an allowlisted workflow does not request `id-token: write` in the same job that invokes `.github/scripts/vault/resolve-internal-secret.sh`
   - the current workflow path is not allowlisted
   - `VAULT_ADDR` is not `https://`
   - `VAULT_CACERT` is missing or unreadable
   - GitHub OIDC request metadata is unavailable
   - Vault cannot return `secret/fix/shared/core-services/internal-secret`
4. Non-protected flows may enter controlled degraded mode (`VAULT_SECRET_MODE=degraded`) for branch-level iteration, including classified Vault resolution failures after the resolver has started.
5. In real GitHub Actions runs, protected-branch and allowlist inputs are derived from `GITHUB_REF_NAME`, `GITHUB_WORKFLOW_REF`, and the repository-owned `.github/vault-protected-workflows.txt`; workflow-level env overrides do not redefine those security boundaries.
6. The GitHub OIDC token request uses the runner's default trust store. `VAULT_CACERT` applies to Vault TLS validation, not to `token.actions.githubusercontent.com`.

### Resolver Exit Codes

- `10` -> `OIDC`
- `11` -> `JWT_LOGIN`
- `12` -> `TLS_TRUST`
- `13` -> `HOSTNAME_SAN`
- `14` -> `TIMEOUT_UNREACHABLE`
- `15` -> `KV_READ`
- `16` -> `ALLOWLIST`
- `17` -> `DEPENDENCY`
- `18` -> `EXPORT`
- `19` -> `CONFIG`

## Non-Local Deployment Checklist

1. Set `DEPLOY_ENV=staging` or `DEPLOY_ENV=prod`.
2. Keep `COMPOSE_PROFILES` empty or limited to non-local-safe profiles.
3. Run `scripts/vault/validate-nonlocal-profile.sh` before any compose operation. Pass through the same compose arguments when profiles or explicit services are involved, for example `scripts/vault/validate-nonlocal-profile.sh --profile observability up`. The guard also inspects `COMPOSE_FILE` when compose file selection is provided through environment.
4. Export:
   - `INTERNAL_SECRET`
   - `COREBANK_INTERNAL_SECRET` when channel-to-corebank traffic uses a dedicated boundary secret
   - `AUTH_TOTP_VAULT_BASE_URL`
   - `AUTH_TOTP_VAULT_TOKEN`
   - `AUTH_TOTP_VAULT_TRUST_STORE_PATH` when the external Vault CA is not already trusted by the JVM
   - `AUTH_TOTP_VAULT_TRUST_STORE_PASSWORD` / `AUTH_TOTP_VAULT_TRUST_STORE_TYPE` when a custom truststore is used
5. Confirm every non-local profile file resolves strict env-backed values with no `local-internal-secret` fallback.

## TOTP Vault Client Guardrails

`channel-service` is not covered by the shared `INTERNAL_SECRET` injection alone. Its TOTP enrollment and verification path is a separate Vault client and must satisfy all of the following in staging/prod:

- HTTPS Vault base URL
- Non-default token
- Custom JVM truststore configuration when the external Vault CA is private
- No localhost or in-cluster dev endpoint assumptions
- Explicit prod/staging profile overrides

## Story 0.14 Entry Criteria and Ownership Handoff

Live rehearsal gate: Story `0.13` is `done` before any `live-external` execution begins.

Required entry criteria for Story `0.14`:

- external `VAULT_ADDR` is available for the chosen completion environment
- `VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT` is either `staging-like` or `dev-docker-single-node` for any `live-external` normalization that can satisfy Story `0.14`
- CA distribution path and truststore path are documented and accessible to CI/runtime
- CI OIDC and runtime auth roles already exist
- audit export or query access exposes actor/path metadata
- immutable evidence sink is available with `S3 Object Lock Compliance mode` or equivalent WORM retention lock
- named rollback owner is present for the rehearsal window

Repository-owned vs operator/IaC-owned boundaries:

| Repository-owned | Operator/IaC-owned |
| --- | --- |
| runbook, decision matrix, probe contract, evidence schema, helper scripts, regression tests | external Vault instance, auth role provisioning, audit backend/export, immutable storage policy, live restart authorization |
| `docs/ops/vault-external-operations.md` | target environment rollout window |
| `docs/ops/evidence/vault-external/` | actual completion-environment evidence source |
| `scripts/vault/run-external-cutover-rehearsal.sh` | rollback authority and change approval |

## Story 0.14 Decision Matrix

Only explicitly documented non-protected or local preparation paths may allow degraded mode.

| Environment or path | Vault outage expectation | Allowed execution mode | Completion impact |
| --- | --- | --- | --- |
| protected GitHub workflow on protected branch | fail-fast | `live-external` | required for hard gate verification |
| staging/prod runtime equivalent | fail-fast | `live-external` | required for cutover completion |
| AWS single-node Docker dev server | fail-fast for protected paths, degraded only on explicitly documented non-protected paths | `planning-review` or `live-external` | accepted repository-owned completion surrogate when labeled `dev-docker-single-node` |
| non-protected branch rehearsal | degraded allowed only when explicitly documented | `planning-review` or `live-external` | supports preparation; not sufficient alone |
| local simulation or documentation dry run | degraded allowed | `planning-review` | cannot satisfy Story `0.14` done-state |

Decision matrix verdict rules:

- protected branches and production-runtime equivalents must remain `fail-fast`
- degraded mode is allowed only for explicitly documented non-protected or local rehearsal paths
- any undocumented degraded path during `live-external` execution requires rollback

## Story 0.14 Required Probe Contract

Required probes for live cutover success:

- `channel-service /actuator/health`
- `corebank-service /actuator/health`
- `fep-gateway /actuator/health`
- `fep-simulator /actuator/health`
- runtime secret-effectiveness probe:
  - `corebank-service /internal/v1/ping`
  - header `X-Internal-Secret: ${COREBANK_INTERNAL_SECRET:-$INTERNAL_SECRET}`
  - require HTTP `200`

Success gate for cutover:

- all required probes green within `<=300s`
- `critical secret-auth errors` remain `0`
- rollback is triggered on any gate breach

`critical secret-auth errors` include:

- `403` or `permission denied` on required Vault auth or read paths
- TLS trust failure
- certificate hostname/SAN mismatch
- missing required secret at startup
- Vault auth token acquisition failure after max retries

## Story 0.14 Fresh Evidence Contract

Each rehearsal run writes artifacts under `docs/ops/evidence/vault-external/<YYYYMMDD>/`:

- `summary-<RUN_ID>.json`
- `latest-summary.json`
- `index.json`
- `cutover-<RUN_ID>.log`
- `audit-retention-<RUN_ID>.json`
- `trust-continuity-<RUN_ID>.json`
- `rotation-propagation-<RUN_ID>.json`

Required summary and index metadata:

- `run_id`, `execution_mode`, `environment`, `operator`, `change_ref`
- `start_ts`, `end_ts`, `all_probes_green_ts`
- `decision_matrix_verdict`, `rollback_triggered`, `rollback_reason`
- `critical_secret_auth_error_count`
- `cutover_seconds`
- `rotation_t0`, `rotation_t1`, `rotation_seconds`
- `audit_retention_days`, `immutable_store_type`, `immutable_evidence_ref`

`planning-review` or local simulation artifacts may support preparation, but only `live-external` evidence from either `staging-like` or `dev-docker-single-node` can satisfy Story `0.14`.

Artifacts from the AWS single-node Docker dev-server profile must keep the non-prod environment label `dev-docker-single-node`; they may not reuse `staging-like`.

Story `0.13` gating is always read from the repository sprint ledger at `_bmad-output/implementation-artifacts/sprint-status.yaml`. Caller-supplied override paths are not accepted for `live-external` promotion decisions.

`live-external` runs must also satisfy all of the following before they can emit `live-external-ready`:

- `VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR` must be `docs/ops/evidence/vault-external/<YYYYMMDD>`
- `VAULT_EXTERNAL_REHEARSAL_RUN_ID` must be a filename-safe token and must be reused inside run-scoped external references
- `VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS`, `VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF`, and `VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE` must include the current `RUN_ID`
- `VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE` must explicitly identify `S3 Object Lock Compliance mode`, an equivalent `WORM` retention lock, or the repository-owned `docker-volume-retained` evidence contract when `environment=dev-docker-single-node`
- `VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT`, `VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS`, and `VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE` must be supplied explicitly for live evidence

## Rehearsal Commands

Planning review artifact generation:

```bash
VAULT_EXTERNAL_REHEARSAL_RUN_ID=$(date -u +%Y%m%dT%H%M%SZ) \
VAULT_EXTERNAL_REHEARSAL_MODE=planning-review \
VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR=docs/ops/evidence/vault-external/$(date +%Y%m%d) \
VAULT_EXTERNAL_REHEARSAL_OPERATOR=platform-ops \
VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT=staging-like \
VAULT_EXTERNAL_REHEARSAL_CHANGE_REF=CRQ-014 \
VAULT_EXTERNAL_REHEARSAL_ROLLBACK_OWNER=vault-oncall \
VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH=/etc/ssl/certs/vault-ca.pem \
VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH=/opt/fix/vault-truststore.p12 \
VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS=audit://vault/export \
VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE='S3 Object Lock Compliance mode' \
VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF=s3://vault-evidence/fix/story-0-14 \
./scripts/vault/run-external-cutover-rehearsal.sh
```

Live external normalization command:

```bash
VAULT_EXTERNAL_REHEARSAL_RUN_ID=20260320T140000Z \
VAULT_EXTERNAL_REHEARSAL_MODE=live-external \
VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR=docs/ops/evidence/vault-external/20260320 \
VAULT_EXTERNAL_REHEARSAL_CONFIRM_LIVE=1 \
VAULT_EXTERNAL_REHEARSAL_OPERATOR=platform-ops \
VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT=staging-like \
VAULT_EXTERNAL_REHEARSAL_CHANGE_REF=CRQ-014 \
VAULT_EXTERNAL_REHEARSAL_ROLLBACK_OWNER=vault-oncall \
VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH=/etc/ssl/certs/vault-ca.pem \
VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH=/opt/fix/vault-truststore.p12 \
VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS='audit://vault/export?run_id=20260320T140000Z' \
VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE='S3 Object Lock Compliance mode' \
VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF=s3://vault-evidence/fix/story-0-14/20260320T140000Z \
VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS=120 \
VAULT_EXTERNAL_REHEARSAL_START_TS=2026-03-20T14:00:00Z \
VAULT_EXTERNAL_REHEARSAL_ALL_PROBES_GREEN_TS=2026-03-20T14:04:30Z \
VAULT_EXTERNAL_REHEARSAL_END_TS=2026-03-20T14:05:00Z \
VAULT_EXTERNAL_REHEARSAL_ROTATION_T0=2026-03-20T14:10:00Z \
VAULT_EXTERNAL_REHEARSAL_ROTATION_T1=2026-03-20T14:20:00Z \
VAULT_EXTERNAL_REHEARSAL_TRUST_DOWNTIME_SECONDS=240 \
VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT=0 \
VAULT_EXTERNAL_REHEARSAL_DECISION_MATRIX_VERDICT=fail-fast-enforced \
VAULT_EXTERNAL_REHEARSAL_PROTECTED_OUTAGE_VERDICT=fail-fast \
VAULT_EXTERNAL_REHEARSAL_NON_PROTECTED_OUTAGE_VERDICT=degraded-allowed \
VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT=passed \
VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT=passed \
VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE='openssl s_client -verify_hostname vault.example.internal # run_id=20260320T140000Z' \
VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_STATUS=200 \
VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_DETAIL='X-Internal-Secret accepted by corebank-service /internal/v1/ping' \
VAULT_EXTERNAL_REHEARSAL_ACTOR_PATH_METADATA_PRESENT=1 \
VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE='restart channel-service,restart corebank-service,restart fep-gateway,restart fep-simulator' \
./scripts/vault/run-external-cutover-rehearsal.sh
```

Docker single-node live completion command:

```bash
make vault-external-dev-live \
  VAULT_EXTERNAL_REHEARSAL_START_TS=2026-03-21T12:00:00Z \
  VAULT_EXTERNAL_REHEARSAL_ALL_PROBES_GREEN_TS=2026-03-21T12:03:30Z \
  VAULT_EXTERNAL_REHEARSAL_END_TS=2026-03-21T12:04:00Z \
  VAULT_EXTERNAL_REHEARSAL_ROTATION_T0=2026-03-21T12:10:00Z \
  VAULT_EXTERNAL_REHEARSAL_ROTATION_T1=2026-03-21T12:18:00Z \
  VAULT_EXTERNAL_REHEARSAL_TRUST_DOWNTIME_SECONDS=0 \
  VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT=0 \
  VAULT_EXTERNAL_REHEARSAL_DECISION_MATRIX_VERDICT=fail-fast-enforced \
  VAULT_EXTERNAL_REHEARSAL_PROTECTED_OUTAGE_VERDICT=fail-fast \
  VAULT_EXTERNAL_REHEARSAL_NON_PROTECTED_OUTAGE_VERDICT=degraded-allowed \
  VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_STATUS=200 \
  VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_DETAIL='X-Internal-Secret accepted by corebank-service /internal/v1/ping' \
  VAULT_EXTERNAL_REHEARSAL_ACTOR_PATH_METADATA_PRESENT=1 \
  VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS=90 \
  VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE='restart channel-service,restart corebank-service,restart fep-gateway,restart fep-simulator'
```

For the repository-owned HTTP Docker path, the helper accepts `VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT=not-applicable-http-dev-server` and `VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT=not-applicable-http-dev-server`.

## Operator Env Template

Start from the repository-owned template and move the working copy to a private path before filling in live values:

```bash
cp docs/ops/evidence/vault-external/live-external.env.template \
  .codex/tmp/vault-external-live.env
chmod 600 .codex/tmp/vault-external-live.env
```

Recommended first edits in the copied file:

- replace the sample `VAULT_EXTERNAL_REHEARSAL_RUN_ID`
- confirm `VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR` matches the `RUN_ID` day
- replace operator-owned values for audit access, immutable evidence ref, verification reference, and measured timestamps

## Preflight Commands

Run these commands after updating the copied env file and before executing the live rehearsal:

```bash
ENV_FILE=.codex/tmp/vault-external-live.env

set -a
source "${ENV_FILE}"
set +a

bash -n ./scripts/vault/run-external-cutover-rehearsal.sh

rg -n '^\s*0-13-vault-production-separation-and-external-operations:\s*done$' \
  _bmad-output/implementation-artifacts/sprint-status.yaml

test "${VAULT_EXTERNAL_REHEARSAL_MODE}" = "live-external"
printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT}" | grep -Eq '^(staging-like|dev-docker-single-node)$'

printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR}" | grep -Eq '^docs/ops/evidence/vault-external/[0-9]{8}$'
printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_RUN_ID}" | grep -Eq '^[A-Za-z0-9._-]+$'

printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS}" | grep -F -- "${VAULT_EXTERNAL_REHEARSAL_RUN_ID}"
printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF}" | grep -F -- "${VAULT_EXTERNAL_REHEARSAL_RUN_ID}"
printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE}" | grep -F -- "${VAULT_EXTERNAL_REHEARSAL_RUN_ID}"

printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE}" | grep -Eiq 'object lock compliance mode|worm'
printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_TRUST_DOWNTIME_SECONDS}" | grep -Eq '^[0-9]+$'
printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT}" | grep -Eq '^[0-9]+$'
printf '%s\n' "${VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS}" | grep -Eq '^[0-9]+$'
test -n "${VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE}"

env | rg '^VAULT_EXTERNAL_REHEARSAL_' | sort
```

If all commands succeed, execute the live rehearsal with:

```bash
set -a
source "${ENV_FILE}"
set +a

./scripts/vault/run-external-cutover-rehearsal.sh
```

## Outage and Cutover Rehearsal Procedure

1. Confirm Story `0.13` is closed and all entry criteria above are present.
2. Record operator, environment, change reference, rollback owner, immutable evidence target, and trust bundle locations.
3. Trigger the external Vault outage or access denial scenario in the approved rehearsal window.
4. Verify the decision matrix:
   - protected branches and production-runtime equivalents stay `fail-fast`
   - degraded mode appears only on explicitly documented non-protected or local preparation paths
5. Restore or re-point external Vault access and measure cutover:
   - start timer at cutover start
   - wait for all required probes to go green
   - require cutover completion within `<=300s`
   - require `critical secret-auth errors` count to remain `0`
6. If any gate fails, trigger rollback immediately and record the breach reason in the evidence pack.

## Audit Retention and Immutable Evidence Procedure

1. Export or query audit evidence for the rehearsal window.
2. Confirm actor/path metadata is present in the captured evidence.
3. Record the retention contract:
   - minimum retention `>=90 days`
   - immutable store uses `S3 Object Lock Compliance mode` or equivalent WORM lock
4. Save run-scoped evidence references that include the current `RUN_ID` in the audit artifact and the run summary.

## Trust Continuity Rehearsal

Record the following:

- CA distribution path for CI/runtime
- truststore path used by the application or JVM
- hostname/SAN verification result
- verification command or evidence reference
- rollback trigger outcome
- cumulative downtime SLO `<=300s`

Any failed hostname/SAN verification or trust validation mismatch requires rollback.

## Rotation Propagation Rehearsal

Required measurement formula:

- `t0: successful rotation write response`
- `t1: first all-probe green timestamp with rotated secret`
- `t1 - t0 <= 15m`

Rotation procedure:

1. Rotate one critical secret in external mode.
2. Execute the observed restart sequence and record the exact ordered steps in `VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE`.
3. Verify the runtime secret-effectiveness probe returns HTTP `200`.
4. Record the observed propagation window using the formula above.

## Rollback Triggers

Rollback is required when any of the following occur:

- required probes do not return green within `<=300s`
- runtime secret-effectiveness probe fails
- `critical secret-auth errors` count is non-zero
- trust continuity downtime exceeds `<=300s`
- hostname or SAN verification fails
- rotation propagation exceeds `<=15m`

## Handoff To Story 0.14

Story `0.14` owns the operator rehearsal and evidence work that sits on top of this contract:

- external Vault cutover rehearsal
- outage drill evidence
- audit retention capture
- trust continuity proof
- rotation propagation measurement

Use this runbook to establish the external-vault-only contract first, then execute the evidence workflow from Story `0.14`.
