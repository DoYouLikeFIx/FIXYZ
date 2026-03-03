# Story 0.11: Supply Chain Security Baseline

Status: ready-for-dev

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
5. Given audit and traceability needs, when security scan completes, then reports and decision artifacts are retained and indexed under `docs/ops/security-scan/<YYYYMMDD>/`.
6. Given secret-handling constraints, when scan and reporting workflows run, then credentials/tokens are not hardcoded or exposed in logs.
7. Given branch-protection integration needs, when baseline rollout is completed, then all four repositories have required security check bindings verifiably enabled (proof artifacts include settings snapshot/export per repository).
8. Given multi-tool scoring differences, when CVSS threshold is evaluated, then canonical score source is explicit (`GitHub Advisory CVSS v3 base score` first, `NVD score` fallback if advisory score missing).
9. Given GitHub Actions supply-chain risk, when security workflows are defined, then third-party actions are pinned to immutable commit SHAs and unpinned actions fail policy checks.
10. Given advisories without CVSS score in both canonical and fallback sources, when risk is evaluated, then the finding enters mandatory manual triage state and merge remains blocked until reviewer decision is recorded.
11. Given action pinning operational constraints, when an action cannot be pinned immediately, then a time-bounded exception record (owner/reason/expiry) is required and policy reverts to blocking on expiry.
12. Given evidence collection requirements, when workflows complete, then security evidence follows fixed machine-readable artifact contract (`index.json`, `scan-summary-<repo>.json`, `branch-protection-<repo>.json`, `exceptions-<repo>.json`).

## Tasks / Subtasks

- [ ] Define supply-chain security policy and ownership matrix (AC: 1, 3, 4, 8, 9)
  - [ ] Define repository-by-ecosystem matrix (`Gradle`, `GitHub Actions`, `pnpm/npm`)
  - [ ] Define blocking severity policy (`CVSS >= 7.0`) and exception approval flow
  - [ ] Define canonical CVSS source precedence and fallback rules
  - [ ] Define no-score advisory handling (`manual triage required` + default block)
  - [ ] Define third-party action pinning policy (`uses: owner/repo@<commit-sha>`)
  - [ ] Define emergency pinning-exception process with expiry and reapproval contract
  - [ ] Define evidence retention and ownership responsibilities
- [ ] Implement per-repository dependency governance baseline (AC: 1, 2, 6, 9)
  - [ ] Add/align Dependabot configuration in root, BE, FE, MOB repositories
  - [ ] Add scan workflows per repository with standardized result schema output
  - [ ] Add scheduled scan execution and result publication paths (not PR-only)
  - [ ] Add policy check to fail on unpinned third-party actions
  - [ ] Ensure workflows use secrets/vars only and mask sensitive values in logs
- [ ] Enforce merge-gate integration and exception lifecycle (AC: 3, 4, 7, 8, 10, 11)
  - [ ] Bind security checks to required status checks in each repository
  - [ ] Implement exception validation (owner/reason/expiry) as a pre-merge contract
  - [ ] Enforce exception auto-expiry and reapproval requirement
  - [ ] Capture branch-protection binding evidence per repository
- [ ] Add reporting and evidence lifecycle (AC: 2, 5, 7, 10, 11, 12)
  - [ ] Save scan summary and raw outputs with reproducible naming
  - [ ] Save evidence in explicit machine-readable format (`index.json`, `branch-protection-<repo>.json`, `scan-summary-<repo>.json`, `exceptions-<repo>.json`)
  - [ ] Save per-repository required-check binding proof artifacts
  - [ ] Update evidence index and retention metadata (`>=90 days`)
- [ ] Validate failure/pass scenarios and document runbook (AC: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
  - [ ] Reproduce at least one failing vulnerable dependency scenario
  - [ ] Reproduce one fixed/green scenario after remediation
  - [ ] Reproduce one approved temporary exception flow with expiry metadata
  - [ ] Reproduce scheduled workflow execution and result retention evidence
  - [ ] Reproduce unpinned-action policy failure and pinned-action pass case
  - [ ] Reproduce no-score advisory case and verify mandatory manual-triage blocking behavior

## Dev Notes

### Developer Context Section

- This story operationalizes PRD `NFR-S6` as a foundation guardrail instead of deferring all checks to late release-validation stages.
- The repository model is multi-repo (root + submodule repositories), so security baseline must be repository-local and independently enforceable.
- Keep scope focused on dependency supply-chain risk management; SAST/DAST expansion is out of scope for this story.

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
  - auditable artifacts retained under `docs/ops/security-scan/<YYYYMMDD>/`
  - artifact format contract: `index.json`, `scan-summary-<repo>.json`, `branch-protection-<repo>.json`, `exceptions-<repo>.json`
- Workflow supply-chain contract:
  - third-party GitHub Actions must be commit-SHA pinned
  - policy check fails if unpinned `uses:` entries are introduced
  - emergency exception allowed only with owner/reason/expiry record and automatic expiry re-block

### Architecture Compliance

- Preserve repository ownership model introduced in Story 0.6.
- Do not introduce a centralized custom security service in this story.
- Keep all credential usage aligned with secrets/vars policy (no hardcoded values).
- Required-check enforcement must be repository-local and independently auditable for root/BE/FE/MOB.

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/.github/dependabot.yml`
  - `/Users/yeongjae/fixyz/.github/workflows/**` (root)
  - `/Users/yeongjae/fixyz/BE/.github/dependabot.yml`
  - `/Users/yeongjae/fixyz/BE/.github/workflows/**`
  - `/Users/yeongjae/fixyz/FE/.github/dependabot.yml`
  - `/Users/yeongjae/fixyz/FE/.github/workflows/**`
  - `/Users/yeongjae/fixyz/MOB/.github/dependabot.yml`
  - `/Users/yeongjae/fixyz/MOB/.github/workflows/**`
  - `/Users/yeongjae/fixyz/docs/ops/security-scan/**`

### Testing Requirements

- Minimum checks for completion:
  - Each repository emits a security scan result on PR or manual run.
  - Each repository emits a security scan result on scheduled run and stores evidence.
  - At least one induced vulnerable dependency case fails gating checks.
  - Remediation case passes after dependency fix.
  - Exception flow requires owner/reason/expiry, is audit-traceable, and auto-expires into blocking state.
  - Required security check binding evidence exists for all 4 repositories.
  - CVSS source precedence behavior is validated (GitHub Advisory primary, NVD fallback).
  - No-score advisory case is blocked until manual triage decision is recorded.
  - Unpinned third-party action is rejected by policy; SHA-pinned variant passes.
  - Evidence artifacts follow documented machine-readable file format contract.
  - No secret/token leakage in workflow logs and committed files.
  - Evidence index includes all four repositories with retention metadata.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md` (NFR-S6)
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0 Story 0.11)
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-6-multi-repo-collaboration-webhook-rollout.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story drafted from PRD NFR-S6 and multi-repository rollout constraints.

### Completion Notes List

- Created Story 0.11 as ready-for-dev with explicit supply-chain risk gate, exception governance, and evidence retention requirements.

### File List

- _bmad-output/implementation-artifacts/0-11-supply-chain-security-baseline.md
