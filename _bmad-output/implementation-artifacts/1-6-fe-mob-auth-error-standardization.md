# Story 1.6: FE/MOB Auth Error Standardization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a cross-client product team,
I want FE/MOB auth error handling standardized,
so that users receive consistent guidance regardless of client.

## Acceptance Criteria

1. Given identical backend auth code, when FE and MOB render message, then user-facing semantics are aligned.
2. Given lockout/expired/rate-limit cases, when triggered, then both clients show recoverable next actions.
3. Given untranslated or unknown code, when received, then fallback message and correlation id are surfaced.

## Tasks / Subtasks

- [x] Define shared auth error mapping contract for FE + MOB (AC: 1)
  - [x] Create canonical code-to-message semantics table
  - [x] Keep language/action consistency across clients
- [x] Implement lockout/expired/rate-limit UX parity (AC: 2)
  - [x] Ensure recoverable next steps are shown consistently
  - [x] Align redirect/retry guidance between clients
- [x] Implement unknown-code fallback with traceability (AC: 3)
  - [x] Provide safe generic message
  - [x] Surface correlation id for support diagnostics
- [x] Add cross-client contract tests or snapshot assertions for parity

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.10`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.10`); use it only for technical constraints, not story ID mapping.

- Depends on Stories 1.3, 1.4, and 1.5.
- This story is a cross-client consistency pass, not a new auth feature.
- Outcome must reduce support ambiguity and improve incident triage quality.

### Technical Requirements

- Error mapping must be centralized per client and source-controlled with explicit code coverage.
- Recoverability guidance is required for key auth failures (lockout/session-expired/rate-limit).
- Unknown-code fallback must be deterministic and include correlation key visibility.

### Architecture Compliance

- Respect architecture error-envelope conventions and correlation-id propagation model.
- Do not create FE/MOB divergent interpretations for the same backend code.
- Keep UX behavior compatible with session-expiry and route-guard flows defined earlier.

### Library / Framework Requirements

- Latest client-stack references (2026-02-25):
  - `react-router-dom`: `7.13.1`
  - `zustand`: `5.0.11`
  - `react-native`: `0.84.0`
- Guardrail:
  - Standardization should be framework-agnostic at contract level, framework-specific only at rendering/navigation layer.

### File Structure Requirements

- Expected touched areas:
  - `FE/src/lib/errors*` or equivalent mapping module
  - `FE/src/lib/axios*` interceptors
  - `FE/src/components/Error*`
  - `MOB/src/network/errors*` or equivalent mapping module
  - `MOB/src/components/feedback/**`
  - Cross-client docs/spec artifact if maintained
- Avoid copy-paste drift by establishing one canonical mapping table per client lane sourced from shared contract.

### Testing Requirements

- Required checks:
  - Same backend auth code -> same semantic message/action on FE and MOB.
  - Lockout/expired/rate-limit scenarios show expected next actions.
  - Unknown code fallback includes correlation id and non-breaking UX.
  - Regression tests prevent mapping divergence over time.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify 'story_key ↔ filename ↔ sprint-status key' are identical before moving status from 'ready-for-dev' to 'in-progress'.
  - Reject implementation start if key mismatch is detected between canonical Epic 1 numbering (`epics.md`) and supplemental Epic artifact.
- FE/MOB session consistency gate:
  - Validate same behavior matrix for FE and MOB on: valid session, expired session, invalidated-by-new-login, logout-after-call, app/browser resume.
  - Validate same user-facing semantics for re-auth guidance and fallback handling (401 + session-expiry event paths).
- Lockout/rate-limit boundary gate:
  - Add boundary tests for `N-1`, `N`, `N+1` attempts (IP limit and account lockout separately).
  - Validate cooldown/reset behavior and ensure locked account remains denied even with correct credentials until admin unlock.
  - Validate security event persistence on lockout with correlation key for traceability.
- Quality risk severity gate:
  - Any P0/P1 defect in auth/session/security behavior blocks status transition to `review`.
  - Any accepted P2 defect must include issue ID, owner, and due date in QA evidence.
- Evidence gate for review handoff:
  - Attach automated test evidence for this story and impacted Epic 1 regression scenarios.
  - Attach negative-path replay result for `N-1`, `N`, `N+1` boundaries and session expiry paths.
  - Attach one correlation sample linking client-visible error to server-side security event/log.
