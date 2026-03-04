이 문서는 시스템 핵심 기능을 수행하기 위한 **표준 SQL 쿼리**를 정의한다.

Repository Layer는 본 문서를 기준으로 구현한다.

✅ 변경 사항(v2.0)

- 금액(amount/balance/price/limit): **DECIMAL(19,4)**
- `ledger_entries`는 파티션 테이블 → **created_at 범위 조건 필수(Pruning)**
- 멱등 응답: JSON 제거 → `result_code`, `result_message`, `post_execution_balance`, `completed_at`
- Hot Account(DEFERRED): `last_synced_ledger_ref` 기반 **Read-Repair** 쿼리 포함
- FIX 주문/체결: `orders(cl_ord_id UK)`, `executions(exec_id UK)` 기반 멱등 포함

---

## 1) accounts

### 1.1 계좌 단건 조회(외부 노출: public_id)

용도: 계좌 상세/검증(상태, 한도, 잔액 등)

```sql
SELECT id, public_id, member_id, account_number, exchange_code, status, closed_at,
       balance, daily_limit, currency_code, balance_update_mode, last_synced_ledger_ref,
       created_at, updated_at
FROM accounts
WHERE public_id = ?;
```

- 인덱스: `UK(public_id)`

---

### 1.2 계좌 단건 조회(업무 키: account_number)

용도: 주문 입력값 검증(계좌 상태 확인)

```sql
SELECT id, public_id, member_id, exchange_code, status, closed_at,
       balance, daily_limit, currency_code, balance_update_mode, last_synced_ledger_ref
FROM accounts
WHERE account_number = ?;
```

- 인덱스: `UK(account_number)`

---

### 1.3 회원의 활성 계좌 목록 조회

용도: “내 계좌 목록” 화면

```sql
SELECT public_id, account_number, exchange_code, status,
       balance, daily_limit, currency_code, updated_at
FROM accounts
WHERE member_id = ?
  AND status IN ('ACTIVE','FROZEN')
ORDER BY updated_at DESC;
```

- 인덱스: `IDX(member_id, status)`

---

### 1.4 주문 계좌 락(SELECT … FOR UPDATE)

용도: 주문 실행 직렬화(비관적 락)

```sql
SELECT id, balance, status, daily_limit, currency_code,
       balance_update_mode, last_synced_ledger_ref
FROM accounts
WHERE id = ?
FOR UPDATE;
```

- 인덱스: PK(id)
- 주의: 트랜잭션 시작 직후 잡고 커밋까지 짧게 유지

---

### 1.5 계좌 잔액 업데이트(EAGER 또는 Read-Repair 후)

용도: 일반 계좌(EAGER) 갱신 또는 DEFERRED Read-Repair 정산 후 갱신

```sql
UPDATE accounts
SET balance = ?,
    last_synced_ledger_ref = ?, -- DEFERRED일 때만 갱신(그 외 NULL 유지 가능)
    updated_at = NOW(6)
WHERE id = ?;
```

---

## 2) order_records (+ order_record_diagnostics)

### 2.1 멱등 가드: client_request_id로 기존 업무 조회

용도: 중복 요청/재시도 시 “당시 결과” 반환

```sql
SELECT id, public_id, trade_ref_id, status,
       result_code, result_message, post_execution_balance, completed_at
FROM order_records
WHERE client_request_id = ?;
```

- 인덱스: `UK(client_request_id)`

---

### 2.2 멱등 생성: NEW 생성

용도: 최초 요청을 업무 레코드로 고정

```sql
INSERT INTO order_records (
  public_id, client_request_id, trade_ref_id,
  order_side, status,
  amount, currency_code, from_account_id, order_id,
  executing_started_at, completed_at,
  result_code, result_message, post_execution_balance,
  created_at, updated_at
) VALUES (
  ?, ?, ?,
  ?, 'NEW',
  ?, ?, ?, ?,
  NULL, NULL,
  NULL, NULL, NULL,
  NOW(6), NOW(6)
);
```

- 제약: `UK(client_request_id)`

---

### 2.3 EXECUTING 전이(원자적 상태 전이)

용도: 실행 시작 시간 기록(Recovery 기준점)

```sql
UPDATE order_records
SET status = 'EXECUTING',
    executing_started_at = NOW(6),
    updated_at = NOW(6)
WHERE client_request_id = ?
  AND status IN ('NEW','PENDING_NEW');
```

