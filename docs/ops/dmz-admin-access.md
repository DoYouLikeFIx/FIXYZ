# DMZ Admin Access Design

## Status

This document is planning-only. No Epic 12 DMZ administration access path is currently active in this repository.

## Purpose

Define the intended Story 12.4 contract for privileged DMZ operations.

## Dependencies

- Story 0.13 for external Vault operations and non-local guardrails
- Story 7.5 for admin session and audit API contracts
- Story 8.1 for audit/security event schema ownership

## Access Issuance Contract

- Credential source: Vault-issued short-lived credentials
- Maximum TTL: 30 minutes
- Scope: least privilege for the maintenance task requested
- Ownership: operator-issued or approved automation; never anonymous or long-lived shared credentials
- Non-local environments must not depend on local `vault` or `vault-init` containers

## Operator Surface Policy

- The Story 12.4 operator surface is out-of-band from the public edge allowlist.
- Public edge must continue denying `/api/v1/admin/` and `/ops/dmz/*` on the `public-edge` listener.
- If an HTTP control plane is introduced, it must live on a private admin surface such as `/ops/dmz/*` on the `private-ops` listener, private ingress, VPN-only endpoint, or equivalent non-public access path.
- Non-HTTP control planes (Vault API, CLI wrapper, or approved automation) are acceptable only when they satisfy the same audit and authorization contract.

## Bootstrap Workload Identity Governance

- Approved automation or CI workload identities that can call `issue` must be registered in a reviewed identity inventory owned by `SEC`.
- Each workload identity record must include owner, environment, intended scopes, rotation cadence, and emergency suspension path.
- Workload identity credentials must rotate on a documented schedule and be revocable independently from issued DMZ leases.
- Suspended or revoked workload identities must immediately lose `issue` capability without waiting for existing DMZ leases to expire.

## Issuance Workflow

1. Requester submits:
   - ticket id
   - reason
   - requested scope
   - requested TTL
   - target environment
2. An approver distinct from the requester must approve production access. Emergency break-glass is allowed only with after-the-fact review recorded within 24 hours.
3. The bootstrap identity allowed to call `issue` must be one of:
   - a human `SEC` operator authenticated through the existing Story 7.5 admin control surface
   - approved automation or CI authenticated with a reviewed workload identity
4. The operator interface issues a credential lease and returns:
   - `lease_id`
   - `issued_at`
   - `expires_at`
   - `approved_by`
   - `environment`
   - `scope`
5. The issued credential must be bound to the approved scope only.

## Revocation Contract

- Automatic revocation target: within 60 seconds of TTL expiry
- Manual revocation path must exist for emergency termination
- Expired or revoked credentials must be denied deterministically with `403 DMZ_ACCESS_DENIED`
- Manual revocation may be initiated by the current lease holder, an on-call security operator, or approved automation acting on behalf of `SEC`

## Mandatory Audit Fields

Every privileged action must record:

- actor
- action
- target
- timestamp
- correlation-id
- reason
- ticket-id
- source IP or trusted client identity
- credential lease/reference id
- approved-by
- environment
- bootstrap identity type
- operator surface
- listener_scope

## Operator Interface Contract

- Authentication by operation:
  - `issue`: existing Story 7.5 `SEC` admin identity or approved workload identity
  - `inspect` and `revoke`: issuer bootstrap identity, current lease holder identity, or Vault-issued short-lived credential from the approved lease
- Authorization uses the shared `dmz:access:*` namespace:
  - base scopes: `dmz:access:issue`, `dmz:access:inspect`, `dmz:access:revoke`
  - task-scoped operator extensions when needed: `dmz:access:deny:read`, `dmz:access:deny:write`
- `issue` uses the bootstrap identity above and must not require a previously issued DMZ lease.
- `inspect` and `revoke` may be executed by the issuer, the current lease holder, or approved automation within scope.
- Scope separation rules:
  - bootstrap identities may hold `dmz:access:issue`
  - issued DMZ leases must never carry `dmz:access:issue`
  - issued DMZ leases may carry only task-scoped `inspect`, `revoke`, `deny:read`, and `deny:write` capabilities needed for the approved maintenance window
- Required operation families:
  - lease lifecycle: `issue`, `inspect`, `revoke`
  - task-specific privileged controls must declare their own verbs while inheriting this contract; Story 12.2 deny management uses `apply`, `list`, `revoke`, and `expire-sweep`
- Common response envelope fields for every privileged operator response:
  - `status`
  - `actor`
  - `environment`
  - `scope`
  - `bootstrap_identity_type`
  - `listener_scope`
- Request-bound fields when the operation required them:
  - `ticket_id`
  - `approved_by`
- Time-bounded record fields when the operation creates, returns, or mutates a time-bounded record:
  - `issued_at`
  - `expires_at`
- Operation-specific minimum fields:
  - `issue`:
    - `lease_id`
  - task-specific control surfaces (for example deny management):
    - surface-specific record id such as `deny_record_id`
    - target selector such as `target`
    - source selector provenance such as `source_identity_origin`
    - collection or batch operations may add operation metadata such as `record_count`, `sweep_started_at`, or `expired_record_count` instead of a single record identifier

## Evidence Requirements

- issuance record
- revocation or expiry confirmation
- audit query sample proving mandatory fields
- runbook or control-plane reference for operator flow
- approval record or emergency-review record
- bootstrap identity record
- any task-specific operator surface must prove it uses the common response envelope above plus its surface-specific fields

## Implementation Notes

- Story 12.4 cannot be treated as done against the local dev Vault baseline.
- Any future implementation must reference Story 0.13 controls in the same change.