- Party review resolution status (closeout confirmed 2026-03-11):
  - [x] FE/MOB canonical mapping table evidence attached (`same code -> same semantics`) with diff-free review.
  - [x] Lockout/expired/rate-limit recoverable next-action parity evidence attached for both clients.
  - [x] Unknown-code fallback evidence attached (safe generic message + correlation id visibility).
  - [x] Regression evidence attached ensuring mapping changes stay synchronized across FE and MOB lanes.

- Execution reference:
  - Run Epic 1 focused checklist: `_bmad-output/implementation-artifacts/epic-1-qa-reinforcement-checklist.md`.

### Previous Story Intelligence

- From Story 1.5:
  - Security guardrail outputs define the error code set this story must normalize.
- From Stories 1.3 and 1.4:
  - Existing auth route and state behavior should be reused; only message/action harmonization is added.

### Git Intelligence Summary

- Cross-lane changes are highest risk for drift.
- Keep FE and MOB mapping changes synchronized and reviewed together.

### Latest Tech Information

- FE/MOB package versions refreshed from npm metadata.
- No preview dependencies required for standardization work.

### Project Context Reference

- `project-context.md` not found in repository scan.

### Story Completion Status

- Status set to `done`.
- Completion note: FE and MOB auth error semantics were standardized and verified; the story is now closed as done with the rest of Epic 1.

### References

- `_bmad-output/planning-artifacts/epics.md` (Story 1.6)
- `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- https://registry.npmjs.org/react-router-dom
- https://registry.npmjs.org/zustand
- https://registry.npmjs.org/react-native

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story key check passed before implementation: `1-6-fe-mob-auth-error-standardization` matched filename and sprint tracker entry.
- `FE`: `npm test -- tests/unit/lib/auth-errors.test.ts tests/unit/lib/axios.test.ts`
- `MOB`: `npm test -- tests/unit/auth/auth-errors.test.ts tests/unit/network/errors.test.ts`
- `FE`: `npm test`, `npm run lint`, `npm run type-check`
- `MOB`: `npm test`, `npm run lint`, `npm run typecheck`

### Implementation Plan

- Introduce a repo-level auth error contract artifact and keep FE/MOB resolver semantics aligned to it.
- Export structured FE/MOB auth error presentations so parity tests can validate message plus recovery action, not only raw strings.
- Preserve mobile correlation ids through transport normalization and append them only on the unknown fallback path.

### Completion Notes List

- Added `docs/contracts/auth-error-standardization.json` as the canonical FE/MOB auth error semantics table for parity tests.
- Refactored FE and MOB auth error resolvers to return structured semantics (`semantic`, `recoveryAction`, `message`) while preserving existing user-facing copy for known auth cases.
- Standardized unknown-code fallback to a deterministic safe message and appended visible correlation ids for support diagnostics.
- Propagated `traceId` through the mobile network error normalizer so fallback handling can surface the same support reference data as FE.
- Added cross-client contract assertions in FE and MOB unit tests to prevent mapping drift over time.
- Verified FE package test, lint, and type-check flows; verified MOB package test, lint, and typecheck flows.

### Change Log

- 2026-03-09: Standardized FE/MOB auth error semantics, added shared contract coverage, and surfaced correlation ids on unknown auth fallbacks.

### File List

- _bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- docs/contracts/auth-error-standardization.json
- FE/src/lib/auth-errors.ts
- FE/tests/unit/lib/auth-errors.test.ts
- MOB/src/auth/auth-errors.ts
- MOB/src/network/errors.ts
- MOB/src/network/types.ts
- MOB/tests/unit/auth/auth-errors.test.ts
- MOB/tests/unit/network/errors.test.ts

---

## Password Recovery Mapping Addendum (Story 1.7 linkage, 2026-03-05)

### Canonical code additions

| Code | HTTP | FE/MOB semantic |
|---|---|---|
| `AUTH-012` | 401 | Invalid or expired reset token; guide user to request reset again |
| `AUTH-013` | 409 | Already consumed reset token; guide user to request new reset link |
| `AUTH-014` | 429 | Forgot/challenge/reset rate limited; show retry-after guidance |
| `AUTH-015` | 422 | New password equals current password; ask for different password |
| `AUTH-016` | 401 | Session stale after password change; force re-authentication |

### Cross-client UX rules

- Forgot API `202` response always includes:
  - `data.recovery.challengeEndpoint=/api/v1/auth/password/forgot/challenge`
  - `data.recovery.challengeMayBeRequired=true`
- On CSRF `403` for forgot/challenge/reset submit:
  - Re-fetch CSRF once
  - Retry once with identical payload
  - Second `403` => terminal error UX
- Unknown code fallback remains mandatory with visible correlation id.
