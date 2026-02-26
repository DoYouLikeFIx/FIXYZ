# 계정계 스키마 설계 (v2.0 - Production Ready)

## 1. 목적과 범위

`core_db`는 FIX 프로젝트의 **계정계(CoreBanking)** 원장/전표/이체업무의 **단일 진실 원천**이다.

DB 레벨 목표:
*   Double-entry ledger 기반 원장 무결성
*   Idempotency(client_request_id) 중복 처리 방지
*   Deferred compensation(타행 timeout 불확실) 복구 가능
*   Recovery 스케줄러가 상태를 정확히 판별 가능한 조회 구조
*   계좌번호 정규화(숫자만 저장) + DB 레벨 강제(CHECK REGEXP)
*   balance 음수 방지(DB 제약)
*   멱등 응답 안정성(당시 결과 스냅샷) - JSON Blob 제거 및 정규화
*   외부 노출 식별자 분리(public_id UUID)
*   **동시성 제어는 Pessimistic Lock(SELECT … FOR UPDATE)만 사용(출금 기준)**
*   **일일 한도는 DB 상태 컬럼 없이, 당일 DEBIT 원장을 실시간 SUM 집계로 검증**
*   **ledger_entries 장기 성능: 월 단위 파티셔닝 + 보관/아카이빙 정책**
*   **Hot Account: 입금 Insert-Only(선택) + 출금 Read-Repair(직렬화 전제)**
*   **금액 타입: DECIMAL(19,4)로 통일 (글로벌 확장 대비)**

---

## 2. 핵심 정책(고정)

### 2.1 일일 한도 검증 정책
*   `accounts`에 사용량 컬럼을 두지 않는다.
*   한도 검증은 **당일 출금 원장(ledger_entries.direction='DEBIT')** 을 **실시간 SUM 집계**로 수행한다.

### 2.2 락 정책
*   Optimistic Lock(version) 금지
*   **출금은 accounts row를 SELECT … FOR UPDATE로 직렬화**
*   데드락 방지를 위해 당행 이체 시 두 계좌는 `min(id) → max(id)` 순서로 잠금

### 2.3 Hot Account(Deferred Mode) 정책
*   `balance_update_mode`:
    *   `EAGER`: 기존 방식(모든 변동 시 accounts.balance 갱신)
    *   `DEFERRED`: **입금은 ledger INSERT-only**, 출금 시 Read-Repair로 정산 후 accounts.balance 갱신
*   **Read-Repair 기준은 created_at이 아니라 “정산 워터마크(last_synced_ledger_ref)”로 관리**한다.
*   단, MySQL에서는 “커밋 순서 워터마크”를 DB만으로 안전하게 만들기 어렵기 때문에, **DEFERRED 계좌는 반드시 ‘계좌 키 단일 라이터(인메모리 큐/디스럽터/actor)’를 통해 처리한다**는 운영 전제를 문서에 고정한다.
    *   전제: DEFERRED 계좌의 입금/출금 이벤트는 **account_id 기준 단일 소비자**가 순서대로 처리 → Read-Repair 워터마크가 절대 앞질러 가지 않음.

### 2.4 파티셔닝/아카이빙 정책
*   `ledger_entries`: **월 단위 Range Partition(created_at)**
*   파티션 프루닝을 위해 대용량 조회는 created_at 범위를 WHERE에 포함
*   Retention 예: 최근 12개월 primary 유지, 이전 파티션은 백업 후 DROP PARTITION
*   MySQL 파티셔닝 제약 때문에 `ledger_entries.public_id`에 **글로벌 UNIQUE**는 두지 않는다.
    *   대신 “외부 참조(point lookup)”가 필요하면 **별도 참조 테이블**을 둔다(아래 `ledger_entry_refs`).

### 2.5 금액 타입 정책
*   금액/잔액/한도는 **DECIMAL(19,4)** 로 통일한다.
*   계좌는 `currency_code CHAR(3)`를 가진다(기본 KRW). 동일 계좌 간 이체는 동일 통화만 허용(앱 레벨).

### 2.6 멱등 응답/에러 저장 정책
*   응답/검색에 필요한 최소 필드는 컬럼화:
    *   `result_code`, `result_message(255)`, `post_execution_balance`, `completed_at`
*   상세 진단(긴 메시지/스택 등)은 **별도 테이블**로 분리하여 기본 조회 row size를 키우지 않는다:
    *   `transfer_record_diagnostics.detail TEXT` (필요 시에만 1:1 저장)

---

## 3. core_db 테이블 설계

### 3.1 accounts (계좌 마스터)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| public_id | CHAR(36) | N | UK | 외부 노출 UUID |
| member_id | BIGINT UNSIGNED | N | IDX | 회원 식별자(논리 참조) |
| account_number | VARCHAR(14) | N | UK + CHECK | 숫자만(10~14) |
| bank_code | VARCHAR(16) | N |  | 은행코드 |
| status | ENUM('ACTIVE','FROZEN','CLOSED') | N |  | 계좌 상태 |
| closed_at | DATETIME(6) | Y |  | 해지 시각 |
| currency_code | CHAR(3) | N | DEFAULT 'KRW' | 통화 코드 |
| balance | DECIMAL(19,4) | N | CHECK(balance>=0) | derived cache |
| daily_limit | DECIMAL(19,4) | N | CHECK(daily_limit>0) | 일일 출금 한도 |
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
| transaction_id | CHAR(36) | N | UK | 거래 ID |
| client_request_id | CHAR(36) | N | UK | 멱등키 |
| original_transaction_id | CHAR(36) | Y | IDX | 원본 거래 |
| original_journal_entry_id | BIGINT UNSIGNED | Y | IDX | 원본 전표 참조(논리) |
| journal_type | VARCHAR(32) | N | CHECK | SAME/INTER/COMPENSATION/ADJUSTMENT |
| journal_status | VARCHAR(16) | N | CHECK | PENDING/POSTED/FAILED |
| failure_reason | VARCHAR(255) | Y |  | 실패/불확실 사유 |
| created_at | DATETIME(6) | N |  |  |

