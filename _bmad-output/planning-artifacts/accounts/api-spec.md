# Core Banking (계정계) API 명세서

본 문서는 기획 문서(`architecture.md`, `prd.md`, `epics.md`) 및 구현 상세 문서(`implementation-artifacts` 등)를 바탕으로 도출된 **계정계(Core Banking)** 시스템의 API 명세서입니다. 

AI Agent가 즉각적으로 코드를 스캐폴딩(Scaffolding)하고 기능을 구현할 수 있도록 **"채널계가 호출하는 API(Inbound)"** 와 **"계정계 내부에서 자체적으로 처리하거나 외부로 요청하는 API(Internal/Outbound)"** 로 역할을 명확히 분리하여 작성했습니다.

---

## 🔒 공통 보안 및 통신 규약
계정계(Port: `8081`)는 외부 클라이언트(브라우저/앱)에 직접 노출되지 않고, 오로지 내부망을 통해서만 통신합니다.

| Header Name | Required | Description |
| :--- | :---: | :--- |
| `X-Internal-Secret` | **Yes** | 내부 API 호출 권한 증명. `InternalSecretFilter`를 통해 검증되며 미포함 시 `403 Access Denied`. |
| `X-Correlation-Id` | **Yes** | 3-Tier 전체(채널-계정-FEP) 로그 추적을 위한 UUID. 로그의 MDC(Mapped Diagnostic Context)에 주입 필수. |

### 금액 직렬화/연산 규칙 (고정)
- 모든 금액 필드(`balance`, `pendingAmount`, `price`, `executedPrice`, `dailyLimit` 등)는 **DECIMAL(19,4)** 스케일을 사용한다.
- 서버 연산은 `BigDecimal` scale=4, rounding=`HALF_UP`으로 고정한다.
- `balance`, `pendingAmount`는 음수로 내려가지 않는다(`>= 0`).
- API 예시/테스트 스냅샷/직렬화 출력은 소수 4자리로 통일한다.

---

## 📱 Part 1. 채널계 호출 API (Inbound from Channel)
채널계(Channel System)가 사용자 요청의 유효성과 OTP 인증을 마친 뒤, 실질적인 원장 조회 및 변경을 위해 계정계를 호출하는 API 목록입니다. 계정계 개발 시 ** `@RestController` 로 노출해야 하는 진입점**입니다.

### 1.1 포트폴리오 및 계좌 관리
채널계의 회원가입이나 대시보드 진입 시 호출됩니다.

#### [API-CH-01] 기본 계좌 자동 생성
* **Endpoint:** `POST /internal/v1/portfolio`
* **Purpose:** 채널계 튜토리얼/회원가입 완료 시, 계정계 원장에 초기 자본금이 담긴 기본 주식 거래 계좌를 생성합니다.
* **Request:** 
  ```json
  { "userId": "1" } // 회원 식별자
  ```
* **Response (201 Created):**
  ```json
  { "accountId": "1", "accountNumber": "110-1234-567890" }
  ```

#### [API-CH-02] 보유 계좌 및 종합 잔액 조회
* **Endpoint:** `GET /internal/v1/members/{memberId}/portfolio`
* **Purpose:** 특정 회원이 소유한 계좌 목록 및 요약 상태 반환.
* **Response (200 OK):**
  ```json
  [
    {
      "accountId": "1",
      "accountNumber": "110-1234-567890",
      "balance": 10000000.0000,
      "currency": "KRW",
      "createdAt": "2026-03-03T10:00:00Z"
    }
  ]
  ```

### 1.2 실시간 자산 검증 (주문 전단계)
채널계에서 고객이 주문(매수/매도)을 시도할 때 가용 자산을 확인하기 위해 호출됩니다.

#### [API-CH-03] 매수 가용 현금 조회
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/cash`
* **Purpose:** 매수(BUY) 주문 시 계좌의 현금이 충분한지 검증.
* **Response (200 OK):**
  ```json
  { "accountId": "1", "balance": 10000000.0000, "pendingAmount": 0.0000, "currency": "KRW" }
  ```
* **Contract Rule (중요):**
  * `balance`는 **canonical 필드**이며 이미 주문 가능 금액(available cash) 의미다.
  * 외부(채널) API에서 `availableBalance`를 노출해야 하면 `availableBalance == balance` alias로만 제공한다.
  * `availableBalance = balance - pendingAmount` 재계산 규칙은 사용하지 않는다.

#### [API-CH-04] 매도 가용 포지션(주식) 조회 (단건)
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/positions?symbol={symbol}`
* **Purpose:** 매도(SELL) 주문 시 해당 종목을 기보유하고 있는지(숏셀링 방지) 검증.
* **Response (200 OK):**
  ```json
  {
    "symbol": "005930",
    "quantity": 50,
    "availableQty": 50,
    "avgPrice": 75000.0000,
    "marketPrice": 70200.0000,
    "quoteAsOf": "2026-03-04T09:10:00Z",
    "quoteSourceMode": "DELAYED",
    "unrealizedPnl": -240000.0000,
    "realizedPnlDaily": 120000.0000
  }
  ```

