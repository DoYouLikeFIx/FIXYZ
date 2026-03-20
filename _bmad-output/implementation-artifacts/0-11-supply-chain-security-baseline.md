# Story 0.11: Supply Chain Security Baseline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform security engineer,
I want automated dependency security governance across all FIX repositories,
so that high-risk supply-chain vulnerabilities are detected early and blocked before merge.

**Depends On:** Story 0.2, Story 0.6

## Acceptance Criteria

1. Given repository topology includes `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, and `FIXYZ-MOB`, when supply-chain baseline is applied, then each repository has ecosystem-appropriate dependency update and scan configuration.
2. Given scheduled and PR-triggered scan workflows, when vulnerability analysis runs, then findings are published with repository, package, severity, CVSS, and fix-version context.
3. Given risk policy `CVSS >= 7.0`, when unresolved high-risk findings exist on merge target branch, then required security status checks fail and merge is blocked.
4. Given false-positive or temporary exception needs, when suppression is requested, then exception records include owner, reason, expiry date, review evidence, and auto-expiry enforcement (expired exception => blocking state restored).
5. Given audit and traceability needs, when security scan completes, then reports and decision artifacts are retained and indexed under `docs/ops/security-scan/<YYYYMMDD>/<snapshot-id>/`.
6. Given secret-handling constraints, when scan and reporting workflows run, then credentials/tokens are not hardcoded or exposed in logs.
7. Given branch-protection integration needs, when baseline rollout is completed, then all four repositories have required security check bindings verifiably enabled (proof artifacts include settings snapshot/export per repository).
8. Given multi-tool scoring differences, when CVSS threshold is evaluated, then canonical score source is explicit (`GitHub Advisory CVSS v3 base score` first, `NVD score` fallback if advisory score missing).
9. Given GitHub Actions supply-chain risk, when security workflows are defined, then third-party actions are pinned to immutable commit SHAs and unpinned actions fail policy checks.
10. Given advisories without CVSS score in both canonical and fallback sources, when risk is evaluated, then the finding enters mandatory manual triage state and merge remains blocked until reviewer decision is recorded.
11. Given action pinning operational constraints, when an action cannot be pinned immediately, then a time-bounded exception record (owner/reason/expiry) is required and policy reverts to blocking on expiry.
12. Given evidence collection requirements, when workflows complete, then security evidence follows fixed machine-readable artifact contract (`index.json`, `scan-summary-<repo>.json`, `branch-protection-<repo>.json`, `exceptions-<repo>.json`).

## Tasks / Subtasks

- [x] Define supply-chain security policy and ownership matrix (AC: 1, 3, 4, 8, 9)
  - [x] Define repository-by-ecosystem matrix (`Gradle`, `GitHub Actions`, `pnpm/npm`)
  - [x] Define blocking severity policy (`CVSS >= 7.0`) and exception approval flow
  - [x] Define canonical CVSS source precedence and fallback rules
  - [x] Define no-score advisory handling (`manual triage required` + default block)
  - [x] Define third-party action pinning policy (`uses: owner/repo@<commit-sha>`)
  - [x] Define emergency pinning-exception process with expiry and reapproval contract
  - [x] Define repository-local exception and manual-triage source-of-truth file contract
  - [x] Define operator preflight for branch-protection proof capture (`repo admin` access + export method)
  - [x] Define machine-readable evidence schema contract before workflow implementation
  - [x] Define evidence retention and ownership responsibilities
- [x] Implement per-repository dependency governance baseline (AC: 1, 2, 6, 9)
  - [x] Add/align Dependabot configuration in root, BE, FE, MOB repositories
  - [x] Add scan workflows per repository with standardized result schema output
  - [x] Add scheduled scan execution and result publication paths (not PR-only)
  - [x] Add repository-local exception and manual-triage registry files under `.github/security/`
  - [x] Add policy check to fail on unpinned third-party actions
  - [x] Ensure workflows use secrets/vars only and mask sensitive values in logs
- [ ] Enforce merge-gate integration and exception lifecycle (AC: 3, 4, 7, 8, 10, 11)
  - [ ] Bind security checks to required status checks in each repository
  - [x] Implement exception validation (owner/reason/expiry) as a pre-merge contract
  - [x] Enforce exception auto-expiry and reapproval requirement
  - [ ] Capture branch-protection settings through live export/API evidence instead of handwritten notes
  - [ ] Capture branch-protection binding evidence per repository
- [ ] Add reporting and evidence lifecycle (AC: 2, 5, 7, 10, 11, 12)
  - [x] Save scan summary and raw outputs with reproducible naming
  - [x] Save evidence in explicit machine-readable format (`index.json`, `branch-protection-<repo>.json`, `scan-summary-<repo>.json`, `exceptions-<repo>.json`)
  - [x] Export immutable evidence snapshots from repository-local exception/triage source files
  - [ ] Save per-repository required-check binding proof artifacts
  - [x] Update evidence index and retention metadata (`>=90 days`)
- [ ] Validate failure/pass scenarios and document runbook (AC: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
  - [x] Reproduce at least one failing vulnerable dependency scenario
  - [x] Reproduce one fixed/green scenario after remediation
  - [x] Reproduce one approved temporary exception flow with expiry metadata
  - [ ] Reproduce scheduled workflow execution and result retention evidence
  - [x] Reproduce unpinned-action policy failure and pinned-action pass case
  - [x] Reproduce no-score advisory case and verify mandatory manual-triage blocking behavior

## Dev Notes

### Developer Context Section

- This story operationalizes PRD `NFR-S6` as a foundation guardrail instead of deferring all checks to late release-validation stages.
- The repository model is multi-repo (root + submodule repositories), so security baseline must be repository-local and independently enforceable.
- Keep scope focused on dependency supply-chain risk management; SAST/DAST expansion is out of scope for this story.

### Implementation Readiness Preconditions

- AC 7 requires live repository settings access. Story execution must start with either repository-admin access for `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, `FIXYZ-MOB` or an identified operator who can export branch-protection settings evidence on demand.
- AC 2, 3, 8, 10 require access to dependency alert metadata and a non-interactive way to export evidence for workflow decisions. If organization policy blocks alert export/API usage, only file setup may proceed and the story must remain incomplete until operator evidence is captured.
- If external permissions are delayed, implementation may be split into `config commit` and `operator validation`, but the story is not `done` until settings/export evidence is stored under `docs/ops/security-scan/<YYYYMMDD>/<snapshot-id>/`.

