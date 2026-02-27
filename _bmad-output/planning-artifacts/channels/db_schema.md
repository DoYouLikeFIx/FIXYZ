# 채널계 스키마 설계 (v1.0 - Production Ready)

## 1. 목적과 범위

`channel_db`는 FIX 프로젝트의 **채널계(Channel System)** — 인증, 세션, 이체 오케스트레이션, 알림, 감사, 보안 이벤트의 **단일 진실 원천**이다.

핵심 책임:
- **인증/인가**: 회원 로그인, JWT Refresh Token 수명 주기, 계정 잠금
- **이체 세션 관리**: OTP 인증 → 실행 오케스트레이션 → 완료/실패 기록
- **알림 내구성**: SSE 실패/재연결 시에도 DB 기록이 우선
- **감사/보안**: 행위 트레일(Audit Logs), 보안 사건 워크플로(Security Events)

DB 레벨 목표:
- 이중 키(Dual Key): 내부 숫자 PK + 외부 노출용 UUID
- 상태머신 강제: 상태 전이는 서비스 로직이 제어, 타임스탬프는 증거
- Idempotency: `client_request_id` 중복 처리 방지
- 불변 포렌식 레코드: `AUDIT_LOGS`, `SECURITY_EVENTS`는 삭제 불가
- Soft Delete: `MEMBERS`, `NOTIFICATIONS`에만 적용
- OTP 시크릿은 DB에 저장하지 않음(Vault 관리), DB는 수량/시각만 보유
- 금액/잔액 타입: `DECIMAL(19,4)` — `core_db`와 통일
- Cross-schema 참조(`TRANSFER_SESSIONS` → CoreBank `accounts`)는 논리 FK(서비스 경계)

---

## 2. 핵심 정책(고정)

### 2.1 식별자 정책
- 모든 테이블: `id BIGINT PK(AUTO)` + `*_uuid CHAR(36) UNIQUE` 패턴 강제
- 외부 API / 로그 / URL은 반드시 UUID 사용, 내부 PK 노출 금지

### 2.2 OTP 시크릿 정책
- TOTP 시크릿은 DB에 저장하지 않음 → Vault 관리
- `MEMBERS`: `totp_enabled`, `totp_enrolled_at` (등록 상태만)
- `OTP_VERIFICATIONS`: OTP 시도 횟수, 만료 시각, 검증 완료 시각 (시크릿 값 없음)

### 2.3 잠금 정책
- 채널계는 `accounts` row에 대한 락을 직접 획득하지 않음
- 이체 실행은 `core_db` 서비스를 통해서만 수행
- 채널계 내부 동시성 보호: `TRANSFER_SESSIONS.client_request_id UK`로 삽입 충돌 방지

### 2.4 불변 테이블 정책
- `AUDIT_LOGS`, `SECURITY_EVENTS`: Append-only, 소프트 삭제 허용 안 함
- 보존 정책 만료 시에만 물리 삭제(배치 삭제 잡으로 제거)

### 2.5 금액 타입 정책
- 채널계가 저장하는 금액(이체 요청액, 잔액 스냅샷)은 `DECIMAL(19,4)` 사용
- `core_db`와 동일 타입 → 변환 손실 없이 전달 가능

### 2.6 크로스-스키마 참조 정책
- `TRANSFER_SESSIONS`의 `from_account_id`, `receiver_account_id`는 `core_db.accounts.id`에 대한 논리 참조
- DB FK 불가 → 유효성 검증은 서비스 레이어에서 수행
- `OTP_VERIFICATIONS`의 OTP 코드 자체는 저장하지 않음

### 2.7 소프트 삭제 정책
| 테이블 | 적용 여부 | 이유 |
| --- | --- | --- |
| MEMBERS | ✅ `deleted_at` | 회원 탈퇴 후 이력 보존 필요 |
| OTP_VERIFICATIONS | ❌ | 시도 이력은 보안 증거, 상태 컬럼으로 관리 |
| TRANSFER_SESSIONS | ❌ | 금융 증거, 불변 |

