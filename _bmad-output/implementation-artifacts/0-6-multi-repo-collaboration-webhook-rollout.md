# Story 0.6: Multi-Repo Collaboration Webhook Rollout

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a delivery platform engineer,
I want collaboration webhook notifications rolled out across all FIX repositories,
so that release and quality signals are visible from root, backend, frontend, and mobile repositories without coverage gaps.

**Depends On:** Story 0.5

## Acceptance Criteria

1. Given the repository topology includes `FIXYZ` (root) and submodule repositories (`FIXYZ-BE`, `FIXYZ-FE`, `FIXYZ-MOB`), when webhook rollout is completed, then each repository has a GitHub->MatterMost notification workflow scoped to its own events.
2. Given per-repository secret management, when workflows are configured, then `MATTERMOST_WEBHOOK_URL` is set in each repository and no webhook URL/token is hardcoded in workflow/scripts/docs.
3. Given optional channel segmentation, when runtime variables are applied, then each repository can override `MATTERMOST_CHANNEL_KEY` independently without code changes.
4. Given existing reliability contracts from Story 0.5, when workflows run in each repository, then dedupe (`10m`), retry (`max_attempts=3`), and failure observability semantics are preserved.
5. Given rollout validation execution, when PR and workflow completion events are replayed per repository, then evidence artifacts are collected for each repository and indexed under `docs/ops/webhook-validation/<YYYYMMDD>/`.
6. Given operational rollback needs, when repository-specific incidents occur, then notification workflow can be disabled per repository without impacting the others.

## Tasks / Subtasks

