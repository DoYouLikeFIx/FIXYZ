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
      "balance": 10000000,
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
  { "accountId": "1", "balance": 10000000, "pendingAmount": 0, "currency": "KRW" }
  ```

#### [API-CH-04] 매도 가용 포지션(주식) 조회 (단건)
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/positions?symbol={symbol}`
* **Purpose:** 매도(SELL) 주문 시 해당 종목을 기보유하고 있는지(숏셀링 방지) 검증.
* **Response (200 OK):**
  ```json
  { "symbol": "005930", "quantity": 50, "availableQty": 50, "avgPrice": 75000 }
  ```

#### [API-CH-05] 전체 포지션 리스트 조회
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/positions`
* **Purpose:** 계좌 상세보기 / 잔고 화면에서 보유 주식 리스트 확인.
* **Response (200 OK):** `[ { ...API-CH-04 스키마 배열... } ]`

### 1.3 주문 체결 및 실행
OTP 검증 통과 후, 원장을 락(Lock) 잡고 외부 거래소를 타격하는 핵심 API입니다.

#### [API-CH-06] 주문 실행 (Execution)
* **Endpoint:** `POST /internal/v1/orders`
* **Purpose:** 계좌 락(`PESSIMISTIC_WRITE`) 획득 ➔ 자산 재검증(현금/포지션/일일매도한도) ➔ FEP 발송 API 호출 ➔ 원장(Positions/Ledger) 엔티티 반영 트랜잭션 수행.
* **Request:** 
  ```json
  {
    "accountId": "1",
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "symbol": "005930",
    "side": "BUY", // OR "SELL"
    "orderType": "LIMIT",
    "qty": 50,
    "price": 75000
  }
  ```
* **Response (200 OK):** 
  ```json
  {
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED", // or FAILED
    "orderId": "ORD-12345ABCD",
    "executedQty": 50,
    "executedPrice": 75000,
    "positionQty": 100
  }
  ```
* **Error Specs:** 
  * `422 (ORD-001)` 매수 자금 부족 / `422 (ORD-002)` 일일 매도 한도 초과 / `422 (ORD-003)` 매도 주식 부족 / `422 (FEP-002)` 거래소 거절
  * `504 (FEP-001)` FEP 타임아웃 / `503 (FEP-003)` 서킷 브레이커 개방
  * `409 (CORE-003)` 이중 전송(Idempotency 충돌) 방어

#### [API-CH-07] 주문 상태 재조회 / 강제 복구 (Recovery)
* **Endpoint:** `POST /internal/v1/orders/{clOrdID}/requery`
* **Purpose:** 채널계 스케줄러가 타임아웃/표류 상태(`EXECUTING`)의 주문을 감지하여 복구 요청. 계정계는 FEP 상태를 확인 후 보상 트랜잭션(Reversal)을 수행하거나 체결을 확정.
* **Response (200 OK):**
  ```json
  {
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "finalStatus": "FAILED", // 혹은 COMPLETED
    "compensated": true // 롤백이 진행되었는지 여부
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
* **Data Payload:** 계정계의 `POST /internal/v1/orders` Body와 동일 (`clOrdID` 활용).
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

#### [LOGIC-02] 복식 부기 저널 로직 (Ledger Integrity)
* 데이터베이스(원장) 업데이트 시 단순 `UPDATE` 가 아닌, `journal_entries` 와 `ledger_entries` 테이블에 **차변(DEBIT)과 대변(CREDIT)** 기록을 Append-only 형태로 `INSERT` 하여 자산 변동 사유를 영구히 남겨야 합니다.

#### [LOGIC-03] 매도 일일 한도 로직 (QueryDSL)
* [API-CH-06] SELL 체결 전, DB에 저장된 `Account.dailySellLimit` 값이 초과되지 않도록 그 날 자정 이후의 해당 종목 `order_executions` 매도 수량을 QueryDSL로 동적 Sum(합산)하여 실시간 검증해야 합니다.

#### [LOGIC-04] 보상 트랜잭션 (Saga Reversal)
* [OUT-FEP-01] 호출이 FEP의 Timeout(`504`)이나 Reject(`422`)로 실패할 경우, 직전에 잡아두었던 락을 해제하기 위해 **새로운 `@Transactional(requiresNew)`** 트랜잭션을 발생시켜 체결수량만큼 역발행(Reversal) 업데이트를 진행해야 합니다.