| NOTIFICATIONS | ✅ `deleted_at` | 사용자 숨김/삭제 제공 |
| AUDIT_LOGS | ❌ | 포렌식 불변 레코드 |
| SECURITY_EVENTS | ❌ | 포렌식 불변 레코드 |

### 2.8 SECURITY_EVENTS 생성 방식 정책
- **생성 방식**: **동기(같은 트랜잭션 내)** 로 생성 — 보안 이벤트 누락 방지
- 계정 잠금(`MEMBERS.status → LOCKED`)과 `SECURITY_EVENTS(ACCOUNT_LOCKED)` 삽입은 원자적으로 커밋
- OTP 소진(`OTP_VERIFICATIONS.status → EXHAUSTED`)과 `SECURITY_EVENTS(OTP_MAX_ATTEMPTS)` 삽입도 동일 트랜잭션
- 레이트 리밋 이벤트는 인메모리(Redis) 카운터 기반이므로 **비동기(이벤트 큐)** 허용 — 단, 손실 가능성을 명시적으로 허용한 경우에만

---

## 3. channel_db 테이블 설계

### 3.1 members (회원 마스터)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| member_uuid | CHAR(36) | N | UK | 외부 노출 UUID |
| username | VARCHAR(50) | N | UK | 로그인 아이디 |
| email | VARCHAR(100) | N | UK | 이메일 |
| password_hash | VARCHAR(255) | N | | Bcrypt/Argon2 해시 |
| name | VARCHAR(100) | N | | 실명 |
| role | VARCHAR(20) | N | CHECK | ROLE_USER\|ROLE_ADMIN |
| status | VARCHAR(20) | N | CHECK | ACTIVE\|LOCKED |
| login_fail_count | INT UNSIGNED | N | DEFAULT 0 | 연속 실패 횟수 |
| last_fail_at | DATETIME(6) | Y | | 마지막 실패 시각 |
| locked_at | DATETIME(6) | Y | | 잠금 시각 |
| totp_enabled | BOOLEAN | N | DEFAULT FALSE | TOTP 활성 여부(시크릿은 Vault) |
| totp_enrolled_at | DATETIME(6) | Y | | TOTP 등록 시각 |
| created_at | DATETIME(6) | N | | 생성 |
| updated_at | DATETIME(6) | N | | 수정 |
| deleted_at | DATETIME(6) | Y | | 소프트 삭제 |

- **인덱스**: `UK(member_uuid)`, `UK(username)`, `UK(email)`, `IDX(status)`, `IDX(deleted_at)`, `IDX(status, deleted_at)`

---

### 3.2 otp_verifications (이체 OTP 시도 관리)
| 컬럼 | 타입 | NULL | 제약 | 설명 |

| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| token_uuid | CHAR(36) | N | UK | 토큰 외부 참조 ID |
| member_id | BIGINT UNSIGNED | N | FK | members.id 참조 |
| token_hash | CHAR(64) | N | UK | SHA-256 해시 저장(원문 노출 방지) |
| device_info | VARCHAR(255) | Y | | 기기 정보(선택 저장) |
| ip_address | VARCHAR(45) | Y | | 발급 시 IP |
| expires_at | DATETIME(6) | N | | 만료 시각 |
| revoked_at | DATETIME(6) | Y | | 명시적 리보크 시각(로그아웃/강제 종료) |
| created_at | DATETIME(6) | N | | 발급 시각 |

- **인덱스**: `UK(token_hash)`, `IDX(member_id, revoked_at)`, `IDX(expires_at)`, `IDX(member_id, expires_at)`
- **유효 토큰 조건**: `revoked_at IS NULL AND expires_at > NOW()`

---

