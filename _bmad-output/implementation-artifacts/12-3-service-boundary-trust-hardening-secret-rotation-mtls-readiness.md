# Story 12.3: Service Boundary Trust Hardening (Secret Rotation + mTLS Readiness)

Status: ready-for-dev

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

- [ ] Finalize rotation contract and stale-secret behavior (AC: 1)
  - [ ] Define service-pair rejection matrix with status code, machine code, and required evidence fields
- [ ] Finalize reproducible validation contract (AC: 2)
  - [ ] Lock the 500-request workload profile and numerator/denominator calculation rule
- [ ] Finalize mTLS readiness outputs and non-goals (AC: 3)
- [ ] Finalize Vault dependency mapping to Story 0.13 (AC: 4)
  - [ ] Define non-local Vault and local-dev behavior split explicitly

## Dev Notes

### Developer Context Section

- This story is design-complete and intentionally unimplemented in repository code.

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
- mTLS readiness output must include one ADR and the fixed `channel-service -> corebank-service` proof of concept.

### Architecture Compliance

- Preserve Story 0.8 secret-management baseline and Story 0.13 external Vault constraints.
- Do not expand this story into full production mTLS rollout.

### File Structure Requirements

- Expected touched areas when implementation resumes:
  - `/Users/yeongjae/fixyz/docs/ops/dmz-trust-hardening.md`
  - `/Users/yeongjae/fixyz/docs/ops/adr/**`
  - `/Users/yeongjae/fixyz/tests/**`
  - `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md`

### Testing Requirements

- Verify the fixed workload profile and availability formula are reproducible.
- Verify stale-secret rejection samples exist for every in-scope service pair.
- Verify rotation evidence includes start time, success time, and excluded negative probes.
- Verify mTLS ADR and the `channel-service -> corebank-service` PoC outputs are linked in story evidence.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story 12.3 now includes explicit workload, measurement, and stale-secret rejection contracts.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-trust-hardening.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Completion Notes List

- Story documentation created after removing repository-local Epic 12 runtime assets.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-3-service-boundary-trust-hardening-secret-rotation-mtls-readiness.md
