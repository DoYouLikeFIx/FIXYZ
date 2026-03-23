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

- This story is documentation-complete but intentionally unimplemented in code.
- Story 0.7 remains the only active ingress/runtime baseline.

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

- Expected touched areas when implementation resumes:
  - `/Users/yeongjae/fixyz/docker-compose.dmz.yml` when Compose is the reviewed runtime surface
  - `/Users/yeongjae/fixyz/docs/ops/dmz-network-mapping.md`
  - `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/architecture.md`
  - `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`

### Testing Requirements

- Verify active baseline host exposure inventory against `docker-compose.yml`.
- Verify active baseline edge-visible exception routes against `docker/nginx/templates/fixyz-edge.conf.template`.
- Verify the future DMZ runtime specification removes direct host exposure from `channel-service`.
- Verify every service is mapped to a documented review zone and architecture lane.
- Verify rollback instructions restore the Story 0.7 baseline without undocumented side effects.

### Story Completion Status

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

### Completion Notes List

- Story documentation created after removing repository-local Epic 12 runtime assets.
- 2026-03-24: Closed the documentation review by correcting baseline inventory scope, explicit allowed flows, lane-collapse decisions, runtime artifact naming, and rollback triggers.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-1-dmz-network-segmentation-profile.md