---

### 2.4 FILLED(성공) 확정 + 스냅샷 저장

용도: 최종 성공 결과 고정(멱등 응답용)

```sql
UPDATE order_records
SET status = 'FILLED',
    post_execution_balance = ?,
    result_code = 'SUCCESS',
    result_message = NULL,
    completed_at = NOW(6),
    updated_at = NOW(6)
WHERE client_request_id = ?
  AND status IN ('NEW','PENDING_NEW','EXECUTING','PARTIALLY_FILLED');
```

---

### 2.5 REJECTED(명확한 실패) 확정 + 진단 저장(선택)

용도: 명확한 실패 처리

**Step 1) Main Table Update**

```sql
UPDATE order_records
SET status = 'REJECTED',
    failure_reason = ?, -- 짧은 운영 사유(VARCHAR 255)
    result_code = ?, -- 예: LIMIT_EXCEEDED / INSUFFICIENT_BALANCE / ...
    result_message = ?, -- 사용자 노출 메시지(255)
    completed_at = NOW(6),
    updated_at = NOW(6)
WHERE client_request_id = ?;
```

**Step 2) Diagnostic Detail Insert (Optional)**

```sql
INSERT INTO order_record_diagnostics (order_record_id, detail, created_at)
VALUES (?, ?, NOW(6));
```

---

### 2.6 Recovery 스캔: 오래된 EXECUTING 찾기

용도: Timeout 복구 대상 스캔

```sql
SELECT id, client_request_id, trade_ref_id, from_account_id, status, executing_started_at
FROM order_records
WHERE status = 'EXECUTING'
  AND executing_started_at < (NOW(6) - INTERVAL 30 SECOND)
ORDER BY executing_started_at ASC
LIMIT 100;
```

- 인덱스: `IDX(status, executing_started_at)`

---

### 2.7 trade_ref_id로 업무 추적

용도: 주문 단위(전표/원장 포함) 추적

```sql
SELECT *
FROM order_records
WHERE trade_ref_id = ?;
```

- 인덱스: `IDX(trade_ref_id)`

---

## 3) orders (FIX 주문, ClOrdID 멱등)

### 3.1 멱등 가드: cl_ord_id로 주문 조회

용도: FIX Tag 11 중복 주문 방지

```sql
SELECT id, public_id, status, account_id, symbol, side, ord_type,
       ord_qty, cum_qty, leaves_qty, avg_px, fep_reference_id,
       executing_started_at, completed_at, created_at, updated_at
FROM orders
WHERE cl_ord_id = ?;
```

- 인덱스: `UK(cl_ord_id)`

---

### 3.2 주문 생성(NEW)

용도: 주문 수락/생성 시 저장

```sql
INSERT INTO orders (
  public_id, cl_ord_id, member_id, account_id,
  symbol, side, ord_type, price, ord_qty,
  status, external_sync_status, cum_qty, avg_px, leaves_qty,
  fep_reference_id, failure_reason,
  executing_started_at, completed_at,
  created_at, updated_at
) VALUES (
  ?, ?, ?, ?,
  ?, ?, ?, ?, ?,
  'NEW', NULL, 0, NULL, ?,
  NULL, NULL,
  NULL, NULL,
  NOW(6), NOW(6)
);
```

- 제약: `UK(cl_ord_id)`
- 주의: `ord_type='LIMIT'`면 `price NOT NULL`, `MARKET`이면 `price NULL`

---

### 3.3 주문 상태 갱신(체결 이벤트 반영용)

용도: ExecutionReport 반영해 orders의 status/cum/leaves/avg 갱신

```sql
UPDATE orders
SET status = ?,
    external_sync_status = ?,
    cum_qty = ?,
    leaves_qty = ?,
    avg_px = ?,
    updated_at = NOW(6),
    completed_at = CASE WHEN ? = 1 THEN NOW(6) ELSE completed_at END
WHERE id = ?;
```

- `? = 1`은 “최종 상태 도달 여부”(FILLED/CANCELED/REJECTED 등)를 호출자가 판단

---

## 4) positions (포지션 락 타깃)

### 4.1 포지션 단건 조회(락 없음)

용도: 화면/검증용 조회

```sql
SELECT id, account_id, symbol, quantity, available_qty, avg_cost, updated_at
FROM positions
WHERE account_id = ?
  AND symbol = ?;
```

