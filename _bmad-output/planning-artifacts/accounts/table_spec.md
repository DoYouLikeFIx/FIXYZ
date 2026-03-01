# Table Specification (v2.0)

## 1) `accounts` (계좌 마스터)

### 1.1 테이블 목적(왜 필요한가)

`accounts`는 계좌의 “현재 화면/업무 처리에 필요한 상태”를 **빠르게 조회**하기 위한 **마스터 테이블**이다.

- 원장(ledger)이 진실이지만, 매 요청마다 ledger를 합산하면 비용이 크므로
    
    **현재 잔액(balance)은 캐시(derived cache)** 로 `accounts`에 둔다.
    
- 주문 체결 시 **동시성 제어의 락 타겟(row lock)** 이 된다.
    
    → `SELECT ... FOR UPDATE`로 계좌 row를 잠그고, 중복 주문 처리/경합을 원천 차단한다.
    
- 계좌 종료는 삭제가 아니라 **상태 + 종료시각**으로 남긴다.
    
    → 감사/추적성(증권 도메인 핵심)을 유지한다.
    
- 일일 한도는 “사용량 컬럼” 없이, **당일 DEBIT 원장 합산으로 검증**한다.
    
    → PRD/아키텍처의 혁신 포인트를 DB 스키마가 그대로 지지한다.
    

### 1.2 컬럼 명세(왜 필요한가)

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 내부 조인/락/인덱스 성능을 위한 **숫자 PK**. 트랜잭션 중 row lock 대상이 되므로 짧고 효율적인 키가 유리. |
| `public_id` (UUID, UK) | 외부 API/URL/로그에 노출되는 **예측 불가능 식별자**. 내부 PK 유출을 방지하고, 추적성을 높임. |
| `member_id` (IDX) | 채널계(channel_db)의 회원을 참조하는 **논리 키**. core_db는 인증/회원 도메인을 가지지 않으므로 FK 불가. 그래도 “회원의 계좌 목록” 같은 요구를 위해 저장 필요. |
| `account_number` (UK) | 실제 계좌 조회/주문 정산 대상 식별에 쓰이는 **업무 키**. 숫자만 저장해 인덱스 효율을 확보하고, 중복 계좌번호 생성을 DB에서 차단. |
| `exchange_code` | 거래소 코드 (FIX Tag 207 SecurityExchange). 예: KRX, KOSDAQ. 무다중 거래소 확장 대비. |
| `status` (ENUM) | 계좌의 현재 업무 가능 상태를 명확히 제한(ACTIVE/FROZEN/CLOSED). "종료/동결 계좌 주문 차단" 같은 핵심 정책을 단순하게 구현 가능. |
| `closed_at` | 계좌 종료 이벤트의 **도메인 의미를 가진 타임스탬프**. 삭제 대신 종료 시각을 남겨 감사/분쟁 대응/이력 분석에 사용. |
| `currency_code` (CHAR 3) | **(v2.0 추가)** 글로벌 확장 및 다통화 지원 대비. 기본값 'KRW'. |
| `balance` (DECIMAL) | 화면/검증/리턴을 위한 **현재 잔액 캐시**. `DECIMAL(19,4)`로 정밀도 보장. `CHECK(balance >= 0)` 제약으로 버그성 초과 잔액 처리 차단. |
| `daily_limit` (DECIMAL) | “정책 값”만 저장. 실제 사용량은 ledger 합산으로 검증하므로 상태 컬럼은 두지 않음. `DECIMAL(19,4)` 사용. |
| `balance_update_mode` (ENUM) | **(v2.0 추가)** `EAGER`(기본) vs `DEFERRED`(Hot Account). 계좌별 갱신 전략을 DB 레벨에서 명시. |
| `last_synced_ledger_ref` | **(v2.0 추가)** `DEFERRED` 모드일 때, 마지막으로 balance에 반영된 ledger ID(워터마크). Read-Repair의 기준점. |
| `created_at`, `updated_at` | 변경 추적/운영 감사/배치 분석의 기본. 상태 변경 이력(동결/해지 등) 분석에도 필수. |

### 1.3 인덱스가 필요한 이유

