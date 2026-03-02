# Table Specification — Channel System (v1.0)

---

## 1) `members` (회원 마스터)

### 1.1 테이블 목적

`members`는 채널계의 **인증/인가 앵커**다.

- 로그인 자격증명(password_hash), 계정 상태(status), 잠금 제어(login_fail_count, locked_at)의 단일 진실 원천
- TOTP 등록 상태만 보유 — 시크릿은 Vault가 관리, DB는 "등록됐는가"만 기록
- 탈퇴는 삭제 대신 `deleted_at` 소프트 삭제 → 주문/감사 이력 보존

### 1.2 컬럼 명세

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 내부 조인/조회 성능용 숫자 PK. `order_sessions`, `audit_logs` 등에서 FK로 사용. |
| `member_uuid` (UK) | API/URL/로그에 노출되는 예측 불가능 식별자. 내부 PK 노출 방지. |
| `username`, `email` (UK) | 로그인 키/이메일 찾기. 중복 계정 생성을 DB에서 원천 차단. |
| `password_hash` | Bcrypt/Argon2 해시만 저장 — 평문/복호화 가능 형태 절대 금지. |
| `name` | 알림 제목·본문 개인화 등 업무 표시용. |
| `role` | 인가 경계. `ROLE_USER`와 `ROLE_ADMIN` 분리 → Admin API 접근 제어 기준. |
| `status` | 계정 가용 상태. `LOCKED`이면 인증 자체를 차단. 잠금/해제의 단일 판단 기준. |
| `login_fail_count` | 임계치 도달 시 `LOCKED` 전이 트리거. 성공 로그인 시 Lazy Reset. |
| `last_fail_at` | 실패 시각. "일정 시간 후 카운터 초기화" 같은 정책 적용 기준. |
| `locked_at` | 잠금 이벤트의 시각. 감사/CS 조회에서 "언제 잠겼나"를 바로 알 수 있음. |
| `totp_enabled`, `totp_enrolled_at` | TOTP 활성 여부와 등록 시각만 보유. 시크릿은 Vault — DB 침해 시 TOTP 시크릿 노출 없음. |
| `created_at`, `updated_at` | 가입/변경 이력 추적. 운영/배치 분석 기본. |
| `deleted_at` | 소프트 삭제 마커. 기본 조회는 `IS NULL` 포함. 이력은 보존. |

### 1.3 인덱스 필요 이유

- `UK(username)`, `UK(email)`: 로그인 조회 경로 + 중복 방지
- `IDX(status)`: LOCKED 계정 운영 조회 (관리자 화면)
- `IDX(status, deleted_at)`: "활성 비삭제 회원" 필터 복합 최적화
- `IDX(deleted_at)`: 소프트 삭제된 회원 보존 정책 배치

---

## 2) `otp_verifications` (주문 OTP 시도 관리)

### 2.1 테이블 목적

`otp_verifications`는 주문 Step-up 인증에서 **OTP 시도 횟수와 검증 상태를 영속 관리**하는 테이블이다.

- OTP 시도 횟수(`attempt_count`) 관리 → 과도 시도 시 `EXHAUSTED` 전이 → `SECURITY_EVENTS` 연동
- 검증 완료(`VERIFIED`)가 확인되어야 `ORDER_SESSIONS.status`가 `AUTHED`로 전이 가능
- OTP 코드 자체는 저장하지 않음 — 인메모리(캐시/Redis)에서 검증 후 폐기

### 3.2 컬럼 명세

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 내부 PK. |
| `otp_uuid` (UK) | 외부 참조 ID. 감사 로그에서 특정 OTP 이벤트를 추적할 때 사용. |
| `order_session_id` (UK, FK) | 1 세션 = 1 OTP 레코드를 DB에서 강제. 중복 발급 차단. |
| `member_id` (FK) | 회원 기준 통계 조회(특정 회원이 몇 번 실패했는지 등). |
| `attempt_count` | 현재까지 시도 횟수. `max_attempts` 도달 시 `EXHAUSTED`. |
| `max_attempts` | 정책값 저장 — 운영 환경별 상이한 한도를 레코드마다 고정. |
| `status` | OTP 상태 머신 핵심. 서비스 로직의 분기 기준. |
| `expires_at` | OTP 유효 기간. 만료된 OTP 시도는 `EXPIRED` 판정. |
| `verified_at` | `VERIFIED` 전이 시각. 감사/CS 추적에 사용. |
| `created_at`, `updated_at` | 시도 타임라인 추적. |

### 3.3 인덱스 필요 이유

