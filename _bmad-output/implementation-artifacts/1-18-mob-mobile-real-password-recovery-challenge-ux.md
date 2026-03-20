# Story 1.18: [MOB] Mobile Real Password Recovery Challenge UX

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a locked-out mobile user,
I want the native recovery flow to render and submit the real proof-of-work challenge,
So that I can complete password recovery without stale state, redirect loss, or fragile app-state handling.

## Acceptance Criteria

1. Given the recovery challenge branch is entered, when the app receives the exact legacy Story `1.7` bootstrap shape (`challengeToken + challengeType + challengeTtlSeconds` only) it preserves Story `1.9` behavior, and when it receives `challengeType=proof-of-work` with `challengeContractVersion=2` it renders the correct native proof-of-work interaction without changing the existing recovery semantics.
2. Given the app submits a challenged forgot request, when the proof-of-work solve completes, then `challengeToken` and scalar `challengeAnswer` are submitted through the existing recovery contract, `challengeAnswerPayload` remains absent in the current rollout, the originally submitted email string remains unchanged, and raw proof is not persisted to keychain, async storage, analytics, or logs.
3. Given a CSRF failure on challenge bootstrap or challenged forgot submit, when the app receives raw `403 Forbidden`, then it preserves the existing one-refresh and one-retry policy with identical payload and does not introduce silent extra retries.
4. Given `AUTH-022`, `AUTH-023`, `AUTH-024`, or `AUTH-025`, when the app receives those outcomes, then it shows deterministic guidance aligned to the canonical auth-error contract: `AUTH-022` refreshes the challenge, `AUTH-023` retries later with `Retry-After` backoff when present and otherwise shows generic retry-later guidance with no auto-retry, `AUTH-024` clears stale state and refreshes the challenge, and `AUTH-025` always clears the current challenge before a restart path is offered, without trapping the user in stale-proof loops or back-stack dead ends.
5. Given the proof-of-work solve is in progress, when the user cancels, backgrounds the app, or resumes after foreground restoration, then the solve runs off the main UI thread, progress becomes visible within `150ms`, cancel input is acknowledged within `250ms`, and the client either resumes the still-valid challenge or clears it with an explicit refresh CTA if validity cannot be guaranteed from the authoritative server timestamps or estimated clock skew exceeds `30s`.
6. Given `challengeContractVersion` is unknown, `challengeType` and `challengePayload.kind` do not match, the proof-of-work payload is malformed, a partial mixed v1/v2 bundle is received, estimated clock skew against `challengeIssuedAtEpochMs` exceeds `30s`, or validity cannot be trusted after background or resume, when the app cannot trust the active challenge, then it fails closed, clears active challenge state, offers fresh challenge refresh guidance instead of attempting or resuming a local solve, and records the exact canonical fail-closed telemetry reason including `mixed-shape`, `clock-skew`, or `validity-untrusted` when applicable.
7. Given challenge expiry, replay rejection, verify-path failure, or a newly issued challenge bundle on the same recovery route, when the app transitions to the latest challenge instance identified by a newer distinct `challengeId`, then stale challenge state is replaced deterministically only when the new bundle carries a strictly greater authoritative `challengeIssuedAtEpochMs`, equal authoritative timestamps with distinct ids fail closed and refresh, and only the most recent challenge remains active.
8. Given the user entered password recovery with a protected-route redirect intent, when the app traverses challenge bootstrap, challenged forgot submit, reset, and return-to-login success, then the original redirect intent remains preserved end to end.
9. Given regression and live coverage, when verification runs, then mobile proves happy path, invalid proof, replayed proof, expired proof, bootstrap unavailable, verify unavailable, `Retry-After` guidance, unknown contract fail-closed behavior, `clock-skew` fail-closed behavior, `validity-untrusted` fail-closed behavior, exact canonical fail-closed reason labeling, authoritative issue-time replacement ordering including equal-timestamp collision fail-close, deterministic return-to-login continuity, and background or resume safety.

## Tasks / Subtasks

- [ ] Extend mobile recovery state and API client for proof-of-work v2 (AC: 1, 2, 3)
  - [ ] Consume `challengeContractVersion=2`, opaque `challengeId`, authoritative issued/expiry epochs, and the discriminated proof-of-work bundle
  - [ ] Preserve the original submitted email string and existing one-refresh/one-retry CSRF behavior
