# 상태 모델 전체 구조 (core_db v2.0 최종 스키마 반영)

FIX 계정계(core_db)는 **3계층 분리 모델**로 “업무/전표/원장”을 각각 **독립적으로 판정** 가능하게 설계한다.

1. **업무 상태**: `order_records.status`
2. **전표 상태**: `journal_entries.journal_status` (+ `journal_type`)
3. **원장 상태**: `ledger_entries` 존재 여부 (특히 `trade_ref_id + direction`)

동시성 제어(최종 고정)

- 🔒 **주문 처리(정산)의 기본 락은 `positions(account_id, symbol)` 단위다**
- `accounts` row lock은 현금 잔액 갱신이 필요한 구간에서만 최소 범위로 획득한다.
- Optimistic Lock(version) 금지
- 매도 과매도 방지: 🔒 `positions`를 `(account_id, symbol)`로 `SELECT ... FOR UPDATE`

일일 한도(최종 고정)

- **당일 `ledger_entries.direction='DEBIT'`를 실시간 SUM 집계로 검증**
- `accounts`에 “사용량 컬럼”은 두지 않는다.

---

## 1.1 업무 상태 (`order_records.status`)

> 최종 스키마의 `order_records.status` 값 집합을 그대로 사용한다.

| 상태 | 의미 |
| --- | --- |
| NEW | 업무 레코드 생성(멱등키 고정) |
| PENDING_NEW | 외부(FEP) 접수 대기/전송 직전(선택) |
| EXECUTING | 실행 시작 + 주문 대상 락 획득(기본 `positions(account_id,symbol)`, 필요 시 `accounts` 최소 락) |
| PARTIALLY_FILLED | 부분 체결 진행(주문/체결 도메인) |
| FILLED | 정상 완료(최종 스냅샷 확정) |
| CANCELED | 취소 완료 |
| REJECTED | 명확한 실패(검증 실패/잔액 부족/한도 초과/명확한 FEP 거절 등) |
| ESCALATED | 외부 동기화 불확실/실패로 수동 재처리 대기 |

- `executing_started_at`은 EXECUTING 타임아웃 판정 기준이며 `updated_at`에 의존하지 않는다.
- **멱등 응답 스냅샷**은 `post_execution_balance`, `result_code`, `result_message`, `completed_at`로 구성한다.

---

## 1.2 전표 상태 (`journal_entries.journal_status`)

| 상태 | 의미 |
| --- | --- |
| PENDING | 전표 생성됨(아직 원장 확정 전) |
| POSTED | 원장 반영 완료(ledger_entries 기록 완료) |
| FAILED | 전표 실패(원장 반영 전 실패 또는 복구에서 실패 확정) |

전표 성격은 `journal_entries.journal_type`으로 분리한다.

- `BUY_ORDER` / `SELL_ORDER` / `ADJUSTMENT`

---

## 1.3 원장 상태 (`ledger_entries`)

원장 판정은 **trade_ref_id 단위**로 한다.

- `DEBIT` 존재 여부
- `CREDIT` 존재 여부

> 복구 로직의 최우선 판정 키는 `ledger_entries`에서 **(trade_ref_id, direction)** 존재 검사다.
> 
> (인덱스: `IDX(trade_ref_id, direction)`)

---

# 2. 정상 시나리오 (락/한도/스냅샷 정책 반영)

## 2.1 BUY_ORDER (매수 주문) — 정상 완료

### 실행 흐름(트랜잭션 내부)

1. 멱등 확인: `order_records.client_request_id`로 기존 요청 존재 여부 확인
2. `order_records` 생성: `NEW`
3. `order_records` → `EXECUTING` 전이 + `executing_started_at` 기록
4. 🔒 `positions` row lock (`SELECT ... FOR UPDATE WHERE account_id=? AND symbol=?`)  
   - BUY 최초 진입으로 행이 없으면 `INSERT ... ON DUPLICATE KEY UPDATE`로 bootstrap 후 잠금
5. (필요 시) `accounts` row lock (`SELECT ... FOR UPDATE WHERE id = :from_account_id`) — 현금 갱신 구간 최소 범위
6. (DEFERRED 계좌이면) Read-Repair 수행 후 `accounts.balance` 최신화
7. 잔액/한도 검증
    - 잔액 검증: `accounts.balance >= amount`
    - 일일 한도 검증: 당일 DEBIT SUM
