# Story 0.4: MOB Mobile Foundation Scaffold

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile engineer,
I want a standardized mobile scaffold and API layer,
so that mobile features follow the same contract and architecture.

## Acceptance Criteria

1. Given a mobile project scaffold, when the project is built and launched, then baseline app runs on target simulator/device.
2. Given env-based API config, when mobile calls backend health endpoint, then request succeeds against host matrix (`Android emulator=http://10.0.2.2:8080`, `iOS simulator=http://localhost:8080`, `physical device=http://<LAN_IP>:8080`) with `GET /actuator/health` HTTP 200 within 5s.
3. Given a common network module, when API errors occur, then mobile receives parsed standardized error payload.
4. Given server-side cookie session policy, when session is issued, then mobile persists no raw credentials/password/OTP in app storage and uses OS-approved secure storage controls for any sensitive client-side secret material.
5. Given cookie-session + CSRF contract for state-changing API calls, when mobile sends non-GET request, then client includes credentials and `X-XSRF-TOKEN` header derived from `XSRF-TOKEN` cookie after explicit CSRF bootstrap/refresh (`GET /api/v1/auth/csrf`) on app start/login/resume.
6. Given foundation CI runs bundle-only checks, when PR is prepared for merge, then AC1 is satisfied only after manual simulator/device smoke evidence (boot log/screenshot + health-call capture) is attached in PR checklist.

## Tasks / Subtasks

- [ ] Establish mobile project baseline scaffold (AC: 1)
  - [ ] Confirm/create mobile app skeleton in MOB lane
  - [ ] Verify simulator/emulator boot on at least one target platform
- [ ] Implement environment-based API configuration (AC: 2)
  - [ ] Support local/dev host overrides for emulator and physical device scenarios
  - [ ] Enforce explicit host matrix mapping (Android emulator `10.0.2.2`, iOS simulator `localhost`, physical device `<LAN_IP>`) with documented selection rule
  - [ ] Add health endpoint connectivity smoke path
  - [ ] Set deterministic network timeout threshold for health check (`<=5s`) and assert HTTP 200 in smoke test
  - [ ] Define cookie/session transport contract in network layer (RN cookie manager behavior, domain/SameSite policy per env)
- [ ] Implement shared network layer with error normalization (AC: 3)
  - [ ] Centralize HTTP client setup and response handling
  - [ ] Parse backend standard error envelope into app-level error model
- [ ] Implement secure session persistence policy (AC: 4)
  - [ ] Fix the auth storage contract: cookie-session is canonical for Epic 0 (no local password/token persistence)
  - [ ] Use platform secure storage wrappers (iOS Keychain, Android Keystore-backed storage) for any sensitive local secret
  - [ ] Block plain AsyncStorage/unencrypted storage for secrets by lint/review rule
  - [ ] Keep storage strategy aligned with backend session/cookie model and PRD NFR-S1/NFR-S2
- [ ] Implement CSRF handling contract for cookie-session mode (AC: 5)
  - [ ] Use a platform cookie manager (`@react-native-cookies/cookies` or equivalent) to read non-HttpOnly `XSRF-TOKEN` cookie and inject `X-XSRF-TOKEN` for POST/PUT/PATCH/DELETE
  - [ ] Ensure CSRF header injection is skipped for safe methods (GET/HEAD/OPTIONS)
  - [ ] Add CSRF bootstrap/refresh sequence: `GET /api/v1/auth/csrf` on app cold start, login success, and foreground resume before first state-changing call
  - [ ] Define missing-token fail-safe: if `XSRF-TOKEN` absent, re-bootstrap once then fail request with deterministic client error
- [ ] Add MOB CI workflow (`ci-mobile.yml`) scoped to the MOB lane
  - [ ] Create `.github/workflows/ci-mobile.yml` triggered on push/PR with path filter `MOB/**`
  - [ ] Workflow steps: dependency install → TypeScript type-check → lint → `react-native build` (or Metro bundle dry-run)
  - [ ] Ensure workflow produces a named status check (`ci-mobile`) compatible with branch protection rules
  - [ ] Run on `ubuntu-latest` using Node.js matrix; skip simulator launch in CI (bundle-only validation is sufficient for foundation)
  - [ ] Add PR checklist gate requiring manual simulator/device smoke evidence for AC1 (`boot + health call`), because CI is bundle-only

## Dev Notes

### Developer Context Section

- Dependency: Story 0.1 foundational backend runtime must be available.
- Mobile lane is currently represented as a dedicated repository/submodule; keep changes isolated to MOB scope.
- Scope is scaffold + network/security baseline only; no feature screens required in this story.

### Technical Requirements

- Mobile app must boot reliably in simulator/emulator with deterministic setup.
- API base URL handling must cover local development realities (host mapping and environment switching).
- Host mapping must follow explicit matrix: Android emulator `10.0.2.2`, iOS simulator `localhost`, physical device `<LAN_IP>`.
- Shared network module is mandatory to avoid per-feature HTTP divergence.
- Session-related sensitive data must use platform-secure persistence primitives.
- Cookie + CSRF runtime contract must be explicit for RN stack:
  - Non-HttpOnly `XSRF-TOKEN` cookie is read via cookie manager; raw value must remain memory-only.
  - CSRF bootstrap endpoint is `/api/v1/auth/csrf`; re-bootstrap required on app launch/login/resume.
  - `JSESSIONID` remains HttpOnly and is never read or persisted by app code.
