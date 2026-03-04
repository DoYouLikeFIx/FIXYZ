# 계정계 스키마 설계 (v2.0 - Production Ready)

## 1. 목적과 범위

`core_db`는 FIX 프로젝트의 **계정계(CoreBanking)** 원장/전표/주문·체결업무의 **단일 진실 원천**이다.

DB 레벨 목표:
*   Double-entry ledger 기반 원장 무결성
*   Idempotency(client_request_id) 중복 처리 방지
*   Deferred external-sync recovery(FIX Simulator timeout/불확실) 복구 가능 
*   Recovery 스케줄러가 상태를 정확히 판별 가능한 조회 구조
*   계좌번호 정규화(숫자만 저장) + DB 레벨 강제(CHECK REGEXP)
*   balance 음수 방지(DB 제약)
*   멱등 응답 안정성(당시 결과 스냅샷) - JSON Blob 제거 및 정규화
*   외부 노출 식별자 분리(public_id UUID)
*   **동시성 제어는 Pessimistic Lock(SELECT … FOR UPDATE)만 사용(주문 처리 기준)**
*   **일일 한도는 DB 상태 컬럼 없이, 당일 DEBIT 원장을 실시간 SUM 집계로 검증**
*   **ledger_entries 장기 성능: 월 단위 파티셔닝 + 보관/아카이빙 정책**
*   **Hot Account: 매수 Insert-Only(선택) + 매도 Read-Repair(직렬화 전제)**
*   **금액 타입: DECIMAL(19,4)로 통일 (글로벌 확장 대비)**

---

## 2. 핵심 정책(고정)

### 2.1 일일 한도 검증 정책
*   `accounts`에 사용량 컬럼을 두지 않는다.
*   한도 검증은 **당일 DEBIT 원장(ledger_entries.direction='DEBIT')** 을 **실시간 SUM 집계**로 수행한다.

### 2.2 락 정책
*   Optimistic Lock(version) 금지
*   **주문 실행의 기본 락 범위는 `positions(account_id, symbol)`이다.**
*   매도/매수 체결의 재고(보유수량) 경합은 `SELECT ... FOR UPDATE WHERE account_id = ? AND symbol = ?`로 직렬화한다.
*   `accounts` row lock은 계좌 현금 잔액 갱신이 필요한 구간에서만 최소 범위로 획득한다(교차 종목 블로킹 금지).

### 2.3 Hot Account(Deferred Mode) 정책
*   `balance_update_mode`:
    *   `EAGER`: 기존 방식(모든 변동 시 accounts.balance 갱신)
    *   `DEFERRED`: **매수 체결은 ledger INSERT-only**, 매도 체결 시 Read-Repair로 정산 후 accounts.balance 갱신
*   **Read-Repair 기준은 created_at이 아니라 “정산 워터마크(last_synced_ledger_ref)”로 관리**한다.
*   단, MySQL에서는 “커밋 순서 워터마크”를 DB만으로 안전하게 만들기 어렵기 때문에, **DEFERRED 계좌는 반드시 ‘계좌 키 단일 라이터(인메모리 큐/디스럽터/actor)’를 통해 처리한다**는 운영 전제를 문서에 고정한다.
    *   전제: DEFERRED 계좌의 매수/매도 이벤트는 **account_id 기준 단일 소비자**가 순서대로 처리 → Read-Repair 워터마크가 절대 앞질러 가지 않음.

### 2.4 파티셔닝/아카이빙 정책
*   `ledger_entries`: **월 단위 Range Partition(created_at)**
*   파티션 프루닝을 위해 대용량 조회는 created_at 범위를 WHERE에 포함
*   Retention 예: 최근 12개월 primary 유지, 이전 파티션은 백업 후 DROP PARTITION
*   MySQL 파티셔닝 제약 때문에 `ledger_entries.public_id`에 **글로벌 UNIQUE**는 두지 않는다.
    *   대신 “외부 참조(point lookup)”가 필요하면 **별도 참조 테이블**을 둔다(아래 `ledger_entry_refs`).

