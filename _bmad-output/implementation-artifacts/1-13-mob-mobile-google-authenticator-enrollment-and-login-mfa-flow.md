# Story 1.13: MOB Mobile Google Authenticator Enrollment & Login MFA Flow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile user,
I want native Google Authenticator enrollment and login MFA parity with web,
so that the mobile client follows the same second-factor rules.

## Acceptance Criteria

1. Given a newly registered user or `MFA_ENROLLMENT_REQUIRED` state, when the mobile app enters MFA setup, then it shows QR or secure manual-entry/deep-link enrollment guidance plus first-code confirmation.
2. Given the mobile login experience, when valid password and current TOTP are submitted, then the authenticated app stack is entered only after MFA succeeds.
3. Given invalid TOTP, required enrollment, or MFA throttle responses, when the app receives the backend code, then it maps field/global guidance deterministically and avoids back-stack corruption.
4. Given app resume or session expiry after MFA rollout, when the app rechecks session state, then stale sessions route back into the password plus TOTP login flow safely.

## Tasks / Subtasks

- [ ] Add mobile MFA enrollment entry and QR/manual-entry guidance flow (AC: 1)
  - [ ] Support native-first enrollment guidance without leaking secret material into persistent storage
- [ ] Extend mobile login UI with password + TOTP sequencing (AC: 2)
  - [ ] Block authenticated stack entry until MFA succeeds
- [ ] Map MFA-specific backend codes into native field/global guidance (AC: 3)
  - [ ] Keep navigation stack consistent on invalid-code or throttle paths
- [ ] Align resume/session-expiry handling with password+TOTP re-auth (AC: 4)
  - [ ] Ensure stale sessions clear sensitive screen state safely
- [ ] Add mobile test coverage for enrollment, login MFA, error mapping, and resume flows (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.4, Story 1.6, Story 1.11.

### Technical Requirements

- Native client must not persist raw TOTP secret or raw verification codes.
- Enrollment guidance may use QR, manual entry, or secure deep-link handoff depending on platform capability.
- Resume logic must always defer to server session truth.

### Architecture Compliance

- Preserve mobile auth stack boundaries and existing session bootstrap rules.
- Keep error semantics aligned with FE even when the interaction model differs.

### Testing Requirements

- Cover enrollment setup, first confirmation, login MFA success/failure, throttle handling, and stale-session resume behavior.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Mobile MFA rollout scaffold added on top of the delivered Epic 1 mobile auth flow.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.13)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Added as follow-on Epic 1 MFA rollout scope after baseline story restoration.

### Completion Notes List

- Story scaffold created for mobile Google Authenticator enrollment and login MFA UX.

### File List

- _bmad-output/implementation-artifacts/1-13-mob-mobile-google-authenticator-enrollment-and-login-mfa-flow.md
