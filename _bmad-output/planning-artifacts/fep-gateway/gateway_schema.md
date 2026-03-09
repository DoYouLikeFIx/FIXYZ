# FEP Gateway (Internal) — 데이터베이스 스키마 (v2.0)

이 문서는 **FIX FEP Gateway Server**가 내부적으로 사용하는 DB 구조입니다. 대외 기관 연결 설정, 라우팅 규칙, 키 관리 및 주문 로그를 저장합니다.

> **📌 SSoT 정책**: 이 파일(`gateway_schema.md`)은 **설계 의도·정책·제약 이유의 Single Source of Truth**입니다. `gateway.dbml`은 ERD 시각화 도구용 구조 표현이며, 두 파일 간 불일치 발견 시 **이 파일을 우선**하고 `gateway.dbml`을 보정합니다.

---

## Changelog

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v2.0 | 2026-02-27 | `fep_protocol_specs` 신규 추가 (기관별 FIX 4.2 필드 명세 DB 관리, 캐시 무효화 전략 포함) |
| v2.0 | 2026-02-27 | `fep_circuit_breaker_events` 신규 추가 (CB 상태 전이 Append-Only 이력, `throttled_count` 포함) |
| v2.0 | 2026-02-27 | `fep_transaction_journal.tx_status`에 `MALFORMED`, `CIRCUIT_REJECTED` 상태 추가 |
| v2.0 | 2026-02-27 | `fep_transaction_journal`에 `failure_reason`, `reversal_ref_tx_id`, `msg_seq_num` 정책 명문화 및 인덱스 전략 5개 추가 |
| v2.0 | 2026-02-27 | `fep_security_keys`에 `alert_sent_at` 추가 (D-7 만료 알림 중복 발송 방지) |
| v2.0 | 2026-02-27 | `fep_connections`의 `active_connection_count` → `snapshot_active_count` 명칭 변경 + `last_snapshot_at` 추가 |
| v2.0 | 2026-02-27 | `fep_institutions.protocol_type` Protocol Family 힌트 역할 명확화 |
| v2.0 | 2026-02-27 | CB OPEN + connection SIGNED_ON 공존 독립성 정책 명문화 |
| v2.0 | 2026-02-27 | MsgSeqNum/ClOrdID ↔ Simulator 로그 크로스 매핑 정책 명문화 |
| v2.0 | 2026-02-27 | `fep_protocol_spec` NULL Unique MySQL 함정 → Trigger 중복 방지 정책 추가 |
| v2.0 | 2026-02-27 | `CIRCUIT_REJECTED` SELECT-before-INSERT 멱등성 흐름 명문화 |
| v2.0 | 2026-02-27 | `throttled_count` 집계 방식 — 인메모리 AtomicLong + 전이 시 일괄 INSERT 정책 명문화 |
| v2.0 | 2026-02-27 | `fep_connections.connection_weight` 추가 (Active-Active Weighted Round-Robin 지원) |
| v2.0 | 2026-02-27 | `fep_security_keys.alert_sent_at` EXPIRED 전이 시 리셋 금지 정책 명문화 |
| v2.0 | 2026-02-27 | Startup Recovery SQL에 CIRCUIT_REJECTED 제외 조건 명시 |
| v2.0 | 2026-02-27 | `fep_routing_rules.priority` 동점 처리 — UUID v4 비결정성 해소, `created_at ASC` 기준으로 변경 |
| v2.0 | 2026-02-27 | `fep_protocol_log.tx_id` FK ON DELETE SET NULL 정책 명문화 |
| v2.0 | 2026-02-27 | `failure_count` vs `consecutive_error_count` 역할 구분 명확화 |
| v2.0 | 2026-02-27 | MariaDB 5.5+/10.3+ SIGNAL SQLSTATE 호환성 명시 |
| v2.0 | 2026-02-27 | **SSoT 정책**: `gateway_schema.md`는 설계 의도·정책 설명 문서(Single Source of Truth for Intent), `gateway.dbml`은 ERD 시각화 도구용 구조 표현 (Source of Truth for Structure). 두 파일 간 컬럼·제약 불일치 발견 시 `gateway_schema.md`를 우선하고 `gateway.dbml`을 보정한다. |
| v2.0 | 2026-02-27 | 문서 최상단 SSoT 한 줄 요약 추가 |
| v2.0 | 2026-02-27 | `fep_connections.connection_weight = 0` Failover 트리거 조건 및 Connection Manager 책임 범위 명세 |
| v2.0 | 2026-02-27 | `fep_protocol_specs` BEFORE UPDATE Trigger 별도 명칭(`trg_protocol_specs_no_dup_null_msgtype_update`) 및 DDL 명시 |
| v2.0 | 2026-02-27 | `fep_security_keys.rotation_status` — `EXPIRED → ACTIVE` 역전이 금지를 허용되지 않는 전이로 명시 |
| v2.0 | 2026-02-27 | `fep_security_keys.alert_escalated_at` 컬럼 추가 (만료 후 Escalation 중복 방지) |
| v2.0 | 2026-02-27 | 금융감독원 보고용 CIRCUIT_REJECTED 총 거절 건수 공식 집계 쿼리 문서화 |
| v2.0 | 2026-02-27 | `fep_connections` — `idx_conn_routing (org_code, connection_weight, runtime_status)` 인덱스 추가 |
| v2.0 | 2026-02-27 | `fep_routing_rules.created_at` 타입 `DATETIME(6)`으로 변경 (초 단위 동점 방지) |
| v2.0 | 2026-02-27 | `fep_security_keys` ACTIVE Trigger BEFORE UPDATE 조기 반환 최적화 조건 추가 |
| v2.0 | 2026-02-27 | `alert_escalated_at` DB 업데이트 실패 시 at-least-once Escalation 정책 명시 |
| v2.0 | 2026-02-27 | `fep_protocol_log` 파티션 DDL — 새벽 저트래픽 시간대 실행 + Metadata Lock 주의 명시 |
| v2.0 | 2026-02-27 | `simulator_rules.expires_at` GENERATED 컬럼 기존 테이블 마이그레이션 시 Full Table Rebuild 주의 명시 |
| v2.0 | 2026-02-27 | Section 5 신규 추가: DDL 실행 순서 (FK 의존성 기반) + 기관 코드 배포 파이프라인 동기화 검증 |
| v2.0 | 2026-02-27 | `fep_circuit_breaker_state` 초기 행 자동 생성 Trigger (`AFTER INSERT ON fep_institutions`) 명세 |
| v2.0 | 2026-02-27 | **[R11]** `fep_protocol_log` 파티셔닝 + FK 공존 불가(MySQL ERROR 1506) — 앱 레이어 참조 무결성으로 대체 명시 |
| v2.0 | 2026-02-27 | **[R11]** `idx_conn_routing` 컬럼 순서 최적화 — `(org_code, runtime_status, connection_weight)` |
| v2.0 | 2026-02-27 | **[R11]** `DATETIME(6)` DDL DEFAULT 표현식 — MariaDB `NOW(6)` vs MySQL `CURRENT_TIMESTAMP(6)` 엔진별 차이 명시 |
| v2.0 | 2026-02-27 | **[R11]** `fep_security_keys` Self-FK ALTER — Seed 데이터 삽입 후 FK 추가 순서 명시 |
| v2.0 | 2026-02-27 | **[R11]** `fep_routing_rules` 변경 후 핫 리로드 정책 (Admin API / 폴링 / 재시작) 명세 추가 |
| v2.0 | 2026-02-27 | **[R11]** `fep_institutions.status SUSPENDED` 전이 연쇄 처리 정책 5단계 명세 |
| v2.0 | 2026-02-27 | **[R11]** CB State 초기화 Trigger — `ACTIVE` 기관에만 생성, `SUSPENDED` 기관 제외 조건 추가 |
| v2.0 | 2026-02-27 | **[R12]** `SUSPENDED → ACTIVE` UPDATE 전환 시 CB State 생성 `AFTER UPDATE` Trigger 추가 (INSERT IGNORE) |
| v2.0 | 2026-02-27 | **[R12]** `fep_routing_rules.target_org_code`, `fep_connections.org_code` FK `ON DELETE RESTRICT` 정책 명시 |
| v2.0 | 2026-02-27 | **[R12]** `fep_protocol_log` 초기 파티션 DDL 예시 추가 + `RANGE COLUMNS(created_at)` 연도 경계 안전 방식 권장 |
| v2.0 | 2026-02-27 | **[R12]** D-7 키 만료 알림 쿼리에 `fep_institutions.status = 'ACTIVE'` 필터 추가 — SUSPENDED 기관 불필요 알림 차단 |
| v2.0 | 2026-02-27 | **[R12]** CB OPEN → HALF_OPEN Gateway 재시작 시 즉시 전이 의도 명세 + CLOSED 강제 초기화 선택 쿼리 제공 |
| v2.0 | 2026-02-27 | **[R13]** Section 5 DDL 실행 순서 테이블 수 오기 수정 (10개 → 9개) + 전체 테이블 목록 명시 |
| v2.0 | 2026-02-27 | **[R13]** `fep_transaction_journal` 데이터 보존 정책 추가 — 전자금융거래법 제22조 **최소 5년** 보존 의무 |
| v2.0 | 2026-02-27 | **[R13]** `fep_protocol_log` DDL 예시 `msg_type NULL` → `NOT NULL`, `raw_body LONGTEXT` → `TEXT` 정합성 수정 |
| v2.0 | 2026-02-27 | **[R13]** 5개 테이블 FK ON DELETE RESTRICT 정책 명시 (`fep_protocol_specs`, `fep_security_keys`, `fep_transaction_journal`, `fep_circuit_breaker_state`, `fep_circuit_breaker_events`) |
| v2.0 | 2026-02-27 | **[R13]** DBML `fep_protocol_log.created_at` 타입 `timestamp` → `datetime(6)` 정합성 수정 |
| v2.0 | 2026-02-27 | **[R14]** `fep_institutions.updated_at` — `ON UPDATE CURRENT_TIMESTAMP` DDL 권장 정책 명시 |
| v2.0 | 2026-02-27 | **[R14]** `fep_connections` — `UNIQUE KEY uk_conn_endpoint (org_code, host_ip, port)` 추가 — 동일 기관 동일 엔드포인트 중복 회선 생성 방지 |
| v2.0 | 2026-02-27 | **[R14]** `fep_routing_rules` — Symbol-prefix 범위 중첩(Overlap) 탐지 정책 추가 — 애플리케이션 레이어 INSERT/UPDATE 시 중첩 검사 쿼리 및 처리 정책 명세 |
| v2.0 | 2026-02-27 | **[R14]** `fep_transaction_journal.req_timestamp`/`res_timestamp` — TIMESTAMP 초 단위 제한 경고 + `duration_ms` 앱 레이어 하드코딩 정책 명시. `DATETIME(3)` 업그레이드 권장 |
| v2.0 | 2026-02-27 | **[R14]** Section 5 `fep_protocol_log` FK 주석 수정 — "FK 선언 안 함 (MySQL ERROR 1506)" 명시하여 실제 DDL에 FK가 포함된다는 오해 제거 |
| v2.0 | 2026-02-27 | **[R14]** Section 5 Trigger 생성 순서 보완 — `AFTER INSERT` (trg_init) + `AFTER UPDATE` (trg_activate) 두 Trigger 모두 명시 |
| v2.0 | 2026-02-27 | **[R15]** `fep_routing_rules` — 인덱스 전략 신규 추가: `idx_routing_symbol (routing_type, is_active, symbol_prefix_start)`, `idx_routing_exchange (routing_type, is_active, exchange_code)` — 매 주문마다 발생하던 라우팅 풀스캔 제거 |
| v2.0 | 2026-02-27 | **[R15]** `fep_protocol_log` 파티션 전략 — `RANGE (MONTH())` 비권장 → `RANGE COLUMNS(created_at)` 권장 방식을 주 DDL 예시로 승격, 연도 경계 버그 방지 |
| v2.0 | 2026-02-27 | **[R15]** DBML `fep_transaction_journal.req_timestamp`/`res_timestamp` 타입 `timestamp` → `datetime(3)` 보정 (schema.md R14 권장 반영) |
| v2.0 | 2026-02-27 | **[R15]** DBML `fep_circuit_breaker_events.created_at` 타입 `timestamp` → `datetime(6)` 보정 — 타임라인 정렬 키 밀리초 정밀도 강화 |
| v2.0 | 2026-02-27 | **[R15]** `fep_security_keys` EXPIRED 자동 전이 스케줄러 — 실행 주기(5분), 낙관적 잠금 UPDATE 패턴, Race Condition 자연 해소 방식 명세 |
| v2.0 | 2026-02-27 | **[R16]** `fep_security_keys` ACTIVE 중복 방지 Trigger 전체 DDL 추가 — `trg_security_keys_active_dup_insert` (BEFORE INSERT) + `trg_security_keys_active_dup_update` (BEFORE UPDATE) 완전한 `CREATE TRIGGER` 구문 제공 |
| v2.0 | 2026-02-27 | **[R16]** `fep_circuit_breaker_state.failure_threshold` 컬럼 추가 — `>= 5` 매직넘버 제거, 기관별 CLOSED→OPEN 임계치 설정 지원 (기본값 5) |
| v2.0 | 2026-02-27 | **[R16]** `fep_connections` 기동 시 `runtime_status` DISCONNECTED 리셋 SQL 명시 — Startup Recovery Step 0으로 문서화 |
| v2.0 | 2026-02-27 | **[R16]** DBML `fep_circuit_breaker_state.open_until`/`last_failure_at` 타입 `timestamp` → `datetime` 변경 — MySQL TIMESTAMP 2038-01-19 오버플로우 방지 |
| v2.0 | 2026-02-27 | **[R16]** DBML `fep_institutions.updated_at` — `ON UPDATE CURRENT_TIMESTAMP` 권장 note 추가 (schema.md R14 정책 보정) |
| v2.0 | 2026-02-27 | **[R17]** `fep_security_keys` 인덱스 전략 신규 추가 — `idx_key_active (org_code, key_type, rotation_status)`: MAC 계산·D-7 알림·Trigger 중복 검사 모두 동일 조합 → 풀스캔 제거 |
| v2.0 | 2026-02-27 | **[R17]** CB Trigger DDL (`trg_init_circuit_breaker`, `trg_activate_circuit_breaker`) INSERT 컬럼 목록에 `failure_threshold` 반영 — R16 컬럼 추가 후 Trigger DDL 미반영 버그 수정 |
| v2.0 | 2026-02-27 | **[R17]** `fep_transaction_journal.amount` — `CHECK (amount >= 0)` 제약 정책 명시 + MySQL 버전별 강제 여부 주의사항 추가 |
| v2.0 | 2026-02-27 | **[R17]** DBML `fep_circuit_breaker_state.updated_at` 타입 `timestamp` → `datetime` 변경 — R16 누락 항목, MySQL TIMESTAMP 2038 오버플로 방지 |
| v2.0 | 2026-02-27 | **[R17]** DBML `fep_security_keys` `indexes` 블록 추가 — `idx_key_active (org_code, key_type, rotation_status)` |
| v2.0 | 2026-02-27 | **[R18]** `fep_routing_rules.symbol_prefix_start/end` — VARCHAR 비교 함정 + symbol_prefix(종목코드 앞 N자리) 혼재 시 lexicographic 오판정 주의사항 추가. BIGINT UNSIGNED 전환 권장, VARCHAR 유지 시 LPAD 8자리 패딩 강제 정책 명시 |
| v2.0 | 2026-02-27 | **[R18]** `fep_protocol_specs.updated_at` — `ON UPDATE CURRENT_TIMESTAMP` 필수 명시. 미설정 시 폴링 캐시 무효화(`updated_at > last_loaded_at`) 전략 전체 무력화 경고 추가 |
| v2.0 | 2026-02-27 | **[R18]** DBML `fep_transaction_journal.amount` — `CHECK (amount >= 0)` note 추가 (R17 schema.md 반영 DBML 미보정 수정) |
| v2.0 | 2026-02-27 | **[R18]** DBML `fep_connections` 시각 컬럼 3개 (`last_snapshot_at`, `last_echo_sent_at`, `last_echo_received_at`) `timestamp` → `datetime` 변경 — MySQL TIMESTAMP 2038 오버플로우 방지 |
| v2.0 | 2026-02-27 | **[R18]** DBML `fep_security_keys` 시각 컬럼 3개 (`alert_sent_at`, `alert_escalated_at`, `created_at`) `timestamp` → `datetime` 변경 — MySQL TIMESTAMP 2038 오버플로우 방지 |
| v2.0 | 2026-02-27 | **[R19]** `fep_circuit_breaker_events.trigger` — MySQL/MariaDB 예약어 `TRIGGER` 충돌 경고 추가. DDL에서 백틱 필수 명시 + `trigger_type`으로 컬럼명 변경 권장. schema.md + DBML 양쪽 반영 |
| v2.0 | 2026-02-27 | **[R19]** `fep_protocol_specs` 캐시 로드 인덱스 신규 추가 — `idx_spec_load (org_code, msg_type)`: 기동 로드 + 폴링 전용. `uk_spec(org_code, field_no, msg_type)`에서 `field_no`가 중간 위치하여 `WHERE org_code=? AND msg_type=?` 패턴 비효율 해소. schema.md + DBML 반영 |
| v2.0 | 2026-02-27 | **[R19]** `fep_routing_rules` CHECK constraint 부근에 VARCHAR `symbol_prefix_start <= symbol_prefix_end` 조건이 lexicographic 비교임을 명시 (R18 함정과 연동하여 CHECK 코드 근처 구체화) |
| v2.0 | 2026-02-27 | **[R19]** DBML `fep_routing_rules.symbol_prefix_start/end` note — R18 VARCHAR 함정 + Extended BIN BIGINT UNSIGNED 권장 문구 DBML에도 반영 |
| v2.0 | 2026-02-27 | **[R19]** DBML `fep_protocol_log.direction` — `varchar(5)` → `varchar(3)` 정합성 보정 (`IN` 2자·`OUT` 3자 최대 3바이트) |
| v2.0 | 2026-02-27 | **[R20]** Changelog R19 행 병합 버그 수정 (`||` → 줄바꿈 분리) + 오타 `콼럼명`→`컬럼명`, `쾐시`→`캐시` 교정 |
| v2.0 | 2026-02-27 | **[R20]** `fep_circuit_breaker_events.trigger_type` — schema.md 컬럼명 `trigger` → `trigger_type` 반영 완료. R19 DBML 변경과 schema.md 동기화. 예약어 경고 → 변경 완료 노트로 교체 |
| v2.0 | 2026-02-27 | **[R20]** DBML `fep_protocol_log.msg_type` 타입/길이 보정 (`varchar(10)` → `varchar(2)`) 및 schema.md DDL 동기화 |
| v2.0 | 2026-02-27 | **[R20]** `fep_routing_rules.updated_at` — `ON UPDATE CURRENT_TIMESTAMP` 필수 명시 추가. 핫리로드 폴링 방식(`updated_at > last_loaded_at`)이 DDL 누락 시 무음 실패. schema.md + DBML 동시 반영 (`fep_protocol_specs` R18 동일 패턴) |
| v2.0 | 2026-02-27 | **[R20]** DBML `fep_protocol_specs.created_at/updated_at` `timestamp` → `datetime` 보정. R18에서 connections/security_keys 변환 시 이 테이블 누락. DDL note `TIMESTAMP` → `DATETIME` 동기화 |
| v2.0 | 2026-02-27 | **[R21]** `fep_transaction_journal` 섹션 헤더 오타 `콤럼` → `컬럼` 교정 |
| v2.0 | 2026-02-27 | **[R21]** `fep_protocol_specs.idx_spec_load` 설명 오타 4개 교정: `쾐시`×2→`캐시`, `딱라진다`→`떨어진다`, `로드맴`→`로드`, SQL 주석 `콼럼 순서`→`컬럼 순서` |
| v2.0 | 2026-02-27 | **[R21]** `fep_routing_rules` CHECK constraint 설명 오타 2개 교정: `lexicographic(stext 사전순)`→`lexicographic(사전순)` (앞 `s` 오타), `6자리 BIN라리는`→`6자리 BIN이라면` |
| v2.0 | 2026-02-27 | **[R21]** `fep_protocol_specs.updated_at` DDL 예시 `TIMESTAMP` → `DATETIME` 반영 — R20에서 DBML `datetime` 변환 완료했으나 schema.md 본문 DDL 예시 미반영 수정 |
| v2.0 | 2026-02-27 | **[R21]** DBML `fep_transaction_journal.msg_type` 타입/컬럼명 정합 보정 (legacy 컬럼명 → `msg_type`, `varchar(10)` → `varchar(2)`) |
| v2.0 | 2026-02-27 | **[R21]** DBML `fep_protocol_log.direction` note 강화 — schema.md DDL `ENUM('IN','OUT')` 정합 명시. DBML이 MySQL ENUM을 지원하지 않아 `varchar(3)` 유지하되 DDL 정확성 note 추가 |
| v2.0 | 2026-02-27 | **[R22]** DBML `fep_institutions.created_at/updated_at` `timestamp` → `datetime` 변경 — R13~R20 일괄 마이그레이션에서 유일하게 누락된 테이블. 기관 레코드는 무기한 유지되므로 2038-01-19 `TIMESTAMP` 오버플로우 위험. DBML + schema.md `updated_at` DDL 예시 `TIMESTAMP` → `DATETIME` 동기화 |
| v2.0 | 2026-02-27 | **[R22]** DBML `fep_protocol_specs.msg_type` 타입 보정 (`varchar(10)` → `varchar(2)`) 및 연관 테이블 정합 동기화 |
| v2.0 | 2026-02-27 | **[R22]** DBML `fep_circuit_breaker_events.idx_cb_events` note 강화 — schema.md DDL 정의 `INDEX idx_cb_events (org_code, created_at DESC)` 내림차순 인덱스 명시. MySQL 8.0+ / MariaDB 10.6+ 전용(구버전 ASC로 무음 대체). DBML이 DESC 인덱스 방향 미지원 — 실제 DDL 적용 필요 안내 |
| v2.0 | 2026-02-27 | **[R23]** Section 5 Trigger 생성 순서 `두 가지` → 총 **6개** 수정 — 누락된 4개 Trigger 목록 추가: `trg_security_keys_active_dup_insert` (BEFORE INSERT ON fep_security_keys), `trg_security_keys_active_dup_update` (BEFORE UPDATE ON fep_security_keys), `trg_protocol_specs_no_dup_null_msgtype` (BEFORE INSERT ON fep_protocol_specs), `trg_protocol_specs_no_dup_null_msgtype_update` (BEFORE UPDATE ON fep_protocol_specs) |
| v2.0 | 2026-02-27 | **[R23]** `fep_protocol_specs.idx_spec_load` SQL 코드 블록 마크다운 구조 오류 수정 — 닫는 ` ``` ` 뒤 본문이 같은 줄에 이어지던 문제 해소, 코드 블록 닫기와 후속 단락 사이 줄바꿈 추가 |
| v2.0 | 2026-02-27 | **[R23]** `fep_security_keys.created_at`, `fep_protocol_specs.created_at` 컬럼 설명에 `DATETIME` 타입 명시 추가 — DBML(R18/R20)에서 `datetime`으로 정의됐으나 schema.md 컬럼 목록에 타입 미기재 상태 수정 |
| v2.0 | 2026-02-27 | **[R24]** `fep_institutions.created_at` 컬럼 설명에 `DATETIME` 타입 명시 추가 — R23 패턴 일관성 완성. `created_at` 타입 미명시 잔류 테이블 3개 중 첫 번째 |
| v2.0 | 2026-02-27 | **[R24]** `fep_circuit_breaker_events.created_at` 컬럼 설명에 `DATETIME(6)` 타입 명시 추가 — 타임라인 정렬 기준 컬럼으로 마이크로초 정밀도 중요. DBML R15 `datetime(6)` 반영 |
| v2.0 | 2026-02-27 | **[R24]** `fep_protocol_log.created_at` 컬럼 설명에 `DATETIME(6)` 타입 명시 추가 — 파티션 키 컬럼이므로 `NOT NULL` 필수 명시. DDL 예시 `DATETIME(6) NOT NULL`과 일관성 확보 |
| v2.0 | 2026-02-27 | **[R25]** `fep_connections.last_snapshot_at`, `last_echo_sent_at`, `last_echo_received_at` 컬럼 설명에 `DATETIME` 타입 명시 추가 — DBML R18 `datetime` 반영. 2038 오버플로우 방지 막는 이유 코드 수준 명문화 |
| v2.0 | 2026-02-27 | **[R25]** `fep_circuit_breaker_state.last_failure_at`, `open_until`, `updated_at` 컬럼 설명에 `DATETIME` 타입 명시 추가 — DBML R16/R17 `datetime` 반영. `open_until`에 `NULL IS NOT NULL` 선행 점검 이유 타입 특성과 함께 명시 |
| v2.0 | 2026-02-27 | **[R26]** `fep_transaction_journal.req_timestamp`, `res_timestamp` 컬럼 설명 정리 — DBML R15에서 `datetime(3)` 확정된 상태임에도 "`TIMESTAMP` 또는" 선택지 표현 잔류. `DATETIME(3)` 확정 타입으로 명시 + 표제에 일관성 정리 |
| v2.0 | 2026-02-27 | **[R26]** `fep_transaction_journal.response_code` 컬럼 설명에 `VARCHAR(10)` 타입 명시 추가 — DBML `varchar(10)` 반영 |
| v2.0 | 2026-02-27 | **[R26]** `fep_protocol_log.msg_type`, `direction` 컬럼 설명에 타입 명시 추가 — `msg_type VARCHAR(2)`, `direction ENUM('IN','OUT')` (DBML `varchar(3)`은 ERD 도구 호환 목적) |
| v2.0 | 2026-02-27 | **[R27]** `fep_transaction_journal` 핵심 비즈니스 컬럼 타입 미명시 일괄 수정 — `msg_seq_num INT`, `tx_status VARCHAR(20)`, `msg_type VARCHAR(2)`, `cl_ord_id VARCHAR(64)`, `currency VARCHAR(3)`, `duration_ms INT`, `failure_reason VARCHAR(100)` 타입 명시 추가. DBML 구조 정합 확인 |
| v2.0 | 2026-02-27 | **[R28]** 전체 검증 일괄 수정 — 오타 2개(`왔`→`왜`, `찬번째`→`첫번째`), 형식 비일관성 수정(`connection_weight`, `needs_reconciliation`, `amount`, `throttled_count`, `trigger_type` 백틱/형식 통일), `fep_connections` 스칼라 컬럼 11개 타입 명시(`conn_id CHAR(36)`, `host_ip VARCHAR(45)`, `port INT`, `is_primary TINYINT(1)`, `max_connections INT`, `keep_alive_interval INT`, `snapshot_active_count INT DEFAULT 0`, `consecutive_echo_fail_count INT DEFAULT 0`, `echo_fail_threshold INT DEFAULT 3`, `consecutive_error_count INT DEFAULT 0`, `runtime_status VARCHAR(20)`) |
| v2.0 | 2026-02-27 | **[R30]** 전체 잔류 미명시 컬럼 일괄 처리 — `fep_institutions`/`fep_connections`/`fep_routing_rules`/`fep_protocol_specs` 타입 표기 통일 (`msg_type VARCHAR(2)` 기준) |
| v2.0 | 2026-02-27 | **[R29]** `fep_circuit_breaker_state` 스칼라 컬럼 6개 타입 명시 — `state VARCHAR(20)`, `failure_count INT DEFAULT 0`, `success_count INT DEFAULT 0`, `half_open_threshold INT DEFAULT 3`, `open_duration_seconds INT DEFAULT 60`, `failure_threshold INT DEFAULT 5`. `fep_circuit_breaker_events` 스칼라 컬럼 4개 타입 명시 — `event_id CHAR(36)`, `from_state VARCHAR(20)`, `to_state VARCHAR(20)`, `failure_count_snapshot INT NULL`. DBML `fep_transaction_journal.duration_ms` 앱 레이어 계산 정책 note 추가 |
| v2.0 | 2026-02-27 | **[R30]** 전체 잔류 미명시 컬럼 일괄 처리 (2/2) — `fep_security_keys`(`credential_value_encrypted`, `cert_fingerprint` 포함), `fep_protocol_log`, FK 타입 표기 통일 |
| v2.0 | 2026-02-27 | **[R31]** DBML `uuid` → `char(36)` 전환 — 6개 테이블 10개 컬럼(`conn_id`, `rule_id`, `spec_id`, `key_id`, `rotated_from_key_id`, `tx_id`×2, `reversal_ref_tx_id`, `log_id`, `event_id`). MySQL/MariaDB에 `uuid` 네이티브 타입 없음 — DDL 실제 타입은 `CHAR(36)`. schema.md SSoT 정책 기반 DBML 보정. 각 컬럼에 `DDL: CHAR(36)` note 추가 |
| v2.0 | 2026-02-27 | **[R31]** `fep_transaction_journal.needs_reconciliation` — `BOOLEAN DEFAULT FALSE` → `TINYINT(1) DEFAULT 0` 보정. `is_primary`, `is_mandatory`, `is_active` 등 다른 Boolean 컬럼 표기 방식(`TINYINT(1)`)과 일관성 확보. MySQL `BOOLEAN = TINYINT(1)` 동의어이므로 DDL 동작 동일하나 schema.md 내 타입 표기 통일. Reconciliation 설명 본문 동기화(TRUE/FALSE → 1/0 명시) |
| v2.0 | 2026-02-27 | **[R31]** `fep_connections.is_primary`, `fep_protocol_specs.is_mandatory`, `fep_protocol_specs.is_active` — `DEFAULT 1` 명시 추가. DBML에 `default: true` 표기 존재하나 schema.md 설명에 DEFAULT 누락. 신규 레코드 삽입 시 기본값(`1`) 정책 명문화 |
| v2.0 | 2026-02-27 | **[R32]** `fep_transaction_journal`, `fep_protocol_log`, `fep_circuit_breaker_events` — **Surrogate PK(BIGINT AUTO_INCREMENT) + Business UUID(CHAR(36) UNIQUE)** 이중 키 패턴 적용. `tx_id`/`log_id`/`event_id`를 UK로 마이그레이션, `id BIGINT AI`를 내부 PK로 설정. B-tree 순차 삽입 + FK JOIN 비용 최소화 + 외부 노온 UUID 유지 |
| v2.0 | 2026-02-27 | **[R32]** `fep_protocol_log` — `PRIMARY KEY (id, created_at)` 적용으로 MySQL **ERROR 1503** 해소. 파티션 키 `created_at`을 PK에 포함하지 않으면 `PARTITION BY RANGE COLUMNS` DDL 실행 실패. DDL 예시 업데이트 |
| v2.0 | 2026-02-27 | **[R32]** 실확 가이드말 추가 — 엔드포인트 API는 언제나 `tx_id`/`log_id`/`event_id`(UUID) 사용. `id`(BIGINT)는 DB 내부 JOIN 전용으로 외부 노읖 금지 |
| v2.0 | 2026-02-27 | **[R33]** `fep_connections`, `fep_routing_rules`, `fep_protocol_specs`, `fep_security_keys` — **Surrogate PK(BIGINT AUTO_INCREMENT) + Business UUID(CHAR(36) UNIQUE)** 이중 키 패턴 전체 적용 완료. R32에서 고빈도 3개 테이블 적용에 이어 나머지 4개 테이블로 확장. 9개 테이블 중 자연키 보유 2개(`fep_institutions.org_code`, `fep_circuit_breaker_state.org_code`) 제외 전체 통일. |
| v2.0 | 2026-02-27 | **[R33]** `fep_connections.conn_id` — PK → UK(`CHAR(36) UNIQUE NOT NULL`) 전환. `id BIGINT UNSIGNED AUTO_INCREMENT` 내부 PK 신규 추가. Admin API·모니터링 진입점은 `conn_id` 사용 원칙 명문화 |
| v2.0 | 2026-02-27 | **[R33]** `fep_routing_rules.rule_id` — PK → UK 전환. `id BIGINT` 내부 PK 신규 추가. Symbol-prefix 중첩 검사 쿼리(`AND rule_id != :rule_id`)는 UK로도 동일하게 동작 |
| v2.0 | 2026-02-27 | **[R33]** `fep_protocol_specs.spec_id` — PK → UK 전환. `id BIGINT` 내부 PK 신규 추가. NULL msg_type 중복 방지 Trigger(`AND spec_id != NEW.spec_id`) — UK로도 동일하게 동작 |
| v2.0 | 2026-02-27 | **[R33]** `fep_security_keys.key_id` — PK → UK 전환. `id BIGINT` 내부 PK 신규 추가. `rotated_from_key_id` Self-FK 참조 대상이 PK→UK로 변경됨 — MySQL/MariaDB는 FK가 UNIQUE KEY를 참조 가능하므로 DDL 유효. ACTIVE 중복 방지 Trigger(`AND key_id != NEW.key_id`) — UK로도 동일하게 동작 |
| v2.0 | 2026-02-27 | **[R33]** DBML `tx_id` note 오타 수정 — `노옶` → `노출` |
| v2.0 | 2026-02-27 | **[R34]** `fep_connections`, `fep_routing_rules`, `fep_protocol_specs`, `fep_security_keys` — 인덱스 전략에 **`UNIQUE KEY uk_{uuid_col} ({uuid_col})`** 명시 추가. R32 적용 3개 테이블(`uk_tx_id`, `uk_log_id`, `uk_event_id`)과 일관성 확보. Admin API 단일 행 조회 진입점 및 Trigger 자기 자신 제외 기준 명문화 |
| v2.0 | 2026-02-27 | **[R34]** DBML indexes 블록 — 4개 테이블에 named UK index 추가: `uk_conn_id`, `uk_rule_id`, `uk_spec_id`, `uk_key_id`. 컬럼 레벨 `[unique, not null]` 선언만으로는 ERD 도구에서 인덱스 이름이 자동 생성되어 운영 진단(`SHOW INDEX`) 시 식별이 어려움 — 명칭 명시로 해소 |
| v2.0 | 2026-02-27 | **[R34]** Section 5 DDL 실행 순서 Self-FK 주석 업데이트 — `fep_security_keys.key_id`: `PK` → `UNIQUE KEY` 변경 사실 명시. `fep_transaction_journal.tx_id`: `UNIQUE KEY` 명시 추가. MySQL/MariaDB FK가 UNIQUE KEY 참조 가능함 재확인 |
| v2.0 | 2026-02-27 | **[R35]** DBML `fep_transaction_journal` indexes 블록에 `uk_tx_id` named index 추가 — R34에서 4개 테이블에 적용했으나 R32 적용 3개 테이블 누락 보완. `tx_id [unique, name: 'uk_tx_id']` — 외부 API 진입점·`reversal_ref_tx_id` Self-FK 참조 대상 명시 |
| v2.0 | 2026-02-27 | **[R35]** DBML `fep_protocol_log`에 `indexes { }` 블록 신규 추가 — `log_id [unique, name: 'uk_log_id']`. 파티션 테이블 UK는 파티션 키 포함 불필요(`log_id` 단독 UK 가능) 사유 명시 |
| v2.0 | 2026-02-27 | **[R35]** DBML `fep_circuit_breaker_events` indexes 블록에 `uk_event_id` named index 추가 — `event_id [unique, name: 'uk_event_id']` — INSERT ONLY 특성상 UUID 불변 보장 명시 |
| v2.0 | 2026-02-27 | **[R35]** DBML `fep_transaction_journal.needs_reconciliation` note — `TRUE/FALSE` → `1(TRUE)/0(FALSE)` 표기 보정. R31에서 schema.md는 `TINYINT(1) DEFAULT 0`으로 수정했으나 DBML note 미반영. `DDL: TINYINT(1) DEFAULT 0` 명시 추가 |
| v2.0 | 2026-02-27 | **[R35]** schema.md `fep_circuit_breaker_events` 인덱스 섹션 확장 — 한 줄 요약(`INDEX idx_cb_events`) → `PRIMARY KEY (id)` + `UNIQUE KEY uk_event_id (event_id)` + `INDEX idx_cb_events` 전체 목록. R34에서 4개 테이블 인덱스 전략 확장과 동일한 수준으로 통일 |
| v2.0 | 2026-02-27 | **[R36]** DBML `fep_connections.is_primary` note — `DDL: TINYINT(1) DEFAULT 1` 추가. R31에서 schema.md TINYINT(1) 통일 적용 시 DBML note 미동기화 수정 |
| v2.0 | 2026-02-27 | **[R36]** DBML `fep_routing_rules.is_active` — note 없음 → `DDL: TINYINT(1) DEFAULT 1 — MySQL BOOLEAN = TINYINT(1). 0=disabled (soft delete without physical DELETE)` 신규 추가. R31 미처리 보완 |
| v2.0 | 2026-02-27 | **[R36]** DBML `fep_protocol_specs.is_mandatory` — note 없음 → `DDL: TINYINT(1) DEFAULT 1 — MySQL BOOLEAN = TINYINT(1). FALSE(0) = DE can be absent from message` 신규 추가. R31 미처리 보완 |
| v2.0 | 2026-02-27 | **[R36]** DBML `fep_protocol_specs.is_active` — 기존 note에 `DDL: TINYINT(1) DEFAULT 1` 추가. `FALSE` → `FALSE(0)` 표기 보정. R31 미처리 보완 |
| v2.0 | 2026-02-27 | **[R36]** schema.md `fep_security_keys` 인덱스 전략 섹션 — `UNIQUE KEY uk_key_id` 앞에 `PRIMARY KEY (id)` 추가. R33에서 이중 키 패턴 적용 시 5개 다른 테이블과 달리 PK 명시 누락. `id`가 DB 내부 전용임을 명시 |
| v2.0 | 2026-02-27 | **[R37]** DBML `fep_circuit_breaker_events.event_id` note — `DDL: CHAR(36) UNIQUE NOT NULL. ... DDL: CHAR(36) — uuid 네이티브 타입 없음` 중복 DDL 접두사 → `DDL: CHAR(36) UNIQUE NOT NULL — MySQL/MariaDB에 uuid 네이티브 타입 없음; CHAR(36)은 하이픈 포함 UUID 문자열(8-4-4-4-12) 저장에 최적` 단일 표현으로 통합 |
| v2.0 | 2026-02-27 | **[R37]** DBML `fep_protocol_log.tx_id` note — `이으로` 오타 → `이므로` 수정. 한글 조사 오류 |
| v2.0 | 2026-02-27 | **[R37]** DBML `fep_protocol_log` indexes 블록 — `(id, created_at) [pk]` 복합 PK 선두 추가. `id [increment, not null]`만으로는 ERD 뷰어에서 PK가 미표현됨 — `PRIMARY KEY (id, created_at)` 설계 의도를 DBML indexes 블록으로 명시. MySQL/MariaDB 파티션 테이블 복합 PK 필요 사유(ERROR 1503) 기재 |
| v2.0 | 2026-02-27 | **[R37]** DBML `fep_circuit_breaker_state.updated_at` — `not null` 추가. CB State 초기 INSERT(trg_init_circuit_breaker)에서 항상 `NOW()` 주입하므로 NOT NULL 유효. 다른 열(state, failure_count 등)과 일관성 확보 |
| v2.0 | 2026-02-27 | **[R37]** DBML `fep_security_keys.created_at` — `not null` 추가. 키 생성 시각은 INSERT 시 항상 존재하는 감사 필드로 NULL 허용 불필요. 감사 추적·교체 주기 계산의 신뢰성 강화 |
| v2.0 | 2026-02-27 | **[R38]** DBML `fep_institutions.created_at` / `updated_at` — `not null` 추가. 기관 레코드는 무기한 유지되는 감사 필드이며 INSERT 시 반드시 값이 존재하므로 NOT NULL 유효. R37에서 다른 테이블 적용 시 누락 |
| v2.0 | 2026-02-27 | **[R38]** DBML `fep_connections.snapshot_active_count` — `not null, default: 0` 명시. 모니터링 스냅샷 초기값 보장. 고빈도 카운팅 제외 대상 컬럼으로 NOT NULL 안전 |
| v2.0 | 2026-02-27 | **[R38]** DBML `fep_routing_rules.created_at` / `updated_at` — `not null` 추가. `created_at DATETIME(6)`은 동점 정렬 기준이므로 NULL 불허; `updated_at DATETIME(6)`은 폴링 캐시 무효화 비교 키(`updated_at > last_loaded_at`)이므로 NULL 불허 |
| v2.0 | 2026-02-27 | **[R38]** DBML `fep_protocol_specs.created_at` / `updated_at` — `not null` 추가. `updated_at` 폴링 캐시 무효화 패턴 동일 (`ON UPDATE CURRENT_TIMESTAMP` 필수). R37에서 연관 테이블 변경 시 누락 보완 |
| v2.0 | 2026-02-27 | **[R38]** DBML `fep_protocol_log.created_at` — `not null` 추가 및 note에 `NOT NULL required: partition key` 명시. MySQL/MariaDB `PARTITION BY RANGE COLUMNS` 파티션 키는 NULL 허용 불가 — NULL 값은 파티션 배치 불가로 DDL 실패 발생 |
| v2.0 | 2026-02-27 | **[R38]** DBML `fep_circuit_breaker_events.created_at` — `not null` 추가. 타임라인 포렌식 정렬 키에 NULL 허용 시 이벤트 순서 보장이 붕괴됨. `datetime(6)` 마이크로초 정밀도 유지 |
| v2.0 | 2026-02-27 | **[R38]** DBML `fep_protocol_log.log_id` note 오타 수정 — `연동주에` → `연동 시에` 한글 조사 교정 |
| v2.0 | 2026-02-27 | **[R38]** schema.md `fep_routing_rules.created_at` `DATETIME(6) NOT NULL` 반영, `fep_circuit_breaker_events.created_at` `DATETIME(6) NOT NULL` 반영, `fep_security_keys.created_at` `DATETIME NOT NULL` 반영 — R37 DBML `not null` 변경에 대응하는 schema.md 본문 동기화 |
| v2.0 | 2026-02-27 | **[R39]** DBML `fep_institutions.status` — `DDL: ENUM('ACTIVE','SUSPENDED')` note 추가. `VARCHAR(20)`은 DBML MySQL ENUM 미지원으로 인한 ERD 도구 호환 목적 — 실제 DDL은 `ENUM` 사용 권장 |
| v2.0 | 2026-02-27 | **[R39]** DBML `fep_routing_rules.routing_type` — `DDL: ENUM('SYMBOL_PREFIX','EXCHANGE')` note 추가. `VARCHAR(20)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R39]** DBML `fep_security_keys.key_type` — `DDL: ENUM('TLS_CERT','LOGON_PASSWORD','ADMIN_TOKEN')` note 추가. `VARCHAR(20)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R39]** DBML `fep_transaction_journal.tx_status` — `DDL: ENUM('PENDING','COMPLETED','TIMEOUT','REVERSED','MALFORMED','UNKNOWN','CIRCUIT_REJECTED')` note 추가. `VARCHAR(20)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R39]** DBML `fep_circuit_breaker_state.state` — `DDL: ENUM('CLOSED','OPEN','HALF_OPEN')` note 추가. `VARCHAR(20)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R39]** DBML `fep_circuit_breaker_events.from_state` / `to_state` — `ENUM:` 접두사 + `DDL: ENUM(...)` note 추가. `from_state`에 `INITIAL` 값 명시 (기관 최초 등록 시 이전 상태 없음). `VARCHAR(20)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R39]** schema.md `fep_transaction_journal.tx_status` — `DDL: ENUM('PENDING','COMPLETED','TIMEOUT','REVERSED','MALFORMED','UNKNOWN','CIRCUIT_REJECTED')` 명시 추가. 컬럼 설명에 상태 값은 열거됐으나 실제 DDL 타입 선언 미명시 상태 수정 |
| v2.0 | 2026-02-27 | **[R39]** schema.md `fep_circuit_breaker_events.from_state` / `to_state` — `DDL: ENUM(...)` 명시 추가. 전이 상태 값이 괄호 내 열거 표기만 존재하고 DDL 타입 선언 미명시 상태 수정 |
| v2.0 | 2026-02-27 | **[R40]** DBML `fep_connections.runtime_status` — `DDL: ENUM('DISCONNECTED','CONNECTED','SIGNED_ON','DEGRADED')` note 추가. R39에서 7개 ENUM 컬럼 추가 시 누락 보완. `VARCHAR(20)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R40]** DBML `fep_security_keys.rotation_status` — `DDL: ENUM('ACTIVE','ROTATED','EXPIRED')` note 추가. R39 누락 보완. `VARCHAR(20)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R40]** schema.md `fep_protocol_specs.created_at` / `updated_at` — `DATETIME` → `DATETIME NOT NULL` 동기화. R38에서 DBML `not null` 추가 시 schema.md 본문 미반영 수정 |
| v2.0 | 2026-02-27 | **[R40]** schema.md `fep_circuit_breaker_events.created_at` 설명 오타 — `타임스킬프` → `타임스탬프` 교정. `포렌식 부활` → `포렌식 재구성` 표현 정확화 |
| v2.0 | 2026-02-27 | **[R40]** DBML `fep_protocol_specs.data_type` — `DDL: ENUM('INT','FLOAT','CHAR','STRING','BOOLEAN','PRICE','QTY','CURRENCY','EXCHANGE','UTCTIMESTAMP')` note 추가 |
| v2.0 | 2026-02-27 | **[R40]** DBML `fep_protocol_specs.length_type` — `DDL: ENUM('FIXED','VARIABLE')` note 추가. `VARCHAR(10)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R40]** DBML `fep_circuit_breaker_events.trigger_type` — `DDL: ENUM('FAILURE_THRESHOLD','OPEN_EXPIRED','SUCCESS_THRESHOLD','HALF_OPEN_FAILURE','MANUAL_RESET')` note 추가. R19 예약어 변경 이력 note 유지. `VARCHAR(30)` ERD 도구 호환 목적 |
| v2.0 | 2026-02-27 | **[R41]** schema.md `fep_circuit_breaker_state.updated_at` — `DATETIME` → `DATETIME NOT NULL` 반영. DBML R37 `not null` 추가 시 schema.md 본문 미동기화 수정. Trigger INSERT 시 항상 `NOW()` 주입 근거 명시 |
| v2.0 | 2026-02-27 | **[R41]** schema.md `fep_connections.last_snapshot_at`, `last_echo_sent_at`, `last_echo_received_at` — **NULL 허용** 명시 추가. 세 컬럼 모두 DBML에서 `not null` 없이 선언된 NULL 허용 컬럼이나 schema.md 설명에 NULL 허용 여부 미명시. 초기값 NULL 이유(`최초 스냅샷 flush 전`, `최초 Echo 발송 전`, `최초 Echo 수신 전`) 각각 명시 |
| v2.0 | 2026-02-27 | **[R41]** schema.md Section 5 DDL 오타 수정 — `참조하림으로` → `참조하므로` (`fep_transaction_journal.reversal_ref_tx_id` FK 설명 주석) |
| v2.0 | 2026-02-27 | **[R41]** schema.md `fep_security_keys.updated_at` 부재 — 설계 의도 명문화 추가. `created_at` 아래에 ℹ️ 노트로 "Append-Only + 단방향 상태 전이 테이블 특성상 폴링 기반 캐시 무효화 불필요, 교체 이력은 `rotated_from_key_id` 체인으로 추적, 알림 시각은 `alert_sent_at`/`alert_escalated_at`으로 대체" 근거 기술 — 누락 오해 방지 |
| v2.0 | 2026-02-27 | **[R42]** schema.md `fep_security_keys.cert_fingerprint` — **NULL 허용** 명시 추가. 인증서 타입 외 자격증명에서 NULL 허용 정책 명문화 |
| v2.0 | 2026-02-27 | **[R42]** schema.md `fep_connections` — **`updated_at` 부재 설계 의도 명문화**. 인덱스 전략 섹션 앞에 ℹ️ 노트 추가: 폴링 기반 캐시 무효화 없음, 런타임 시각은 `last_snapshot_at` 등 전용 컬럼으로 추적, 설정 변경은 Admin API 이벤트 방식으로 처리 — 의도적 생략 근거 명시 |
| v2.0 | 2026-02-27 | **[R42]** schema.md `fep_transaction_journal.duration_ms` — **NULL 허용** 명시 + PENDING 상태에서 NULL인 이유 추가. `PENDING` 상태에서는 응답 수신 전이므로 `NULL`. `COMPLETED`/`TIMEOUT`/`MALFORMED`/`REVERSED` 전이 UPDATE 시점에 애플리케이션이 측정값을 하드코딩. `CIRCUIT_REJECTED`는 INSERT 시점에 `0` 또는 극소값 설정 |
| v2.0 | 2026-02-27 | **[R43]** schema.md `fep_connections` ℹ️ `updated_at` 부재 노트 오타 3개 수정 — `콜럼`(×2) → `컬럼`, `컴럼`(×1) → `컬럼` |
| v2.0 | 2026-02-27 | **[R43]** schema.md `fep_transaction_journal.duration_ms` 설명 오타 2개 수정 — `엄는` → `얻는`, `컴럼` → `컬럼` |
| v1.0 | 초기 | 최초 작성 |

> ℹ️ Changelog는 시점별 변경 이력을 보존하기 위한 섹션이며, **현행 스키마 기준은 본문 섹션(0.5~4)의 컬럼 정의**이다. 저널 컬럼은 `msg_seq_num`/`msg_type`/`cl_ord_id`, 자격증명 컬럼은 `credential_value_encrypted`/`cert_fingerprint`을 사용한다.

---

## 0.5 Epic 11 Market Data Persistence (Determinism)

Epic 11(`LIVE/DELAYED/REPLAY` + reconnect gap-fill + reproducible replay)을 위해 FEP Gateway는 아래 상태를 명시적으로 보존한다.

### `fep_market_data_subscriptions` (구독 상태)
*   목적: provider 구독 상태와 마지막 처리 offset을 저장해 재연결 시 결정적 재등록을 수행한다.
*   핵심 컬럼:
    *   `subscription_id`(UK, UUID)
    *   `provider` (`KIS_H0STCNT0` | `REPLAY`)
    *   `symbol`, `source_mode` (`LIVE|DELAYED|REPLAY`)
    *   `tr_id`, `tr_key` (LIVE provider 계약 추적)
    *   `last_event_offset` (결정적 재처리 기준)
    *   `last_quote_as_of`, `is_active`
*   인덱스 권장:
    *   `UK(provider, symbol, source_mode)`
    *   `IDX(is_active, updated_at)`

### `fep_quote_snapshots` (정규 quote 스냅샷)
*   목적: MARKET 사전검증/체결근거/PnL 계산의 공통 근거(`quoteSnapshotId`)를 보존한다.
*   핵심 컬럼:
    *   `quote_snapshot_id`(UK, 결정적 키)
    *   `symbol`, `source_mode`, `quote_as_of`
    *   `best_bid`, `best_ask`, `last_trade`
    *   `stream_offset`, `is_stale`
*   인덱스 권장:
    *   `UK(quote_snapshot_id)`
    *   `IDX(symbol, quote_as_of)`
    *   `IDX(source_mode, quote_as_of)`

### `fep_replay_cursors` (리플레이 커서)
*   목적: 동일 seed 실행 시 동일 snapshot sequence를 재현하기 위한 커서/속도 상태를 저장한다.
*   핵심 컬럼:
    *   `replay_id`(UK, UUID), `seed`
    *   `symbol`, `cursor_offset`, `speed_factor`
    *   `status` (`RUNNING|PAUSED|COMPLETED`)
*   인덱스 권장:
    *   `UK(replay_id)`
    *   `IDX(symbol, status, updated_at)`

> 운영 규칙: reconnect 시 `fep_market_data_subscriptions.last_event_offset` 기준으로 구독 재등록 후 누락 구간을 `REPLAY`로 보정한다. MARKET 요청의 `quoteSnapshotId`는 반드시 `fep_quote_snapshots`에서 역추적 가능해야 한다.

---

## 1. Network & Routing Configuration

### `fep_institutions` (대외 기관 마스터)
*   **설명**: FIX Simulator 연동 기관의 기본 정보를 관리합니다.
*   **컬럼**:
    *   `org_code` (PK): `VARCHAR(10)` — 기관 코드 (예: `004`, `088`, `VISA`)
    *   `org_name`: `VARCHAR(100)` — 기관명 (예: `KRX 메인보드 시뮬레이터`, `KOSDAQ 시뮬레이터`)
    *   `status`: `VARCHAR(20)` — 상태. DDL: `ENUM('ACTIVE','SUSPENDED')`
    *   `protocol_type`: `VARCHAR(30)` — **Protocol Family 식별자** (`FIX42_SIMULATOR`, `FIX42_KRX_UAT`) — 이 값은 Protocol Translator가 `fep_protocol_specs` 테이블에서 **어떤 FIX 4.2 필드 명세 세트를 로드할지 결정하는 힌트**로 사용된다. 실제 Tag 번호·데이터 타입은 `fep_protocol_specs`에 저장되며, 이 컬럼은 "같은 FIX 4.2 계열이지만 기관별 커스텀 필드가 다른" 경우를 구분하는 라우팅 키 역할만 담당한다. 두 값이 모순되면 `fep_protocol_specs` 데이터를 우선 신뢰한다. (FindingR10: 세션 프로파일 기준 통일 반영)
    *   `created_at`: `DATETIME NOT NULL` — 레코드 최초 생성 시각 (감사 추적)
    *   `updated_at`: `DATETIME NOT NULL` — 레코드 마지막 수정 시각 (감사 추적). DDL에서 `ON UPDATE CURRENT_TIMESTAMP`를 적용하는 것을 **권장**한다 — 애플리케이션 레이어가 UPDATE 시마다 `updated_at = NOW()`를 명시적으로 지정하지 않아도 DB가 자동으로 갱신한다. DDL 예시: `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. `DATETIME` 컬럼에서 `ON UPDATE CURRENT_TIMESTAMP` 지원 — MySQL 5.6.5+/MariaDB 5.3+ 이상. **⚠️ `TIMESTAMP` 대신 `DATETIME` 권장**: `fep_institutions` 레코드는 무기한 유지되므로 2038-01-19 이후에도 존재한다. `TIMESTAMP` 사용 시 해당 시점 이후 오버플로우 발생 위험 — `DATETIME`으로 교체한다. (R14/R22 — DBML R22 동기화 완료.)

