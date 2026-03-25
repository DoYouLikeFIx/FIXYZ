# Story 10.6: [MOB] Mobile Release Readiness Pack

Status: review
<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile release owner,
I want MOB E2E and release evidence packaged,
So that mobile deployment quality is auditable.

## Acceptance Criteria

1. Given MOB E2E suite and the target release matrix (`ios-simulator/direct-maestro`, `live-backend-contract`, and `physical-device/edge-smoke`) When release pipeline runs Then critical auth/order/dashboard flows pass on the automated lanes and the approved-build checklist links physical-device evidence for the manual edge-smoke lane.
2. Given auth/order/notification regressions When detected in `MOB/e2e/maestro/auth`, `MOB/e2e/maestro/order`, `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`, `MOB/tests/e2e/mobile-order-live.e2e.test.ts`, `MOB/tests/e2e/mobile-dashboard-live.e2e.test.ts`, `MOB/tests/unit/api/notification-api.test.ts`, or `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx` Then release gate fails.
3. Given release checklist template When preparing distribution Then `MOB/docs/release/mobile-test-matrix.md` and the versioned candidate checklist under `MOB/docs/release/candidates/v<package-version>/mobile-readiness-checklist.md` are completed with artifact links, including upstream references to Story 10.1 CI evidence and Story 10.4 smoke/rehearsal evidence.
4. Given final build candidate When approved Then versioned `MOB/docs/release/candidates/v<package-version>/mobile-release-notes.md` and `MOB/docs/release/candidates/v<package-version>/mobile-handoff-package.md` are finalized with build identifier, distribution target, rollback/contact owner, matrix-result summary, and linked evidence.

## Scenario Catalog (Plain Language)

- `E10-MOB-001`: iOS 시뮬레이터 직접 개발 경로에서 로그인→주문→결과 확인 흐름이 Maestro 기준으로 정상인지 확인합니다.
- `E10-MOB-002`: 라이브 백엔드 계약 회귀에서 인증·주문·대시보드 흐름이 canonical runtime selector 기준으로 정상인지 확인합니다.
- `E10-MOB-003`: 알림 스트림 연결/재연결/mark-read 회귀가 실패하면 배포가 차단되는지 확인합니다.
- `E10-MOB-004`: 승인 후보 빌드에서 physical-device + edge smoke 증빙이 체크리스트에 연결되는지 확인합니다.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 10.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 9.6, Story 10.1, Story 10.4.
- Parallelization note: implementation may start once Story 9.6 is complete by targeting the stable scenario IDs, CI artifact contract, and smoke-evidence locations owned by Stories 10.1 and 10.4; final release signoff still requires those upstream stories to be completed.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- This story owns the mobile release package contract, including test-matrix definition, checklist evidence locations, release notes, and the distribution handoff summary.
- For this story, the concrete documentation and evidence outputs are:
  - `MOB/README.md` as the local runner and runtime-mode reference for release validation commands
  - `MOB/docs/release/mobile-readiness-checklist.md` as the guide entry point for the candidate-specific checklist and evidence-link source of truth
  - `MOB/docs/release/mobile-test-matrix.md` as the target test matrix and per-lane pass/fail summary
  - `MOB/docs/release/mobile-release-notes.md` and `MOB/docs/release/mobile-handoff-package.md` as guide entry points for the versioned candidate pack
  - `MOB/docs/release/candidates/v<package-version>/mobile-readiness-checklist.md` as the candidate-specific evidence index
  - `MOB/docs/release/candidates/v<package-version>/mobile-release-notes.md` as the versioned candidate summary
  - `MOB/docs/release/candidates/v<package-version>/mobile-handoff-package.md` as the final distribution/handoff package
- The target release matrix for this story is:
  - `ios-simulator/direct-maestro`: `MOB/scripts/run-maestro-auth-suite.sh` over `MOB/e2e/maestro/auth` and `MOB/e2e/maestro/order`
  - `live-backend-contract`: `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`, `MOB/tests/e2e/mobile-order-live.e2e.test.ts`, and `MOB/tests/e2e/mobile-dashboard-live.e2e.test.ts`; dashboard bootstrap always runs, while holdings-backed chart parity is attached separately when reusable MFA credentials are provided
  - `physical-device/edge-smoke`: approved-build manual smoke evidence recorded in the release checklist with device, OS, app build, edge host, and reviewer metadata
- Notification regression gating for this story must explicitly cover stream URL generation, reconnect behavior, notification hydration, and mark-read behavior using `MOB/tests/unit/api/notification-api.test.ts`, `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx`, and the compact notification Maestro flows under `MOB/e2e/maestro/order/18-notification-feed-compact-setup.yaml` and `MOB/e2e/maestro/order/19-notification-feed-compact-demo.yaml`.
- The handoff package must link Story 10.1 CI evidence and Story 10.4 smoke/rehearsal evidence rather than duplicating those upstream artifacts.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep the mobile release documentation contract centralized: `MOB/docs/release/mobile-readiness-checklist.md` owns the release-evidence guide, candidate-specific evidence lives under `MOB/docs/release/candidates/v<package-version>/`, `MOB/README.md` owns local execution guidance, and the upstream Story 10.1 / 10.4 artifacts remain linked references.

