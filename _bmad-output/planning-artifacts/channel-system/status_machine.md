# 채널 시스템 — 상태 모델 설계 (v1.0)

채널계는 **4개의 독립 상태 머신**으로 구성된다.

| 테이블 | 상태 컬럼 | 상태 전이 권한 |
| --- | --- | --- |
| `members` | `status` | 서비스 로직만 (Admin 잠금 해제 포함) |
| `otp_verifications` | `status` | 서비스 로직만 |
| `transfer_sessions` | `status` | 서비스 로직만 |
| `notifications` | `status` | 사용자 액션(READ) / 배치 정책(EXPIRED) |
| `security_events` | `status` | Admin 전용 워크플로 |

> **원칙**: 타임스탬프는 감사 증거이지 상태 판정의 주체가 아니다.
> 상태는 오직 `status` 컬럼으로 결정한다.

---

# 1. `members.status` 상태 머신

## 1.1 상태 정의

| 상태 | 의미 |
| --- | --- |
| `ACTIVE` | 정상 인증 가능 |
| `LOCKED` | 로그인 차단 상태 |

## 1.2 전이 규칙

```
ACTIVE  ──[실패 횟수 >= 임계치]──▶  LOCKED
LOCKED  ──[Admin 잠금 해제]────▶  ACTIVE
```

| 전이 | 트리거 | 부작용 |
| --- | --- | --- |
| `ACTIVE → LOCKED` | `login_fail_count >= 정책 임계치` | `locked_at` 기록, SECURITY_EVENTS 생성(`ACCOUNT_LOCKED`), **NOTIFICATIONS 생성(`ACCOUNT_LOCKED`, UNREAD)** |
| `LOCKED → ACTIVE` | Admin 잠금 해제 API 호출 | `login_fail_count = 0`, `locked_at = NULL`, AUDIT_LOGS 기록(`ACCOUNT_UNLOCKED`), SECURITY_EVENTS 전이(`RESOLVED`) |

## 1.3 Lazy Reset 정책

- 성공 로그인 시 `login_fail_count = 0`, `last_fail_at = NULL` 초기화
- `LOCKED` 상태에서는 성공 로그인 자체를 허용하지 않으므로, 반드시 Admin 해제 후에만 초기화 가능

## 1.4 소프트 삭제와 상태의 관계

- `deleted_at IS NOT NULL` 회원은 상태와 무관하게 인증 차단
- 삭제된 회원의 이체/감사 이력은 보존: `members.deleted_at`은 채널 레이어 필터이지, `audit_logs` / `transfer_sessions`의 삭제가 아님

---

# 2. `otp_verifications.status` 상태 머신

## 2.1 상태 정의

| 상태 | 의미 |
| --- | --- |
| `PENDING` | OTP 발급됨, 검증 대기 |
| `VERIFIED` | 검증 성공 |
| `EXHAUSTED` | 최대 시도 횟수 초과 |
| `EXPIRED` | 유효 시간 만료 |

## 2.2 전이 규칙

```
PENDING ──[올바른 코드 입력]──────────▶ VERIFIED
        ──[attempt_count >= max_attempts]▶ EXHAUSTED
        ──[현재 시각 > expires_at]───────▶ EXPIRED (배치 또는 검증 시 판정)
```

| 전이 | 트리거 | 부작용 |
| --- | --- | --- |
| `PENDING → VERIFIED` | OTP 코드 검증 성공 | `verified_at` 기록, `TRANSFER_SESSIONS.status → AUTHED` 가능 상태 |
| `PENDING → EXHAUSTED` | `attempt_count++` 후 `>= max_attempts` | SECURITY_EVENTS 생성(`OTP_MAX_ATTEMPTS`) |
| `PENDING → EXPIRED` | 검증 시도 시 `expires_at < NOW()` or 배치 판정 | TRANSFER_SESSIONS도 `EXPIRED` 전이 |

## 2.3 OTP 코드 값은 DB에 저장하지 않는다

- OTP 코드는 인메모리 캐시(Redis 등)에서 검증 후 폐기
- DB는 "몇 번 시도했는가, 성공했는가"만 기록 — DB 침해 시 코드 노출 없음

---

# 3. `transfer_sessions.status` 상태 머신

## 3.1 상태 정의

| 상태 | 의미 |
| --- | --- |
| `OTP_PENDING` | OTP 인증 대기 |
| `AUTHED` | OTP 검증 완료, 실행 승인 |
| `EXECUTING` | 코어 이체 실행 중 |
| `COMPLETED` | 정상 완료 |
| `FAILED` | 명확한 실패 |
| `EXPIRED` | 세션 만료 |

## 3.2 전이 규칙

