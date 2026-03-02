# Sim Exchange Network & Sim Counterpart FEP — 테이블 상세 명세서

이 문서는 **Real FEP (Gateway)의 대외 통신 테스트**를 위해 설계된 **Sim Counterpart FEP (시뮬레이터 상대방 FEP)** 의 데이터 구조를 정의한다. 
단순 API Mocking을 넘어, **연결 상태(Connection State) 관리**와 **세션 관리(Session Management) 메시지** 처리를 포함한다.

---

## 1. `sim_exchange_topology` (가상 거래소 및 네트워크 토폴로지)

대외 기관(거래소, FIX Simulator)의 기본 접속 정보 및 프로토콜 타입을 정의한다. 이전 `sim_exchanges`를 확장한 개념이다.

| 컬럼명 | 데이터 타입 | 설명 | 비고 |
| --- | --- | --- | --- |
| `id` | `UUID` | 고유 식별자 | PK |
| `name` | `VARCHAR` | 기관명 (예: 'Blue Exchange FEP') | |
| `code` | `VARCHAR` | 시장 코드 (예: 'KRX', 'KOSDAQ') | SecurityExchange (FIX Tag 207) 기준 |
| `protocol_type` | `ENUM` | 통신 방식 ('HTTP_REST', 'FIX42_TCP', 'SOAP_XML') | **핵심**: FEP 처리 로직 결정 |
| `host` | `VARCHAR` | 바인딩 호스트 | |
| `port` | `INT` | 리스닝 포트 | |
| `is_active` | `BOOLEAN` | 활성화 여부 | |
| `echo_interval_seconds` | `INT` | Simulator 로컬 Echo 발송 주기(초). DEFAULT 30 | 배포 시 Gateway `keep_alive_interval`과 수동 정렬 필수. Simulator는 Gateway DB 직접 읽기 불가 |
| `created_at` | `TIMESTAMP` | 행 생성 시각 | 감사 추적 |

---

## 2. `sim_fep_connectivity` (FEP 연결 상태 및 세션)

**[NEW]** 상대방 FEP와의 연결 레벨 상태를 관리한다. 실제 FEP는 이 상태에 따라 '로그온/로그아웃(Logon/Logout)' 처리를 수행해야 한다.

> **생명주기(Lifecycle)**: `sim_exchange_topology` 행 INSERT 시 DB 트리거 또는 애플리케이션 훅을 통해 이 테이블에 행이 자동 생성된다. 초기 `connection_status`는 `OFFLINE`으로 설정된다.

| 컬럼명 | 데이터 타입 | 설명 | 비고 |
| --- | --- | --- | --- |
| `exchange_id` | `UUID` | 대상 시장 ID | PK, FK |
| `connection_status` | `ENUM` | 연결 상태 | `OFFLINE`: 연결 없음<br>`LISTENING`: 접속 대기<br>`CONNECTED`: TCP 연결됨<br>`LOGGED_ON`: FIX Logon 완료 |
| `last_echo_in` | `TIMESTAMP` | 마지막 수신 Echo 시각 | 세션 관리 확인용 |
| `last_echo_out` | `TIMESTAMP` | 마지막 송신 Echo 시각 | |
| `sequence_check_mode` | `ENUM` | 시퀀스 검증 모드 | `STRICT`: 번호 불연속 시 에러<br>`PERMISSIVE`: 무시 |
| `session_auth_status` | `ENUM` | FIX 세션 인증 상태 | `NONE`: 인증 전<br>`AUTHENTICATED`: Logon(MsgType=A) 인증 완료<br>`EXPIRED`: 세션 만료 (재로그온 필요) |
| `consecutive_echo_fail_count` | `INT` | Echo 연속 실패 횟수 | DEFAULT 0. `echo_timeout_threshold` 이상 시 TIMEOUT 전이. 성공 수신 시 0 리셋 |
| `echo_timeout_threshold` | `INT` | Echo 실패 TIMEOUT 임계치 | DEFAULT 3. Gateway `keep_alive_interval`에 맞게 배포 시 조정 |
| `created_at` | `TIMESTAMP` | 행 생성 시각 | `sim_exchange_topology` INSERT 시 자동 생성 |
| `updated_at` | `TIMESTAMP` | 상태 마지막 변경 시각 | |

---

## 3. `sim_fep_messages` (프로토콜 메시지 로그)

**[NEW]** FEP 간 교환된 **Raw Message**를 기록하여 파싱 오류나 프로토콜 위반을 디버깅한다.

| 컬럼명 | 데이터 타입 | 설명 | 비고 |
| --- | --- | --- | --- |
| `id` | `UUID` | 로그 ID | PK |
| `exchange_id` | `UUID` | 소속 거래소 | FK |
| `session_id` | `VARCHAR` | TCP 세션 ID | 연결별 구분 |
| `direction` | `ENUM` | 송수신 방향 | `IN`, `OUT` |
| `msg_type` | `VARCHAR` | 전문 유형 코드 | 예: `0`(Heartbeat), `D`(NewOrderSingle) |
| `raw_payload` | `TEXT` | 전문 원본 | Hex String 또는 JSON |
| `parsing_status` | `ENUM` | 파싱 성공 여부 | `SUCCESS`, `ERROR`, `MALFORMED` |

---

