# Story 1.15: FE/MOB MFA Recovery & Error UX Alignment

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a cross-client user,
I want consistent MFA recovery and error guidance on web and mobile,
so that I can recover access predictably from any channel.

## Acceptance Criteria

1. Given invalid TOTP, enrollment required, recovery required, or MFA throttle outcomes, when FE and MOB render the response, then both clients present aligned next-action semantics even if the visuals differ.
2. Given a supported MFA recovery entry point, when the user begins recovery on web or mobile, then the client routes into the approved rebind flow without disclosing account existence or stale secret state.
3. Given successful MFA recovery or rebind, when the user is returned to sign-in, then stale authenticated state is cleared and the next login requires password plus current TOTP.
4. Given an unknown MFA error, when the client cannot map it to a known case, then correlation or support context remains visible and the user receives safe fallback guidance.

## Tasks / Subtasks

- [ ] Extend FE and MOB auth error maps for MFA-specific outcomes (AC: 1, 4)
  - [ ] Align invalid-code, enrollment-required, recovery-required, and throttle guidance
- [ ] Add client recovery entry routing and rebind handoff behavior (AC: 2)
  - [ ] Prevent dead-end states during cross-client recovery
- [ ] Clear stale authenticated state on successful recovery or rebind completion (AC: 3)
  - [ ] Force fresh password+TOTP login after recovery success
- [ ] Add FE/MOB regression coverage for MFA error and recovery flows (AC: 1, 2, 3, 4)
  - [ ] Verify cross-client semantic parity for the same backend code set

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.12, Story 1.13, Story 1.14.

### Technical Requirements

- FE and MOB may differ in UI layout, but they must preserve the same semantic guidance for identical backend outcomes.
- Recovery entry points must not reveal whether the account exists or whether an old authenticator is still present.
- Successful recovery must clear stale session/auth state before the next login.

### Architecture Compliance

- Preserve existing FE/MOB auth-store and route-stack conventions.
- Keep correlation-id visibility for unknown error outcomes.

### Testing Requirements

- Cover MFA error mapping, recovery entry, rebind completion return path, and unknown-code fallback on both web and mobile.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Cross-client MFA recovery and error-alignment scaffold added to complete Epic 1 MFA rollout planning.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.15)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Added as follow-on Epic 1 MFA rollout scope after baseline story restoration.

### Completion Notes List

- Story scaffold created for FE/MOB MFA recovery and error UX alignment.

### File List

- _bmad-output/implementation-artifacts/1-15-fe-mob-mfa-recovery-and-error-ux-alignment.md
