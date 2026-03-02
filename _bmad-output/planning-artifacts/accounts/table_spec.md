# Table Specification (core_db v2.0)

## 공통 원칙

*   **Dual Key**: 내부 조인/락/성능용 `id` `BIGINT UNSIGNED AUTO_INCREMENT` + 외부 노출용 `public_id` `CHAR(36) UNIQUE`
*   **Append-only 원칙**
    *   `journal_entries`, `ledger_entries`, `executions`: UPDATE/DELETE 금지(정책)
    *   상태/정정은 새 행(보상/취소 이벤트) 로 표현
*   **Idempotency**
    *   주문/전표/업무레코드의 핵심 멱등 키는 `client_request_id UNIQUE`
*   **금액 타입**
    *   금액/잔액/한도/가격: `DECIMAL(19,4)`
*   **파티셔닝**
    *   `ledger_entries`는 월 단위 Range Partition(`created_at`)
    *   파티션 제약 때문에 `ledger_entries.public_id` 전역 UNIQUE 금지
    *   외부 단건 조회는 `ledger_entry_refs`(`public_id` PK) 사용
*   **동시성**
    *   주문 정산은 `accounts`를 `SELECT … FOR UPDATE`로 직렬화(Optimistic 금지)
    *   매도 과매도 방지는 `positions` (`account_id`, `symbol`)을 `SELECT … FOR UPDATE`로 직렬화

---

## 1) accounts (계좌 마스터)

### 1.1 테이블 목적

`accounts`는 계좌의 “현재 상태를 빠르게 보여주기 위한 캐시 + 동시성 락 타깃”이다.
*   ledger가 진실이지만, 매 요청마다 원장을 합산하면 비용이 크므로 `balance`는 derived cache 로 저장
*   주문 체결 시 `SELECT … FOR UPDATE`의 락 타깃
*   계좌 종료는 삭제가 아니라 `status=CLOSED` + `closed_at`로 남겨 감사/추적성 유지
*   일일 한도는 사용량 컬럼 없이 당일 DEBIT 합산으로 검증(원장 기반 정책)