### File Structure Requirements

- Required documentation and evidence outputs for this story:
  - `MOB/README.md`
  - `MOB/docs/release/mobile-readiness-checklist.md`
  - `MOB/docs/release/mobile-test-matrix.md`
  - `MOB/docs/release/mobile-release-notes.md`
  - `MOB/docs/release/mobile-handoff-package.md`
  - `MOB/docs/release/candidates/v<package-version>/mobile-readiness-checklist.md`
  - `MOB/docs/release/candidates/v<package-version>/mobile-release-notes.md`
  - `MOB/docs/release/candidates/v<package-version>/mobile-handoff-package.md`
- Automated evidence inputs for matrix coverage and regression gating:
  - `MOB/scripts/run-maestro-auth-suite.sh`
  - `MOB/e2e/maestro/auth`
  - `MOB/e2e/maestro/order`
  - `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-order-live.e2e.test.ts`
  - `MOB/tests/e2e/mobile-dashboard-live.e2e.test.ts`
  - `MOB/tests/unit/api/notification-api.test.ts`
  - `MOB/tests/unit/order/AuthenticatedHomeScreen.test.tsx`

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Validate each target-matrix lane against the story-owned definition in `MOB/docs/release/mobile-test-matrix.md`, with automated lane output stored as evidence links and the physical-device edge lane recorded as manual release evidence.
- Validate that auth, order, and notification regressions all map to at least one named automated artifact in the release checklist, and that notification gating is not satisfied by auth/order coverage alone.
- Validate that `MOB/docs/release/mobile-readiness-checklist.md`, `MOB/docs/release/mobile-test-matrix.md`, `MOB/docs/release/mobile-release-notes.md`, `MOB/docs/release/mobile-handoff-package.md`, and the candidate-specific evidence files under `MOB/docs/release/candidates/v<package-version>/` stay semantically aligned with `MOB/README.md` and the linked Story 10.1 / Story 10.4 upstream evidence locations.

### Story Completion Status

- Status set to `review`.
- Completion note: Epic 10 story context prepared from canonical planning artifact.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 10, Story 10.6)
- `_bmad-output/implementation-artifacts/epic-10-full-validation-and-release-readiness.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `MOB/README.md`
- `MOB/scripts/run-maestro-auth-suite.sh`
- `MOB/tests/e2e/mobile-auth-live.e2e.test.ts`
- `MOB/tests/e2e/mobile-order-live.e2e.test.ts`
- `MOB/tests/e2e/mobile-dashboard-live.e2e.test.ts`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 10.

### Completion Notes List

- Added the mobile release-readiness doc pack under `MOB/docs/release`.
- Linked the release pack from `MOB/README.md` so the reviewer entry point points to the new contract.
- Added a unit test to verify the release pack documents stay aligned with the README and upstream evidence references.
- Added a candidate-pack generator so the mobile release package now uses versioned evidence files instead of only static root-level templates.
- Validated the changed MOB scope with `npm run test -- tests/unit/release/mobile-release-readiness-pack.test.ts` and `npm run test -- tests/unit/api/notification-api.test.ts tests/unit/order/AuthenticatedHomeScreen.test.tsx tests/e2e/live-runtime-config.test.ts tests/e2e/mobile-auth-live.e2e.test.ts tests/e2e/mobile-order-live.e2e.test.ts tests/e2e/mobile-dashboard-live.e2e.test.ts`, plus `npm run lint`.
- Reworked the dashboard live lane so the disposable-account path validates dashboard bootstrap + summary retrieval, while holdings-backed chart parity runs only when `LIVE_EMAIL`, `LIVE_PASSWORD`, and `LIVE_TOTP_KEY` are provided.
- Re-ran the live-contract lane with `LIVE_API_BASE_URL=http://127.0.0.1:8080` and confirmed `mobile-dashboard-live.e2e.test.ts` now passes its baseline automated checks locally; the holdings-backed parity assertion is ready for release evidence when reusable credentials are provided.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/10-6-mobile-release-readiness-pack.md
- /Users/yeongjae/fixyz/MOB/README.md
- /Users/yeongjae/fixyz/MOB/docs/release/mobile-test-matrix.md
- /Users/yeongjae/fixyz/MOB/docs/release/mobile-readiness-checklist.md
- /Users/yeongjae/fixyz/MOB/docs/release/mobile-release-notes.md
- /Users/yeongjae/fixyz/MOB/docs/release/mobile-handoff-package.md
- /Users/yeongjae/fixyz/MOB/scripts/generate-release-notes.mjs
- /Users/yeongjae/fixyz/MOB/tests/unit/release/mobile-release-readiness-pack.test.ts

## Change Log

- 2026-03-25: Implemented the mobile release-readiness pack, added the release matrix/checklist/handoff docs, linked them from the MOB README, and added validation tests.
- 2026-03-25: Reworked the mobile dashboard live lane to stop blocking on disposable-account holdings materialization, added a holdings-backed parity gate, and moved the story back to review.
