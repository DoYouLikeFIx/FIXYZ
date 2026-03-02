# Primary Queries

이 문서는 시스템의 핵심 기능을 수행하기 위한 **표준 SQL 쿼리**를 정의한다.
개발자는 이 문서를 기준으로 Repository Layer를 구현해야 한다.

✅ **주요 변경 사항(v2.0)**:
- 모든 **금액(amount, balance)** 필드는 `DECIMAL(19,4)` 타입 사용.
- `ledger_entries` 조회 시 파티션 프루닝을 위해 **`created_at` 범위 조건 필수**.
- 멱등 응답용 JSON 컬럼 제거 -> `result_code`, `result_message`, `post_execution_balance` 사용.
- **Hot Account(DEFERRED Mode)** 지원을 위한 Read-Repair 로직 쿼리 추가.

---

# 1) accounts

## 1.1 계좌 단건 조회(외부 노출: public_id)
**용도**: 계좌 상세/검증(상태, 한도, 잔액 등)

```sql
SELECT id, public_id, member_id, account_number, exchange_code, status, closed_at,
       balance, daily_limit, currency_code, balance_update_mode, last_synced_ledger_ref, 
       created_at, updated_at
FROM accounts
WHERE public_id = ?;
```
- 인덱스: `UK(public_id)`

---

## 1.2 계좌 단건 조회(업무 키: account_number)
**용도**: 주문 입력값 검증(계좌 상태 확인)

```sql
SELECT id, public_id, member_id, exchange_code, status, closed_at, balance, daily_limit, currency_code, balance_update_mode
FROM accounts
WHERE account_number = ?;
```
- 인덱스: `UK(account_number)`

---

## 1.3 회원의 활성 계좌 목록 조회
**용도**: “내 계좌 목록” 화면

```sql
SELECT public_id, account_number, exchange_code, status, balance, daily_limit, currency_code, updated_at
FROM accounts
WHERE member_id = ?
AND status IN ('ACTIVE','FROZEN')
ORDER BY updated_at DESC;
```
- 인덱스: `IDX(member_id, status)`

---

## 1.4 주문 계좌 락(SELECT … FOR UPDATE)
**용도**: 주문 실행에서 **비관적 낙 확정(ADR-001)**

```sql
SELECT id, balance, status, daily_limit, balance_update_mode, last_synced_ledger_ref
FROM accounts
WHERE id = ?
FOR UPDATE;
```
- 인덱스: PK(id)
- 주의: 항상 **트랜잭션 시작 직후** 잡고, 커밋까지 짧게 유지

---

## 1.5 계좌 잔액 업데이트(EAGER 모드/Read-Repair 후)
**용도**: 일반 계좌(Eager)의 잔액 갱신 또는 Hot Account의 정산(Read-Repair) 후 갱신.

```sql
UPDATE accounts
SET balance = ?, 
    last_synced_ledger_ref = ?, -- (Optional) Hot Account 정산 시 갱신
    updated_at = NOW(6)
WHERE id = ?;
```
- 인덱스: PK(id)

---

# 2) order_records

## 2.1 멱등 가드: client_request_id로 기존 업무 조회
**용도**: execute 재호출/중복 요청 처리. JSON Blob 대신 컬럼화된 필드 조회.

```sql
SELECT id, public_id, status, result_code, result_message, post_execution_balance, completed_at
FROM order_records
WHERE client_request_id = ?;
```
- 인덱스: `UK(client_request_id)`

---

## 2.2 “멱등 생성” 패턴: REQUESTED 생성
**용도**: 최초 요청을 DB에 “업무 레코드”로 고정.

```sql
INSERT INTO order_records (
  public_id, client_request_id, trade_ref_id, order_side, status,
  amount, currency_code, from_account_id, order_id,
  executing_started_at, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, 'REQUESTED',
  ?, ?, ?, ?,
  NULL, NOW(6), NOW(6)
);
```
- 제약: `UK(client_request_id)`

---

## 2.3 EXECUTING 전이
**용도**: 실행 시작 시간 기록 (Recovery 기준점).

```sql
UPDATE order_records
SET status = 'EXECUTING',
    executing_started_at = NOW(6),
    updated_at = NOW(6)
WHERE client_request_id = ?
AND status = 'REQUESTED';
```

---

## 2.4 COMPLETED 확정 + 스냅샷 저장
**용도**: 최종 결과(성공) 고정. 응답 재구성을 위한 핵심 필드 저장.

