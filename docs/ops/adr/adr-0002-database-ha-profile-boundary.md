# ADR-0002: Database HA Profile Boundary and Replication Baseline

- Status: Accepted
- Date: 2026-03-03
- Story: 0-10-database-high-availability-and-replication-baseline

## Context

Current architecture baseline runs a local single-node MySQL (`docker-compose.yml`).
We need a high-availability baseline to validate replication observability, failover objectives, restore integrity, and alert behavior without forcing immediate local-runtime migration.
This ADR explicitly documents scope boundary, migration assumptions, and rollback strategy.

## Decision

Adopt a scoped HA baseline with explicit scope boundary:

- deploy/staging uses a dedicated HA profile (`docker-compose.ha.yml`) with `mysql-primary` + `mysql-replica`.
- local default single-node remains unchanged for developer ergonomics and lower resource footprint.
- write path remains primary-pinned; read routing is explicit and controlled through a documented allowlist.

## Migration assumptions

- Existing services can continue operating with single-node local defaults during rollout.
- HA operational drills and evidence are mandatory before broadening runtime routing behavior.
- Read-routing enablement is gated by stale-read scenario validation for strong-consistency operations.

## Rollback strategy

- If HA drill or runtime validation fails, stop HA profile and revert to local default single-node profile.
- Preserve failover/restore/alert evidence for incident review and replay.
- Reattempt HA rollout only after threshold violations and replica health issues are resolved.

## Consequences

### Positive

- HA capabilities are introduced with controlled blast radius.
- Operational readiness can be validated with explicit RTO/RPO and checksum evidence.
- Strong-consistency operations remain protected from replica lag side effects.

### Trade-offs

- Two operational profiles must be maintained (HA vs single-node local).
- Full runtime read-routing automation is deferred to a follow-up story.
