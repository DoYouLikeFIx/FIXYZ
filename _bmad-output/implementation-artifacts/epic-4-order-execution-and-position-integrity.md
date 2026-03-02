# Epic 4: Order Execution & Position Integrity

> **⚠️ Epic Numbering Note**: This supplemental file was numbered from the securities-order domain and corresponds to **Epic 5 in epics.md: Account Ledger, Limits, Idempotency, Concurrency**. The canonical story authority is always `_bmad-output/planning-artifacts/epics.md`.


## Summary

An AUTHED order session executes via Order Book matching, atomically producing `order_executions` records and mutating `positions` within a single `@Transactional` boundary. Under 10-thread concurrent sell pressure on a 500-share position, exactly 5 FILLED and 5 OrderSession FAILED (ORD-003 — SELL qty validation before INSERT; no order inserted for failures). Duplicate requests are handled idempotently via `clOrdID`. On FEP failure, a compensating position reversal is executed. Scenarios #1, #2, #4, #7 pass.

**FRs covered:** FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-43, FR-44, FR-48, FR-54  
**Architecture requirements:** OrderService.execute() (@Lock PESSIMISTIC_WRITE on positions row, Order Book matching, order_executions + positions atomic update), clOrdID (UNIQUE INDEX), OrderSessionRecoveryService (@Scheduled), PositionRepositoryImpl (QueryDSL daily sell limit re-validation)  
**Frontend:** OrderConfirm.tsx, OrderProcessing.tsx, OrderResult.tsx

---

## Story 4.1: Order Execution & Position Integrity

As a **system**,  
I want order execution to atomically place orders into the Order Book, produce `order_executions` records, and update `positions` within a single transaction,  
So that position integrity is always maintained and no order results in an over-sell.

**Depends On:** Story 2.2 (AUTHED session), Story 3.1 (FEP integration)

### Acceptance Criteria

**Given** `POST /api/v1/orders/sessions/{sessionId}/execute` (session status: `AUTHED`)  
**When** `OrderSessionService.execute()` called  
**Then** Redis `SET ch:txn-lock:{sessionId} NX EX 30` executed atomically  
**And** lock acquisition failure (concurrent request) → HTTP 409 `{ code: "CORE-003", message: "Order already being processed." }`  
**And** session status changed to `EXECUTING`

**Given** `OrderService.execute()` execution path  
**When** `@Transactional(timeout=25)` transaction starts  
**Then** `positionRepository.findByAccountAndSymbolWithLock(accountId, symbol)` → InnoDB `SELECT FOR UPDATE` on `positions` row for the symbol (ADR-001)  
**And** BUY: real-time cash re-validated — `cash < qty × price` → `OrderSession FAILED` + HTTP 422 `{ code: "ORD-001", message: "Insufficient cash." }`  
**And** SELL: `available_qty < qty` → `OrderSession FAILED` + HTTP 422 `{ code: "ORD-003", message: "Insufficient position qty." }`  
**And** SELL: daily sell limit re-validated after lock acquired (TOCTOU defense):
  - QueryDSL re-query: `SELECT SUM(executed_qty) FROM order_executions WHERE account_id=X AND symbol=Y AND side=SELL AND created_at >= today`
  - `todaySold + qty > Account.dailySellLimit` → `OrderSession FAILED` + HTTP 422 `{ code: "ORD-002", remainingQty: N }` (FR-47)
  - No position changes or executions recorded (no compensating transaction needed)

**Given** validation passes within `@Transactional`  
**When** Order Book matching runs  
**Then** `INSERT orders (status=NEW, symbol, side, qty, price, clOrdID, accountId, createdAt)`  
**And** Order Book matching runs synchronously — buy orders matched against lowest available ask; sell orders matched against highest available bid (price-time priority)  
**And** Match found → `INSERT order_executions (order_id, executed_qty, executed_price, side, symbol, account_id, created_at)` (FR-21)  
**And** `UPDATE positions SET quantity = quantity + executedQty` (BUY) or `quantity = quantity - executedQty` (SELL), `avg_price` recalculated  
**And** `UPDATE orders SET status = FILLED` (full fill) or `PARTIALLY_FILLED` (partial fill)  
**And** No match found → order remains `NEW`, sits in Order Book (no execution record yet)