- `UK(order_session_id)`: 세션당 OTP 1건 강제 + 단건 조회 최적화
- `IDX(member_id, status)`: 회원별 OTP 상태 조회 (EXHAUSTED 집계 등)
- `IDX(status, expires_at)`: 만료 OTP 정리 배치 + 레이트 리밋 판정

---

## 4) `order_sessions` (채널 주문 세션)

### 4.1 테이블 목적

`order_sessions`는 채널계에서 FIX 4.2 주문 1건의 **처음부터 끝까지 모든 업무 상태**를 영속화한다.

- OTP 인증 → 주문 실행 오케스트레이션 → 완료/실패/만료의 단일 진실 원천
- `client_request_id` UK로 **클라이언트 중복 요청 방지(멱등)** — FIX Tag 11 ClOrdID 소스
- `post_execution_balance` 스냅샷으로 완료 응답을 재조회·재계산 없이 재현
- `core_db`의 `accounts`는 논리 참조 → 서비스 레이어에서 유효성 보장

### 4.2 컬럼 명세

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 내부 조인/정렬 PK. `notifications`, `audit_logs`, `security_events`가 FK로 참조. |
| `session_uuid` (UK) | 공개 API 세션 참조 번호. 내부 PK 노출 없이 고객/CS가 추적 가능. |
| `member_id` (FK) | 주문 요청자. 회원별 주문 내역 조회의 기본 조건. |
| `correlation_uuid` | MSA 환경에서 채널↔코어↔FEP 간 요청을 단일 트레이스로 연결. |
| `client_request_id` (UK) | **업무 레벨 멱등 키**. 네트워크 재시도/중복 클릭 방어의 DB 1차 방어선. FIX Tag 11 ClOrdID 소스. |
| `status` | 상태 머신의 핵심(`PENDING_NEW→AUTHED→EXECUTING→COMPLETED/FAILED/EXPIRED`). 서비스 로직이 이 값을 기준으로 분기. |
| `from_account_id` | 주문 실행 계좌 식별. 채널 레이어에서 계좌 소유자 검증에 사용. core_db 논리 참조. |
| `from_account_number` | 주문 시점 실행 계좌번호 스냅샷. "내 주문 내역"에서 어느 계좌로 주문했는지 Core API 재조회 없이 표시 가능. |
| `symbol` | 종목코드 (FIX Tag 55). 주문 대상 식별. 예: 005930(삼성전자). |
| `side` | 주문 방향 (FIX Tag 54). BUY/SELL. |
| `ord_type` | 주문 유형 (FIX Tag 40). LIMIT/MARKET. |
| `order_qty` | 주문 수량 (FIX Tag 38). |
| `price` | 주문 단가 (FIX Tag 44). LIMIT 주문 시 필수, MARKET 시 NULL. |
| `cl_ord_id` | FEP가 부여한 FIX ClOrdID (Tag 11). 주문 접수 후 설정. |
| `ledger_uuid` | 완료 시 core_db 원장의 posting_id와 연결. 감사/CS 추적 핵심. |
| `fep_reference_id` | FEP 참조 ID(FIX Tag 37 OrderID). 불확실(timeout) 상태에서 외부 조사/복구 근거. |
| `failure_reason_code` | 구조화된 실패 코드. 클라이언트 에러 처리 분기 표준화. |
| `post_execution_balance` (DECIMAL) | **멱등 응답 스냅샷** — 완료 시 잔액을 재조회하지 않고 재현. |
| `executing_started_at` | **(Round 2 P1 추가)** EXECUTING 전이 시각. `updated_at`과 독립적으로 timeout 판정에 사용 — "다른 이유로 updated_at이 갱신되어도 판정 기준이 흔들리지 않게"(core_db 동일 패턴 참조). |
| `expires_at` | 세션 유효 기간. `PENDING_NEW`/`AUTHED` 상태에서 만료 판정 기준. |
| `completed_at` | 최종 상태 도달 시각. SLA 분석/분쟁 대응/리포트 필수. |
| `created_at`, `updated_at` | 타임라인 추적. `IDX(status, updated_at)`로 만료/실패 세션 운영 조회. |

### 4.3 인덱스 필요 이유

- `UK(client_request_id)`: 멱등의 DB 1차 방어선
- `UK(session_uuid)`: 공개 API 단건 조회
- `IDX(member_id, created_at)`: "내 주문 내역" 페이지네이션
- `IDX(status, updated_at)`: 만료·실패 세션 운영 스캔
- `IDX(status, expires_at)`: 만료 정리 배치 대상 식별
- `IDX(from_account_id, created_at)`: 계좌 기준 주문 이력 조회
- `IDX(symbol, created_at)`: 종목 기준 주문 내역 조회

