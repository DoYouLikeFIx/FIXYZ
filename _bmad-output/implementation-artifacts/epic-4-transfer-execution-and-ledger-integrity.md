# Epic 4: Transfer Execution & Ledger Integrity

## Summary

An AUTHED transfer session actually executes, leaving paired (DEBIT+CREDIT) entries in the ledger atomically. Even under 10-thread concurrency, balances never go negative, and duplicate requests are handled idempotently. On failure, a compensating transaction (rollback) is executed. Scenarios #1, #2, #4, #7 pass.

**FRs covered:** FR-19, FR-20, FR-21, FR-22, FR-23, FR-24, FR-25, FR-43, FR-44, FR-48, FR-54  
**Architecture requirements:** TransferService.execute() (transaction boundary: FEP external, DB internal), @Lock PESSIMISTIC_WRITE, TransferHistory (DEBIT+CREDIT), clientRequestId (UNIQUE), TransferSessionRecoveryService (@Scheduled), AccountRepositoryImpl (QueryDSL)  
**Frontend:** TransferConfirm.tsx, TransferProcessing.tsx, TransferResult.tsx

---

## Story 4.1: Transfer Execution & Ledger (Same-bank & Interbank)

As a **system**,  
I want transfer execution to atomically debit source and credit destination accounts with paired ledger entries,  
So that the ledger always balances and no transfer results in a negative balance.

**Depends On:** Story 2.2 (AUTHED session), Story 3.1 (FEP integration)

### Acceptance Criteria

**Given** `POST /api/v1/transfers/sessions/{sessionId}/execute` (session status: `AUTHED`)  
**When** `TransferSessionService.execute()` called  
**Then** Redis `SET ch:txn-lock:{sessionId} NX EX 30` executed atomically  
**And** lock acquisition failure (concurrent request) → HTTP 409 `{ code: "CORE-003", message: "Transfer already being processed." }`  
**And** session status changed to `EXECUTING`

**Given** same-bank transfer (`toBankCode == internal bank code`)  
**When** `SameBankTransferService.execute()` runs  
**Then** `@Transactional(timeout=25)` transaction starts — guaranteed to commit within Redis lock TTL (30s)  
**And** `accountRepository.findByIdWithLock(sourceId)` → InnoDB `SELECT FOR UPDATE` (ADR-001)  
**And** real-time balance re-validated (defense against balance changes between session creation and execution)  
**And** `source.balance -= amount` (debit)  
**And** `destination.balance += amount` (credit)  
**And** 2 `TransferHistory` records saved atomically: `type: DEBIT, accountId: source, amount: -N` + `type: CREDIT, accountId: dest, amount: +N` (FR-21, FR-44)  
**And** session status `COMPLETED`, `transactionId` (UUID) generated, `postExecutionBalance = source.balance` saved  
**And** transaction committed  
**And** `ch:txn-lock:{sessionId}` Redis key deleted  
**And** HTTP 200: `{ sessionId, status: "COMPLETED", transactionId, fromBalance: N, completedAt }` (FR-48, FR-25)

**Given** DB error during transfer execution (transaction rollback)  
**When** exception occurs  
**Then** balance changes and TransferHistory both rolled back (atomicity guaranteed, FR-44)  
**And** session status changed to `FAILED`  
**And** HTTP 500 `{ code: "CORE-001", reason: "INTERNAL_ERROR" }` (FR-54)

**Given** interbank transfer (`toBankCode != internal bank code`)  
**When** `InterbankTransferService.execute()` runs  
**Then** `@Transactional(timeout=25)` TX1 starts: source account debit + `TransferHistory(DEBIT)` recorded, then committed (FEP call outside transaction)  
**And** FEP `POST /fep/v1/interbank/transfer` called (`referenceId = sessionId` passed)  
**And** FEP **HTTP 200 + `status: "ACCEPTED"`** → TX2: `TransferHistory(CREDIT)` recorded in separate transaction + session `COMPLETED`  
**And** FEP **HTTP 200 + `status: "REJECTED"`** → compensating transaction: source account credit restored + `TransferHistory(COMPENSATING_CREDIT)` + session `FAILED` + HTTP 422 `{ code: "FEP-002", reason: "REJECTED_BY_FEP" }`  
**And** FEP **HTTP 5xx / timeout / CB OPEN** → fallback compensating transaction + HTTP 503 `{ code: "FEP-001", reason: "FEP_UNAVAILABLE" }` (FR-54)