**Given** matched order ready for FEP  
**When** FEP Gateway called after local DB commit  
**Then** `POST /fep/v1/orders` with FIX 4.2 `NewOrderSingle(35=D)` fields: `ClOrdID=clOrdID`, `Symbol=symbol`, `Side=side`, `OrderQty=qty`, `Price=price`  
**And** FEP **HTTP 200 + `status: "ACCEPTED"`** → `OrderSession COMPLETED`, `orderId` generated  
**And** HTTP 200: `{ sessionId, status: "COMPLETED", orderId, executedQty, executedPrice, positionQty }` (FR-48, FR-25)

**Given** FEP failure path (timeout / HTTP 5xx — Circuit Breaker not yet OPEN)
**When** FEP **HTTP 5xx / read timeout**
**Then** Compensating position reversal in new `@Transactional`: `UPDATE positions SET quantity = quantity - executedQty` (BUY reversal) or `quantity = quantity + executedQty` (SELL reversal)
**And** `UPDATE orders SET status = FAILED, sub_status = COMPENSATED`
**And** `OrderSession FAILED`
**And** HTTP 504 `{ code: "FEP-001", reason: "FEP_TIMEOUT" }` (FR-54)

**Given** FEP Circuit Breaker OPEN (RC=9098)
**When** CB state = OPEN — fallback fires immediately (no FEP call made)
**Then** HTTP 503 `{ code: "FEP-003", reason: "CIRCUIT_OPEN" }` (FR-54)
**And** No position change (order was never submitted to FEP)
**And** `OrderSession FAILED`

**Given** FEP `REJECTED` response (`MsgType=j`)  
**When** FEP **HTTP 200 + `status: "REJECTED"`**  
**Then** Compensating position reversal executed  
**And** `UPDATE orders SET status = FAILED, sub_status = COMPENSATED`  
**And** `OrderSession FAILED` + HTTP 422 `{ code: "FEP-002", reason: "REJECTED_BY_FEP" }`

**Given** DB error during execution (transaction rollback)
**When** exception occurs inside `@Transactional`
**Then** `order_executions` insert and `positions` update both rolled back atomically (FR-44)
**And** `OrderSession FAILED`
**And** HTTP 500 `{ code: "CORE-004", reason: "TRANSACTION_ROLLBACK" }` (FR-54)

