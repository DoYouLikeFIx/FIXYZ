# Story 0.3: FE Frontend Foundation Scaffold

Status: ready-for-dev

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

- [ ] Scaffold FE app baseline with modern React + TS stack (AC: 1)
  - [ ] Initialize/verify Vite React TypeScript scaffold in FE lane
  - [ ] Ensure local dev boot command is deterministic
  - [ ] Verify HMR and production build both succeed
- [ ] Implement API client baseline with environment-aware config (AC: 2)
  - [ ] Single axios client module with base URL env wiring
  - [ ] Development proxy routing to channel service
  - [ ] Health endpoint smoke check from UI layer
- [ ] Implement alias conventions and path safety (AC: 3)
  - [ ] Configure alias consistently in Vite + tsconfig
  - [ ] Ensure runtime and typechecker resolve same aliases
- [ ] Implement normalized error handling contract (AC: 4)
  - [ ] Add response interceptor for standard backend error schema
  - [ ] Map transport and contract errors to consistent UI-safe messages

## Dev Notes

### Developer Context Section

- Dependency: Story 0.1 baseline infrastructure must exist first.
- Scope boundary:
  - This story covers FE scaffold and web API client baseline only.
  - Keep business-domain UI features out of scope.
- FE is a separate submodule; avoid editing BE/MOB lanes except contract docs if required.

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
  - Reuse established quality-gate mindset; avoid one-off local scripts with no CI counterpart.

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

### Debug Log References

- Story generated from create-story workflow instructions and Epic 0 artifact synthesis.

### Completion Notes List

- FE foundation constraints split from BE CI foundation to prevent overlap.
- Version guidance added with compatibility guardrails.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-3-fe-frontend-foundation-scaffold.md
