# Story 12.2: Edge Perimeter Policy Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a security engineer,
I want a documented DMZ perimeter contract,
so that future implementation has an explicit allowlist, deny behavior, abuse policy, and trusted-proxy governance target.

**Depends On:** Story 0.7, Story 7.7, Story 12.1

## Acceptance Criteria

1. Given public route exposure requirements, when `docs/ops/dmz-route-policy.md` is reviewed, then the allowed route/method matrix is complete and explicit.
2. Given perimeter deny behavior, when the policy is reviewed, then unknown paths, disallowed methods, internal namespaces, and temporary deny responses all have deterministic contracts.
3. Given abuse control requirements, when the design is reviewed, then thresholds, temporary deny behavior, and evidence expectations are documented.
4. Given trusted client identity requirements, when the design is reviewed, then trusted-proxy governance and future configuration ownership are documented.

## Tasks / Subtasks

- [x] Finalize public route and method matrix (AC: 1)
  - [x] Inventory current Story 0.7 scaffold-only public paths separately from the canonical target matrix
- [x] Finalize canonical URI normalization and route matching rules (AC: 1, 2)
- [x] Finalize deny and response contracts (AC: 2)
- [x] Finalize abuse response and evidence contract (AC: 3)
- [x] Finalize trusted-proxy governance contract (AC: 4)
  - [x] Define multi-proxy hop selection and IP normalization rules
  - [x] Define temporary deny operator interface contract and idempotency rule
  - [x] Define public-edge exclusion for privileged operator surfaces

## Dev Notes

### Developer Context Section

- This is a documentation-only story. Implementing Story 12.2 means updating the root DMZ design package and root regression coverage only; do not reintroduce runtime enforcement in this story.
- Story 0.7 remains the active ingress/runtime baseline until a separate reviewed Epic 12 runtime change is approved.

### Technical Requirements

- Route matching must define normalization, encoded-path handling, and trailing-slash behavior explicitly.
- Route matching must define single-pass decoding, malformed-encoding rejection, and encoded internal-path handling explicitly.
- Public route policy must preserve canonical product API paths unless an ADR-approved rewrite contract is documented.
- Current Story 0.7 scaffold-only public routes must be inventoried separately from the canonical target contract.
- Current Story 0.7 `edge-gateway` alias surface (`/api/v1/channel/*`) must be documented separately from the direct controller scaffold and must default to deny/remove in hardened mode unless an ADR-backed migration exception is approved.
- The missing canonical-route coverage inventory must be route-by-route and must not collapse absent endpoints into a single prose sentence.
- Public route policy must encode auth/session and CSRF posture per route instead of method-only allowlists.
- Public deny contracts must remain deterministic:
  - unknown path: `404 EDGE_ROUTE_NOT_ALLOWED`
  - disallowed method: `404 EDGE_METHOD_NOT_ALLOWED`
  - internal namespace: `403 EDGE_INTERNAL_NAMESPACE_DENIED`
  - rate limited: `429`
  - temporary deny: `403 EDGE_DMZ_TEMP_DENY`
- Trusted client identity extraction must define multi-proxy chain parsing and canonical IP normalization.
- Temporary deny management must define authentication, authorization, idempotency, `Retry-After`, and minimum response fields.
- Perimeter rate limits must define how they coexist with stricter application/session/user-level limits.
- Edge-generated denies and rate limits must emit evidence fields proving which layer enforced the rejection.
- Privileged operator surfaces must stay outside the public edge allowlist.
- Story 12.2 implementation must stay in the repository root (`docs/**`, `tests/**`, `_bmad-output/**`); `BE`, `FE`, and `MOB` are reference-only inputs for this story.

### Architecture Compliance

- Preserve Story 0.7 edge baseline while documenting hardened perimeter rules.
- Keep error, request-id, and audit contracts aligned with existing edge/error-envelope standards.
- Do not modify the active Story 0.7 edge template or introduce new Epic 12 ingress runtime assets as part of this story.

### File Structure Requirements

- Changed during this implementation round:
  - `docs/ops/dmz-route-policy.md`
  - `tests/edge-gateway/dmz-network-segmentation.test.js`
  - `tests/edge-gateway/dmz-perimeter-policy.test.js`
  - `_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md`
  - `_bmad-output/implementation-artifacts/sprint-status.yaml`
  - `_bmad-output/implementation-artifacts/tests/story-12-2-edge-perimeter-policy-hardening-summary.md`
