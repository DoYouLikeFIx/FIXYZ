# Story 1.19: [CH/FE/MOB] Recovery Challenge Abuse-Defense Validation & Ops Evidence

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want lane-scoped validation and operational evidence for the real recovery challenge rollout,
So that abuse-defense hardening is measurable, supportable, and safe to stage in production-like environments.

## Acceptance Criteria

1. Given the real proof-of-work rollout, when automated verification runs, then BE integration covers known and unknown email parity, replay rejection, expiry, bootstrap unavailable, verify unavailable, exact-email drift rejection, rate-limit boundaries, deterministic fresh-issue `challengeId` rotation, and monotonic authoritative issue timestamps for fresh bundles; request-mutation harness coverage owns malformed submit-shape rejection (`challengeAnswerPayload` or dual-field PoW submit) plus mutated client-stack paths that normal FE or MOB UI cannot produce; and FE plus MOB E2E cover fail-closed malformed-bundle handling, `clock-skew` and `validity-untrusted` bundle rejection, exact canonical fail-closed reason labeling, QA/canary cohort fallback, v2 `challengeId` consumption versus legacy-v1 absence, challenge replacement ordering including equal-timestamp collision fail-close, and redirect-preserving recovery completion.
2. Given anti-enumeration timing evidence, when the challenge rollout is reviewed, then the Story `1.7` benchmark method is reused with at least `30` warmed samples per path and the slowest-versus-fastest p95 delta remains `<= 80ms` across known, unknown, and challenge-gated forgot paths.
3. Given provider-backed recovery traffic, when observability data is emitted, then dashboards or queryable metrics expose bootstrap rate, verify success rate, verify failure rate, replay rejection count, bootstrap-unavailable count, verify-unavailable count, and client fail-closed bundle-rejection counts broken down by the exact canonical rejection reason (`unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, `validity-untrusted`) as well as by environment, rollout-flag state, challenge-capable cohort, and canonical challenge contract version label (`2` or `legacy-v1`).
4. Given support or incident response, when logs and audit records are reviewed, then `traceId`, safe `challengeIdHash` correlation using the canonical HMAC-derived format, challenge outcome category, retryability, rollout-flag state, challenge-capable cohort, canonical challenge contract version label (`2` or `legacy-v1`), and the exact client fail-closed bundle-rejection reason are visible without exposing raw proof, raw token, raw `challengeId`, or unhashed email.
5. Given staged rollout or rollback, when operators consult deployment guidance, then feature-flag enablement, rollback, QA/canary cohort selection, deterministic non-production cohort forcing for validation, degraded mode, legacy-v1 versus v2 cutover rules, and test verification steps are documented.
6. Given story closeout, when QA evidence is packaged, then the story set includes traceable proof that the real challenge rollout preserved the existing anti-enumeration and recovery redirect guarantees from Stories `1.7` to `1.9`.
7. Given Epic 10 remains the final release gate, when this story is completed, then it produces lane-scoped evidence only and does not by itself redefine release readiness ownership.

## Tasks / Subtasks

- [x] Add lane-scoped automated verification for the real recovery challenge rollout (AC: 1, 2)
  - [x] Extend BE integration coverage for parity, replay, expiry, bootstrap unavailable, verify unavailable, exact-email drift rejection, missing-half challenged submit rejection, and deterministic fresh-issue `challengeId` rotation
  - [x] Extend FE and MOB E2E coverage for challenge solve, stale-state clearing, fail-closed malformed-bundle handling, exact canonical reason labeling, in-cohort v2 behavior, out-of-cohort legacy fallback, `challengeId`-ordered replacement including equal-timestamp collision fail-close, redirect preservation, and recovery completion
  - [x] Provide a request-mutation harness or API-client interception layer for malformed submit-shape rejection paths that are intentionally unreachable from normal FE/MOB UI flows, and use it to verify exact canonical error and telemetry labeling on mutated client-stack requests
  - [x] Produce the Story `1.7` timing benchmark evidence with the documented sample method
  - [x] Provide independent fault injection or failpoints that can force `AUTH-023` and `AUTH-025` separately
  - [x] Provide a deterministic non-production cohort selector or test-only override so QA can reproduce both in-cohort v2 and out-of-cohort legacy fallback paths on demand
- [x] Add observability and support evidence for recovery challenge outcomes (AC: 3, 4)
  - [x] Expose issue/verify success and failure counters, plus client fail-closed bundle-rejection counters broken down by the exact canonical rejection reason, by environment, rollout-flag state, challenge-capable cohort, and canonical challenge contract version label (`2` or `legacy-v1`)
  - [x] Preserve `traceId`, safe `challengeIdHash` correlation, retryability, rollout-flag state, cohort, canonical contract version label, and exact bundle-rejection reason without leaking secrets
- [x] Publish operator guidance for staged rollout and rollback (AC: 5)
  - [x] Document feature-flag enablement, rollback, QA/canary cohort selection, deterministic non-production cohort forcing, degraded mode, legacy-v1 versus v2 cutover rules, and verification steps
- [x] Package lane-scoped QA evidence for story closeout (AC: 6, 7)
  - [x] Prove anti-enumeration and redirect guarantees remain preserved
  - [x] Prove each fail-closed path emits the exact canonical reason label rather than only aggregate bundle-rejection counts
  - [x] Keep release-readiness ownership explicitly with Epic 10

## Dev Notes

### Developer Context Section

- Canonical tracking source: `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-19-recovery-challenge-abuse-defense-validation-and-ops-evidence`.
- Canonical planning precedence: `_bmad-output/planning-artifacts/prd.md` / `_bmad-output/planning-artifacts/architecture.md` -> `_bmad-output/planning-artifacts/ux-design-specification.md` -> `_bmad-output/planning-artifacts/channels/login_flow.md` -> `_bmad-output/planning-artifacts/channels/api-spec.md` -> `_bmad-output/planning-artifacts/epics.md`.
- Supplemental story-set context lives in `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`.
- Depends on: Story `1.16`, Story `1.17`, Story `1.18`.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only when Stories `1.16`, `1.17`, and `1.18` are either `done` or are explicitly treated as frozen reviewed baselines for the same implementation branch.
- Frozen reviewed baseline scope for Stories `1.16` to `1.18`: `challengeContractVersion`, `challengeId`, `challengeIssuedAtEpochMs`, `challengeExpiresAtEpochMs`, proof-of-work payload shape, `AUTH-022` / `AUTH-023` / `AUTH-024` / `AUTH-025` semantics, legacy-v1 fallback shape, rollout-flag plus cohort routing semantics, and canonical client fail-closed reason labels.
- If a blocker or review finding requires changing the frozen scope above, pause Story `1.19`, refresh the story evidence plan, and re-confirm the baselines before continuing.

### Technical Requirements

- Evidence must distinguish:
  - bootstrap unavailable (`AUTH-023`)
  - verify unavailable after solve (`AUTH-025`)
  - invalid/expired proof (`AUTH-022`)
  - replay/already consumed proof (`AUTH-024`)
- Evidence must also distinguish:
  - legacy v1 challenge path vs v2 proof-of-work path
  - rollout-flag enabled vs disabled environments or cohorts
  - explicit challenge-capable cohort vs out-of-cohort fallback traffic
  - client fail-closed bundle rejection reasons (`unknown-version`, `kind-mismatch`, `malformed-payload`, `mixed-shape`, `clock-skew`, `validity-untrusted`)
  - canonical contract version labels `2` vs `legacy-v1`
  - safe `challengeIdHash` correlation for issue-to-replacement investigations
- Canonical client fail-closed telemetry path for this story is:
  - FE and MOB emit `password-recovery-challenge-fail-closed` through the shared `__FIXYZ_AUTH_TELEMETRY__` sink.
  - Story `1.19` owns the bridge from that sink into channel-auth telemetry ingestion; local `console.warn` output is diagnostic-only and cannot be used as release evidence.
  - Queryable release evidence must come from backend counters named `auth.password_recovery.challenge.client_fail_closed` tagged by `reason`, `surface`, `environment`, `rollout_enabled`, `challenge_capable_cohort`, and `contract_version`.
  - FE transport uses `navigator.sendBeacon` when available with same-origin `fetch(..., { keepalive: true })` fallback; MOB transport uses the existing auth API client to deliver the same canonical payload to the channel-auth collector owned by this story.
- `challengeIdHash` must be derived server-side as `hex(HMAC-SHA-256(observabilitySecret, challengeId))[0:24]` and used consistently across logs, audit records, and dashboards. FE and MOB do not emit raw `challengeId` or compute their own alternate hash forms.
- `observabilitySecret` is sourced from `auth.password-recovery.challenge.observability-secret` / `AUTH_PASSWORD_RECOVERY_CHALLENGE_OBSERVABILITY_SECRET` and must remain distinct from the signing secret used for `challengeToken`.
- The anti-enumeration timing benchmark must reuse the Story `1.7` measurement method:
  - at least `30` warmed samples per path
  - same integration environment
  - record the slowest-versus-fastest p95 delta
- Release-evidence baseline clients for Story `1.19` are fixed as:
  - FE: Playwright `Desktop Chrome` project from `FE/playwright.config.ts`
  - MOB: Maestro iOS simulator default `iPhone 17` from `MOB/scripts/run-maestro-auth-suite.sh`
- If a different browser or mobile device baseline is used, update this story and `docs/ops/password-recovery-challenge-runbook.md` before collecting evidence.
- Evidence remains lane-scoped. This story does not replace or subsume Epic 10 release gating.

### Architecture Compliance

- Reuse the existing audit, security-event, metrics, and `traceId` conventions in the channel auth lane.
- Keep operational evidence queryable by environment, rollout-flag state, challenge-capable cohort, canonical contract version label (`2` or `legacy-v1`), safe `challengeIdHash` correlation, and exact client fail-closed bundle-rejection reason.
- Do not log raw proof, raw challenge token, or unhashed email in any evidence artifact.
- Operator guidance and verification steps for this story must be published in `docs/ops/password-recovery-challenge-runbook.md` so rollout, rollback, and evidence collection remain reproducible.

### Testing Requirements

- Required checks:
  - BE integration coverage for known/unknown parity, replay, expiry, bootstrap unavailable, verify unavailable, exact-email drift rejection, and deterministic fresh-issue `challengeId` rotation
  - request-mutation harness coverage for malformed submit-shape rejection on the scalar-only proof-of-work rollout, including exact canonical error and telemetry labeling
  - FE and MOB E2E coverage for contract consumption, stale-state clearing, redirect preservation, and recovery completion
  - FE and MOB evidence for fail-closed malformed-bundle handling, exact legacy v1 fallback recognition, deterministic `challengeId` replacement, and replacement ordering by authoritative issue timestamp
  - measured p95 delta `<= 80ms` across known, unknown, and challenge-gated forgot paths
  - independent test-harness evidence proving `AUTH-023` and `AUTH-025` can be forced separately
  - exact-email drift rejection returns `AUTH-022`
  - in-cohort requests produce v2 with opaque `challengeId` while out-of-cohort requests remain on exact legacy v1 behavior with no `challengeId`
  - dashboards or query outputs show fail-closed bundle rejection counts broken down by each exact canonical reason, including `clock-skew` and `validity-untrusted`
  - logs or audit evidence expose safe `challengeIdHash` correlation for challenge rotation and stale-state incidents using the canonical HMAC-derived format
  - mobile solve-time evidence meets the documented baseline-device p95/p99 budget
  - web solve-time evidence meets the documented baseline-browser p95/p99 budget
  - operator evidence for feature-flag enablement and rollback
  - dashboards or query outputs that distinguish bootstrap and verify failure classes, exact client fail-closed bundle rejection reason, and segment by rollout flag plus cohort plus canonical contract version label
  - deterministic test evidence proves both in-cohort v2 and out-of-cohort legacy-v1 paths can be selected on demand in non-production validation environments

### Story Completion Status

- Status set to `review`.
- Completion note: Lane-scoped recovery challenge verification, telemetry bridging, ops evidence, Story `1.7` timing revalidation, and closeout evidence packaging are complete and ready for QA review.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.19)
- `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/login_flow.md`
- `docs/ops/password-recovery-challenge-runbook.md`
- `_bmad-output/implementation-artifacts/1-16-be-real-password-recovery-challenge-provider-and-verification.md`
- `_bmad-output/implementation-artifacts/1-17-fe-web-real-password-recovery-challenge-ux.md`
- `_bmad-output/implementation-artifacts/1-18-mob-mobile-real-password-recovery-challenge-ux.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `cd /Users/yeongjae/fixyz/BE && ./gradlew :channel-service:test --tests com.fix.channel.service.PasswordRecoveryChallengeTelemetryServiceTest --tests com.fix.channel.service.PasswordRecoveryServiceBootstrapRoutingTest --tests com.fix.channel.integration.ChannelPasswordRecoveryIntegrationTest`
- `cd /Users/yeongjae/fixyz/FE && pnpm test -- tests/unit/api/authApi.test.ts`
- `cd /Users/yeongjae/fixyz/MOB && npm test -- tests/unit/auth/recovery-challenge.test.ts tests/unit/auth/use-forgot-password-view-model.test.tsx tests/unit/api/auth-api.test.ts tests/integration/mobile-password-recovery-transport.test.ts`
- `cd /Users/yeongjae/fixyz/BE && ./gradlew :channel-service:test --tests com.fix.channel.service.PasswordRecoveryChallengeTelemetryServiceTest --tests com.fix.channel.service.PasswordRecoveryServiceBootstrapRoutingTest --tests com.fix.channel.migration.ChannelFlywayMigrationTest`
- `cd /Users/yeongjae/fixyz/FE && pnpm test -- tests/integration/password-recovery.test.tsx`
- `cd /Users/yeongjae/fixyz/MOB && npm test -- tests/unit/api/auth-api.test.ts tests/unit/auth/use-forgot-password-view-model.test.tsx`
- `cd /Users/yeongjae/fixyz/FE && LIVE_API_BASE_URL=http://127.0.0.1:8080 pnpm exec playwright test e2e/live/auth-live.spec.ts -g 'submits the live forgot-password flow|bootstraps the live recovery challenge contract'`
- `cd /Users/yeongjae/fixyz/MOB && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer LIVE_API_BASE_URL=http://127.0.0.1:8080 LIVE_EMAIL=qa_live_<timestamp>@example.com bash ./scripts/run-maestro-auth-suite.sh ./e2e/maestro/auth-live/09-password-recovery-challenge-submit-live-be.yaml`
- `cd /Users/yeongjae/fixyz/FE && pnpm test -- tests/integration/password-recovery.test.tsx`
- `cd /Users/yeongjae/fixyz/MOB && npm test -- tests/unit/auth/auth-flow-view-model.test.ts tests/unit/auth/AppNavigator.mfa-recovery.test.tsx tests/integration/mobile-password-recovery-transport.test.ts`
- Story `1.7` timing benchmark rerun documented in `_bmad-output/implementation-artifacts/tests/password-recovery-challenge-closeout-2026-03-20.md`

### Completion Notes List

- Added a CSRF-protected channel-auth collector for client fail-closed recovery challenge telemetry.
- Added exact-reason fail-closed telemetry bridges for FE (`sendBeacon` plus `fetch keepalive` fallback) and MOB (existing auth API client).
- Added environment-tagged metrics and safe `challengeIdHash` / retryability audit evidence for recovery challenge issue, verify, and client fail-closed events.
- Hardened the fail-closed collector so it only accepts session-bound pending bootstrap contexts, consumes them after use, and avoids fabricating v2/cohort tags when no authoritative context exists.
- Added optional `challengeIssuedAtEpochMs` telemetry matching from FE/MOB so the backend can avoid mis-attributing stale or equal-timestamp collision incidents to the wrong `challengeIdHash`.
- Prevented duplicate fail-closed telemetry emission by preferring the shared auth telemetry sink when present and falling back to the backend bridge transport only when no sink is installed.
- Removed stale session-only collector metadata that was no longer consumed and added guard tests for mismatched issue timestamps plus shared-sink precedence over bridge transports.
- Published the staged rollout, rollback, and evidence collection runbook in `docs/ops/password-recovery-challenge-runbook.md`.
- Added a compatibility migration for raw audit/security inserts and repaired the local compose channel-service runtime so live CSRF-backed recovery flows no longer fail on missing UUID defaults or secure-only session cookies in HTTP validation.
- Added local compose pass-through for password-recovery rollout controls so live validation can force the v2 proof-of-work lane reproducibly.
- Added local compose pass-through for password-recovery benchmark rate-limit overrides so Story `1.7` timing samples can be collected without `AUTH-014` interference.
- Strengthened the FE live auth preflight to fail fast on real forgot-password contract regressions and repaired the Maestro iOS harness to use an explicit simulator UDID.
- Fixed the mobile auth runtime regression where `AppNavigator` omitted the fail-closed telemetry prop, and enabled compact-height auth scrolling so the proof-of-work submit action remains reachable after long challenge cards.
- Revalidated live BE-FE and BE-MOB forgot-password acceptance/bootstrap/submit lanes against the repaired backend and updated the shared QA evidence summary.
- Reused the Story `1.7` timing benchmark method with `30` measured samples per path and packaged the redirect-preservation closeout evidence for Stories `1.7` to `1.9`.

### File List

- _bmad-output/implementation-artifacts/1-19-recovery-challenge-abuse-defense-validation-and-ops-evidence.md
- _bmad-output/implementation-artifacts/tests/test-summary.md
- _bmad-output/implementation-artifacts/tests/password-recovery-challenge-closeout-2026-03-20.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad/bmm/workflows/qa-generate-e2e-tests/workflow.yaml
- BE/channel-service/src/main/java/com/fix/channel/config/ChannelSecurityPaths.java
- BE/channel-service/src/main/java/com/fix/channel/config/PasswordRecoveryProperties.java
- BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java
- BE/channel-service/src/main/java/com/fix/channel/dto/request/PasswordRecoveryChallengeFailClosedTelemetryRequest.java
- BE/channel-service/src/main/java/com/fix/channel/service/PasswordRecoveryChallengeProvider.java
- BE/channel-service/src/main/java/com/fix/channel/service/PasswordRecoveryChallengeTelemetryService.java
- BE/channel-service/src/main/java/com/fix/channel/service/PasswordRecoveryService.java
- BE/channel-service/src/main/java/com/fix/channel/service/ProofOfWorkPasswordRecoveryChallengeService.java
- BE/channel-service/src/main/java/db/migration/V22__ensure_audit_security_uuid_insert_defaults.java
- BE/channel-service/src/main/resources/application.yml
- BE/channel-service/src/test/java/com/fix/channel/migration/ChannelFlywayMigrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/compliance/LogPiiComplianceTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelPasswordRecoveryIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/PasswordRecoveryChallengeTelemetryServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/PasswordRecoveryServiceBootstrapRoutingTest.java
- FE/e2e/live/_shared/liveAuthContract.ts
- FE/e2e/live/auth-live.spec.ts
- FE/src/api/authApi.ts
- FE/src/hooks/auth/useForgotPasswordPageController.ts
- FE/src/lib/recovery-challenge.ts
- FE/tests/integration/password-recovery.test.tsx
- FE/tests/unit/api/authApi.test.ts
- FE/tests/unit/lib/recovery-challenge.test.ts
- MOB/e2e/maestro/auth-live/09-password-recovery-challenge-submit-live-be.yaml
- MOB/src/api/auth-api.ts
- MOB/src/components/auth/AuthScaffold.tsx
- MOB/src/auth/recovery-challenge.ts
- MOB/src/navigation/AppNavigator.tsx
- MOB/src/auth/use-forgot-password-view-model.ts
- MOB/scripts/record-password-recovery-live-be-demo.sh
- MOB/scripts/run-maestro-auth-suite.sh
- MOB/tests/unit/api/auth-api.test.ts
- docs/ops/password-recovery-challenge-runbook.md
- docker-compose.yml

### Change Log

- 2026-03-20: Added the backend fail-closed telemetry collector, environment-tagged recovery challenge metrics, safe `challengeIdHash` audit correlation, and FE/MOB telemetry bridges with regression coverage.
- 2026-03-20: Addressed senior code review findings by requiring pending bootstrap context for collector acceptance, matching optional issue timestamps from FE/MOB, avoiding ambiguous `challengeIdHash` attribution, and reconciling the story file list with the actual changed files.
- 2026-03-20: Added a second hardening pass with mismatch-drop coverage for `challengeIssuedAtEpochMs`, shared-sink precedence tests for FE/MOB telemetry emission, and removal of dead session collector metadata.
- 2026-03-20: Fixed live forgot-password runtime blockers by adding audit/security insert defaults, disabling secure-only session cookies for local HTTP validation, enabling reproducible v2 rollout controls in compose, and revalidating FE/MOB live recovery lanes.
- 2026-03-20: Completed the Story `1.7` timing rerun plus closeout packaging for anti-enumeration and redirect-preservation evidence, and moved Story `1.19` to `review`.

### Senior Developer Review (AI)

- 2026-03-20: Review outcome `changes requested`, then fixed in working tree. The collector no longer records spoofable or sessionless fail-closed reports, FE/MOB now forward optional authoritative issue timestamps for safer correlation, and duplicate sink/transport emission was removed.
- 2026-03-20: Follow-up adversarial findings around live backend evidence, deterministic local rollout controls, Maestro simulator targeting, and stale QA evidence were addressed in the working tree and revalidated against live FE/MOB forgot-password lanes.
- Residual status: all previously identified blocking review findings were addressed in the working tree, and the story is ready for QA review while Epic `10` remains the final release gate.