- [x] Define multi-repo rollout scope and ownership matrix (AC: 1, 6)
  - [x] Enumerate target repositories: `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, `FIXYZ-MOB`
  - [x] Define repository owners and rollout order
  - [x] Document per-repository rollback switch (`workflow disable` or guarded early-exit)
- [x] Apply GitHub->MatterMost workflow in each repository (AC: 1, 4)
  - [x] Root repository workflow remains active and aligned
  - [x] Create repository-local branch/PR in `FIXYZ-BE` and merge webhook workflow changes
  - [x] Create repository-local branch/PR in `FIXYZ-FE` and merge webhook workflow changes
  - [x] Create repository-local branch/PR in `FIXYZ-MOB` and merge webhook workflow changes
  - [x] Preserve source-specific payload normalization and retry/dedupe behavior from Story 0.5
- [x] Configure secure per-repository runtime settings (AC: 2, 3)
  - [x] Set `MATTERMOST_WEBHOOK_URL` secret in all 4 repositories
  - [x] Set `MATTERMOST_CHANNEL_KEY` variable per repository if channel split is required
  - [x] Verify no secret/token leakage in logs and committed files
- [x] Execute per-repository validation and evidence collection (AC: 4, 5)
  - [x] Run PR event smoke validation in each repository
  - [x] Run `workflow_run` completion smoke validation in each repository
  - [x] Run duplicate suppression replay in each repository
  - [x] Run timeout/non-2xx failure simulation and verify bounded retries
  - [x] Save per-repository artifacts with reproducible naming and update evidence index
- [x] Prepare rollout and rollback runbook updates (AC: 5, 6)
  - [x] Update docs with enable/disable procedure per repository
  - [x] Add repository-scoped troubleshooting matrix

## Dev Notes

### Developer Context Section

- Story 0.6 is an expansion rollout story and depends on Story 0.5 reliability/security contracts.
- Root and `BE/FE/MOB` are separate repositories in submodule topology; rollout is repository-scoped, not path-filter scoped in the super-repo.
- Keep direct integration architecture and do not introduce a relay service in this story.
- Scope boundary: this story rolls out **GitHub** notification workflows across repositories; Jira automation changes are out of scope.

### Technical Requirements

- Required trigger coverage:
  - `pull_request` lifecycle events
  - selected `workflow_run` completion events per repository
- Required contracts:
  - dedupe suppression window: `10m`
  - retry policy: `max_attempts=3`, GitHub backoff `2s`,`5s` with jitter `+-20%`
  - structured failure logs with no secret leakage
- Required configuration:
  - `MATTERMOST_WEBHOOK_URL` secret per repository
  - optional `MATTERMOST_CHANNEL_KEY` variable per repository

### Architecture Compliance

- Respect lane/repository ownership:
  - BE quality gates and workflow ownership live in BE repository
  - FE quality gates and workflow ownership live in FE repository
  - MOB quality gates and workflow ownership live in MOB repository
- Avoid coupling notification rollout with domain feature implementation.

### File Structure Requirements

- Expected touched areas:
  - `/Users/yeongjae/fixyz/.github/workflows/**` (root repo)
  - `/Users/yeongjae/fixyz/BE/.github/workflows/**` (BE repo mirror for local tracking)
  - `/Users/yeongjae/fixyz/FE/.github/workflows/**` (FE repo mirror for local tracking)
  - `/Users/yeongjae/fixyz/MOB/.github/workflows/**` (MOB repo mirror for local tracking)
  - `/Users/yeongjae/fixyz/docs/ops/webhook-validation/**`
  - `/Users/yeongjae/fixyz/docs/ops/collaboration-webhook-notifications.md`

### Testing Requirements

- Minimum checks for story completion:
  - Per repository, one PR lifecycle event posts expected normalized payload to MatterMost.
  - Per repository, one `workflow_run` completion event posts expected normalized payload to MatterMost.
  - Per repository, duplicate replay within `10m` is suppressed.
  - Per repository, timeout/non-2xx path demonstrates bounded retry and failure observability.
  - Evidence index contains repository-scoped artifacts and retention metadata (`>=90 days` for GitHub artifacts).
  - Secret scanning/check confirms no webhook secret leakage in logs or committed docs.
  - Completion matrix is fully green for all 4 repositories (`FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, `FIXYZ-MOB`) across PR, workflow_run, duplicate, and failure scenarios.

### Previous Story Intelligence

- Story 0.5 established payload normalization, dedupe key contract, retry contract, and runbook/evidence structure.
- Story 0.6 should reuse those contracts and extend them from root-only execution to all repositories.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.5 baseline and Story 0.6 introduction)
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-5-collaboration-webhook-notifications.md`
- `/Users/yeongjae/fixyz/docs/ops/collaboration-webhook-notifications.md`
- `/Users/yeongjae/fixyz/docs/ops/webhook-validation/README.md`
- `/Users/yeongjae/fixyz/.gitmodules`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story drafted from Epic 0 scope extension and current repository topology (`.gitmodules`) validation.
- `npm run lint:collab-webhook && npm run test:collab-webhook` (root, BE, MOB)
- `pnpm run lint:collab-webhook && pnpm run test:collab-webhook` (FE)
- `rg -n "https://.*hooks/|MATTERMOST_WEBHOOK_URL\\s*[:=]\\s*['\\\"]?https?://"` secret leakage scan across root + submodules
- Local replay artifact generation for FIXYZ/FIXYZ-BE/FIXYZ-FE/FIXYZ-MOB (`pull_request`, `workflow_run`, duplicate, timeout/non-2xx)

### Completion Notes List

- Added `collaboration-webhook-notifications.yml` workflow to `BE`, `FE`, and `MOB` repositories with repository-scoped `workflow_run` coverage and root-aligned dedupe/retry/security contract.
- Rolled out shared collab webhook scripts into `BE/FE/MOB` under `.github/scripts/collab-webhook` and added per-module lint/test entry points.
- Added webhook contract tests to `BE/tests`, `FE/tests`, and `MOB/test` and validated all pass in each module.
- Expanded operations runbook with multi-repo ownership matrix, rollout order, repository-scoped rollback switches, and troubleshooting matrix.
- Generated repository-scoped validation artifacts and updated evidence index under `docs/ops/webhook-validation/20260303`.
- Completed review cycle and confirmed webhook delivery from BE/FE/MOB repositories in runtime validation.
- Marked story complete after rollout, secure configuration, and cross-repository action validation checks.

### File List

- _bmad-output/implementation-artifacts/0-6-multi-repo-collaboration-webhook-rollout.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- docs/ops/collaboration-webhook-notifications.md
- docs/ops/webhook-validation/README.md
- docs/ops/webhook-validation/20260303/index.json
- docs/ops/webhook-validation/20260303/index.md
- docs/ops/webhook-validation/20260303/github-duplicate-fixyz.log
- docs/ops/webhook-validation/20260303/github-duplicate-fixyz-be.log
- docs/ops/webhook-validation/20260303/github-duplicate-fixyz-fe.log
- docs/ops/webhook-validation/20260303/github-duplicate-fixyz-mob.log
- docs/ops/webhook-validation/20260303/github-failure-fixyz.log
- docs/ops/webhook-validation/20260303/github-failure-fixyz-be.log
- docs/ops/webhook-validation/20260303/github-failure-fixyz-fe.log
- docs/ops/webhook-validation/20260303/github-failure-fixyz-mob.log
- docs/ops/webhook-validation/20260303/payload-github-pr-opened-fixyz.json
- docs/ops/webhook-validation/20260303/payload-github-pr-opened-fixyz-be.json
- docs/ops/webhook-validation/20260303/payload-github-pr-opened-fixyz-fe.json
- docs/ops/webhook-validation/20260303/payload-github-pr-opened-fixyz-mob.json
- docs/ops/webhook-validation/20260303/payload-github-workflow-run-completed-fixyz.json
- docs/ops/webhook-validation/20260303/payload-github-workflow-run-completed-fixyz-be.json
- docs/ops/webhook-validation/20260303/payload-github-workflow-run-completed-fixyz-fe.json
- docs/ops/webhook-validation/20260303/payload-github-workflow-run-completed-fixyz-mob.json
- BE/.github/workflows/collaboration-webhook-notifications.yml
- BE/.github/scripts/collab-webhook/README.md
- BE/.github/scripts/collab-webhook/build-github-payload.js
- BE/.github/scripts/collab-webhook/build-jira-payload.js
- BE/.github/scripts/collab-webhook/notification-utils.js
- BE/.github/scripts/collab-webhook/post-to-mattermost.js
- BE/.github/scripts/collab-webhook/retry-utils.js
- BE/package.json
- BE/tests/collab-webhook/notification-utils.test.js
- BE/tests/collab-webhook/retry-utils.test.js
- FE/.github/workflows/collaboration-webhook-notifications.yml
- FE/.github/scripts/collab-webhook/README.md
- FE/.github/scripts/collab-webhook/build-github-payload.js
- FE/.github/scripts/collab-webhook/build-jira-payload.js
- FE/.github/scripts/collab-webhook/notification-utils.js
- FE/.github/scripts/collab-webhook/package.json
- FE/.github/scripts/collab-webhook/post-to-mattermost.js
- FE/.github/scripts/collab-webhook/retry-utils.js
- FE/package.json
- FE/tests/collab-webhook/notification-utils.test.js
- FE/tests/collab-webhook/package.json
- FE/tests/collab-webhook/retry-utils.test.js
- MOB/.github/workflows/collaboration-webhook-notifications.yml
- MOB/.github/scripts/collab-webhook/README.md
- MOB/.github/scripts/collab-webhook/build-github-payload.js
- MOB/.github/scripts/collab-webhook/build-jira-payload.js
- MOB/.github/scripts/collab-webhook/notification-utils.js
- MOB/.github/scripts/collab-webhook/package.json
- MOB/.github/scripts/collab-webhook/post-to-mattermost.js
- MOB/.github/scripts/collab-webhook/retry-utils.js
- MOB/package.json
- MOB/tests/collab-webhook/notification-utils.test.js
- MOB/tests/collab-webhook/package.json
- MOB/tests/collab-webhook/retry-utils.test.js

### Change Log

- 2026-03-03: Started Story 0.6 execution and rolled out GitHub->MatterMost webhook workflow/scripts/tests to BE/FE/MOB in parallel, plus multi-repo validation evidence and runbook updates.
- 2026-03-03: Review completed and Story 0.6 finalized as done.