```
OTP_PENDING ──[OTP VERIFIED]──▶ AUTHED
            ──[expires_at 만료]▶ EXPIRED

AUTHED ──[이체 실행 시작]────▶ EXECUTING
       ──[expires_at 만료]────▶ EXPIRED  (인증만 하고 실행하지 않은 경우)

EXECUTING ──[코어 성공 응답]──▶ COMPLETED
          ──[명확한 실패]────▶ FAILED
          ──[timeout 판정]───▶ FAILED (Core API 재조회 후 판정)
```

## 3.3 전이별 상세 규칙

| 전이 | 조건 | 부작용 |
| --- | --- | --- |
| `OTP_PENDING → AUTHED` | `OTP_VERIFICATIONS.status = VERIFIED` 확인 (4.11 원자적 트랜잭션) | AUDIT_LOGS 기록(`OTP_VERIFIED`) |
| `OTP_PENDING → EXPIRED` | `expires_at < NOW()` | NOTIFICATIONS 생성(`SESSION_EXPIRY`) |
| `AUTHED → EXECUTING` | 이체 실행 API 진입 | AUDIT_LOGS 기록(`TRANSFER_INITIATED`), `executing_started_at` 기록 |
| `AUTHED → EXPIRED` | `expires_at < NOW()` (배치 수행) | NOTIFICATIONS 생성(`SESSION_EXPIRY`) |
| `EXECUTING → COMPLETED` | 코어 성공 응답 수신 | `transaction_uuid` 저장, `post_execution_balance` 스냅샷, NOTIFICATIONS 생성(`TRANSFER_COMPLETED`), AUDIT_LOGS(`TRANSFER_EXECUTED`) |
| `EXECUTING → FAILED` | 코어 명확한 실패 응답 또는 timeout 판정 | `failure_reason_code` 저장, NOTIFICATIONS 생성(`TRANSFER_FAILED`), AUDIT_LOGS(`TRANSFER_FAILED`) |

## 3.4 멱등(Idempotency) — 채널 레이어

- `client_request_id UNIQUE`: DB 1차 방어선
- 동일 `client_request_id` 재요청 → 기존 세션 조회 → 현재 `status`와 스냅샷으로 응답 재현
- `COMPLETED` 상태면 `post_execution_balance` + `transaction_uuid`로 동일 응답 재구성

## 3.5 상태 조합 매트릭스 (전체)

| transfer_session.status | otp_verifications.status | 의미 | 허용 여부 |
| --- | --- | --- | --- |
| OTP_PENDING | PENDING | 정상 — OTP 입력 대기 중 | ✅ 관리 대상 |
| OTP_PENDING | EXHAUSTED | 비정상 — OTP 소진, 세션 EXPIRED 전이 필요 | ⚠️ 즉시 처리 |
| OTP_PENDING | EXPIRED | 비정상 — OTP 만료, 세션도 EXPIRED 전이 | ⚠️ 즉시 처리 |
| AUTHED | VERIFIED | 정상 — 실행 가능 상태 | ✅ |
| AUTHED | VERIFIED | 만료 배치 진입 시 EXPIRED 전이 대상 | ⚠️ 만료 배치 대상 |
| EXECUTING | VERIFIED | 정상 — 실행 중 | ✅ |
| COMPLETED | VERIFIED | 정상 완료 | ✅ |
| FAILED | VERIFIED | 실행 후 실패 | ✅ |
| EXPIRED | PENDING\|EXHAUSTED\|EXPIRED | 세션 만료 | ✅ |
| EXECUTING | \* | **timeout 위험 상태** — `executing_started_at` 기준 30초 초과 시 복구 스캔 대상 | ⚠️ 배치 대상 |

---

# 4. `notifications.status` 상태 머신

## 4.1 상태 정의

| 상태 | 의미 |
| --- | --- |
| `UNREAD` | 사용자가 아직 확인하지 않음 |
| `READ` | 사용자가 확인함 |
| `EXPIRED` | 보존 기간 만료 |

## 4.2 전이 규칙

```
UNREAD ──[사용자 읽음 액션]──▶ READ
UNREAD ──[보존 만료 배치]───▶ EXPIRED
READ   ──[보존 만료 배치]───▶ EXPIRED
```

| 전이 | 트리거 | 부작용 |
| --- | --- | --- |
| `UNREAD → READ` | 사용자 명시적 읽음 처리 | `read_at` 기록 |
| `UNREAD/READ → EXPIRED` | 보존 정책 배치 (`expires_at < NOW()`) | 이후 배치 삭제 대상 |

## 4.3 SSE 재연결 보장

- SSE 전송 실패 → DB 레코드는 `UNREAD` 유지
- 클라이언트 재연결 → `UNREAD` 알림 재발행
- 이미 `READ`/`EXPIRED`이면 재발행 안 함

---

# 5. `security_events.status` 상태 머신

## 5.1 상태 정의

