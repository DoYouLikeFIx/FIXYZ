# Story 0.12: Redis Recovery and Self-Healing Baseline

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform engineer,
I want deterministic Redis recovery and self-healing verification,
so that service continuity targets are met after cache/session infrastructure interruptions.

**Depends On:** Story 0.2, Story 0.9

## Acceptance Criteria

1. Given Redis restart fault injection during active runtime, when `redis` is restarted, then all backend services recover to healthy status within 60 seconds without manual service restarts, using explicit probe set (`channel/corebank/fep-gateway/fep-simulator health` + representative auth/session/order smoke checks) executed from Docker Compose internal network context (not host-only probes for internal services).
2. Given Redis outage window, when stateful endpoints are called, then failures are deterministic and normalized, and no unrecoverable stuck session/order state remains after recovery under defined stuck-state criteria.
3. Given post-restart validation flow, when recovery checks run, then representative authentication/session/order smoke scenarios pass after Redis returns.
4. Given repeatable recovery-drill requirement, when automation script or CI job executes the scenario, then timestamps, measured recovery duration, and threshold verdict are captured.
5. Given operations evidence requirements, when drills complete, then run logs and summary artifacts are indexed under `docs/ops/redis-recovery/<YYYYMMDD>/`.
6. Given runbook-only operability requirement, when a new engineer or clean-shell operator follows the documented procedure, then restart, verification, and escalation steps are executable without undocumented tribal knowledge.
7. Given stuck-state guardrail requirements, when recovery validation runs, then no order session remains in non-terminal processing state beyond `TTL + 60s`, where `TTL` defaults to order-session TTL 600s per PRD policy unless overridden by configuration.
8. Given full-operational verdict requirements, when recovery checks complete, then success quorum is 100% pass across required probes in a single drill run.

## Tasks / Subtasks

- [ ] Define Redis recovery SLO and drill scenario contract (AC: 1, 2, 4, 7, 8)
  - [ ] Define start/end measurement points for 60-second recovery SLO
  - [ ] Define explicit full-operational probe set and success quorum (`100%`)
  - [ ] Define probe execution context inside compose network for internal service checks
  - [ ] Define deterministic expected behavior during outage and recovery windows
  - [ ] Define stuck-state predicate and invariant query/checklist (`TTL=600s default`, fail if non-terminal beyond `TTL + 60s`)
  - [ ] Define pass/fail criteria and escalation thresholds
- [ ] Implement recovery drill automation (AC: 1, 3, 4, 5)
  - [ ] Add script or workflow entrypoint to restart Redis and execute checks
  - [ ] Capture health/smoke probe timestamps and duration calculations
  - [ ] Save run artifacts with reproducible naming
- [ ] Implement outage and recovery verification probes (AC: 2, 3, 7)
  - [ ] Verify normalized failure responses during outage window
  - [ ] Verify auth/session/order representative flow after Redis recovery
  - [ ] Verify no stuck states remain based on explicit predicate (`TTL + 60s` non-terminal state breach = fail)
- [ ] Publish operations runbook and troubleshooting matrix (AC: 5, 6)
  - [ ] Document standard drill steps and expected outputs
  - [ ] Document failure signatures and remediation/escalation paths
  - [ ] Execute at least one rehearsal by following runbook-only instructions from clean-shell environment

## Dev Notes

### Developer Context Section

- This story operationalizes PRD `NFR-R3` as a foundation reliability guardrail.
- Foundation scope is verification and operational readiness; deep domain-level resilience improvements remain in later resilience epics.
- Redis interruption handling should be validated without requiring manual service restarts or ad hoc fixes.

### Technical Requirements

- Recovery target:
  - restart Redis and recover service health within 60 seconds
- Measurement contract:
  - record restart start timestamp and first point all required probes are green
  - required probes: service health (`channel`, `corebank`, `fep-gateway`, `fep-simulator`) + auth/session/order representative smoke checks
  - probe execution context: run internal service probes from compose network namespace (or dedicated probe container) due internal port exposure policy
  - produce machine-readable pass/fail summary
- Validation contract:
  - outage window responses must remain standardized and deterministic
  - post-recovery representative flows must pass without manual intervention
- Stuck-state contract:
  - default `TTL` source: order-session TTL 600s policy unless environment-specific override is explicitly documented
  - failure if any order session remains in non-terminal processing state beyond `TTL + 60s`
  - failure if post-recovery invariants detect unresolved session/order lifecycle inconsistency
- Success quorum contract:
  - recovery drill is pass only when 100% of required probes pass in a single run

### Architecture Compliance

- Preserve existing service boundaries and error contract patterns.
- Do not mix this story with unrelated feature-domain changes.
- Keep runbook and automation reproducible across local/dev environments.
- Align recovery checks with PRD `NFR-R3` measurement intent (`redis restart -> 60s -> smoke test green`).

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/docker-compose.yml`
  - `/Users/yeongjae/fixyz/scripts/**` (recovery drill automation)
  - `/Users/yeongjae/fixyz/docs/ops/redis-recovery/**`
  - `/Users/yeongjae/fixyz/BE/**` (only if probe endpoints or resilience config instrumentation is required)
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/**` (story traceability)

### Testing Requirements

- Minimum checks for completion:
  - Redis restart drill succeeds and measured recovery time is `<= 60s`.
  - Full-operational probe set is explicitly executed from compose internal network context and all probes are green within SLO window.
  - During outage, stateful API failures are normalized and deterministic.
  - After recovery, representative auth/session/order smoke checks pass.
  - Stuck-state predicate checks are green (`TTL=600s default`, `TTL + 60s` breach count = 0, or documented override baseline).
  - Success quorum check is green (`100%` probe pass in single run).
  - Drill artifacts include timestamps, verdict, and operator notes.
  - Runbook rehearsal by another engineer or clean-shell simulation succeeds without undocumented steps.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md` (NFR-R3)
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0 Story 0.12)
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-9-additional-infrastructure-bootstrap.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story drafted from PRD NFR-R3 recovery objective and Epic 0 infrastructure baseline sequence.

### Completion Notes List

- Created Story 0.12 as ready-for-dev with explicit Redis restart recovery SLO, drill automation, and runbook evidence requirements.

### File List

- _bmad-output/implementation-artifacts/0-12-redis-recovery-and-self-healing-baseline.md
