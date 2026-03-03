# Story 0.3: FE Frontend Foundation Scaffold

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend engineer,
I want a standardized web scaffold and API client,
so that product UI features can be implemented consistently.

## Acceptance Criteria

1. Given a Vite + TypeScript scaffold, when local dev server runs, then build and HMR work without runtime error.
2. Given API base URL configuration, when client requests backend health endpoint, then call succeeds via configured proxy/base URL.
3. Given path alias convention, when imports use alias paths, then compile and runtime resolution both succeed.
4. Given shared error interceptor policy, when backend returns standard error schema, then web layer parses and displays normalized message.

## Tasks / Subtasks

- [x] Scaffold FE app baseline with modern React + TS stack (AC: 1)
  - [x] Initialize/verify Vite React TypeScript scaffold in FE lane
  - [x] Ensure local dev boot command is deterministic
  - [x] Verify HMR and production build both succeed
- [x] Implement API client baseline with environment-aware config (AC: 2)
  - [x] Single axios client module with base URL env wiring
  - [x] Development proxy routing to channel service
  - [x] Health endpoint smoke check from UI layer
- [x] Implement alias conventions and path safety (AC: 3)
  - [x] Configure alias consistently in Vite + tsconfig
  - [x] Ensure runtime and typechecker resolve same aliases
- [x] Implement normalized error handling contract (AC: 4)
  - [x] Add response interceptor for standard backend error schema
  - [x] Map transport and contract errors to consistent UI-safe messages
- [x] Add FE-native CI workflow (`ci-frontend.yml`) in the FE repo (AC: 1)
  - [x] Create `FE/.github/workflows/ci-frontend.yml` triggered on FE repo push/PR (do not rely on super-repo path filter `FE/**`)
  - [x] Workflow steps: `pnpm install --frozen-lockfile` → `pnpm run type-check` → `pnpm run lint` → `pnpm run build`
  - [x] Ensure workflow produces a named status check (`ci-frontend`) compatible with FE repo branch protection rules
  - [x] Verify `pnpm build` exits with code 0 and produces `dist/` artifact
  - [x] Keep root-repo CI limited to integration/sync checks; FE quality gate ownership remains in FE repo CI

## Dev Notes

### Developer Context Section

- Dependency: Story 0.1 baseline infrastructure must exist first.
- Scope boundary:
  - This story covers FE scaffold and web API client baseline only.
  - Keep business-domain UI features out of scope.
- FE is a separate submodule; avoid editing BE/MOB lanes except contract docs if required.
- FE CI ownership is lane-local: define and enforce FE required checks in FE submodule workflows.

### Technical Requirements

- Vite dev server must connect to backend via proxy/baseURL strategy.
- Standardized error envelope from backend must be decoded in one shared client interceptor.
- Alias strategy must stay single-source-of-truth between compiler and bundler.
- Keep foundation simple and auditable for demo/portfolio usage.

### Architecture Compliance

- Architecture baseline indicates React + Vite + TypeScript with pnpm and unified axios client approach.
- Preserve compatibility with session/cookie architecture and same-origin/deployed cross-origin modes.
- Respect repo lane ownership: FE files under `FE/` only for implementation.

### Library / Framework Requirements

- Latest ecosystem snapshot (2026-02-25):
  - React: `19.2.4`
  - Vite: `7.3.1`
  - TypeScript: `5.9.3`
  - pnpm: `10.30.2`
- Guardrail:
  - Architecture artifact references Vite 6/React 19 baseline; upgrades should stay within compatibility matrix and not block story delivery.

### File Structure Requirements

- Expected touched areas:
  - `FE/package.json`
  - `FE/vite.config.*`
  - `FE/tsconfig*.json`
  - `FE/src/lib/axios.*`
  - `FE/src/types/**` (if error contract types centralized)
  - `FE/.env.example` or equivalent env docs
  - `FE/.github/workflows/ci-frontend.yml`
- Keep API client as single shared source; do not duplicate per-feature clients in foundation story.

### Testing Requirements

- Minimum checks for story completion:
  - FE build passes (`pnpm build` or equivalent in FE lane).
  - Dev server starts cleanly and supports HMR.
  - Health API call succeeds via configured proxy/base URL.
  - Alias imports resolve at compile and runtime.
  - Error interceptor maps standardized backend errors consistently.

### Previous Story Intelligence

- From Story 0.2 context:
  - CI lane separation is expected; keep FE CI signal independent from backend jobs.
  - Reuse established quality-gate mindset; avoid one-off local scripts with no CI symbolName.

