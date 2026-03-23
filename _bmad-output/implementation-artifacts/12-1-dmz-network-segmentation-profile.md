# Story 12.1: DMZ Network Segmentation Profile

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform security owner,
I want an explicit DMZ network segmentation design,
so that public ingress, channel traffic, and private dependencies are isolated by design before code is reintroduced.

**Depends On:** Story 0.7, Story 0.9, Story 0.13

## Acceptance Criteria

1. Given the active Story 0.7 baseline, when `docs/ops/dmz-network-mapping.md` is reviewed, then current host exposure, services without direct host ports, and current edge-visible baseline exceptions are explicitly documented.
2. Given the target Epic 12 topology, when the design is reviewed, then edge/application/core-private zones, allowed flows, and owner services are explicitly documented.
3. Given future implementation planning, when the story is reviewed, then the required future runtime artifact type, default compose filename if Compose is used, verification points, and rollback triggers are documented.
4. Given architecture lane mapping, when the design is reviewed, then any lane split or lane collapse decisions are explicit instead of implied by deployment config.

## Tasks / Subtasks

- [x] Finalize current baseline exposure inventory (AC: 1)
  - [x] Record `edge-gateway:80/443` as the intended ingress contract and `channel-service:8080` as local/dev convenience exposure
  - [x] Record every current edge-visible baseline exception route, not just host ports
- [x] Finalize target zone membership and allowed flows (AC: 2)
  - [x] Reconcile 3-zone Epic 12 view with the 4-lane architecture model using only canonical lane names
- [x] Define future implementation artifact and rollback expectations (AC: 3)
  - [x] Define the repository-owned runtime specification type and the default compose filename only if Compose is used
- [x] Reconcile architecture lane mapping decisions (AC: 4)
  - [x] Record Story 0.13 impact for non-local Vault boundaries

## Dev Notes

### Developer Context Section

- This is a documentation-only story. Implementing Story 12.1 means updating the design package and planning references, not reintroducing runtime code in this change.
- Story 0.7 remains the only active ingress/runtime baseline until a separate reviewed Epic 12 runtime change is approved.

### Technical Requirements

- Repository-owned future runtime specification must be explicit; `docker-compose.dmz.yml` is only the default if Compose is the chosen runtime surface
- Public ingress contract in hardened mode: `edge-gateway` only
- Current local/dev baseline exception: direct `channel-service:8080` host exposure remains documented until Story 12 implementation replaces it
- Current local/dev baseline exception inventory must also include edge-visible internal health/API proxy paths
- Canonical lane reconciliation:
  - review zones: `edge`, `application`, `core-private`
  - architecture lanes: `external-net`, `core-net`, `gateway-net`, `fep-net`
- Non-local Vault boundary must reference Story 0.13 instead of assuming local `vault`/`vault-init`

### Architecture Compliance

- Keep Story 0.7 as the active runtime baseline until a reviewed Epic 12 runtime change lands.
- Do not hide lane collapse or zone membership inside deployment config without matching document updates.

### File Structure Requirements

- Current Story 12.1 implementation scope:
  - `/Users/yeongjae/fixyz/docs/ops/dmz-network-mapping.md`
  - `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-1-dmz-network-segmentation-profile.md`
- Reference-only validation inputs for this story:
  - `/Users/yeongjae/fixyz/docker-compose.yml`
  - `/Users/yeongjae/fixyz/docker/nginx/templates/fixyz-edge.conf.template`
- Explicitly out of scope for Story 12.1:
  - `/Users/yeongjae/fixyz/docker-compose.dmz.yml` or any newly introduced Epic 12 runtime asset in the repository root until a later reviewed runtime change reintroduces it

### Testing Requirements

- Verify active baseline host exposure inventory against `docker-compose.yml`.
- Verify active baseline edge-visible exception routes against `docker/nginx/templates/fixyz-edge.conf.template`.
- Verify the future DMZ runtime specification removes direct host exposure from `channel-service`.
- Verify every service is mapped to a documented review zone and architecture lane.
- Verify rollback instructions restore the Story 0.7 baseline without undocumented side effects.

### Readiness Status