- `UK(account_number)`: 계좌번호로 직접 조회/주문 정산 검증이 많음 + 중복 방지
- `IDX(member_id, status)`: “특정 회원의 활성 계좌만 조회”가 매우 흔함
- `IDX(status)`: 동결/해지 계좌 필터링 등 운영성 조회
- `IDX(balance_update_mode, updated_at)`: Hot Account 모니터링 및 배치 정산 대상 식별

---

## 2) `journal_entries` (전표 헤더, append-only)

### 2.1 테이블 목적(왜 필요한가)

`journal_entries`는 **주문 1건(trade_ref_id)** 에 대한 **전표의 헤더(요약/상태/종류)** 를 저장한다.

- ledger_entries(라인)만 있으면 "이 주문이 어떤 유형의 업무였는지/상태가 무엇인지/실패 사유가 무엇인지"를 파악하기 어렵다.
- 전표 헤더를 두면:
    - 주문 분류(매수주문/매도주문/보상/조정)
    - 전표 상태(PENDING/POSTED/FAILED)
    - 실패 원인
    - 원본-보상 관계 추적
        
        을 **일관된 방식**으로 관리할 수 있다.
        
- Append-only로 유지하여 **감사/증빙/분쟁 대응**에 적합하다.

### 2.2 컬럼 명세(왜 필요한가)

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 내부 조인 성능을 위한 PK. ledger_entries가 참조하는 FK 대상. |
| `public_id` (UUID, UK) | 외부에 전표 참조 번호로 노출 가능(로그/감사/CS). 내부 id 노출 방지. |
| `trade_ref_id` (UUID, UK) | 전표-원장-업무를 관통하는 **주문 참조 식별자**. "한 trade_ref_id = 전표 헤더 1개"를 강제하여 정합성을 단순화. |
| `client_request_id` (UUID, UK) | 멱등의 핵심 키. 같은 요청이 재시도되어도 같은 전표를 재사용/조회 가능하게 함. |
| `original_trade_ref_id` (IDX) | 보상/조정 전표가 "어떤 원본 주문을 되돌리는지"를 추적하는 최소 단위 키. |
| `original_journal_entry_id` (IDX) | 원본을 더 정확히 특정하고 싶을 때 유용(원본 전표 헤더를 직접 가리킴). 감사/리포트/분쟁 대응에서 추적이 쉬워짐. (물리 FK는 파티셔닝/확장성 고려로 생략 가능) |
| `journal_type` | 전표가 어떤 성격인지 분류(매수주문/매도주문/보상/조정). "보상은 새 trade_ref_id로 발행"이라는 규칙을 타입으로 명확히 표현. |
| `journal_status` | 전표 처리 상태(PENDING/POSTED/FAILED). 업무 상태(order_records.status)와 분리해 “원장 반영” 여부를 독립적으로 판단 가능. |
| `failure_reason` | 실패/불확실 상태의 원인 저장. 운영/복구 로직에서 분기 근거로 사용. (확장 여지가 크므로 CHECK는 강제하지 않음) |
| `created_at` | 감사/리포트/추적에 필수. original_* 인덱스와 결합해 “원본 기준 타임라인”을 만든다. |

### 2.3 인덱스가 필요한 이유

- `IDX(journal_type, created_at)`: 보상/조정만 뽑아보는 운영/감사 쿼리 최적화
- `IDX(original_trade_ref_id, created_at)`: 원본 기준으로 보상 내역 타임라인 조회
- `IDX(original_journal_entry_id, created_at)`: 원본 전표 헤더 기준의 정확한 추적

---

## 3) `order_records` (주문 업무 레코드/복구 타겟)

### 3.1 테이블 목적(왜 필요한가)

`order_records`는 "원장(ledger)만으로는 표현하기 어려운 **업무 관점 상태**"를 영속 저장하는 테이블이다.

- 원장은 "회계 사실"을 저장하지만,
    - FIX 주문 요청이 언제 들어왔는지
    - 현재 업무 상태가 무었인지(NEW/PENDING_NEW/EXECUTING/FILLED/CANCELLED/REJECTED/COMPENSATED)
    - FEP Simulator 호출 결과가 불확실인지(timeout)
    - 복구 스케줄러가 어떤 것을 재처리해야 하는지
        
        같은 “업무 프로세스 상태”를 담기 어렵다.
        