### `fep_connections` (연결 정보 및 풀 설정)
*   **설명**: 각 기관별 **TCP/IP 소켓 연결** 정보를 관리합니다. (Primary/Backup) 설정값과 런타임 상태를 함께 저장하여 어드민 및 모니터링 시스템이 실시간 회선 상태를 조회할 수 있도록 한다.
*   **⚠️ Write-Contention 주의**: `consecutive_error_count`, `consecutive_echo_fail_count` 같은 **고빈도 런타임 컬럼**은 모든 거래 스레드 및 Echo 타이머가 경쟁적으로 업데이트하므로 DB 행(Row) 수준 잠금 경합이 심하다. **운영 환경에서는 이 두 컬럼을 Redis Atomic Counter(`INCR`/`DECR`)로 관리하고, DB 컬럼은 Redis 장애 시 복구용 스냅샷(주기적 flush)으로만 활용**하는 방식을 권장한다. `snapshot_active_count`는 실시간 카운팅에서 제외된 스냅샷 전용 컬럼이므로 Write-Contention 대상에서 분리된다.
*   **🛡️ Redis 장애 시 Degraded Mode**: Redis가 응답 불가(Connection Timeout) 상태에 진입하면:
    1.  Connection Manager의 **인메모리 Atomic Counter**(`AtomicInteger`)로 즉시 전환하여 카운팅 지속
    2.  DB 컬럼 업데이트는 **일시 중단** — DB에 추가 부하를 주지 않는다
    3.  Redis 복구 후 인메모리 값으로 Redis 재동기화 후 정상 모드 복귀
    4.  Redis 장애가 Connection Pool 가용성에 직접 영향을 주어서는 안 된다 (비치명적 의존성)