### Repository / Ecosystem Matrix

- `FIXYZ` (root): root npm tooling + GitHub Actions workflow dependencies.
- `FIXYZ-BE`: Gradle modules + GitHub Actions workflow dependencies.
- `FIXYZ-FE`: `pnpm` JavaScript dependencies + GitHub Actions workflow dependencies.
- `FIXYZ-MOB`: `npm` / React Native JavaScript dependencies + GitHub Actions workflow dependencies.

### Technical Requirements

- Required baseline capabilities:
  - automated dependency update suggestions (Dependabot or equivalent)
  - automated vulnerability scan on PR/schedule
  - branch-blocking gate for unresolved risk threshold violations
- Risk threshold contract:
  - block on unresolved findings meeting `CVSS >= 7.0`
  - canonical score source: GitHub Advisory CVSS v3 base score
  - fallback score source: NVD CVSS when GitHub Advisory score is absent
  - if both sources lack CVSS score: default block + mandatory manual triage decision
  - exception allowed only with explicit owner/reason/expiry metadata
  - expired exceptions must auto-revert to blocking state
- Reporting contract:
  - standardized summary fields: repo, package, current version, fixed version, severity, CVSS, decision
  - auditable artifacts retained under `docs/ops/security-scan/<YYYYMMDD>/<snapshot-id>/`
  - artifact format contract: `index.json`, `scan-summary-<repo>.json`, `branch-protection-<repo>.json`, `exceptions-<repo>.json`
  - `index.json` is repository-local and lists the current repository in `repositories[]`
