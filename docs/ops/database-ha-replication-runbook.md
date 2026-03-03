# Database HA Replication Runbook

## Scope

Story `0-10-database-high-availability-and-replication-baseline` introduces a MySQL primary/replica baseline for operational drills and observability.

- **Scope boundary:** deploy/staging HA profile is available through `docker-compose.ha.yml`.
- **Local default single-node profile:** existing `docker-compose.yml` with `mysql` remains the local default single-node profile.
- **No implicit app behavior drift:** write/read routing policy is documented first; runtime adapter rollout can follow in a separate story.

## Topology and service connection patterns

- Primary node: `mysql-primary` (accepts writes, source of replication stream)
- Replica node: `mysql-replica` (read-only, replication target)
- Bootstrap contract: `docker/mysql/ha/scripts/bootstrap-replication.sh`
- Health contract: `docker/mysql/ha/scripts/collect-replication-health.sh`

Connection model:

- Write traffic: pinned to primary.
- Read traffic: explicit policy, default-safe routes stay on primary unless endpoint is allowlisted for replica-safe reads.
- Strong-consistency endpoint inventory: `docs/ops/read-routing-consistency-inventory.md`.

## Objectives and measurement contracts

Baseline SLO targets:

- `RTO <= 300s`
- `RPO <= 60s`

Explicit formulas:

- `RTO = t(all required probes green) - t(failover start)`
- `RPO = t(last committed transaction before outage) - t(last recovered committed transaction after failover)`

## Bring-up and replication bootstrap

```bash
# Start HA profile DB nodes
docker compose -f docker-compose.ha.yml --profile ha-db up -d mysql-primary mysql-replica

# Configure replica from primary source coordinates
BOOTSTRAP_REPLICATION_MODE=live \
./docker/mysql/ha/scripts/bootstrap-replication.sh
```

## Replication observability checks (state and lag)

```bash
REPLICATION_HEALTH_MODE=live \
REPLICATION_HEALTH_OUTPUT_FILE=docs/ops/evidence/database-ha-health-latest.json \
./docker/mysql/ha/scripts/collect-replication-health.sh
```

Expected output fields:

- `replication_state`
- `lag_seconds`
- `replica_io_running`
- `replica_sql_running`

These outputs are retained as troubleshooting evidence in `docs/ops/evidence/`.

## Alerting baseline (10s sampling cadence)

Alert policy:

- `warn: lag >= 5s for 3 consecutive samples @10s interval`
- `critical: lag >= 30s for 2 consecutive samples @10s interval`
- `critical` if `replication stopped >= 60s`

Evaluation command:

```bash
ALERT_SAMPLE_FILE=docs/ops/evidence/database-ha-alert-samples-20260303.jsonl \
ALERT_OUTPUT_FILE=docs/ops/evidence/database-ha-alert-drill-20260303.json \
ALERT_NOTIFICATION_TARGET=ops-oncall \
./docker/mysql/ha/scripts/evaluate-replication-alerts.sh
```

Alert output includes dedupe behavior (`severity+rule` dedupe until recovery) and actionable context (`lag_seconds`, `consecutive_samples`, notification target).

## Failover drill and evidence capture

```bash
FAILOVER_DRILL_MODE=simulate \
FAILOVER_EVIDENCE_FILE=docs/ops/evidence/database-ha-failover-drill-20260303.json \
./docker/mysql/ha/scripts/run-failover-drill.sh
```

For live drill runs, provide measured timestamps with:

- `FAILOVER_START_TS`
- `PROBES_GREEN_TS`
- `LAST_COMMITTED_BEFORE_OUTAGE_TS`
- `LAST_RECOVERED_COMMITTED_AFTER_FAILOVER_TS`

Evidence must retain formulas, raw timestamps, and computed `rto_seconds`/`rpo_seconds`.

## Backup and restore rehearsal (deterministic SHA-256)

```bash
RESTORE_REHEARSAL_MODE=simulate \
RESTORE_EVIDENCE_FILE=docs/ops/evidence/database-ha-restore-rehearsal-20260303.json \
./docker/mysql/ha/scripts/run-restore-rehearsal.sh
```

Deterministic export contract:

- Explicit table set in fixed order
- Stable dump options (`--skip-comments`, `--skip-extended-insert`, `--order-by-primary`)
- Integrity algorithm: `SHA-256`

Success criteria: `checksum_parity=true` for source vs restored export.

## Consistency and stale-read safety

When read-routing is enabled, strong-consistency paths must stay pinned to primary and stale-read risk scenarios must be validated using the inventory in `docs/ops/read-routing-consistency-inventory.md`.

## Rollback strategy

If HA profile introduces instability:

1. Stop HA profile services:
   ```bash
   docker compose -f docker-compose.ha.yml --profile ha-db down
   ```
2. Resume local default single-node profile via `docker-compose.yml`.
3. Keep evidence artifacts for postmortem and rerun HA drills in simulate mode before reattempting live failover.