### 1.2 컬럼 명세

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` | 내부 조인/락 성능을 위한 숫자 PK |
| `public_id` | 외부 노출 UUID(내부 PK 은닉) |
| `member_id` | 채널계 회원 논리 참조(회원 단위 계좌 조회) |
| `account_number` | 계좌 업무 키(중복 방지 + 빠른 조회). 숫자만 저장(CHECK REGEXP) |
| `exchange_code` | 거래소 코드(FIX Tag 207). 다중 거래소 확장 대비 |
| `status` | 계좌 가용 상태(ACTIVE/FROZEN/CLOSED) 강제 |
| `closed_at` | 해지 이벤트 시각(감사/분쟁 대응) |
| `currency_code` | 통화 코드(기본 KRW), 다통화 대비 |
| `balance` | 현재 잔액 캐시. CHECK로 음수 차단 |
| `daily_limit` | 정책 값 저장. 사용량은 원장 합산으로 계산 |
| `balance_update_mode` | EAGER/DEFERRED 전략 지정 |
| `last_synced_ledger_ref` | DEFERRED Read-Repair 워터마크(`ledger_entries.id` 기반) |
| `created_at`, `updated_at` | 운영/감사/배치/모니터링 기본 |

### 1.3 제약/인덱스

*   **UK**(`public_id`)
*   **UK**(`account_number`)
*   **IDX**(`member_id`)
*   **IDX**(`status`)
*   **IDX**(`member_id`, `status`) : 회원의 활성 계좌 조회
*   **IDX**(`balance_update_mode`, `updated_at`) : DEFERRED 계좌 모니터링/스캔
*   **CHECK**
    *   `account_number REGEXP '^[0-9]{10,14}$'`
    *   `balance >= 0`
    *   `daily_limit > 0`

---

## 2) journal_entries (전표 헤더, append-only)

### 2.1 테이블 목적

`journal_entries`는 주문(`trade_ref_id`) 단위의 전표 헤더다.
*   ledger 라인만 있으면 “업무 유형/상태/실패 사유/보상 관계”를 빠르게 파악하기 어렵다
*   전표 헤더로:
    *   전표 유형(BUY/SELL/COMPENSATION/ADJUSTMENT)
    *   전표 상태(PENDING/POSTED/FAILED)
    *   실패/불확실 사유
    *   원본-보상 추적(`original_*`)
        를 일관되게 관리
*   Append-only로 감사/증빙에 적합

### 2.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `id` | `ledger_entries`가 참조하는 내부 PK |
| `public_id` | 외부 전표 참조(로그/감사/CS) |
| `trade_ref_id` | 주문 참조 ID. 전표 헤더 1개로 강제(UK) |
| `client_request_id` | 멱등 키(전표 중복 생성 방지) |
| `original_trade_ref_id` | 보상/조정의 “원본 주문” 추적 |
| `original_journal_entry_id` | 보상/조정의 “원본 전표” 추적(논리 참조) |
| `journal_type` | 전표 성격(BUY_ORDER/SELL_ORDER/COMPENSATION/ADJUSTMENT) |
| `journal_status` | 원장 반영 관점 상태(PENDING/POSTED/FAILED) |
| `failure_reason` | 실패/불확실 사유(운영/복구 분기 근거) |
| `created_at` | 발생 시각(타임라인/감사) |

### 2.3 제약/인덱스

*   **UK**(`public_id`)
*   **UK**(`trade_ref_id`) : “한 주문 = 전표 헤더 1개” 고정
*   **UK**(`client_request_id`) : 멱등
*   **IDX**(`journal_status`, `created_at`) : 미처리/실패 전표 운영 스캔
*   **IDX**(`journal_type`, `created_at`) : 보상/조정 전표만 조회
*   **IDX**(`original_trade_ref_id`, `created_at`) : 원본 기준 타임라인
*   **IDX**(`original_journal_entry_id`, `created_at`) : 원본 전표 기준 타임라인
*   **CHECK**(정책)
    *   `journal_type IN ('BUY_ORDER', 'SELL_ORDER', 'COMPENSATION', 'ADJUSTMENT')`
    *   `journal_status IN ('PENDING', 'POSTED', 'FAILED')`

---

## 3) order_records (업무 레코드)

### 3.1 테이블 목적

`order_records`는 “원장만으로 표현하기 어려운 업무 상태 머신 + 멱등 응답 스냅샷”을 저장한다.
*   주문 요청 타임라인, 현재 업무 상태, 실패/불확실 사유, timeout 판정용 시각을 보존
*   중복 요청 시 “현재 상태”가 아니라 당시 결과 그대로 재현(멱등 응답 안정성)

### 3.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `id` | 내부 PK |
| `public_id` | 외부 주문 참조 UUID |
| `client_request_id` | 업무 멱등 키(채널 order_sessions 대응) |
| `trade_ref_id` | 전표/원장 관통 주문 참조(확장 여지 위해 IDX) |
| `order_side` | BUY/SELL 분기 |
| `status` | 업무 상태 머신(복구/응답 분기 기준) |
| `failure_reason` | 실패/불확실 사유 |
| `amount` | 주문 금액(조회/응답/리포트 최빈 값이라 역정규화 저장) |
| `currency_code` | 통화 코드 |
| `from_account_id` | 증거금 계좌(락 타깃) |
| `order_id` | FIX 주문(`orders`)와 연결(생성된 경우만) |
| `fep_reference_id` | FEP 주문 참조(FIX Tag 37), 조사/복구 근거 |
| `post_execution_balance` | 멱등 응답 스냅샷(주문 후 잔액) |
| `result_code` | 응답 코드(컬럼화) |
| `result_message` | 사용자 메시지(컬럼화) |
| `executing_started_at` | EXECUTING 전이 시각(Timeout 판정 독립 기준) |
| `completed_at` | 최종 상태 도달 시각 |
| `created_at`, `updated_at` | 타임라인/운영/복구 스캔 |

### 3.3 제약/인덱스

*   **UK**(`public_id`)
*   **UK**(`client_request_id`) : 멱등 1차 방어
*   **IDX**(`trade_ref_id`)
*   **IDX**(`status`, `updated_at`) : recovery 스캔 핵심
*   **IDX**(`status`, `executing_started_at`) : EXECUTING timeout 판정/스캔
*   **IDX**(`from_account_id`, `created_at`) : 계좌 기준 주문 조회
*   **IDX**(`order_id`) : 주문 연결 조회
*   **FK**(물리)
    *   `from_account_id -> accounts.id`
    *   `order_id -> orders.id (nullable)`
*   **CHECK**(정책)
    *   `order_side IN ('BUY','SELL')`
    *   `status IN (...)`
    *   `amount > 0`

---

## 4) order_record_diagnostics (진단/상세 분리)

### 4.1 테이블 목적

메인(`order_records`) row size를 키우지 않기 위해, 긴 진단/원문/스택을 1:1로 분리 저장한다.

### 4.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `order_record_id` | 1:1 연결(PK=FK) |
| `detail` | 긴 메시지/스택/원문 응답(TEXT) |
| `created_at` | 생성 시각 |

### 4.3 제약/인덱스

*   **PK**(`order_record_id`) + **FK**(`order_record_id -> order_records.id`)

---

## 5) ledger_entries (분개 라인, append-only, partitioned)

### 5.1 테이블 목적

`ledger_entries`는 복식부기 원장의 본체(분개 라인) 이다.
*   모든 금전 변동의 최종 진실(Source of Record)
*   Append-only로 감사/추적 가능성 극대화
*   일일 한도는 당일 DEBIT 합산으로 검증하므로, (`account_id`, `direction`, `created_at`)이 핵심 쿼리 경로
*   월 단위 파티셔닝으로 장기 성능/보관 정책 지원

### 5.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `id` | 내부 PK(파티션 환경에서도 안전한 참조 키) |
| `public_id` | 외부 참조용 UUID(전역 UNIQUE는 refs로 우회) |
| `journal_entry_id` | 전표 헤더 연결(라인 묶음) |
| `trade_ref_id` | 업무/전표/원장 관통 키(복구 판정에 사용) |
| `account_id` | 계좌별 내역/합산/한도 검증 핵심 |
| `direction` | DEBIT/CREDIT 구분(한도/복구/정합성 핵심) |
| `amount` | 절대값 금액(`DECIMAL(19,4)`), CHECK(`amount>0`) |
| `currency_code` | 통화 코드 |
| `created_at` | 시간축/파티션 키/당일 집계 키 |

### 5.3 제약/인덱스/파티션

*   **파티션**: 월 단위 `RANGE(created_at)`
*   **인덱스**
    *   **IDX**(`trade_ref_id`, `direction`) : “CREDIT 존재 여부” 등 복구/가드
    *   **IDX**(`account_id`, `direction`, `created_at`) : 당일 DEBIT SUM 최적화
*   **FK**
    *   `journal_entry_id -> journal_entries.id`
    *   `account_id -> accounts.id`
*   **CHECK**(정책)
    *   `direction IN ('DEBIT','CREDIT')`
    *   `amount > 0`
*   **제약(중요)**
    *   `public_id`는 전역 UNIQUE 금지 (파티셔닝 제약)

---

## 6) ledger_entry_refs (public_id point lookup 보조)

### 6.1 테이블 목적

`ledger_entries`가 파티셔닝으로 전역 UNIQUE를 못 거는 문제를 보완하기 위해, `public_id` 기반 단건 조회를 위한 글로벌 인덱스 역할을 한다.

### 6.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `public_id` | 전역 유니크 보장(PK) |
| `ledger_entry_id` | 실제 `ledger_entries.id` |
| `ledger_created_at` | 파티션 프루닝 힌트(조회 시 `created_at` 범위 유도) |

### 6.3 제약/인덱스

*   **PK**(`public_id`)
*   **IDX**(`ledger_created_at`)
*   (권장) `ledger_entry_id`에 FK를 둘지 여부는 운영/파티션 전략에 따라 선택
    (설계 상 “`ledger_entries.id` 참조”는 논리적으로 유지)

---

## 7) orders (주식 주문 레코드, FIX 4.2)

### 7.1 테이블 목적

`orders`는 FIX 주문 자체(`ClOrdID` 기반 멱등)를 저장한다.
*   `cl_ord_id UNIQUE`로 FIX Tag 11 멱등을 DB에서 강제
*   주문의 상태/수량/가격/누적체결 등 FIX 스펙 필드를 저장
*   체결 이벤트(`executions`)의 부모 엔티티

### 7.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `id` | 내부 PK |
| `public_id` | 외부 주문 참조 |
| `cl_ord_id` | FIX Tag 11 멱등 키(UK) |
| `member_id` | 회원 논리 참조 |
| `account_id` | 주문 실행 계좌(FK) |
| `symbol` | 종목 코드(FIX Tag 55) |
| `side` | BUY/SELL (FIX Tag 54) |
| `ord_type` | MARKET/LIMIT (FIX Tag 40) |
| `price` | LIMIT일 때 필수(FIX Tag 44) |
| `ord_qty` | 주문 수량(>0) |
| `status` | 주문 상태 머신 |
| `cum_qty` | 누적 체결 수량 |
| `avg_px` | 평균 체결가 |
| `leaves_qty` | 미체결 잔량 |
| `fep_reference_id` | FEP 주문 참조 |
| `failure_reason` | 거절/실패 코드 |
| `executing_started_at` | EXECUTING 전이 시각 |
| `completed_at` | 최종 상태 도달 시각 |
| `created_at`, `updated_at` | 생성/상태 변경 시각 |

### 7.3 제약/인덱스

*   **UK**(`public_id`)
*   **UK**(`cl_ord_id`) : FIX 멱등
*   **IDX**(`member_id`, `created_at`)
*   **IDX**(`account_id`, `symbol`, `created_at`)
*   **IDX**(`symbol`, `status`)
*   **IDX**(`status`, `executing_started_at`)
*   **IDX**(`status`, `updated_at`)
*   **FK**
    *   `account_id -> accounts.id`
*   **CHECK**(정책)
    *   `(ord_type='LIMIT' AND price IS NOT NULL) OR (ord_type='MARKET')`
    *   `ord_qty > 0`
    *   `side IN ('BUY','SELL')`
*   **정합성**(앱 레이어 고정)
    *   `leaves_qty + cum_qty = ord_qty`

---

## 8) positions (포지션 원장)

### 8.1 테이블 목적

`positions`는 계좌-종목 단위 보유수량을 관리하며, 동시 매도 과매도 방지를 위해 (`account_id`, `symbol`)을 락 타깃으로 삼는다.

### 8.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `id` | 내부 PK |
| `account_id` | 계좌 FK(락 조인 키) |
| `symbol` | 종목 |
| `quantity` | 총 보유 수량(>=0) |
| `available_qty` | 주문 가능 수량(>=0, `quantity` 이하) |
| `avg_cost` | 평균 매입 단가 |
| `created_at`, `updated_at` | 생성/변경 시각 |

### 8.3 제약/인덱스/락 정책

*   **UK**(`account_id`, `symbol`) : 락 타깃 유니크 조합
*   **IDX**(`symbol`)
*   **IDX**(`account_id`, `available_qty`)
*   **FK**
    *   `account_id -> accounts.id`
*   **CHECK**(정책)
    *   `quantity >= 0`
    *   `available_qty >= 0`
    *   `available_qty <= quantity`
*   **락 정책(고정)**
    *   매도 실행 시: `SELECT ... FOR UPDATE WHERE account_id=? AND symbol=?`

---

## 9) executions (체결 이력, append-only)

### 9.1 테이블 목적

`executions`는 FEP에서 들어오는 ExecutionReport(35=8)를 Append-only로 저장한다.
*   `exec_id UNIQUE`로 외부 체결 멱등을 강제
*   체결 이벤트의 진실 원천:
    `SUM(BUY TRADE last_qty) - SUM(SELL TRADE last_qty) == positions.quantity` 검증 가능

### 9.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `id` | 내부 PK |
| `public_id` | 외부 체결 참조 |
| `exec_id` | FIX Tag 17 멱등 키(UK) |
| `order_id` | `orders` FK |
| `cl_ord_id` | 역방향 조회용(FIX Tag 11) |
| `exec_type` | 이벤트 종류(FIX Tag 150) |
| `ord_status` | 주문 상태(FIX Tag 39) |
| `symbol` | 종목 |
| `side` | BUY/SELL |
| `last_qty` | 이번 체결 수량(TRADE 외 0) |
| `last_px` | 이번 체결가(TRADE만) |
| `cum_qty` | 누적 체결 수량 |
| `leaves_qty` | 미체결 잔량 |
| `fep_reference_id` | 외부 참조 |
| `created_at` | 수신 시각(append-only) |

### 9.3 제약/인덱스/불변 정책

*   **UK**(`public_id`)
*   **UK**(`exec_id`) : 체결 멱등
*   **IDX**(`order_id`, `created_at`)
*   **IDX**(`cl_ord_id`, `created_at`)
*   **IDX**(`symbol`, `side`, `created_at`)
*   **FK**
    *   `order_id -> orders.id`
*   **불변 정책(고정)**
    *   UPDATE/DELETE 금지
    *   체결 취소는 `exec_type='CANCELLED'` 신규 행으로 기록

---

## 부록 A. 한도 검증 표준 쿼리

```sql
SELECT COALESCE(SUM(amount), 0) AS today_debit_sum
FROM ledger_entries
WHERE account_id = ?
  AND direction = 'DEBIT'
  AND created_at >= ?
  AND created_at <  ?;
```
*   **인덱스**: `IDX(account_id, direction, created_at)`로 커버
*   “오늘/내일 00:00” 경계는 서비스가 타임존 확정 후 파라미터로 전달

## 부록 B. DEFERRED Read-Repair 처리 요약

*   **전제**: DEFERRED 계좌는 `account_id` 기준 단일 라이터로 처리.
    1.  `SELECT ... FOR UPDATE`로 `accounts` lock
    2.  `last_synced_ledger_ref` 이후 ledger들을 반영해 `accounts.balance` 최신화
    3.  워터마크 갱신
    4.  DEBIT ledger insert
    5.  `order_records` 스냅샷 저장
