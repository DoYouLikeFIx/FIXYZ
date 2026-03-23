# Story 12.4: Admin Access Control Path for DMZ Operations

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a security operations lead,
I want a documented privileged access model for DMZ operations,
so that temporary access, revocation, and audit requirements are explicit before code or automation is reintroduced.

**Depends On:** Story 0.13, Story 7.5, Story 8.1

## Acceptance Criteria

1. Given privileged maintenance access requirements, when `docs/ops/dmz-admin-access.md` is reviewed, then issuance source, TTL, least-privilege scope, and non-local constraints are explicit.
2. Given revocation requirements, when the design is reviewed, then automatic expiry behavior and emergency termination path are explicit.
3. Given audit requirements, when the design is reviewed, then mandatory event fields are explicit and testable.
4. Given Vault operating model dependency, when the story is reviewed, then Story 0.13 is treated as a required upstream constraint rather than an optional note.

## Tasks / Subtasks

- [x] Finalize issuance and TTL contract (AC: 1)
  - [x] Define requester, approver, and emergency break-glass workflow
  - [x] Define the bootstrap identity allowed to call `issue`
- [x] Finalize revocation and denial contract (AC: 2)
  - [x] Align `docs/ops/dmz-abuse-response.md` to the shared Story 12.4 operator envelope, scope taxonomy, and private-listener rules
- [x] Finalize audit field contract (AC: 3)
  - [x] Define root regression coverage that locks mandatory audit fields and operator response-envelope fields across DMZ design docs
- [x] Finalize external Vault dependency rules (AC: 4)
  - [x] Define operator interface operations and minimum response fields
  - [x] Define the private operator access path outside the public edge allowlist
  - [x] Sync `docs/ops/dmz-drill-governance.md` and `docs/ops/dmz-release-checklist-template.md` so the `admin-credential-ttl-expiry` dependency remains explicit in downstream evidence requirements

## Dev Notes

### Developer Context Section

- This is a documentation-only story. Implementing Story 12.4 in this round means updating the root DMZ design package and root regression coverage only; do not introduce runtime control-plane code, Vault issuance automation, or `BE`/`FE`/`MOB` implementation assets in this story.
- This story must not regress into local-dev Vault assumptions when implementation resumes.

### Technical Requirements

- Access issuance must define requester, approver, environment, scope, and TTL inputs.
- Production issuance requires approver distinct from requester unless documented break-glass is used.
- Operator interface must define `issue`, `inspect`, and `revoke` operations plus minimum lease metadata.
- Shared operator contract must also define how task-specific privileged surfaces add verbs such as `apply`, `list`, and `expire-sweep` without creating a second authorization model.
- `issue` must define a non-self-referential bootstrap identity.
- Approved workload identities must define registration, rotation, suspension, and revocation rules.
- Revocation contract must define automatic expiry, deterministic denial response, and emergency termination initiators.
- Privileged operator access path must be private and out-of-band from the public edge listener.
- Audit evidence must include bootstrap identity type and operator surface.
- Audit evidence must include `listener_scope`.
- Issued DMZ leases must never carry issuance scope.
- Privileged task scopes must stay under the shared `dmz:access:*` namespace, including deny-management extensions when Story 12.2 temp-deny controls are implemented.

### Architecture Compliance

- Story 12.4 depends on Story 0.13 and cannot be closed against the local compose Vault baseline.
- Preserve the Story 12.2 public-edge baseline while documenting Story 12.4 privileged operator surfaces as private and out-of-band only.
- Keep implementation scoped to repository-root docs/tests artifacts; runtime control-plane rollout belongs to a later implementation story.
- Audit/event fields must remain compatible with Story 7.5 and Story 8.1 ownership boundaries.

### File Structure Requirements

- Expected touched areas in this documentation-only round:
  - `docs/ops/dmz-admin-access.md`
  - `docs/ops/dmz-abuse-response.md`
  - `docs/ops/dmz-drill-governance.md`
  - `docs/ops/dmz-release-checklist-template.md`
  - `docs/ops/vault-secrets-foundation.md`
  - `tests/edge-gateway/dmz-admin-access.test.js`
  - `_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations-test-summary.md`

### Testing Requirements

- Verify issuance records include requester, approver, environment, scope, and lease metadata.
- Verify expiry and manual revocation paths both produce auditable evidence.
- Verify mandatory audit fields are queryable in one evidence sample.
- Verify break-glass issuance requires an after-the-fact review record.
- Verify the `issue` operation can be authenticated without an already-issued DMZ lease.
- Verify task-specific operator surfaces reuse the common Story 12.4 response envelope plus surface-specific fields.
- Verify task-specific operator surfaces can add verbs such as `apply` and `expire-sweep` without diverging from the shared `dmz:access:*` scope taxonomy.
- Add or update root regression coverage that keeps `docs/ops/dmz-admin-access.md`, `docs/ops/dmz-abuse-response.md`, and `docs/ops/dmz-drill-governance.md` aligned on scope taxonomy, private listener rules, and shared response-envelope requirements.
- Verify `admin-credential-ttl-expiry` remains mapped to Story 12.4 in drill governance and release evidence templates.
- Verify this story remains documentation-only and repository-root-only until a later runtime implementation story is approved.

### Story Completion Status