#### [API-CH-05] 전체 포지션 리스트 조회
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/positions`
* **Purpose:** 계좌 상세보기 / 잔고 화면에서 보유 주식 리스트 확인.
* **Response (200 OK):** `[ { ...API-CH-04 스키마 배열... } ]`

> **PnL 계산 규칙(MVP 고정):**
> - 평균단가(`avgPrice`)는 **가중평균** 방식으로 계산한다. (DB 컬럼 매핑: `positions.avg_cost`)
> - `unrealizedPnl = (marketPrice - avgPrice) * quantity`
> - `realizedPnlDaily = Σ((sellPrice - avgPrice_at_sell) * soldQty)` (수수료/세금 제외, MVP 가정)
> - `quoteAsOf`가 stale 임계치(`maxQuoteAgeMs`)를 넘으면 `marketPrice` 기반 계산값은 응답에 포함하지 않고 `VALIDATION-003 (STALE_QUOTE)` 에러로 처리한다.

### 1.3 주문 체결 및 실행
OTP 검증 통과 후, 로컬 canonical 체결을 먼저 확정하고 외부 동기화를 수행하는 핵심 API입니다.

#### [API-CH-06] 주문 실행 (Execution)
* **Endpoint:** `POST /internal/v1/orders`
* **Purpose:** 포지션 락(`PESSIMISTIC_WRITE` on `(account_id, symbol)`) 획득 ➔ 자산 재검증(현금/포지션/일일매도한도 + MARKET stale quote 검증) ➔ 로컬 Order Book 매칭/원장 반영 트랜잭션 커밋 ➔ 커밋 후 FEP 발송 및 외부 동기화 상태 업데이트.
* **Request:** 
  ```json
  {
    "accountId": "1",
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "symbol": "005930",
    "side": "BUY", // OR "SELL"
    "orderType": "MARKET", // OR "LIMIT"
    "qty": 50,
    "price": null, // LIMIT일 때 필수
    "preTradePrice": 70200.0000, // MARKET 사전검증 기준 가격
    "quoteSnapshotId": "qsnap-20260301-001122", // MARKET 시 필수
    "quoteAsOf": "2026-03-04T09:10:00Z", // MARKET 시 필수
    "quoteSourceMode": "DELAYED" // LIVE | DELAYED | REPLAY (MARKET 시 필수)
  }
  ```
* **MARKET 내부 전달 필드 정책:** `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `preTradePrice` 4개는 MARKET 주문에서 필수이며 LIMIT 주문에서는 `null` 허용.
* **Matching 정책(고정):**
  * `LIMIT`: 매수는 `price DESC → time ASC`, 매도는 `price ASC → time ASC`
  * `MARKET`: 반대편 오더북을 최우선 가격부터 레벨 순차 소진(sweep)
  * 유동성 부족 시 `PARTIALLY_FILLED` 또는 deterministic no-liquidity reject 계약 적용
* **트랜잭션 경계(고정):**
  * 로컬 canonical 체결(`orders`/`executions`/`positions` + ledger insert)은 하나의 `@Transactional`에서 커밋
  * FEP 호출은 커밋 이후 실행하며, 실패 시 `externalSyncStatus=FAILED|ESCALATED`로 별도 복구 경로 진입
* **Response (200 OK):** 
  ```json
  {
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED", // or FAILED
    "orderId": "ORD-12345ABCD",
    "executedQty": 50,
    "executedPrice": 75000.0000,
    "positionQty": 100
  }
  ```
* **Error Specs:**
  * `422 (ORD-001)` 매수 자금 부족 / `422 (ORD-002)` 일일 매도 한도 초과 / `422 (ORD-003)` 매도 주식 부족 / `422 (ORD-012)` 계좌 상태 차단(`FROZEN`/`CLOSED`)
  * `422 (VALIDATION-003)` `STALE_QUOTE` (MARKET 사전검증용 snapshot age 초과 또는 내부 전달 필드 누락)
  * `503 (FEP-001)` FEP 서비스 불가(CB OPEN, 세션 풀/로그온 문제) / `504 (FEP-002)` FEP 타임아웃 / `400 (FEP-003)` FEP 거래소 거절
  * `409 (CORE-003)` 포지션 락 경합(동시성 충돌)