```sql
UPDATE order_records
SET status = 'COMPLETED',
    post_execution_balance = ?,
    result_code = 'SUCCESS',
    result_message = NULL,
    completed_at = NOW(6),
    updated_at = NOW(6)
WHERE client_request_id = ?
AND status IN ('REQUESTED','EXECUTING');
```

---

## 2.5 FAILED 확정 + 진단 테이블 저장
**용도**: 명확한 실패 처리.
**Step 1. Main Table Update**
```sql
UPDATE order_records
SET status = 'FAILED',
    failure_reason = ?, -- 짧은 사유 (VARCHAR 255)
    result_code = ?,
    result_message = ?, -- 사용자 노출 메시지
    completed_at = NOW(6),
    updated_at = NOW(6)
WHERE client_request_id = ?;
```
**Step 2. (Optional) Diagnostic Detail Insert**
```sql
INSERT INTO order_record_diagnostics (order_record_id, detail, created_at)
VALUES (?, ?, NOW(6));
```

---

## 2.6 Recovery 스캔: 오래된 EXECUTING 찾기
**용도**: 타임아웃 복구 대상 스캔.

```sql
SELECT *
FROM order_records
WHERE status = 'EXECUTING'
AND executing_started_at < (NOW(6) - INTERVAL 30 SECOND)
ORDER BY executing_started_at ASC
LIMIT 100;
```
- 인덱스: `IDX(status, executing_started_at)`

---

## 2.7 주문 조회
**용도**: trade_ref_id로 업무 추적.

```sql
SELECT *
FROM order_records
WHERE trade_ref_id = ?;
```
- 인덱스: `IDX(trade_ref_id)`

---

# 3) journal_entries & ledger_entries (Partitioned)

## 3.1 주문 단위 원장 라인 조회
**용도**: trade_ref_id로 분개 라인 확인. 파티션 프루닝을 위해 **대략적인 기간**을 알면 좋지만, `trade_ref_id` 인덱스가 있다면 파티션 전체 스캔도 허용 가능 (보통 주문 시점이 최근이므로).
하지만 최적화를 위해선 `created_at` 범위를 유추해서 넣는 것이 좋다.

```sql
SELECT account_id, direction, amount, created_at
FROM ledger_entries
WHERE trade_ref_id = ?
-- AND created_at BETWEEN ? AND ? (권장)
ORDER BY id ASC;
```
- 인덱스: `IDX(trade_ref_id, direction)`

---

## 3.2 일일 한도 검증: 당일 DEBIT SUM (Pruning 필수)
**용도**: 당일 매매 총액 계산.

```sql
SELECT COALESCE(SUM(amount), 0) AS today_debit_sum
FROM ledger_entries
WHERE account_id = ?
AND direction = 'DEBIT'
AND created_at >= ? -- 오늘 00:00:00
AND created_at <  ?; -- 내일 00:00:00
```
- 인덱스: `IDX(account_id, direction, created_at)`
- **파티션 프루닝**: `created_at` 조건으로 오늘 날짜 파티션만 스캔.

---

## 3.3 Hot Account 주문 체결 시 Read-Repair 합산 (DEFERRED Mode 및 Single Writer 전제)
**용도**: 마지막 정산 시점(`last_synced_ledger_ref`) 이후에 발생한 CREDIT 주문 내역 합산.

```sql
SELECT COALESCE(SUM(
    CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END
  ), 0) AS delta_balance,
  MAX(id) as new_high_watermark
FROM ledger_entries
WHERE account_id = ?
AND id > ? -- accounts.last_synced_ledger_ref
AND created_at >= ? -- (Performance Hint) 최근 N일 범위
FOR UPDATE; -- (Optional) 확실한 격리를 위해
```
*   `created_at >= ?`: 파티션 프루닝을 위해 "마지막 정산 일자" 등을 힌트로 주는 것이 성능 상 유리함.
*   `MAX(id)`: 다음 `last_synced_ledger_ref`로 사용.

---

# 4) 트랜잭션 흐름 (요약)

1. `order_records` 멱등 조회
2. `order_records` INSERT (REQUESTED)
3. `accounts` 주문계좌 Lock (`SELECT FOR UPDATE`)
    - IF `balance_update_mode == 'DEFERRED'`:
        - `ledger_entries` Read-Repair 쿼리 수행
        - `accounts.balance` += delta, `last_synced_ledger_ref` 갱신
4. `ledger_entries` 당일 DEBIT SUM 한도 검증
5. `journal_entries` + `ledger_entries` INSERT
    - `ledger_entry_refs` INSERT (if public_id lookup needed)
6. `accounts` 잔액 업데이트 & 갱신
7. `order_records` COMPLETED Update