- 또한 **멱등 응답 안정성**을 위해 “당시 응답 스냅샷”을 저장한다.
    
    → 중복 요청 시 현재 잔액이 아니라 **당시 결과 그대로** 반환 가능.
    

### 3.2 컬럼 명세(왜 필요한가)

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 내부 조인/정렬/관리용 PK. |
| `public_id` (UUID, UK) | 사용자/외부에 노출 가능한 "주문 참조 번호". CS/로그 추적에 핵심. |
| `client_request_id` (UUID, UK) | **업무 레벨 멱등키**. 재시도/중복 호출이 와도 같은 레코드를 조회/응답할 수 있어야 함. |
| `trade_ref_id` (IDX) | 전표/원장과 연결되는 주문 참조 식별자. UK로 강제하지 않고 IDX로 두어, 미래에 "한 업무에 여러 전표" 확장 여지를 남김. |
| `order_side` | BUY/SELL 분기를 명확하게 하기 위해 필요. FEP 주문 방향(FIX Tag 54) 대응. |
| `status` | 업무 상태 머신의 핵심. RecoveryScheduler가 스캔/복구 판단을 할 때 주로 쓰는 콼럼. |
| `failure_reason` | 실패/불확실 상태의 분기 근거. 복구/보상 로직에서 중요. |
| `amount` (DECIMAL) | 주문 증거금·체결 금액. 원장에도 존재하지만, 업무 조회/응답/리포트에서 자주 쓰이므로 업무 레코드에 중복 저장(denormalization)하는 게 실용적. |
| `currency_code` (CHAR 3) | 통화 코드. |
| `from_account_id` | 증거금 계좌. 주문내역 조회/락 대상. |
| `order_id` (nullable) | 주문이 생성된 경우 orders.id 참조. FIX 주문과 원장 레코드를 연결. |
| `fep_reference_id` | FEP 4.2 주문 참조 ID (FIX Tag 37 OrderID). timeout/불확실 상태에서 조사/복구에 필요. |
| `post_execution_balance` | 멱등 응답 시 "당시 결과"를 안정적으로 재현하기 위한 핵심 스냅샷(예: 주문 체결 후 잔액). |
| `result_code` / `result_message` | **(v2.0 변경)** JSON Blob 대신 컬럼화. 멱등 응답 시 재구성을 위한 최소 필드 저장. |
| `executing_started_at` | EXECUTING 타임아웃 판정을 `updated_at`에 의존하지 않기 위한 안전장치. “업데이트가 다른 이유로 찍혀서 판정이 흔들리는 문제”를 방지. |
| `completed_at` | 최종 확정 시각(완료/실패/보상). SLA/분쟁/추적/리포트에 필요. |
| `created_at`, `updated_at` | 상태 전이/복구 스캔/운영 분석의 기본. 특히 `IDX(status, updated_at)`와 결합되어 recovery scan 최적화. |

### 3.3 핵심 제약/인덱스가 필요한 이유

- `UK(client_request_id)`: 멱등의 1차 방어선(DB가 강제)
- `IDX(status, updated_at)`: recovery 스캔의 핵심 경로
- `IDX(order_id, created_at)`: 주문 기준 체결 내역 조회 최적화
- 타입별 `order_id` 체크: "주문 연결 / 무 주문" 모델을 DB에서 보장

---

## 4) `ledger_entries` (분개 라인, append-only)

### 4.1 테이블 목적(왜 필요한가)

`ledger_entries`는 **복식부기(Double-entry)** 의 “분개 라인”을 저장하는 **원장의 본체**다.

- 모든 금전 변동의 최종 진실(State of Record)은 여기서 결정된다.
- Append-only로 유지하여 감사/정합성/추적 가능성을 극대화한다.
- **(v2.0) 월 단위 파티셔닝**을 적용하여 대용량 원장 데이터를 효율적으로 관리(Archive/Pruning)한다.
- 특히 이 프로젝트의 핵심 혁신:
    
    ✅ **일일 한도는 당일 DEBIT 원장을 실시간 SUM 집계**하여 검증한다.
    
    → 그러려면 ledger가 “정확한 시간축(created_at) + 방향(DEBIT/CREDIT) + 계좌(account_id)” 정보를 갖고 있어야 한다.
    

