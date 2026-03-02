# 1. 상태 모델 전체 구조 (최종 설계 반영)

FIX 계정계는 **3계층 분리 모델**이다:

1. 업무 상태 (`order_records`)
2. 전표 상태 (`journal_entries`)
3. 원장 상태 (`ledger_entries` 존재 여부)

동시성 제어는:

> 🔒 accounts row를 `SELECT ... FOR UPDATE`로 직렬화 (비관적 락 only)
> 

Optimistic Lock(version)은 사용하지 않는다.

일일 한도는:

> 당일 `ledger_entries (direction='DEBIT')`를 실시간 SUM 집계로 검증한다.
> 

---

# 1.1 업무 상태 (`order_records.status`)

| 상태 | 의미 |
| --- | --- |
| REQUESTED | 요청 수신 |
| EXECUTING | 트랜잭션 시작, 계좌 row lock 획득 |
| COMPLETED | 정상 완료 |
| FAILED | 명확한 실패 |
| COMPENSATED | 부분 실행 후 보상 완료 |

---

# 1.2 전표 상태 (`journal_entries.journal_status`)

| 상태 | 의미 |
| --- | --- |
| PENDING | 생성은 되었으나 아직 확정 전 |
| POSTED | ledger 반영 완료 |
| FAILED | 전표 실패 |

---

# 2. 정상 시나리오 (락 설계 반영)

## 2.1 DIRECT_ORDER_SETTLEMENT

### 실행 흐름

1. REQUESTED 생성
2. EXECUTING 전이
3. 🔒 두 계좌 row lock
    - 항상 `min(account_id) → max(account_id)` 순서
    - Deadlock 방지 목적
4. 잔액 검증
5. 일일 한도 검증
    - 당일 DEBIT SUM 집계
6. ledger 2줄 생성
    - from → DEBIT
    - to → CREDIT
7. journal_status = POSTED
8. order_record.status = COMPLETED
9. completed_at 기록
10. snapshot 저장

### 최종 상태

| order_record.status | journal.status | ledger |
| --- | --- | --- |
| COMPLETED | POSTED | DEBIT + CREDIT |

---

## 2.2 FIX_ORDER_EXECUTION (체결 성공)

1. ORDER_SUBMITTED
2. EXECUTING
3. 🔒 from_account FOR UPDATE
4. FIX ExecutionReport(ExecType=FILL) 수신
5. ledger 2줄 생성
6. journal POSTED
7. order_record ORDER_FILLED

최종 상태 동일.

---

# 3. FEP Simulator Timeout (FEP_UNCERTAIN)

타임아웃 발생 시 DB 상태는 3가지 가능

---

## Case A — 미실행

- ledger 없음
- journal PENDING
- order_record EXECUTING

---

## Case B — 부분 실행

- ledger: DEBIT만 존재
- CREDIT 없음
- order_record EXECUTING

---

## Case C — 이미 성공

- ledger: DEBIT + CREDIT
- journal POSTED
- order_record EXECUTING 상태로 멈춤

---

# 4. RecoveryScheduler (최종 설계 반영)

## 4.1 대상 조회 (executing_started_at 기준)

```sql
SELECT *
FROM order_records
WHERE status='EXECUTING'
AND executing_started_at < NOW() - INTERVAL 30 SECOND
ORDER BY executing_started_at ASC
LIMIT 100;
```

사용 인덱스:

```sql
IDX(status, executing_started_at)
```

---

## 4.2 판정 알고리즘

### Step 1: CREDIT 존재 여부

```sql
SELECT 1
FROM ledger_entries
WHERE trade_ref_id = ?
AND direction='CREDIT'
LIMIT 1;
```

사용 인덱스:

```sql
IDX(trade_ref_id, direction)
```

---

## 4.3 판정 테이블

| CREDIT | DEBIT | 판정 | 조치 |
| --- | --- | --- | --- |
| ❌ | ❌ | 미실행 | FAILED |
| ❌ | ✅ | 부분 실행 | COMPENSATE |
| ✅ | ✅ | 성공 | COMPLETED |

---

# 5. 보상 처리 (Compensation)

부분 실행(DEBIT만 존재)일 경우:

1. journal_type = COMPENSATION
2. reverse CREDIT 생성
3. journal_status = POSTED
4. order_record.status = COMPENSATED
5. completed_at 기록

최종 상태:

| order_record.status | journal.status | ledger |
| --- | --- | --- |
| COMPENSATED | POSTED | 원래 DEBIT + 보상 CREDIT |

---

# 6. 멱등(Idempotency) — DB UNIQUE 기반

## 6.1 제약

- `order_records.client_request_id UNIQUE`
- `journal_entries.client_request_id UNIQUE`

중복 요청 시:

- 새로 생성하지 않음
- 기존 order_records 조회
- 기존 snapshot 반환

---

## 6.2 멱등 응답 안정성

응답은 반드시 snapshot 기반:

- `post_execution_balance`
- `result_code`
- `result_message`
- `completed_at`

❌ `accounts.balance` 재조회 금지

---

# 7. 복식부기 불변식

## 7.1 DB 레벨

- direction은 DEBIT/CREDIT만 허용
- amount는 절대값 (CHECK > 0)
- balance >= 0
- 계좌번호 정규화
- 상태값 ENUM

## 7.2 앱/테스트 레벨

주문 단위 정합성:

```sql
SELECT
  SUM(CASE
    WHEN direction='CREDIT' THEN amount
    ELSE -amount
  END) AS net_sum
FROM ledger_entries
WHERE trade_ref_id = ?;
```

결과는 반드시:

```
net_sum = 0
```

---

# 8. 전체 상태 조합 (최종)

| order_record_status | journal_status | ledger | 의미 |
| --- | --- | --- | --- |
| REQUESTED | 없음 | 없음 | 요청 수신 |
| EXECUTING | PENDING | 없음 | 실행 시작 |
| EXECUTING | PENDING | DEBIT만 | **위험 상태(부분 실행)** / 복구 대상 |
| COMPLETED | POSTED | DEBIT + CREDIT | 정상 완료 |
| FAILED | FAILED | 없음 | 실패 |
| COMPENSATED | POSTED | DEBIT + 보상 CREDIT | 부분 성공 후 보상 완료 |