### 3.3 otp_verifications (이체 OTP 시도 관리)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| otp_uuid | CHAR(36) | N | UK | 외부 참조 UUID |
| transfer_session_id | BIGINT UNSIGNED | N | FK+UK | transfer_sessions.id (1:1) |
| member_id | BIGINT UNSIGNED | N | FK | members.id |
| attempt_count | INT UNSIGNED | N | DEFAULT 0 | 시도 횟수 |
| max_attempts | INT UNSIGNED | N | DEFAULT 5 | 허용 최대 시도 횟수 |
| status | VARCHAR(20) | N | CHECK | PENDING\|VERIFIED\|EXHAUSTED\|EXPIRED |
| expires_at | DATETIME(6) | N | | OTP 만료 시각 |
| verified_at | DATETIME(6) | Y | | 검증 성공 시각 |
| created_at | DATETIME(6) | N | | 생성 |
| updated_at | DATETIME(6) | N | | 수정 |

- **인덱스**: `UK(transfer_session_id)` (1 세션 = 1 OTP 발급), `IDX(member_id, status)`, `IDX(status, expires_at)`

---

### 3.4 transfer_sessions (채널 이체 세션)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| session_uuid | CHAR(36) | N | UK | 공개 세션 참조 ID |
| member_id | BIGINT UNSIGNED | N | FK | members.id 참조 |
| correlation_uuid | CHAR(36) | N | | 분산 트레이싱 ID |
| client_request_id | VARCHAR(64) | N | UK | 클라이언트 멱등 키 |
| status | VARCHAR(20) | N | CHECK | OTP_PENDING\|AUTHED\|EXECUTING\|COMPLETED\|FAILED\|EXPIRED |
| from_account_id | BIGINT UNSIGNED | N | | core_db.accounts.id (논리 참조) |
| from_account_number | VARCHAR(14) | Y | CHECK | 출금 계좌번호 스냅샷(조회 응답용) |
| receiver_account_id | BIGINT UNSIGNED | Y | | core_db.accounts.id (당행 한정, 논리 참조) |
| receiver_account_number | VARCHAR(14) | N | CHECK | 숫자만(10~14) |
| receiver_name | VARCHAR(100) | Y | | 이체 시점 수취인 이름 스냅샷(조회 응답 캐시용) |
| to_bank_code | VARCHAR(16) | N | | 수취 은행 코드 |
| amount | DECIMAL(19,4) | N | CHECK(amount>0) | 이체 금액 |
| transaction_uuid | CHAR(36) | Y | | CoreBank 거래 UUID(완료 시) |
| fep_reference_id | VARCHAR(50) | Y | | 타행 FEP 참조 ID |
| failure_reason_code | VARCHAR(50) | Y | | 구조화된 실패 코드 |
| post_execution_balance | DECIMAL(19,4) | Y | | 이체 후 잔액 스냅샷 |
| executing_started_at | DATETIME(6) | Y | | EXECUTING 전이 시각(timeout 판정 독립 기준) |
| expires_at | DATETIME(6) | N | | 세션 만료 시각 |
| completed_at | DATETIME(6) | Y | | 최종 상태 도달 시각 |
| created_at | DATETIME(6) | N | | 세션 시작 |
| updated_at | DATETIME(6) | N | | 최종 상태 변경 |

- **인덱스**: `UK(session_uuid)`, `UK(client_request_id)`, `IDX(member_id, created_at)`, `IDX(status, updated_at)`, `IDX(status, expires_at)`, `IDX(status, executing_started_at)`, `IDX(from_account_id, created_at)`
- **CHECK**: `receiver_account_number REGEXP '^[0-9]{10,14}$'`
- **CHECK**: `from_account_number IS NULL OR from_account_number REGEXP '^[0-9]{10,14}$'`

---

### 3.5 notifications (알림 내구성 저장소)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| notification_uuid | CHAR(36) | N | UK | 공개 알림 참조 |
| member_id | BIGINT UNSIGNED | N | FK | 수신 회원 |
| transfer_session_id | BIGINT UNSIGNED | Y | FK | 관련 이체 세션(선택) |
| type | VARCHAR(50) | N | CHECK | TRANSFER_COMPLETED\|TRANSFER_FAILED\|SESSION_EXPIRY\|SECURITY_ALERT\|ACCOUNT_LOCKED |
| status | VARCHAR(20) | N | CHECK | UNREAD\|READ\|EXPIRED |
| title | VARCHAR(100) | N | | 알림 요약 |
| message | TEXT | N | | 알림 본문 |
| read_at | DATETIME(6) | Y | | 읽음 처리 시각 |
| expires_at | DATETIME(6) | Y | | 보존 만료 시각 |
| created_at | DATETIME(6) | N | | 생성 |
| updated_at | DATETIME(6) | N | | 수정 |
| deleted_at | DATETIME(6) | Y | | 소프트 삭제 |