### 2.5 금액 타입 정책
*   금액/잔액/한도는 **DECIMAL(19,4)** 로 통일한다.
*   계좌는 `currency_code CHAR(3)`를 가진다(기본 KRW). 동일 계좌 간 정산은 동일 통화만 허용(앱 레벨).

### 2.6 멱등 응답/에러 저장 정책
*   응답/검색에 필요한 최소 필드는 컬럼화:
    *   `result_code`, `result_message(255)`, `post_execution_balance`, `completed_at`
*   상세 진단(긴 메시지/스택 등)은 **별도 테이블**로 분리하여 기본 조회 row size를 키우지 않는다:
    *   `order_record_diagnostics.detail TEXT` (필요 시에만 1:1 저장)

---

## 3. core_db 테이블 설계

### 3.1 accounts (계좌 마스터)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| public_id | CHAR(36) | N | UK | 외부 노출 UUID |
| member_id | BIGINT UNSIGNED | N | IDX | 회원 식별자(논리 참조) |
| account_number | VARCHAR(14) | N | UK + CHECK | 숫자만(10~14) |
| exchange_code | VARCHAR(16) | N |  | 거래소 코드 (FIX Tag 207 SecurityExchange). 예: KRX, KOSDAQ. |
| status | ENUM('ACTIVE','FROZEN','CLOSED') | N |  | 계좌 상태 |
| closed_at | DATETIME(6) | Y |  | 해지 시각 |
| currency_code | CHAR(3) | N | DEFAULT 'KRW' | 통화 코드 |
| balance | DECIMAL(19,4) | N | CHECK(balance>=0) | derived cache |
| daily_limit | DECIMAL(19,4) | N | CHECK(daily_limit>0) | 일일 매매 한도 |
| balance_update_mode | ENUM('EAGER','DEFERRED') | N | DEFAULT 'EAGER' | 잔액 갱신 전략 |
| last_synced_ledger_ref | BIGINT UNSIGNED | Y |  | **DEFERRED 정산 워터마크(큐 직렬화 전제)** |
| created_at | DATETIME(6) | N |  | 생성 |
| updated_at | DATETIME(6) | N |  | 수정 |

*   **인덱스**: `UK(public_id)`, `UK(account_number)`, `IDX(member_id)`, `IDX(status)`, `IDX(member_id, status)`, `IDX(balance_update_mode, updated_at)`
*   **CHECK**: `account_number REGEXP '^[0-9]{10,14}$'`

### 3.2 journal_entries (전표 헤더, append-only)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) |  |
| public_id | CHAR(36) | N | UK | 외부 전표 참조 |
| trade_ref_id | CHAR(36) | N | UK | 주문 참조 ID |
| client_request_id | CHAR(36) | N | UK | 멱등키 |
| original_trade_ref_id | CHAR(36) | Y | IDX | 원본 주문 |
| original_journal_entry_id | BIGINT UNSIGNED | Y | IDX | 원본 전표 참조(논리) |
| journal_type | VARCHAR(32) | N | CHECK | BUY_ORDER/SELL_ORDER/ADJUSTMENT |
| journal_status | VARCHAR(16) | N | CHECK | PENDING/POSTED/FAILED |
| failure_reason | VARCHAR(255) | Y |  | 실패/불확실 사유 |
| created_at | DATETIME(6) | N |  |  |

*   **인덱스**: `IDX(journal_status, created_at)`, `IDX(journal_type, created_at)`, `IDX(original_trade_ref_id, created_at)`, `IDX(original_journal_entry_id, created_at)`

