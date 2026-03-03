# Read Routing Consistency Inventory

This document defines primary-only allowlist entries and stale-read risk scenarios for the HA replication baseline.

## Primary-only allowlist (strong consistency)

| Endpoint / operation | Why primary-only | Stale-read risk scenario |
| --- | --- | --- |
| `order session transition` | state-machine transition must read latest lock/version state | transition decision uses replica lagged state and accepts invalid transition |
| `order execute` | execution/idempotency must observe latest commit and balance mutation | duplicate execute or wrong rejection due to replica lag |
| `admin force session invalidation` | security/admin action must apply immediately | stale replica permits session action after forced invalidation |

## Replica-eligible reads (eventual consistency)

| Endpoint class | Replica policy | Guardrail |
| --- | --- | --- |
| Low-risk dashboards | replica allowed when lag below warning threshold | if lag >= 5s, route back to primary |
| Historical reporting | replica preferred | enforce timestamp watermark in response metadata |

## Stale-read validation matrix

stale-read risk scenarios to validate before enabling production read-routing:

1. Inject lag and verify `order session transition` remains pinned to primary.
2. Inject lag and verify `order execute` remains pinned to primary.
3. Inject lag and verify `admin force session invalidation` remains pinned to primary.
4. Verify replica-eligible dashboards auto-fallback to primary when warning threshold is crossed.
