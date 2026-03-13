# Epic 4: Channel Order Authorization & Session FSM

> **Legacy filename note:** This file keeps the historical filename `epic-4-order-execution-and-position-integrity.md` for continuity, but its active canonical scope is **Epic 4** in `_bmad-output/planning-artifacts/epics.md`: **Channel Order Authorization & Session FSM**.
>
> Standalone story files `4.1` through `4.8` are restored as the primary implementation units. This document remains the epic-level companion contract for those story slices.

## Summary

Epic 4 owns the channel-side order session before execution begins.
Its job is to decide whether a drafted order may proceed immediately on the strength of recent login MFA context, or whether an additional TOTP step-up challenge must be completed first.

**Primary outcome:** order initiation, authorization decision, conditional step-up, and FE/MOB session flow all converge on one deterministic FSM before execution starts.

**Implementation focus:**

- Order-session creation, ownership, TTL, and status-query contract
- Risk-based authorization policy using fresh-login MFA context
- Conditional TOTP step-up only for elevated-risk orders
- Explicit FSM transition governance and status-specific response contracts
- Web and mobile multi-step flow parity through authorization and confirmation
- Cross-client validation so FE and MOB do not diverge from the same order rules

## Current Delivery Status

As of `2026-03-12`, canonical Epic 4 is tracked as `in-progress` in `_bmad-output/implementation-artifacts/sprint-status.yaml`.

Current execution posture:

- Standalone Story `4.1` through Story `4.8` exist as primary implementation artifacts
- This file is the shared companion contract for Epic 4
- Shared downstream execution dependency remains Story `5.2` and later integrated orchestration stories

---

## Session Model

### Backend States

- `PENDING_NEW`: order session exists and authorization is still pending
- `AUTHED`: order session is fully authorized for execution
- `EXECUTING`: execution handoff has started
- `REQUERYING`, `ESCALATED`, `COMPLETED`, `FAILED`, `CANCELED`, `EXPIRED`: downstream lifecycle states preserved from the broader order domain

`PENDING_NEW -> AUTHED` may happen in two ways:

- automatic authorization because the current risk profile is acceptable
- successful conditional TOTP step-up verification

### Client Flow

- `INPUT`
- `AUTH_DECISION`
- `STEP_UP` only when `challengeRequired=true`
- `CONFIRM`
- `PROCESSING`
- `COMPLETED | FAILED | AUTH_EXPIRED`

---

## Story Inventory

### Story 4.1: [BE][CH] Order Session Create/Status + Ownership

As a **channel API owner**,
I want order session creation and status queries with ownership checks,
So that unauthorized access and invalid session usage are blocked.

**Depends On:** Story 1.2, Story 2.2

**Acceptance Highlights:**

- Order-session create API persists TTL, ownership metadata, and authorization-decision payload
- Low-risk orders may return immediately as `AUTHED`
- Status query returns the current state for the owning member only
- Non-owner access fails with deterministic forbidden semantics
- Expired sessions return the documented expired or not-found contract

### Story 4.2: [BE][CH] Risk-Based Order Authorization Policy

As an **authenticated order initiator**,
I want the system to require extra verification only when order risk warrants it,
So that UX friction is reduced without weakening high-risk order protection.

**Depends On:** Story 4.1, Story 1.2

**Acceptance Highlights:**

- Low-risk contexts auto-advance to `AUTHED` without additional per-order verification
- Elevated-risk contexts require TOTP step-up before execution may proceed
- Verify endpoint succeeds only inside the allowed time and attempt window
- Debounce prevents rapid duplicate verification from consuming attempts incorrectly
- Same-window TOTP replay is rejected deterministically
- Max-attempt exhaustion fails the session and blocks execution

### Story 4.3: [BE][CH] FSM Transition Governance

As a **domain owner**,
I want explicit order-session transition rules,
So that invalid state progression cannot occur.

**Depends On:** Story 4.2

**Acceptance Highlights:**

- Only documented transitions are accepted by the domain model
- Invalid transitions fail with deterministic conflict or validation semantics
- Status and timestamps are persisted consistently on valid transition
- Serialized status responses honor status-specific optional-field contracts

### Story 4.4: [FE] Web Order Step A/B

As a **web user**,
I want step-based order input and clear authorization guidance,
So that order setup is clear and only risky orders interrupt me with extra verification.

**Depends On:** Story 4.1, Story 2.4

**Acceptance Highlights:**

- Web step A submits symbol and quantity through the order-session initiation API
- Client-side and server-side validation errors remain visible and actionable
- `challengeRequired=true` activates step-up guidance with clear reason text
- `challengeRequired=false` with `status=AUTHED` skips directly to confirmation
- API and network failures preserve retry guidance instead of dead-end states