#### [API-CH-07] 주문 상태 재조회 / 강제 복구 (Recovery)
* **Endpoint:** `POST /internal/v1/orders/{clOrdID}/requery`
* **Purpose:** 채널계 스케줄러가 타임아웃/표류 상태(`EXECUTING`)의 주문을 감지하여 복구 요청. 계정계는 FEP 상태를 재조회해 외부 동기화 상태를 `COMPLETED`/`FAILED`/`CANCELED` 또는 `ESCALATED`로 확정한다(자동 포지션 역분개 없음).
* **Response (200 OK):**
  ```json
  {
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "finalStatus": "ESCALATED", // 혹은 COMPLETED/FAILED/CANCELED
    "externalSyncStatus": "ESCALATED" // 외부 확인 상태
  }
  ```

---

## ⚙️ Part 2. 계정계 내부 처리 로직 & 외부 호출 API (Internal / Outbound)

계정계 시스템이 트랜잭션 도중 자율적으로 처리해야 하는 내부 로직 처리 정책과 외부 연동(FEP Gateway) 방식에 대한 스펙입니다.

### 2.1 대외계 (FEP Gateway) 연동 클라이언트 (Outbound)
계정계 주문 실행 ➔ 대외계 발송을 위해 **내부 RestClient/FeignClient**를 구축해야 합니다.

#### [OUT-FEP-01] 외부 거래소 주문 발송
* **HTTP Client Request:** `POST http://fep-gateway:8083/fep/v1/orders`
* **Description:** FEP 변환 처리를 위해 발송.
* **Headers:** `X-Internal-Secret`, `X-Correlation-Id` 주입 필수.
* **Data Payload:** 계정계의 `POST /internal/v1/orders` Body와 동일 (`clOrdID` 활용). MARKET 주문에서는 `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `preTradePrice`를 그대로 전달해 체결 근거 추적성을 유지한다.
* **Resilience4j 연동 (필수):**
  * ` slidingWindowSize=3` 의 기반 **Circuit Breaker**가 적용되어야 합니다.
  * *주의 (ADR):* 해당 요청에 Retry 설정을 중첩 적용하지 않습니다. (채널계의 Recovery 스케줄러가 재시도를 관리함)

#### [OUT-FEP-02] 강제 FEP 상태 조회 (Polling)
* **HTTP Client Request:** `GET http://fep-gateway:8083/fep/v1/orders/{clOrdID}/status`
* **Description:** [API-CH-07] 요청을 받았을 때 해당 클라이언트 주문 ID(`clOrdID`)가 실제로 외부 거래소에서 어떻게 체결되었는지 FEP 게이트웨이에 질의합니다.

### 2.2 내부 무결성 통제 로직 (DB & Locking)
코드 작성(Scaffolding) 단계에서 AI Agent가 반드시 준수해야 하는 엔티티 제어 정책입니다.

#### [LOGIC-01] Pessimistic Lock (비관적 락)
* 매도/매수 포지션(`positions`) 테이블 변경을 동반하는 `[API-CH-06] 주문 실행`은 Spring Data JPA의 `@Lock(LockModeType.PESSIMISTIC_WRITE)`를 이용해 `SELECT ... FOR UPDATE` 구문을 발생시켜야 합니다.
* 락 범위는 **`(account_id, symbol)` 단위**를 기본으로 하며, 서로 다른 종목 주문은 병렬 처리 가능해야 합니다.
* `accounts` row lock은 현금 잔액 갱신이 필요한 구간에서만 최소 범위로 획득합니다.

#### [LOGIC-02] 복식 부기 저널 로직 (Ledger Integrity)
* 데이터베이스(원장) 업데이트 시 단순 `UPDATE` 가 아닌, `journal_entries` 와 `ledger_entries` 테이블에 **차변(DEBIT)과 대변(CREDIT)** 기록을 Append-only 형태로 `INSERT` 하여 자산 변동 사유를 영구히 남겨야 합니다.
* **분개 템플릿(예시):**
  * BUY 체결: `DEBIT stock_asset`, `CREDIT cash_asset`
  * SELL 체결: `DEBIT cash_asset`, `CREDIT stock_asset`
  * 각 분개는 동일 `trade_ref_id`/`journal_entry_id`로 연결되어야 하며 단독 라인 삽입을 금지합니다.

#### [LOGIC-03] 매도 일일 한도 로직 (QueryDSL)
* [API-CH-06] SELL 체결 전, DB `accounts.daily_limit` 값을 초과하지 않도록 그 날 자정 이후 해당 종목 `executions` 매도 수량을 QueryDSL로 동적 Sum(합산)하여 실시간 검증해야 합니다.

#### [LOGIC-04] 외부 동기화 복구 (Saga Recovery)
* [OUT-FEP-01] 호출이 FEP의 Timeout(`504`)이나 Reject(`422`)로 실패할 경우, 로컬 canonical 체결(`executions`/`positions`)은 유지한 채 `externalSyncStatus=FAILED/ESCALATED`를 기록하고 Replay/Requery 경로로 복구해야 합니다. 자동 역발행(Reversal)은 수행하지 않습니다.
