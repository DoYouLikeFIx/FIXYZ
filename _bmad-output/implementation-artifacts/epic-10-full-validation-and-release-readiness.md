# Epic 10: Full Validation & Release Readiness

> **⚠️ Epic Numbering Note**: This supplemental file corresponds to **Epic 10 in epics.md: Full Validation & Release Readiness**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.
>
> Reconstructed on 2026-03-09 from the approved canonical planning artifact and the existing Story 10.x handoff files after the epic-level file went missing.
>
> This file is the primary current supplemental Epic 10 companion. The older `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` document remains only as a legacy overlap reference.

## Summary

Epic 10 is the release gate package that proves the integrated system is safe to ship.
It turns prior implementation work into explicit evidence through acceptance CI gates, concurrency and latency validation, resilience drills, smoke and rollback rehearsal, and client-specific release readiness packs.

**Primary outcome:** merge and release decisions are backed by repeatable, auditable evidence instead of manual judgment alone.

**Release gate scope:**

- Mandatory acceptance scenarios in CI
- Concurrency and p95 latency thresholds
- External failure and recovery drills
- Full-stack smoke and rollback rehearsal
- Web and mobile release evidence packaging

## Story Inventory

### Story 10.1: [INT/CH] 7+1 Acceptance CI Gate

As a **release owner**,
I want mandatory acceptance scenarios in CI,
So that release quality baseline is objectively enforced.

**Depends On:** Story 9.4, Story 7.7, Story 8.4

**Acceptance Highlights:**

- Protected branches require all mandatory acceptance scenarios before merge.
- Any scenario regression blocks the gate.
- Scenario identifiers remain traceable in test reports.
- CI stores release evidence artifacts.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/10-1-7-plus-1-acceptance-ci-gate.md`

### Story 10.2: [AC] Concurrency/Performance Gate

As a **performance owner**,
I want concurrency and latency gates,
So that release does not regress runtime safety or responsiveness.

**Depends On:** Story 5.5, Story 9.1

**Acceptance Highlights:**

- Concurrency scenarios prove race/integrity correctness under CI.
- p95 thresholds must be satisfied from Prometheus/Grafana-backed evidence.
- Threshold breaches fail the release gate automatically.
- Repeated benchmark runs surface unacceptable variance.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/10-2-concurrency-performance-gate.md`

### Story 10.3: [FEP] FEP Resilience Drills

As a **FEP owner**,
I want repeatable resilience drills,
So that operational recovery confidence is proven.

**Depends On:** Story 6.6, Story 9.3

**Acceptance Highlights:**

- Timeout/failure drills verify protective behavior opens correctly.
- Recovery drills verify the system returns to normal flow cleanly.
- Replay/requery drills confirm unresolved orders converge or escalate.
- Drill completion produces attachable evidence artifacts.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/10-3-fep-resilience-drills.md`

### Story 10.4: [INT/CH] Full-stack Smoke & Rehearsal

As a **release manager**,
I want full-stack smoke and rehearsal flow,
So that deployment readiness is validated before production cut.

**Depends On:** Story 10.1

**Acceptance Highlights:**

- Fresh environments reach healthy state within threshold.
- Mandatory API and documentation endpoints respond correctly.
- Rollback procedures are executable, not purely documented.
- Rehearsal review updates go/no-go status.
- Observability verification confirms Prometheus targets and Grafana release dashboard readiness.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/10-4-full-stack-smoke-and-rehearsal.md`

### Story 10.5: [FE] Web Release Readiness Pack

As a **web release owner**,
I want FE E2E and release evidence packaged,
So that web deployment quality is auditable.

**Depends On:** Story 9.5, Story 10.1, Story 10.4

**Acceptance Highlights:**

- Critical web journeys must pass the release pipeline.
- Core auth/order regressions block release.
- Checklist items are completed with evidence links.
- Versioned release notes are generated for the approved candidate.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/10-5-web-release-readiness-pack.md`

### Story 10.6: [MOB] Mobile Release Readiness Pack

As a **mobile release owner**,
I want MOB E2E and release evidence packaged,
So that mobile deployment quality is auditable.

**Depends On:** Story 9.6, Story 10.1, Story 10.4

**Acceptance Highlights:**

- Critical mobile flows must pass across the target test matrix.
- Auth/order/notification regressions block release.
- Checklist and artifact links are completed for the handoff package.
- Final release notes and distribution handoff are finalized from the approved build.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/10-6-mobile-release-readiness-pack.md`

## Scenario Catalog (Release Gate View)

All mandatory scenarios below must pass before merge or release approval.

| Category | Scenario | Primary Risk Controlled | Pass Condition |
|---|---|---|---|
| Core acceptance | Order request to execution happy path | Broken core transaction flow | Full flow succeeds with correct final state |
| Core acceptance | Concurrent sell on same position | Over-sell or race corruption | No over-sell and final quantity stays consistent |
| Core acceptance | OTP failure blocks execution | Missing step-up auth control | Execution is blocked with deterministic failure |
| Core acceptance | Duplicate client order key replay | Double execution from retries | Idempotent response with no duplicate posting |
| Core acceptance | Repeated external timeout opens protection circuit | Cascading external failure | Circuit opens and fallback path returns safely |
| Core acceptance | Session invalidated after logout | Session security bypass | Subsequent protected API is rejected |
| Core acceptance | Ledger integrity after repeated executions | Drift between execution journal and position | Buy/Sell aggregate matches final position |
| Security boundary | Internal endpoint call without internal secret | Internal network boundary breach | Request is denied with `403` |
| Performance gate | p95 latency threshold validation | Silent performance degradation | Configured thresholds are met from metrics evidence |
| Performance gate | Threshold breach release fail | Shipping with known SLA violations | Release gate blocks automatically |
| Resilience drill | Downstream failure and recovery drill | Unproven recovery behavior | Recovery path closes and normal flow resumes |
| Smoke/rehearsal | Fresh environment smoke and rollback rehearsal | Deployment readiness unknown | Health/API checks pass and rollback is validated |
| Web readiness | Web critical journey regression gate | Web production regression | Critical journeys pass and regressions block release |
| Mobile readiness | Mobile test-matrix regression gate | Device-specific regression | Matrix-critical flows pass and regressions block release |

## Release Guardrails

- Epic 10 consumes the integrated outputs of Epic 9; it does not redefine domain behavior.
- Release gates must be evidence-driven and reproducible in CI or rehearsal runs.
- Observability signals used for approval must come from the actual runtime stack, not synthetic placeholders.
- FE and MOB readiness remain separate artifacts even when scenarios overlap.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/10-1-7-plus-1-acceptance-ci-gate.md`
- `_bmad-output/implementation-artifacts/10-2-concurrency-performance-gate.md`
- `_bmad-output/implementation-artifacts/10-3-fep-resilience-drills.md`
- `_bmad-output/implementation-artifacts/10-4-full-stack-smoke-and-rehearsal.md`
- `_bmad-output/implementation-artifacts/10-5-web-release-readiness-pack.md`
- `_bmad-output/implementation-artifacts/10-6-mobile-release-readiness-pack.md`
