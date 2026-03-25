# Full-Stack Smoke Rehearsal Runbook

## Scope

Story `10.4` release-readiness rehearsal for the repository-owned Docker stack.

- Cold-start smoke: `scripts/release-readiness/run-full-stack-smoke.sh`
- Five-session isolation rehearsal: `scripts/release-readiness/run-five-session-isolation.mjs`
- Rollback rehearsal: `scripts/release-readiness/run-rollback-rehearsal.sh`
- Supporting baseline: `docs/ops/infrastructure-bootstrap-runbook.md`

## Preconditions

1. `.env` is populated from `.env.example`.
2. `VAULT_DEV_ROOT_TOKEN_ID`, `INTERNAL_SECRET_BOOTSTRAP`, and `INTERNAL_SECRET` are set.
3. Docker Engine and Docker Compose plugin are available.
4. The release manager has a named rollback owner and a change reference for the rehearsal window.

## Canonical Story 10.4 Sequence

Run the Story `10.4` rehearsal in this order:

```bash
COMPOSE_PROFILES=observability \
./scripts/release-readiness/run-full-stack-smoke.sh

node ./scripts/release-readiness/run-five-session-isolation.mjs

./scripts/release-readiness/run-rollback-rehearsal.sh

npm run assemble:story-10-4:evidence
```

Expected evidence output under `_bmad-output/test-artifacts/epic-10/<build-id>/story-10-4/`:

- `cold-start-timing.json`
- `docs-summary.json`
- `smoke-summary.json`
- `session-isolation-summary.json`
- `rollback-rehearsal-summary.json`
- `go-no-go-summary.json`
- `go-no-go-summary.md`
- `matrix-summary.json`
- `matrix-summary.md`

## Cold-Start Target

The release gate is green only when all of the following are true:

1. `docker compose up` reaches the first mandatory API response within 120 seconds.
2. Health endpoints for the critical services are green.
3. Mandatory API/docs endpoints respond correctly.
4. Prometheus targets are `UP` and Grafana is reachable.

## Rollback Strategy

Story `10.4` adopts the deterministic re-run pattern from `docs/ops/infrastructure-bootstrap-runbook.md`.

- Preferred rollback strategy: re-apply the reviewed compose baseline for
  `edge-gateway channel-service corebank-service fep-gateway fep-simulator prometheus grafana`
- Rehearsal owner must record:
  - operator
  - change reference
  - rollback owner
  - linked Story 10.4 evidence paths

### Simulate Mode

Use simulate mode for dry-run verification of the documented rollback sequence:

```bash
ROLLBACK_REHEARSAL_MODE=simulate \
./scripts/release-readiness/run-rollback-rehearsal.sh
```

### Execute Mode

Use execute mode only during an approved rehearsal window:

```bash
ROLLBACK_REHEARSAL_MODE=execute \
ROLLBACK_REHEARSAL_CONFIRM_EXECUTE=1 \
./scripts/release-readiness/run-rollback-rehearsal.sh
```

Execute mode must be treated as a controlled rehearsal. If the compose re-apply fails, the rehearsal is failed and release readiness remains `no-go`.

## Go/No-Go Update Procedure

After smoke, session isolation, rollback rehearsal, and evidence assembly complete:

1. Open `go-no-go-summary.json` and `go-no-go-summary.md`.
2. Open `matrix-summary.json` and `matrix-summary.md`.
3. Confirm linked evidence paths point to the same Story `10.4` rehearsal run.
4. Update the release review with:
   - smoke status
   - session isolation status
   - rollback rehearsal status
   - final `go` or `no-go` decision
5. If any prerequisite evidence is not `passed`, mark the review as `no-go`.

## Failure Handling

Mark the rehearsal as failed and stop promotion review when any of the following occur:

- cold-start target exceeds 120 seconds
- mandatory API/docs checks fail
- session isolation shows cookie or session cross-contamination
- rollback compose re-apply fails
- required evidence artifact is missing

In every failure case, preserve the generated JSON/Markdown evidence and attach it to the release review before rerunning the rehearsal.