| 상태 | 의미 |
| --- | --- |
| `OPEN` | 미처리 사건 |
| `ACKNOWLEDGED` | 담당자 확인 |
| `RESOLVED` | 종결 |

## 5.2 전이 규칙

```
OPEN ──[Admin 확인]──▶ ACKNOWLEDGED
ACKNOWLEDGED ──[Admin 종결]──▶ RESOLVED
OPEN ──[Admin 직접 종결]────▶ RESOLVED
```

| 전이 | 조건 | 부작용 |
| --- | --- | --- |
| `OPEN → ACKNOWLEDGED` | Admin API 호출 | `admin_member_id` 기록, AUDIT_LOGS 추가 |
| `ACKNOWLEDGED → RESOLVED` | Admin API 호출 | `resolved_at` 기록 |
| `OPEN → RESOLVED` | Admin 직접 처리 | `admin_member_id`, `resolved_at` 기록 |

## 5.3 자동 생성 트리거 (이벤트 타입별)

| 이벤트 타입 | 트리거 | 기본 심각도 |
| --- | --- | --- |
| `ACCOUNT_LOCKED` | `members.status → LOCKED` | HIGH |
| `OTP_MAX_ATTEMPTS` | `otp_verifications.status → EXHAUSTED` | HIGH |
| `FORCED_LOGOUT` | Admin 강제 로그아웃 API | MEDIUM |
| `ACCOUNT_UNLOCKED` | `members.status → ACTIVE` (Admin 해제) | LOW |
| `RATE_LIMIT_LOGIN` | 로그인 레이트 리밋 초과 | MEDIUM |
| `RATE_LIMIT_OTP` | OTP 레이트 리밋 초과 | MEDIUM |
| `RATE_LIMIT_TRANSFER` | 이체 레이트 리밋 초과 | MEDIUM |

---

# 6. 전체 상태 연동 흐름

## 6.1 정상 이체 시나리오

```
[1] POST /transfers/sessions
    → TRANSFER_SESSIONS 생성 (OTP_PENDING)
    → OTP_VERIFICATIONS 생성 (PENDING)
    → AUDIT_LOGS(TRANSFER_INITIATED)

[2] POST /otp/verify
    → OTP_VERIFICATIONS(PENDING → VERIFIED)
    → TRANSFER_SESSIONS(OTP_PENDING → AUTHED)
    → AUDIT_LOGS(OTP_VERIFIED)

[3] POST /transfers/execute
    → TRANSFER_SESSIONS(AUTHED → EXECUTING)
    → [Core API 호출]
    → 성공: TRANSFER_SESSIONS(EXECUTING → COMPLETED)
             post_execution_balance 스냅샷
             NOTIFICATIONS 생성(TRANSFER_COMPLETED, UNREAD)
             AUDIT_LOGS(TRANSFER_EXECUTED)
```

## 6.2 OTP 소진 시나리오

```
[1~N] POST /otp/verify (틀린 코드 반복)
    → attempt_count++
    → N번째: OTP_VERIFICATIONS(PENDING → EXHAUSTED)
              SECURITY_EVENTS 생성(OTP_MAX_ATTEMPTS, OPEN, HIGH)
              TRANSFER_SESSIONS(OTP_PENDING → EXPIRED)
              NOTIFICATIONS 생성(SESSION_EXPIRY, UNREAD)
```

## 6.3 세션 만료 시나리오

```
[배치/정책 스캔]
    → TRANSFER_SESSIONS WHERE status IN ('OTP_PENDING','AUTHED') AND expires_at < NOW()
    → TRANSFER_SESSIONS(OTP_PENDING|AUTHED → EXPIRED)
    → OTP_VERIFICATIONS(PENDING → EXPIRED)
    → NOTIFICATIONS 생성(SESSION_EXPIRY, UNREAD)
```

## 6.4 이체 실패 시나리오

```
[3] POST /transfers/execute
    → TRANSFER_SESSIONS(AUTHED → EXECUTING), executing_started_at 기록
    → [Core API 호출 실패]
    → TRANSFER_SESSIONS(EXECUTING → FAILED)
       failure_reason_code 저장
       NOTIFICATIONS 생성(TRANSFER_FAILED, UNREAD)
       AUDIT_LOGS(TRANSFER_FAILED)
```

## 6.5 EXECUTING timeout 복구 시나리오

```
[복구 대시보드/스케줄러]
    → TRANSFER_SESSIONS WHERE status='EXECUTING'
         AND executing_started_at < NOW()-30s
    → 채널 서비스: Core API 재조회 (transaction_uuid 또는 실패 확인)
    → 성공 확인: TRANSFER_SESSIONS(EXECUTING → COMPLETED) + 스냅샷
    → 실패/연결 단절: TRANSFER_SESSIONS(EXECUTING → FAILED, failure_reason_code='EXECUTION_TIMEOUT')
```
