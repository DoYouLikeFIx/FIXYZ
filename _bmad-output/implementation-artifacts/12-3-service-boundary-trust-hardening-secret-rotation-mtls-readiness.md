# Story 12.3: Service Boundary Trust Hardening (Secret Rotation + mTLS Readiness)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a service trust owner,
I want a documented trust-hardening contract,
so that secret rotation safety and mTLS readiness can be implemented later without ambiguity.

**Depends On:** Story 0.8, Story 0.13, Story 8.3, Story 12.1

## Acceptance Criteria

1. Given internal secret rotation requirements, when `docs/ops/dmz-trust-hardening.md` is reviewed, then overlap window, invalidation timing, and stale-secret behavior are explicit.
2. Given availability validation requirements, when the design is reviewed, then workload shape, service pairs, measurement method, and pass/fail thresholds are explicit.
3. Given mTLS readiness scope, when the design is reviewed, then ADR output, PoC scope, and deferred items are explicit.
4. Given non-local Vault dependency, when the story is reviewed, then Story 0.13 constraints are explicitly carried forward.

## Tasks / Subtasks

- [x] Finalize rotation contract and stale-secret behavior (AC: 1)
  - [x] Define service-pair rejection matrix with status code, machine code, and required evidence fields
  - [x] Define the exact non-local fail-closed posture inherited from Story 0.13 for every in-scope pair
- [x] Finalize reproducible validation contract (AC: 2)
  - [x] Lock the 500-request workload profile and numerator/denominator calculation rule
- [x] Finalize documentation-only mTLS readiness outputs and non-goals (AC: 3)
  - [x] Publish the ADR at `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md`
  - [x] Publish the fixed-pair PoC plan at `docs/ops/dmz-mtls-poc-plan.md`
- [x] Finalize Vault dependency mapping to Story 0.13 (AC: 4)
  - [x] Define non-local Vault and local-dev behavior split explicitly
  - [x] Carry forward boot-path versus business-flow Vault client rules explicitly

## Dev Notes

### Developer Context Section

- This story is documentation-only. Readiness hardening for Story 12.3 is complete only when the design package, named output artifacts, and root regression coverage are aligned.
- Epic 12 remains documentation-only until a separate reviewed runtime change reintroduces service-boundary trust controls. Story 12.3 must not introduce BE/FE/MOB runtime assets, drill automation, or release-gate evidence in this change.
- The ADR and PoC outputs for Story 12.3 are planning artifacts only. They define the future implementation contract; they do not activate runtime mTLS in this repository.

### Technical Requirements

- Rotation drill workload:
  - 500 valid service-to-service requests minimum
  - fixed service-pair distribution documented in `docs/ops/dmz-trust-hardening.md`
- Availability calculation:
  - denominator = valid scheduled requests only
  - numerator = transport failures, timeouts, or HTTP `5xx`
  - negative stale-secret probes excluded from denominator
- Overlap/invalidation timing must be non-contradictory and define how continuous outage is measured per service pair.
- Stale-secret rejection must define service-pair-specific status code, machine code, and evidence fields.
- Planning docs must remain aligned to the `401` stale-secret rejection contract.
- mTLS readiness output must include:
  - `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md`
  - `docs/ops/dmz-mtls-poc-plan.md`
- Story 0.13 constraints carried forward into this story must stay explicit:
  - `staging` and `prod` are `external-vault-only`
  - local/dev may use compose-owned `vault` and `vault-init` only through `docker-compose.vault.yml`
  - non-local boot-path secrets use deploy-time pre-start retrieval plus environment injection only
  - non-local profiles fail closed if local `vault` or `vault-init` services are enabled
  - local-only secret fallbacks and localhost Vault defaults must not apply in non-local environments
  - external Vault transport for non-local paths requires TLS, CA trust, and hostname/SAN verification; plaintext `http://` is forbidden
  - the existing `channel-service` TOTP Vault secret store remains a business-flow Vault client and must follow the same external endpoint/TLS policy
  - Vault role/policy bootstrap remains operator/IaC owned rather than app-runtime owned
- The fixed PoC pair remains `channel-service -> corebank-service`, but Story 12.3 defines only the documentation package and evidence checklist for that future PoC.

### Architecture Compliance

- Preserve Story 0.8 secret-management baseline and Story 0.13 external Vault constraints.
- Preserve Story 8.3 correlation-id expectations for evidence and rejection samples.
- Do not expand this story into full production mTLS rollout, runtime cutover rehearsal, or Story 12.5 promotion evidence.
- Keep Story 12.3 implementation in the repository root (`docs/**`, `tests/**`, `_bmad-output/**`); runtime service code is reference-only input for future work.

### File Structure Requirements

- Changed during this readiness-hardening round:
  - `docs/ops/dmz-trust-hardening.md`
  - `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md`
  - `docs/ops/dmz-mtls-poc-plan.md`
  - `tests/edge-gateway/dmz-trust-hardening.test.js`
  - `tests/edge-gateway/dmz-perimeter-policy.test.js`
  - `_bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md`
  - `_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness.md`
  - `_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md`
- Validated unchanged design inputs:
  - `_bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md`
  - `docs/ops/vault-external-operations.md`
  - `docs/ops/dmz-drill-governance.md`
  - `_bmad-output/implementation-artifacts/12-1-dmz-network-segmentation-profile.md`
- Reference-only runtime baseline inputs:
  - `docker-compose.yml`
  - `BE/**`
- Explicitly out of scope for Story 12.3:
  - any newly introduced Epic 12 runtime overlay or drill automation
  - `BE/**`
  - `FE/**`
  - `MOB/**`