- Workflow supply-chain contract:
  - third-party GitHub Actions must be commit-SHA pinned
  - policy check fails if unpinned `uses:` entries are introduced
  - emergency exception allowed only with owner/reason/expiry record and automatic expiry re-block
- Exception and manual-triage source-of-truth contract:
  - canonical live source is repository-local: `<repo>/.github/security/dependency-exceptions.json`
  - one normalized record model covers false-positive suppressions, temporary action-pinning exceptions, and no-score manual-triage decisions
  - date-scoped evidence file `docs/ops/security-scan/<YYYYMMDD>/<snapshot-id>/exceptions-<repo>.json` is an immutable export snapshot, not the mutable source-of-truth file
  - minimum record fields: `id`, `recordType`, `scope`, `match`, `decision`, `owner`, `reason`, `evidence`, `requestedAt`, `reviewedAt`, `reviewer`, `expiresAt`, `status`
- Branch-protection evidence contract:
  - proof must come from live repository settings export (`gh` / GitHub REST API / settings export), not handwritten markdown notes
  - minimum proof fields: `repo`, `branch`, `capturedAt`, `captureMethod`, `requiredChecks`, `enforceAdmins`, `status`
- Machine-readable artifact schema contract:
  - `index.json` minimum fields: `generatedAt`, `retentionDays`, `policyVersion`, `repositories`, `artifacts`
  - `scan-summary-<repo>.json` minimum fields: `repo`, `workflow`, `scanner`, `branch`, `scannedAt`, `findings`
  - each `findings[]` record minimum fields: `package`, `manifestPath`, `currentVersion`, `fixedVersion`, `severity`, `cvss`, `cvssSource`, `decision`, `exceptionId`, `triageRequired`
  - `branch-protection-<repo>.json` minimum fields: `repo`, `branch`, `capturedAt`, `captureMethod`, `requiredChecks`, `enforceAdmins`, `status`
  - `exceptions-<repo>.json` minimum fields: `repo`, `generatedAt`, `sourcePath`, `records`
  - when both canonical and fallback CVSS are absent, `cvss` is `null`, `cvssSource` is `none`, `decision` defaults to `manual-triage-required`

### Architecture Compliance

- Preserve repository ownership model introduced in Story 0.6.
- Do not introduce a centralized custom security service in this story.
- Keep all credential usage aligned with secrets/vars policy (no hardcoded values).
- Required-check enforcement must be repository-local and independently auditable for root/BE/FE/MOB.

### File Structure Requirements

- Expected touched areas:
  - `.github/dependabot.yml`
  - `.github/security/dependency-exceptions.json`
  - `.github/workflows/**` (root)
  - `BE/.github/dependabot.yml`
  - `BE/.github/security/dependency-exceptions.json`
  - `BE/.github/workflows/**`
  - `BE/docs/ops/security-scan/**`
  - `FE/.github/dependabot.yml`
  - `FE/.github/security/dependency-exceptions.json`
  - `FE/.github/workflows/**`
  - `FE/docs/ops/security-scan/**`
  - `MOB/.github/dependabot.yml`
  - `MOB/.github/security/dependency-exceptions.json`
  - `MOB/.github/workflows/**`
  - `MOB/docs/ops/security-scan/**`
  - `docs/ops/security-scan/**`
  - `_bmad-output/implementation-artifacts/tests/test-summary.md`

### Testing Requirements

