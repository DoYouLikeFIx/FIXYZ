# FIX Simulator & Sim Counterpart FEP Database Schema

## Overview
This schema defines the configuration and runtime state for the **FIX Simulator and Sim Counterpart FEP**.
It extends the basic simulator to include **Network Connectivity State** (Logon/off, Heartbeat, etc.) required for rigorous FEP-to-FEP testing.

> **Contract: Exchange Code Alignment**  
> `sim_exchange_topology.code` in this Simulator **MUST** match `fep_institutions.org_code` in the FEP Gateway exactly.  
> Example: Simulator `code: "KRX"` ↔ Gateway `org_code: "KRX"` (Korea Exchange — KRX).  
> A mismatch will cause routing failures in the Gateway and untraceable test errors. Both systems must be seeded from the same institution master list.

## 1. Sim Exchange & Network Topology

### `sim_exchange_topology`
Represents an external FIX counterpart (e.g., "KRX", "KOSDAQ", "FIX Simulator").
- `id` (PK): UUID
- `name`: string (e.g., "KRX FEP Simulator")
- `code`: string (e.g., "KRX", "KOSDAQ")
- `protocol_type`: enum (HTTP_REST, FIX42_TCP, SOAP_XML)
- `host`: string (Target IP to bind)
- `port`: integer (Target Port to listen)
- `is_active`: boolean
- `echo_interval_seconds`: int (DEFAULT 30) — Simulator 로컬 Echo 발송 주기. 배포 시 Gateway의 `keep_alive_interval`과 일치시켜야 한다. Simulator는 Gateway DB를 직접 읽을 수 없으므로 배포 단계에서 수동 정렬 필수.
- `created_at`: timestamp

### `sim_fep_connectivity`
Maintains the **Connection State** of the Sim Counterpart FEP.
- `exchange_id` (PK, FK): `sim_exchange_topology.id`
- `connection_status`: enum (OFFLINE, LISTENING, CONNECTED, LOGGED_ON, TIMEOUT)
    - **`TIMEOUT`**: Heartbeat (MsgType=0) 미수신이 `echo_timeout_threshold`회 연속 누적되어 회선 장애로 판정된 상태. `LOGGED_ON → TIMEOUT` 전이 후 자동 재연결(Reconnect) 시도. 재연결 성공 시 `CONNECTED → LOGGED_ON` 순서로 재로그인. `status_machine.md`의 TIMEOUT 상태 정의와 일치.
    - **전이 규칙**: `LOGGED_ON → TIMEOUT` (consecutive_echo_fail_count >= echo_timeout_threshold), `TIMEOUT → OFFLINE` (재연결 실패), `TIMEOUT → CONNECTED` (재연결 성공)
- `last_echo_in`: timestamp (Last Keep-Alive received from Real FEP)
- `last_echo_out`: timestamp (Last Keep-Alive sent to Real FEP)
- `sequence_check_mode`: enum (STRICT, PERMISSIVE)
    - *Note:* If STRICT, validates sequence number continuity.
- `session_auth_status`: enum (NONE, AUTHENTICATED, EXPIRED) — FIX 세션 인증 상태. `NONE`: Logon 이전. `AUTHENTICATED`: Logon(MsgType=A) 성공. `EXPIRED`: 세션 만료(재로그온 필요)
- `consecutive_echo_fail_count`: integer (DEFAULT 0) — Heartbeat (MsgType=0) 미수신 연속 횟수. `echo_timeout_threshold` 이상 누적 시 `LOGGED_ON → TIMEOUT → OFFLINE` 전이 트리거. 성공 수신 시 0으로 리셋.
- `echo_timeout_threshold`: integer (DEFAULT 3) — TIMEOUT 전이에 필요한 Echo 실패 연속 횟수. Gateway의 `keep_alive_interval`에 따라 조정 가능: 30s일 경우 3회=90s 허용, 60s일 경우 3회=180s 허용.
- `created_at`: timestamp (**Lifecycle Note:** Row is created automatically via DB trigger or application hook when a `sim_exchange_topology` row is inserted. Initial `connection_status` defaults to `OFFLINE`.)
- `updated_at`: timestamp

## 2. Protocol & Simulator Configuration

### `simulator_endpoints`
Defines service routes (HTTP) or FIX message types the simulator handles.
- `id` (PK): UUID
- `exchange_id` (FK): `sim_exchange_topology.id`
- `msg_type`: string (e.g., "D" for NewOrderSingle, "0" for Heartbeat, "A" for Logon)
- `direction`: enum (INBOUND, OUTBOUND)
    - **`INBOUND`**: Simulator가 **수신하는** 메시지 유형 (Real FEP 발신 → Simulator 수신). 서버 역할의 Simulator에서 95% 케이스에 해당.
    - **`OUTBOUND`**: Simulator가 **주도적으로 보내는** 메시지 유형. 서버임에도 Proactive 송신이 필요한 경우 (예: Unsolicited Alert, TCP 강제 종료 알림) 전용으로 예약. **일반 시나리오에서는 INBOUND만 등록하면 충분**하며 OUTBOUND는 특수 Chaos 시나리오 전용으로 사용한다.