8. `orders` 생성/멱등 가드(UK: `cl_ord_id`)
9. `journal_entries` 생성(PENDING, `journal_type=BUY_ORDER`)
10. `ledger_entries` 2줄 생성(복식부기)
    - `from_account_id` → `DEBIT`
    - (상대 계정/청산 계정/가상계정 등) → `CREDIT`
    - (필요 시) `ledger_entry_refs` 기록(외부 public_id 단건 조회용)
11. `journal_entries` → `POSTED`
12. `accounts.balance` 갱신(EAGER 또는 Read-Repair 후 + 이번 주문 반영)
13. `order_records` → `FILLED`
- `completed_at` 기록
- 스냅샷 저장: `post_execution_balance`, `result_code`, `result_message`

### 최종 상태 조합

| order_records.status | journal_entries.journal_status | ledger(trade_ref_id) |
| --- | --- | --- |
| FILLED | POSTED | DEBIT + CREDIT |

---

## 2.2 SELL_ORDER (매도 주문) — 정상 완료(포지션 락 포함)

1. 멱등 확인
2. `order_records` NEW → EXECUTING(+ executing_started_at)
3. 🔒 `positions` row lock (`SELECT ... FOR UPDATE WHERE account_id=? AND symbol=?`)
4. (필요 시) `accounts` row lock (`SELECT ... FOR UPDATE`) — 현금 잔액 갱신 구간에서만
5. 매도 가능 수량 검증: `available_qty >= sell_qty`
6. (필요 시) 일일 한도 검증(정책상 매도도 DEBIT가 발생하는 모델이면 동일 적용)
7. `orders` 생성/멱등 가드
8. `journal_entries` 생성(PENDING, `journal_type=SELL_ORDER`)
9. `ledger_entries` 2줄 생성(복식부기)
10. `journal_entries` → POSTED
11. `positions` 갱신(quantity/available_qty/avg_cost, avg_cost는 MVP 가중평균 규칙 적용)
12. `accounts` 갱신(정산 모델에 따라)
13. `order_records` → FILLED + 스냅샷 저장

---

# 3. Timeout / UNCERTAIN (최종 스키마 기준)

타임아웃/불확실 발생 시에도 DB는 “관측 가능한 사실”만으로 판정한다.

가능 상태(대표 3가지)

## Case A — 미실행

- `ledger_entries`: 없음 (DEBIT 없음, CREDIT 없음)
- `journal_entries`: 없음 또는 PENDING
- `order_records`: `EXECUTING` 상태로 멈춤

## Case B — 부분 실행(위험 상태)

- `ledger_entries`: **DEBIT만 존재**
- `ledger_entries`: CREDIT 없음
- `journal_entries`: `PENDING` 또는 (비정상) 존재/불일치 가능
- `order_records`: `EXECUTING`

## Case C — 이미 성공(업무 상태만 미확정)

- `ledger_entries`: **DEBIT + CREDIT 존재**
- `journal_entries`: `POSTED` (정상이라면)
- `order_records`: `EXECUTING` (여기서 멈춤)

> 복구는 “전표 상태”보다 **원장 존재 여부(DEBIT/CREDIT)** 를 우선 신뢰한다.

---

# 4. RecoveryScheduler (최종 설계 반영)

## 4.1 대상 조회 (`executing_started_at` 기준)

```sql
SELECT id, client_request_id, trade_ref_id, status,
       from_account_id, order_id, amount, currency_code,
       executing_started_at
FROM order_records
WHERE status='EXECUTING'
  AND executing_started_at < (NOW(6)-INTERVAL 30 SECOND)
ORDER BY executing_started_at ASC
LIMIT 100;
```

사용 인덱스

- `IDX(status, executing_started_at)`

---

## 4.2 판정 알고리즘 (ledger 기반: trade_ref_id + direction)

### Step 1: CREDIT 존재 여부 (성공 판정)

```sql
SELECT 1
FROM ledger_entries
WHERE trade_ref_id = ?
  AND direction = 'CREDIT'
  AND created_at >= ?
  AND created_at <  ?
LIMIT 1;
```

### Step 2: DEBIT 존재 여부 (부분/미실행 판정)

```sql
SELECT 1
FROM ledger_entries
WHERE trade_ref_id = ?
  AND direction = 'DEBIT'
  AND created_at >= ?
  AND created_at <  ?
LIMIT 1;
```

- 인덱스: `IDX(trade_ref_id, direction)`
- 파티션 프루닝: `created_at` 범위 조건 **필수**
    - 범위 힌트는 `order_records.created_at` 또는 `executing_started_at` 기반으로 “±N일”로 생성한다.

