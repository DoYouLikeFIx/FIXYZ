# Observability Stack Runbook

## Overview

Story 0.16 provisions a repo-owned Prometheus and Grafana stack behind the `observability` compose profile. The stack is local-operator facing only and binds Grafana/Prometheus to loopback host ports while application management endpoints stay on the Docker network.

## First-Time Bootstrap

1. Ensure root `.env` contains the baseline secrets and local observability defaults from [.env.example](/Users/yeongjae/fixyz/.env.example).
2. Start the default stack plus observability profile:

   ```bash
   INTERNAL_SECRET_BOOTSTRAP="${INTERNAL_SECRET_BOOTSTRAP:-observability-bootstrap-secret}" \
   INTERNAL_SECRET="${INTERNAL_SECRET:-observability-runtime-secret}" \
   COMPOSE_PROFILES=observability \
   docker compose up -d
   ```

3. Wait for the local operator surfaces:

   - Grafana: `http://127.0.0.1:3000`
   - Prometheus: `http://127.0.0.1:9090`

4. Generate the FE monitoring descriptor after Prometheus and Grafana are reachable:

```bash
node scripts/observability/generate-monitoring-panels.mjs --write-env-file FE/.env.local
```

## Stable Dashboard Contract

- Dashboard UID: `ops-monitoring-overview`
- Repo-owned descriptor default mode: `link`
- Main panel IDs:
  - `executionVolume`: `101`
  - `pendingSessions`: `102`
  - `marketDataIngest`: `103`
- Freshness companion panel IDs:
  - `executionVolume`: `201`
  - `pendingSessions`: `202`
  - `marketDataIngest`: `203`

## Validation

Static validation only:

```bash
OBSERVABILITY_SKIP_RUNTIME=1 ./scripts/observability/validate-observability-stack.sh
```

Runtime validation against the live local stack:

```bash
OBSERVABILITY_SKIP_RUNTIME=0 ./scripts/observability/validate-observability-stack.sh
```

The runtime validator checks:

- `docker compose config`
- `docker compose up -d prometheus grafana`
- Prometheus and Grafana health
- required Prometheus targets reporting `UP`
- dashboard reachability by stable UID and authenticated panel URLs
- Grafana datasource/dashboard provisioning before and after `--force-recreate`
- Grafana anonymous API access remains disabled by default
- channel-service host port `8080` does not expose `/actuator/prometheus`
- internal channel management port `18080` remains scrapeable from inside the compose network

## Idempotent Re-Provision

- Recreate Grafana and Prometheus without touching business data:

  ```bash
  COMPOSE_PROFILES=observability docker compose up -d --force-recreate prometheus grafana
  ```

- Re-run descriptor generation if the Grafana base URL changes:
- The validator re-checks datasource and dashboard provisioning after `--force-recreate`, so the same command is the supported machine-checkable reprovision proof:

  ```bash
  OBSERVABILITY_SKIP_RUNTIME=0 ./scripts/observability/validate-observability-stack.sh
  ```

- Re-run descriptor generation if the Grafana base URL changes:

  ```bash
  node scripts/observability/generate-monitoring-panels.mjs --write-env-file FE/.env.local
  ```

## Partial-Failure Recovery

- If Prometheus targets are not `UP`, inspect:
  - `docker compose logs channel-service corebank-service fep-gateway fep-simulator prometheus`
- If Grafana starts without dashboards:
  - verify provisioning files under [`docker/observability/grafana/provisioning`](/Users/yeongjae/fixyz/docker/observability/grafana/provisioning)
  - recreate only Grafana:

    ```bash
    COMPOSE_PROFILES=observability docker compose up -d --force-recreate grafana
    ```

- If FE monitoring cards still show config-unavailable guidance:
  - regenerate `FE/.env.local`
  - restart Vite so the updated `VITE_ADMIN_MONITORING_PANELS_JSON` is picked up
