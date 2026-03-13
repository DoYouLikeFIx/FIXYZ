# Story 1.16: [BE][CH] Real Password Recovery Challenge Provider & Verification

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a channel platform owner,
I want password recovery challenge bootstrap and verification backed by a real proof-of-work provider,
So that the recovery lane resists abuse without breaking existing anti-enumeration behavior.

## Acceptance Criteria

1. Given `POST /api/v1/auth/password/forgot/challenge`, when the configured proof-of-work provider is available, the rollout flag is enabled, and the request matches the explicit challenge-capable cohort rule, then the API returns `challengeContractVersion=2`, opaque `challengeId`, `challengeType=proof-of-work`, `challengeIssuedAtEpochMs`, `challengeExpiresAtEpochMs`, replay-safe challenge identity, and a discriminated `challengePayload.kind=proof-of-work` bundle with canonical solver fields.
2. Given the proof-of-work bundle is issued, when FE or MOB solves it, then the canonical solver equation is `sha256(utf8(seed + ":" + nonce))`, the answer format is unsigned base-10 `nonce`, the proof is valid only when the digest has at least `difficultyBits` leading zero bits, and the chosen `difficultyBits` profile is calibration-backed to satisfy the canonical supported-browser and supported-mobile solve budgets defined in the UX specification before rollout beyond QA or canary cohorts.
3. Given `POST /api/v1/auth/password/forgot` with `challengeToken` and scalar `challengeAnswer`, when the proof is valid for the submitted email payload and challenge instance, then the backend requires challenge-gated submits to provide `challengeToken` and `challengeAnswer` together, performs normalization server-side for account lookup, validates a server-derived digest of the exact raw submitted email string in addition to the normalized-email binding, and the forgot flow preserves the existing accepted anti-enumeration contract.
4. Given the challenge bootstrap is requested for a known or unknown email under CSRF-valid, non-rate-limited conditions, when the backend returns the response, then status, response shape, and timing remain parity-safe regardless of account existence, with a measured p95 delta of `<= 80ms` across known, unknown, and challenge-gated paths using the Story `1.7` benchmark method.
5. Given invalid, expired, mismatched, or malformed challenge proof, when the backend rejects the request, then it returns deterministic code `AUTH-022` and does not disclose account eligibility.
6. Given replayed or already consumed challenge proof, when the backend rejects the request, then it returns deterministic terminal code `AUTH-024` so clients can clear stale challenge state instead of blind retry.
7. Given bootstrap infrastructure is unavailable before a fresh challenge can be issued, when the backend cannot complete challenge issuance, then it returns deterministic code `AUTH-023` and records audit or security evidence without leaking secrets.
8. Given verify-path infrastructure becomes unavailable after the user already solved work, when the backend cannot complete verification deterministically, then it returns deterministic code `AUTH-025` so clients can discard the current challenge and restart challenge bootstrap safely.
9. Given a v2 challenge bundle is returned, when the backend validates that bundle, then `challengeToken` cryptographically binds `challengeContractVersion`, `challengeId`, `challengeType`, `challengeIssuedAtEpochMs`, `challengeExpiresAtEpochMs`, the full `challengePayload`, replay-safe challenge identity, the normalized-email-hash binding derived server-side from the submitted email, and a submitted-email digest derived server-side from the exact raw submitted email string, and any token or body divergence or exact-email-string drift is rejected with `AUTH-022`.
10. Given a new challenge is issued within the same recovery-flow scope (`csrf session` + normalized-email-hash binding derived server-side), when the backend creates the newer bundle, then any earlier outstanding unconsumed challenge in that scope is terminalized immediately so only the latest challenge remains valid.
11. Given real challenge deployment may precede FE/MOB consumers, when the backend is shipped first, then the proof-of-work path remains behind a staged rollout flag plus an explicit server-side challenge-capable cohort rule and the legacy challenge behavior can remain active until Stories `1.17` and `1.18` are shipped; when the flag is off or the request is out of cohort, `/forgot/challenge` returns the exact legacy Story `1.7` contract.
12. Given issue or verify attempts, when telemetry is emitted, then metrics, audit entries, and correlation-ready logs distinguish bootstrap success, verify success, invalid proof, replay rejection, bootstrap unavailable, verify unavailable, rollout-flag state, challenge-capable cohort, and contract version, using canonical labels `2` and `legacy-v1`.

