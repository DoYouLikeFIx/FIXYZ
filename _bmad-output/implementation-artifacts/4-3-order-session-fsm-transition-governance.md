# Story 4.3: [BE][CH] FSM Transition Governance

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a domain owner,
I want explicit order session transition rules,
So that invalid state progression cannot occur.

## Acceptance Criteria

1. Given the order-session FSM definition, when a transition command is applied, then only allowed transitions are accepted.
2. Given an invalid transition request, when it is attempted, then a deterministic conflict or validation error is returned.
3. Given a valid state persistence event, when the transition completes, then status and timestamps are stored consistently.
4. Given API status serialization, when a session is returned, then optional fields follow the status-specific response contract.

## Tasks / Subtasks

- [ ] Implement the canonical order-session transition table in the domain layer (AC: 1, 2)
  - [ ] Reject impossible or out-of-order transitions deterministically
- [ ] Persist status and transition timestamps consistently (AC: 3)
  - [ ] Ensure expiration and failure transitions remain auditable
- [ ] Implement status-specific serialization rules for API consumers (AC: 4)
  - [ ] Expose only the optional fields allowed for the current state
- [ ] Add automated coverage for valid transitions, invalid transitions, and response serialization behavior (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.2.

### Technical Requirements

- `PENDING_NEW -> AUTHED` must support both low-risk bypass and successful step-up.
- Terminal states must not re-open without an explicit documented recovery path.
- State-specific optional fields must stay consistent across persistence and API response layers.

### Architecture Compliance

- Follow the FSM defined in `architecture.md`.
- Keep state governance in the channel domain instead of duplicating it in controllers or clients.
- Preserve correlation between transition decisions and stored timestamps.

### Testing Requirements

- Cover the allowed transition matrix, invalid transition rejection, expiration handling, and status-specific serialization behavior.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story regenerated for explicit order-session FSM governance.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.3)
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

- Story scaffold regenerated for FSM transition governance and status contract behavior.

### File List

- _bmad-output/implementation-artifacts/4-3-order-session-fsm-transition-governance.md
