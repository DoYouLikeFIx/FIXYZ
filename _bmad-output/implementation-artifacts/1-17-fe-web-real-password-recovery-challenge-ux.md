# Story 1.17: [FE] Web Real Password Recovery Challenge UX

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a locked-out web user,
I want the browser recovery flow to render and submit the real proof-of-work challenge,
So that I can complete password recovery without stale state, redirect loss, or browser-specific confusion.

## Acceptance Criteria

1. Given the recovery challenge branch is entered, when the browser receives the exact legacy Story `1.7` bootstrap shape (`challengeToken + challengeType + challengeTtlSeconds` only) it preserves Story `1.8` behavior, and when it receives `challengeType=proof-of-work` with `challengeContractVersion=2` it renders the correct proof-of-work interaction without changing the existing forgot-password flow structure.
2. Given the browser submits a challenged forgot request, when the proof-of-work solve completes, then `challengeToken` and scalar `challengeAnswer` are submitted through the existing recovery contract, `challengeAnswerPayload` remains absent in the current rollout, the originally submitted email string remains unchanged, and raw proof is not persisted to browser storage, analytics, or logs.
3. Given a CSRF failure on challenge bootstrap or challenged forgot submit, when the browser receives raw `403 Forbidden`, then it preserves the existing one-refresh and one-retry policy with identical payload and does not introduce silent extra retries.
4. Given `AUTH-022`, `AUTH-023`, `AUTH-024`, or `AUTH-025`, when the browser receives those outcomes, then it shows deterministic guidance aligned to the canonical auth-error contract: `AUTH-022` refreshes the challenge, `AUTH-023` retries later with `Retry-After` backoff when present and otherwise shows generic retry-later guidance with no auto-retry, `AUTH-024` clears stale state and refreshes the challenge, and `AUTH-025` clears the current challenge and requires a full challenge restart, without trapping the user in blind retry loops.
5. Given challenge expiry, replay rejection, verify-path failure, or a new challenge bundle on the same route, when the browser transitions to the latest challenge instance identified by a newer distinct `challengeId`, then stale challenge state is replaced deterministically only when the new bundle carries a strictly greater authoritative `challengeIssuedAtEpochMs`, equal authoritative timestamps with distinct ids fail closed and refresh, and only the most recent challenge remains active.
6. Given `challengeContractVersion` is unknown, `challengeType` and `challengePayload.kind` do not match, the proof-of-work payload is malformed, a partial mixed v1/v2 bundle is received, estimated clock skew against `challengeIssuedAtEpochMs` exceeds `30s`, or validity cannot be trusted after background or resume, when the browser cannot trust the active challenge, then it fails closed, clears active challenge state, offers fresh challenge refresh guidance instead of attempting or resuming a local solve, and records the exact canonical fail-closed telemetry reason including `mixed-shape`, `clock-skew`, or `validity-untrusted` when applicable.
7. Given the user entered password recovery with a protected-route redirect intent, when the browser traverses challenge bootstrap, challenged forgot submit, reset, and return-to-login success, then the original redirect intent remains preserved end to end.
8. Given regression and live coverage, when verification runs, then the browser proves happy path, invalid proof, replayed proof, expired proof, bootstrap unavailable, verify unavailable, `Retry-After` guidance, unknown contract fail-closed behavior, `clock-skew` fail-closed behavior, `validity-untrusted` fail-closed behavior, exact canonical fail-closed reason labeling, authoritative issue-time replacement ordering including equal-timestamp collision fail-close, and redirect-preserving recovery completion.

## Tasks / Subtasks

- [ ] Extend FE recovery controllers and API client for proof-of-work v2 (AC: 1, 2, 3)
  - [ ] Consume `challengeContractVersion=2`, opaque `challengeId`, authoritative issued/expiry epochs, and the discriminated proof-of-work bundle
  - [ ] Preserve the original submitted email payload and existing one-refresh/one-retry CSRF behavior