*   **인덱스**: `IDX(journal_status, created_at)`, `IDX(journal_type, created_at)`, `IDX(original_transaction_id, created_at)`, `IDX(original_journal_entry_id, created_at)`

### 3.3 transfer_records (업무 레코드)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) |  |
| public_id | CHAR(36) | N | UK | 외부 이체 참조 |
| client_request_id | CHAR(36) | N | UK | 멱등키 |
| transaction_id | CHAR(36) | N | IDX | 거래 ID |
| transfer_type | VARCHAR(16) | N | CHECK | SAME_BANK/INTERBANK |
| status | VARCHAR(16) | N | CHECK | REQUESTED/EXECUTING/COMPLETED/FAILED/COMPENSATED |
| failure_reason | VARCHAR(255) | Y |  | 내부 분기 사유 |
| amount | DECIMAL(19,4) | N | CHECK(amount>0) | 금액 |
| currency_code | CHAR(3) | N | DEFAULT 'KRW' | 통화 코드 |
| from_account_id | BIGINT UNSIGNED | N | FK |  |
| to_account_id | BIGINT UNSIGNED | Y | FK | 당행일 때만 |
| to_account_number | VARCHAR(14) | N | CHECK | 숫자만 |
| to_bank_code | VARCHAR(16) | N |  |  |
| fep_reference_id | CHAR(36) | Y |  |  |
| post_execution_balance | DECIMAL(19,4) | Y |  | 응답용 스냅샷 |
| result_code | VARCHAR(32) | Y |  | 응답 코드 |
| result_message | VARCHAR(255) | Y |  | 사용자 메시지 |
| executing_started_at | DATETIME(6) | Y |  |  |
| completed_at | DATETIME(6) | Y |  |  |
| created_at | DATETIME(6) | N |  |  |
| updated_at | DATETIME(6) | N |  |  |

*   **인덱스**: `IDX(transaction_id)`, `IDX(status, updated_at)`, `IDX(status, executing_started_at)`, `IDX(from_account_id, created_at)`, `IDX(to_account_number, created_at)`
*   **CHECK**: `to_account_number REGEXP '^[0-9]{10,14}$'`

### 3.4 transfer_record_diagnostics (진단/상세 메시지 분리)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| transfer_record_id | BIGINT UNSIGNED | N | PK/FK | transfer_records 1:1 |
| detail | TEXT | Y |  | 긴 메시지/스택/원문 응답(필요 시만) |
| created_at | DATETIME(6) | N |  |  |

### 3.5 ledger_entries (분개 라인, 파티셔닝 대상)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 식별 |
| public_id | CHAR(36) | N |  | 외부 참조(UNIQUE 미강제) |
| journal_entry_id | BIGINT UNSIGNED | N | FK |  |
| transaction_id | CHAR(36) | N | IDX |  |
| account_id | BIGINT UNSIGNED | N | FK |  |
| direction | VARCHAR(8) | N | CHECK | DEBIT/CREDIT |
| amount | DECIMAL(19,4) | N | CHECK(amount>0) |  |
| currency_code | CHAR(3) | N | DEFAULT 'KRW' |  |
| created_at | DATETIME(6) | N |  |  |

*   **인덱스**: `IDX(transaction_id, direction)`, `IDX(account_id, direction, created_at)`
*   **파티셔닝**: 월 단위 Range Partition by `created_at`

### 3.6 ledger_entry_refs (public_id point lookup용)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| public_id | CHAR(36) | N | PK | 전역 유니크 보장 |
| ledger_entry_id | BIGINT UNSIGNED | N |  | ledger_entries.id |
| ledger_created_at | DATETIME(6) | N | IDX | 파티션 프루닝을 위한 힌트 |

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

## 5. Hot Account(DEFERRED) 출금 Read-Repair 규격

*   **전제:** DEFERRED 계좌는 account_id 기준 단일 라이터(큐/디스럽터)로 처리한다.

**출금 시:**
1.  `SELECT ... FOR UPDATE`로 accounts lock
2.  워터마크 이후 반영:
    *   워터마크는 `accounts.last_synced_ledger_ref` (accounts.balance에 마지막으로 반영된 ledger_entries.id 등의 기준값)
3.  `accounts.balance`를 최신화하고 워터마크 갱신
4.  DEBIT ledger insert
5.  `transfer_records` 완료 스냅샷 저장

---

## 6. Partitioning & Retention Policy

*   `ledger_entries`: 월 단위 Range Partition(created_at)
*   모든 대용량 조회는 created_at 범위를 반드시 포함(프루닝)
*   최근 12개월 primary 유지, 이전 파티션은 백업 후 DROP PARTITION
*   파티션 테이블의 전역 UNIQUE 제약 한계를 보완하기 위해 `ledger_entry_refs`를 둔다.
