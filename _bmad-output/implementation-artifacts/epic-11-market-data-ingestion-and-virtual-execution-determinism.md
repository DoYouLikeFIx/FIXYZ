# Epic 11: Market Data Ingestion & Virtual Execution Determinism

> **⚠️ Epic Numbering Note**: This supplemental file corresponds to **Epic 11 in epics.md: Market Data Ingestion & Virtual Execution Determinism**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.

## Summary

`LIVE/DELAYED/REPLAY` 시장데이터를 단일 계약으로 정규화하고, MARKET 주문의 사전검증/체결근거 추적성을 강화한다.  
`quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`를 API·DB·UX에 일관 적용하고, KIS WebSocket(`H0STCNT0`) provider 계약(approval key, frame parsing, multi-record split, decrypt)을 명시한다.

**FRs covered:** FR-20, FR-55, FR-56  
**NFRs covered:** NFR-D2 (quote freshness bounded staleness)  
**Architecture requirements:** Market data adapter (KIS H0STCNT0), freshness guard, replay controller, MARKET sweep traceability, web/mobile visibility

---

## Story 11.1: [BE][MD] Market Data Source Adapter (LIVE/DELAYED/REPLAY)

As a **market data owner**,  
I want a unified source adapter for LIVE/DELAYED/REPLAY modes,  
So that quote ingestion and downstream valuation use a single contract.

**Depends On:** Story 5.2

### Acceptance Criteria

**Given** configured `LIVE` mode  
**When** KIS WebSocket(`H0STCNT0`) quote events arrive  
**Then** adapter authenticates with `approval_key` and subscribes using `tr_type=1`, `tr_id=H0STCNT0`, `tr_key` contract.

**Given** configured `DELAYED` mode  
**When** quote events are consumed  
**Then** configured delay is applied deterministically and emitted snapshots include `quoteSnapshotId` with `quoteSourceMode=DELAYED`.

**Given** configured `REPLAY` mode  
**When** replay seed and cursor are fixed  
**Then** identical input produces identical quote snapshot sequence (including `quoteSnapshotId`) with `quoteSourceMode=REPLAY`.

**Given** KIS real-time frame `encFlag|trId|count|payload`  
**When** `count>1` 또는 `encFlag=1` frame is received  
**Then** adapter splits multi-record payload by `count`, decrypts encrypted payload via key/iv, and emits normalized snapshots with `quoteSourceMode=LIVE`.

---

## Story 11.2: [BE][MD] Quote Snapshot Freshness Guard

As a **risk owner**,  
I want stale quote rejection rules,  
So that MARKET pre-check and valuation do not run on outdated data.

**Depends On:** Story 11.1

### Acceptance Criteria

**Given** snapshot age within `maxQuoteAgeMs`  
**When** prepare/valuation executes  
**Then** request succeeds with `quoteSnapshotId`, `quoteAsOf`, and `quoteSourceMode`.

**Given** snapshot age exceeds `maxQuoteAgeMs`  
**When** prepare/valuation executes  
**Then** request fails with deterministic stale-quote validation code.

**Given** stale rejection  
**When** audit log written  
**Then** `symbol`, `snapshotAgeMs`, `quoteSourceMode` are recorded.

---

## Story 11.3: [BE][MD] Replay Timeline Controller

As a **test architect**,  
I want replay timeline controls,  
So that CI and scenario demos are deterministic and reproducible.

**Depends On:** Story 11.1

### Acceptance Criteria

**Given** replay start point and speed factor  
**When** replay starts  
**Then** timeline advances deterministically.

**Given** replay pause/resume command  
**When** command is issued  
**Then** cursor and emitted sequence remain consistent.

**Given** identical replay seed  
**When** CI reruns  
**Then** snapshot sequence hash matches baseline.

**Given** LIVE WebSocket disconnect/reconnect event  
**When** session recovers  
**Then** open subscriptions are re-registered deterministically and gap range is backfilled via replay policy.

---

## Story 11.4: [BE][AC] MARKET Order Sweep Matching Validation

As an **execution engine owner**,  
I want explicit MARKET sweep rules validated,  
So that market-order behavior is predictable and auditable.

**Depends On:** Story 5.2, Story 11.2

### Acceptance Criteria

**Given** multi-level opposite book  
**When** MARKET order executes  
**Then** fills are consumed in strict price-time order.

**Given** insufficient liquidity  
**When** MARKET order executes  
**Then** partial fill or no-liquidity reject follows documented policy.

**Given** execution result  
**When** persisted  
**Then** `executedQty`, `executedPrice`, `leavesQty`, `quoteSnapshotId` are traceable.

---

## Story 11.5: [FE/MOB][MD] Quote Freshness & Source Visibility UX

As an **order user**,  
I want to see quote freshness and source mode,  
So that I understand valuation confidence before execution.

**Depends On:** Story 11.2, Story 11.4

### Acceptance Criteria

**Given** valuation area rendering  
**When** quote is fresh  
**Then** UI shows `quoteAsOf` and `quoteSourceMode` badge (`LIVE`/`DELAYED`/`REPLAY`).

**Given** quote is stale  
**When** user attempts MARKET prepare  
**Then** UI blocks progression with actionable stale-data guidance.

**Given** replay mode demo  
**When** screen capture reviewed  
**Then** source-mode visibility is clear in both web and mobile clients.

---

## References

- `_bmad-output/planning-artifacts/epics.md` (Epic 11 canonical)
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/fep-gateway/api-spec.md`
- `_bmad-output/planning-artifacts/fep-gateway/kis-websocket-h0stcnt0-spec.md`