*   **컬럼**:
    *   `id` (PK): `BIGINT UNSIGNED AUTO_INCREMENT` — **Surrogate PK**. B-tree 순차 삽입으로 단편화 제어, FK JOIN 비용 최소화. **DB 내부 전용 — 외부 노출 금지.** Admin 및 모니터링 API는 반드시 `conn_id`(UUID) 사용.
    *   `conn_id` (UK): `CHAR(36) NOT NULL` — **Business UUID** — 연결 식별자. 외부 노출 전용(Admin API, 모니터링 대시보드). DDL: `CHAR(36) UNIQUE NOT NULL`.
    *   `org_code` (FK → `fep_institutions.org_code`, **ON DELETE RESTRICT**): `VARCHAR(10)` — 기관 코드. `ON DELETE RESTRICT`로 연결 정보가 남아있는 기관의 물리 삭제를 차단한다. 기관 비활성화는 `status = 'SUSPENDED'`로 처리한다.
    *   `host_ip`: `VARCHAR(45)` — 대상 IP 주소 (IPv4 최대 15자·IPv6 최대 39자 기준 — 여유 확보)
    *   `port`: `INT` — 대상 포트 번호 (유효 범위: 1–65535)
    *   `is_primary`: `TINYINT(1) DEFAULT 1` — 주 회선 여부 (MySQL `BOOLEAN` = `TINYINT(1)`). 신규 회선 삽입 시 기본값 `1`(Primary). 단순 Primary/Backup 구조에서는 `TRUE` 회선이 우선 사용되며 `FALSE` 회선은 Failover 전용이다.
    *   `connection_weight`: `INT DEFAULT 1` — **Active-Active 부하분산 가중치**. 동일 기관에 복수 연결 회선이 모두 `runtime_status = LOGGED_ON`일 때 가중치에 비례하여 트래픽을 분배한다 (Weighted Round-Robin). 예: 회선A `weight=2`, 회선B `weight=1` → A가 2/3, B가 1/3 처리. `is_primary = TRUE`인 회선에 더 높은 가중치를 부여하는 것을 권장한다. `is_primary = FALSE` (Backup) 전용 회선은 `connection_weight = 0` 으로 설정하면 정상 트래픽에서 제외하고 Failover에서만 사용 가능하다.
        *   **Failover 트리거 조건 — Connection Manager 책임 범위**:
            *   Connection Manager는 **`connection_weight > 0 AND runtime_status = LOGGED_ON`** 인 회선 목록으로 Weighted Round-Robin 풀을 구성한다.
            *   풀이 **비어있는 경우**(모든 `weight > 0` 회선이 `LOGGED_ON`이 아닐 때) → `connection_weight = 0`인 Failover 회선 중 `runtime_status = LOGGED_ON`인 회선으로 자동 전환한다.
            *   Failover 회선도 `LOGGED_ON`이 아니면 → 주문을 즉시 `RC=9001 NO_ROUTE`으로 거절한다 (이 경우 CB OPEN과 무관하게 연결 자체가 불가한 상황).
            *   **`is_failover_active`나 별도 런타임 컬럼은 없다**: Failover 전환 여부는 DB가 아닌 Connection Manager 인메모리 상태에서 결정되며, `runtime_status`와 `connection_weight` 두 컬럼의 조합이 유일한 판단 기준이다.
    *   `max_connections`: `INT` — 최대 연결 수 (Pool Size)
    *   `keep_alive_interval`: `INT` — Echo 전송 주기 (초)
    *   `snapshot_active_count`: `INT NOT NULL DEFAULT 0` — 배치 스냅샷 기준 활성 연결 수. 실시간 카운팅은 Redis/인메모리 Atomic Counter가 담당하며, 이 컬럼은 모니터링 대시보드 전용 스냅샷이다. 고빈도 업데이트 대상에서 제외.
    *   `last_snapshot_at`: `DATETIME` **NULL 허용** — 마지막 `snapshot_active_count` 갱신 시각. 최초 스냅샷 flush 전까지 `NULL`. Redis 복구 후 인메모리 값을 DB에 flush할 때 업데이트. DATETIME 권장 — 2038 오버플로우 방지. (R18)
    *   `last_echo_sent_at`: `DATETIME` **NULL 허용** — 마지막 Heartbeat/TestRequest(MsgType=0/1) **발송** 시각. 최초 Heartbeat 발송 전까지 `NULL` — 연결 직후 Logon 전 단계에서는 Heartbeat 미발송. 발송했으나 `last_echo_received_at`이 오래되면 단방향 장애 탐지 가능. DATETIME 권장 — 2038 오버플로우 방지. (R18)
    *   `last_echo_received_at`: `DATETIME` **NULL 허용** — 마지막 Heartbeat(MsgType=0) **수신** 시각. 최초 Heartbeat 수신 전까지 `NULL`. 이 값 기준으로 Idle/Timeout 판정 — `NULL`이면 `consecutive_echo_fail_count`로만 판정. DATETIME 권장 — 2038 오버플로우 방지. (R18)
    *   `consecutive_echo_fail_count`: `INT DEFAULT 0` — Heartbeat(MsgType=0) 미수신 연속 횟수. `consecutive_echo_fail_count >= echo_fail_threshold` 달성 시 회선 TIMEOUT 판정 트리거. Heartbeat 성공 수신 시 0으로 리셋. `consecutive_error_count`와 구분됨 — Heartbeat 특화 실패와 MAC 오류/Timeout 등 일반 오류를 동시에 추적
    *   `echo_fail_threshold`: `INT DEFAULT 3` — Echo 실패 TIMEOUT 판정 임계치. 기관별 조정 가능. Simulator 측 `echo_timeout_threshold`와 동기화 권장
    *   `consecutive_error_count`: `INT DEFAULT 0` — 연속 에러 횟수 (Circuit Breaker 트리거 기준, 모든 오류 유형 포함)
    *   `runtime_status`: `VARCHAR(20)` — 현재 회선 상태. DDL: `ENUM('DISCONNECTED','CONNECTED','LOGGED_ON','DEGRADED')`
        *   `DISCONNECTED`: TCP 미연결
        *   `CONNECTED`: TCP 연결됨, 미로그인
        *   `LOGGED_ON`: FIX Logon(MsgType=A) 완료. NewOrderSingle(D) 발송 가능 상태
        *   `DEGRADED`: 연결은 유지되나 연속 에러 발생 중 (CB HALF_OPEN 진입 전 경고 단계)
    *   **키 Truth 정책**: `runtime_status`는 **인메모리(Connection Manager)가 Single Source of Truth**이다. DB 컨럼은 모니터링·대시보드용 스냅샷으로만 사용한다. 따라서:
        1.  Logon 완료 시 → 인메모리 먼저 `LOGGED_ON` 전이 → 비동기로 DB 업데이트 (응답 지연 없음)
        2.  **기동 시 DB의 모든 `runtime_status`를 `DISCONNECTED`로 리셋** 후 재연결·재로그온(Logon) 수행. DB 값을 초기 상태로 신뢰하지 않는다. **[기동 시퀀스 필수 실행 SQL]**:
            ```sql
            -- Startup Recovery Step 0: 회선 상태 초기화 (fep_transaction_journal 리셋보다 먼저 실행)
            UPDATE fep_connections
            SET runtime_status        = 'DISCONNECTED',
                snapshot_active_count = 0
            WHERE runtime_status != 'DISCONNECTED';
            -- affected rows > 0 → 이전 비정상 종료로 LOGGED_ON/CONNECTED 상태가 잔존했음 (모니터링 로그 권장)
            -- 이 쿼리 완료 후 재연결·재로그인(Logon) 시작
            ```
            `consecutive_error_count`, `consecutive_echo_fail_count`는 Redis/인메모리에서 관리하므로 **별도 리셋 불필요** — 재연결 시 Connection Manager가 인메모리를 0으로 초기화한다.
        3.  DB 업데이트 실패(일시적 DB 장애)는 비치명적(non-fatal) 오류로 처리하고 재연결 후 재시도한다.
