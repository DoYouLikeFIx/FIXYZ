# Epic 9: Integration Orchestration & End-to-End Recovery

> **⚠️ Epic Numbering Note**: This supplemental file corresponds to **Epic 9 in epics.md: Integration Orchestration & End-to-End Recovery**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.
>
> Reconstructed on 2026-03-09 from the approved canonical planning artifact and the existing Story 9.x handoff files after the epic-level file went missing.

## Summary

Epic 9 assembles the already-separated channel, account, and FEP flows into one deterministic execution path.
Its purpose is to make integrated order execution converge cleanly through orchestration, normalized end-state contracts, recovery scheduling, cross-system idempotency reconciliation, and parity UX on web/mobile.

**Primary outcome:** a user-facing order can progress through execution, degraded recovery, and final-state rendering without service-specific ambiguity.

**Implementation focus:**

- Single FEP-routed execution orchestration path
- Common terminal-state contract for clients
- Recovery convergence for `EXECUTING` and `UNKNOWN`
- Cross-system duplicate/idempotency reconciliation
- FE/MOB final-state and retry parity

## Story Inventory

### Story 9.1: [INT/CH] Execution Orchestration

As an **integration owner**,
I want unified orchestration for FEP-routed execution,
So that order paths are controlled through a single domain flow.

**Depends On:** Story 4.3, Story 5.2, Story 5.3, Story 3.2

**Acceptance Highlights:**

- AUTHED order execution starts through a single orchestration service.
- FEP terminal results are reflected deterministically in the channel-facing state.
- Timeout/failure paths move orders into recovery-eligible states.
- Integration tests protect the orchestration path from regression.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/9-1-execution-orchestration.md`

### Story 9.2: [INT/CH] End-state Normalization

As a **platform consumer**,
I want normalized order terminal states,
So that clients can render outcomes without service-specific branching.

**Depends On:** Story 9.1

**Acceptance Highlights:**

- Terminal states follow a common contract across integrated branches.
- Failure reasons map to a documented taxonomy.
- Completed responses always include the canonical order reference.
- Contract/schema regressions fail CI.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/9-2-end-state-normalization.md`

### Story 9.3: [INT/CH] Recovery Scheduler Integration

As a **reliability owner**,
I want orchestrated recovery for `EXECUTING` and `UNKNOWN` orders,
So that stuck orders eventually converge.

**Depends On:** Story 9.1, Story 6.4

**Acceptance Highlights:**

- A scheduler detects non-terminal orders crossing recovery thresholds.
- External requery results close orders with normalized end states.
- Max-attempt overflow escalates to manual recovery handling.
- Recovery attempts remain queryable for audit and operations review.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/9-3-recovery-scheduler-integration.md`

### Story 9.4: [INT/CH] Cross-system Idempotency Reconciliation

As an **integration data owner**,
I want idempotency reconciled across CH/AC/FEP,
So that duplicate operations never diverge across system boundaries.

**Depends On:** Story 5.4, Story 3.3, Story 9.1

**Acceptance Highlights:**

- Channel-boundary dedupe returns the same canonical outcome.
- Partial AC/FEP records can be reconciled to one canonical order identity.
- Mismatches are surfaced to operations instead of remaining silent.
- Reconciliation reports emit success/failure counters.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/9-4-cross-system-idempotency-reconciliation.md`

### Story 9.5: [FE] Integrated Final-state & Retry UX

As a **web user**,
I want integrated final-state and retry guidance,
So that complex backend outcomes are understandable.

**Depends On:** Story 9.2, Story 4.5

**Acceptance Highlights:**

- Web UI renders normalized completed/failed states consistently.
- Recovery-in-progress states show clear pending and retry guidance.
- Retry actions follow a guarded flow that avoids unsafe repeats.
- Final status updates replace stale UI state automatically.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/9-5-integrated-final-state-and-retry-ux.md`

### Story 9.6: [MOB] Integrated Final-state & Retry UX

As a **mobile user**,
I want integrated final-state and retry guidance on mobile,
So that order completion behavior is parity with web.

**Depends On:** Story 9.2, Story 4.7

**Acceptance Highlights:**

- Mobile status, reason, and reference fields follow the same semantics as web.
- Revisited screens restore the current recovery-aware order status.
- Retry flow prevents duplicates while preserving the guarded action path.
- Resume/reconnect behavior re-syncs the latest order state.

**Implementation Artifact:** `_bmad-output/implementation-artifacts/9-6-integrated-final-state-and-retry-ux.md`

## Integration Guardrails

- All sell-order execution continues through the FEP-routed path described in the canonical Epic 9 section.
- Client rendering must consume normalized terminal states rather than service-specific raw status codes.
- Recovery logic must converge or escalate; indefinite hidden limbo states are not acceptable.
- Reconciliation outcomes must be observable to operations through counters, auditability, or explicit surfaced mismatch signals.

## References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/9-1-execution-orchestration.md`
- `_bmad-output/implementation-artifacts/9-2-end-state-normalization.md`
- `_bmad-output/implementation-artifacts/9-3-recovery-scheduler-integration.md`
- `_bmad-output/implementation-artifacts/9-4-cross-system-idempotency-reconciliation.md`
- `_bmad-output/implementation-artifacts/9-5-integrated-final-state-and-retry-ux.md`
- `_bmad-output/implementation-artifacts/9-6-integrated-final-state-and-retry-ux.md`