### Git Intelligence Summary

- Recent git history added FE/MOB submodules and documentation artifacts.
- Actionable implication:
  - Keep FE scaffold changes concentrated in FE submodule paths.
  - Prefer minimal, reviewable commits tied to explicit scaffold checkpoints.

### Latest Tech Information

- Version checks performed for frontend foundations:
  - React `19.2.4`, Vite `7.3.1`, TypeScript `5.9.3`, pnpm `10.30.2`.
- Implementation strategy:
  - Use stable latest compatible versions for new scaffold unless architecture pinning requires a narrower band.

### Project Context Reference

- `project-context.md` was not found.
- UX and architecture artifacts provide sufficient FE foundation guidance for this story.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.3)
- `_bmad-output/planning-artifacts/architecture.md` (Frontend stack, proxy, package/tooling guidance)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (routing and client-side UX contract constraints)
- `https://registry.npmjs.org/react` (dist-tags latest)
- `https://registry.npmjs.org/vite` (dist-tags latest)
- `https://registry.npmjs.org/typescript` (dist-tags latest)
- `https://registry.npmjs.org/pnpm` (dist-tags latest)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Implementation Plan

- Replace FE placeholder package with a Vite + React + TypeScript baseline using pnpm scripts for dev/build/test/lint/type-check.
- Implement a single shared axios client with env-aware baseURL, dev proxy compatibility, and response/error interception for the standard `{ success, data, error }` envelope.
- Validate API wiring by adding a simple health-check UI path that uses the shared client.
- Enforce alias parity (`@/*`) in both bundler and TypeScript configs.
- Add FE-native GitHub Actions workflow with the required `ci-frontend` quality gate sequence.
- Add unit and integration tests to validate error normalization and health-check UI behavior.

### Debug Log References

- `pnpm install`
- `pnpm run type-check`
- `pnpm run lint`
- `pnpm run test`
- `pnpm run build`
- `pnpm dev --host 127.0.0.1 --port 5173` (startup smoke check)
- `pnpm run test` (QA augmentation run: 3 files, 11 tests passed)
- `pnpm run type-check && pnpm run lint` (post-QA verification)

### Completion Notes List

- Replaced FE placeholder package with Vite 7 + React 19 + TypeScript scaffold and deterministic pnpm scripts.
- Implemented shared axios client (`src/lib/axios.ts`) with baseURL env wiring, credentials support, and response/error interceptors.
- Added Vite proxy routing for `/api` and `/actuator` with optional `VITE_DEV_PROXY_TARGET`.
- Implemented health-check smoke path from UI (`App.tsx` + `fetchHealth`) using shared client.
- Added alias single source of truth in Vite and TypeScript (`@/*`).
- Added unit and integration tests for interceptor normalization and health-check UX flow.
- Added FE-native CI workflow `ci-frontend.yml` with required status check name `ci-frontend` and dist artifact verification.
- QA pass added focused API/service test coverage for health endpoint contract (`health.test.ts`).
- QA pass expanded user-flow test coverage for loading state and retry failure transitions in `App.test.tsx`.
- QA automation summary generated at `_bmad-output/implementation-artifacts/tests/test-summary.md`.

### File List

- FE/.env.example
- FE/.github/workflows/ci-frontend.yml
- FE/.gitignore
- FE/README.md
- FE/eslint.config.js
- FE/index.html
- FE/package-lock.json (deleted)
- FE/package.json
- FE/pnpm-lock.yaml
- FE/src/App.test.tsx
- FE/src/App.tsx
- FE/src/index.css
- FE/src/lib/axios.test.ts
- FE/src/lib/axios.ts
- FE/src/lib/errors.ts
- FE/src/lib/health.ts
- FE/src/lib/health.test.ts
- FE/src/main.tsx
- FE/src/test/setup.ts
- FE/src/types/api.ts
- FE/src/types/health.ts
- FE/src/vite-env.d.ts
- FE/tsconfig.app.json
- FE/tsconfig.json
- FE/tsconfig.node.json
- FE/vite.config.ts
- _bmad-output/implementation-artifacts/tests/test-summary.md

### Change Log

- 2026-03-02: Implemented FE foundation scaffold, shared API client/interceptor, alias/proxy configuration, validation tests, and FE-native CI workflow.
- 2026-03-02: QA automation pass added health service API tests, expanded UI health-check flow tests, and published test summary artifact.