*   **ℹ️ `updated_at` 컬럼 부재 — 설계 의도**: `fep_connections`는 런타임 스냅샷 테이블이다. `fep_routing_rules`/`fep_protocol_specs`와 달리 **폴링 기반 캐시 무효화 패턴이 없다** — Connection Manager는 기동 시 DB에서 전체 회선 설정을 로드한 후 인메모리를 SSoT로 유지한다. 런타임 시각 추적은 `last_snapshot_at`등 전용 컬럼으로 조회 시간을 대체한다. 회선 설정(host_ip, port, weight 등) 변경 시에는 Admin API가 Connection Manager에 직접 신호를 보내므로 `updated_at` DB 폴링이 필요 없다. 따라서 `updated_at` 컬럼을 의도적으로 생략한다.
*   **인덱스 전략**:
    *   `PRIMARY KEY (id)` — Surrogate PK. B-tree 순차 삽입. **DB 내부 전용.**
    *   `UNIQUE KEY uk_conn_id (conn_id)` — **Business UUID UK**. Admin API의 단일 회선 조회 진입점(`WHERE conn_id = ?`). `conn_id`가 `[unique, not null]`로 선언되므로 DDL에서 자동 생성되나 명칭(`uk_conn_id`)을 명시하면 운영 진단 시 `SHOW INDEX` 출력에서 식별이 용이하다.
    *   `INDEX idx_conn_primary (org_code, is_primary)` — 기관별 Primary 회선 조회
    *   `INDEX idx_conn_routing (org_code, runtime_status, connection_weight)` — **Connection Manager 라우팅 핵심 인덱스**. Connection Manager가 매 요청마다 실행하는 쿼리: `WHERE org_code = ? AND runtime_status = 'LOGGED_ON' AND connection_weight > 0`. `runtime_status = 'LOGGED_ON'` Equal 조건을 앞에 두면 B-Tree 인덱스가 해당 값으로 범위를 좁힌 뒤 `connection_weight > 0` 필터를 적용하여 탐색 효율이 높다. 반대 순서(`connection_weight, runtime_status`)에서는 `connection_weight > 0` 범위 조건 이후 `runtime_status`가 인덱스 탐색에서 불연속(Index Range Scan 후 Filter)이 되어 비효율적이다. Failover 조회(`runtime_status = 'LOGGED_ON' AND connection_weight = 0`)도 동일 인덱스 활용.
    *   `UNIQUE KEY uk_conn_endpoint (org_code, host_ip, port)` — **동일 기관에 동일 IP:Port 중복 회선 생성 방지**. 동일 엔드포인트에 Primary + Backup 회선이 2개 등록되면 Connection Manager가 동일 소켓에 2배 연결을 시도하는 운영 사고를 보호한다. 기관 간 동일 IP:Port 공유(Load Balancer VIP 공유 등)는 드물지만 가능하므로 `org_code`를 키에 포함한다.

### `fep_routing_rules` (라우팅 규칙)
*   **설명**: FIX 4.2 Symbol(종목코드) **또는** 거래소 코드에 따라 어떤 FIX Simulator 기관으로 주문을 라우팅할지 결정합니다. (FindingR2: 라우팅 기준을 Symbol/Exchange로 통일)
*   **컬럼**:
    *   `id` (PK): `BIGINT UNSIGNED AUTO_INCREMENT` — **Surrogate PK**. **DB 내부 전용 — 외부 노출 금지.** Admin/라우팅 API는 반드시 `rule_id`(UUID) 사용.
    *   `rule_id` (UK): `CHAR(36) NOT NULL` — **Business UUID** — 규칙 식별자. 외부 노출 전용(Admin API, SYMBOL_PREFIX 중복 검사 기준). DDL: `CHAR(36) UNIQUE NOT NULL`.
    *   `routing_type`: `VARCHAR(20)` — 라우팅 기준 타입. DDL: `ENUM('SYMBOL_PREFIX','EXCHANGE','DEFAULT')`. `SYMBOL_PREFIX`=종목코드 접두어 매핑, `EXCHANGE`=거래소 전체 매핑, `DEFAULT`=폴백 기본 라우팅. (FindingR2)
    *   `exchange_code`: `VARCHAR(10)` — 거래소 코드 직접 매핑 (예: `KRX`, `KOSDAQ`). `routing_type = EXCHANGE`일 때 사용. FIX Tag 207(SecurityExchange) 값과 일치.
    *   `symbol_prefix`: `VARCHAR(20)` — Symbol(종목코드) 접두어 (예: `005930`, `KR7`). `routing_type = SYMBOL_PREFIX`일 때 사용. FIX Tag 55(Symbol) 값의 앞 N자리와 LIKE 매칭.
    *   `target_org_code` (FK → `fep_institutions.org_code`, **ON DELETE RESTRICT**): `VARCHAR(10)` — 라우팅 대상 기관 코드 (`VISA`). `ON DELETE RESTRICT`를 적용하여 라우팅 규칙이 남아 있는 기관은 물리 삭제할 수 없도록 DB 레벨에서 차단한다. 실무에서는 기관을 물리 삭제하지 않고 `status = 'SUSPENDED'`로 소프트 삭제하므로, 이 FK는 실수에 의한 기관 삭제 방지용 안전장치다.
    *   `priority`: `INT DEFAULT 0` — 적용 우선순위 (높을수록 먼저 적용)
        *   **동점(Tie) 처리**: 동일 `routing_type`에서 `priority` 값이 같은 규칙이 복수 존재하면 **`created_at ASC` 기준으로 정렬하여 먼저 등록된 규칙을 선택**한다 (삽입 시점 기준 결정론적 보장). ~~`rule_id ASC`~~ 방식은 UUID v4가 랜덤 생성되어 삽입 순서를 보장하지 않으므로 사용하지 않는다. **UUID v7(단조 증가 포함)** 또는 **ULID**를 사용하는 환경에서는 `rule_id ASC`도 결정론적이지만, UUID v4 기본 환경에서는 `created_at ASC`가 안전하다. `UNIQUE(routing_type, priority)` 전체 Unique 제약은 **다른 기관을 대상으로 하는 동일 priority 값 규칙을 만들 수 없게 하므로** 사용하지 않는다. 필요 시 `UNIQUE(routing_type, target_org_code, priority)` 제약으로 기관을 키에 포함하여 적용하는 것을 권장한다.
    *   `is_active`: `TINYINT(1) DEFAULT 1` — 규칙 활성화 여부 (`1`=활성, `0`=비활성). 운영 중 규칙을 물리 삭제 없이 비활성화할 수 있는 소프트 토글
    *   `created_at`: **`DATETIME(6) NOT NULL` (마이크로초 정밀도)** — 규칙 최초 생성 시각. `priority` 동점 처리 기준으로 사용되므로 **`TIMESTAMP`(초 단위)나 `DATETIME`(초 단위)** 대신 반드시 `DATETIME(6)`을 사용해야 한다. `TIMESTAMP` 또는 `DATETIME` 사용 시 동일 초에 삽입된 규칙끄리 동점이 재발생하며, 배포 스크립트나 트랜잭션 배치 INSERT에서 쉽게 발생한다. MariaDB 5.3+, MySQL 5.6.4+ 지원.
        *   **⚠️ DDL DEFAULT 표현식 엔진별 차이**: 실제 DDL 작성 시 `DEFAULT` 절의 표현식이 엔진마다 다르다:
            *   **MariaDB**: `DEFAULT NOW(6)` — MariaDB는 `NOW(6)`를 `DEFAULT` 절에서 직접 지원
            *   **MySQL 5.7+**: `DEFAULT CURRENT_TIMESTAMP(6)` — MySQL은 `CURRENT_TIMESTAMP(N)` 형식을 권장. `NOW(6)`는 `DEFAULT` 절에서 MySQL 8.0.13+ 이전에는 허용되지 않을 수 있음
            *   **MySQL 8.0.13+**: `DEFAULT (NOW(6))` — 괄호로 감싼 표현식 형태도 지원
            *   DBML의 `` `now(6)` `` 표기는 ERD 도구 렌더링용이므로 실제 DDL 생성 시 대상 DB 버전에 맞는 표현식으로 교체해야 한다.
    *   `updated_at`: **`DATETIME(6) NOT NULL`** — 규칙 마지막 수정 시각 (감사 추적)
        *   **⚠️ `ON UPDATE CURRENT_TIMESTAMP` 필수**: Section 5 핫리로드 폴링 방식에서 `WHERE updated_at > {last_loaded_at}` 조건으로 변경된 규칙을 탐지한다. DDL에 누락 시 라우팅 규칙 변경이 폴링 스케줄러에 **무음 누락**되어 캐시가 영구적으로 오래된 상태로 유지된다. DDL: `updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`. (`fep_protocol_specs` R18 동일 경고 참조.)
*   **CHECK 제약 조건** (조건부 NULL 정합성 보장):
    ```sql
    CONSTRAINT chk_routing_type_columns
    CHECK (
      (routing_type = 'SYMBOL_PREFIX' AND symbol_prefix IS NOT NULL AND exchange_code IS NULL)
      OR
      (routing_type = 'EXCHANGE'      AND exchange_code IS NOT NULL AND symbol_prefix IS NULL)
      OR
      (routing_type = 'DEFAULT'       AND symbol_prefix IS NULL     AND exchange_code IS NULL)
    )
    ```
    SYMBOL_PREFIX 라우팅 레코드에 `exchange_code`가 채워지거나, EXCHANGE 라우팅 레코드에 `symbol_prefix`가 채워지는 데이터 오염을 DB 레벨에서 차단한다. DEFAULT 폴백 규칙은 두 필드 모두 NULL이어야 한다. (FindingR2)
*   **⚠️ Symbol Prefix 중복 탐지 정책**: 위 CHECK 제약은 단일 레코드 내 논리 검증만 수행한다. **서로 다른 레코드 간 symbol_prefix 중복은 DB UNIQUE 제약으로 막을 수 있다** — `routing_type = 'SYMBOL_PREFIX'`인 규칙에 대해 `UNIQUE(routing_type, symbol_prefix)`를 추가하는 것을 권장한다. 중복 prefix가 공존하면 동일 종목에 두 라우팅 대상이 매칭되어 `priority + created_at` 정렬로 하나가 선택되므로 의도치 않은 라우팅 오동작이 발생할 수 있다. 따라서 **애플리케이션 레이어**에서 아래 정책을 강제한다:
    1.  **[INSERT/UPDATE 시 중복 검사]**: `routing_type = 'SYMBOL_PREFIX'`인 규칙 등록·수정 시, 아래 쿼리로 기존 중복 prefix를 조회한다:
        ```sql
        SELECT rule_id, symbol_prefix, target_org_code
        FROM fep_routing_rules
        WHERE routing_type = 'SYMBOL_PREFIX'
          AND is_active = TRUE
          AND symbol_prefix = :new_prefix
          AND rule_id != :rule_id;   -- UPDATE 시 자기 자신 제외
        -- 결과가 1건 이상이면 중복 symbol_prefix 존재 → 운영팀 확인 후 처리
        ```
    2.  **[정책 선택]**: 중복 발견 시 자동 거부 또는 경고 발송 중 하나를 선택한다. (FindingR2)
*   **인덱스 전략**:
    *   `PRIMARY KEY (id)` — Surrogate PK. **DB 내부 전용.**
    *   `UNIQUE KEY uk_rule_id (rule_id)` — **Business UUID UK**. Admin API 단일 규칙 조회 진입점.
    *   `INDEX idx_routing_symbol (routing_type, is_active, symbol_prefix)` — **SYMBOL_PREFIX 라우팅 핵심 인덱스**. `WHERE routing_type = 'SYMBOL_PREFIX' AND is_active = TRUE AND symbol_prefix = :prefix ORDER BY priority DESC, created_at ASC LIMIT 1`. (FindingR2: idx_routing_symbol 교체)
    *   `INDEX idx_routing_exchange (routing_type, is_active, exchange_code)` — **EXCHANGE 라우팅 인덱스**. `WHERE routing_type = 'EXCHANGE' AND is_active = TRUE AND exchange_code = :exchange ORDER BY priority DESC, created_at ASC LIMIT 1`. (FindingR2: idx_routing_exchange 교체)
    *   `INDEX idx_routing_default (routing_type, is_active, priority)` — **DEFAULT 폴백 라우팅 인덱스**. `WHERE routing_type = 'DEFAULT' AND is_active = TRUE ORDER BY priority DESC, created_at ASC LIMIT 1`.