- Status set to `done`.
- Completion note: Story 12.1 documentation, review follow-up fixes, and second-pass adversarial verification are complete.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-network-mapping.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `node --test tests/edge-gateway/dmz-network-segmentation.test.js` (RED: 2 fail -> GREEN: 3 pass)
- `node --check tests/edge-gateway/dmz-network-segmentation.test.js`
- `npm.cmd run lint:edge-gateway`
- `npm.cmd run test:edge-gateway`
- `npm.cmd test` (fails in pre-existing Vault suites because `.github/scripts/vault/resolve-internal-secret.sh` and `scripts/vault/run-external-cutover-rehearsal.sh` are missing from the current workspace; unrelated to Story 12.1 changes)

### Completion Notes List

- Updated `docs/ops/dmz-network-mapping.md` with explicit lane non-collapse guidance, future runtime artifact wording, and concrete rollback triggers for DMZ rollout review.
- Added Story 12.1 canonical DMZ guardrail notes to `architecture.md` and `prd.md` so the future lane model stays explicit even while Story 0.7 remains the active baseline.
- Added `tests/edge-gateway/dmz-network-segmentation.test.js` to regression-protect the DMZ design package against compose/nginx drift.
- Verified targeted DMZ/edge regression checks pass; full repository `npm.cmd test` remains blocked by unrelated missing Vault rehearsal assets in the current workspace.
- Story documentation created after removing repository-local Epic 12 runtime assets.
- 2026-03-24: Closed the documentation review by correcting baseline inventory scope, explicit allowed flows, lane-collapse decisions, runtime artifact naming, and rollback triggers.

### File List

- _bmad-output/implementation-artifacts/12-1-dmz-network-segmentation-profile.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/planning-artifacts/architecture.md
- _bmad-output/planning-artifacts/prd.md
- docs/ops/dmz-network-mapping.md
- tests/edge-gateway/dmz-network-segmentation.test.js

### Change Log

- 2026-03-23: Implemented Story 12.1 DMZ documentation package, added regression coverage for DMZ mapping drift, and moved the story to review.

## QA Results

### Reviewer

- Quinn (QA Engineer), 2026-03-23

### Gate Decision

- PASS

### Acceptance Criteria Validation

1. AC1 (active baseline exposure + edge-visible exceptions): PASS
   - Evidence: `tests/edge-gateway/dmz-network-segmentation.test.js` verifies `channel-service:8080` and `edge-gateway:80/443` host exposure against the correct service blocks in `docker-compose.yml`, asserts no direct host ports on documented private services, and checks the baseline exception inventory against `docker/nginx/templates/fixyz-edge.conf.template`.
2. AC2 (target zones + allowed flows): PASS
   - Evidence: the same DMZ regression suite verifies the explicit `edge`, `application`, and `core-private` design package sections and their allowed-flow descriptions in `docs/ops/dmz-network-mapping.md`.
3. AC3 (future runtime artifact, verification points, rollback triggers): PASS
   - Evidence: `docs/ops/dmz-network-mapping.md` documents the future repository-owned runtime specification expectation, verification checklist, and concrete rollback triggers; the regression suite asserts those sections remain present.
4. AC4 (explicit lane split/collapse decisions): PASS
   - Evidence: the DMZ regression suite verifies lane reconciliation remains explicit in `docs/ops/dmz-network-mapping.md` and that `_bmad-output/planning-artifacts/architecture.md` plus `_bmad-output/planning-artifacts/prd.md` continue to record Story 12.1 as the canonical lane-governance package without binding to brittle exact prose.

### Executed Verification

- `node --check tests/edge-gateway/dmz-network-segmentation.test.js`
- `npm.cmd run lint:edge-gateway`
- `npm.cmd run test:edge-gateway`

### Findings

- None.

### Notes

- Story 12.1 is a documentation-only implementation, so QA scope in this round is design-package regression protection rather than API/E2E expansion.
- No new UI workflow or runtime DMZ asset was introduced in this story; therefore API/E2E generation is intentionally N/A for this QA pass.
- The Story 12.1 regression test was hardened during QA so service ownership of host ports is validated directly and planning-artifact checks are resilient to harmless wording churn.