---

## 5) `notifications` (알림 내구성 저장소)

### 5.1 테이블 목적

`notifications`는 **SSE 전송 실패나 재연결 시에도 알림이 소멸되지 않도록** DB에 영속화한다.

- SSE 전송: 이벤트 발행 후 전송 성공 여부와 무관하게 DB 레코드 먼저 생성
- Reconnect: 클라이언트 재연결 시 `UNREAD` 알림을 DB에서 재발행
- 사용자가 숨기고 싶으면 소프트 삭제(`deleted_at`) 제공

### 5.2 컬럼 명세

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 정렬/페이지네이션에 효율적인 순번 PK. |
| `notification_uuid` (UK) | 공개 알림 참조. SSE 이벤트 ID로 사용해 클라이언트 중복 수신 방지. |
| `member_id` (FK) | 수신자. "내 알림 목록" 조회의 핵심 조건. |
| `order_session_id` (FK, nullable) | 주문 관련 알림에서 세션으로 드릴다운 링크 제공. |
| `type` | 알림 분류. 클라이언트가 아이콘/색상/동작을 타입별로 다르게 렌더링. |
| `status` | 읽음 수명 주기(`UNREAD→READ→EXPIRED`). 안 읽은 알림 배지 카운트 기준. |
| `title`, `message` | 화면 표시용. title은 요약, message는 상세. |
| `read_at` | 읽음 처리 시각. SLA(몇 분 내 확인) 분석 가능. |
| `expires_at` | 보존 정책 만료. 기간 지난 알림은 `EXPIRED` 처리 후 배치 삭제 대상. |
| `created_at`, `updated_at` | 타임라인 추적. |
| `deleted_at` | 사용자 숨김/삭제 — UI 기준이지, 운영 보존은 별도 정책으로 관리. |

### 5.3 인덱스 필요 이유

- `IDX(member_id, status, created_at)`: "내 미읽음 알림 목록" 최빈 쿼리 최적화 복합 인덱스
- `IDX(member_id, deleted_at)`: 소프트 삭제 필터 최적화
- `IDX(status, expires_at)`: 만료 배치 처리 대상 식별
- `IDX(order_session_id)`: 세션 기준 관련 알림 조회

---

## 6) `audit_logs` (불변 감사 로그)

### 6.1 테이블 목적

`audit_logs`는 **사용자/시스템의 모든 주요 행위를 불변 시계열**로 기록한다.

- Append-only: 삽입만, 수정/삭제 금지
- 규제/감사/CS 분쟁 대응의 법적 증거 역할
- 상태(`status`)가 없는 이유: 행위는 발생하면 확정 — 상태 관리가 불필요

### 6.2 컬럼 명세

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 시간 순 정렬 기준. Auto-increment 순열 = 발생 순서 근사치. |
| `audit_uuid` (UK) | 컴플라이언스 참조 번호. 외부 감사 시스템과의 연동 ID. |
| `member_id` (IDX, nullable) | 행위자. `NULL`이면 시스템/배치 행위. |
| `order_session_id` (IDX, nullable) | 주문 세션 맥락 추적. 단건 주문에 대한 전 과정 타임라인 재현. |
| `action` | 표준화된 행위 분류어. CS/보안팀이 필터링/집계하는 핵심 컬럼. |
| `target_type`, `target_id` | 무엇에 어떤 일이 일어났는지 대상 특정. "이 계정에 무슨 일이?" 같은 조회에 필수. |
| `ip_address`, `user_agent` | 포렌식 컨텍스트. 비정상 지역·기기 탐지 및 분쟁 증거. |
| `correlation_uuid` | 분산 서비스 간 요청 체인 연결. 이슈 재현 시 전 구간 추적 핵심. |
| `created_at` | 발생 시각. **이 컬럼이 파티셔닝 키 후보**. 장기 운영 시 월별 파티셔닝 적용 고려. |

### 6.3 인덱스 필요 이유

- `IDX(member_id, action, created_at)`: "특정 회원의 로그인/주문 내역 타임라인"
- `IDX(order_session_id, created_at)`: "이 주문 세션의 전 과정 이벤트 조회"
- `IDX(action, created_at)`: "전 시스템 LOGIN_FAILURE 집계" 등 운영 분석

---

## 7) `security_events` (보안 사건 워크플로)

### 7.1 테이블 목적