### `fep_protocol_specs` (기관별 프로토콜 필드 명세)
*   **설명**: 기관별 **FIX 4.2 필드 명세**(Tag 번호, 데이터 타입 등)를 DB로 관리합니다. 기존 `spec.json` 파일 방식 대신 DB 방식을 사용하면 **코드 배포 없이** 신규 기관 추가 및 필드 변경이 가능합니다. (FindingR12: FIX 4.2 필드 명세 기준으로 통일)
*   **컬럼**:
    *   `id` (PK): `BIGINT UNSIGNED AUTO_INCREMENT` — **Surrogate PK**. **DB 내부 전용 — 외부 노출 금지.** Admin API는 반드시 `spec_id`(UUID) 사용.
    *   `spec_id` (UK): `CHAR(36) NOT NULL` — **Business UUID** — 스펙 식별자. 외부 노출 전용(Admin API). NULL `msg_type` 중복 방지 Trigger에서 자기 자신 제외 기준. DDL: `CHAR(36) UNIQUE NOT NULL`.
    *   `org_code` (FK → `fep_institutions.org_code`, **ON DELETE RESTRICT**): `VARCHAR(10)` — 기관 코드. 프로토콜 명세가 남아있는 기관의 물리 삭제를 DB 레벨에서 차단한다.
    *   `msg_type`: `VARCHAR(2)` — FIX 4.2 MsgType (tag 35) 코드 (`D`=NewOrderSingle, `8`=ExecutionReport, `F`=OrderCancelRequest, `G`=OrderCancelReplaceRequest, `9`=OrderCancelReject). NULL허용 — `NULL`이면 해당 기관의 **모든 MsgType**에 공통 적용되는 필드. `NULL`이 아니면 해당 MsgType 전용 필드 명세. 예: `NewOrderSingle(D)`에는 Symbol(Tag 55)이 필수이지만 `OrderCancelRequest(F)`에서 Price(Tag 44)는 선택사항.
    *   `field_no`: `INT` — FIX 4.2 Tag 번호. 예: `11` (ClOrdID), `35` (MsgType), `55` (Symbol), `54` (Side), `44` (Price), `38` (OrderQty), `14` (CumQty), `151` (LeavesQty).
    *   `field_name`: `VARCHAR(50)` — 필드 명칭 (예: `ClOrdID`, `Symbol`, `Side`, `Price`, `OrdType`, `OrderQty`).
    *   `data_type`: `VARCHAR(15)` — FIX 4.2 필드 타입. DDL: `ENUM('INT','FLOAT','CHAR','STRING','BOOLEAN','PRICE','QTY','CURRENCY','EXCHANGE','UTCTIMESTAMP')`. `VARCHAR(15)`은 DBML MySQL ENUM 미지원으로 인한 ERD 도구 호환 목적이며 실제 DDL은 `ENUM` 사용 권장.
    *   `max_length`: `INT` — 최대 길이 (바이트 기준). FIX 4.2 STRING/CHAR 타입에만 유효; numeric/boolean 타입은 프로토콜 레벨에서 길이 제한 없음.
    *   `length_type`: `VARCHAR(10)` — FIX 4.2는 `\x01`(SOH) 구분자 기반이므로 값은 `FIXED`(고정 포맷 tag) 또는 `VARIABLE`(가변 길이 tag)로 관리한다. DDL: `ENUM('FIXED','VARIABLE')`. `VARCHAR(10)`은 DBML 호환 목적.
    *   `is_mandatory`: `TINYINT(1) DEFAULT 1` — 필수 여부. 신규 DE 등록 시 기본값 `1`(필수). `FALSE`(`0`)이면 해당 DE 없이도 전문 생성 가능
    *   `is_active`: `TINYINT(1) DEFAULT 1` — 활성화 여부. 신규 DE 등록 시 기본값 `1`(활성). `FALSE`(`0`)로 설정 시 해당 필드는 Pack/Unpack에서 제외
    *   `created_at`: `DATETIME NOT NULL` — 레코드 생성 시각
    *   `updated_at`: `DATETIME NOT NULL` — 레코드 마지막 수정 시각. **캐시 폴링 무효화**(`updated_at > {last_loaded_at}`)에 직접 사용되므로 DDL에서 **`ON UPDATE CURRENT_TIMESTAMP`를 반드시 설정**해야 한다. 이 설정이 없으면 애플리케이션이 UPDATE 시 `updated_at = NOW()`를 명시하지 않을 경우 폴링 스케줄러가 변경 사항을 영구적으로 탐지하지 못해 **캐시 갱신이 무력화**된다. DDL 예시: `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. `DATETIME` 컬럼에서도 `ON UPDATE CURRENT_TIMESTAMP` 지원 — MySQL 5.6.5+ / MariaDB 5.3+ 이상. (R20에서 `TIMESTAMP` → `DATETIME` 타입 변경 완료; DBML 동기화 반영.)
*   **인덱스**:
    *   `PRIMARY KEY (id)` — Surrogate PK. **DB 내부 전용.**
    *   `UNIQUE KEY uk_spec_id (spec_id)` — **Business UUID UK**. Admin API 단일 스펙 조회 진입점. NULL `msg_type` 중복 방지 Trigger의 `AND spec_id != NEW.spec_id` 자기 자신 제외 조건이 이 UK를 기준으로 동작.
    *   `UNIQUE KEY uk_spec (org_code, field_no, msg_type)` — 동일 기관·동일 Tag 번호·동일 MsgType 조합 중복 방지. `msg_type IS NULL` 공통 레코드와 `msg_type = 'D'` (NewOrderSingle) 전용 레코드 공존 허용
    *   `INDEX idx_spec_load (org_code, msg_type)` — **Protocol Translator 기동 시 캐시 로드 + 폴링 캐시 무효화 핵심 인덱스**. `uk_spec(org_code, field_no, msg_type)`는 `field_no`가 중간에 위치하여 `WHERE org_code = ? AND msg_type = ?` 또는 `WHERE org_code = ? AND msg_type IS NULL` 패턴에서 B-Tree 인덱스 탐색이 `org_code` Equal 후 전체 스캔으로 떨어진다 — `msg_type` 커버링 안 됨. `idx_spec_load(org_code, msg_type)`를 사용하면 두 Equal 조건으로 인덱스 몇 행 접근으로 종료. 기동 시 **캐시 로드**(`WHERE org_code = ?`), 폴링 **변경 탐지**(`WHERE updated_at > ?`) 모두 이 인덱스 활용.
        ```sql
        INDEX idx_spec_load (org_code, msg_type)
        -- 컬럼 순서: org_code Equal 후 msg_type Equal/IS NULL 필터 — 인덱스 리프 노드까지만 탐색
        -- uk_spec과 중복되는 인덱스이지만 쿼리 패턴이 다름 — uk_spec은 field_no 포함 유니크 검사용, idx_spec_load은 로드/폴링 주사용
        ```

        MySQL/MariaDB의 UNIQUE KEY는 `NULL`을 "알 수 없는 값"으로 취급하여 **NULL ≠ NULL**로 비교한다. 따라서 `UNIQUE KEY uk_spec (org_code, field_no, msg_type)`에서 `msg_type IS NULL`인 공통 레코드는 동일 `(org_code, field_no)`에 대해 **무한정 중복 삽입이 가능하다** — UNIQUE 제약이 사실상 무력화됨. 이를 막기 위해 아래 두 가지 중 하나를 반드시 적용한다:
    ```sql
    -- [권장] BEFORE INSERT/UPDATE Trigger — DB 레벨 중복 차단
    DELIMITER //
    CREATE TRIGGER trg_protocol_specs_no_dup_null_msgtype
    BEFORE INSERT ON fep_protocol_specs
    FOR EACH ROW
    BEGIN
      IF NEW.msg_type IS NULL THEN
        IF EXISTS (
          SELECT 1 FROM fep_protocol_specs
          WHERE org_code = NEW.org_code
            AND field_no = NEW.field_no
            AND msg_type IS NULL
        ) THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Duplicate (org_code, field_no) for common spec (msg_type IS NULL)';
        END IF;
      END IF;
    END //
    DELIMITER ;
    -- BEFORE UPDATE에도 동일 로직의 별도 트리거 적용 필요 (msg_type 변경 케이스 대비)
    -- 트리거 명칭은 반드시 분리: trg_protocol_specs_no_dup_null_msgtype_update
    -- (동일 테이블에 BEFORE UPDATE 트리거를 별도로 CREATE해야 함 — MySQL은 BEFORE INSERT와 BEFORE UPDATE를 하나의 트리거로 합칠 수 없다)
    CREATE TRIGGER trg_protocol_specs_no_dup_null_msgtype_update
    BEFORE UPDATE ON fep_protocol_specs
    FOR EACH ROW
    BEGIN
      IF NEW.msg_type IS NULL AND (OLD.msg_type IS NOT NULL OR OLD.field_no != NEW.field_no OR OLD.org_code != NEW.org_code) THEN
        IF EXISTS (
          SELECT 1 FROM fep_protocol_specs
          WHERE org_code = NEW.org_code
            AND field_no = NEW.field_no
            AND msg_type IS NULL
            AND spec_id != NEW.spec_id
        ) THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Duplicate (org_code, field_no) for common spec (msg_type IS NULL) on UPDATE';
        END IF;
      END IF;
    END //
    DELIMITER ;
    ```
    *   **[대안] 애플리케이션 레이어**: `msg_type IS NULL` 레코드 INSERT 전 동일 `(org_code, field_no, msg_type IS NULL)` 존재 여부를 SELECT로 확인 후 처리 (트랜잭션 내에서 FOR UPDATE 락 권장)
    *   **적용 대상**: BEFORE INSERT + BEFORE UPDATE 양쪽 모두 필요. UPDATE로 기존 `msg_type = 'D'`(NewOrderSingle)을 `NULL`로 변경하는 경우도 차단해야 한다.
*   **설계 의도**: Protocol Translator가 기관별·전문유형별로 이 테이블을 애플리케이션 시작 시 로드(캐싱)하여 Pack/Unpack 로직을 동적 구성. 신규 기관 연동 시 이 테이블에 레코드만 삽입하면 코드 변경·재배포 없이 운영 가능.
*   **⚠️ 캐시 무효화(Cache Invalidation) 전략**:
    *   Protocol Translator는 기동 시 `(org_code, msg_type)` 조합별로 스펙을 인메모리 Map에 로드한다.
    *   운영 중 스펙 변경 시 재배포 없이 반영하려면 다음 두 방법 중 하나를 선택한다:
        1.  **[권장] 어드민 Reload API**: `POST /admin/fep/protocol-specs/reload` 엔드포인트를 통해 특정 `org_code` 캐시를 즉시 무효화·재로드
        2.  **[대안] 주기적 폴링**: 스케줄러가 30초마다 `updated_at > {last_loaded_at}` 조건으로 변경된 레코드를 탐지하여 캐시 갱신
    *   **⚠️ `is_active = FALSE` 설정 후 Reload 호출 없이는 재시작 전까지 변경 사항이 반영되지 않음**에 주의한다.

---

## 2. Security & Key Management (FIX 4.2 TLS / Credential)

### `fep_security_keys` (보안 자격증명 저장소)
*   **설명**: FIX 4.2 세션 보안에 사용되는 TLS 인증서·Logon 패스워드·Admin 토큰을 관리합니다. QuickFIX/J ↔ Simulator 간 TLS 및 FIX 세션 레벨 인증 자격증명을 DB로 중앙 관리합니다. (FindingR3: TLS/세션 자격증명 관리 모델로 통일)
*   **컬럼**:
    *   `id` (PK): `BIGINT UNSIGNED AUTO_INCREMENT` — **Surrogate PK**. **DB 내부 전용 — 외부 노출 금지.** Admin API는 반드시 `key_id`(UUID) 사용.
    *   `key_id` (UK): `CHAR(36) NOT NULL` — **Business UUID** — 키 식별자. 외부 노출 전용(Admin API, PKI/CA 연동). `rotated_from_key_id` Self-FK 참조 대상 — `key_id`가 UNIQUE KEY이므로 MySQL/MariaDB DDL에서 FK 선언 가능. DDL: `CHAR(36) UNIQUE NOT NULL`.
    *   `org_code` (FK → `fep_institutions.org_code`, **ON DELETE RESTRICT**): `VARCHAR(10)` — 기관 코드. 보안 자격증명이 남아있는 기관의 물리 삭제를 DB 레벨에서 차단한다.
    *   `key_type`: `VARCHAR(20)` — 자격증명 종류. DDL: `ENUM('TLS_CERT','LOGON_PASSWORD','ADMIN_TOKEN')`. `TLS_CERT`=FIX 세션 TLS 클라이언트 인증서, `LOGON_PASSWORD`=FIX Logon 메시지 패스워드(Tag 554), `ADMIN_TOKEN`=Admin API 인증 토큰. (FindingR3: ZMK/ZPK/ZAK/PVK → FIX 4.2 자격증명 타입으로 교체)
    *   `credential_value_encrypted`: `VARCHAR(2048)` — AES-256으로 암호화된 자격증명 값. TLS 인증서(PEM, ~2048자), Logon 패스워드, Admin 토큰 등 자격증명 종류에 따라 길이 다름.
    *   `cert_fingerprint`: `VARCHAR(128)` **NULL 허용** — TLS 인증서 지문(SHA-256 Hex, 64자). `key_type = 'TLS_CERT'`일 때만 유효. 인증서 교체 전 지문 비교로 의도치 않은 덮어쓰기 방지.
    *   `expiry_date`: `DATE` — 키 만료일
    *   `rotation_status`: `VARCHAR(20)` — 키 생명주기 상태. DDL: `ENUM('ACTIVE','ROTATED','EXPIRED')` — 각 값의 정의와 전이 트리거는 아래 참조
        *   `ACTIVE`: 현재 운용 중인 유효 키. 동일 `org_code` + `key_type` 조합에서 **반드시 1개만** 존재
            *   **⚠️ MySQL InnoDB는 Partial Index(`WHERE` 조건부 인덱스)를 지원하지 않는다.** 아래 두 가지 대안 중 하나를 선택한다:
            *   **[권장] DB Trigger 방식**: `BEFORE INSERT / BEFORE UPDATE` 트리거로 `rotation_status = 'ACTIVE'` 중복 삽입 시 `SIGNAL SQLSTATE '45000'` 발생
                *   **⚠️ BEFORE UPDATE Trigger 최적화**: `rotation_status`를 변경하지 않는 UPDATE(예: `expiry_date`만 수정)에도 Trigger가 불필요하게 실행된다. 성능 최적화를 위해 Trigger 내부에 조기 반환 조건을 추가한다:
                    ```sql
                    -- BEFORE UPDATE 트리거 최적화 조건 (상단에 삽입)
                    IF NEW.rotation_status != 'ACTIVE' OR NEW.rotation_status = OLD.rotation_status THEN
                      LEAVE;  -- 'ACTIVE'가 아니거나 rotation_status 미변경 시 Trigger 본문 스킵
                    END IF;
                    ```
                    이 조건으로 `rotation_status = 'ACTIVE'`로 **새로 바뀌는 UPDATE**에만 중복 검사 로직이 실행된다.
                *   **⚠️ MariaDB 호환성**: `SIGNAL SQLSTATE`는 **MariaDB 5.5+** 에서 지원된다. 운영 환경이 MariaDB 5.1 이하인 경우 `SIGNAL` 구문 대신 **존재하지 않는 테이블에 SELECT하는 방식**(`SELECT _ACTIVE_KEY_DUPLICATE_ERROR FROM dual`)으로 트리거 오류를 유발하거나, 애플리케이션 레이어 방어로 대체해야 한다. **권장 최소 버전: MariaDB 10.3+** (Window Functions, Generated Columns 포함 안정 지원). MySQL 기준: **MySQL 5.5+** 지원.
                *   **전체 Trigger DDL** (BEFORE INSERT + BEFORE UPDATE 각각 별도 CREATE 필요):
                    ```sql
                    DELIMITER //
                    CREATE TRIGGER trg_security_keys_active_dup_insert
                    BEFORE INSERT ON fep_security_keys
                    FOR EACH ROW
                    BEGIN
                      IF NEW.rotation_status = 'ACTIVE' THEN
                        IF EXISTS (
                          SELECT 1 FROM fep_security_keys
                          WHERE org_code = NEW.org_code
                            AND key_type  = NEW.key_type
                            AND rotation_status = 'ACTIVE'
                        ) THEN
                          SIGNAL SQLSTATE '45000'
                            SET MESSAGE_TEXT = 'Duplicate ACTIVE key for (org_code, key_type) — rotate existing key first';
                        END IF;
                      END IF;
                    END //
                    DELIMITER ;

                    DELIMITER //
                    CREATE TRIGGER trg_security_keys_active_dup_update
                    BEFORE UPDATE ON fep_security_keys
                    FOR EACH ROW
                    BEGIN
                      -- 최적화: ACTIVE로 새로 바뀌는 UPDATE에만 중복 검사
                      IF NEW.rotation_status != 'ACTIVE' OR NEW.rotation_status = OLD.rotation_status THEN
                        LEAVE;
                      END IF;
                      IF EXISTS (
                        SELECT 1 FROM fep_security_keys
                        WHERE org_code = NEW.org_code
                          AND key_type  = NEW.key_type
                          AND rotation_status = 'ACTIVE'
                          AND key_id != NEW.key_id
                      ) THEN
                        SIGNAL SQLSTATE '45000'
                          SET MESSAGE_TEXT = 'Duplicate ACTIVE key for (org_code, key_type) on UPDATE — rotate existing key first';
                      END IF;
                    END //
                    DELIMITER ;
                    ```
            *   **[대안] 애플리케이션 레벨 보장**: 새 키 `ACTIVE` 설정 전 동일 조합의 기존 `ACTIVE` 키를 `ROTATED`로 업데이트하는 트랜잭션을 필수 스텝으로 강제
        *   `ROTATED`: 신규 키 발급으로 교체된 키. `expiry_date`와 무관하게 **의도적 교체** 시 전이. 우선순위: `ROTATED` > `EXPIRED` (두 조건이 동시 해당되면 `ROTATED`로 분류)
        *   `EXPIRED`: `expiry_date < NOW()`이며 교체 없이 **자연 만료**된 자격증명. 스케줄러가 주기적으로 `ACTIVE` 자격증명 중 만료일 경과 건을 `EXPIRED`로 자동 전이. 이 상태에서는 **FIX 세션 연결(TLS_CERT) 또는 Logon(LOGON_PASSWORD) 시도를 거부**한다. (FindingR4-R1)
            *   **자동 전이 스케줄러 정책**:
                *   **실행 주기**: **5분 간격** 권장 (만료 후 최대 5분 지연이 금융 운영 환경에서 허용 가능). 1분 미만은 불필요한 DB 부하 유발, 1시간 이상은 **만료 TLS 인증서로 FIX 세션 연결 또는 Logon이 허용되는 보안 위험**. (FindingR4-R2)
                *   **전이 쿼리 (낙관적 잠금)**:
                    ```sql
                    UPDATE fep_security_keys
                    SET rotation_status = 'EXPIRED'
                    WHERE rotation_status = 'ACTIVE'   -- 낙관적 잠금 역할
                      AND expiry_date < NOW();
                    -- affected rows = 0 → 다른 인스턴스가 이미 전이 완료, 무시
                    ```
                    `WHERE rotation_status = 'ACTIVE'` 조건이 낙관적 잠금 역할을 한다 — 다중 Gateway 인스턴스가 동시에 실행해도 첫 번째 인스턴스만 `affected rows > 0`이고 나머지는 `0`을 반환한다. **`SELECT ... FOR UPDATE` 잠금이 불필요**하며 DB 레벨에서 Race Condition이 자연 해소된다.
                *   **`ROTATED` 키 제외**: `rotation_status = 'ACTIVE'` 조건이 이미 `ROTATED` 키를 제외한다 — `expiry_date < NOW()`를 만족하더라도 먼저 `ROTATED`로 전이된 키는 다시 `EXPIRED`로 변경되지 않는다.
    *   **키 만료 관리 정책**:
        1.  **D-7 사전 경보**: 스케줄러가 아래 조건을 만족하는 키를 탐지하면 운영팀에 알림(이메일/SNMP Trap):
            ```sql
            SELECT sk.*, fi.org_name
            FROM fep_security_keys sk
            JOIN fep_institutions fi ON sk.org_code = fi.org_code
            WHERE sk.expiry_date < NOW() + INTERVAL 7 DAY
              AND sk.rotation_status = 'ACTIVE'
              AND sk.alert_sent_at IS NULL
              AND fi.status = 'ACTIVE';  -- ⚠️ SUSPENDED 기관 키 알림 제외
            ```
            `fi.status = 'ACTIVE'` 필터가 없으면 SUSPENDED 기관의 키 만료 알림이 불필요하게 발송된다. 기관이 `ACTIVE` 복귀 시 해당 시점에 D-7 경보를 다시 평가하므로 알림 누락 문제가 없다.
        2.  **자동 갱신 불가**: 자격증명 교체는 **PKI/CA(인증 기관) 재발급 또는 수동 갱신** 절차가 필요하며 시스템이 자동 생성하지 않는다. (FindingR4-R4: 수동 HSM 작업 → PKI/CA 재발급으로 교체)
        3.  **만료 시 사전 차단**: `expiry_date`가 도래도 교체되지 않으면 해당 `org_code`의 FIX 세션 연결·Logon을 거부하고 **서비스 레이어에서 `HTTP 503 CREDENTIAL_EXPIRED`를 반환**하여 Core Banking에 빠르게 안내함. (FindingR4-R6: 오류 표준을 HTTP 기반으로 통일)
    *   `rotated_from_key_id` (FK self → `key_id` UK): `CHAR(36)` — 이 키가 교체한 이전 키의 ID. 키 교체 이력 체인 추적용. 최초 키는 `NULL`. `key_id`가 UNIQUE KEY이므로 MySQL/MariaDB에서 FK 선언 가능(FK는 PK 또는 UNIQUE KEY 참조 가능).
    *   `alert_sent_at`: `DATETIME` — 만료 D-7 경보 발송 시각. `NULL`이면 미발송 — 스케줄러가 알림 발송 완료 후 `NOW()`로 업데이트하여 중복 발송 방지. 발송 조건: `alert_sent_at IS NULL AND expiry_date < NOW() + INTERVAL 7 DAY AND rotation_status = 'ACTIVE'`. 키 교체(`ROTATED`) 시 `NULL`로 리셋하여 신규 키 발급 후 재알림 가능하게 한다.
        *   **⚠️ EXPIRED 전이 시 alert_sent_at 정책**: 키가 `ACTIVE → EXPIRED`로 자동 전이될 때 `alert_sent_at`은 **리셋하지 않는다**. D-7 경보는 이미 발송됐으며 `EXPIRED` 상태에서 추가 경보는 별도 채널(Escalation Alert)을 통해 관리한다. `alert_sent_at`을 `NULL`로 리셋하면 만료 스케줄러가 다음 실행 시 동일 키에 대해 D-7 경보를 재발송하는 혼란을 초래한다.
        *   **전이별 alert_sent_at 처리 규칙**:
            *   `ACTIVE → ROTATED`: `alert_sent_at = NULL`로 리셋 (신규 교체 키에 D-7 알림 재적용 필요)
            *   `ACTIVE → EXPIRED`: **리셋하지 않음** (경보 중복 차단 유지). 별도 Escalation 발송 로직 적용
            *   신규 키 INSERT: `alert_sent_at = NULL` (기본값)
            *   **⛔ `EXPIRED → ACTIVE` 역전이: 허용되지 않는 전이**. 만료된 키를 다시 `ACTIVE`로 복구하는 것은 보안 정책 위반이다. 키 교체가 필요한 경우 반드시 신규 키를 INSERT하고 `rotation_status = 'ACTIVE'`로 설정해야 한다. 기존 만료 키를 재활성화하는 경로는 스키마·애플리케이션 레이어 양쪽에서 차단한다. 허용되는 전이 전체 목록: `ACTIVE → ROTATED`, `ACTIVE → EXPIRED`, `ROTATED → (변경 없음)`, `EXPIRED → (변경 없음)`.
    *   `alert_escalated_at`: `DATETIME` — 키 만료(`ACTIVE → EXPIRED`) 전이 후 **Escalation Alert 발송 시각**. `NULL`이면 미발송. 스케줄러가 `rotation_status = 'EXPIRED' AND alert_sent_at IS NOT NULL AND alert_escalated_at IS NULL` 조건으로 Escalation 대상을 탐지하여 발송 후 `NOW()`로 업데이트 — 중복 Escalation 방지. `alert_sent_at`은 D-7 사전 경보용, `alert_escalated_at`은 만료 후 Escalation용으로 역할을 분리한다. 키 교체(`ROTATED`) 시 `NULL`로 리셋.
        *   **⚠️ 발송 성공 후 DB 업데이트 실패 시 at-least-once 정책**: Escalation 발송 직후 DB `UPDATE alert_escalated_at = NOW()`가 일시적 DB 장애 등으로 실패하면 `alert_escalated_at`이 `NULL`로 남아 다음 스케줄러 실행 시 중복 발송이 발생한다. 이를 완전히 방지하려면 **멱등성 보장 Escalation 채널**(예: 알림 시스템의 dedup key = `key_id`)을 사용하거나, **DB 업데이트 실패 시 최대 3회 재시도 후 알림 실패 로그를 남기고 다음 주기에 재발송**하는 at-least-once 정책을 허용한다. 정확히 1회(exactly-once)를 보장하려면 Outbox Pattern 등 별도 아키텍처가 필요하며, 키 만료 Escalation 도메인에서는 at-least-once 중복 발송이 at-most-once 미발송보다 운영 관점에서 허용 가능하다.
    *   `created_at`: `DATETIME NOT NULL` — 키 생성 시각 (감사 추적 + 교체 주기 계산 기준)
    *   **ℹ️ `updated_at` 컬럼 부재 — 설계 의도**: `fep_security_keys`는 사실상 **Append-Only + 상태 전이만 허용**하는 테이블이다. 자격증명 값(`credential_value_encrypted`, `cert_fingerprint`)은 생성 후 변경되지 않으며, `rotation_status`의 전이(`ACTIVE → ROTATED/EXPIRED`)는 단방향으로만 진행된다. `updated_at`이 필요한 주요 용도인 "폴링 기반 캐시 무효화"가 이 테이블에는 없으며 (`fep_protocol_specs`, `fep_routing_rules`와 달리 인메모리 캐시 없음), 자격증명 교체 이력은 `rotated_from_key_id` Self-FK 체인으로 추적한다. `alert_sent_at`/`alert_escalated_at`은 알림 상태 전용 시각 컬럼으로 `updated_at` 역할을 대체한다. 따라서 `updated_at` 컬럼을 의도적으로 생략한다.
*   **인덱스 전략**:
    ```sql
    -- PK: Surrogate PK (내부 JOIN 전용)
    PRIMARY KEY (id)  -- BIGINT UNSIGNED AUTO_INCREMENT: 순차 삽입 보장. DB 내부 전용 — Admin/PKI API는 key_id(CHAR36) 사용.

    -- 0. Business UUID UK (Admin API 진입점 + rotated_from_key_id Self-FK 참조 대상)
    UNIQUE KEY uk_key_id (key_id)
    -- key_id가 UNIQUE KEY이므로 rotated_from_key_id FK REFERENCES fep_security_keys(key_id) DDL 유효
    -- (MySQL/MariaDB FK는 PK 또는 UNIQUE KEY 참조 가능)

    -- 1. ACTIVE 자격증명 조회 (TLS 인증서 로드·Logon 패스워드 검증·D-7 알림·Trigger 중복 검사 — 세션 연결마다 실행) (FindingR4-R3)
    --    D-7 쿼리: WHERE rotation_status='ACTIVE' AND expiry_date < NOW() + INTERVAL 7 DAY AND alert_sent_at IS NULL
    --    자격증명 조회: WHERE org_code=? AND key_type=? AND rotation_status='ACTIVE'
    --    Trigger SELECT: WHERE org_code=? AND key_type=? AND rotation_status='ACTIVE'
    INDEX idx_key_active (org_code, key_type, rotation_status)
    -- 컬럼 순서 근거: org_code(높은 선택도) → key_type(ENUM 4개 값) → rotation_status(3개 값)
    -- rotation_status를 마지막 컬럼으로 배치 — ACTIVE 필터가 범위 스캔 최종 단계에서 적용되어
    -- 인덱스 선두 2개 컬럼(org_code+key_type)으로 이미 행이 충분히 좁혀진 뒤 필터링됨.
    ```
    > **설계 원칙**: `(org_code, key_type, rotation_status)` 조합의 ACTIVE 행은 최대 1개가 보장(Trigger 강제)되므로 이 인덱스는 사실상 **유사 Partial Index**로 동작하며, 대부분의 조회가 인덱스 1~2행 접근으로 종료된다.

---

## 3. Order Logging (Audit Trail)

### `fep_transaction_journal` (거래 원장)
*   **설명**: FEP를 통과한 모든 **비즈니스 주문** 내역을 저장합니다. (금융사고 추적용)
*   **⚠️ 데이터 보존 정책**: 전자금융거래법 제22조 및 금융위원회 고시에 따라 **최소 5년** 보존 의무. `fep_protocol_log` (Raw 로그 90일)와 달리 거래 원장은 **전 기간동안 조회 가능 상태**를 유지해야 한다. 5년 경과 후 아카이브 또는 삭제 처리. **`needs_reconciliation = TRUE`** 레코드는 Reconciliation 완료 확인 후에만 아카이브 대상에 포함한다. `fep_protocol_log`는 Raw Hex Dump 희소성 저장 이유로 90일로 설정되었으나, 동일 주문의 **원장 데이터**(금액, 응답코드, 상태)는 이 테이블에 저장되므로 5년 보존이 필수이다.
*   **컬럼**:
    *   `id` (PK): `BIGINT UNSIGNED AUTO_INCREMENT` — **Surrogate PK**. B-tree 순차 삽입 보장 — UUID 랜덤 삽입으로 인한 페이지 분할(Page Split)·단편화 없음. 5년 보존 × 고빈도 INSERT 환경에서 인덱스 효율 유지. `fep_protocol_log.tx_id` FK 참조 대상. **DB 내부 JOIN 전용 — 외부 API/로그에 절대 노출하지 않는다.**
    *   `tx_id` (UK): `CHAR(36) NOT NULL` — **Business UUID**. 외부 노출 식별자 — Core Banking 연동, 감사 로그, 장애 조사, Simulator 연계 조회에 사용. DDL: `UNIQUE KEY uk_tx_id (tx_id)`. 앱 레이어에서 UUID 생성 후 INSERT.
        *   **⚠️ 혼용 금지 규칙**: 엔드포인트 응답·에러 로그·감사 보고서에는 반드시 `tx_id` 사용. `id` 값을 외부에 반환하면 순차 노출로 총 주문 건수·INSERT 순서가 유추 가능하여 보안 위험.
    *   `core_ref_id` (UK): `VARCHAR(64)` — Core Banking이 전달한 멱등성 키 — **중복 전문 방지의 핵심**. 동일 `core_ref_id`로 재요청 시 대외계 재발송 없이 저장된 `response_code` 반환
    *   `msg_seq_num`: `INT UNSIGNED` — FIX 4.2 MsgSeqNum (Tag 34) — QuickFIX/J 세션이 메시지마다 자동 할당하는 시퀀스 번호. Simulator 측 QuickFIX/J 로그와의 메시지 추적 연결 고리. (FindingR7: MsgSeqNum 추적 기준으로 통일)
        *   **⚠️ MsgSeqNum 재사용 주의**: FIX 4.2 세션 Logon(35=A) 시 QuickFIX/J가 시퀀스를 `1`로 리셋한다. 세션 재시작 시 동일 `msg_seq_num` 값이 재사용된다. 주문 조회 시 반드시 `(org_code, DATE(req_timestamp), msg_seq_num)` 3중 조합으로 유일성을 확인해야 한다. `msg_seq_num` 단독 조회는 세션 재시작 전후 동일 시퀀스 값의 다른 주문이 혼용된다. 비즈니스 레벨 상관관계는 `cl_ord_id`(Tag 11)를 우선 사용.
    *   `tx_status`: `VARCHAR(20)` — 거래 처리 생명주기 상태. DDL: `ENUM('PENDING','COMPLETED','TIMEOUT','REVERSED','MALFORMED','UNKNOWN','CIRCUIT_REJECTED')`
        *   `PENDING`: 전문 발송 후 응답 대기 중
        *   `COMPLETED`: 응답 수신 완료 (성공/거절/부분체결 포함). 세부 결과는 `execution_result` 컬럼으로 구분
        *   `TIMEOUT`: 응답 수신 시한 초과 — **`response_code = NULL`인 미처리 주문과 구분하는 핵심 컬럼**. 금융사고 조사 시 "응답 미수신 주문" 식별에 사용
        *   `REVERSED`: FIX 4.2 `OrderCancelRequest(35=F)` 발송 → `ExecutionReport(35=8, OrdStatus=4 Cancelled)` 수신 완료.
        *   `MALFORMED`: 응답 전문이 수신됐으나 파싱 실패 (MAC 불일치, 규격 위반 포함). `response_code = NULL`이며 `failure_reason`에 원인 코드 기록. `RC=9097 MAC_MISMATCH` 등 보안 경보 대상이며 `fep_circuit_breaker_state.failure_count` 증가 트리거
        *   `UNKNOWN`: Requery(OrderStatusRequest) 이후에도 거래소가 주문 상태를 확인해주지 못한 경우. 수동 조사/추가 재조회 대상
        *   `CIRCUIT_REJECTED`: Circuit Breaker `OPEN` 상태로 인해 대외계 발송 없이 **Gateway 내부에서 fast-fail 거절**된 주문. `response_code = NULL`, `failure_reason = 'CIRCUIT_OPEN'`, `msg_seq_num = NULL` (FIX 메시지를 보내지 않으므로 MsgSeqNum 미채번), `res_timestamp = req_timestamp` (즉시 반환). 금융감독원 검사 시 "CB로 인해 거절된 건수" 집계 기준. (FindingR7)
            *   **⚠️ INSERT 정책**: fast-fail이지만 `core_ref_id` (멱등성 키) 기준으로 반드시 레코드를 INSERT한다. 동일 `core_ref_id`로 Core Banking이 재시도하면 CB 상태 재확인 후 `CIRCUIT_REJECTED` 재반환 또는 정상 처리. INSERT 폭발 위험 완화를 위해 **동일 `org_code`에서 초당 INSERT 건수가 임계치(기본 100 TPS) 초과 시 로깅만 수행하고 INSERT를 스킵**하는 Throttle 정책을 애플리케이션 레이어에서 구현할 것을 권장한다.
            *   **⚠️ core_ref_id 중복 충돌 방지 — SELECT-before-INSERT 필수 흐름**:
                *   `UNIQUE KEY uk_core_ref (core_ref_id)` 제약으로 인해 동일 `core_ref_id`를 가진 `CIRCUIT_REJECTED` 레코드 재삽입 시 **Duplicate Key Error**가 발생한다. 예: CB OPEN 중 Core Banking이 동일 `core_ref_id`로 재시도하면 두 번째 INSERT가 실패한다.
                *   **애플리케이션 레이어 강제 흐름**:
                    ```
                    1. SELECT tx_id, tx_status FROM fep_transaction_journal
                       WHERE core_ref_id = :core_ref_id  FOR UPDATE (락 획득)
                    2. 행 존재 시:
                       a. tx_status = 'CIRCUIT_REJECTED' → CB 상태 재확인 후 CIRCUIT_REJECTED 재반환 (INSERT 없음)
                       b. tx_status = 'PENDING' / 기타 → 기존 처리 결과 반환
                    3. 행 미존재 → 신규 INSERT 진행
                    ```
                *   이 흐름은 Throttle 정책(100 TPS 초과 시 INSERT 스킵) 적용 이전 단계에서 반드시 실행되어야 한다. 즉 **Throttle이 활성화되어 INSERT를 스킵하더라도 SELECT는 먼저 수행**하여 기존 레코드 유무를 확인한다.
    *   **⚠️ Startup Recovery 정책**: Gateway 재시작 시, `tx_status = PENDING` AND `req_timestamp < NOW() - gateway.read-timeout-seconds`(Default: 30s)인 레코드를 `TIMEOUT`으로 일괄 전이한다. 해당 `core_ref_id`로 Core Banking이 재시도하면 저장된 `tx_status = TIMEOUT` 확인 후 `RC=9004 TIMEOUT`을 즉시 반환하여 멱등성을 보장한다. 이 쿼리는 기동 시퀀스의 필수 단계로 포함해야 한다:
    ```sql
    -- [주입 설정] gateway.read-timeout-seconds (기본값 30초)
    UPDATE fep_transaction_journal
    SET tx_status = 'TIMEOUT',
        res_timestamp = NOW(),
        needs_reconciliation = TRUE  -- Reconciliation 야간 배치 대상으로 표시
    WHERE tx_status = 'PENDING'
      AND tx_status != 'CIRCUIT_REJECTED'  -- CIRCUIT_REJECTED는 대외계 미발송 → Reconciliation 불필요
      AND req_timestamp < NOW() - INTERVAL 30 SECOND;
    ```
    > **⚠️ `CIRCUIT_REJECTED` 명시 제외**: `CIRCUIT_REJECTED`는 대외계에 전문을 발송하지 않았으므로 실제 계좌 변동이 없다. `needs_reconciliation = TRUE`로 마킹하면 야간 배치가 불필요한 기관 조회 API를 호출하여 오동작·불필요한 API 부하를 유발한다. 위 쿼리의 `tx_status != 'CIRCUIT_REJECTED'` 조건은 실제로는 `WHERE tx_status = 'PENDING'` 조건이 이미 이를 제외하지만 **의도를 코드로 명시**하는 방어적 명문화이다 — `PENDING` 레코드 중 `CIRCUIT_REJECTED`는 논리적으로 존재 불가하므로 성능 부담 없음.
    > 위 `30`은 기본값이며, 배포 시 `gateway.read-timeout-seconds` 값으로 치환하여 실행한다. Startup 시퀀스에서 이 값을 환경 변수로 주입하는 것을 권장한다.
    *   **⚠️ Reconciliation 주의**: Gateway가 대외계로부터 응답을 수신한 후 DB에 `COMPLETED`로 저장하기 전 재시작된 경우, Core는 TIMEOUT으로 취소 처리하지만 실제 주문이 체결된 데이터 불일치가 발생한다. 이를 다루기 위해:
        1.  `needs_reconciliation TINYINT(1) DEFAULT 0` 컬럼 추가. Startup Recovery 시 `PENDING → TIMEOUT` 전이된 모든 행을 `1`(TRUE)로 설정
        2.  야간 배치에서 `needs_reconciliation = TRUE` 행에 대해 **FIX 4.2 `OrderStatusRequest(35=H)`를 Simulator에 발송**하여 `ExecutionReport(35=8)` 응답으로 실제 처리 결과를 확인 후 레코드 수정. 조회 키: `OrigClOrdID(Tag 41)` = 원주문 `cl_ord_id`.
        3.  Reconciliation 완료 후 `needs_reconciliation = FALSE`로 업데이트
    *   `org_code` (FK → `fep_institutions.org_code`, **ON DELETE RESTRICT**): `VARCHAR(10)` — 대상 기관. 거래 원장이 남아있는 기관의 물리 삭제를 DB 레벨에서 차단한다. 5년 보존 의무 중인 원장의 참조 기관 삭제를 방지하는 안전장치다.
    *   `msg_type`: `VARCHAR(2)` — FIX 4.2 MsgType (tag 35). `D`=NewOrderSingle, `8`=ExecutionReport, `F`=OrderCancelRequest, `G`=OrderCancelReplaceRequest, `9`=OrderCancelReject.
    *   `cl_ord_id`: `VARCHAR(64)` — FIX 4.2 ClOrdID (tag 11) — 클라이언트 주문 고유 식별자. 채널/계정계에서 생성하여 FEP로 전달되는 멱등 키. `uk_core_ref(core_ref_id)` 와 함께 이중 멱등성 보장.
    *   `execution_result`: `VARCHAR(32)` — 주문 실행 상세 결과. DDL: `ENUM('APPROVED','PARTIAL_FILL','PARTIAL_FILL_CANCEL','CANCELED','DECLINED','UNKNOWN')`. `tx_status='COMPLETED'`일 때 상세 체결 결과를 구분하기 위한 컬럼이며, `PENDING/TIMEOUT/MALFORMED/CIRCUIT_REJECTED`에서는 `NULL`
    *   `amount`: `DECIMAL(19,4)` — 거래 금액
        *   **⚠️ 음수 금액 방지**: `CHECK (amount >= 0)` 제약 권장. MySQL 8.0.16+ / MariaDB 10.2.1+에서 `CHECK` 제약이 실제 강제(enforced)된다. 구버전에서는 구문 파싱은 되지만 강제 적용되지 않으므로 **애플리케이션 레이어**에서 음수 금액 거절 로직을 필수로 추가한다. `CIRCUIT_REJECTED` 주문의 `amount`는 Core Banking 요청 값을 그대로 저장(**실제 주문 발송 없음** — CB OPEN으로 FIX NewOrderSingle 미발송). (FindingR4-R7)
    *   `currency`: `VARCHAR(3)` — 통화 코드 (ISO 4217 세 자리: `KRW`, `USD`, `JPY`)
        *   **⚠️ 집계 쿼리 충돌 경고**: `SUM(amount)` 집계 시 반드시 `WHERE currency = ?` 조건을 포함해야 한다. `KRW`와 `USD`를 합산하면 의미 없는 숫자가 만들어지며 이를 누락한 쿼리는 실제 발생하지만 인지하기 어려운 금융 오류를 유발한다.
    *   `response_code`: `VARCHAR(10)` — FIX 4.2 `OrdStatus` 값(Tag 39) 또는 내부 에러 코드. 예: `0`=New, `1`=PartiallyFilled, `2`=Filled, `4`=Cancelled, `8`=Rejected. `PENDING`/`TIMEOUT`/`MALFORMED`/`CIRCUIT_REJECTED` 상태에서 `NULL`; `COMPLETED`/`REVERSED`에서 non-NULL.
    *   `req_timestamp`: `DATETIME(3)` — 요청 시각 (밀리초 정밀도). DBML R15에서 `datetime(3)`으로 확정. **`TIMESTAMP`는 초(second) 단위 저장이므로 `duration_ms` DB 내부 유도 시 1000ms 배수값만 산출됨 — `DATETIME(3)`이 맞는 타입. (R14/R15)**
    *   `res_timestamp`: `DATETIME(3)` — 응답 시각. `PENDING` 상태에서는 `NULL`. `CIRCUIT_REJECTED` 시 `res_timestamp = req_timestamp` (즉시 반환, 대외계 미발송). (R14/R15)
        *   **⚠️ `TIMESTAMP` 타입 미사용 이유**: MySQL `TIMESTAMP`는 초(second) 단위 저장이므로 `TIMESTAMPDIFF(MICROSECOND, req_timestamp, res_timestamp) / 1000`으로 `duration_ms`를 DB 내부에서 유도하면 **항상 1000ms 배수 값**만 나온다. `DATETIME(3)` 사용 시 밀리초 단위 타임스탬프가 보존되어 시각 자체의 정밀도가 높아진다. 단, `DATETIME(3)` 으로 변경해도 **`duration_ms`는 여전히 애플리케이션이 직접 계산하여 삽입**해야 한다 (아래 참조).
    *   `duration_ms`: `INT` **NULL 허용** — 처리 소요 시간 (밀리초). **`PENDING` 상태에서는 `NULL`** — 요청 중에 얻는 시간은 알 수 없기 때문. 응답 수신 시(`COMPLETED`/`TIMEOUT`/`MALFORMED`/`REVERSED`) UPDATE 시점에 애플리케이션이 `System.currentTimeMillis()` 또는 `System.nanoTime()` 기반으로 측정하여 **DB INSERT/UPDATE 시 하드코딩**하는 값이다. `req_timestamp`/`res_timestamp` 컬럼 차이로 DB 내부에서 유도하지 않는다 — 불필요한 계산을 피하고, TIMESTAMP 초 단위 제한으로 인한 부정확성을 제거하기 위함. `CIRCUIT_REJECTED` 주문에서는 INSERT 시점에 `0` 또는 극소값 하드코딩.
    *   `needs_reconciliation`: `TINYINT(1) DEFAULT 0` — Startup Recovery 시 `PENDING → TIMEOUT` 전이된 행을 `1`(TRUE)로 마킹. 야간 배치에서 대외계 조회 후 실제 처리 결과로 보정. 보정 완료 후 `0`(FALSE)로 갱신. DDL: MySQL `BOOLEAN`은 `TINYINT(1)` 동의어이나 다른 Boolean 컬럼(`is_primary`, `is_mandatory`, `is_active`)과 타입 표기 통일.
    *   `failure_reason`: `VARCHAR(100)` — NULL허용 — 실패 원인 코드. `tx_status IN ('TIMEOUT', 'MALFORMED', 'UNKNOWN', 'CIRCUIT_REJECTED')` 일 때 필수. 예: `TIMEOUT`, `MAC_MISMATCH`, `MALFORMED_RESP`, `UNKNOWN_ON_REQUERY`, `CIRCUIT_OPEN`, `POOL_EXHAUSTED`. 감사 조사 시 "왜 이 주문이 실패했는가?"를 설명하는 근거가 되며 `tx_status = TIMEOUT`만으로는 불분명한 원인을 구분한다.
    *   `reversal_ref_tx_id` (FK self → `tx_id`, NULLABLE): `CHAR(36)` — `tx_status = REVERSED`일 때 이 취소 주문이 참조하는 원주문 `tx_id`. 취소↔원주문 체인 추적 필수. 원주문(최초 `NewOrderSingle(35=D)`)는 `NULL`.
        *   **⚠️ 단방향 체인 규칙 (애플리케이션 레이어 강제)**: DB CHECK 제약으로 순환 참조를 막기 어려우므로 애플리케이션 레이어에서 다음 규칙을 강제한다:
            1.  `reversal_ref_tx_id`는 **`msg_type = 'F'` (OrderCancelRequest) 주문만 채울 수 있다** — `msg_type = 'D'` NewOrderSingle 저장 시 이 필드는 반드시 `NULL`로 삽입
            2.  참조 대상(`reversal_ref_tx_id`가 가리키는 원주문)의 `msg_type`은 반드시 `'D'`(NewOrderSingle)이어야 한다 — 취소(`'F'`)가 취소를 참조하는 연쇄 취소 방지. `OrderCancelReplaceRequest(35=G)` AMEND 수정 주문은 이 `reversal_ref_tx_id` 체인에 포함하지 않는다 — AMEND는 취소 없이 다른 `cl_ord_id`로 새 주문을 대체하는 FIX 4.2 표준 흐름이므로 `msg_type = 'G'` 주문은 `reversal_ref_tx_id = NULL`로 저장한다.
            3.  동일 `reversal_ref_tx_id` 값이 중복 삽입되면 이중 취소(Double Reversal)로 판단하여 거절 — `INDEX(reversal_ref_tx_id)` 기반 존재 여부 확인 후 처리
    *   **유효 상태 조합** (CHECK 권장):
        *   `PENDING` → `response_code IS NULL`, `msg_seq_num IS NOT NULL`
        *   `COMPLETED` → `response_code IS NOT NULL`, `msg_seq_num IS NOT NULL`, `execution_result IS NOT NULL`
        *   `TIMEOUT` → `response_code IS NULL`, `failure_reason IS NOT NULL`, `msg_seq_num IS NOT NULL`
        *   `MALFORMED` → `response_code IS NULL`, `failure_reason IS NOT NULL`, `msg_seq_num IS NOT NULL`
        *   `UNKNOWN` → `response_code IS NULL`, `failure_reason IS NOT NULL`, `msg_seq_num IS NOT NULL`
        *   `REVERSED` → `response_code IS NOT NULL`, `msg_seq_num IS NOT NULL`
        *   `CIRCUIT_REJECTED` → `response_code IS NULL`, `failure_reason = 'CIRCUIT_OPEN'`, `msg_seq_num IS NULL` (FIX 메시지 미발송이므로 MsgSeqNum 미채번)
    *   **⚠️ MsgSeqNum ↔ Simulator QuickFIX/J 로그 크로스 매핑 정책** (FindingR7):
        *   Gateway의 `fep_transaction_journal.msg_seq_num` 과 Simulator QuickFIX/J 세션 로그의 MsgSeqNum(Tag 34)은 **동일한 값**으로 대응한다.
        *   양쪽 시스템을 연계 조회할 때는 반드시 `(org_code, DATE(req_timestamp), msg_seq_num)` 3중 조합을 사용해야 한다. `msg_seq_num` 단독 조회는 세션 재시작 전후 재사용으로 오매핑이 발생한다. **비즈니스 레벨 1차 상관관계는 `cl_ord_id`(Tag 11) 사용 권장.**
        *   `CIRCUIT_REJECTED` 상태의 주문은 `msg_seq_num = NULL`이므로 Simulator 측 로그와 매핑 불가. 이는 의도된 동작이다 (FIX 메시지가 발송되지 않았으므로 Simulator 측 기록 없음).
*   **인덱스 전략**:
    ```sql
    -- PK: Surrogate PK (내부 JOIN 전용)
    PRIMARY KEY (id)  -- BIGINT UNSIGNED AUTO_INCREMENT: 순차 삽입 보장

    -- 1. Business UUID 조회 (외부 진입점)
    UNIQUE KEY uk_tx_id (tx_id)  -- 외부 API → tx_id 조회 → id 획득 → 이후 id로 JOIN

    -- 2. 멱등성 조회 (가장 빈번 — 매 요청마다 실행)
    UNIQUE KEY uk_core_ref (core_ref_id)

    -- 3. 감사·리포트 조회 (기관별 날짜 범위 + 상태 필터)
    --    예: SELECT org_code, DATE(req_timestamp), COUNT(*), SUM(tx_status='COMPLETED') ...
    INDEX idx_audit (org_code, req_timestamp, tx_status)

    -- 4. MsgSeqNum 기반 주문 추적 (Gateway↔Simulator QuickFIX/J 로그 연계) (FindingR7)
    --    반드시 (org_code, DATE(req_timestamp), msg_seq_num) 3중 조합으로 사용. 비즈니스 상관관계는 cl_ord_id 우선.
    INDEX idx_msg_seq_lookup (org_code, msg_seq_num, req_timestamp)

    -- 5. 취소 원주문 역방향 조회 (Double Reversal 방지 + 감사)
    INDEX idx_reversal (reversal_ref_tx_id)

    -- 6. Startup Recovery 쿼리 (PENDING 상태 + 시간 조건 스캔)
    --    UPDATE ... WHERE tx_status = 'PENDING' AND req_timestamp < NOW() - INTERVAL ? SECOND
    INDEX idx_startup_recovery (tx_status, req_timestamp)
    ```
    > **설계 원칙**: `CIRCUIT_REJECTED` 주문은 `msg_seq_num IS NULL`이므로 `idx_msg_seq_lookup` 매핑이 불가하다. `idx_audit`의 `tx_status` 컬럼은 집계 쿼리에서 커버링 인덱스(Covering Index)로 활용되어 테이블 풀스캔을 방지한다. 외부 조회는 `tx_id(UNIQUE KEY) → id 획득 → id 기반 JOIN` 순서로 수행하여 CHAR(36) 기반 JOIN 비용을 제거한다.
*   **📋 금융감독원 보고용 — 총 CIRCUIT_REJECTED 건수 공식 집계 쿼리**:
    ```sql
    -- ─────────────────────────────────────────────────────────────────
    -- 감독원 제출용: CB로 인해 거절된 총 주문 건수 집계
    -- 실제 총 거절 건수 = 저널에 기록된 건수 + Throttle로 스킵된 건수
    -- 조회 기간: :start_date ~ :end_date (일별)
    -- ─────────────────────────────────────────────────────────────────
    SELECT
        j.org_code,
        DATE(j.req_timestamp)                          AS tx_date,
        COUNT(j.tx_id)                                  AS recorded_rejections,  -- 저널 기록 건수
        COALESCE(SUM(e.throttled_count), 0)             AS throttled_rejections,  -- Throttle 스킵 건수
        COUNT(j.tx_id) + COALESCE(SUM(e.throttled_count), 0)
                                                        AS total_rejections       -- 실제 총 거절 건수
    FROM fep_transaction_journal j
    LEFT JOIN (
        -- 해당 날짜의 OPEN → HALF_OPEN 이벤트에서 throttled_count 집계
        SELECT org_code,
               DATE(created_at) AS event_date,
               SUM(throttled_count) AS throttled_count
        FROM fep_circuit_breaker_events
        WHERE to_state = 'HALF_OPEN'
          AND created_at BETWEEN :start_date AND :end_date
        GROUP BY org_code, DATE(created_at)
    ) e ON j.org_code = e.org_code AND DATE(j.req_timestamp) = e.event_date
    WHERE j.tx_status = 'CIRCUIT_REJECTED'
      AND j.req_timestamp BETWEEN :start_date AND :end_date
    GROUP BY j.org_code, DATE(j.req_timestamp)
    ORDER BY j.org_code, tx_date;
    ```
    > **주의**: `throttled_count`는 OPEN 기간 종료(HALF_OPEN 전이) 시점에 기록되므로, OPEN 기간이 아직 종료되지 않은 경우(현재 OPEN 상태) 해당 기간의 `throttled_count`는 집계에 포함되지 않는다. 보고 시점에 CB OPEN 상태인 기관이 있으면 주석으로 별도 기재할 것을 권장한다.

### `fep_protocol_log` (저수준 통신 로그)
*   **설명**: **Raw Message (Hex Dump)** 수준의 로그를 남겨 프로토콜 오류를 디버깅합니다.
*   **보존 정책**: 최소 **90일** 보관 (전자금융거래법 제22조 전자금융거래기록 보존 의무 준수). 이후 자동 파티션 삭제(Partition Pruning) 또는 아카이브 처리.
*   **컬럼**:
    *   `id` (PK, 파티션 키 포함): `BIGINT UNSIGNED AUTO_INCREMENT` — **Surrogate PK**. DDL: `PRIMARY KEY (id, created_at)` — MySQL/MariaDB 파티션 테이블은 파티션 키가 PK에 포함되어야 한다(`ERROR 1503` 방지). **DB 내부 전용 — 외부 노출 금지.**
    *   `log_id` (UK): `CHAR(36) NOT NULL` — **Business UUID**. 외부 조회 진입점. DDL: `UNIQUE KEY uk_log_id (log_id)`. **파티션 테이블에서 UK는 파티션 키 포함 불필요** — `log_id` 단독 UK 가능.
    *   `tx_id` (**NULLABLE**, 앱 레이어 참조): `CHAR(36)` — `fep_transaction_journal.tx_id`(Business UUID) 참조. 파티션 테이블이므로 실제 DDL에서 FK 선언 불가(`ERROR 1506`) — 앱 레이어에서 무결성 관리. Heartbeat(MsgType=`0`), Logon(MsgType=`A`) 등 세션 관리 전문은 `NULL` 허용.
        *   **FK ON DELETE 정책**: `ON DELETE SET NULL` — `fep_transaction_journal` 레코드가 삭제될 경우 연결된 `fep_protocol_log.tx_id`를 `NULL`로 자동 처리한다. `ON DELETE CASCADE`는 주문 삭제 시 Raw 로그까지 함께 삭제되어 **전자금융거래법 제22조 90일 보존 의무 위반** 가능성이 있으므로 금지한다. `ON DELETE RESTRICT`는 원장 레코드 삭제를 원천 차단하여 운영 유연성을 과도하게 제한한다. 따라서 `SET NULL`이 금융 로그 보존 의무와 운영 유연성 균형에 최적이다.
        *   **⚠️ MySQL 파티셔닝 + FK 공존 불가**: MySQL/MariaDB에서 **파티셔닝된 테이블은 FK를 가질 수 없다** (`ERROR 1506: Foreign keys are not yet supported in conjunction with partitioning`). `fep_protocol_log`는 파티셔닝 테이블이므로 실제 DDL에서는 **FK 제약을 선언하지 않는다**. `ON DELETE SET NULL` 동작은 다음 두 방법으로 대체한다:
            1.  **[권장] 애플리케이션 레이어**: `fep_transaction_journal` 레코드 삭제 전, 연결된 `fep_protocol_log.tx_id`를 `NULL`로 UPDATE하는 로직을 트랜잭션 내에 포함한다.
            2.  **[대안] 스케줄러**: 야간 배치에서 `fep_protocol_log.tx_id IS NOT NULL AND tx_id NOT IN (SELECT tx_id FROM fep_transaction_journal)` 고아 레코드를 탐지하여 `NULL`로 일괄 업데이트한다.
        *   이 문서에서 FK와 `ON DELETE SET NULL`로 표기한 것은 **설계 의도**이며, 실제 DDL에서는 FK 없이 위 앱 레이어/배치 방식으로 동작을 구현해야 한다.
        *   **고아 레코드 관리**: `tx_id IS NULL AND msg_type NOT IN ('0','1','2','3','4','5','A')`인 레코드는 정상 상태가 아니므로(비즈니스 메시지인데 tx_id가 없음) 주기적 점검 쿼리 대상으로 운영 모니터링에 포함한다. `0`,`1`,`2`,`3`,`4`,`5`,`A`는 FIX 4.2 세션 관리 메시지로 tx_id = NULL이 정상. (FindingR6)
    *   `msg_type`: `VARCHAR(2)` — FIX 4.2 MsgType (tag 35) 코드 — `tx_id = NULL`인 세션 레벨 메시지 식별에 필수. 비즈니스 메시지: `D`/`8`/`F`/`G`/`9`. 세션 관리 메시지(tx_id = NULL 허용): `A`=Logon, `5`=Logout, `0`=Heartbeat, `1`=TestRequest, `2`=ResendRequest, `3`=Reject, `4`=SequenceReset.
    *   `direction`: `ENUM('IN','OUT')` — 송수신 방향. DDL에서 `ENUM('IN','OUT')`으로 정의; DBML에서는 ERD 도구 ENUM 미지원으로 `varchar(3)` 표기. (R19/R21)
    *   `raw_header`: `TEXT` — 전문 헤더 (Hex)
    *   `raw_body`: `TEXT` — 전문 바디 (Hex)
    *   `error_detail`: `TEXT` — 파싱 오류 내용 (Optional). 성공 시 `NULL`
    *   `created_at`: `DATETIME(6)` — 로그 생성 시각 (파티션 키). `RANGE COLUMNS(created_at)` 파티션 기준 컬럼이므로 DDL에서 **`NOT NULL` 필수** — MySQL/MariaDB 파티션 키는 NULL을 허용하지 않는다. DDL: `created_at DATETIME(6) NOT NULL`.
*   **파티션 전략**: **`RANGE COLUMNS(created_at)`** (권장). **4개 파티션 유지** (현재 월 + 이전 3개월 ≈ 90일). 매월 1회 가장 오래된 파티션을 `ALTER TABLE fep_protocol_log DROP PARTITION`으로 제거하고 다음 달 파티션을 `ADD PARTITION`으로 추가한다. 배치 스케줄러가 **매월 말일** 실행. (예: 4월 1일 기준 4월+3월+2월+1월 = 1월 1일부터 보관 ≈ 90일. 3개만 유지 시 ≈ 59일 → 전자금융거래법 제22조 위반.) `RANGE COLUMNS`는 `DATETIME` 값으로 직접 비교하므로 `RANGE (MONTH())` 방식과 달리 연도 경계에서 데이터가 잘못된 파티션에 들어가는 문제가 없다 (MariaDB 10.0+ / MySQL 5.5+).
*   **초기 파티션 DDL 예시** (CREATE TABLE 시 4개 파티션 선언 — 2025년 1~4월 기준, **`RANGE COLUMNS` 권장 방식**):
    ```sql
    CREATE TABLE fep_protocol_log (
      id           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
      log_id       CHAR(36)         NOT NULL,
      tx_id        CHAR(36)         NULL,      -- fep_transaction_journal.tx_id 참조 (앱 레이어 FK)
      msg_type     VARCHAR(2)       NOT NULL,  -- NOT NULL: identify session messages (A/5/0/1/2/3/4) where tx_id IS NULL
      direction    ENUM('IN','OUT') NOT NULL,
      raw_header   TEXT,
      raw_body     TEXT,                       -- TEXT (64KB) sufficient for FIX 4.2 raw message; LONGTEXT is unnecessary
      error_detail TEXT,
      created_at   DATETIME(6)      NOT NULL,
      PRIMARY KEY (id, created_at),            -- ⚠️ 파티션 키 created_at을 PK에 포함 필수 (ERROR 1503 방지)
      UNIQUE KEY uk_log_id (log_id)            -- 외부 조회 진입점 (파티션 키 포함 불필요)
    )
    PARTITION BY RANGE COLUMNS(created_at) (
      PARTITION p202501 VALUES LESS THAN ('2025-02-01 00:00:00'),  -- 1월
      PARTITION p202502 VALUES LESS THAN ('2025-03-01 00:00:00'),  -- 2월
      PARTITION p202503 VALUES LESS THAN ('2025-04-01 00:00:00'),  -- 3월
      PARTITION p202504 VALUES LESS THAN ('2025-05-01 00:00:00')   -- 4월 (현재 월)
    );
    -- 매월 말일 배치 실행 — 다음 달 파티션 추가 (날짜 경계를 DATETIME 값으로 명시):
    ALTER TABLE fep_protocol_log ADD PARTITION (
      PARTITION p202505 VALUES LESS THAN ('2025-06-01 00:00:00')
    );
    -- 90일 경과 후 가장 오래된 파티션 삭제:
    ALTER TABLE fep_protocol_log DROP PARTITION p202501;
    ```
    > **[비권장 대안] `RANGE (MONTH(created_at))`**: `MONTH()` 함수는 연도를 무시하므로 2025년 1월(`p202501`)과 2026년 1월이 동일 파티션에 들어간다. 90일 보관 주기를 넘어 연도 경계가 오면 `DROP PARTITION`으로 정확히 90일치 데이터만 삭제할 수 없다. **`RANGE COLUMNS(created_at)` 사용을 강력히 권장한다.**
*   **⚠️ 파티션 DDL 실행 시간대**: `ALTER TABLE ... DROP PARTITION` 및 `ADD PARTITION`은 **DDL 연산**으로 InnoDB에서 **테이블 수준 Metadata Lock(MDL)**을 획득한다. 진행 중인 INSERT 트랜잭션이 있으면 MDL 대기로 인해 해당 트랜잭션이 블로킹되고, 역으로 대용량 INSERT가 지속되면 DDL이 무기한 대기 상태에 빠진다. 따라서 파티션 관리 스케줄러는 반드시 **새벽 저트래픽 시간대(예: 03:00~05:00)**에 실행해야 하며, `lock_wait_timeout` 설정값을 고려하여 DDL 실행 전 진행 중인 장시간 트랜잭션 유무를 `SHOW PROCESSLIST`로 확인하는 사전 점검 스텝을 포함한다.

---

## 4. Reliability State (Circuit Breaker)

### `fep_circuit_breaker_state` (회로 차단기 상태)
*   **설명**: 기관별 **Circuit Breaker 상태**를 DB에 영속화하여 서버 재시작 시에도 상태가 초기화되지 않도록 보장합니다.
*   **⚠️ CB 진실 원천(Source of Truth) 정책 — Architecture와의 관계 (FindingR12)**: Architecture는 `corebank-service`의 `FepClient`에 선언된 **Resilience4j `@CircuitBreaker(name="fep")`를 단일 CB 레이어**로 명시한다(`architecture.md` NFR 항목). 이 테이블(`fep_circuit_breaker_state`)은 Resilience4j의 인메모리 CB 상태를 **모니터링/감사/재시작 복구**를 위해 DB에 영속화하는 부가 장치이며, CB 판정 권한은 Resilience4j 인메모리가 가진다.
    *   **Resilience4j 인메모리** (`corebank-service`): CB 판정 Single Source of Truth — 매 `FepClient` 호출 시 OPEN/CLOSED 여부를 결정한다.
    *   **`fep_circuit_breaker_state`** (`fep_db`): 모니터링 대시보드·감사 로그·재시작 복구용 영속 스냅샷. Resilience4j 상태와 **비동기로 동기화** — 전이 이벤트 발생 시 Resilience4j `EventPublisher`로 구독하여 DB 업데이트.
    *   **동기화 정책**: DB 업데이트 실패는 비치명적(non-fatal)으로 처리 — CB 판정 경로에 DB I/O를 포함하지 않는다.
    *   **불일치 발생 시 우선 순위**: Resilience4j 인메모리 상태 > DB 저장 상태. DB 값으로 Resilience4j를 강제 덮어쓰지 않는다.
*   **상태 정의**:
    *   `CLOSED`: 정상 통신 중
    *   `OPEN`: 임계치 초과로 회로 차단. 모든 요청을 즉시 거절 (fast-fail)
    *   `HALF_OPEN`: 복구 시도 중. 제한적 요청만 대외계로 통과
*   **⚠️ CB 상태와 Connection 상태 독립성 정책**: Circuit Breaker 상태(`state`)와 소켓 연결 상태(`fep_connections.runtime_status`)는 **완전히 독립적으로 운용**된다.
    *   `fep_connections.runtime_status = LOGGED_ON` + `state = OPEN` 조합은 **유효한 상태**이다. 소켓 TCP 연결 및 Logon은 유지한 채로 NewOrderSingle(MsgType=D)만 fast-fail 거절한다. 이 조합에서 Heartbeat(MsgType=0) 및 Logon(MsgType=A) 세션 관리 메시지는 정상 발송된다.
    *   CB가 OPEN이라고 해서 소켓을 강제 끊으면 안 된다 — 소켓 재연결·재로그온(Logon) 비용이 CB 복구 시간을 증가시키기 때문이다.
    *   **모니터링 대시보드 설계 시 유의**: "회선 상태"(connection)와 "CB 상태"를 별도 지표로 표시해야 한다. 둘을 하나의 상태로 합산하면 운영팀이 잘못된 대응(소켓 재연결 시도)을 할 수 있다.
*   **컬럼**:
    *   `org_code` (PK, FK → `fep_institutions.org_code`, **ON DELETE RESTRICT**): `VARCHAR(10)` — 기관 코드 (PK). CB State가 존재하는 기관의 물리 삭제를 DB 레벨에서 차단한다.
    *   `state`: `VARCHAR(20)` — 현재 상태. DDL: `ENUM('CLOSED','OPEN','HALF_OPEN')`
    *   `failure_count`: `INT DEFAULT 0` — **Circuit Breaker 전이 기준 누적 실패 횟수** (`failure_count >= failure_threshold`이면 `CLOSED → OPEN` 전이). `fep_connections.consecutive_error_count`와 역할이 다름 — 아래 구분 참조:
        *   **`fep_circuit_breaker_state.failure_count`**: CB 상태 전이만을 위한 카운터. `CLOSED → OPEN` 전이 조건 판정에 사용. HALF_OPEN 성공 시 `0`으로 리셋. **CB 레이어(비즈니스 레이어) 관점의 실패**.
        *   **`fep_connections.consecutive_error_count`**: 소켓 연결 레이어의 연속 에러 카운터. MAC 오류, Timeout, MALFORMED 등 **모든 전문 수준 오류**를 포함. `DEGRADED` 상태 판정 및 CB 트리거 이벤트 발화의 입력값으로 사용. Echo 실패(`consecutive_echo_fail_count`)와 별도 관리됨.
        *   **관계**: `fep_connections.consecutive_error_count`가 CB 트리거 임계치에 도달 → `fep_circuit_breaker_state.failure_count` 증가 → CB 상태 전이 결정. 즉 Connection 레이어 카운터가 CB 레이어 카운터를 **구동(drive)** 하는 단방향 관계이다.
    *   `last_failure_at`: `DATETIME` — 마지막 실패 시각. 첫번째 실패 전까지 `NULL`. DATETIME 권장 — 2038 오버플로우 방지. (R16)
    *   `open_until`: `DATETIME` — OPEN 상태 만료 시각 (이 시각이 지나면 HALF_OPEN으로 자동 전이). 초기 삽입 시 `NULL`. **⚠️ `NULL` 선행 검사 필수** — MySQL에서 `NULL > NULL = NULL(거짓)` 이므로 `open_until IS NOT NULL AND NOW() > open_until` 순서로 조회. DATETIME 권장 — 2038 오버플로우 방지. (R16)
    *   `success_count`: `INT DEFAULT 0` — HALF_OPEN 상태에서의 **연속 성공 횟수**. 회로 복구 조건 판정에 사용
    *   `half_open_threshold`: `INT DEFAULT 3` — HALF_OPEN → CLOSED 전이에 필요한 연속 성공 횟수. 기관별 조정 가능
    *   `open_duration_seconds`: `INT DEFAULT 60` — OPEN 상태 유지 시간(초). `CLOSED → OPEN` 전이 시 `open_until = NOW() + INTERVAL open_duration_seconds SECOND`으로 계산. 기관별 조정 가능
    *   `failure_threshold`: `INT DEFAULT 3` — `CLOSED → OPEN` 전이 기준 실패 횟수 임계치. **PRD 비타협 시나리오 #5 "slidingWindowSize=3"과 정렬 — 기본값 3 필수.** 기관별 조정 가능. `failure_count >= failure_threshold`에 도달하면 OPEN 전이. `half_open_threshold`, `open_duration_seconds`와 함께 기관별 CB 민감도를 세밀하게 조정할 수 있다 — 안정적인 기관은 `5`로 높이고, 불안정한 기관은 `2`로 낮출 수 있다.
    *   `updated_at`: `DATETIME NOT NULL` — 상태 마지막 변경 시각. 모든 CB 상태 전이 시 업데이트. Trigger(`trg_init_circuit_breaker`)가 INSERT 시 항상 `NOW()`를 주입하므로 NOT NULL 유효. DATETIME 권장 — 2038 오버플로우 방지. (R17/R37)
*   **전이 규칙 요약**:
    *   `CLOSED` → `OPEN`: `failure_count` ≥ `failure_threshold` (기본값 `3` — PRD 비타협 시나리오 #5 `slidingWindowSize=3` 기준, 기관별 설정 가능). `open_until = NOW() + INTERVAL open_duration_seconds SECOND`
    *   `OPEN` → `HALF_OPEN`: `open_until IS NOT NULL AND NOW() > open_until` — `open_until = NULL`이면 MySQL에서 `NULL > NULL = NULL(거짓(FALSE))`이므로 반드시 NOT NULL 검사를 선행해야 한다. 초기 삽입 시 `open_until = NULL`
        *   **⚠️ Gateway 재시작 시 즉시 전이 정책**: CB `state = 'OPEN'`이었던 기관은 재시작 후 첫 번째 주문 요청 시 `open_until < NOW()` 여부를 확인하여 HALF_OPEN으로 즉시 전이한다. 이는 **의도된 빠른 복구 동작**이다 — CB를 DB에 영속화하는 이유가 재시작 이후에도 이전 OPEN 기간을 이어받기 위함이므로, OPEN 기간이 이미 만료되었다면 불필요하게 OPEN 상태를 연장하지 않는다. 만약 팀 정책상 재시작 시 CB를 항상 CLOSED로 초기화하는 것이 맞다면 기동 시퀀스에 아래 쿼리를 추가한다:
            ```sql
            -- [선택] 재시작 시 CB CLOSED 강제 초기화 (팀 정책에 따라 결정)
            UPDATE fep_circuit_breaker_state
            SET state = 'CLOSED', failure_count = 0, success_count = 0, open_until = NULL, updated_at = NOW()
            WHERE state IN ('OPEN', 'HALF_OPEN');
            ```
            **권장**: OPEN 기간이 만료된 경우만 즉시 HALF_OPEN 전이 허용, 아직 만료되지 않은 OPEN은 유지한다 (DB 영속화의 본래 목적).
    *   `HALF_OPEN` → `CLOSED`: `success_count` ≥ `half_open_threshold` (연속 성공)
    *   `HALF_OPEN` → `OPEN`: HALF_OPEN 중 1회라도 실패 (`success_count` 리셋 후 재차단)
*   **⚠️ 신규 기관 추가 시 초기 행 자동 생성**: `fep_institutions`에 신규 기관을 INSERT할 때 `fep_circuit_breaker_state`에도 초기 행이 반드시 생성되어야 한다. 이 행이 없으면 첫 CB 조회 시 `NOT FOUND` 예외가 발생하여 해당 기관의 모든 주문이 실패한다. 아래 두 가지 방법 중 하나를 사용한다:
    *   **[권장] DB Trigger**: `AFTER INSERT ON fep_institutions` 트리거로 `fep_circuit_breaker_state` 초기 행 자동 생성:
        ```sql
        CREATE TRIGGER trg_init_circuit_breaker
        AFTER INSERT ON fep_institutions
        FOR EACH ROW
        BEGIN
          -- ACTIVE 기관에만 CB State 생성. SUSPENDED 기관은 불필요한 모니터링 행 방지.
          IF NEW.status = 'ACTIVE' THEN
            INSERT INTO fep_circuit_breaker_state
              (org_code, state, failure_count, failure_threshold, success_count, half_open_threshold, open_duration_seconds, updated_at)
            VALUES
              (NEW.org_code, 'CLOSED', 0, 3, 0, 3, 60, NOW());  -- failure_threshold=3: PRD 시나리오 #5 slidingWindowSize=3 정렬
          END IF;
        END;
        ```
    *   **[대안] 애플리케이션 로직**: 기관 등록 API에서 `fep_institutions` INSERT + `fep_circuit_breaker_state` INSERT를 동일 트랜잭션 내에서 수행. Trigger 방식 대비 코드 추가가 필요하지만 초기값(`half_open_threshold`, `open_duration_seconds`)을 기관별로 다르게 설정할 수 있다.
    *   **`SUSPENDED` 기관 처리**: `status = 'SUSPENDED'`로 INSERT 시 CB State를 생성하지 않는다. Trigger 방식에서는 `IF NEW.status = 'ACTIVE'` 조건이 이를 자동으로 처리한다.
    *   **⚠️ `SUSPENDED → ACTIVE` UPDATE 전환 시 CB State 생성**: `AFTER INSERT ON fep_institutions` Trigger는 신규 INSERT에만 발화하며 **기존 SUSPENDED 기관을 `UPDATE status = 'ACTIVE'`로 전환하는 경우에는 발화하지 않는다**. 이 경우를 처리하는 두 가지 방법:
        1.  **[권장] AFTER UPDATE Trigger 추가**:
            ```sql
            CREATE TRIGGER trg_activate_circuit_breaker
            AFTER UPDATE ON fep_institutions
            FOR EACH ROW
            BEGIN
              -- SUSPENDED → ACTIVE 전환 시에만 CB State 초기 행 생성
              IF OLD.status = 'SUSPENDED' AND NEW.status = 'ACTIVE' THEN
                -- CB State가 이미 존재하는 경우(이전 ACTIVE 기간 잔존) INSERT 스킵
                INSERT IGNORE INTO fep_circuit_breaker_state
                  (org_code, state, failure_count, failure_threshold, success_count, half_open_threshold, open_duration_seconds, updated_at)
                VALUES
                  (NEW.org_code, 'CLOSED', 0, 3, 0, 3, 60, NOW());  -- failure_threshold=3: PRD 시나리오 #5 정렬
              END IF;
            END;
            ```
            `INSERT IGNORE`를 사용하여 이전 ACTIVE 기간의 CB State가 남아 있는 경우 중복 INSERT 오류를 방지한다. 기존 CB State가 `OPEN` 상태라면 그대로 유지되어 SUSPENDED 전환 정책("CB 상태 유지")과 일치한다.
        2.  **[대안] 기관 활성화 API**에서 `fep_institutions` UPDATE + `fep_circuit_breaker_state` INSERT IGNORE를 동일 트랜잭션 내에서 수행.
    *   **기본값 조정 필요 시**: Trigger 방식은 `failure_threshold = 3`, `half_open_threshold = 3`, `open_duration_seconds = 60` 기본값으로 초기화한다. `failure_threshold = 3`은 PRD 비타협 시나리오 #5(`slidingWindowSize=3`)와 정렬된 필수 기본값이다. 기관별 커스텀 임계치가 필요하면 Trigger 실행 후 별도 UPDATE 또는 애플리케이션 방식을 사용한다.
*   **⚠️ 다중 인스턴스 Race Condition 주의**: 복수 Gateway 인스턴스가 동일 `org_code` 행을 공유할 때, `success_count` 단순 조회 후 비교(Read-Modify-Write) 패턴은 중복 CLOSED 전이를 유발한다. 반드시 **원자적 업데이트** 방식을 사용한다:
    ```sql
    -- HALF_OPEN 성공 카운트 증가 (원자적)
    UPDATE fep_circuit_breaker_state
    SET success_count = success_count + 1, updated_at = NOW()
    WHERE org_code = ? AND state = 'HALF_OPEN';
    
    -- 임계치 도달 시 CLOSED 전이 (CAS 패턴)
    UPDATE fep_circuit_breaker_state
    SET state = 'CLOSED', success_count = 0, failure_count = 0, updated_at = NOW()
    WHERE org_code = ? AND state = 'HALF_OPEN'
      AND success_count >= half_open_threshold;
    
    -- HALF_OPEN 중 실패 → 재차단 (OPEN 복귀, 단순 업데이트로 충분)
    UPDATE fep_circuit_breaker_state
    SET state = 'OPEN',
        success_count = 0,
        failure_count = failure_count + 1,
        open_until = NOW() + INTERVAL open_duration_seconds SECOND,
        updated_at = NOW()
    WHERE org_code = ? AND state = 'HALF_OPEN';
    ```
    UPDATE affected rows = 0이면 다른 인스턴스가 이미 전이 완료한 것으로 간주하고 무시한다.

### `fep_circuit_breaker_events` (회로 차단기 상태 전이 이력)
*   **설명**: `fep_circuit_breaker_state`의 상태 전이 **이벤트를 Append-Only로 기록**합니다. 현재 상태는 `fep_circuit_breaker_state`가 관리하며, 이 테이블은 장애 분석·감사 리포트 전용 이벤트 로그입니다.
*   **설계 원칙**: **INSERT ONLY** — 기존 행을 UPDATE·DELETE하지 않는다. 모든 상태 전이가 타임라인 순으로 추적되어야 한다.
*   **컬럼**:
    *   `id` (PK): `BIGINT UNSIGNED AUTO_INCREMENT` — **Surrogate PK**. INSERT ONLY 테이블이므로 순차 삽입 보장. 타임라인 정렬 보조 키로도 활용 가능. **DB 내부 전용 — 외부 노출 금지.**
    *   `event_id` (UK): `CHAR(36) NOT NULL` — **Business UUID**. 외부 감사 조회 식별자. DDL: `UNIQUE KEY uk_event_id (event_id)`.
    *   `org_code` (FK → `fep_institutions.org_code`, **ON DELETE RESTRICT**): `VARCHAR(10)` — 기관 코드. CB 이벤트 이력이 남아있는 기관의 물리 삭제를 DB 레벨에서 차단한다.
    *   `from_state`: `VARCHAR(20)` — 전이 이전 상태. DDL: `ENUM('CLOSED','OPEN','HALF_OPEN','INITIAL')`. `INITIAL` = 기관 최초 등록 시 CB 이벤트(이전 상태 없음). (`CLOSED`, `OPEN`, `HALF_OPEN`, `INITIAL` — 최초 등록 시)
    *   `to_state`: `VARCHAR(20)` — 전이 이후 상태. DDL: `ENUM('CLOSED','OPEN','HALF_OPEN')`. (`CLOSED`, `OPEN`, `HALF_OPEN`)
    *   `trigger_type`: `VARCHAR(30)` — 전이 원인 코드. DDL: `ENUM('FAILURE_THRESHOLD','OPEN_EXPIRED','SUCCESS_THRESHOLD','HALF_OPEN_FAILURE','MANUAL_RESET')`. `VARCHAR(30)`은 DBML이 MySQL ENUM을 네이티브 지원하지 않아 ERD 도구 호환 목적으로 사용; 실제 DDL은 `ENUM` 사용 권장
        *   **✅ [R19/R20] 컬럼명 변경 완료**: 기존 `trigger`는 MySQL 8.x/MariaDB **예약어(Reserved Word)**로, DDL에서 백틱 없이 사용 시 `ERROR 1064: You have an error in your SQL syntax` 발생. `trigger_type`으로 컬럼명 변경하여 백틱 없이 실용 가능. DDL: `trigger_type ENUM('FAILURE_THRESHOLD','OPEN_EXPIRED','SUCCESS_THRESHOLD','HALF_OPEN_FAILURE','MANUAL_RESET') NOT NULL`. DBML(R19) + schema.md(R20) 동기화 완료.
        *   `FAILURE_THRESHOLD`: `failure_count` 임계치 초과 → `CLOSED → OPEN`
        *   `OPEN_EXPIRED`: `open_until` 만료 → `OPEN → HALF_OPEN`
        *   `SUCCESS_THRESHOLD`: HALF_OPEN 연속 성공 → `HALF_OPEN → CLOSED`
        *   `HALF_OPEN_FAILURE`: HALF_OPEN 중 재실패 → `HALF_OPEN → OPEN`
        *   `MANUAL_RESET`: 운영자 강제 초기화 → any → `CLOSED`
    *   `failure_count_snapshot`: `INT` — NULL허용 — 전이 시점의 `failure_count` 값 스냅샷. "몇 번째 실패에서 OPEN이 됐는가?" 파악용. `MANUAL_RESET` 이벤트처럼 failure_count가 의미 없는 경우 `NULL`
    *   `throttled_count`: `INT DEFAULT 0` — OPEN 상태 지속 중 **INSERT Throttle 정책으로 스킵된** `CIRCUIT_REJECTED` 요청 수. OPEN → HALF_OPEN 전이 이벤트 레코드에 해당 OPEN 기간의 총 스킵 건수를 기록. 실제 총 거절 건수 = `fep_transaction_journal`의 `CIRCUIT_REJECTED` 행 수 + 이 컬럼 합산. Throttle 정책이 활성화되지 않은 경우 항상 `0`.
        *   **⚠️ INSERT ONLY 원칙과의 모순 해소**: `fep_circuit_breaker_events`는 INSERT ONLY 원칙을 유지하므로 기존 이벤트 행에 UPDATE로 `throttled_count`를 누적할 수 없다. 대신 다음 구조를 사용한다:
            *   **인메모리 카운터**: Gateway 인스턴스는 현재 OPEN 기간 동안 스킵된 건수를 `AtomicLong openPeriodThrottledCount`로 인메모리에 누적한다.
            *   **전이 시 기록**: `OPEN → HALF_OPEN` 전이 이벤트를 INSERT할 때 해당 OPEN 기간의 누적값을 `throttled_count`에 담아 **한 번에 INSERT**한다 (UPDATE 없음).
            *   **다중 인스턴스 환경**: 여러 Gateway 인스턴스가 동시에 Throttle 카운터를 증가시킬 경우 `Redis INCR org:{org_code}:throttled_count` 키를 사용하여 인스턴스 간 합산 후 전이 이벤트 INSERT 시 READ-and-RESET 패턴으로 값을 가져온다.
            *   **Redis 장애 시**: 각 인스턴스의 인메모리 값만 기록되므로 `throttled_count`는 **부분 집계(과소 계상)** 될 수 있다 — 이는 허용된 근사값이며 감사 정밀도보다 가용성을 우선한 설계 결정이다.
    *   `created_at`: `DATETIME(6) NOT NULL` — 이벤트 발생 시각 (타임라인 정렬 기준). NOT NULL — INSERT ONLY 테이블에서 모든 이벤트는 타임스탬프가 반드시 존재해야 한다(장애 분석용 포렌식 재구성). 다중 인스턴스 환경에서 동일 초 내 발생하는 이벤트의 순서를 마이크로초 단위로 구분. (DBML R15 `datetime(6)` 반영)
*   **인덱스 전략**:
    *   `PRIMARY KEY (id)` — Surrogate PK. INSERT ONLY 테이블 순차 삽입 보장. 타임라인 정렬 보조 키로도 활용 가능. **DB 내부 전용.**
    *   `UNIQUE KEY uk_event_id (event_id)` — **Business UUID UK**. 외부 감사 조회 진입점. INSERT ONLY이므로 모든 이벤트는 안정적이고 불변하는 UUID를 가진다. DDL: `CHAR(36) UNIQUE NOT NULL`.
    *   `INDEX idx_cb_events (org_code, created_at DESC)` — 기관별 최신 이벤트 빠른 조회. DESC 인덱스 — MySQL 8.0+ / MariaDB 10.6+ 전용. 구버전에서는 ASC로 묵시적 대체 생성되며 쿼리는 정상 동작하나 `ORDER BY created_at DESC` 시 정렬 비용 발생. DBML은 DESC 인덱스 방향 미지원 — 실제 DDL 적용 필요.
*   **보존 정책**: **90일** 보관. 이벤트 발생 빈도가 낮아 `fep_protocol_log`와 달리 파티션 없이도 관리 가능.
*   **연동 포인트**: `fep_circuit_breaker_state` UPDATE와 **동일 트랜잭션** 내에서 이 테이블에 INSERT하여 현재 상태 변경과 이력 기록이 원자적으로 이루어지도록 한다. 트랜잭션 실패 시 상태 변경과 이력 모두 롤백.

---

## 5. 운영 인수인계 (Operational Handoff)

### DDL 실행 순서 (FK 의존성 기반)

9개 테이블(**`fep_institutions`, `fep_connections`, `fep_routing_rules`, `fep_protocol_specs`, `fep_circuit_breaker_state`, `fep_circuit_breaker_events`, `fep_security_keys`, `fep_transaction_journal`, `fep_protocol_log`**)은 FK 의존성으로 인해 **아래 순서대로 DDL을 실행**해야 한다. 순서를 지키지 않으면 FK 참조 대상 테이블이 없어 `CREATE TABLE` 실패.

```sql
-- ① 참조 대상 없음 (최상위)
CREATE TABLE fep_institutions (...);         -- 모든 FK의 참조 원점