**Given** position integrity verification (`PositionIntegrityIntegrationTest` — Scenario #7)  
**When** N orders executed and verified  
**Then** `SUM(order_executions.executed_qty WHERE side='BUY') − SUM(order_executions.executed_qty WHERE side='SELL') == positions.quantity` per symbol (NFR-D1)

**Given** `SELECT FOR UPDATE` lock time measurement  
**When** single order executed  
**Then** lock hold time ≤ 100ms (NFR-P5)

**Given** `PositionConcurrencyIntegrationTest` (Testcontainers MySQL — Scenario #2)
**When** 10 threads simultaneous sell via `CountDownLatch` (500-share position for symbol 005930, each thread sells 100qty)
**Then** exactly 5 FILLED, 5 OrderSession FAILED (HTTP 422 ORD-003 Insufficient position qty — validation before INSERT; no order record created)
**And** `positions.quantity == 0` after all threads complete (no over-sell)
**And** Real InnoDB via `MySQLContainer("mysql:8.0")` — H2 does not implement `SELECT FOR UPDATE` equivalently
**And** Apply `@Timeout(20)` JUnit 5 annotation on the test method (NFR-T6 CI deadline; 20s accounts for 2-core CI runner overhead)

**Given** `DailyLimitConcurrencyIntegrationTest` (Testcontainers MySQL)
**When** 2 threads execute SELL concurrently via `CountDownLatch` (each 300qty, daily limit 500qty)
**Then** exactly 1 succeeds (COMPLETED) + 1 fails (ORD-002 Daily sell limit exceeded, HTTP 422)
**And** position of failed session remains unchanged

---

## Story 4.2: Idempotency & Duplicate Order Protection

As a **system**,  
I want duplicate execute requests to return the original result without re-executing the order,  
So that network retries and double-submission never cause duplicate fills.

**Depends On:** Story 4.1

### Acceptance Criteria

**Given** re-request `POST /api/v1/orders/sessions/{sessionId}/execute` with `COMPLETED` session ID  
**When** session status check  
**Then** HTTP 409 `{ code: "ORD-006", message: "Order session already completed.", orderId: "<original>", executedQty: N, executedPrice: N, positionQty: N }` (execution snapshot included in body for UX context; no re-execution, FR-22, TC-ORD-05)  
**And** `executedQty`, `executedPrice`, `positionQty` retrieved from `OrderSession.executionSnapshot` column — not re-queried from live positions

**Given** re-request with `FAILED` session ID  
**When** session status check  
**Then** HTTP 409 `{ code: "ORD-006", message: "Order session failed. Please start a new order." }`

**Given** re-request with `EXECUTING` session ID (concurrent request)  
**When** `ch:txn-lock:{sessionId}` NX failure  
**Then** HTTP 409 `{ code: "CORE-003" }` (prevent duplicate execution)

**Given** execute request with `EXECUTING` session where `ch:txn-lock:{sessionId}` has expired (NX EX 30 elapsed, Recovery not yet run)
**When** lock key absent but session still shows `EXECUTING` in DB
**Then** HTTP 409 `{ code: "ORD-005", message: "Order execution in progress. Please wait for recovery resolution." }`

**Given** execute request with `PENDING_NEW` session (OTP step not yet completed)
**When** session status check
**Then** HTTP 409 `{ code: "ORD-005", message: "OTP step not completed. Please verify your TOTP code first." }` (TC-ORD-04)

**Given** execute request with session TTL expired (`EXPIRED` or Redis key missing)
**When** session lookup returns no key
**Then** HTTP 404 `{ code: "ORD-005", message: "Order session not found." }` (TC-ORD-06)

**Given** `IdempotencyIntegrationTest` (Testcontainers MySQL — Scenario #4)  
**When** execute called simultaneously 2 times for same session (using `CountDownLatch`)  
**Then** exactly 1 actual order execution, position change reflected only once  
**And** both responses return identical `orderId`

---

## Story 4.3: Order Session Recovery Service

As a **system**,  
I want stuck `EXECUTING` sessions to be automatically recovered after timeout,  
So that transient failures during execution never leave positions in an inconsistent state.

**Depends On:** Story 4.1

### Acceptance Criteria

**Given** `OrderSessionRecoveryService` (`@Scheduled(fixedDelay = 60000)`)
**When** scheduler runs
**Then** finds sessions in `EXECUTING` status with `updatedAt` older than 30 seconds
**And** also finds sessions in `PENDING_NEW` or `AUTHED` status with `createdAt` older than 600 seconds
  - for each: verify Redis key `ch:order-session:{sessionId}` missing → update DB status to `EXPIRED` (no position change — position was never touched before AUTHED)
**And** for each session, retrieve the associated `orders` record by `clOrdID`  
**And** `orders` record not found → order was never inserted → session `FAILED` (no position change needed)  
**And** `orders.status == NEW` (inserted but Order Book not matched, FEP not called) → session `FAILED`, cancel order (no position was touched)  
**And** `orders.status == FILLED` (order_executions + positions already updated atomically) → **Re-query FEP status** `GET /fep/v1/orders/{clOrdID}/status`:  
  - FEP `ACCEPTED` → session `COMPLETED` (positions already correct — no additional update needed)  
  - FEP `REJECTED` / `UNKNOWN` / HTTP 5xx → compensating position reversal in new `@Transactional` + `orders.status = FAILED, sub_status = COMPENSATED` + session `FAILED` (FR-23)  
**When** recovery scheduler re-queries FEP status  
**Then** FEP Gateway `GET /fep/v1/orders/{clOrdID}/status` → returns original processing result
**And** if `clOrdID` not in FEP Gateway → returns `UNKNOWN` → execute compensating position reversal
**Given** Recovery scheduler idempotency guarantee  
**When** scheduler runs twice for same EXECUTING session  
**Then** acquire Redis `SET ch:recovery-lock:{sessionId} NX EX 120` before processing — skip if already processing  
**And** delete lock key after recovery completion

**Given** `PENDING_NEW` session expired (TTL 600s passed, Redis key expired)  
**When** scheduler runs  
**Then** update DB status to `EXPIRED` (no position change — position was never touched before AUTHED)

**Given** `OrderSessionRecoveryServiceTest` (Unit test + WireMock FEP stub)  
**When** mock injection of EXECUTING session > 30s  
**Then** Case A: WireMock FEP Gateway stub → `ACCEPTED` → verify positions unchanged (already atomically committed before FEP call) + verify `COMPLETED`
**And** Case B: WireMock FEP Gateway stub → `REJECTED` → compensating position reversal + verify `FAILED`
**And** Case C: WireMock FEP Gateway stub → HTTP 500 → compensating position reversal + verify `FAILED`
**And** strict idempotency: second scheduler call verifies FEP stub not called again

---

## Story 4.4: Frontend — Order Confirm, Processing & Result (Step C)

As an **authenticated user who passed OTP verification**,  
I want to review order details before final confirmation and see the execution result immediately,  
So that I can verify accuracy and receive proof of order execution.

**Depends On:** Story 2.3 (Step B 완료 → AUTHED), Story 4.1

### Acceptance Criteria

**Given** FSM step `'CONFIRM'` after OTP verification success  
**When** Step C renders  
**Then** order summary card displayed: symbol (종목코드), side (매수/매도), qty (수량), price (단가, ₩ format), estimated total (qty × price, ₩ format), "Would you like to execute the order?" message  
**And** `data-testid="order-confirm-btn"` (Execute) + `data-testid="order-cancel-btn"` (Cancel)

**Given** "Execute Order" button clicked  
**When** `POST /api/v1/orders/sessions/{sessionId}/execute` calling  
**Then** FSM `{ type: 'EXECUTING' }` → `data-testid="order-processing-msg"`: "Processing your order. Please wait."  
**And** buttons completely disabled (prevent double-click)

**Given** success response (HTTP 200 COMPLETED)  
**When** response received  
**Then** FSM `{ type: 'COMPLETED', result }` → Result screen displayed  
**And** `data-testid="order-ref"`: order reference ID (`orderId`) displayed (FR-25)  
**And** `data-testid="executed-qty"`: executed quantity (e.g., "60주 체결") displayed  
**And** `data-testid="executed-price"`: executed unit price (₩ format) displayed  
**And** `data-testid="position-qty"`: current position quantity after execution displayed (FR-48)  
**And** `data-testid="position-qty"` value ≥ 0 (NFR-D1: over-sell impossible)

**Given** BUY: insufficient cash (re-validation on execute, HTTP 422 ORD-001)  
**When** error response  
**Then** `data-testid="order-error-msg"`: "주문 가능한 현금이 부족합니다." + [처음으로] button

**Given** SELL: insufficient position qty (re-validation on execute, HTTP 422 ORD-003)  
**When** error response  
**Then** `data-testid="order-error-msg"`: "보유 수량이 부족합니다." + [처음으로] button

**Given** FEP timeout (HTTP 504, code: "FEP-001")
**When** error response
**Then** `data-testid="fep-timeout-msg"`: "거래소 연결 오류가 발생하였습니다. 잠시 후 다시 시도해 주세요. 보유 수량은 변동되지 않았습니다."

**Given** FEP order rejected by exchange (HTTP 422, code: "FEP-002")
**When** error response
**Then** `data-testid="fep-reject-msg"`: "거래소에서 주문이 거부되었습니다. (FEP 거부) 보유 수량은 복원되었습니다."

**Given** FEP Circuit Breaker OPEN (HTTP 503, code: "FEP-003")
**When** error response
**Then** `data-testid="cb-fallback-msg"`: "현재 거래소 연결이 원활하지 않습니다. (서킷 브레이커 작동 중) 보유 수량은 변동되지 않았습니다."

**Given** order result screen  
**When** "Confirm" button clicked  
**Then** close Modal + refresh DashboardPage positions (`GET /api/v1/accounts/{accountId}/positions`)

**Given** Step B (OTP Input) entry saving session  
**When** immediately after FSM `SESSION_CREATED` dispatch  
**Then** `sessionStorage.setItem('lastOrderSessionId', sessionId)` stored

**Given** browser tab closed and reopened (session recovery, FR-18)  
**When** `DashboardPage` mounts (`useEffect`)  
**Then** `sessionStorage.getItem('lastOrderSessionId')` checked  
**And** if key exists, call `GET /api/v1/orders/sessions/{sessionId}/status`  
**And** Status `COMPLETED` → Auto-show result Modal + delete key  
**And** Status `FAILED` → Show failure Modal  
**And** Status `PENDING_NEW` + `remainingSeconds > 0` → "Previous order is pending. Continue?" popup  
**And** Status 404 (Expired) or 403 → Delete key, no UI shown