`security_events`는 **일반 감사 로그보다 높은 심각도**를 갖는 보안 사건을 별도 테이블에 분리해 **사건 대응 워크플로(OPEN→ACKNOWLEDGED→RESOLVED)** 를 지원한다.

- `audit_logs`와의 차이: audit은 "행위 기록", security_event는 "사건 + 대응 상태 + 책임자"
- Admin이 사건을 `ACKNOWLEDGED`/`RESOLVED`로 전이시키는 오퍼레이션 UI의 데이터 소스
- Append-only + 소프트 삭제 없음: 보안 사건 타임라인은 변조 불가

### 7.2 컬럼 명세

| 컬럼 | 필요 이유(설계 의도) |
| --- | --- |
| `id` (PK) | 내부 운영 조회 성능. |
| `security_event_uuid` (UK) | 사건 외부 참조 번호. Admin API, 알림 연동 ID. |
| `event_type` | 보안 신호 분류. 타입별로 자동 심각도 설정·에스컬레이션 정책 적용 가능. |
| `status` | 대응 워크플로 상태. Admin이 `ACKNOWLEDGED` 처리하면 담당자 파악, `RESOLVED`면 종결. |
| `severity` | 트리아지 우선순위. CRITICAL은 즉시 알림, LOW는 일배치로 처리. |
| `member_id` (IDX) | 대상 회원 — "이 회원에게 발생한 모든 보안 이벤트" 조회. |
| `admin_member_id` (IDX) | 처리 관리자 — 책임 추적. |
| `order_session_id` (IDX) | 연관 주문 세션 — 주문 중 발생한 보안 사건 드릴다운. |
| `detail` (TEXT) | 사건 재현에 필요한 상세 컨텍스트(JSON 덤프 등). 기본 Row는 작게, 상세는 별도 조회. |
| `ip_address` | 발생 IP. 동일 IP 반복 이벤트 탐지. |
| `correlation_uuid` | 분산 트레이싱. 채널↔코어 간 사건 원인 추적. |
| `occurred_at` | 실제 사건 발생 시각(`created_at`과 차이 가능). 정확한 사건 타임라인 기준. |
| `resolved_at` | 종결 시각. MTTR(평균 복구 시간) 측정 기준. |
| `created_at`, `updated_at` | 레코드 수집 시각, 워크플로 상태 전이 추적. |

### 7.3 인덱스 필요 이유

- `IDX(status, severity, occurred_at)`: "미해결 CRITICAL 사건 최신순" — Admin 대시보드 최빈 쿼리
- `IDX(member_id, occurred_at)`: 특정 회원의 보안 이벤트 타임라인
- `IDX(event_type, occurred_at)`: 이벤트 유형별 집계 (레이트 리밋 패턴 분석 등)
- `IDX(admin_member_id)`: 관리자별 처리 이력 조회

---

## 8. Cross-System Integrity Strategy (채널-코어 정합성)

### 8.1 Logical Foreign Key Validation
*   **문제**: `channel_db`는 `member_id`, `account_id`를 물리 FK 없이 저장한다.
*   **전략**:
    *   **Pre-check**: `order_sessions` 생성 시점(API)에 반드시 Core/Auth 서비스를 호출해 식별자 유효성을 확인한다.
    *   **Graceful Degradation**: Core 장애 시, 주문 요청은 거부되지만, 단순 조회(History)는 `channel_db` 데이터만으로 응답 가능해야 한다.

### 8.2 State Mapping & Reconciliation
*   **문제**: Channel(`EXECUTING`)↔Core(`POSTED`) 상태 불일치 (Timeout 등).
*   **전략**:
    *   **Mapping**: `status_machine.md`에 정의된 상태 매핑 테이블을 준수.
    *   **Recovery**: `client_request_id`를 멱등 키로 사용하여, Channel이 Core의 상태를 재조회(GetOrder)하고 자신의 상태를 동기화한다.
    *   **Self-Healing**: `EXECUTING` 상태로 30초 이상 경과한 세션은 스케줄러가 자동으로 정합성을 맞춘다.

### 8.3 Soft Delete Handling
*   **문제**: Channel 회원이 탈퇴(`delete_at`)해도 Core 원장은 영구 보존되어야 한다.
*   **전략**:
    *   **Immutable Ledger**: Core의 `journal_entries`는 회원 상태와 무관하게 기록을 유지한다.
    *   **History Access**: 탈퇴 회원의 주문 내역 조회 요청 시, Channel은 `deleted_at` 회원의 접근을 차단하되, 내부 감사/CS 도구에서는 조회 가능하도록 필터를 적용한다.