- `latency_ms_default`: integer (Base delay)
- `is_supported`: boolean
- **인덱스**: `UNIQUE KEY uk_endpoint (exchange_id, msg_type, direction)` — 동일 기관·동일 전문 유형·동일 방향 중복 등록 방지. DBML의 `uk_endpoint` 제약과 동일.

### `sim_fep_messages`
Low-level log of all raw messages exchanged for protocol analysis.
- `id` (PK): UUID
- `exchange_id` (FK): `sim_exchange_topology.id`
- `session_id`: string (TCP Session ID or Correction ID)
- `direction`: enum (IN, OUT)
- `msg_type`: string (D, 8, F, 0, A, etc. — FIX 4.2 MsgType Tag 35)
- `raw_payload`: text (Hex dump or JSON string)
- `parsing_status`: enum (SUCCESS, ERROR, MALFORMED)
- `created_at`: timestamp

## 3. Securities Core Simulation (Sim Ledger)

### `sim_accounts`
Sim ledger to simulate position/balance updates on the counterpart side.
- `id` (PK): UUID
- `exchange_id` (FK): `sim_exchange_topology.id`
- `account_number`: string — **`UNIQUE KEY uk_exchange_account (exchange_id, account_number)`** 제약 필수. 주석으로만 관리하면 DDL 실행 시 제약이 누락되어 중복 계좌번호 삽입이 가능하다.
- `account_name`: string
- `balance`: decimal (Current balance)
- `currency`: string (ISO 4217)
- `status`: enum (ACTIVE, FROZEN, CLOSED)
- `version`: integer (DEFAULT 0) — **낙관적 잠금(Optimistic Locking)** 용. 잔액 업데이트 시 `WHERE id = ? AND version = ?` 조건으로 동시성 충돌 감지. 업데이트 행수 = 0이면 재시도
    - **중요**: 성공 시 반드시 `version = version + 1`로 증가해야 락이 작동한다. 올바른 패턴:
    ```sql
    UPDATE sim_accounts
    SET balance = ?, version = version + 1
    WHERE id = ? AND version = ?;
    -- affected rows = 0 → 충돌 탐지 → 최대 3회 + 50ms Exponential Backoff 재시도
    -- 3회 실패 → RC=9099 CONCURRENCY_FAILURE
    ```
- `created_at`: timestamp

### `sim_transactions`
Business-level order log (parsed from raw messages).
- `id` (PK): UUID
- `exchange_id` (FK): `sim_exchange_topology.id`
- `trace_id`: string (ClOrdID — FIX Tag 11 / ExecID for ExecutionReport)
    - **⚠️ ClOrdID 재사용 주의**: ClOrdID(FIX Tag 11)는 거래 세션 내 고유해야 한다. `UNIQUE(exchange_id, trace_id)` 단순 제약만으로는 날짜가 바뀐 후 동일 ClOrdID 재사용 시 중복 불가를 유발한다.
    - **MySQL 8.0.13+ 대응**: 함수 기반 인덱스 지원 버전에서는 `created_date DATE GENERATED ALWAYS AS (DATE(created_at)) STORED` 생성 컬럼을 추가한 후 `UNIQUE KEY uk_trace (exchange_id, trace_id, created_date)` 적용.
    - **MySQL 8.0.12 이하 / MariaDB 대응**: 애플리케이션에서 `(exchange_id, trace_id, DATE(created_at))` 조합으로 조회하고, 단순 조회 인덱스 `INDEX idx_trace (exchange_id, trace_id)` 만 생성.
- `symbol_code`: VARCHAR(20) — 종목 코드 (FIX Tag 55 Symbol). 주문 요청의 대상 종목. 예: `005930`, `000660`
- `currency`: VARCHAR(3) — ISO 4217 통화 코드. FIX Tag 15 (Currency). 예: `KRW`, `USD`
- `exec_id`: VARCHAR(40) — Execution ID (FIX Tag 17 ExecID). ExecutionReport 응답 수신 시 거래소가 채번. 응답 미수신 시 NULL
- `response_message`: VARCHAR(200) — 응답 전문 설명 텍스트 (FIX Tag 58 Text 등). 응답 미수신 시 NULL
- `result_code`: string (0000, 0051, etc.)
- `amount`: decimal
- `latency_ms`: integer
- `fep_message_id` (FK, **NULLABLE**): `sim_fep_messages.id` — 이 비즈니스 주문을 파싱한 원본 Raw Message 참조. `MALFORMED_RESP` Chaos 시나리오와 같이 파싱 실패 케이스는 `NULL`. Chaos 시나리오 재현 시 "Raw 전문 ↔ 비즈니스 주문" 추적 경로를 보장하는 핵심 링크.
- `created_at`: timestamp

## 4. Control & Chaos