-- ② fep_institutions 참조
CREATE TABLE fep_connections (...);          -- FK → fep_institutions.org_code
CREATE TABLE fep_routing_rules (...);        -- FK → fep_institutions.org_code
CREATE TABLE fep_protocol_specs (...);       -- FK → fep_institutions.org_code
CREATE TABLE fep_circuit_breaker_state (...); -- FK → fep_institutions.org_code
CREATE TABLE fep_circuit_breaker_events (...); -- FK → fep_institutions.org_code

-- ③ fep_institutions + self-FK
CREATE TABLE fep_security_keys (...);        -- FK → fep_institutions.org_code
                                             -- Self-FK → fep_security_keys.key_id (**UNIQUE KEY** — rotated_from_key_id)
                                             -- ⚠️ key_id가 R33에서 PK→UK로 변경됨. MySQL/MariaDB FK는 PK 또는 UNIQUE KEY 참조 가능이므로 DDL 유효.
                                             -- MySQL: Self-FK는 CREATE TABLE 후 ALTER TABLE로 추가 또는
                                             --        CREATE TABLE 시 자기 자신이 아직 없으므로 DEFERRABLE 불가
                                             --        → 실무에서는 CREATE TABLE 후 ALTER TABLE ADD CONSTRAINT로 추가
                                             -- ⚠️ Self-FK ADD CONSTRAINT 순서 주의:
                                             --   Seed 데이터(rotated_from_key_id가 NULL이 아닌 행)를
                                             --   먼저 삽입한 뒤 ALTER TABLE ADD CONSTRAINT를 실행해야 한다.
                                             --   Seed 삽입 전 FK를 추가하면 NULL이 아닌 rotated_from_key_id가
                                             --   아직 존재하지 않는 key_id를 참조하여 FK 추가 자체가 실패한다.
                                             --   권장 순서: CREATE TABLE → INSERT Seed (NULL rotated_from_key_id 우선) → ALTER TABLE ADD CONSTRAINT

