# Story 1.19: [CH/FE/MOB] Recovery Challenge Abuse-Defense Validation & Ops Evidence

Status: ready-for-dev

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

- [ ] Add lane-scoped automated verification for the real recovery challenge rollout (AC: 1, 2)
  - [ ] Extend BE integration coverage for parity, replay, expiry, bootstrap unavailable, verify unavailable, exact-email drift rejection, missing-half challenged submit rejection, and deterministic fresh-issue `challengeId` rotation
  - [ ] Extend FE and MOB E2E coverage for challenge solve, stale-state clearing, fail-closed malformed-bundle handling, exact canonical reason labeling, in-cohort v2 behavior, out-of-cohort legacy fallback, `challengeId`-ordered replacement including equal-timestamp collision fail-close, redirect preservation, and recovery completion
  - [ ] Provide a request-mutation harness or API-client interception layer for malformed submit-shape rejection paths that are intentionally unreachable from normal FE/MOB UI flows, and use it to verify exact canonical error and telemetry labeling on mutated client-stack requests
  - [ ] Produce the Story `1.7` timing benchmark evidence with the documented sample method
  - [ ] Provide independent fault injection or failpoints that can force `AUTH-023` and `AUTH-025` separately
  - [ ] Provide a deterministic non-production cohort selector or test-only override so QA can reproduce both in-cohort v2 and out-of-cohort legacy fallback paths on demand
- [ ] Add observability and support evidence for recovery challenge outcomes (AC: 3, 4)
  - [ ] Expose issue/verify success and failure counters, plus client fail-closed bundle-rejection counters broken down by the exact canonical rejection reason, by environment, rollout-flag state, challenge-capable cohort, and canonical challenge contract version label (`2` or `legacy-v1`)
  - [ ] Preserve `traceId`, safe `challengeIdHash` correlation, retryability, rollout-flag state, cohort, canonical contract version label, and exact bundle-rejection reason without leaking secrets
- [ ] Publish operator guidance for staged rollout and rollback (AC: 5)
  - [ ] Document feature-flag enablement, rollback, QA/canary cohort selection, deterministic non-production cohort forcing, degraded mode, legacy-v1 versus v2 cutover rules, and verification steps
- [ ] Package lane-scoped QA evidence for story closeout (AC: 6, 7)
  - [ ] Prove anti-enumeration and redirect guarantees remain preserved
  - [ ] Prove each fail-closed path emits the exact canonical reason label rather than only aggregate bundle-rejection counts
  - [ ] Keep release-readiness ownership explicitly with Epic 10

## Dev Notes

### Developer Context Section

- Canonical tracking source: `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-19-recovery-challenge-abuse-defense-validation-and-ops-evidence`.
- Canonical planning precedence: `_bmad-output/planning-artifacts/prd.md` / `_bmad-output/planning-artifacts/architecture.md` -> `_bmad-output/planning-artifacts/ux-design-specification.md` -> `_bmad-output/planning-artifacts/channels/login_flow.md` -> `_bmad-output/planning-artifacts/channels/api-spec.md` -> `_bmad-output/planning-artifacts/epics.md`.
- Supplemental story-set context lives in `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`.
- Depends on: Story `1.16`, Story `1.17`, Story `1.18`.

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
- `challengeIdHash` must be derived server-side as `hex(HMAC-SHA-256(observabilitySecret, challengeId))[0:24]` and used consistently across logs, audit records, and dashboards. FE and MOB do not emit raw `challengeId` or compute their own alternate hash forms.
- The anti-enumeration timing benchmark must reuse the Story `1.7` measurement method:
  - at least `30` warmed samples per path
  - same integration environment
  - record the slowest-versus-fastest p95 delta
- Evidence remains lane-scoped. This story does not replace or subsume Epic 10 release gating.

### Architecture Compliance

- Reuse the existing audit, security-event, metrics, and `traceId` conventions in the channel auth lane.
- Keep operational evidence queryable by environment, rollout-flag state, challenge-capable cohort, canonical contract version label (`2` or `legacy-v1`), safe `challengeIdHash` correlation, and exact client fail-closed bundle-rejection reason.
- Do not log raw proof, raw challenge token, or unhashed email in any evidence artifact.

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

- Status set to `ready-for-dev`.
- Completion note: Story scaffold regenerated from canonical Epic 1 follow-on planning and lane-scoped validation requirements.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.19)
- `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/ux-design-specification.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/login_flow.md`
- `_bmad-output/implementation-artifacts/1-16-be-real-password-recovery-challenge-provider-and-verification.md`
- `_bmad-output/implementation-artifacts/1-17-fe-web-real-password-recovery-challenge-ux.md`
- `_bmad-output/implementation-artifacts/1-18-mob-mobile-real-password-recovery-challenge-ux.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical Epic 1 follow-on planning artifacts for execution readiness.

### Completion Notes List

- Story scaffold created for lane-scoped recovery challenge verification, timing evidence, observability, and staged rollout guidance.

### File List

- _bmad-output/implementation-artifacts/1-19-recovery-challenge-abuse-defense-validation-and-ops-evidence.md
