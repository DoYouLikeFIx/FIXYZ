# FEP Retry Boundary Policy

## Purpose

This runbook defines which FIXYZ FEP operations are allowed to retry, where the retry owner lives, and when unresolved outcomes hand off to follow-on recovery work.

## Source Of Truth

- Scheduler-facing retry budget: `recovery.max-retry-count`
- Status-query micro-retry max attempts: `recovery.status-query.max-attempts` (total calls inside one requery, including the first call)
- Status-query micro-retry backoff: `recovery.status-query.backoff-ms`
- Implementation owner: `BE/corebank-service`

## Operation Matrix

| Operation | Entry point | Owner | Retry policy | Notes |
| --- | --- | --- | --- | --- |
| `submitOrder` | `CorebankOrderService.createFreshOrder -> FepClient.submitOrder` | Corebank BE | No automatic retry | Non-idempotent execution path. A failed submit may mark `externalSyncStatus=FAILED`, but it must not resubmit the outbound order. |
| `queryOrderStatus` | `CorebankOrderService.requeryOrder -> FepClient.queryOrderStatus` | Corebank BE | Bounded automatic retry | Read/reconciliation lane only. Retries stay inside one requery call and use the dedicated status-query settings. |
| Scheduler requery | `GET /internal/v1/orders/{clOrdId}/requery?attemptCount=n` | Recovery scheduler | No loop added in Story 6.2 | Scheduler owns the outer 1-based `attemptCount` budget exposed in the response metadata. |
| Manual replay | Story 6.5 follow-on endpoint | Operations / Recovery | Not implemented here | Manual replay remains a controlled operator workflow and is out of scope for Story 6.2. |

## Retry Eligibility Matrix

| Result or failure | Eligible for status-query micro-retry | Final response semantics |
| --- | --- | --- |
| `FEP_GATEWAY_TIMEOUT` | Yes | If retries are exhausted, keep existing retry metadata contract and return the mapped timeout message. |
| `FEP_GATEWAY_UNAVAILABLE` | Yes | If retries are exhausted, keep existing retry metadata contract and escalate only when the scheduler-facing budget is exhausted. |
| Terminal reject (`REJECTED`) | No | `retriable=false`, `escalationRequired=true`, preserve reject reason. |
| Malformed payload (`MALFORMED`) | No micro-retry | Preserve parse error and use the existing scheduler-facing retry metadata contract. |
| `UNKNOWN` or `PENDING` status response | No micro-retry | Preserve current requery classification and scheduler-facing retry metadata. |
| `FILLED`, `PARTIALLY_FILLED`, `CANCELED` | No | Terminal reconciliation result. `retriable=false`, `escalationRequired=false`. |
| Contract or concurrency failure | No | Surface the existing business error without automatic retry. |

## Boundary Rules

1. Automatic retry is allowed only inside the corebank status-query lane.
2. `FepClient.submitOrder`, channel `CorebankClient`, and channel `OrderExecutionService` must remain free of automatic retry behavior.
3. The response contract for exhausted or unresolved requery outcomes must reuse:
   - `retriable`
   - `escalationRequired`
   - `attemptCount`
   - `maxRetryCount`
4. `attemptCount` remains the outer scheduler-facing counter. Status-query micro-retries do not change its value.
5. If one micro-retry sequence sees multiple retriable failures, the first retriable failure owns the final `message` and `failureReason` semantics.

## Escalation Handoff

- Story 6.4 owns automated scheduler requery orchestration after the per-call retry boundary defined here.
- Story 6.5 owns manual replay tooling and operator-driven recovery.
- Story 9.3 owns channel/session-level recovery reconciliation such as `REQUERYING` and `ESCALATED` alignment.

## Verification Expectations

- Unit tests prove the status-query lane retries only up to `recovery.status-query.max-attempts`.
- Unit and integration tests prove failing submit paths issue only one outbound submit request.
- Integration tests prove `/internal/v1/orders/{clOrdId}/requery` preserves retry metadata after transient failure, retry exhaustion, and non-retriable outcomes.
