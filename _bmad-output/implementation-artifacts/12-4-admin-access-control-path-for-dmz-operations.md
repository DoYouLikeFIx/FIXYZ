# Story 12.4: Admin Access Control Path for DMZ Operations

Status: ready-for-dev

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

- [ ] Finalize issuance and TTL contract (AC: 1)
  - [ ] Define requester, approver, and emergency break-glass workflow
  - [ ] Define the bootstrap identity allowed to call `issue`
- [ ] Finalize revocation and denial contract (AC: 2)
- [ ] Finalize audit field contract (AC: 3)
- [ ] Finalize external Vault dependency rules (AC: 4)
  - [ ] Define operator interface operations and minimum response fields
  - [ ] Define the private operator access path outside the public edge allowlist

## Dev Notes

### Developer Context Section

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
- Audit/event fields must remain compatible with Story 7.5 and Story 8.1 ownership boundaries.

### File Structure Requirements

- Expected touched areas when implementation resumes:
  - `/Users/yeongjae/fixyz/docs/ops/dmz-admin-access.md`
  - `/Users/yeongjae/fixyz/docs/ops/vault-secrets-foundation.md`
  - `/Users/yeongjae/fixyz/docs/ops/**`
  - `/Users/yeongjae/fixyz/tests/**`

### Testing Requirements

- Verify issuance records include requester, approver, environment, scope, and lease metadata.
- Verify expiry and manual revocation paths both produce auditable evidence.
- Verify mandatory audit fields are queryable in one evidence sample.
- Verify break-glass issuance requires an after-the-fact review record.
- Verify the `issue` operation can be authenticated without an already-issued DMZ lease.
- Verify task-specific operator surfaces reuse the common Story 12.4 response envelope plus surface-specific fields.
- Verify task-specific operator surfaces can add verbs such as `apply` and `expire-sweep` without diverging from the shared `dmz:access:*` scope taxonomy.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Story 12.4 now includes approval, interface, and evidence requirements.

### References

- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/prd.md`
- `/Users/yeongjae/fixyz/docs/ops/dmz-admin-access.md`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-13-vault-production-separation-and-external-operations.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Completion Notes List

- Story documentation created after removing repository-local Epic 12 runtime assets.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/12-4-admin-access-control-path-for-dmz-operations.md