- Financial-sector baseline policy for this story:
  - Do not persist password/OTP/session identifiers in plain client storage.
  - Use device-bound secure storage primitives (Keychain/Keystore-backed) for sensitive secrets.
  - Keep server-issued session controls as primary (HttpOnly/Secure cookie policy remains server-side authority).
- Sensitive data class contract (must be explicit in implementation docs):
  - `FORBIDDEN_PERSISTENCE`: password, OTP, session cookie raw value, CSRF token raw value.
  - `CONDITIONAL_SECURE_STORAGE_ONLY`: device-bound key material, refresh bootstrap secret (if introduced later).
  - `ALLOWED_NON_SENSITIVE`: API host config, feature flags, UX preference state.

### Architecture Compliance

- Align with cross-system contract principles from architecture/prd:
  - standardized API error schema
  - session/security constraints
  - observable and deterministic behavior in dev environment
- Keep implementation choices compatible with FE/BE contract conventions to reduce cross-client divergence later.

### Library / Framework Requirements

- Latest ecosystem snapshot (2026-02-25):
  - React Native latest stable tag: `0.84.0`
  - React latest stable tag: `19.2.4`
- Guardrail:
  - Follow the mobile framework's supported React pairing for the chosen RN version.
  - Prefer stable secure-storage libraries recommended by the selected mobile stack; avoid beta dependencies in foundation phase.

### File Structure Requirements

- Expected touched areas:
  - `MOB/` project scaffold files
  - `MOB/src/network/**` (or equivalent shared client location)
  - `MOB/src/config/**` (environment/base URL config)
  - `MOB/src/security/**` (secure storage wrapper)
  - `/Users/yeongjae/fixyz/.github/workflows/ci-mobile.yml`
- Keep all mobile baseline logic in reusable modules; avoid duplicating network/auth glue in screen components.

### Testing Requirements

- Minimum checks for story completion:
  - App boots on simulator/emulator without runtime crash.
  - Health API call succeeds with environment-configured host.
  - Host matrix verification evidence exists for at least one emulator and one non-emulator path (simulator or physical device).
  - Standardized backend error payload is parsed into consistent app model.
  - Cookie/session transport contract is test-verified (RN cookie manager + env domain/SameSite mapping).
  - CSRF contract is test-verified for non-GET methods (`XSRF-TOKEN` -> `X-XSRF-TOKEN`).
  - CSRF bootstrap/refresh lifecycle is test-verified:
    - cold start triggers `/api/v1/auth/csrf` before first state-changing call
    - login success triggers token refresh before next non-GET
    - app resume triggers token refresh and rejects stale-token call paths deterministically
    - missing `XSRF-TOKEN` triggers one re-bootstrap attempt then deterministic failure
  - Session persistence contract is documented and test-verified:
    - no password/OTP persisted in AsyncStorage/plain files
    - no raw session-cookie / CSRF-token persistence in app storage
    - secure storage wrapper used for sensitive secret classes
    - restart/relaunch flow preserves only approved state
  - PR includes manual AC1 smoke evidence (`boot log/screenshot + /actuator/health call capture`) because CI does not launch simulator/device.

### Previous Story Intelligence

- From Story 0.3 context:
  - Shared-client pattern is essential; enforce single network abstraction in mobile too.
  - Keep configuration centralized (base URL/env) and avoid per-feature drift.

### Git Intelligence Summary

- Git history shows MOB submodule onboarding and artifact-first planning cadence.
- Actionable implication:
  - Keep mobile foundation changes sharply scoped and documented because MOB lane is newly integrated in repo topology.

### Latest Tech Information

- Mobile stack version checks:
  - React Native `0.84.0`
  - React `19.2.4`
- Implementation strategy:
  - Choose stable RN baseline and preserve compatibility matrix with React.
  - Use secure-storage approach that is production-safe from day one.

### Project Context Reference

- `project-context.md` was not found.
- Mobile foundation decisions are based on Epic 0 story contract + architecture/prd cross-system constraints.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.4)
- `_bmad-output/planning-artifacts/architecture.md` (cross-system contract and security baseline)
- `_bmad-output/planning-artifacts/prd.md` (session/security and platform requirements)
- `https://registry.npmjs.org/react-native` (dist-tags latest)
- `https://registry.npmjs.org/react` (dist-tags latest)
- OWASP MASVS: `https://mas.owasp.org/MASVS/`
- Android Keystore: `https://developer.android.com/privacy-and-security/keystore`
- Apple Keychain Services: `https://developer.apple.com/documentation/security/keychain_services`
- Korea Electronic Financial Supervision Regulation: `https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000207885`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story generated from create-story workflow instructions and Epic 0 artifact synthesis.

### Completion Notes List

- Mobile baseline guidance includes secure storage and contract normalization guardrails.
- Scope tightly constrained to scaffold/infrastructure setup.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-4-mob-mobile-foundation-scaffold.md
