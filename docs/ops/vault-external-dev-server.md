# AWS Single-Node Docker Vault Dev Server

## Scope

This document defines the lowest-cost non-local Vault rehearsal path currently accepted by Story `0.14`.

Use this profile when one engineer needs a standalone dev server for:

- external-Vault wiring checks away from the laptop
- `planning-review` preparation runs for Story `0.14`
- `live-external` normalization against the current Docker-based environment
- AppRole, audit-log, and secret-rotation dry runs without provisioning a separate staging-like cluster

This profile may satisfy Story `0.14` completion when the rehearsal is executed in `live-external` mode with explicit measured inputs and the resulting evidence is labeled `dev-docker-single-node`.

- It is still a non-prod single-node path.
- It does not prove HA or staging/prod equivalence.
- It is single-node only, so host failure means Vault downtime.

## Recommended AWS Shape

- Region: `ap-northeast-2` (Seoul)
- EC2: `t3.medium`
- Storage: `gp3 50GB`
- OS: `Ubuntu Server 22.04 LTS`
- Network exposure:
  - `8200/tcp` only from your VPN or a single operator IP
  - prefer SSM over broad SSH exposure

This shape is intentionally smaller than the staging-like guidance because it is meant for one-person dev preparation, not HA operation.

## Repository Assets

- Compose stack: `docker-compose.vault-external-dev.yml`
- Vault config: `docker/vault/config/vault-external-dev.hcl`
- Single-node init/unseal helper: `docker/vault/init/vault-single-node-bootstrap.sh`
- Host-local env template: `docs/ops/vault-external-dev.env.template`
- Bring-up helper: `scripts/vault/bootstrap-external-dev-server.sh`
- Make targets: `vault-external-dev-init-env`, `vault-external-dev-up`, `vault-external-dev-status`, `vault-external-dev-exports`, `vault-external-dev-planning-review`, `vault-external-dev-live`
- Shared bootstrap policies and helper scripts under `docker/vault/`

The compose stack runs Vault with persistent `raft` storage instead of `-dev` mode.

## First Boot

1. Provision the EC2 instance and install Docker Engine plus the Docker Compose plugin.
2. Clone this repository onto the host.
3. Copy the repository template to a private host-local env file:

```bash
make vault-external-dev-init-env
```

4. Edit `.env.external-dev` and replace at least:

```bash
INTERNAL_SECRET_BOOTSTRAP=replace-me
```

5. Start the single-node stack with the repository helper:

```bash
make vault-external-dev-up
```

6. Confirm the helper initialized and unsealed Vault:

```bash
make vault-external-dev-logs
make vault-external-dev-status
```

The bring-up helper wraps `docker compose --env-file ... up -d`, waits for init/unseal, and prints ready-to-export AppRole credentials. The bootstrap helper stores the dev-only root token, unseal key, and init JSON under `/vault/file/` inside the persistent volume so the node can recover across container restarts.

## Runtime Secret Read

Export the generated AppRole credentials from the running container:

```bash
make vault-external-dev-exports
```

Resolve the shared internal secret through the existing helper:

```bash
make vault-external-dev-secret
```

## Rotation Dry Run

Use the dedicated rotation AppRole for non-prod rehearsal:

```bash
export VAULT_ROTATION_ROLE_ID="$(docker exec vault-external-dev cat /vault/file/rotation-role-id)"
export VAULT_ROTATION_SECRET_ID="$(docker exec vault-external-dev cat /vault/file/rotation-secret-id)"

VAULT_ADDR="${VAULT_ADDR}" \
VAULT_RUNTIME_ROLE_ID="${VAULT_ROTATION_ROLE_ID}" \
VAULT_RUNTIME_SECRET_ID="${VAULT_ROTATION_SECRET_ID}" \
EVIDENCE_FILE=docs/ops/evidence/vault-rotation-drill.log \
./docker/vault/scripts/rotate-internal-secret.sh
```

## Story 0.14 Execution Use

Use `planning-review` when you are only drafting or dry-running the procedure:

```bash
make vault-external-dev-planning-review
```

Use `live-external` when you want the current Docker container environment itself to satisfy Story `0.14`:

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

Both Make targets default to `VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT=dev-docker-single-node` so the generated evidence stays clearly labeled as the repository-owned Docker completion path instead of being confused with `staging-like`.

For this Docker path, the helper accepts `VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT=not-applicable-http-dev-server` and `VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT=not-applicable-http-dev-server` because the checked-in stack is HTTP-only. Do not relabel this path as `staging-like`.

## Recovery Notes

- Container restart: `make vault-external-dev-up`
- If Vault comes back sealed, rerun the init helper:

```bash
docker compose --env-file .env.external-dev -f docker-compose.vault-external-dev.yml up vault-external-dev-init
```

- Preferred bring-up path after edits to `.env.external-dev`:

```bash
make vault-external-dev-up
```

- Persistent data lives in the `vault-external-dev-data` Docker volume.
- If that volume is deleted, the stored root token and unseal key are also lost, and Vault will be reinitialized on the next bootstrap run.
