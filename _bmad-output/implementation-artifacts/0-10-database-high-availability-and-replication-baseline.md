# Story 0.10: Database High Availability and Replication Baseline

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want a database high-availability and replication baseline,
so that data services remain available under single-node failure and recovery is operationally validated.

**Depends On:** Story 0.9

## Acceptance Criteria

1. Given primary-replica topology is provisioned, when replication health checks run, then replication state and lag are observable.
2. Given runtime read/write contract, when services are configured, then writes are pinned to primary and read-routing policy is explicit/documented.
3. Given failover drill scenario, when primary outage is simulated, then recovery procedure executes with measured `RTO <= 300s` and `RPO <= 60s`, and the measured values are captured as evidence using an explicit calculation method (`RTO = t(all required probes green) - t(failover start)`, `RPO = t(last committed transaction before outage) - t(last recovered committed transaction after failover)`).
4. Given backup/restore requirements, when restore rehearsal is executed, then integrity is validated against known dataset checksums using a documented algorithm (`SHA-256`) and deterministic export procedure.
5. Given alerting requirements, when replication lag or failure exceeds threshold (`warn: lag >= 5s for 3 consecutive samples @10s interval`, `critical: lag >= 30s for 2 consecutive samples @10s interval` or replication stopped >= 60s), then operational alerts are emitted with actionable context.
6. Given current architecture baseline documents single-DB runtime, when HA baseline is introduced, then an ADR records scope boundary (`deploy/staging` HA profile vs local default single-node profile), migration assumptions, and rollback strategy.
7. Given read-replica consistency trade-offs, when read-routing is enabled, then strong-consistency paths are explicitly allowlisted to primary and tested against stale-read risk scenarios, with an explicit endpoint inventory in runbook/docs.

## Tasks / Subtasks

- [ ] Define HA topology, SLO/SLI, and operating model (AC: 1, 2, 3, 6)
  - [ ] Define primary/replica roles and service connection patterns
  - [ ] Define RTO/RPO targets and measurement method (`RTO <= 300s`, `RPO <= 60s`)
  - [ ] Define lag/failure alert thresholds and sampling cadence (`10s`)
  - [ ] Produce ADR describing coexistence with current single-node local baseline
- [ ] Implement replication baseline (AC: 1)
  - [ ] Provision replication config and health probes
  - [ ] Add monitoring outputs for replication state/lag
- [ ] Implement alerting baseline for replication failures (AC: 5)
  - [ ] Configure lag/failure alert rules and notification targets
  - [ ] Validate alert dedupe/noise controls for repetitive failure windows
- [ ] Implement read/write routing and consistency contract (AC: 2, 7)
  - [ ] Configure service-level read/write routing behavior
  - [ ] Document primary-only allowlist for strong-consistency endpoints (minimum: order session transition, order execute, admin force session invalidation)
  - [ ] Document routing exceptions and stale-read constraints
- [ ] Execute failover and recovery drills (AC: 3)
  - [ ] Simulate primary outage scenario
  - [ ] Capture measured RTO/RPO and procedure evidence
- [ ] Execute backup and restore rehearsal (AC: 4, 5)
  - [ ] Validate backup artifact integrity
  - [ ] Restore to rehearsal environment and verify checksum parity with documented SHA-256 process

## Dev Notes

### Developer Context Section

- This story depends on infrastructure bootstrap readiness (Story 0.9).
- Keep HA baseline operationally testable before introducing advanced automation.
- Avoid coupling HA rollout with unrelated schema/application feature changes.

### Technical Requirements

- Replication metrics must be queryable and retained for troubleshooting.
- Failover drill procedure must be deterministic and repeatable.
- Backup/restore proof must include timestamped evidence and deterministic checksum verification.
- Baseline recovery objectives for this story:
  - `RTO <= 300s`
  - `RPO <= 60s`
- Alert policy baseline:
  - sample cadence: `10s`
  - `warn`: lag >= 5s for 3 consecutive samples
  - `critical`: lag >= 30s for 2 consecutive samples or replication stopped >= 60s
- RPO calculation contract:
  - compute commit-gap using pre-failover and post-recovery committed transaction markers/timestamps
  - preserve measurement query/procedure in runbook for deterministic replay
- Checksum standard:
  - `SHA-256` over deterministic export generated from an explicitly documented table set and dump options.

### Architecture Compliance

- Preserve transactional consistency expectations from existing BE modules.
- Document known consistency trade-offs for read replicas.
- Resolve and document architecture transition from local single-node baseline to HA profile via ADR (no implicit architecture drift).

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/docker/**`
  - `/Users/yeongjae/fixyz/docs/ops/**`
  - `/Users/yeongjae/fixyz/BE/**` (only if datasource routing config requires updates)
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/**` (story traceability)

### Testing Requirements

- Minimum checks for completion:
  - Replication health and lag checks pass in normal operation.
  - Simulated failover drill completes with measured `RTO <= 300s` and `RPO <= 60s`.
  - Restore rehearsal validates checksum integrity via documented SHA-256 process.
  - Alerting behavior is verified for induced lag/failure.
  - Alert trigger windows are validated with `10s` sampling cadence.
  - Alert thresholds are validated with explicit trigger windows (`warn`/`critical`) and no duplicate noise storm.
  - Strong-consistency endpoint allowlist document exists and remains pinned to primary under replica lag conditions.
  - Failover and restore evidence includes timestamped run logs and operator runbook references.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.10)
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/epic-0-project-foundation.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-9-additional-infrastructure-bootstrap.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md` (single-node baseline decision context)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story drafted from Epic 0 expansion requirements for DB HA, failover, and restore validation.

### Completion Notes List

- Created Story 0.10 as ready-for-dev with replication, failover, and recovery evidence criteria.

### File List

- _bmad-output/implementation-artifacts/0-10-database-high-availability-and-replication-baseline.md
