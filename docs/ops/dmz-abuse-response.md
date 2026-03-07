# DMZ Abuse Response Procedure

## Status

This is a runbook design for future Epic 12 implementation. No repository-local denylist command or DMZ abuse automation is currently active.

## Trigger

Use this procedure when edge-layer perimeter evidence shows the same `source_identity` triggered 5 or more edge rate-limit violations within 5 minutes.

Application-layer throttle note:

- If the triggering evidence is `enforcement_layer=application` and keyed by `user_id`, `session_id`, or `order_session_id`, do not automatically mint a DMZ temporary deny.
- Application-layer incidents must stay in application ownership unless a separately reviewed mapping rule converts that incident into a perimeter `source_identity` decision in the same change.

## Source Identity

- Use trusted client identity derived by the perimeter policy:
  - `X-Forwarded-For` only when source proxy is trusted
  - otherwise `remote_addr`

## Response Workflow

1. Record the incident window, request-id samples, suspected client identity, and analyst/operator owner.
   Record whether the triggering control was edge-layer perimeter enforcement or an upstream application limit.
2. Apply a temporary 10-minute deny through the private Story 12.4 operator interface only when the trigger remains an edge/perimeter `source_identity` event. The operator interface may be exposed as CLI or API, but it must implement the same audited contract and accept:
   - source identity
   - TTL in seconds
   - reason code
   - ticket id
   - idempotency key
3. Emit a security event with:
   - actor
   - action (`DMZ_TEMP_DENY_APPLY`)
   - target
   - timestamp (UTC)
   - source identity
   - reason
   - ticket-id
   - correlation-id
   - credential lease/reference id
   - approved-by
   - environment
   - bootstrap identity type
   - operator surface
   - listener_scope
   - enforcement_layer
   - limit_key_type
4. Confirm that the temporary deny is observable through the same operator interface or a read-only audit view.
5. Confirm automatic expiry at TTL completion and capture the post-expiry verification result.

## Operator Interface Contract

- Authentication: short-lived privileged credential issued through Story 12.4 controls
- Authorization: operator must hold the shared Story 12.4 task scopes `dmz:access:deny:read` and `dmz:access:deny:write`
- Required operations:
  - `apply`
  - `list`
  - `revoke`
  - `expire-sweep`
- `apply` idempotency rule:
  - duplicate requests with the same `(target, reason, ticket-id, idempotency-key)` tuple must return the existing deny record instead of creating a second record
- This deny-management surface is a task-specific Story 12.4 control plane and must return the common privileged operator response envelope from `docs/ops/dmz-admin-access.md`.
- Additional deny-management response fields:
  - `deny_record_id`
  - `target`
  - `source_identity_origin`
  - `enforcement_layer`
  - `reason`
  - `ttl_seconds`
  - `record_count` or `expired_record_count` when the operation is collection- or sweep-oriented

## Evidence Contract

- Store procedure evidence under `docs/ops/evidence/dmz/<YYYYMMDD>/`.
- Include:
  - deny action record
  - verification record
  - expiry confirmation record
  - summary index update
  - full privileged-action audit fields from `docs/ops/dmz-admin-access.md` and the Response Workflow security event schema above, including `credential lease/reference id`, `approved-by`, `environment`, `bootstrap identity type`, `operator surface`, and `listener_scope`
  - `enforcement_layer`
  - `limit_key_type`
  - `source_identity`
  - `source_identity_origin`

## Implementation Expectations

- Future code must expose a repeatable operator interface for apply/list/expire operations.
- The operator interface must not require direct container access assumptions in the documentation.
- The runtime contract for temporary deny responses remains defined in `docs/ops/dmz-route-policy.md`.
- Emergency manual revocation must be available to the same operator scope and recorded with a separate audit event.
- Edge-generated abuse controls must emit the same `enforcement_layer` and `limit_key_type` fields into structured evidence so edge and application throttles can be distinguished after the fact.
- `listener_scope` for this operator surface must remain the private Story 12.4 control-plane surface rather than `public-edge`.
