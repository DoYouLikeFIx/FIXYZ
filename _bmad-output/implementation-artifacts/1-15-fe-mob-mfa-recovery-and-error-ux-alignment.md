# Story 1.15: FE/MOB MFA Recovery & Error UX Alignment

Status: done

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

- [x] Extend FE and MOB auth error maps for MFA-specific outcomes (AC: 1, 4)
  - [x] Align invalid-code, enrollment-required, recovery-required, and throttle guidance
- [x] Add client recovery entry routing and rebind handoff behavior (AC: 2)
  - [x] Prevent dead-end states during cross-client recovery
- [x] Clear stale authenticated state on successful recovery or rebind completion (AC: 3)
  - [x] Force fresh password+TOTP login after recovery success
- [x] Add FE/MOB regression coverage for MFA error and recovery flows (AC: 1, 2, 3, 4)
  - [x] Verify cross-client semantic parity for the same backend code set

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1.
- Baseline companion artifact: `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`.
- Depends on: Story 1.12, Story 1.13, Story 1.14.

### Technical Requirements

- FE and MOB may differ in UI layout, but they must preserve the same semantic guidance for identical backend outcomes.
- Recovery entry points must not reveal whether the account exists or whether an old authenticator is still present.
- Successful recovery must clear stale session/auth state before the next login.
- Canonical recovery routes:
  - Web: `/mfa-recovery`, `/mfa-recovery/rebind`
  - Mobile auth route keys: `mfaRecovery`, `mfaRecoveryRebind`
- FE/MOB MFA error mapping must align for `AUTH-009`, `AUTH-010`, `AUTH-011`, `AUTH-018`, `AUTH-021`, `RATE-001`, and unknown fallback with correlation/support context.
- `AUTH-021` must route to the MFA recovery entry flow, while `AUTH-009` continues to route only to first-time enrollment.
- Successful `POST /api/v1/auth/mfa-recovery/rebind/confirm` must clear local auth store, discard stale recovery proof state, and return the user to sign-in with success guidance.

### Architecture Compliance

- Preserve existing FE/MOB auth-store and route-stack conventions.
- Keep correlation-id visibility for unknown error outcomes.

### Testing Requirements

- Cover MFA error mapping, recovery entry, rebind completion return path, and unknown-code fallback on both web and mobile.
- Verify that FE and MOB present equivalent next-action semantics for the same `AUTH-021` / `AUTH-019` / `AUTH-020` backend outcomes.

### Story Completion Status

- Status set to `done`.
- Completion note: Web and mobile MFA recovery/rebind UX shipped with aligned error semantics, stale-state clearing, and passing regression coverage.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.15)
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `pnpm vitest run tests/integration/password-recovery.test.tsx`
- `pnpm vitest run tests/integration/App.test.tsx tests/unit/lib/auth-errors.test.ts`
- `pnpm run type-check && pnpm run lint && pnpm run test && pnpm run build`
- `npm exec vitest run tests/unit/auth/use-mfa-recovery-view-model.test.tsx tests/unit/auth/use-mfa-recovery-rebind-view-model.test.tsx tests/unit/auth/MfaRecoveryScreen.test.tsx tests/unit/auth/MfaRecoveryRebindScreen.test.tsx tests/unit/auth/AppNavigator.mfa-recovery.test.tsx tests/unit/auth/auth-errors.test.ts`
- `npm run typecheck && npm run lint && npm run test && npm run bundle:dry-run`

### Completion Notes List

- Refactored the touched web auth flows in scope to `react-hook-form` plus `zod` validation, centralized schemas in `FE/src/lib/schemas/auth.schema.ts`, and removed the legacy manual login form-state hook.
- Added web MFA recovery UX alignment for `AUTH-026`, routed authenticated `AUTH-009` into a safe login-restart enrollment handoff instead of a guarded dead-end route, preserved restart guidance for stale `AUTH-019` / `AUTH-020` rebind confirmations, and exposed a visible manual-refresh banner when notification streaming is unavailable.
- Moved mobile MFA recovery orchestration out of the screen components into new screen-scoped view-model hooks while aligning `AUTH-026` presentation, authenticated `AUTH-009` login-restart handoff, and stale rebind restart banners with the web semantics.
- Added FE and MOB regression coverage for the new canonical error mapping, unsupported session-monitoring fallback, stale-rebind restart behavior, and the full CI command set used by the web and mobile clients.
- Followed up on the review pass by preserving forgot-password retry affordances while clearing stale challenge tokens, loading FE/MOB auth contract fixtures directly from the shared JSON source, and adding navigator-level mobile regression coverage for MFA recovery composition.

### File List

- FE/package.json
- FE/pnpm-lock.yaml
- FE/src/components/auth/ForgotPasswordForm.tsx
- FE/src/components/auth/LoginForm.tsx
- FE/src/components/auth/LoginMfaForm.tsx
- FE/src/components/auth/MfaRecoveryEntryForm.tsx
- FE/src/components/auth/MfaRecoveryRebindForm.tsx
- FE/src/components/auth/PasswordResetForm.tsx
- FE/src/context/NotificationContext.tsx
- FE/src/hooks/auth/useForgotPasswordPageController.ts
- FE/src/hooks/auth/useLoginFormState.ts (deleted)
- FE/src/hooks/auth/useLoginPageController.ts
- FE/src/hooks/auth/useMfaRecoveryPageController.ts
- FE/src/hooks/auth/useMfaRecoveryRebindPageController.ts
- FE/src/hooks/auth/useResetPasswordPageController.ts
- FE/src/lib/auth-errors.ts
- FE/src/lib/schemas/auth.schema.ts
- FE/tests/fixtures/auth-error-contract.ts
- FE/tests/integration/password-recovery.test.tsx
- FE/tests/integration/App.test.tsx
- FE/tests/unit/lib/auth-errors.test.ts
- MOB/src/auth/auth-errors.ts
- MOB/src/auth/auth-flow-view-model.ts
- MOB/src/auth/use-mfa-recovery-rebind-view-model.ts
- MOB/src/auth/use-mfa-recovery-view-model.ts
- MOB/src/auth/use-auth-flow-view-model.ts
- MOB/src/navigation/AppNavigator.tsx
- MOB/src/screens/auth/MfaRecoveryRebindScreen.tsx
- MOB/src/screens/auth/MfaRecoveryScreen.tsx
- MOB/tests/fixtures/auth-error-contract.ts
- MOB/tests/unit/auth/AppNavigator.mfa-recovery.test.tsx
- MOB/tests/unit/auth/MfaRecoveryRebindScreen.test.tsx
- MOB/tests/unit/auth/MfaRecoveryScreen.test.tsx
- MOB/tests/unit/auth/auth-errors.test.ts
- MOB/tests/unit/auth/auth-flow-view-model.test.ts
- MOB/tests/unit/auth/use-mfa-recovery-rebind-view-model.test.tsx
- MOB/tests/unit/auth/use-mfa-recovery-view-model.test.tsx
- docs/contracts/auth-error-standardization.json
- docs/contracts/recovery-challenge-auth-errors.json
- docs/contracts/recovery-challenge-fail-closed.json
- _bmad-output/implementation-artifacts/1-15-fe-mob-mfa-recovery-and-error-ux-alignment.md

### Change Log

- 2026-03-13: Realigned web and mobile MFA recovery follow-up work to the architecture conventions by migrating scoped web auth forms to RHF/Zod, adding screen-scoped mobile recovery view-model hooks, standardizing `AUTH-026` and stale rebind restart UX, and rerunning the full FE/MOB verification suite.
