# Story 4.1: [BE][CH] Order Session Create/Status + Ownership

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a channel API owner,
I want order session creation and status queries with ownership checks,
So that unauthorized access and invalid session usage are blocked.

## Acceptance Criteria

1. Given a valid order initiation request, when the session API is called, then the system creates an order session with TTL, ownership metadata, `challengeRequired`, `authorizationReason`, and current status.
2. Given a low-risk order context with fresh login MFA proof, when policy allows challenge bypass, then the created session may already be `AUTHED` without additional per-order verification.
3. Given a status query for an owned session, when the endpoint is called, then the current session state is returned.
4. Given non-owner session access, when query or action occurs, then a deterministic forbidden error is returned.
5. Given an expired session, when status or action is requested, then the documented expired or not-found contract is returned.

## Tasks / Subtasks

- [ ] Implement order-session creation contract with ownership, TTL, and authorization-decision metadata (AC: 1, 2)
  - [ ] Return `challengeRequired`, `authorizationReason`, `status`, and `expiresAt` consistently
- [ ] Implement owner-only session status query behavior (AC: 3, 4)
  - [ ] Enforce cross-user access denial with deterministic error contract
- [ ] Implement expiration handling for query and action paths (AC: 5)
  - [ ] Ensure expired sessions no longer behave as active authorization context
- [ ] Add automated coverage for create, owned lookup, forbidden access, auto-authorized path, and expiration (AC: 1, 2, 3, 4, 5)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 1.2, Story 2.2.

### Technical Requirements

- Session responses must carry authorization-decision metadata, not just raw status.
- Ownership validation must apply consistently to query and follow-up action paths.
- Session TTL and expiration behavior must remain deterministic across refresh or retry.

### Architecture Compliance

- Keep order-session ownership and authorization state in the channel domain boundary.
- Preserve standardized error-envelope and correlation-id behavior.
- Use architecture-defined session and Redis conventions for lifecycle control.

### Testing Requirements

- Cover create success, auto-authorized success, status query, forbidden access, and expired session behavior.
- Include regression coverage for duplicate reads or repeated status polling.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated from canonical Epic 4 planning and companion contract.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical planning artifact for Epic 4.

### Completion Notes List

- Story scaffold regenerated for order-session create/status and ownership scope.

### File List

- _bmad-output/implementation-artifacts/4-1-order-session-create-status-plus-ownership.md