## Tasks / Subtasks

- [ ] Add a `PasswordRecoveryChallengeProvider` abstraction and proof-of-work implementation (AC: 1, 2, 11)
  - [ ] Support canonical proof-of-work issue and verify semantics through one provider contract
  - [ ] Protect the real challenge path behind a staged rollout flag with safe legacy fallback
- [ ] Extend recovery bootstrap and verify contracts for proof-of-work v2 (AC: 1, 2, 3, 9)
  - [ ] Return `challengeContractVersion`, opaque `challengeId`, authoritative issued/expiry epochs, and discriminated `challengePayload`
  - [ ] Keep email normalization server-side and bind verification to the exact submitted email payload digest plus normalized-email challenge identity
  - [ ] Reject missing-half challenged submits, dual-field submits, payload-based PoW submits, and exact-email drift with deterministic `AUTH-022`
- [ ] Preserve anti-enumeration, replay safety, deterministic timing behavior, and calibrated difficulty selection (AC: 2, 3, 4, 5, 6, 10)
  - [ ] Keep status/body parity for known vs unknown emails
  - [ ] Reuse Redis-backed replay protection and benchmark the p95 delta target
- [ ] Add deterministic infrastructure-failure handling and telemetry (AC: 7, 8, 12)
  - [ ] Split bootstrap-unavailable and verify-unavailable paths into `AUTH-023` and `AUTH-025`
  - [ ] Emit audit/security evidence without raw proof, token, or unhashed email leakage
- [ ] Add automated coverage for contract, parity, replay, and rollout safety (AC: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12)
  - [ ] Cover known/unknown parity, invalid proof, replayed proof, expired proof, bootstrap unavailable, verify unavailable, newest-challenge-wins behavior, and flag-disabled fallback behavior
  - [ ] Provide an injectable test harness or provider failpoint that can force `AUTH-023` and `AUTH-025` independently

## Dev Notes

### Developer Context Section

- Canonical tracking source: `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-16-be-real-password-recovery-challenge-provider-and-verification`.
- Canonical planning precedence: `_bmad-output/planning-artifacts/prd.md` / `_bmad-output/planning-artifacts/architecture.md` -> `_bmad-output/planning-artifacts/channels/login_flow.md` -> `_bmad-output/planning-artifacts/channels/api-spec.md` -> `_bmad-output/planning-artifacts/epics.md`.
- Supplemental story-set context lives in `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`.
- Depends on: Story `1.7`.

### Technical Requirements

- The proof-of-work v2 contract must include:
  - `challengeContractVersion=2`
  - `challengeId`
  - `challengeType=proof-of-work`
  - `challengeIssuedAtEpochMs`
  - `challengeExpiresAtEpochMs`
  - `challengePayload.kind=proof-of-work`
  - `challengePayload.proofOfWork.algorithm=SHA-256`
  - `challengePayload.proofOfWork.seed`
  - `challengePayload.proofOfWork.difficultyBits`
  - `challengePayload.proofOfWork.answerFormat=nonce-decimal`
  - `challengePayload.proofOfWork.inputTemplate={seed}:{nonce}`
  - `challengePayload.proofOfWork.inputEncoding=utf-8`
  - `challengePayload.proofOfWork.successCondition.type=leading-zero-bits`
  - `challengePayload.proofOfWork.successCondition.minimum=difficultyBits`
