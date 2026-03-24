# Infrastructure Bootstrap Runbook

## Scope

Story `0-9-additional-infrastructure-bootstrap` bootstrap for dev/staging foundation parity.

- Entry point: `scripts/infra-bootstrap/bootstrap.sh`
- Component matrix: `scripts/infra-bootstrap/component-matrix.yaml`
- Integration validation: `scripts/infra-bootstrap/validate-nginx-vault.sh`
- Drift detection: `scripts/infra-bootstrap/check-parity.sh`

## Preconditions

1. Docker Engine and Docker Compose plugin installed.
2. `.env` populated from `.env.example`.
3. Vault bootstrap values are set (`VAULT_DEV_ROOT_TOKEN_ID`, `INTERNAL_SECRET_BOOTSTRAP`).
4. Local Vault bootstrap is opt-in via `COMPOSE_PROFILES=local-vault`.

## First-time bootstrap

Run this sequence in order:

```bash
cp .env.example .env
# edit .env and set required non-empty values
export COMPOSE_PROFILES=local-vault

# Phase 1: foundation provisioning + static contracts
BOOTSTRAP_ENV=dev \
BOOTSTRAP_SKIP_RUNTIME_VALIDATION=1 \
./scripts/infra-bootstrap/bootstrap.sh
```

Expected machine-checkable output files:

- `scripts/infra-bootstrap/output/bootstrap-report.json`
- `scripts/infra-bootstrap/output/parity-report.json`

`bootstrap-report.json` includes component-level status (`provisioned` or `already-present`) and output paths.

## Runtime validation for Nginx + Vault wiring

After app stack startup with Vault-resolved `INTERNAL_SECRET`, run full validation:

```bash
BOOTSTRAP_ENV=dev \
BOOTSTRAP_SKIP_RUNTIME_VALIDATION=0 \
SKIP_COMPOSE_UP=1 \
./scripts/infra-bootstrap/bootstrap.sh
```

Validation includes:

- Nginx edge checks from `docker/nginx/scripts/validate-edge-gateway.sh`
- Vault secret-read check via `docker/vault/scripts/read-internal-secret.sh`
- Policy/config contract checks for `runtime-internal-secret.hcl` and `ci-docs-publish.hcl`
- Idempotent MySQL service-database grant reconciliation for existing `mysql-data` volumes via `scripts/infra-bootstrap/repair-service-databases.sh`

For `staging`/`prod`, use the external Vault contract and profile guard documented in `docs/ops/vault-external-operations.md`.

## Idempotent re-run

The bootstrap entry point is idempotent. Re-running the same command converges safely:

```bash
BOOTSTRAP_ENV=dev ./scripts/infra-bootstrap/bootstrap.sh
```

Already-created resources are detected and marked as `already-present` without destructive replacement.
Existing local `mysql-data` volumes are also reconciled non-destructively so newly introduced service databases/grants do not require a manual volume reset.

## Parity and drift detection

Run parity check independently:

```bash
PARITY_ENV=dev ./scripts/infra-bootstrap/check-parity.sh
```

- `PARITY_STATUS=PASS`: baseline matches expected state.
- `PARITY_STATUS=FAIL`: inspect `missing_components` and `misaligned_components` in the parity report.

To validate drift handling, induce a controlled mismatch:

```bash
PARITY_ENV=dev \
PARITY_SKIP_DOCKER=1 \
PARITY_INDUCED_MISMATCH_COMPONENT=edge-gateway \
./scripts/infra-bootstrap/check-parity.sh
```

Expected: non-zero exit and `misaligned_components` contains `induced/edge-gateway`.

## Partial-failure recovery

Deterministic recovery is supported through either rollback or re-run.

### Option A: auto rollback (resources created in current run only)

```bash
BOOTSTRAP_AUTOROLLBACK=1 \
SIMULATE_FAILURE_STEP=parity-check \
./scripts/infra-bootstrap/bootstrap.sh
```

Behavior:

- Script exits non-zero.
- Rollback attempts removal in reverse order for resources created in the current run:
  - bootstrap-created containers (`vault`, `vault-init`)
  - bootstrap-created volumes/networks
- Rollback outcome is reported in `rollback_status` (`success`, `failed`, or `skipped` when `BOOTSTRAP_AUTOROLLBACK=0`) inside `bootstrap-report.json`.

### Option B: deterministic re-run (recommended default)

```bash
BOOTSTRAP_AUTOROLLBACK=0 ./scripts/infra-bootstrap/bootstrap.sh
```

Behavior:

- No destructive rollback.
- Re-run converges by reconciling missing parts and preserving existing healthy components.

## Onboarding checklist for new engineers

1. Configure `.env` from `.env.example`.
2. Run phase-1 bootstrap command (static validation mode).
3. Confirm `scripts/infra-bootstrap/output/bootstrap-report.json` has `overall_status=success`.
4. Run `./scripts/infra-bootstrap/check-parity.sh` and confirm `PARITY_STATUS=PASS`.
5. Start application stack and run full bootstrap validation mode (`BOOTSTRAP_SKIP_RUNTIME_VALIDATION=0`).