- Validated unchanged design inputs for this story:
  - `docs/ops/dmz-trusted-proxies.md`
  - `docs/ops/dmz-abuse-response.md`
  - `docs/ops/dmz-admin-access.md`
  - `docs/ops/dmz-drill-governance.md`
- Reference-only runtime baseline inputs for this story:
  - `docker/nginx/templates/fixyz-edge.conf.template`
- Explicitly out of scope for Story 12.2:
  - `docker/nginx/templates/fixyz-edge.conf.template`
  - any newly introduced Epic 12 runtime asset in the repository root
  - `BE/**`
  - `FE/**`
  - `MOB/**`

### Testing Requirements

- Add root regression coverage in `tests/edge-gateway/dmz-perimeter-policy.test.js`.
- Verify canonical route matching, deterministic deny codes, and legacy `/api/v1/channel/*` baseline-vs-target handling remain explicit in the docs.
- Verify abuse thresholds, temporary deny evidence expectations, and deterministic `HEAD`/`OPTIONS` handling remain explicit in the docs.
- Verify trusted proxy extraction rules, temporary deny operator contract, and idempotency rules remain explicit in the docs.
- Verify Story 12.2 documentation stays aligned with `docs/ops/dmz-admin-access.md` and `docs/ops/dmz-drill-governance.md`.
- Verify the active Story 0.7 edge template is treated as a reference-only baseline and not modified by this story.

### Story Completion Status

- Status set to `done`.
- Completion note: Story 12.2 implementation closes as a documentation-only, root-project-only DMZ perimeter design package with regression coverage and approved review fixes.

### References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/ops/dmz-route-policy.md`
- `docs/ops/dmz-abuse-response.md`
- `docs/ops/dmz-trusted-proxies.md`
- `docs/ops/dmz-admin-access.md`
- `docs/ops/dmz-drill-governance.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `git status --short`
- `node --check tests/edge-gateway/dmz-perimeter-policy.test.js`
- `node --test tests/edge-gateway/dmz-perimeter-policy.test.js`
- `node --check tests/edge-gateway/dmz-network-segmentation.test.js`
- `npm run test:edge-gateway`

### Completion Notes List

- Story documentation created after removing repository-local Epic 12 runtime assets.
- Story 12.2 scope clarified as documentation-only and root-project-only.
- Root regression coverage added for the DMZ perimeter design package.
- Verified `docs/ops/dmz-route-policy.md`, `docs/ops/dmz-trusted-proxies.md`, `docs/ops/dmz-abuse-response.md`, `docs/ops/dmz-admin-access.md`, and `docs/ops/dmz-drill-governance.md` satisfy Story 12.2 acceptance criteria without reintroducing runtime enforcement.
- Added root regression assertions that lock Story 12.2 to the current Story 0.7 edge baseline and prevent cross-repo scope expansion into `BE`, `FE`, or `MOB`.
- Realigned the existing DMZ network segmentation regression to the current documentation wording so the root `edge-gateway` suite remains authoritative for Epic 12 documentation-only stories.
- Validated Story 12.2 with syntax checks, targeted regression execution, and the full root `edge-gateway` test suite.
- Senior review fixes applied: removed workspace-specific path assumptions from the Story 12.2 regression, expanded AC1 matrix coverage to all canonical public rows, clarified changed-versus-validated inputs, documented deterministic `HEAD`/`OPTIONS` handling, and moved QA reporting into a story-specific summary artifact.

### Review-Time Worktree Snapshot

- Snapshot captured on `2026-03-24` from `git status --short` after excluding Story 12.2-owned paths from the unrelated-change comparison set.
- Historical audit note only: this snapshot records the review-time repository state and is not a claim about future clean or dirty worktree states.

```text
 M BE
 M FE
 M MOB
 M _bmad-output/implementation-artifacts/9-5-integrated-final-state-and-retry-ux.md
 M _bmad-output/implementation-artifacts/9-6-integrated-final-state-and-retry-ux.md
 M docs/contracts/external-order-error-ux.json