**Given** ledger integrity verification (`LedgerIntegrityIntegrationTest` — Scenario #7)  
**When** N transfers executed and verified  
**Then** `SUM(amount WHERE type=DEBIT) + SUM(amount WHERE type=CREDIT) == 0` (NFR-D1)

**Given** `SELECT FOR UPDATE` lock time measurement  
**When** single transfer executed  
**Then** lock hold time ≤ 100ms (NFR-P5)

**Given** daily limit re-validation after `PESSIMISTIC_WRITE` lock acquired — TOCTOU defense  
**When** inside `SameBankTransferService.execute()`, immediately after source account row lock acquired  
**Then** `SELECT SUM(amount) FROM transfer_history WHERE account_id=source AND type='DEBIT' AND DATE(created_at)=TODAY()` re-queried  
**And** re-queried cumulative + amount > `Account.dailyLimit` → immediately `TransferSession FAILED` + HTTP 422 `{ code: "TRF-003", remainingLimit: N }` (FR-47)  
**And** no balance changes or TransferHistory recorded (no compensating transaction needed)

**Given** `DailyLimitConcurrencyTest` (Testcontainers MySQL)  
**When** 2 threads execute concurrently via `CountDownLatch` (each ₩700,000, limit ₩1,000,000)  
**Then** exactly 1 succeeds (COMPLETED) + 1 fails (DAILY_LIMIT_EXCEEDED, HTTP 422)  
**And** source balance of failed session remains unchanged

---

## Story 4.2: Idempotency & Duplicate Transfer Protection

As a **system**,  
I want duplicate execute requests to return the original result without re-executing the transfer,  
So that network retries and double-submission never cause duplicate debits.

**Depends On:** Story 4.1

### Acceptance Criteria

**Given** re-request `POST /api/v1/transfers/sessions/{sessionId}/execute` with `COMPLETED` session ID  
**When** session status check  
**Then** HTTP 200: returns same `{ transactionId, fromBalance, completedAt }` as original complete response (no re-execution, FR-22)  
**And** `fromBalance` retrieved from `TransferSession.postExecutionBalance` column — not using real-time `Account.balance`

**Given** re-request with `FAILED` session ID  
**When** session status check  
**Then** HTTP 409 `{ code: "TRF-010", message: "Transfer session failed. Please start a new transfer." }`

**Given** re-request with `EXECUTING` session ID (concurrent request)  
**When** `ch:txn-lock:{sessionId}` NX failure  
**Then** HTTP 409 `{ code: "CORE-003" }` (prevent duplicate execution)

**Given** `IdempotencyIntegrationTest` (Testcontainers MySQL — Scenario #4)  
**When** execute called simultaneously 2 times for same session (using `CountDownLatch`)  
**Then** exactly 1 actual transfer execution, balance change reflected only once  
**And** both responses return identical `transactionId`

---

## Story 4.3: Transfer Session Recovery Service

As a **system**,  
I want stuck `EXECUTING` sessions to be automatically recovered after timeout,  
So that transient failures during execution never leave accounts in an inconsistent ledger state.

**Depends On:** Story 4.1

### Acceptance Criteria

**Given** `TransferSessionRecoveryService` (`@Scheduled(fixedDelay = 60000)`)  
**When** scheduler runs  
**Then** finds sessions in `EXECUTING` status with `updatedAt` older than 30 seconds  
**And** for each session, check if `TransferHistory` DEBIT record exists  
**And** no DEBIT record → session `FAILED` (no balance change)  
**And** DEBIT exists but no CREDIT → **Re-query FEP status first** `GET /fep/v1/transfer/{referenceId}/status`:
  - FEP `ACCEPTED` → retry TX2: record `TransferHistory(CREDIT)` + session `COMPLETED` (prevent double credit)
  - FEP `REJECTED` / `UNKNOWN` / HTTP 5xx → execute compensating credit + `TransferHistory(COMPENSATING_CREDIT)` + session `FAILED` (FR-23)
  - FEP re-query timeout/CB OPEN → execute compensating credit (conservative handling)

**Given** FEP re-query idempotency (`referenceId = sessionId` key based)  
**When** recovery scheduler re-queries FEP status  
**Then** FEP Simulator `GET /fep/v1/transfer/{referenceId}/status` → returns original processing result  
**And** if `referenceId` not in FEP → returns `UNKNOWN` → execute compensating credit

**Given** Recovery scheduler idempotency guarantee  
**When** scheduler runs twice for same EXECUTING session  
**Then** acquire Redis `SET recovery:lock:{sessionId} NX EX 120` before processing — skip if already processing  
**And** delete lock key after recovery completion

**Given** `OTP_PENDING` session expired (TTL 600s passed, Redis key expired)  
**When** scheduler runs  
**Then** update DB status to `EXPIRED` (compensation not needed)

**Given** `TransferSessionRecoveryServiceTest` (Unit test + WireMock FEP stub)  
**When** mock injection of EXECUTING session > 30s  
**Then** Case A: WireMock FEP → `ACCEPTED` → CREDIT TX retry + verify `COMPLETED`  
**And** Case B: WireMock FEP → `REJECTED` → compensating credit + verify `FAILED`  
**And** Case C: WireMock FEP → HTTP 500 → compensating credit + verify `FAILED`  
**And** strict idempotency: second scheduler call verifies FEP stub not called again

---

## Story 4.4: Frontend — Transfer Confirm, Processing & Result (Step C)

As an **authenticated user who passed OTP verification**,  
I want to review transfer details before final confirmation and see the result immediately,  
So that I can verify accuracy and receive proof of transfer completion.

**Depends On:** Story 2.3 (Step B 완료 → AUTHED), Story 4.1

### Acceptance Criteria

**Given** FSM step `'CONFIRM'` after OTP verification success  
**When** Step C renders  
**Then** transfer summary card displayed: source account (masked), destination account number, amount (with ₩ format), "Would you like to execute the transfer?" message  
**And** `data-testid="transfer-confirm-btn"` (Execute) + `data-testid="transfer-cancel-btn"` (Cancel)

**Given** "Execute Transfer" button clicked  
**When** `POST /api/v1/transfers/sessions/{sessionId}/execute` calling  
**Then** FSM `{ type: 'EXECUTING' }` → `data-testid="transfer-processing-msg"`: "Processing your transfer. Please wait."  
**And** buttons completely disabled (prevent double-click)

**Given** success response (HTTP 200 COMPLETED)  
**When** response received  
**Then** FSM `{ type: 'COMPLETED', result }` → Result screen displayed  
**And** `data-testid="transfer-ref"`: transaction reference ID (transactionId) displayed (FR-25)  
**And** `data-testid="balance-after"`: balance after transfer (₩ format) displayed (FR-48)  
**And** `data-testid="balance-after"` value ≥ 0 (NFR-D1)

**Given** insufficient balance (re-validation on execute, HTTP 422)  
**When** error response  
**Then** `data-testid="transfer-error-msg"`: "Insufficient balance." + [Go to Home] button

**Given** FEP failure / CB OPEN (HTTP 503)  
**When** error response  
**Then** `data-testid="cb-fallback-msg"`: "Temporary error. Please try again later."

**Given** transfer result screen  
**When** "Confirm" button clicked  
**Then** close Modal + refresh DashboardPage account list balance (`GET /api/v1/accounts`)

**Given** Step B (OTP Input) entry saving session  
**When** immediately after FSM `SESSION_CREATED` dispatch  
**Then** `sessionStorage.setItem('lastTransferSessionId', sessionId)` stored

**Given** browser tab closed and reopened (session recovery, FR-18)  
**When** `DashboardPage` mounts (`useEffect`)  
**Then** `sessionStorage.getItem('lastTransferSessionId')` checked  
**And** if key exists, call `GET /api/v1/transfers/sessions/{sessionId}/status`  
**And** Status `COMPLETED` → Auto-show result Modal + delete key  
**And** Status `FAILED` → Show failure Modal  
**And** Status `OTP_PENDING` + `remainingSeconds > 0` → "Previous transfer is pending application. Continue?" popup  
**And** Status 404 (Expired) or 403 → Delete key, no UI shown