## 4. `simulator_rules` (장애 및 Chaos 규칙)

기존 규칙을 확장하여 **네트워크 레벨 장애**를 주입할 수 있도록 개선했다.

| 컬럼명 | 데이터 타입 | 설명 | 비고 |
| --- | --- | --- | --- |
| `id` | `UUID` | 규칙 고유 식별자 | PK |
| `exchange_id` | `UUID` | 소속 거래소 ID | FK → `sim_exchange_topology.id` |
| `priority` | `INT` | 규칙 우선순위 | 높을수록 먼저 적용. 동일 `exchange_id` 내 중복 가능 |
| `match_msg_type` | `VARCHAR(10)` | 매칭 FIX MsgType | NULL = 모든 메시지. 예: `'D'`(NewOrderSingle), `'F'`(CancelReq), `'0'`(Heartbeat) |
| `match_amount_gt` | `DECIMAL(19,4)` | 금액 하한 매칭 조건 | NULL = 하한 없음. `amount > match_amount_gt`일 때 매칭 |
| `match_amount_lte` | `DECIMAL(19,4)` | 금액 상한 매칭 조건 | NULL = 상한 없음. `amount <= match_amount_lte`일 때 매칭 |
| `match_symbol_prefix` | `VARCHAR(10)` | Symbol 코드(종목코드) 접두사 | NULL = 모든 Symbol. FIX Tag 55 앞 N자리 일치 시 매칭. ⚠️ 전체 NULL = 모든 요청 매칭 |
| `action_type` | `ENUM` | 동작 유형 | `APPROVE`, `DECLINE`, `IGNORE` (타임아웃 유발)<br>`DISCONNECT` (강제 연결 종료)<br>`MALFORMED_RESP` (규격 위반 응답 전송) |
| `response_template` | `TEXT` | 커스텀 응답 페이로드 | `action_type = DECLINE` 시 RC 값 등 세부 정의 |
| `delay_ms` | `INT` | 인위 지연 (ms) | `action_type = IGNORE`와 함께 타임아웃 시나리오 구성 |
| `ttl_seconds` | `INT` | 규칙 유효 시간 (초) | NULL이면 영구 유효. 만료 시각: `created_at + INTERVAL ttl_seconds SECOND` |
| `is_active` | `BOOLEAN` | 규칙 활성화 여부 | DEFAULT TRUE. 삭제 없이 소프트 비활성화 가능. Index Strategy Redis 캐시의 `exchange_id + is_active` 필터 기준 |
| `created_at` | `TIMESTAMP` | 규칙 생성 시각 | **TTL 기산점**. `ttl_seconds`가 NULL이 아닌 경우 유효성 판정 기준 |

> **인덱스 전략**: `INDEX idx_rules_lookup (exchange_id, is_active, match_msg_type)` — 일반 B-Tree 인덱스. JSON 컬럼 제거로 GENERATED VIRTUAL 컬럼 트릭 불필요. 규칙 수 증가 시 `exchange_id + is_active = TRUE` 결과를 Redis에 캐시하여 요청당 DB 스캔 회피.

> **⚠️ 전체 매칭 차단 (DB CHECK 제약 권장)**: `match_msg_type`, `match_amount_gt`, `match_amount_lte`, `match_symbol_prefix` 4개 전체 NULL = 모든 요청 매칭. 의도치 않은 Chaos 방지를 위해 `CONSTRAINT chk_not_all_null_match CHECK (match_msg_type IS NOT NULL OR match_amount_gt IS NOT NULL OR match_amount_lte IS NOT NULL OR match_symbol_prefix IS NOT NULL)` 제약 적용 권장. 의도적 전체 매칭이 필요한 경우 `match_all BOOLEAN DEFAULT FALSE` 컬럼 opt-in 방식 사용.

---

## 5. `sim_accounts` & `sim_transactions`

기존 시뮬레이터와 동일하게 **시뮬레이션 원장** 역할을 수행하며, 비즈니스 처리 결과를 저장한다.
(`sim_transactions`은 `sim_fep_messages`에서 파싱된 비즈니스 데이터만 저장)

**`sim_accounts` 주요 변경 사항 (Round 3 추가)**

| 컬럼명 | 데이터 타입 | 설명 | 비고 |
| --- | --- | --- | --- |
| `id` | `UUID` | 고유 식별자 | PK |
| `exchange_id` | `UUID` | 소속 거래소 | FK → `sim_exchange_topology.id` |
| `account_number` | `VARCHAR` | 계좌번호 | `UNIQUE KEY uk_exchange_account (exchange_id, account_number)` 필수 |
| `account_name` | `VARCHAR` | 매매 계좌명 | |
| `balance` | `DECIMAL(19,4)` | 잔액 | |
| `currency` | `VARCHAR(3)` | ISO 4217 통화 코드 | 예: `KRW`, `USD` |
| `status` | `ENUM` | 계좌 상태 | `ACTIVE`, `FROZEN`, `CLOSED` |
| `version` | `INT` | 낙관적 잠금 버전 카운터 | DEFAULT 0. `SET balance=?, version=version+1 WHERE id=? AND version=?`. affected rows=0 → 최대 3회 재시도 → `RC=9099 CONCURRENCY_FAILURE` |
| `created_at` | `TIMESTAMP` | 생성 시각 | |