### `simulator_rules`
Chaos engineering rules to inject failures or delays into the Sim FEP.
- `id` (PK): UUID
- `exchange_id` (FK, **NOT NULL**): `sim_exchange_topology.id` — `NULL` 허용 시 어떤 거래소 조회에도 매칭되지 않아 규칙이 있음에도 동작하지 않는 조용한 버그를 유발한다
- `priority`: integer (High number = High priority)
- `match_msg_type`: VARCHAR(10), NULL허용 — 매칭할 FIX MsgType. `NULL`이면 모든 메시지 유형에 매칭. 예: `'D'`(NewOrderSingle), `'F'`(CancelReq), `'0'`(Heartbeat)
- `match_amount_gt`: DECIMAL(19,4), NULL허용 — `amount > match_amount_gt`일 때 매칭. `NULL`이면 하한 없음
- `match_amount_lte`: DECIMAL(19,4), NULL허용 — `amount <= match_amount_lte`일 때 매칭. `NULL`이면 상한 없음
- `match_symbol_prefix`: VARCHAR(10), NULL허용 — Symbol 코드(종목코드, FIX Tag 55) 앞 N자리. `NULL`이면 모든 Symbol에 매칭
    - **⚠️ 전체 매칭 주의**: 모든 매칭 컬럼(`match_msg_type`, `match_amount_gt`, `match_amount_lte`, `match_symbol_prefix`)이 모두 `NULL`이면 모든 요청에 매칭된다. `action_type = DISCONNECT`와 결합 시 반드시 의도한 것인지 확인 후 삽입해야 한다. **DB 레벨 보호**: 아래 CHECK 제약으로 전체 NULL 조합 삽입을 원체 차단할 것을 권장한다.
    ```sql
    CONSTRAINT chk_not_all_null_match
      CHECK (
        match_msg_type    IS NOT NULL
        OR match_amount_gt  IS NOT NULL
        OR match_amount_lte IS NOT NULL
        OR match_symbol_prefix IS NOT NULL
      )
    -- 의도적 전체 매칭이 필요한 경우: CHECK 제약 대신 match_all BOOLEAN NOT NULL DEFAULT FALSE 컬럼을 추가하여 명시적 opt-in 하도록 설계할 것을 권장
    ```
    - **인덱스**: `INDEX idx_rules_lookup (exchange_id, is_active, match_msg_type, match_symbol_prefix)` — 일반 B-Tree 인덱스로 충분. GENERATED VIRTUAL 컬럼 + JSON 인덱스 트릭 불필요.
- `action_type`: enum (APPROVE, DECLINE, IGNORE, DISCONNECT, MALFORMED_RESP)
    - *DISCONNECT:* Drop TCP connection immediately.
    - *MALFORMED_RESP:* Send garbage data to test parser resilience.
- `response_template`: text (Details for custom responses)
- `delay_ms`: integer
- `ttl_seconds`: integer (Auto-expiry. NULL = no expiry)
- `is_active`: boolean (DEFAULT TRUE) — 규칙 소프트 비활성화 토글. `FALSE`로 설정 시 해당 규칙은 매칭에서 제외된다. Redis 캐시 필터 `exchange_id + is_active = TRUE`의 기준이 되므로, 물리 삭제 금지.
- `expires_at` (GENERATED, **NULLABLE**): `TIMESTAMP GENERATED ALWAYS AS (created_at + INTERVAL ttl_seconds SECOND) STORED` — `ttl_seconds IS NULL`이면 `NULL` (영구 유효). 규칙 조회 시 `WHERE expires_at IS NULL OR expires_at > NOW()` 조건으로 만료 자동 필터링. `INDEX(exchange_id, is_active, expires_at)` 적용 권장. 매 요청마다 `created_at + ttl_seconds` 연산 반복을 방지하여 인덱스 활용도 향상.
    - **⚠️ 기존 테이블 마이그레이션 시 다운타임 주의**: `GENERATED ALWAYS AS (...) STORED` 컬럼을 `ALTER TABLE`로 기존 테이블에 추가하면 InnoDB가 **모든 행을 재계산하는 Full Table Rebuild**를 수행한다. 테이블이 수백만 행 이상이면 수 분~수십 분의 DDL 잠금이 발생할 수 있다. 운영 중인 테이블에 적용할 경우 **Percona Online Schema Change(pt-online-schema-change)** 또는 **gh-ost** 등 Online DDL 도구를 사용하거나 저트래픽 시간대에 배포 일정을 잡아야 한다. 신규 테이블 생성(`CREATE TABLE`) 시에는 이 제약이 없다.
- `created_at`: timestamp (**TTL 기산점**: 유효 만료 시각 = `created_at + INTERVAL ttl_seconds SECOND`)

## 5. Relationships
- `sim_exchange_topology` (1) -> (1) `sim_fep_connectivity`
- `sim_exchange_topology` (1) -> (N) `simulator_endpoints`
- `sim_exchange_topology` (1) -> (N) `sim_fep_messages`
- `sim_exchange_topology` (1) -> (N) `sim_accounts`
- `sim_exchange_topology` (1) -> (N) `sim_transactions`
- `sim_exchange_topology` (1) -> (N) `simulator_rules`
- `sim_fep_messages` (1) -> (N) `sim_transactions` (via `fep_message_id`, NULLABLE)