### 3.3 order_records (업무 레코드)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) |  |
| public_id | CHAR(36) | N | UK | 외부 주문 참조 |
| client_request_id | CHAR(36) | N | UK | 멱등키 (채널계 order_sessions.client_request_id 대응) |
| trade_ref_id | CHAR(36) | N | IDX | 주문 참조 ID |
| order_side | VARCHAR(16) | N | CHECK | BUY\|SELL |
| status | VARCHAR(20) | N | CHECK | NEW\|PENDING_NEW\|EXECUTING\|PARTIALLY_FILLED\|FILLED\|CANCELED\|REJECTED\|ESCALATED |
| failure_reason | VARCHAR(255) | Y |  | 내부 분기 사유 |
| amount | DECIMAL(19,4) | N | CHECK(amount>0) | 금액 |
| currency_code | CHAR(3) | N | DEFAULT 'KRW' | 통화 코드 |
| from_account_id | BIGINT UNSIGNED | N | FK |  |
| order_id | BIGINT UNSIGNED | Y | FK | orders.id 참조. 주문이 생성된 경우 연결 |
| fep_reference_id | CHAR(36) | Y |  | FEP 참조 ID (FIX Tag 37 OrderID) |
| post_execution_balance | DECIMAL(19,4) | Y |  | 응답용 스냅샷 |
| result_code | VARCHAR(32) | Y |  | 응답 코드 |
| result_message | VARCHAR(255) | Y |  | 사용자 메시지 |
| executing_started_at | DATETIME(6) | Y |  |  |
| completed_at | DATETIME(6) | Y |  |  |
| created_at | DATETIME(6) | N |  |  |
| updated_at | DATETIME(6) | N |  |  |

*   **인덱스**: `IDX(trade_ref_id)`, `IDX(status, updated_at)`, `IDX(status, executing_started_at)`, `IDX(from_account_id, created_at)`, `IDX(order_id)`

### 3.4 order_record_diagnostics (진단/상세 메시지 분리)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| order_record_id | BIGINT UNSIGNED | N | PK/FK | order_records 1:1 |
| detail | TEXT | Y |  | 긴 메시지/스택/원문 응답(필요 시만) |
| created_at | DATETIME(6) | N |  |  |

### 3.5 ledger_entries (분개 라인, 파티셔닝 대상)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 식별 |
| public_id | CHAR(36) | N |  | 외부 참조(UNIQUE 미강제) |
| journal_entry_id | BIGINT UNSIGNED | N | FK |  |
| trade_ref_id | CHAR(36) | N | IDX |  |
| account_id | BIGINT UNSIGNED | N | FK |  |
| direction | VARCHAR(8) | N | CHECK | DEBIT/CREDIT |
| amount | DECIMAL(19,4) | N | CHECK(amount>0) |  |
| currency_code | CHAR(3) | N | DEFAULT 'KRW' |  |
| created_at | DATETIME(6) | N |  |  |

*   **인덱스**: `IDX(trade_ref_id, direction)`, `IDX(account_id, direction, created_at)`
*   **파티셔닝**: 월 단위 Range Partition by `created_at`

### 3.6 ledger_entry_refs (public_id point lookup용)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| public_id | CHAR(36) | N | PK | 전역 유니크 보장 |
| ledger_entry_id | BIGINT UNSIGNED | N |  | ledger_entries.id |
| ledger_created_at | DATETIME(6) | N | IDX | 파티션 프루닝을 위한 힌트 |
### 3.7 orders (주식 주문 레코드) — Finding #2
> **📌 설계 의도**: `ClOrdID UK`로 FIX 4.2 주문 멱등성을 DB 레벨에서 강제. 비타협 시나리오 #4 "Duplicate ClOrdID → idempotent result"의 물리적 기반.

| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| public_id | CHAR(36) | N | UK | 외부 주문 참조 UUID |
| cl_ord_id | VARCHAR(64) | N | UK | FIX 4.2 ClOrdID (tag 11) — 클라이언트 멱등 키 |
| member_id | BIGINT UNSIGNED | N | IDX | 회원 식별자(논리 참조) |
| account_id | BIGINT UNSIGNED | N | FK | accounts.id — 주문 실행 계좌 |
| symbol | VARCHAR(20) | N |  | 종목코드 (FIX tag 55, 예: `005930`) |
| side | VARCHAR(10) | N | CHECK | BUY\|SELL (FIX tag 54: 1=BUY, 2=SELL) |
| ord_type | VARCHAR(20) | N | CHECK | MARKET\|LIMIT (FIX tag 40) |
| price | DECIMAL(19,4) | Y |  | 지정가(LIMIT일 때 필수, MARKET이면 NULL, FIX tag 44) |
| pre_trade_price | DECIMAL(19,4) | Y |  | MARKET 사전검증 기준 가격 (`qty × pre_trade_price`) |
| quote_snapshot_id | VARCHAR(64) | Y | IDX | MARKET 사전검증/체결근거 snapshot 식별자 |
| quote_as_of | DATETIME(6) | Y |  | MARKET snapshot 기준 시각 (staleness 검증 기준) |
| quote_source_mode | VARCHAR(16) | Y | CHECK | LIVE\|DELAYED\|REPLAY |
| ord_qty | BIGINT UNSIGNED | N | CHECK(ord_qty>0) | 주문 수량 (FIX tag 38) |
| status | VARCHAR(20) | N | CHECK | NEW\|PENDING_NEW\|EXECUTING\|PARTIALLY_FILLED\|FILLED\|CANCELED\|REJECTED |
| external_sync_status | VARCHAR(20) | Y | CHECK | CONFIRMED\|FAILED\|ESCALATED (post-commit 외부 동기화 상태, pre-sync 단계는 NULL 허용) |
| cum_qty | BIGINT UNSIGNED | N | DEFAULT 0 | 누적 체결 수량 (FIX tag 14) |
| avg_px | DECIMAL(19,4) | Y |  | 평균 체결가 (FIX tag 6) |
| leaves_qty | BIGINT UNSIGNED | N | DEFAULT 0 | 미체결 잔량 (FIX tag 151) |
| fep_reference_id | VARCHAR(64) | Y |  | FEP 주문 참조 ID |
| failure_reason | VARCHAR(255) | Y |  | 실패/거절 사유 코드 |
| executing_started_at | DATETIME(6) | Y |  | EXECUTING 전이 시각(timeout 판정 독립 기준) |
| completed_at | DATETIME(6) | Y |  | 최종 상태 도달 시각 |
| created_at | DATETIME(6) | N |  | 주문 생성 |
| updated_at | DATETIME(6) | N |  | 최종 상태 변경 |

*   **인덱스**: `UK(public_id)`, `UK(cl_ord_id)`, `IDX(member_id, created_at)`, `IDX(account_id, symbol, created_at)`, `IDX(symbol, status)`, `IDX(status, executing_started_at)`, `IDX(status, updated_at)`, `IDX(quote_snapshot_id, created_at)`
*   **CHECK**: `(ord_type = 'LIMIT' AND price IS NOT NULL) OR (ord_type = 'MARKET' AND pre_trade_price IS NOT NULL AND quote_snapshot_id IS NOT NULL AND quote_as_of IS NOT NULL AND quote_source_mode IS NOT NULL)`
*   **CHECK**: `leaves_qty + cum_qty = ord_qty` — 앱 레이어 강제 (체결 수량 합산 정합성)

### 3.8 positions (포지션 원장) — Finding #3
> **📌 설계 의도**: `SELECT FOR UPDATE on (account_id, symbol)` — 비타협 시나리오 #2 "10-thread concurrent sell → exactly 5 FILLED, available_qty = 0"의 락 타깃. 동시 매도 과매도 방어의 물리적 기반.

| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| account_id | BIGINT UNSIGNED | N | FK | accounts.id — 락 조인 키 |
| symbol | VARCHAR(20) | N |  | 종목코드 |
| quantity | BIGINT UNSIGNED | N | DEFAULT 0, CHECK(>=0) | 총 보유 수량 (양수 강제) |
| available_qty | BIGINT UNSIGNED | N | DEFAULT 0, CHECK(>=0) | 주문 가능 수량 (`quantity` 이하, 미체결 주문 차감 후) |
| avg_cost | DECIMAL(19,4) | Y |  | 평균 매입 단가 (MVP: 가중평균 방식, SELL 시 보존) |
| created_at | DATETIME(6) | N |  | 최초 포지션 생성 |
| updated_at | DATETIME(6) | N |  | 마지막 체결/변경 시각 |

