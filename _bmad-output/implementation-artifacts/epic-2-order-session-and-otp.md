# Epic 2: Order Session & Risk-Based Authorization

> Legacy filename retained for continuity.
> Canonical planning alignment: `_bmad-output/planning-artifacts/epics.md` Epic 4, "Channel Order Authorization & Session FSM".
> Working implementation contract after story-file consolidation on 2026-03-12.

## Summary

This epic owns the channel-side order session before execution begins.
Its responsibility is to decide whether a drafted order may proceed immediately on the strength of fresh login MFA, or whether an additional TOTP step-up challenge must be completed first.

Primary outcomes:

- Order initiation creates a short-lived session with ownership and risk-evaluation metadata.
- Low-risk orders auto-authorize without extra friction.
- Elevated-risk orders require conditional TOTP verification.
- FE and MOB follow the same session/authorization state model.

## Session Model

### Backend states

- `PENDING_NEW`: order session exists, authorization still pending.
- `AUTHED`: order session is authorized for execution.
- `EXECUTING`: execution handoff started.
- `REQUERYING`, `ESCALATED`, `COMPLETED`, `FAILED`, `CANCELED`, `EXPIRED`: unchanged downstream lifecycle states.

`PENDING_NEW -> AUTHED` may happen in two ways:

- automatic authorization because current risk is acceptable
- successful conditional step-up verification

### Client flow

- `INPUT`
- `AUTH_DECISION`
- `STEP_UP` only when `challengeRequired=true`
- `CONFIRM`
- `PROCESSING`
- `COMPLETED | FAILED | AUTH_EXPIRED`

## Story Map

### Story 2.1: Order Session Initiation & Status API

Goal:

- Create order sessions with ownership, expiry, and authorization-decision metadata.

Acceptance focus:

- `POST /api/v1/orders/sessions` validates symbol, side, quantity, price, and `clOrdID`.
- Response includes `sessionId`, `status`, `challengeRequired`, `authorizationReason`, and `expiresAt`.
- Low-risk requests may return `status=AUTHED` immediately.
- Elevated-risk requests return `status=PENDING_NEW` plus challenge instructions.
- `GET /api/v1/orders/sessions/{sessionId}` exposes status-specific optional fields without leaking cross-user access.

### Story 2.2: Risk-Based Authorization Decision & Conditional Step-Up

Goal:

- Evaluate whether a second factor is needed at order time.

Acceptance focus:

- Policy consumes fresh login MFA context, trusted-device/session signal, network change, and order risk attributes.
- Low-risk sessions bypass additional challenge cleanly.
- Elevated-risk sessions require `POST /api/v1/orders/sessions/{sessionId}/otp/verify`.
- Step-up verification uses Vault-backed TOTP, replay protection, debounce, and bounded attempts.
- Exhausted attempts fail the session and block execution.
- Re-verification is rejected once a session is already `AUTHED`, `EXECUTING`, or terminal.

### Story 2.3: FE/MOB Order Flow Through Authorization

Goal:

- Keep the multi-step order UX clear while making extra verification conditional instead of universal.

Acceptance focus:

- Step A collects order details and creates the session.
- If `challengeRequired=false`, the client skips directly to confirmation.
- If `challengeRequired=true`, the client shows TOTP step-up with remaining-session context and clear reason text.
- Step-up errors map deterministically across FE and MOB.
- Session recovery restores the correct state after refresh, backgrounding, or resume.

## Shared Contracts

### Risk Signals

The order authorization policy may consider:

- `lastMfaVerifiedAt` age from the authenticated session
- trusted device or browser continuity
- IP or network change since login
- recent password or MFA recovery event
- order notional amount, quantity, or abnormal behavior burst

### Redis Keys

- `ch:order-session:{sessionId}`: order session TTL (`600s`)
- `ch:otp-attempts:{sessionId}`: bounded conditional step-up attempts
- `ch:otp-attempt-ts:{sessionId}`: debounce guard for step-up submit
- `ch:totp-used:{memberId}:{windowIndex}:{code}`: replay prevention

### API Notes

- `POST /api/v1/orders/sessions/{sessionId}/authorization` may be used as an explicit policy-evaluation endpoint if the client needs a re-check before confirm.
- `POST /api/v1/orders/sessions/{sessionId}/otp/verify` exists only for sessions where `challengeRequired=true`.
- `POST /api/v1/orders/sessions/{sessionId}/execute` requires `status=AUTHED`.

## Cross-Epic Outputs

- Epic 4 execution logic treats `AUTHED` as "authorization satisfied", not "OTP always entered".
- Epic 8 validation must cover both low-risk bypass and elevated-risk challenge paths.
- Epic 10 release gates must ensure required step-up failure blocks execution deterministically.