- `challengeType` and `challengePayload.kind` must match. The backend must never emit a discriminator-mismatched or partial mixed v1/v2 bundle under supported configurations.
- `challengeTtlSeconds` is informational. The authoritative validity window is `challengeIssuedAtEpochMs` to `challengeExpiresAtEpochMs`.
- For the current proof-of-work rollout, `challengeAnswer` is the only supported submit field. `challengeAnswerPayload` is reserved for future adapters and must be absent; dual-field or payload-only submits are malformed and rejected with `AUTH-022`.
- Challenge-gated forgot submits must provide `challengeToken` and scalar `challengeAnswer` together with the same original `email`; non-gated submits must omit both challenge fields.
- `challengeToken` binds `challengeContractVersion`, `challengeId`, `challengeType`, `challengeIssuedAtEpochMs`, `challengeExpiresAtEpochMs`, the full returned `challengePayload`, replay-safe challenge identity, the normalized-email-hash derived server-side from the submitted email, and a submitted-email digest derived server-side from the exact raw submitted email string. Token/body divergence or exact-email drift is a server-detected `AUTH-022` condition, not a client-side introspection requirement.
- Within one recovery-flow scope, every fresh issued bundle must mint a fresh unique `challengeId` and a strictly greater `challengeIssuedAtEpochMs` than the prior issued bundle in that scope. Distinct bundles with equal authoritative issue timestamps are unsupported and must be impossible under supported configurations.
- Email normalization remains server-side. FE/MOB preserve the originally submitted email string verbatim and are not required to reproduce backend normalization semantics.
- `AUTH-022` = invalid/expired/mismatched/malformed proof.
- `AUTH-023` = bootstrap unavailable before a fresh challenge bundle is issued.
- `AUTH-024` = replayed/already consumed proof.
- `AUTH-025` = verify unavailable after the user already solved work.
- Rollout guardrail:
  - the real challenge path must remain flag-protected so a BE-first deploy does not strand current FE/MOB clients.
  - requests must also match an explicit server-side challenge-capable cohort rule before v2 is returned in shared environments.
  - when the flag is off or the request is out of cohort, `/forgot/challenge` returns the legacy Story `1.7` contract exactly and omits all v2-only fields.
  - server-side metrics and logs label that fallback branch as `legacy-v1`.
  - calibrated `difficultyBits` profiles must satisfy the canonical supported-browser and supported-mobile solve budgets defined in the UX specification before rollout beyond QA or canary cohorts.

### Architecture Compliance

- Keep challenge issue and verify logic inside the channel auth boundary.
- Reuse existing CSRF, rate-limit, audit, security-event, and Redis replay-protection conventions from Story `1.7`.
- Preserve standard error-envelope and `traceId` behavior for business failures that reach controller advice.

### Testing Requirements

- Required checks:
  - fixed bootstrap shape and status for known vs unknown emails under CSRF-valid, non-rate-limited conditions
  - p95 delta `<= 80ms` across known, unknown, and challenge-gated forgot paths with at least `30` warmed samples per path
  - valid proof accepts the challenged forgot path without breaking fixed `202 Accepted` semantics
  - v2 bootstrap responses include opaque `challengeId` while exact legacy v1 fallback omits it
  - invalid/expired proof -> `AUTH-022`
  - replayed proof -> `AUTH-024`
  - bootstrap unavailable -> `AUTH-023`
  - verify unavailable after solve -> `AUTH-025`
  - exact-email drift between bootstrap and challenged forgot submit -> `AUTH-022`
  - challenge-gated submits reject missing-half challenge fields -> `AUTH-022`
  - dual-field or payload-based proof-of-work submit -> `AUTH-022`
  - token/body divergence or exact-email drift -> `AUTH-022`
  - emitted bundles never mix legacy v1 and v2 fields and never mismatch `challengeType` vs `challengePayload.kind`
  - newer challenge issuance terminalizes the prior outstanding challenge in the same recovery-flow scope
  - newer challenge issuance emits a strictly greater `challengeIssuedAtEpochMs` for each fresh distinct `challengeId`
  - distinct bundles with equal `challengeIssuedAtEpochMs` and different `challengeId` are impossible under supported configurations
  - calibrated difficulty profile remains within the documented supported-browser and supported-mobile solve budgets
  - rollout flag disabled or request out of challenge-capable cohort -> legacy challenge behavior remains available
  - queryable metrics or logs distinguish rollout-flag state, challenge-capable cohort, and canonical contract version label (`2` or `legacy-v1`) for issue and verify outcomes

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story scaffold regenerated from canonical Epic 1 follow-on planning and contract hardening decisions.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.16)
- `_bmad-output/planning-artifacts/epic-1-follow-on-real-password-recovery-challenge-story-set.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/login_flow.md`
- `_bmad-output/implementation-artifacts/1-7-be-password-forgot-reset-api.md`
- `_bmad-output/implementation-artifacts/1-6-fe-mob-auth-error-standardization.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Regenerated from canonical Epic 1 follow-on planning artifacts for execution readiness.

### Completion Notes List

- Story scaffold created for backend real recovery challenge provider, deterministic error taxonomy, rollout safety, and anti-enumeration evidence.

### File List

- _bmad-output/implementation-artifacts/1-16-be-real-password-recovery-challenge-provider-and-verification.md