- [ ] Implement contract-driven proof-of-work solve UX (AC: 1, 2, 5, 6)
  - [ ] Render progress, refresh, and restart actions without leaking provider internals into the rest of the auth flow
  - [ ] Key transient challenge state by opaque `challengeId` and replace stale state only when a newer distinct `challengeId` with greater authoritative `challengeIssuedAtEpochMs` arrives
  - [ ] Fail closed and refresh if distinct bundles arrive with equal authoritative issue timestamps, or when authoritative timestamps indicate expiry-window entry, clock-skew confidence loss, or other `validity-untrusted` resume states
  - [ ] Record canonical fail-closed telemetry reasons from `docs/contracts/recovery-challenge-fail-closed.json` for `unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, and `validity-untrusted`
- [ ] Align FE recovery error semantics with the canonical auth contract (AC: 4)
  - [ ] Add deterministic guidance for `AUTH-022`, `AUTH-023`, `AUTH-024`, and `AUTH-025`
  - [ ] Clear stale state on replay or verify-unavailable paths
  - [ ] Honor `Retry-After` as advisory backoff for bootstrap-unavailable and restart-only verify-unavailable flows
  - [ ] Keep all pre-submit bundle-trust failures on canonical `refresh-challenge` guidance rather than restart-only recovery copy
- [ ] Preserve redirect continuity across the full recovery lane (AC: 7)
  - [ ] Carry protected-route intent through forgot, challenge, reset, and return-to-login success
- [ ] Add automated FE coverage for proof-of-work recovery (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [ ] Cover contract parsing, stale-state replacement, exact canonical fail-closed reason labeling, `Retry-After` present vs absent handling, CSRF retry behavior, and redirect preservation
  - [ ] Prove equal-timestamp collision, `clock-skew`, and `validity-untrusted` paths fail closed with refresh guidance before solve or resume continues

## Dev Notes

### Developer Context Section

- Canonical tracking source: `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-17-fe-web-real-password-recovery-challenge-ux`.
- Canonical planning precedence: `_bmad-output/planning-artifacts/prd.md` / `_bmad-output/planning-artifacts/architecture.md` -> `_bmad-output/planning-artifacts/ux-design-specification.md` -> `_bmad-output/planning-artifacts/channels/login_flow.md` -> `_bmad-output/planning-artifacts/channels/api-spec.md` -> `_bmad-output/planning-artifacts/epics.md`.
- Supplemental story-set context lives in `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`.
- Depends on: Story `1.6`, Story `1.8`, Story `1.16`.

### Technical Requirements

- FE consumes only the contract-driven proof-of-work bundle. Do not hardcode provider libraries or browser-only assumptions.
- FE uses scalar `challengeAnswer` only in the current proof-of-work rollout. `challengeAnswerPayload` stays out of scope until a future adapter story explicitly enables it.
- FE preserves the originally submitted email string verbatim between challenge bootstrap and challenged forgot submit.
- FE preserves protected-route redirect intent through the full recovery round-trip.
- FE must treat `challengeIssuedAtEpochMs` / `challengeExpiresAtEpochMs` as authoritative. `challengeTtlSeconds` is informational only.
- FE applies a `5s` expiry safety margin before starting or resuming solve work. If estimated clock skew between local receipt time and `challengeIssuedAtEpochMs` exceeds `30s`, FE records canonical reason `clock-skew`, discards the challenge, and refreshes. If skew or validity can no longer be trusted after resume or once the client enters the expiry safety window, FE records canonical reason `validity-untrusted`, discards the challenge, and refreshes.
- FE must fail closed on unknown `challengeContractVersion`, discriminator mismatch, or malformed proof-of-work payload. Opaque token/body binding mismatches and exact-email drift are server-detected `AUTH-022` conditions, not client-side checks.
- FE must preserve legacy Story `1.8` behavior only when the backend returns the exact legacy v1 bootstrap shape. Partial mixed v1/v2 bundles are malformed and must fail closed.
- FE keeps existing recovery CSRF behavior:
  - re-fetch CSRF once
  - retry once with identical payload
  - second `403` is terminal
- FE error semantics must align with Story `1.6`:
  - `AUTH-022` -> invalid/expired/mismatched/malformed proof; clear active challenge state and require a fresh challenge refresh
  - `AUTH-023` -> bootstrap unavailable; if `Retry-After` is present, show the backoff window and suppress immediate retry until it elapses; otherwise show generic retry-later guidance with no auto-retry
  - `AUTH-024` -> replay/already consumed proof; clear stale state and refresh
  - `AUTH-025` -> verify unavailable after solve; clear current challenge and restart challenge bootstrap
  - if `AUTH-025` includes `Retry-After`, surface it as advisory backoff before restart; never treat it as permission to replay the same proof
- FE must emit client-side telemetry for fail-closed bundle rejection reasons (`unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, `validity-untrusted`) using the canonical labels in `docs/contracts/recovery-challenge-fail-closed.json` so Story `1.19` can measure contract-health regressions.
- FE treats `challengeIssuedAtEpochMs` as the ordering source for challenge replacement. A newer distinct `challengeId` replaces the active bundle only when it carries a strictly greater authoritative issue timestamp; equal timestamps with different ids are malformed and must fail closed with refresh guidance.
- FE proof-of-work solve must keep the page responsive, show visible progress within `150ms`, and stay within the canonical supported-browser budget of p95 `<= 4s` and p99 `<= 6s` on the documented baseline browser and device used for release evidence.

### Architecture Compliance

- Reuse the existing FE auth architecture:
  - `pages -> hooks/auth/*PageController -> api/authApi.ts -> lib/axios.ts -> zustand auth store`