- 인덱스: `UK(account_id, symbol)`

---

### 4.2 주문 실행 직렬화: 포지션 락(SELECT … FOR UPDATE)

용도: 동일 `(account_id, symbol)` 주문 직렬화 (BUY/SELL 공통)

```sql
SELECT id, quantity, available_qty, avg_cost
FROM positions
WHERE account_id = ?
  AND symbol = ?
FOR UPDATE;
```

---

### 4.2b 최초 매수(행 부재) bootstrap

용도: BUY 시 포지션 행이 없을 때 락 타깃을 먼저 생성

```sql
INSERT INTO positions (account_id, symbol, quantity, available_qty, avg_cost, created_at, updated_at)
VALUES (?, ?, 0, 0, NULL, NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE id = id;
```

```sql
SELECT id, quantity, available_qty, avg_cost
FROM positions
WHERE account_id = ?
  AND symbol = ?
FOR UPDATE;
```

---

### 4.3 포지션 갱신(체결 반영)

용도: 체결 결과로 quantity/available_qty/avg_cost 갱신

```sql
UPDATE positions
SET quantity = ?,
    available_qty = ?,
    avg_cost = ?,
    updated_at = NOW(6)
WHERE id = ?;
```

---

## 5) executions (체결 이력, 로컬 canonical 멱등, append-only)

### 5.1 멱등 가드: exec_id로 기존 체결 조회

용도: 로컬 매칭 체결 멱등 보장

```sql
SELECT id, public_id, exec_id, order_id, exec_type, ord_status, created_at
FROM executions
WHERE exec_id = ?;
```

- 인덱스: `UK(exec_id)`

---

### 5.2 체결 이벤트 Insert(append-only)

용도: 로컬 매칭 체결 영속화(UPDATE 금지). 외부 확인값은 `external_exec_id`로 선택 저장

```sql
INSERT INTO executions (
  public_id, exec_id, external_exec_id, order_id, cl_ord_id,
  exec_type, ord_status,
  symbol, side,
  executed_qty, executed_price, cum_qty, leaves_qty,
  fep_reference_id,
  created_at
) VALUES (
  ?, ?, ?, ?, ?,
  ?, ?,
  ?, ?,
  ?, ?, ?, ?,
  ?,
  NOW(6)
);
```

---

### 5.3 정합성 검증(시나리오 #7)

용도: executions 기반 expected_qty 산출

```sql
SELECT
  SUM(CASE WHEN side = 'BUY' AND exec_type = 'TRADE' THEN executed_qty ELSE 0 END)
  - SUM(CASE WHEN side = 'SELL' AND exec_type = 'TRADE' THEN executed_qty ELSE 0 END) AS expected_qty
FROM executions
WHERE symbol = ?
  AND order_id IN (SELECT id FROM orders WHERE account_id = ?);
```

---

## 6) journal_entries & ledger_entries & ledger_entry_refs

### 6.1 전표 멱등 가드: client_request_id로 journal 조회

용도: 동일 요청 재시도 시 전표 중복 생성 방지

```sql
SELECT id, public_id, trade_ref_id, journal_type, journal_status, created_at
FROM journal_entries
WHERE client_request_id = ?;
```

- 인덱스: `UK(client_request_id)`

---

### 6.2 전표 생성(PENDING)

용도: 주문 처리 시작 시 전표 헤더 생성

```sql
INSERT INTO journal_entries (
  public_id, trade_ref_id, client_request_id,
  original_trade_ref_id, original_journal_entry_id,
  journal_type, journal_status, failure_reason,
  created_at
) VALUES (
  ?, ?, ?,
  ?, ?,
  ?, 'PENDING', NULL,
  NOW(6)
);
```

---

### 6.3 전표 POSTED/FAILED 확정

용도: 원장 라인 저장 결과에 따라 전표 상태 확정

```sql
UPDATE journal_entries
SET journal_status = ?,
    failure_reason = ?
WHERE id = ?;
```

- `journal_status`: `POSTED` 또는 `FAILED`

---

### 6.4 ledger_entries Insert(append-only, 파티션 전제)

용도: 분개 라인 기록(UPDATE 금지)

```sql
INSERT INTO ledger_entries (
  public_id, journal_entry_id, trade_ref_id,
  account_id, direction, amount, currency_code,
  created_at
) VALUES (
  ?, ?, ?,
  ?, ?, ?, ?,
  NOW(6)
);
```