-- ④ fep_institutions 참조 (거래 원장 — 가장 크고 중요)
CREATE TABLE fep_transaction_journal (...);  -- FK → fep_institutions.org_code
                                             -- Self-FK → fep_transaction_journal.tx_id (**UNIQUE KEY** — reversal_ref_tx_id)
                                             -- ⚠️ tx_id가 R32에서 PK→UK로 변경됨. FK가 UK를 참조하므로 DDL 유효.

-- ⑤ fep_transaction_journal 참조
CREATE TABLE fep_protocol_log (...);         -- ⚠️ 설계 의도 FK → fep_transaction_journal.tx_id (ON DELETE SET NULL)
                                             -- 실제 DDL에서는 FK를 선언하지 않음 — MySQL ERROR 1506:
                                             -- 파티션된 테이블은 FK를 가질 수 없다 (has or is referenced by a foreign key)
                                             -- → ON DELETE SET NULL은 앱 레이어 DELETE 핸들러 또는 야간 배치로 대체 구현
```

> **Trigger 생성 순서**: 테이블 생성 완료 후 Trigger를 생성한다. 총 **6개** Trigger가 존재한다:
> 1. `AFTER INSERT ON fep_institutions` (trg_init_circuit_breaker) → `fep_circuit_breaker_state INSERT` — `fep_circuit_breaker_state` 테이블이 먼저 존재해야 한다.
> 2. `AFTER UPDATE ON fep_institutions` (trg_activate_circuit_breaker) → `SUSPENDED → ACTIVE` 전환 시 CB State 생성 (`INSERT IGNORE`) — 마찬가지로 `fep_circuit_breaker_state` 테이블이 먼저 존재해야 한다.
> 3. `BEFORE INSERT ON fep_security_keys` (trg_security_keys_active_dup_insert) → `ACTIVE` 키 중복 삽입 차단 (`SIGNAL SQLSTATE '45000'`) — `fep_security_keys` 테이블 생성 후 즉시 추가.
> 4. `BEFORE UPDATE ON fep_security_keys` (trg_security_keys_active_dup_update) → `ACTIVE`로 변경하는 UPDATE 시 중복 차단 (조기 반환 최적화 포함) — `fep_security_keys` 테이블 생성 후 즉시 추가.
> 5. `BEFORE INSERT ON fep_protocol_specs` (trg_protocol_specs_no_dup_null_msgtype) → `msg_type IS NULL` 공통 레코드 중복 삽입 차단 — `fep_protocol_specs` 테이블 생성 후 즉시 추가. `UNIQUE KEY uk_spec`의 `NULL ≠ NULL` MySQL 함정 보완.
> 6. `BEFORE UPDATE ON fep_protocol_specs` (trg_protocol_specs_no_dup_null_msgtype_update) → `msg_type`을 `NULL`로 변경하는 UPDATE 시 중복 차단 — `fep_protocol_specs` 테이블 생성 후 즉시 추가.

### 기관 코드 배포 파이프라인 동기화 검증

`fep_institutions.org_code` (Gateway DB) 와 `sim_exchange_topology.code` (Simulator DB) 는 **반드시 동일한 값 집합**이어야 한다. 불일치 시 Gateway의 라우팅 실패 및 Simulator 연동 오류가 발생한다.

**권장 동기화 방식**:

1.  **공유 Seed 파일**: 기관 목록을 단일 `institutions-seed.yaml` (또는 `.sql`) 파일로 관리하고, Gateway 배포와 Simulator 배포가 이 파일에서 각각의 DB를 초기화하도록 CI/CD 파이프라인을 구성한다.

2.  **배포 파이프라인 검증 스텝**: Gateway 배포 후, 통합 테스트 단계에서 아래 검증 쿼리를 실행하여 두 DB 간 기관 코드가 일치하는지 확인한다:
    ```sql
    -- Gateway DB
    SELECT org_code FROM fep_institutions WHERE status = 'ACTIVE' ORDER BY org_code;

    -- Simulator DB
    SELECT code FROM sim_exchange_topology WHERE is_active = TRUE ORDER BY code;

    -- 두 결과가 일치하지 않으면 배포 파이프라인을 실패 처리한다.
    ```

3.  **불일치 알림**: 검증 스텝 실패 시 Slack/이메일로 자동 알림을 발송하고 배포를 중단한다. 수동 DB 조작으로 인한 불일치를 배포 시점에 조기 탐지한다.

### 라우팅 규칙 핫 리로드 정책

`fep_routing_rules` 변경(INSERT/UPDATE/DELETE) 후 Gateway가 새 규칙을 언제 반영하는지 명세가 없으면 운영팀이 재시작 여부를 판단할 수 없다. 아래 두 방식 중 하나를 선택하여 **구현 초기에 확정**한다:

1.  **[권장] Admin API 즉시 반영**: `POST /admin/fep/routing-rules/reload` 엔드포인트를 호출하면 Gateway가 `fep_routing_rules`에서 `is_active = TRUE` 인 모든 규칙을 즉시 재로드한다. `fep_protocol_specs`의 Reload API와 동일한 패턴. 재배포 없이 규칙 변경 즉시 적용 가능.
2.  **[대안] 주기적 폴링**: 스케줄러가 30초마다 `updated_at > {last_loaded_at}` 조건으로 변경된 규칙을 탐지하여 캐시 갱신. 최대 30초의 반영 지연 허용.
3.  **[비권장] 재시작**: 규칙 변경마다 Gateway를 재시작하면 진행 중인 연결이 끊기고 FIX Logon 재연결 비용이 발생한다. 운영 중에는 사용하지 않는다.

> **구현 확정 전**: 코드 주석 또는 ADR(Architecture Decision Record)에 채택 방식을 명시한다.

### `fep_institutions.status` 전이 시 연쇄 처리 정책

기관을 `ACTIVE → SUSPENDED`로 전환할 때 Gateway는 다음 순서로 연쇄 처리한다:

1.  **신규 요청 차단 (즉시)**: Gateway가 `fep_institutions.status`를 30초 폴링으로 감지하거나 Admin API(`POST /admin/fep/institutions/{org_code}/suspend`)로 즉시 통보받는다. 이후 해당 `org_code`로 들어오는 모든 신규 주문 요청에 `RC=9001 NO_ROUTE`를 반환한다.
2.  **진행 중인 `PENDING` 주문**: `SUSPENDED` 처리 후 응답이 돌아오는 `PENDING` 주문은 정상적으로 `COMPLETED`/`TIMEOUT` 처리한다. 강제 취소하지 않는다.
3.  **소켓 연결 유지**: 소켓을 즉시 끊지 않는다. 기관 측에서 연결을 끊거나 Heartbeat Timeout이 발생할 때까지 유지한다. 단, `SUSPENDED` 상태에서는 `NewOrderSingle(D)` 신규 전문을 발송하지 않는다.
4.  **CB 상태 유지**: `fep_circuit_breaker_state`는 변경하지 않는다. `ACTIVE` 복귀 시 이전 CB 상태에서 재개한다.
5.  **`ACTIVE` 복귀**: Admin API 또는 DB 직접 업데이트로 `status = 'ACTIVE'`로 전환하면 즉시 신규 요청을 허용한다. 소켓이 유지된 경우 FIX Logon 없이 바로 NewOrderSingle(D) 발송 가능.