?? _bmad-output/implementation-artifacts/11-5-be-fe-be-mob-compact-flows.md
?? _bmad-output/implementation-artifacts/11-5-fe-mob-actual-runtime-flows.md
?? _bmad-output/implementation-artifacts/11-5-market-ticker-e2e-and-videos.md
?? _bmad-output/implementation-artifacts/media/
```

### File List

Changed during this implementation round:

- `docs/ops/dmz-route-policy.md`
- `tests/edge-gateway/dmz-network-segmentation.test.js`
- `tests/edge-gateway/dmz-perimeter-policy.test.js`
- `_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/tests/story-12-2-edge-perimeter-policy-hardening-summary.md`

Validated unchanged inputs:

- `docs/ops/dmz-trusted-proxies.md`
- `docs/ops/dmz-abuse-response.md`
- `docs/ops/dmz-admin-access.md`
- `docs/ops/dmz-drill-governance.md`

Reference-only runtime baseline input:

- `docker/nginx/templates/fixyz-edge.conf.template`

### Change Log

- 2026-03-24: Clarified Story 12.2 as documentation-only/root-only scope, added DMZ perimeter regression coverage, synchronized root DMZ regression wording with the current design docs, and moved the story to review.
- 2026-03-24: Senior code review fixes applied for Story 12.2 portability, matrix completeness coverage, and DMZ document traceability; story moved to done.
- 2026-03-24: Follow-up review fixes converted Story 12.2 path references to repo-relative form, moved validated DMZ docs into the File List contract, and hardened canonical-route negative checks against exact-match Nginx locations.
- 2026-03-24: QA follow-up added explicit review-time dirty worktree disclosure and a regression that protects Story 12.2 auditability against unrelated repository changes.
- 2026-03-24: Adversarial review follow-up replaced static disclosure checks with live dirty-worktree comparison, tightened abuse-threshold and method-contract coverage, reconciled scope/file-list traceability, and split Story 12.2 QA output into a dedicated summary artifact.

## Senior Developer Review (AI)

### Reviewer

- Reviewer: Codex
- Date: 2026-03-24
- Outcome: Approved after fixes

### Summary

- Combined review history resolved 2 High, 6 Medium, and 3 Low findings across senior review, QA follow-up, and adversarial follow-up. No open Story 12.2 findings remain after the final hardening pass.

### Findings Resolved

- [HIGH] Replaced workspace-specific absolute path assertions in `tests/edge-gateway/dmz-perimeter-policy.test.js` with repo-root-derived paths so the regression is portable across checkouts and CI agents.
- [MEDIUM] Expanded Story 12.2 route-policy regression coverage to assert every canonical public route row, including its method/auth/CSRF posture, instead of relying on a few spot checks.
- [MEDIUM] Clarified Dev Agent Record traceability by separating changed files from validated-but-unchanged DMZ design inputs (`docs/ops/dmz-route-policy.md`, `docs/ops/dmz-trusted-proxies.md`, `docs/ops/dmz-abuse-response.md`).
- [HIGH] Replaced static worktree-disclosure string checks with a live `git status --short` comparison against the current unrelated dirty-path set when such paths exist, while preserving a historical review-time snapshot in the story record.
- [MEDIUM] Reconciled implementation-scope declarations, File List contents, and actual changed files (`docs/ops/dmz-route-policy.md`, `tests/edge-gateway/dmz-network-segmentation.test.js`, `tests/edge-gateway/dmz-perimeter-policy.test.js`, `_bmad-output/implementation-artifacts/sprint-status.yaml`).
- [MEDIUM] Added `docs/ops/dmz-admin-access.md` and `docs/ops/dmz-drill-governance.md` to Story 12.2 traceability because the regression and testing requirements depend on them.
- [MEDIUM] Replaced broad disclosure globs with an exact review-time dirty-worktree snapshot that preserves modified versus untracked markers.
- [MEDIUM] Documented deterministic `HEAD` and `OPTIONS` handling for allowlisted public routes and extended regression coverage over abuse thresholds and method contracts.
- [LOW] Removed unrelated script-lint evidence from the Story 12.2 verification record.
- [LOW] Moved Story 12.2 QA reporting into `_bmad-output/implementation-artifacts/tests/story-12-2-edge-perimeter-policy-hardening-summary.md` so it is no longer mixed into a shared summary for other stories.
- [LOW] Reworked Story 12.2 regressions toward section-aware, table-aware, and live-state-aware assertions to reduce brittleness from exact markdown phrasing.