*   **인덱스**: `UK(account_id, symbol)` (락 타깃 유니크 조합), `IDX(symbol)`, `IDX(account_id, available_qty)`
*   **락 정책**: 주문 실행 시 `SELECT ... FOR UPDATE WHERE account_id = ? AND symbol = ?` — `@Lock(PESSIMISTIC_WRITE)` via QueryDSL/JPA
*   **최초 매수(행 부재) 정책**: BUY 실행 전에 `INSERT ... ON DUPLICATE KEY UPDATE`로 `(account_id, symbol)` 행을 bootstrap한 뒤 동일 트랜잭션에서 `FOR UPDATE` 잠금을 획득한다.
*   **CHECK**: `available_qty <= quantity`

### 3.9 executions (체결 이력, 로컬 매칭 Canonical) — Finding #4
> **📌 설계 의도**: 모의투자 기준 체결 진실원천은 CoreBanking 로컬 Order Book 매칭 결과다. 로컬 매칭 체결 이벤트를 Append-Only로 기록하고, FEP `ExecutionReport(35=8)`는 확인/복구 신호로 참조한다. `SUM(BUY executed_qty) − SUM(SELL executed_qty) == positions.quantity` 정합성 검증(시나리오 #7)의 진실 원천.

| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| public_id | CHAR(36) | N | UK | 외부 체결 참조 UUID |
| exec_id | VARCHAR(64) | N | UK | 로컬 canonical execution ID (로컬 매칭 멱등 키) |
| external_exec_id | VARCHAR(64) | Y | UK | FEP ExecID (FIX tag 17) — 외부 확인/복구 상관관계 키 |
| order_id | BIGINT UNSIGNED | N | FK | orders.id |
| cl_ord_id | VARCHAR(64) | N | IDX | FIX tag 11 (주문-체결 역방향 조회용) |
| exec_type | VARCHAR(10) | N | CHECK | NEW\|TRADE\|CANCELED\|REJECTED\|REPLACE (FIX tag 150) |
| ord_status | VARCHAR(20) | N | CHECK | NEW\|PARTIALLY_FILLED\|FILLED\|CANCELED\|REJECTED (FIX tag 39) |
| symbol | VARCHAR(20) | N |  | 종목코드 (FIX tag 55) |
| side | VARCHAR(10) | N | CHECK | BUY\|SELL (FIX tag 54) |
| executed_qty | BIGINT UNSIGNED | N | DEFAULT 0 | 이번 체결 수량 (FIX tag 32 LastQty, TRADE 외에는 0) |
| executed_price | DECIMAL(19,4) | Y |  | 이번 체결가 (FIX tag 31 LastPx, TRADE일 때만 non-NULL) |
| cum_qty | BIGINT UNSIGNED | N | DEFAULT 0 | 누적 체결 수량 (FIX tag 14) |
| leaves_qty | BIGINT UNSIGNED | N | DEFAULT 0 | 미체결 잔량 (FIX tag 151) |
| quote_snapshot_id | VARCHAR(64) | Y | IDX | 체결 시 사용한 quote snapshot 식별자 (추적성 키) |
| quote_as_of | DATETIME(6) | Y |  | 체결 근거 snapshot 기준 시각 |
| quote_source_mode | VARCHAR(16) | Y | CHECK | LIVE\|DELAYED\|REPLAY |
| fep_reference_id | VARCHAR(64) | Y |  | FEP/Simulator 참조 ID |
| created_at | DATETIME(6) | N |  | 로컬 체결 기록 시각 (Append-Only) |

*   **인덱스**: `UK(exec_id)`, `UK(external_exec_id)`(NULL 허용), `IDX(order_id, created_at)`, `IDX(cl_ord_id, created_at)`, `IDX(symbol, side, created_at)`, `IDX(quote_snapshot_id, created_at)` (시나리오 #7 정합성 검증 쿼리용)
*   **불변 정책**: Append-Only — UPDATE/DELETE 금지. 체결 취소는 `exec_type = 'CANCELED'` 신규 행으로 기록.
*   **추적 정책**: `exec_type='TRADE'` 체결 행은 원 주문(`orders`)의 `quote_snapshot_id/quote_as_of/quote_source_mode`를 복제해 MARKET 체결 근거를 항상 역추적 가능하게 유지한다.
*   **시나리오 #7 검증 쿼리**:
    ```sql
    SELECT
        SUM(CASE WHEN side = 'BUY'  AND exec_type = 'TRADE' THEN executed_qty ELSE 0 END)
      - SUM(CASE WHEN side = 'SELL' AND exec_type = 'TRADE' THEN executed_qty ELSE 0 END)
        AS expected_qty
    FROM executions
    WHERE symbol = ?
      AND order_id IN (SELECT id FROM orders WHERE account_id = ?);
	    -- expected_qty == positions.quantity (해당 account_id, symbol 기준)
	    ```

### 3.10 position_pnl_snapshots (평가/실현 손익 스냅샷)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| account_id | BIGINT UNSIGNED | N | FK | accounts.id |
| symbol | VARCHAR(20) | N | IDX | 종목코드 |
| mark_price | DECIMAL(19,4) | N | CHECK(mark_price>=0) | 평가 기준 가격 |
| unrealized_pnl | DECIMAL(19,4) | N |  | 평가손익 |
| realized_pnl_daily | DECIMAL(19,4) | N |  | 당일 실현손익 |
| as_of | DATETIME(6) | N | IDX | 시세 스냅샷 기준 시각 |
| source_mode | VARCHAR(16) | N | CHECK | LIVE\|DELAYED\|REPLAY |
| created_at | DATETIME(6) | N |  | 스냅샷 적재 시각 |

*   **인덱스**: `IDX(account_id, symbol, as_of)`, `IDX(source_mode, as_of)`
*   **정책**: stale quote(`now - as_of > maxQuoteAgeMs`) 구간은 스냅샷 적재/노출 대상에서 제외한다.
---

## 4. “당일 DEBIT SUM” 기반 한도 검증 쿼리 규격

```sql
SELECT COALESCE(SUM(amount), 0) AS today_debit_sum
FROM ledger_entries
WHERE account_id = ?
  AND direction = 'DEBIT'
  AND created_at >= ?
  AND created_at <  ?;
```

---

## 5. Hot Account(DEFERRED) 주문 처리 Read-Repair 규격

*   **전제:** DEFERRED 계좌는 account_id 기준 단일 라이터(큐/디스럽터)로 처리한다.

**주문 체결 시:**
1.  주문 대상 `positions(account_id, symbol)` row를 `SELECT ... FOR UPDATE`로 잠근다.
2.  현금 잔액 갱신이 필요한 구간에서만 `accounts` row를 최소 범위로 잠근다.
3.  워터마크 이후 반영:
    *   워터마크는 `accounts.last_synced_ledger_ref` (accounts.balance에 마지막으로 반영된 ledger_entries.id 등의 기준값)
4.  `accounts.balance`를 최신화하고 워터마크 갱신
5.  DEBIT ledger insert
6.  `order_records` 주문 체결 결과 스냅샷 저장 (로컬 canonical 체결 + 외부 확인 상태 포함)

---

## 6. Partitioning & Retention Policy

*   `ledger_entries`: 월 단위 Range Partition(created_at)
*   모든 대용량 조회는 created_at 범위를 반드시 포함(프루닝)
*   최근 12개월 primary 유지, 이전 파티션은 백업 후 DROP PARTITION
*   파티션 테이블의 전역 UNIQUE 제약 한계를 보완하기 위해 `ledger_entry_refs`를 둔다.