---

## 4.3 판정 테이블

| CREDIT | DEBIT | 판정 | 조치(최종 스키마 기준) |
| --- | --- | --- | --- |
| ❌ | ❌ | 미실행 | `order_records` → `REJECTED` 확정 + (필요 시) `journal_entries FAILED` |
| ❌ | ✅ | 부분 실행/불일치 위험 | 자동 역분개 없이 `order_records` → `ESCALATED` + `failure_reason` 기록 + 수동 Replay/Requery 대기 |
| ✅ | ✅ | 성공 | `order_records` → `FILLED` 확정 + 스냅샷 저장 |

---

# 5. 에스컬레이션 처리 (External Sync Recovery) — 최종 스키마 반영

부분 실행 또는 외부 동기화 불확실(DEBIT만 존재 포함)일 경우, 복구 스케줄러는 아래를 수행한다.

1. `order_records.status = 'ESCALATED'`
2. `order_records.failure_reason`에 `EXTERNAL_SYNC_UNCERTAIN` 등 원인 코드 기록
3. `completed_at` 기록
4. 멱등 응답 스냅샷 저장
   - `post_execution_balance`, `result_code`, `result_message`
5. 운영자 Replay/Requery API로 최종 확정
   - 승인 체결 시 `FILLED`
   - 거절 시 `REJECTED`
   - 거래소 취소 확정 시 `CANCELED`

최종 상태(대표)

| order_records.status | journal_entries.journal_status | ledger |
| --- | --- | --- |
| ESCALATED | POSTED 또는 PENDING | 불확실 상태(자동 역분개 없음, 수동 재처리 대기) |

---

# 6. 멱등(Idempotency) — DB UNIQUE 기반(최종 스키마)

## 6.1 제약

- `order_records.client_request_id UNIQUE`
- `journal_entries.client_request_id UNIQUE`
- `orders.cl_ord_id UNIQUE`
- `executions.exec_id UNIQUE`

중복 요청/중복 이벤트 시

- 신규 생성하지 않음
- 기존 레코드 조회
- **기존 스냅샷** 반환/재사용

---

## 6.2 멱등 응답 안정성(스냅샷)

중복 요청 응답은 반드시 아래 컬럼 기반으로 구성

- `post_execution_balance`
- `result_code`
- `result_message`
- `completed_at`

❌ `accounts.balance` 재조회로 응답 구성 금지

(현재 잔액은 변할 수 있으므로 “당시 결과” 재현 실패)

---

# 7. 복식부기 불변식

## 7.1 DB 레벨

- `ledger_entries.direction`은 DEBIT/CREDIT만 허용(CHECK)
- `ledger_entries.amount > 0` (CHECK)
- `accounts.balance >= 0` (CHECK)
- 계좌번호 digits-only (CHECK REGEXP)
- 상태값은 스키마에 정의된 값만 허용(ENUM 또는 VARCHAR+CHECK)

## 7.2 앱/테스트 레벨(trade_ref_id 단위 정합성)

```sql
SELECT
  SUM(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END) AS net_sum
FROM ledger_entries
WHERE trade_ref_id = ?
  AND created_at >= ?
  AND created_at <  ?;
```

기대값

- 정상 거래(전표 POSTED): `net_sum = 0`
- 정정/조정 전표가 필요할 때도 **각 trade_ref_id 단위로** `net_sum = 0`를 유지한다.

---

# 8. 전체 상태 조합 (최종 스키마 기준)

| order_records.status | journal_entries.journal_status | ledger(trade_ref_id) | 의미 |
| --- | --- | --- | --- |
| NEW | 없음 | 없음 | 요청 수신(업무 레코드만 생성) |
| EXECUTING | PENDING(또는 없음) | 없음 | 실행 시작(락 획득), 아직 원장 반영 전 |
| EXECUTING | PENDING(또는 불일치 가능) | DEBIT만 | **위험 상태(부분 실행)** / 복구 대상 |
| EXECUTING | POSTED | DEBIT + CREDIT | 이미 성공했으나 업무 상태 확정 누락 / 복구로 FILLED 처리 |
| FILLED | POSTED | DEBIT + CREDIT | 정상 완료 |
| REJECTED | FAILED(권장) 또는 없음 | 없음 | 실패 확정 |
| ESCALATED | POSTED 또는 PENDING | DEBIT only 또는 외부 동기화 불확실 | 수동 Replay/Requery 대기 |