- [ ] Implement native proof-of-work solve UX with mobile-safe lifecycle handling (AC: 1, 5, 6)
  - [ ] Run solve work off the main UI thread
  - [ ] Key transient challenge state by opaque `challengeId` and replace stale state only when a newer distinct `challengeId` with greater authoritative `challengeIssuedAtEpochMs` arrives
  - [ ] Fail closed and refresh if distinct bundles arrive with equal authoritative issue timestamps, or when cancel, background, and resume transitions leave validity confidence in `clock-skew` or `validity-untrusted` state
  - [ ] Record canonical fail-closed telemetry reasons from `docs/contracts/recovery-challenge-fail-closed.json` for `unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, and `validity-untrusted`
- [ ] Align mobile recovery error semantics with the canonical auth contract (AC: 4)
  - [ ] Add deterministic guidance for `AUTH-022`, `AUTH-023`, `AUTH-024`, and `AUTH-025`
  - [ ] Prevent stale-proof loops and back-stack dead ends
  - [ ] Honor `Retry-After` as advisory backoff for bootstrap-unavailable and restart-only verify-unavailable flows
  - [ ] Keep all pre-submit bundle-trust failures on canonical `refresh-challenge` guidance rather than restart-only recovery copy
- [ ] Preserve redirect continuity across the full mobile recovery lane (AC: 8)
  - [ ] Carry protected-route intent through forgot, challenge, reset, and return-to-login success
- [ ] Add automated mobile coverage for proof-of-work recovery (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - [ ] Cover contract parsing, background/resume handling, stale-state replacement, exact canonical fail-closed reason labeling, `Retry-After` present vs absent handling, CSRF retry behavior, error mapping, and redirect preservation
  - [ ] Prove equal-timestamp collision, `clock-skew`, and `validity-untrusted` paths fail closed with refresh guidance before solve or resume continues

## Dev Notes

### Developer Context Section

- Canonical tracking source: `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-18-mob-mobile-real-password-recovery-challenge-ux`.
- Canonical planning precedence: `_bmad-output/planning-artifacts/prd.md` / `_bmad-output/planning-artifacts/architecture.md` -> `_bmad-output/planning-artifacts/ux-design-specification.md` -> `_bmad-output/planning-artifacts/channels/login_flow.md` -> `_bmad-output/planning-artifacts/channels/api-spec.md` -> `_bmad-output/planning-artifacts/epics.md`.
- Supplemental story-set context lives in `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`.
- Depends on: Story `1.6`, Story `1.9`, Story `1.16`.

### Technical Requirements

- Mobile consumes only the contract-driven proof-of-work bundle. Do not hardcode browser-only assumptions or provider SDK behavior.
- Mobile uses scalar `challengeAnswer` only in the current proof-of-work rollout. `challengeAnswerPayload` stays out of scope until a future adapter story explicitly enables it.
- Mobile preserves the originally submitted email string verbatim between challenge bootstrap and challenged forgot submit.
- Mobile preserves protected-route redirect intent through the full recovery round-trip.
- Mobile must treat `challengeIssuedAtEpochMs` / `challengeExpiresAtEpochMs` as authoritative. `challengeTtlSeconds` is informational only.
- Mobile applies a `5s` expiry safety margin before starting or resuming solve work. If estimated clock skew between local receipt time and `challengeIssuedAtEpochMs` exceeds `30s`, Mobile records canonical reason `clock-skew`, discards the challenge, and refreshes. If skew or validity can no longer be trusted after resume or once the client enters the expiry safety window, Mobile records canonical reason `validity-untrusted`, discards the challenge, and refreshes.
- Mobile must fail closed on unknown `challengeContractVersion`, discriminator mismatch, or malformed proof-of-work payload. Opaque token/body binding mismatches and exact-email drift are server-detected `AUTH-022` conditions, not client-side checks.
- Mobile must preserve legacy Story `1.9` behavior only when the backend returns the exact legacy v1 bootstrap shape. Partial mixed v1/v2 bundles are malformed and must fail closed.
- Mobile keeps existing recovery CSRF behavior:
  - refresh CSRF once
  - retry once with identical payload
  - second `403` is terminal
- Mobile error semantics must align with Story `1.6`:
  - `AUTH-022` -> invalid/expired/mismatched/malformed proof; clear active challenge state and require a fresh challenge refresh
  - `AUTH-023` -> bootstrap unavailable; if `Retry-After` is present, show the backoff window and suppress immediate retry until it elapses; otherwise show generic retry-later guidance with no auto-retry
  - `AUTH-024` -> replay/already consumed proof; clear stale state and refresh
  - `AUTH-025` -> verify unavailable after solve; clear current challenge and restart challenge bootstrap
  - if `AUTH-025` includes `Retry-After`, surface it as advisory backoff before restart; never treat it as permission to replay the same proof
- Mobile must emit client-side telemetry for fail-closed bundle rejection reasons (`unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, `validity-untrusted`) using the canonical labels in `docs/contracts/recovery-challenge-fail-closed.json` so Story `1.19` can measure contract-health regressions.
- Mobile treats `challengeIssuedAtEpochMs` as the ordering source for challenge replacement. A newer distinct `challengeId` replaces the active bundle only when it carries a strictly greater authoritative issue timestamp; equal timestamps with different ids are malformed and must fail closed with refresh guidance.
- Performance guardrails:
  - solve work must not block the main UI thread
  - progress visible within `150ms`
  - cancel acknowledged within `250ms`
  - p95 solve time `<= 5s` and p99 solve time `<= 8s` on the documented supported baseline mobile devices used for release evidence
  - if validity cannot be guaranteed after background or resume, clear the active challenge and require refresh

### Architecture Compliance

- Reuse the existing mobile auth architecture:
  - `useAuthFlowViewModel -> screen/view-model hooks -> mobile-auth-service -> auth-api -> HttpClient/CsrfTokenManager`
