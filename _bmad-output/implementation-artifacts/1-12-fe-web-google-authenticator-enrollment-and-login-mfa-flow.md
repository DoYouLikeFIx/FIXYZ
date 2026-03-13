# Story 1.12: FE Web Google Authenticator Enrollment & Login MFA Flow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a web user,
I want browser registration and login flows that include Google Authenticator setup and TOTP verification,
so that the web experience matches the MFA requirement cleanly.

## Acceptance Criteria

1. Given a newly registered user or `MFA_ENROLLMENT_REQUIRED` state, when the browser enters MFA setup, then it renders QR, manual entry key guidance, expiry information, and first-code confirmation UX.
2. Given the web login experience, when valid password and current TOTP are submitted, then the user enters the protected route flow without bypassing the MFA step.
3. Given invalid TOTP, required enrollment, or MFA throttle responses, when the browser receives the backend code, then it maps the response to deterministic next-action guidance without leaking sensitive details.
4. Given session expiry or explicit logout after MFA rollout, when the user returns to login, then the browser re-enters the password plus TOTP flow while preserving safe return-to navigation.

## Tasks / Subtasks

- [ ] Add web MFA enrollment entry and QR/bootstrap presentation flow (AC: 1)
  - [ ] Render manual-entry fallback and expiry guidance
- [ ] Extend login UI with TOTP capture and submission behavior (AC: 2)
  - [ ] Prevent private-route entry until MFA succeeds
- [ ] Map MFA-specific backend codes into consistent browser guidance (AC: 3)
  - [ ] Handle invalid-code, enrollment-required, and throttle states deterministically
- [ ] Align logout/session-expiry return path with password+TOTP login (AC: 4)
  - [ ] Preserve safe `returnTo` behavior after re-auth
- [ ] Add UI and integration coverage for enroll, confirm, login, and session-expiry flows (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.3, Story 1.6, Story 1.11.

### Technical Requirements

- Browser must support QR display plus manual key fallback.
- TOTP submission must never persist raw code beyond transient form state.
- MFA-required states must not dead-end the user.

### Architecture Compliance

- Preserve FE route-guard conventions and standardized error mapping.
- Reuse existing auth store/session bootstrap behavior where possible.

### Testing Requirements

- Cover enrollment bootstrap UX, first-code confirmation, login MFA success/failure, throttle handling, and session-expiry re-entry.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Web MFA rollout scaffold added on top of the delivered Epic 1 web auth flow.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.12)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Added as follow-on Epic 1 MFA rollout scope after baseline story restoration.

### Completion Notes List

- Story scaffold created for web Google Authenticator enrollment and login MFA UX.

### File List

- _bmad-output/implementation-artifacts/1-12-fe-web-google-authenticator-enrollment-and-login-mfa-flow.md