- Keep recovery challenge state transient. Do not write raw proof, challenge token, or submitted answer into persistent browser storage.
- Do not bypass the existing login/reset route and redirect helpers.

### Testing Requirements

- Required checks:
  - proof-of-work v2 contract is parsed correctly
  - v2 bootstrap state is keyed by `challengeId`, and a newer distinct `challengeId` with greater `challengeIssuedAtEpochMs` replaces the prior active challenge while exact legacy v1 carries no `challengeId`
  - current proof-of-work submit path sends scalar `challengeAnswer` only and omits `challengeAnswerPayload`
  - exact legacy v1 bootstrap shape still preserves Story `1.8` behavior while rollout flag is off or the request is outside the challenge-capable cohort
  - stale challenge state is replaced only when a newer distinct `challengeId` bundle with greater authoritative issue time arrives
  - distinct bundles with equal `challengeIssuedAtEpochMs` and different `challengeId` fail closed and refresh rather than racing for active state
  - original submitted email string is preserved on the challenged forgot submit
  - raw `403` still performs exactly one refresh and one retry
  - `AUTH-022`, `AUTH-023`, `AUTH-024`, and `AUTH-025` map to stable FE guidance
  - unknown contract version, discriminator mismatch, malformed payload, or partial mixed v1/v2 bundle fails closed without attempting solve and records the exact canonical client telemetry reason
  - estimated clock skew `> 30s` records `clock-skew`, and untrusted resume or expiry-window entry records `validity-untrusted`, with challenge state cleared before solve resumes
  - `AUTH-023` with and without `Retry-After` produces the documented backoff guidance without auto-retry
  - `AUTH-025` with and without `Retry-After` clears the current challenge and produces restart-only guidance without replay
  - protected-route redirect intent survives challenge bootstrap through return-to-login success
  - supported-browser solve-time evidence stays within the documented p95/p99 budget
  - live or integration evidence covers bootstrap unavailable and verify unavailable separately

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story scaffold regenerated from canonical Epic 1 follow-on planning and web recovery hardening requirements.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.17)
- `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/login_flow.md`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`
- `_bmad-output/implementation-artifacts/1-8-fe-web-password-recovery-ux.md`
- `_bmad-output/implementation-artifacts/1-16-be-real-password-recovery-challenge-provider-and-verification.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical Epic 1 follow-on planning artifacts for execution readiness.
- 2026-03-20: Parallel web implementation pass landed for proof-of-work v2 recovery UX, fail-closed handling, and FE test coverage updates. Validation commands were not executed in this run.

### Completion Notes List

- Story scaffold created for FE proof-of-work recovery UX, stale-state control, deterministic error handling, and redirect preservation.
- Added FE parsing and transient handling for legacy-v1 and proof-of-work v2 recovery challenge bundles.
- Added fail-closed web challenge handling for unknown-version, kind-mismatch, malformed-payload, mixed-shape, clock-skew, and validity-untrusted cases.
- Added FE auth-error guidance and tests for AUTH-022/AUTH-023/AUTH-024/AUTH-025 plus proof-of-work bundle parsing and recovery flow behavior.
- Runtime fail-closed telemetry now always reaches a built-in sink, and transport-harness coverage is documented separately from route-level UI coverage.

### File List

- FE/src/components/auth/ForgotPasswordForm.tsx
- FE/src/hooks/auth/useForgotPasswordPageController.ts
- FE/src/lib/auth-errors.ts
- FE/src/lib/recovery-challenge.ts
- FE/src/types/auth.ts
- FE/tests/integration/password-recovery.test.tsx
- FE/tests/unit/api/authApi.test.ts
- FE/tests/unit/lib/auth-errors.test.ts
- FE/tests/unit/lib/recovery-challenge.test.ts
- _bmad-output/implementation-artifacts/1-17-fe-web-real-password-recovery-challenge-ux.md

## Change Log

- 2026-03-20: Added web proof-of-work v2 recovery UX, fail-closed handling, runtime fail-closed telemetry sink coverage, and validated FE test updates.

## QA Update - 2026-03-20
- Automated QA completed for the web password recovery proof-of-work UX, fail-closed handling, route-level integration, and FE auth transport harness coverage.
- Added FE auth transport harness coverage in `/Users/yeongjae/fixyz/FE/tests/integration/password-recovery-transport.test.ts`.
- Verified web challenge parsing and actual route integration coverage remain green, including `/Users/yeongjae/fixyz/FE/tests/integration/password-recovery.test.tsx`.
- Live BE-FE forgot-password acceptance and challenge bootstrap were revalidated with Playwright against `http://127.0.0.1:8080` after the backend session-cookie and live preflight fixes.
- QA outcome: pass