- **인덱스**: `UK(notification_uuid)`, `IDX(member_id, status, created_at)`, `IDX(member_id, deleted_at)`, `IDX(status, expires_at)`, `IDX(transfer_session_id)`

---

### 3.6 audit_logs (불변 감사 로그)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 순번 키 |
| audit_uuid | CHAR(36) | N | UK | 컴플라이언스 참조 ID |
| member_id | BIGINT UNSIGNED | Y | IDX | 행위자(NULL=시스템) |
| transfer_session_id | BIGINT UNSIGNED | Y | IDX | 관련 이체 세션 |
| action | VARCHAR(50) | N | CHECK | LOGIN_SUCCESS\|LOGIN_FAILURE\|LOGOUT\|TRANSFER_INITIATED\|OTP_VERIFIED\|TRANSFER_EXECUTED\|TRANSFER_FAILED\|TRANSFER_COMPENSATED\|ACCOUNT_LOCKED\|ACCOUNT_UNLOCKED\|TOTP_ENROLLED\|PASSWORD_CHANGED |
| target_type | VARCHAR(50) | Y | | 대상 엔티티 타입 |
| target_id | VARCHAR(100) | Y | | 대상 엔티티 ID |
| ip_address | VARCHAR(45) | Y | | 클라이언트 IP |
| user_agent | TEXT | Y | | 클라이언트 기기/브라우저 |
| correlation_uuid | CHAR(36) | Y | | 분산 트레이싱 ID |
| created_at | DATETIME(6) | N | | 발생 시각(Append-only) |

- **인덱스**: `UK(audit_uuid)`, `IDX(member_id, action, created_at)`, `IDX(transfer_session_id, created_at)`, `IDX(action, created_at)`
- **소프트 삭제 없음**: 포렌식 불변 레코드

---

### 3.7 security_events (보안 사건 워크플로)
| 컬럼 | 타입 | NULL | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| id | BIGINT UNSIGNED | N | PK(AUTO) | 내부 PK |
| security_event_uuid | CHAR(36) | N | UK | 사건 참조 ID |
| event_type | VARCHAR(50) | N | CHECK | ACCOUNT_LOCKED\|OTP_MAX_ATTEMPTS\|FORCED_LOGOUT\|ACCOUNT_UNLOCKED\|RATE_LIMIT_LOGIN\|RATE_LIMIT_OTP\|RATE_LIMIT_TRANSFER |
| status | VARCHAR(20) | N | CHECK | OPEN\|ACKNOWLEDGED\|RESOLVED |
| severity | VARCHAR(10) | N | CHECK | LOW\|MEDIUM\|HIGH\|CRITICAL |
| member_id | BIGINT UNSIGNED | Y | IDX | 대상 회원 |
| admin_member_id | BIGINT UNSIGNED | Y | IDX | 처리한 관리자 |
| transfer_session_id | BIGINT UNSIGNED | Y | IDX | 연관 이체 세션 |
| detail | TEXT | Y | | 사건 상세 컨텍스트(JSON 등) |
| ip_address | VARCHAR(45) | Y | | 발생 IP |
| correlation_uuid | CHAR(36) | Y | | 분산 트레이싱 ID |
| occurred_at | DATETIME(6) | N | | 사건 발생 시각 |
| resolved_at | DATETIME(6) | Y | | RESOLVED 전환 시각 |
| created_at | DATETIME(6) | N | | 레코드 수집 시각 |
| updated_at | DATETIME(6) | N | | 마지막 갱신 |

- **인덱스**: `UK(security_event_uuid)`, `IDX(status, severity, occurred_at)`, `IDX(member_id, occurred_at)`, `IDX(event_type, occurred_at)`, `IDX(admin_member_id)`
