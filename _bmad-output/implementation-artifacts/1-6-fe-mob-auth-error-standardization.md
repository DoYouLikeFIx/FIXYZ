# Story 1.6: FE/MOB Auth Error Standardization

Status: ready-for-dev

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

- [ ] Define shared auth error mapping contract for FE + MOB (AC: 1)
  - [ ] Create canonical code-to-message semantics table
  - [ ] Keep language/action consistency across clients
- [ ] Implement lockout/expired/rate-limit UX parity (AC: 2)
  - [ ] Ensure recoverable next steps are shown consistently
  - [ ] Align redirect/retry guidance between clients
- [ ] Implement unknown-code fallback with traceability (AC: 3)
  - [ ] Provide safe generic message
  - [ ] Surface correlation id for support diagnostics
- [ ] Add cross-client contract tests or snapshot assertions for parity

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.6`).
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-1-user-authentication-and-account-access.md` has a different numbering/scope (`1.1`~`1.9`); use it only for technical constraints, not story ID mapping.

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
- Party review resolution status (2026-02-25):
  - [ ] FE/MOB canonical mapping table evidence attached (`same code -> same semantics`) with diff-free review.
  - [ ] Lockout/expired/rate-limit recoverable next-action parity evidence attached for both clients.
  - [ ] Unknown-code fallback evidence attached (safe generic message + correlation id visibility).
  - [ ] Regression evidence attached ensuring mapping changes stay synchronized across FE and MOB lanes.

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

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

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

- Generated via create-story workflow instructions with Epic 1 artifact synthesis.

### Completion Notes List

- Added cross-client parity guardrails and fallback/correlation-id requirements.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md