### 4.2 컬럼 명세(왜 필요한가)

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 대규모 적재/인덱싱/조인에 효율적인 내부 PK. |
| `public_id` (UUID, UK - v2.0 Note) | 파티셔닝 환경에서 Global Unique Index는 비용이 큼. (별도 `ledger_entry_refs` 테이블로 우회하거나 App 레벨 관리). |
| `journal_entry_id` (FK) | 분개 라인이 어떤 전표 헤더에 속하는지 명확히 연결. 전표 단위로 라인들을 묶어 감사/리포트에 활용. |
| `trade_ref_id` (IDX) | 업무/전표/원장을 관통하는 주문 참조 식별자. 복구 판정(예: CREDIT 존재)에도 직접 사용. |
| `account_id` (FK) | 이 라인이 어떤 계좌의 변동인지 명확히 표시. 계좌별 합산/한도검증/내역조회에 핵심. |
| `direction` (DEBIT/CREDIT) | 라인의 성격을 명확하게 표현. 한도 검증은 DEBIT만 대상으로 삼으므로 필수. |
| `amount` (절대값, DECIMAL) | 리포트/집계는 절대값이 표준적으로 더 편함. `DECIMAL(19,4)` 사용. |
| `created_at` | 시간축의 기준. **파티셔닝 키**이자 당일 집계의 시간축 기준. |

### 4.3 인덱스가 필요한 이유(특히 혁신 포인트)

- `IDX(account_id, direction, created_at)`
    
    → **당일 DEBIT SUM** 쿼리의 핵심 커버 인덱스
    
    → where(account_id=?, direction='DEBIT', created_at between …) 패턴에 최적
    
- `IDX(trade_ref_id, direction)`
    
    → 복구/멱등 가드에서 “CREDIT 존재 여부”를 가장 빠르게 판단
    

---

## 5) `order_record_diagnostics` (진단 정보, 별도 분리)

### 5.1 테이블 목적

메인 테이블(`order_records`)의 **Row Size를 최적화**하기 위해, 대용량 텍스트나 상세 에러 로그, 원문 전문(JSON 등)을 분리 저장한다.

### 5.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `order_record_id` (PK, FK) | 메인 테이블과 1:1 관계. |
| `detail` (TEXT) | 긴 에러 스택트레이스, 벤더 응답 원문 등 “조회 빈도는 낮으나 보관 가치가 있는” 데이터. |
| `created_at` | 생성 시각. |

---

## 6) `ledger_entry_refs` (원장 참조 보조 - v2.0)

### 6.1 테이블 목적

파티셔닝된 `ledger_entries` 테이블에서 `public_id`로 단건 조회를(Point Lookup) 지원하기 위한 **글로벌 인덱스 역할**의 보조 테이블.

### 6.2 컬럼 명세

| 컬럼 | 필요 이유 |
| --- | --- |
| `public_id` (PK) | 전역 유니크 보장. |
| `ledger_entry_id` | 실제 원장 ID. |
| `ledger_created_at` | 원장의 생성 일시. 파티션 프루닝을 위한 힌트로 사용. |

---

# 부록: 한도 검증 쿼리(표준 규격)

```sql
SELECT COALESCE(SUM(amount),0)AS today_debit_sum
FROM ledger_entries
WHERE account_id= ?
AND direction='DEBIT'
AND created_at>= ?-- 오늘 00:00:00 (Asia/Seoul 기준, 서비스에서 생성)
AND created_at<  ?;-- 내일 00:00:00 (Asia/Seoul 기준, 서비스에서 생성)
```

- 이 규격은 `IDX(account_id, direction, created_at)`로 커버되어야 한다.
- “오늘/내일 00:00” 경계는 DB가 아니라 **애플리케이션에서 타임존 확정 후 파라미터로 전달**하는 것으로 규칙 고정.