### Story 4.5: [FE] Web Conditional Step-Up + Step C

As a **web user**,
I want conditional additional verification and order execution result screens,
So that I can complete order execution with clear status feedback.

**Depends On:** Story 4.2, Story 4.3, Story 4.4

**Acceptance Highlights:**

- Required web step-up transitions to confirmation only after valid TOTP succeeds
- Low-risk orders already in `AUTHED` bypass the extra verification step cleanly
- Invalid, expired, or replayed codes map to deterministic error guidance
- Execution-in-progress state reflects updates through polling or SSE
- Final states render ClOrdID and failure reason conditionally

### Story 4.6: [MOB] Mobile Order Step A/B

As a **mobile user**,
I want order input and authorization guidance on mobile,
So that I can initiate orders with the same risk-aware behavior as web.

**Depends On:** Story 4.1, Story 2.5

**Acceptance Highlights:**

- Mobile step A creates the order session and advances into the authorization flow
- Invalid symbol and quantity input show contextual error indicators
- Challenge-required sessions preserve remaining-session context when navigating to step-up
- Auto-authorized sessions skip directly to confirmation
- Flow state restores predictably after interruption or return

### Story 4.7: [MOB] Mobile Conditional Step-Up + Step C

As a **mobile user**,
I want conditional additional verification and order execution result flow on mobile,
So that complete order execution experience is parity with web.

**Depends On:** Story 4.2, Story 4.3, Story 4.6

**Acceptance Highlights:**

- Required mobile step-up advances only after valid TOTP succeeds
- Already authorized low-risk sessions move directly to confirmation
- Step-up and execution errors preserve mapped action guidance
- Final result states render ClOrdID and failure reasons consistently
- App background or foreground recovery restores the current order-session state

### Story 4.8: [FE/MOB] Cross-Client Authorization FSM Parity Validation

As a **product quality owner**,
I want FE and MOB FSM behavior parity,
So that one client does not diverge from core order rules.

**Depends On:** Story 4.5, Story 4.7

**Acceptance Highlights:**

- The same scenario sequence yields equivalent FE and MOB state transitions
- The same backend error codes preserve aligned severity and action semantics
- Regression validation protects parity continuously in CI

---

## Shared Contracts

### Risk Signals

The order-authorization policy may consider:

- `lastMfaVerifiedAt` age from the authenticated session
- trusted device or browser continuity
- IP or network change since login
- recent password change or MFA recovery event
- order notional amount, quantity, or unusual behavioral burst

### Redis Keys

- `ch:order-session:{sessionId}`: order-session TTL, default `600s`
- `ch:otp-attempts:{sessionId}`: bounded conditional step-up attempts
- `ch:otp-attempt-ts:{sessionId}`: debounce guard for rapid verify submit
- `ch:totp-used:{memberId}:{windowIndex}:{code}`: same-window replay prevention

### API Notes

- `POST /api/v1/orders/sessions` creates the session and returns authorization-decision metadata
- `GET /api/v1/orders/sessions/{sessionId}` exposes current state to the owner only
- `POST /api/v1/orders/sessions/{sessionId}/otp/verify` exists only when `challengeRequired=true`
- `POST /api/v1/orders/sessions/{sessionId}/execute` remains downstream and requires `status=AUTHED`

### UX Contract

- FE and MOB both preserve the same meaning for `challengeRequired`
- Extra verification is conditional, not universal
- Low-risk auto-authorized users should not see misleading “OTP completed” messaging
- Refresh, resume, and background return paths must restore the correct FSM state rather than restarting the flow blindly

---

## Cross-Epic Handoffs

- **Epic 1 -> Epic 4:** Epic 1 provides login MFA context, recovery signals, and session-security guarantees consumed by risk evaluation
- **Epic 2 -> Epic 4:** Epic 2 provides account and position inquiry context used during order initiation
- **Epic 4 -> Epic 5:** Epic 5 consumes `AUTHED` as the execution precondition and must not re-own authorization logic
- **Epic 4 -> Epic 8:** Validation must cover both low-risk bypass and elevated-risk step-up paths
- **Epic 4 -> Epic 10:** Release gates must prove required step-up failure blocks execution deterministically

## Working Rule

Use the `4.x` story files as the primary delivery units for Epic 4.
Use this document for shared session-model, FSM, and cross-epic contract alignment.
If `epic-2-order-session-and-otp.md` still appears in historical context, treat it as overlapping legacy narrative rather than the primary Epic 4 execution source.