### Testing Requirements

- Add root regression coverage in `tests/edge-gateway/dmz-trust-hardening.test.js`.
- Verify the design package keeps the fixed workload profile, availability formula, and stale-secret rejection matrix explicit.
- Verify Story 0.13 carried-forward constraints are restated concretely instead of referenced only by story number.
- Verify the ADR and fixed-pair PoC plan exist at the exact paths above and are explicitly documentation-only outputs.
- Verify Story 12.3 keeps release-gate execution and runtime rollout deferred to a future reviewed runtime change and Story 12.5.
- Keep tracked QA evidence in `_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md` instead of `_bmad-output/implementation-artifacts/tests/**`.
- Minimum verification commands for this readiness-hardening round:
  - `node --check tests/edge-gateway/dmz-trust-hardening.test.js`
  - `node --test tests/edge-gateway/dmz-trust-hardening.test.js`
  - `node --test tests/edge-gateway/dmz-perimeter-policy.test.js`
  - `npm run test:edge-gateway`

### Story Completion Status

- Status set to `done`.
- Completion note: Story 12.3 now has an explicit documentation-only boundary, named ADR/PoC outputs, and concrete Story 0.13 carry-forward constraints.

### References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/ops/dmz-trust-hardening.md`
- `docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md`
- `docs/ops/dmz-mtls-poc-plan.md`
- `_bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md`
- `_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md`
- `docs/ops/dmz-drill-governance.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- 2026-03-24: Readiness review blocked Story 12.3 on incomplete Story 0.13 carry-forward rules, docs-only versus PoC ambiguity, and vague artifact/test targets.
- 2026-03-24: Revised Story 12.3 to define documentation-only outputs, exact artifact paths, and root regression coverage.
- 2026-03-24: Review follow-up removed the ignored summary-artifact dependency, expanded AC-value assertions, and stabilized the shared Story 12.2 historical snapshot regression.
- 2026-03-24: QA follow-up moved Story 12.3 verification evidence into a tracked story-owned summary and removed workspace-specific absolute path coupling from the story package.
- 2026-03-24: `node --check tests/edge-gateway/dmz-trust-hardening.test.js`
- 2026-03-24: `node --test tests/edge-gateway/dmz-trust-hardening.test.js`
- 2026-03-24: `node --test tests/edge-gateway/dmz-perimeter-policy.test.js`
- 2026-03-24: `npm run test:edge-gateway`

### Completion Notes List

- Story 12.3 is now explicit about being documentation-only until a reviewed runtime change reintroduces service-boundary trust controls.
- Added a named ADR artifact and a named fixed-pair mTLS PoC plan so the output scope is concrete rather than implied.
- Carried Story 0.13 constraints forward as implementation-facing rules instead of leaving them as a high-level dependency note.
- Expanded the root regression so AC-critical rotation, workload, threshold, and stale-secret matrix values are asserted directly.
- Hardened the shared `edge-gateway` historical snapshot regression so future unrelated dirty paths do not silently bypass live-overlap checks.
- Made the non-local Vault posture explicit for every in-scope service pair, including the `fep-gateway -> fep-simulator` control-plane path.
- Removed the shared Story 12.2 regression's dependency on ignored QA-summary files and documented the shared follow-up honestly in this story record.
- Moved Story 12.3 QA evidence into a tracked story-owned summary artifact and replaced workspace-specific absolute paths with repo-relative paths across the readiness package.

### File List

- _bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness.md
- docs/ops/dmz-trust-hardening.md
- docs/ops/adr/adr-0003-service-boundary-mtls-readiness.md
- docs/ops/dmz-mtls-poc-plan.md
- tests/edge-gateway/dmz-trust-hardening.test.js
- tests/edge-gateway/dmz-perimeter-policy.test.js
- _bmad-output/implementation-artifacts/12-2-edge-perimeter-policy-hardening.md
- _bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md

### Change Log

- 2026-03-24: Story 12.3 readiness hardening added explicit docs-only boundaries, named ADR/PoC outputs, Story 0.13 carry-forward rules, and root regression coverage.
- 2026-03-24: Senior review follow-up removed the ignored QA-summary dependency, asserted AC-critical trust-hardening values directly, and documented the shared root-suite stabilization change.
- 2026-03-24: Second review follow-up made the non-local Vault posture explicit per in-scope service pair and removed Story 12.2 ignored-summary dependencies from the shared root suite.
- 2026-03-24: QA traceability follow-up moved Story 12.3 evidence into a tracked story-owned summary, replaced workspace-specific absolute paths with repo-relative paths, and synchronized the story record with the latest verification pass.

## Senior Developer Review (AI)

### Reviewer

- Reviewer: Codex
- Date: 2026-03-24
- Outcome: Approved after fixes

### Summary

- Resolved 2 High and 2 Medium findings from the adversarial review pass.

### Findings Resolved

- [HIGH] Removed the Story 12.3 regression's dependency on a gitignored QA summary artifact and stopped claiming that ignored file in the story record.
- [HIGH] Expanded the Story 12.3 regression to assert the actual rotation window, workload distribution, pass/fail thresholds, and stale-secret rejection matrix values.
- [MEDIUM] Corrected the Story 12.3 story record so the changed-file list matches the real git diff, including the shared `tests/edge-gateway/dmz-perimeter-policy.test.js` follow-up.
- [MEDIUM] Replaced the weakened Story 12.2 historical-snapshot follow-up with a live-overlap comparison that still catches drift while tolerating future unrelated changes.
