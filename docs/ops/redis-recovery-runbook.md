# Redis Recovery and Self-Healing Runbook

## Scope

This runbook operationalizes story `0-12-redis-recovery-and-self-healing-baseline` and PRD `NFR-R3`.

- Recovery objective: all required probes green within **60 seconds** after Redis restart.
- Probe execution context: **compose network context** only (no host-only checks for internal services).
- Drill verdict gate: **100% pass** on required probes in one run.
- Stuck-state guardrail: fail if non-terminal order sessions exceed **TTL + 60s**.

## Preconditions

1. Baseline stack is up with valid environment variables (`INTERNAL_SECRET`, Vault bootstrap settings).
2. Required services are reachable from compose network:
   - `channel-service`
   - `corebank-service`
   - `fep-gateway`
   - `fep-simulator`
3. Operator has Docker access.

## Execute Drill

### Simulation (CI-safe)

```bash
REDIS_RECOVERY_MODE=simulate \
REDIS_RECOVERY_OUTPUT_DIR=docs/ops/redis-recovery/$(date +%Y%m%d) \
./scripts/redis-recovery/run-redis-recovery-drill.sh
```

### Live restart drill

```bash
REDIS_RECOVERY_MODE=live \
REDIS_RECOVERY_CONFIRM_LIVE=1 \
REDIS_RECOVERY_COMPOSE_FILE=docker-compose.yml \
ORDER_SESSION_TTL_SECONDS=600 \
./scripts/redis-recovery/run-redis-recovery-drill.sh
```

Live mode triggers:

```bash
docker compose restart redis
```

and validates required health + smoke probes through `redis-recovery-probe` from compose network.

## Probe Contract

Required probes (success quorum target = 100% pass):

- `channel-health` → `http://channel-service:8080/actuator/health`
- `corebank-health` → `http://corebank-service:8081/actuator/health`
- `fep-gateway-health` → `http://fep-gateway:8083/actuator/health`
- `fep-simulator-health` → `http://fep-simulator:8082/actuator/health`
- `auth-smoke` → `http://channel-service:8080/api/v1/ping`
- `session-smoke` → `http://fep-gateway:8083/api/v1/ping`
- `order-smoke` → `http://corebank-service:8081/api/v1/ping`

Outage normalization probes (during Redis outage window):

- `auth-outage` → `http://channel-service:8080/api/v1/errors/boom`
- `session-outage` → `http://fep-gateway:8083/api/v1/errors/boom`
- `order-outage` → `http://corebank-service:8081/api/v1/errors/boom`

Normalized failure contract: response contains `code`, `message`, and `path`.

## Evidence and Artifact Index

Each run writes artifacts under `docs/ops/redis-recovery/<YYYYMMDD>/`:

- `summary-<RUN_ID>.json`
- `latest-summary.json`
- `drill-<RUN_ID>.log`
- `index.json` (artifact index)

Required summary fields:

- restart timestamp and all-probes-green timestamp
- measured recovery seconds
- threshold verdict (`<= 60s`)
- success quorum percentage (must be 100)
- stuck-state threshold and breach count

## Failure Signatures and Troubleshooting Matrix

Failure signatures must be mapped to deterministic escalation actions.

| Failure signature | Likely cause | Immediate action | Escalation path |
| --- | --- | --- | --- |
| Recovery exceeds 60s | Service reconnect lag after Redis restart | Check `docker compose ps`, inspect unhealthy service logs, rerun drill | Escalate to backend on-call + platform lead |
| Required probe returns non-200 | Service not fully recovered or route mismatch | Run probe URL manually inside compose network, verify service health endpoint | Escalate to owning service team |
| Outage probe not normalized | Error handler drift | Compare payload shape to API error contract and deploy rollback if needed | Escalate to API contract owner |
| Stuck-state breach count > 0 (`TTL + 60s`) | Recovery scheduler did not converge session/order lifecycle | Query offending rows and execute recovery SOP/manual replay | Escalate to reliability owner + incident commander |
| Drill script cannot run live | Missing `REDIS_RECOVERY_CONFIRM_LIVE=1` or Docker access | Fix env guard/permissions and rerun | Escalate to platform operations |

## Escalation path

1. Service owner (channel/corebank/fep-gateway/fep-simulator)
2. Platform on-call engineer
3. Reliability owner
4. Incident commander (if SLA/SLO risk persists)

## Runbook-only rehearsal checklist

This section defines the runbook-only rehearsal protocol for clean-shell operators.

1. Open a clean shell without prior aliases/functions.
2. Follow only this runbook (no tribal knowledge).
3. Run simulation once, then run live drill once when safe.
4. Confirm evidence files are created and indexed.
5. Record operator notes in incident log.

Pass condition for runbook-only rehearsal: a new operator completes restart, verification, and escalation decisions without undocumented steps.