- Keep recovery challenge state transient. Do not write raw proof, challenge token, or submitted answer into keychain, async storage, launch arguments, or logs.
- Preserve custom auth navigation semantics and avoid app-stack corruption on failure or success.

### Testing Requirements

- Required checks:
  - proof-of-work v2 contract is parsed correctly
  - v2 bootstrap state is keyed by `challengeId`, and a newer distinct `challengeId` with greater `challengeIssuedAtEpochMs` replaces the prior active challenge while exact legacy v1 carries no `challengeId`
  - current proof-of-work submit path sends scalar `challengeAnswer` only and omits `challengeAnswerPayload`
  - exact legacy v1 bootstrap shape still preserves Story `1.9` behavior while rollout flag is off or the request is outside the challenge-capable cohort
  - solve work does not block the main UI thread and meets the documented responsiveness budgets
  - solve-time evidence on documented baseline mobile devices stays within the p95/p99 budget
  - original submitted email string is preserved on the challenged forgot submit
  - raw `403` still performs exactly one refresh and one retry
  - `AUTH-022`, `AUTH-023`, `AUTH-024`, and `AUTH-025` map to stable mobile guidance
  - unknown contract version, discriminator mismatch, malformed payload, or partial mixed v1/v2 bundle fails closed without attempting solve and records the exact canonical client telemetry reason
  - estimated clock skew `> 30s` records `clock-skew`, and untrusted resume or expiry-window entry records `validity-untrusted`, with challenge state cleared before solve resumes
  - `AUTH-023` with and without `Retry-After` produces the documented backoff guidance without auto-retry
  - `AUTH-025` with and without `Retry-After` clears the current challenge and produces restart-only guidance without replay
  - protected-route redirect intent survives challenge bootstrap through return-to-login success
  - background/resume either safely resumes a valid challenge or clears it deterministically, without retaining a superseded `challengeId`
  - distinct bundles with equal `challengeIssuedAtEpochMs` and different `challengeId` fail closed and refresh rather than racing for active state
  - live or integration evidence covers bootstrap unavailable and verify unavailable separately

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story scaffold regenerated from canonical Epic 1 follow-on planning and mobile recovery hardening requirements.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.18)
- `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/login_flow.md`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`
- `_bmad-output/implementation-artifacts/1-9-mob-mobile-password-recovery-ux.md`
- `_bmad-output/implementation-artifacts/1-16-be-real-password-recovery-challenge-provider-and-verification.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical Epic 1 follow-on planning artifacts for execution readiness.
- 2026-03-20: Parallel mobile implementation pass landed for proof-of-work v2 recovery UX, lifecycle-safe fail-closed handling, and MOB test coverage updates. Validation commands were not executed in this run.

### Completion Notes List

- Story scaffold created for mobile proof-of-work recovery UX, lifecycle safety, deterministic error handling, and redirect preservation.
- Added mobile parsing and transient handling for legacy-v1 and proof-of-work v2 recovery challenge bundles.
- Added fail-closed mobile recovery handling for unknown-version, kind-mismatch, malformed-payload, mixed-shape, clock-skew, and validity-untrusted cases, including background or resume reset behavior.
- Added mobile guidance coverage for AUTH-022/AUTH-023/AUTH-024/AUTH-025 and tests for bundle parsing plus forgot-password view-model behavior.
- Added runtime fail-closed telemetry sink behavior and separated transport-harness coverage from actual view-model recovery coverage.

### File List

- MOB/src/auth/auth-errors.ts
- MOB/src/auth/recovery-challenge.ts
- MOB/src/auth/use-forgot-password-view-model.ts
- MOB/src/screens/auth/ForgotPasswordScreen.tsx
- MOB/src/types/auth.ts
- MOB/tests/unit/api/auth-api.test.ts
- MOB/tests/unit/auth/recovery-challenge-auth-errors.test.ts
- MOB/tests/unit/auth/recovery-challenge.test.ts
- MOB/tests/unit/auth/use-forgot-password-view-model.test.tsx
- _bmad-output/implementation-artifacts/1-18-mob-mobile-real-password-recovery-challenge-ux.md

## Change Log

- 2026-03-20: Added mobile proof-of-work v2 recovery UX, lifecycle-safe fail-closed handling, runtime fail-closed telemetry sink coverage, and validated MOB test updates.

## QA Update - 2026-03-20
- Automated QA completed for the mobile password recovery proof-of-work UX, fail-closed handling, view-model solve flow, and mobile auth transport harness coverage.
- Added v2 bootstrap service coverage in `/Users/yeongjae/fixyz/MOB/tests/unit/auth/mobile-auth-service.test.ts`.
- Added mobile auth transport harness coverage in `/Users/yeongjae/fixyz/MOB/tests/integration/mobile-password-recovery-transport.test.ts`.
- Verified mobile recovery unit, API, view-model, and transport harness coverage pass.
- Live BE-MOB forgot-password challenge-submit was revalidated on the `iPhone 17` simulator after fixing the `AppNavigator` runtime prop wiring, local HTTP session-cookie compatibility, and compact-height auth scrolling.
- QA outcome: pass
