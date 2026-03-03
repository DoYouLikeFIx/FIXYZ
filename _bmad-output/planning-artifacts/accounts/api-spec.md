# Core Banking (계정계) 내부 API 명세서

## 📌 문서 정합성 및 충돌 확인 (Conflict Check)
본 API 명세는 기획 문서(`architecture.md`, `prd.md`, `epics.md`) 및 구현 상세 문서(`implementation-artifacts` 하위 8개 Epic 문서, 시퀀스 다이어그램 등)의 모든 내용을 교차 검증하여 작성되었습니다.

### 💡 확인된 조율 사항 (충돌 해결)
* **주문 체결 내부 API 엔드포인트:** 
  * `prd.md`에는 `POST /internal/v1/sessions/{sessionId}/execute`, `channels/api-spec.md`에는 `POST /internal/v1/orders/execute`로 파편화되어 기재되어 있었습니다.
  * 그러나 최종 구현 척도인 **Epic 7.2 및 Epic 8.1의 WireMock 통신 규약**에 따르면, 실제 계정계의 라우트는 **`POST /internal/v1/orders`**로 확정되어 동작하도록 테스트 코드가 설계되어 있습니다.
  * **결론:** RESTful 성격과 최종 구현 스펙(Epic 8)을 우선하여 `POST /internal/v1/orders` 로 통일하여 명세에 반영했습니다. 이외의 자산 조회, 계좌 생성 등의 API들은 기존 설계 문서들과 **100% 충돌 없이 완벽히 일치**합니다.

---

## 1. 기본 통신 규약
계정계(Core Banking, Port: `8081`)는 타 도메인(채널계 등) 서버 간 내부 통신용 엔드포인트(`Server-to-Server`)만 제공합니다.
따라서, 보안과 추적 관리를 위해 아래 헤더가 모든 요청에 **필수**로 포함되어야 합니다.

| Header Name | Required | Description |
| :--- | :---: | :--- |
| `X-Internal-Secret` | **Yes** | 내부 API 호출 권한을 증명하는 시크릿 키. (미포함 시 `403 Access Denied` 발생) |
| `X-Correlation-Id` | **Yes** | 채널계로부터 전달받은 단일 트랜잭션 추적 ID (UUID). 로그 MDC 추적용. |

---

## 2. API 상세 명세

### 2.1 계좌 및 포트폴리오 (Account & Portfolio)

#### 2.1.1. 기본 트레이딩 계좌 생성
* **Endpoint:** `POST /internal/v1/portfolio`
* **Description:** 채널계에서 신규 회원가입 발생 시, 해당 회원의 기본 거래 계좌(Default Trading Account)를 생성하고 초기 시드 머니(테스트용 현금)를 부여합니다.
* **Request Body:**
  ```json
  {
    "userId": "1" // 채널계 시스템의 memberId (Long)
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "accountId": "1",
    "accountNumber": "110-1234-567890"
  }
  ```
* **Error:** `503 Service Unavailable` 계좌 생성 실패 처리 시(채널계 롤백 유도)

#### 2.1.2. 회원 보유 계좌 목록 조회
* **Endpoint:** `GET /internal/v1/members/{memberId}/portfolio`
* **Description:** 특정 회원이 소유한 계좌 목록과 각 계좌의 기초 잔액을 반환합니다. 
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

---

### 2.2 실시간 자산 검증 (Real-time Asset Verification)

#### 2.2.1. 계좌 단건 가용 현금 조회
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/cash`
* **Description:** 사용자가 **매수(BUY)** 주문을 요청할 때 가용 현금이 충분한지 실시간으로 검증하기 위한 API. 진행 중(Pending) 인 금액이 공제된 '사용 가능한(Available)' 금액을 반환합니다.
* **Response (200 OK):**
  ```json
  {
    "accountId": "1",
    "balance": 10000000,
    "pendingAmount": 0,
    "currency": "KRW",
    "asOf": "2026-03-03T10:00:00Z"
  }
  ```

#### 2.2.2. 단일 종목 가용 수량 조회
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/positions?symbol={symbol}`
* **Description:** 사용자가 **매도(SELL)** 주문을 요청할 때, 매도 가능한 주식(Position)을 숏셀링 없이 충분히 보유 중인지 확인하기 위한 단건 조회 API.
* **Response (200 OK):**
  ```json
  {
    "symbol": "005930",
    "quantity": 50,
    "availableQty": 50,
    "avgPrice": 75000
  }
  ```
* **Response (404 Not Found):** 보유 포지션이 없을 시

#### 2.2.3. 계좌 내 전체 보유 종목(포트폴리오) 조회
* **Endpoint:** `GET /internal/v1/accounts/{accountId}/positions`
* **Description:** 사용자의 잔고 화면에 노출될 전체 보유 주식 리스트를 반환합니다.
* **Response (200 OK):**
  ```json
  [
    {
      "symbol": "005930",
      "quantity": 50,
      "availableQty": 50,
      "avgPrice": 75000
    },
    {
      "symbol": "035420",
      "quantity": 10,
      "availableQty": 10,
      "avgPrice": 190000
    }
  ]
  ```

---

### 2.3 주문 실행 및 동기화 (Execution & Sync)

#### 2.3.1. 채널계 주문 실행 위임 (Order Execution)
* **Endpoint:** `POST /internal/v1/orders`
* **Description:** OTP 검증이 완료된 채널계 주문이 실제 계정계의 원장에 반영되고 대외계(FEP Gateway)로 발송요청(`FepClient.send()`)되는 핵심 체결 API. `PESSIMISTIC_WRITE` 락을 잡아 원장 동시성을 무결하게 보호합니다.
* **Request Body:**
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
* **Response (200 OK):** (정상 체결 및 부분 체결 등의 스냅샷 반환)
  ```json
  {
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED",
    "orderId": "ORD-12345ABCD",
    "executedQty": 50,
    "executedPrice": 75000,
    "positionQty": 100 // 체결 후 총 포지션 수량
  }
  ```
* **Error:** 
  * `422 Unprocessable Entity`: "Insufficient cash"(ORD-001) / "Daily sell limit exceeded"(ORD-002) / "Insufficient position qty"(ORD-003) / "REJECTED_BY_FEP"(FEP-002)
  * `504 Gateway Timeout`: "FEP_TIMEOUT"(FEP-001)
  * `503 Service Unavailable`: "CIRCUIT_OPEN"(FEP-003)
  * `409 Conflict`: "Order already being processed."(CORE-003) 중복 요청 시나리오 방어

#### 2.3.2. 체결 상태 재동기화 (Requery / Recovery hook)
* **Endpoint:** `POST /internal/v1/orders/{clOrdID}/requery`
* **Description:** FEP 타임아웃 등으로 `EXECUTING` 상태에 표류된 주문을 강제로 FEP 상태 재조회(polling) 하여 상태 전이 및 보상(Compensation) 트랜잭션을 실행시키는 API. 채널계 스케줄러(`OrderSessionRecoveryService`)가 호출합니다.
* **Response (200 OK):**
  ```json
  {
    "clOrdID": "550e8400-e29b-41d4-a716-446655440000",
    "finalStatus": "FAILED", // 혹은 COMPLETED
    "compensated": true // 역분개 처리 여부
  }
  ```