---

### 6.5 ledger_entry_refs Insert(외부 public_id point lookup 필요 시)

용도: ledger_entries.public_id 전역 UNIQUE 대체

```sql
INSERT INTO ledger_entry_refs (
  public_id, ledger_entry_id, ledger_created_at
) VALUES (
  ?, ?, ?
);
```

---

### 6.6 public_id로 원장 단건 조회(point lookup)

용도: 외부 참조로 ledger 상세 조회

```sql
SELECT r.public_id, r.ledger_entry_id, r.ledger_created_at
FROM ledger_entry_refs r
WHERE r.public_id = ?;
```

(이후 실제 원장 조회)

```sql
SELECT *
FROM ledger_entries
WHERE id = ?
  AND created_at >= ?
  AND created_at <  ?;
```

- 핵심: `created_at` 범위를 반드시 넣어 파티션 프루닝

---

### 6.7 주문 단위 원장 라인 조회(trade_ref_id)

용도: trade_ref_id로 분개 라인 확인

주의: 파티션 프루닝 위해 **created_at 범위 필수** (주문 시각 기반으로 서비스가 범위를 만든다)

```sql
SELECT account_id, direction, amount, currency_code, created_at
FROM ledger_entries
WHERE trade_ref_id = ?
  AND created_at >= ?
  AND created_at <  ?
ORDER BY id ASC;
```

- 인덱스: `IDX(trade_ref_id, direction)` + pruning by created_at

---

### 6.8 일일 한도 검증: 당일 DEBIT SUM(Pruning 필수)

용도: 당일 매매 총액 계산

```sql
SELECT COALESCE(SUM(amount), 0) AS today_debit_sum
FROM ledger_entries
WHERE account_id = ?
  AND direction = 'DEBIT'
  AND created_at >= ? -- 오늘 00:00:00
  AND created_at <  ?; -- 내일 00:00:00
```

- 인덱스: `IDX(account_id, direction, created_at)`

---

### 6.9 Hot Account Read-Repair 합산(DEFERRED, single-writer 전제)

용도: `last_synced_ledger_ref` 이후 발생한 라인들을 합산하여 잔액 캐시를 최신화

```sql
SELECT
  COALESCE(SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END), 0) AS delta_balance,
  COALESCE(MAX(id), ?) AS new_high_watermark
FROM ledger_entries
WHERE account_id = ?
  AND id > ?
  AND created_at >= ?
  AND created_at <  ?
FOR UPDATE; -- optional (외부 트랜잭션에서 동일 account/symbol 락을 이미 보유한 경우 생략 가능)
```

- `id > ?` : `accounts.last_synced_ledger_ref`
- `created_at 범위` : 파티션 프루닝을 위해 “최근 N일” 같은 힌트 범위를 반드시 포함
- 반환된 `new_high_watermark`를 `accounts.last_synced_ledger_ref`로 갱신

---

# 7) 트랜잭션 흐름(요약, v2.0 정합)

1. `order_records` 멱등 조회 (`client_request_id`)
2. 없으면 `order_records` INSERT (`status='NEW'`)
3. `positions` Lock (`SELECT ... FOR UPDATE WHERE account_id=? AND symbol=?`) → BUY는 필요 시 bootstrap 후 잠금, SELL은 `available_qty` 검증
4. (현금 갱신 필요 구간에서만) `accounts` Lock (`SELECT ... FOR UPDATE`)
5. (DEFERRED면) `ledger_entries` Read-Repair 수행 → `accounts.balance`/`last_synced_ledger_ref` 갱신
6. `ledger_entries` 당일 DEBIT SUM으로 한도 검증
7. `orders` 멱등 조회(`cl_ord_id`) → 없으면 INSERT
8. `journal_entries` 멱등 조회(`client_request_id`) → 없으면 INSERT(PENDING)
9. `ledger_entries` INSERT (DEBIT/CREDIT 라인)
    - 필요 시 `ledger_entry_refs` INSERT
10. `journal_entries` POSTED 확정
11. `accounts` 잔액 업데이트(EAGER 또는 정산 후)
12. `executions` Insert(로컬 매칭 체결 시 `exec_id` 멱등, 필요 시 `external_exec_id` 저장)
13. `orders`/`positions` 갱신(체결 반영)
14. `order_records` 최종 상태 확정(FILLED/REJECTED/ESCALATED 등) + 스냅샷 저장
