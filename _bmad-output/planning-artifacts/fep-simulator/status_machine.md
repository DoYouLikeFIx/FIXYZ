# FIX Simulator & Sim Counterpart FEP — 상태 전이 모델 (v2.0)

이 문서는 **FEP (Gateway) ↔ FIX Simulator (Counterpart)** 간의 **프로토콜 상태 전이 (Connection State)** 와 비즈니스 처리 흐름을 정의한다.

---

## 1. FEP 연결 상태 (Connectivity State Machine)

단순한 요청 처리가 아니라, **로그온(Logon) → 하트비트(Heartbeat/Idle) → 거래(Active) → 로그아웃(Logout)** 과정을 시뮬레이션한다.

```mermaid
stateDiagram-v2
    [*] --> OFFLINE: Initial State
    
    OFFLINE --> LISTENING: Start Server
    LISTENING --> CONNECTED: TCP Accept (Connection Established)
    
    state "Connected / Pre-Auth" as CONNECTED {
        [*] --> WAIT_LOGON
        WAIT_LOGON --> LOGGING_ON: Receive A (Logon Request)
        LOGGING_ON --> AUTHENTICATED: Validate Credentials / TLS OK
        LOGGING_ON --> WAIT_LOGON: Validate Fail (Send Logout / Reject)
        AUTHENTICATED --> WAIT_LOGON: Logout (MsgType=5)
        note right of AUTHENTICATED
            AUTHENTICATED 진입 직후
            시스템이 A(Logon OK)를 전송하고
            외부 전이 트리거:
            CONNECTED → LOGGED_ON
        end note
    }
    
    CONNECTED --> LOGGED_ON: A Sent (Logon Accepted)
    
    state "Business Active" as LOGGED_ON {
        [*] --> IDLE
        IDLE --> PROCESSING: Receive D (NewOrderSingle)
        PROCESSING --> IDLE: Send 8 (ExecutionReport)
        
        IDLE --> ECHO_CHECK: Interval (Every [echo_interval_seconds]s)
        ECHO_CHECK --> IDLE: Receive 0 (Heartbeat) / consecutive_echo_fail_count = 0
        ECHO_CHECK --> TIMEOUT: No Heartbeat / consecutive_echo_fail_count >= echo_timeout_threshold
    }
    
    TIMEOUT --> OFFLINE: Force Disconnect
    LOGGED_ON --> OFFLINE: Administrative Reset
```

> **`[echo_interval_seconds]` 파라미터 설명**: Simulator는 Gateway의 `fep_connections.keep_alive_interval` DB 값을 직접 읽을 수 없다. Simulator의 TIMEOUT 판단은 오직 `consecutive_echo_fail_count >= echo_timeout_threshold`로만 이루어진다. Heartbeat 발송 주기는 **`sim_exchange_topology.echo_interval_seconds`** 컨럼에 기관별로 저장되며(기본값 30초), 배포 시 Gateway의 `keep_alive_interval`과 일치시키는 것이 운영 원칙이다. (`echo_timeout_threshold`는 `sim_fep_connectivity.echo_timeout_threshold` 컨럼으로 기관별 설정 가능)

---

## 2. 메시지 처리 흐름 (Message Processing Flow)

FEP 간 메시지 교환 시 **Protocol Handshake**와 **Business Logic**의 분리를 보여준다.

```mermaid
sequenceDiagram
    participant Real as Real FEP (Core)
    participant Virtual as Sim FEP
    participant Rules as Chaos Rules
    participant Ledger as Sim Ledger

    Note over Real, Virtual: 1. Connection Phase
    Real->>Virtual: TCP Connect (SYN)
    Virtual-->>Real: TCP Accept (SYN+ACK)
    
    Real->>Virtual: A (Logon Request)
    Virtual->>Virtual: Validate Credentials / TLS
    Virtual-->>Real: A (Logon Response, Accepted)

    Note over Real, Virtual: 2. Maintenance Phase (Heartbeat)
    loop Every [echo_interval_seconds]s (sim_exchange_topology.echo_interval_seconds)
        Real->>Virtual: 1 (TestRequest)
        Virtual-->>Real: 0 (Heartbeat)
    end

    Note over Real, Virtual: 3. Order Execution Phase
    Real->>Virtual: D (NewOrderSingle — 005930, qty=10)
    Virtual->>Rules: Match Chaos Rule?
    alt Rule = DISCONNECT
        Virtual--xReal: (TCP Close / Socket Reset)
    else Rule = MALFORMED_RESP
        Virtual-->>Real: "{garbage_data...}"
    else Rule = IGNORE
        Note over Virtual: No response sent → Gateway Read Timeout (RC=9004)
    else Rule = DECLINE
        Virtual-->>Real: 8 (ExecutionReport, ExecType=REJECTED)
    else Rule = APPROVE (default)
        Virtual->>Ledger: Update Position (+10 qty)
        Ledger-->>Virtual: OK
        Virtual-->>Real: 8 (ExecutionReport, ExecType=FILL)
    end
```

---

## 3. 프로토콜별 메시지 타입 비교

| 메시지 구분 | FIX 4.2 (Tag 35) | HTTP/REST (OpenAPI) | 비고 |
| --- | --- | --- | --- |
| **로그온 (Logon)** | `A` Logon | `POST /v1/auth/login` | TLS + 세션 인증 |
| **로그아웃 (Logout)** | `5` Logout | `DELETE /v1/auth/logout` | |
| **Heartbeat (연결 확인)** | `0` Heartbeat / `1` TestRequest | `GET /health` | 연결 유지 |
| **주문 (NewOrder)** | `D` NewOrderSingle / `8` ExecutionReport | `POST /v1/orders` | |
| **취소 (Cancel)** | `F` OrderCancelRequest / `9` OrderCancelReject | `DELETE /v1/orders/{id}` | |