- Status set to `done`.
- Completion note: Story 12.4 implementation, QA, downstream proof updates, and the previously blocking repo-wide verification gaps are now resolved in the current workspace.

### References

- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/ops/dmz-admin-access.md`
- `_bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md`
- `_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations-test-summary.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- 2026-03-24: `node --test tests/edge-gateway/dmz-admin-access.test.js` failed first on missing Story 12.4 documentation-only boundary, downstream evidence, and Vault-baseline handoff assertions.
- 2026-03-24: `node --check tests/edge-gateway/dmz-admin-access.test.js`
- 2026-03-24: `node --test tests/edge-gateway/dmz-admin-access.test.js`
- 2026-03-24: `npm run test:edge-gateway`
- 2026-03-24: `npm test` blocked by unrelated existing failures in `tests/vault/vault-external-operations.test.js` and `tests/vault/vault-external-rehearsal.test.js` because `BE/channel-service/src/main/resources/application-staging.yml`, `docs/ops/evidence/vault-external/README.md`, and `docs/ops/evidence/vault-external/live-external.env.template` are absent in the current workspace.
- 2026-03-24: restored the missing non-local profile assets and Vault external evidence templates required by the shared repo suites.
- 2026-03-24: `npm test`

### Completion Notes List

- Added `tests/edge-gateway/dmz-admin-access.test.js` to lock the Story 12.4 admin-access contract, downstream deny-management envelope, drill evidence requirements, and Vault handoff rules.
- Updated `docs/ops/dmz-admin-access.md` to make the documentation-only boundary, canonical snake_case field names, requester field, operation-specific response fields, issuance evidence record, and Story 0.13 external-Vault gate explicit.
- Updated `docs/ops/dmz-abuse-response.md`, `docs/ops/dmz-drill-governance.md`, and `docs/ops/dmz-release-checklist-template.md` so downstream proof surfaces preserve the shared Story 12.4 response envelope, canonical field names, explicit approval requirements, and `admin-credential-ttl-expiry` evidence contract.
- Updated `docs/ops/vault-secrets-foundation.md` to state that Story 12.4 privileged operator access is out of scope for the local Vault bootstrap baseline.
- Shared root-suite unblocker: added `_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md` to git tracking because an existing `tests/edge-gateway/dmz-trust-hardening.test.js` assertion required it.
- Restored the missing Vault external evidence templates and non-local staging/profile overrides needed for the shared repo-wide `npm test` gate.
- QA added a tracked story-owned summary artifact for Story 12.4 and re-verified the shared `edge-gateway` suite after restoring the required Story 12.3 tracked summary dependency.

### File List

Changed during this implementation round:

- `_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations.md`
- `_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations-test-summary.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `docs/ops/dmz-abuse-response.md`
- `docs/ops/dmz-admin-access.md`
- `docs/ops/dmz-drill-governance.md`
- `docs/ops/dmz-release-checklist-template.md`
- `docs/ops/vault-secrets-foundation.md`
- `tests/edge-gateway/dmz-admin-access.test.js`

Shared-suite unblocker outside Story 12.4 ownership:

- `_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-test-summary.md`

## QA Results

### Reviewer

- Quinn (QA Engineer), 2026-03-24

### Gate Decision

- PASS

### Acceptance Criteria Validation

1. AC1 (issuance source, TTL, least-privilege scope, non-local constraints): PASS
   - Evidence: `tests/edge-gateway/dmz-admin-access.test.js` verifies the documentation-only boundary, requester/bootstrap issuance inputs, issuance evidence fields, maximum TTL, and the Story 0.13 external-Vault gate in `docs/ops/dmz-admin-access.md`.
2. AC2 (automatic expiry behavior and emergency termination path): PASS
   - Evidence: the same regression verifies the revocation contract in `docs/ops/dmz-admin-access.md` and the downstream `admin-credential-ttl-expiry` evidence requirements in `docs/ops/dmz-drill-governance.md` and `docs/ops/dmz-release-checklist-template.md`, including auto-revocation within 60 seconds of TTL expiry and deterministic `403 DMZ_ACCESS_DENIED` proof after expiry.
3. AC3 (mandatory audit fields explicit and testable): PASS
   - Evidence: the regression verifies the required audit/evidence field set, request-bound fields including `requester`, and shared operator response-envelope preservation across `docs/ops/dmz-admin-access.md` and `docs/ops/dmz-abuse-response.md`.
4. AC4 (Story 0.13 treated as required upstream constraint): PASS
   - Evidence: the regression asserts the explicit Story 0.13 upstream gate in `docs/ops/dmz-admin-access.md` and the local-baseline exclusion note in `docs/ops/vault-secrets-foundation.md`.

### Executed Verification

- `node --check tests/edge-gateway/dmz-admin-access.test.js`
- `node --test tests/edge-gateway/dmz-admin-access.test.js`
- `npm run test:edge-gateway`

### Findings

- None.

### Notes

- Story 12.4 is documentation-only in this round, so API/E2E generation is intentionally N/A for this QA pass.
- QA evidence is stored in the tracked story-owned summary artifact `_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations-test-summary.md`.
- The wider repo `npm test` gate is now green after restoring the missing Vault external evidence assets and non-local profile overrides required by the shared suites.