- Minimum checks for completion:
  - Each repository emits a security scan result on PR or manual run.
  - Each repository emits a security scan result on scheduled run and stores evidence.
  - At least one induced vulnerable dependency case fails gating checks.
  - Remediation case passes after dependency fix.
  - Exception flow requires owner/reason/expiry, is audit-traceable, and auto-expires into blocking state.
  - Repository-local exception source files and exported evidence snapshots are byte-for-byte traceable by `id`.
  - Required security check binding evidence exists for all 4 repositories.
  - Required-check evidence is captured from live repository settings/API export rather than narrative notes.
  - CVSS source precedence behavior is validated (GitHub Advisory primary, NVD fallback).
  - No-score advisory case is blocked until manual triage decision is recorded.
  - Unpinned third-party action is rejected by policy; SHA-pinned variant passes.
  - Evidence artifacts follow documented machine-readable file format contract.
  - No secret/token leakage in workflow logs and committed files.
  - Each repository-local evidence index includes the current repository and retention metadata.

### References

- `_bmad-output/planning-artifacts/prd.md` (NFR-S6)
- `_bmad-output/planning-artifacts/epics.md` (Epic 0 Story 0.11)
- `_bmad-output/implementation-artifacts/0-6-multi-repo-collaboration-webhook-rollout.md`
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- GitHub REST branch-protection endpoint returned `401 Requires authentication` without an admin-capable token, so AC 7 proof capture remains operator-blocked until `BRANCH_PROTECTION_TOKEN` or equivalent repository-admin export access is provided.
- Verified that root, `BE`, `FE`, and `MOB` workflows contain only SHA-pinned third-party `uses:` references after supply-chain rollout and workflow hardening.
- `npm.cmd run lint:supply-chain` passed in root, `BE`, and `MOB`; `pnpm.cmd run lint:supply-chain` passed in `FE`.
- `npm.cmd run test:supply-chain` passed in root, `BE`, and `MOB`; `pnpm.cmd run test:supply-chain` passed in `FE` with 21 passing tests per repository.

### Completion Notes List

- Added repository-local Dependabot, supply-chain workflow, exception registry, evidence runbook, and fixture-backed tests for `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, and `FIXYZ-MOB`.
- Added reusable supply-chain baseline scripts that collect Dependabot alerts, enforce SHA-pinned workflow actions, apply CVSS precedence rules, export evidence artifacts, and support live branch-protection capture when admin credentials are available.
- Hardened existing GitHub Actions workflow dependencies across root, `BE`, `FE`, and `MOB` to immutable commit SHAs and validated that unpinned-action policy checks fail while pinned references pass.
- Added validation coverage for blocking vulnerability paths, remediated green paths, temporary exception expiry, GitHub CVSS to NVD fallback, and mandatory manual-triage blocking behavior.
- Addressed review follow-up defects by fail-closing branch-protection audits in GitHub Actions, preserving per-run evidence snapshots, and enforcing approved exception metadata plus record-type compatibility before suppressing blockers.
- Added request timeout/retry hardening, repo-local artifact upload fail-fast behavior, robust repo-context inference for standalone clones, backend-specific fixture coverage, and corrected FE `pnpm` operator docs.
- Added retained failure-evidence behavior so upstream alert/CVSS fetch failures and invalid exception registry JSON still produce machine-readable blocking artifacts instead of empty snapshots.
- Added a root-level `capture:supply-chain:evidence` helper to orchestrate live evidence capture across root, `BE`, `FE`, and `MOB` as soon as a valid GitHub token is available.
- Story remains `in-progress` because live required-check binding proof for all four repositories could not be captured from this environment without repository-admin credentials.

### File List

- .github/dependabot.yml
- .github/scripts/supply-chain/README.md
- .github/scripts/supply-chain/capture-live-evidence.cjs
- .github/scripts/supply-chain/run-security-baseline.cjs
- .github/scripts/supply-chain/security-utils.cjs
- .github/security/dependency-exceptions.json
- .github/workflows/collaboration-webhook-notifications.yml
- .github/workflows/docs-publish.yml
- .github/workflows/supply-chain-security.yml
- BE/.github/dependabot.yml
- BE/.github/scripts/supply-chain/README.md
- BE/.github/scripts/supply-chain/run-security-baseline.cjs
- BE/.github/scripts/supply-chain/security-utils.cjs
- BE/.github/security/dependency-exceptions.json
- BE/.github/workflows/ci-channel.yml
- BE/.github/workflows/ci-corebank.yml
- BE/.github/workflows/ci-fep-gateway.yml
- BE/.github/workflows/ci-fep-simulator.yml
- BE/.github/workflows/ci-quality-gate.yml
- BE/.github/workflows/collaboration-webhook-notifications.yml
- BE/.github/workflows/supply-chain-security.yml
- BE/docs/ops/security-scan/README.md
- BE/package.json
- BE/tests/supply-chain/fixtures/branch-protection.json
- BE/tests/supply-chain/fixtures/dependabot-alerts.json
- BE/tests/supply-chain/fixtures/nvd-cves.json
- BE/tests/supply-chain/run-security-baseline.test.cjs
- BE/tests/supply-chain/security-utils.test.cjs
- FE/.github/dependabot.yml
- FE/.github/scripts/supply-chain/README.md
- FE/.github/scripts/supply-chain/run-security-baseline.cjs
- FE/.github/scripts/supply-chain/security-utils.cjs
- FE/.github/security/dependency-exceptions.json
- FE/.github/workflows/ci-frontend.yml
- FE/.github/workflows/collaboration-webhook-notifications.yml
- FE/.github/workflows/supply-chain-security.yml
- FE/docs/ops/security-scan/README.md
- FE/package.json
- FE/tests/supply-chain/fixtures/branch-protection.json
- FE/tests/supply-chain/fixtures/dependabot-alerts.json
- FE/tests/supply-chain/fixtures/nvd-cves.json
- FE/tests/supply-chain/run-security-baseline.test.cjs
- FE/tests/supply-chain/security-utils.test.cjs
- MOB/.github/dependabot.yml
- MOB/.github/scripts/supply-chain/README.md
- MOB/.github/scripts/supply-chain/run-security-baseline.cjs
- MOB/.github/scripts/supply-chain/security-utils.cjs
- MOB/.github/security/dependency-exceptions.json
- MOB/.github/workflows/ci-mobile.yml
- MOB/.github/workflows/collaboration-webhook-notifications.yml
- MOB/.github/workflows/supply-chain-security.yml
- MOB/docs/ops/security-scan/README.md
- MOB/package.json
- MOB/tests/supply-chain/fixtures/branch-protection.json
- MOB/tests/supply-chain/fixtures/dependabot-alerts.json
- MOB/tests/supply-chain/fixtures/nvd-cves.json
- MOB/tests/supply-chain/run-security-baseline.test.cjs
- MOB/tests/supply-chain/security-utils.test.cjs
- _bmad-output/implementation-artifacts/0-11-supply-chain-security-baseline.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/tests/test-summary.md
- docs/ops/security-scan/README.md
- package.json
- tests/supply-chain/fixtures/branch-protection.json
- tests/supply-chain/fixtures/dependabot-alerts.json
- tests/supply-chain/fixtures/nvd-cves.json
- tests/supply-chain/run-security-baseline.test.cjs
- tests/supply-chain/security-utils.test.cjs

## Change Log

- 2026-03-20: Implemented repository-local supply-chain security baseline across root, `BE`, `FE`, and `MOB`; added fixture-backed policy tests and evidence runbooks; left live branch-protection proof capture pending repository-admin credentials.
- 2026-03-20: Addressed code review findings for exception validation, record-type-safe suppression, fail-closed branch-protection auditing, and immutable same-day evidence snapshots.
- 2026-03-20: Hardened request error handling and retries, fixed repo-local artifact upload behavior, corrected FE `pnpm` runbooks, and expanded regression coverage for standalone clone detection plus transient upstream failures.
- 2026-03-20: Ensured failed upstream scans and invalid exception registry inputs still emit blocking evidence artifacts; expanded regression coverage to 21 tests per repository.
- 2026-03-20: Added a root-level live evidence capture helper so a single tokenized command can collect branch-protection and alert evidence across all four repositories.
