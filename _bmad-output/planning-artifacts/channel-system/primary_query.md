# Primary Queries — Channel System (v1.0)

이 문서는 채널계 핵심 기능을 수행하기 위한 **표준 SQL 쿼리**를 정의한다.
Repository Layer 구현의 기준이 된다.

---

# 1) `members`

## 1.1 로그인: username으로 회원 조회
**용도**: 로그인 요청 — 자격증명 검증, 상태 확인

```sql
SELECT id, member_uuid, username, email, password_hash,
       role, status, login_fail_count, last_fail_at, locked_at,
       totp_enabled, totp_enrolled_at, deleted_at
FROM members
WHERE username = ?
  AND deleted_at IS NULL;
```
- 인덱스: `UK(username)`
- 주의: `deleted_at IS NULL` 조건 필수, `status = 'LOCKED'`이면 앱 레이어에서 차단

---

## 1.2 회원 단건 조회 (외부 노출: member_uuid)
**용도**: 내 프로필 조회, 관리자 회원 조회

```sql
SELECT id, member_uuid, username, email, name, role, status,
       totp_enabled, totp_enrolled_at, created_at, updated_at
FROM members
WHERE member_uuid = ?
  AND deleted_at IS NULL;
```
- 인덱스: `UK(member_uuid)`

---

## 1.3 로그인 실패 카운터 증가
**용도**: 로그인 실패 시 카운터 갱신

```sql
UPDATE members
SET login_fail_count = login_fail_count + 1,
    last_fail_at = NOW(6),
    updated_at  = NOW(6)
WHERE id = ?;
```

---

## 1.4 계정 잠금
**용도**: 실패 횟수 임계치 도달 시 LOCKED 상태 전이

```sql
UPDATE members
SET status            = 'LOCKED',
    locked_at         = NOW(6),
    updated_at        = NOW(6)
WHERE id = ?
  AND status = 'ACTIVE';
```

---

## 1.5 계정 잠금 해제 (Admin)
**용도**: Admin의 잠금 해제 액션

```sql
UPDATE members
SET status            = 'ACTIVE',
    login_fail_count  = 0,
    last_fail_at      = NULL,
    locked_at         = NULL,
    updated_at        = NOW(6)
WHERE id = ?
  AND status = 'LOCKED';
```

---

## 1.6 성공 로그인 시 카운터 Lazy Reset
**용도**: 로그인 성공 시 실패 카운터 초기화

```sql
UPDATE members
SET login_fail_count = 0,
    last_fail_at     = NULL,
    updated_at       = NOW(6)
WHERE id = ?
  AND login_fail_count > 0;
```

---

## 1.7 TOTP 등록
**용도**: 사용자 2단계 인증(TOTP) 최초 등록 — Vault에 시크릿 저장 후 DB는 등록 상태만 기록

```sql
-- Step 1. TOTP 활성화 (Vault 등록 성공 후)
UPDATE members
SET totp_enabled     = TRUE,
    totp_enrolled_at = NOW(6),
    updated_at       = NOW(6)
WHERE id = ?
  AND totp_enabled = FALSE
  AND deleted_at IS NULL;

-- Step 2. 감사 로그 기록 (동일 트랜잭션)
INSERT INTO audit_logs
  (audit_uuid, member_id, action, target_type, target_id,
   ip_address, user_agent, correlation_uuid, created_at)
VALUES
  (?, ?, 'TOTP_ENROLLED', 'MEMBER', ?, ?, ?, ?, NOW(6));

COMMIT;
```
- **원자성 필수**: members UPDATE + audit 삽입은 같은 트랜잭션
- Step 1 affected rows = 0 이면 롤백 (이미 등록됨 또는 탈퇴 회원)

---

## 1.8 비밀번호 변경
**용도**: 인증된 사용자 비밀번호 변경 — 변경 후 전 세션 강제 로그아웃

```sql
-- Step 1. 비밀번호 해시 변경
UPDATE members
SET password_hash = ?,
    updated_at    = NOW(6)
WHERE id = ?
  AND deleted_at IS NULL;

-- Step 2. 전체 Refresh Token 리보크 (2.5와 동일)
UPDATE refresh_tokens
SET revoked_at = NOW(6)
WHERE member_id = ?
  AND revoked_at IS NULL;

-- Step 3. 감사 로그 기록
INSERT INTO audit_logs
  (audit_uuid, member_id, action, target_type, target_id,
   ip_address, user_agent, correlation_uuid, created_at)
VALUES
  (?, ?, 'PASSWORD_CHANGED', 'MEMBER', ?, ?, ?, ?, NOW(6));

COMMIT;
```
- **Step 2 필수**: 비밀번호 변경 시 기존 세션 전체 무효화 — 탈취된 세션 차단
- 3단계 모두 같은 트랜잭션으로 커밋

## 2.1 Refresh Token 발급 (저장)
**용도**: 로그인 성공 후 Refresh Token 등록

```sql
INSERT INTO refresh_tokens
  (token_uuid, member_id, token_hash, device_info, ip_address, expires_at, created_at)
VALUES
  (?, ?, ?, ?, ?, ?, NOW(6));
```
- 제약: `UK(token_hash)` 중복 시 발급 실패

---

## 2.2 Refresh Token 검증
**용도**: Access Token 재발급 요청 시 유효성 확인

```sql
SELECT id, member_id, expires_at, revoked_at
FROM refresh_tokens
WHERE token_hash = ?
  AND revoked_at IS NULL
  AND expires_at > NOW(6);
```
- 인덱스: `UK(token_hash)`

---

## 2.3 Token Rotation — 이전 토큰 리보크 + 신규 토큰 발급 (원자적)
**용도**: Refresh Token 갱신 — 이전 토큰 무효화와 신규 토큰 삽입을 **같은 트랜잭션**에서 수행

```sql
-- Step 1. 이전 토큰 리보크
UPDATE refresh_tokens
SET revoked_at = NOW(6)
WHERE token_hash = ?
  AND revoked_at IS NULL;

-- Step 2. 신규 토큰 발급 (동일 트랜잭션)
INSERT INTO refresh_tokens
  (token_uuid, member_id, token_hash, device_info, ip_address, expires_at, created_at)
VALUES
  (?, ?, ?, ?, ?, ?, NOW(6));

COMMIT;
```
- **원자성 필수**: 두 쿼리는 반드시 같은 트랜잭션으로 커밋
- **Replay Attack 방어**: 이미 `revoked_at IS NOT NULL`인 토큰으로 갱신 요청이 오면 Token Family 전체 즉시 무효화

```sql
-- Replay Attack 감지 시: 해당 회원 전체 세션 즉시 무효화
UPDATE refresh_tokens
SET revoked_at = NOW(6)
WHERE member_id = ?
  AND revoked_at IS NULL;
-- 이후 보안 이벤트(SECURITY_EVENTS) 생성 필수
```

---

## 2.4 단일 Refresh Token 리보크 (일반 로그아웃)
**용도**: 단일 기기 로그아웃

```sql
UPDATE refresh_tokens
SET revoked_at = NOW(6)
WHERE token_hash = ?
  AND revoked_at IS NULL;
```

---

## 2.5 회원 전체 Refresh Token 리보크 (강제 로그아웃/잠금)
**용도**: 계정 잠금, 비밀번호 변경, Admin 강제 로그아웃 시 전 세션 무효화

```sql
UPDATE refresh_tokens
SET revoked_at = NOW(6)
WHERE member_id = ?
  AND revoked_at IS NULL;
```
- 인덱스: `IDX(member_id, revoked_at)`

---

## 2.6 만료 토큰 배치 삭제
**용도**: 주기적 정리 배치

```sql
DELETE FROM refresh_tokens
WHERE expires_at < (NOW(6) - INTERVAL 7 DAY)
LIMIT 1000;
```
- 인덱스: `IDX(expires_at)`
- 주의: 한 번에 대량 삭제 방지 — `LIMIT 1000` 분할 처리

---

# 3) `otp_verifications`

## 3.1 OTP 레코드 생성 (이체 세션과 1:1)
**용도**: 이체 세션 생성 시 OTP 발급 레코드 등록

```sql
INSERT INTO otp_verifications
  (otp_uuid, transfer_session_id, member_id,
   attempt_count, max_attempts, status, expires_at, created_at, updated_at)
VALUES
  (?, ?, ?, 0, ?, 'PENDING', ?, NOW(6), NOW(6));
```
- 제약: `UK(transfer_session_id)` 중복 시 삽입 실패 → 기존 세션 재사용 판단

---

## 3.2 OTP 검증: 시도 횟수 증가 + 상태 판정
**용도**: 잘못된 OTP 입력 시 시도 처리  
**중요**: Race Condition 방어를 위해 반드시 **트랜잭션 내 SELECT FOR UPDATE 선행** 후 업데이트

```sql
-- Step 1. Row 잠금으로 동시 시도 직렬화
SELECT id, attempt_count, max_attempts, status
FROM otp_verifications
WHERE transfer_session_id = ?
  AND status = 'PENDING'
  AND expires_at > NOW(6)
FOR UPDATE;

-- Step 2. 잠금 획득 후 attempt_count 증가 및 상태 전이
UPDATE otp_verifications
SET attempt_count = attempt_count + 1,
    status        = CASE
                      WHEN attempt_count + 1 >= max_attempts THEN 'EXHAUSTED'
                      ELSE 'PENDING'
                    END,
    updated_at    = NOW(6)
WHERE transfer_session_id = ?
  AND status = 'PENDING';
```
- 인덱스: `UK(transfer_session_id)`
- **원자성 보장**: 두 쿼리는 반드시 같은 트랜잭션 안에서 실행

---

## 3.3 OTP 검증 성공
**용도**: 올바른 OTP 입력 → VERIFIED 전이

```sql
UPDATE otp_verifications
SET status      = 'VERIFIED',
    verified_at = NOW(6),
    updated_at  = NOW(6)
WHERE transfer_session_id = ?
  AND status = 'PENDING'
  AND expires_at > NOW(6);
```

---

## 3.4 세션별 OTP 상태 조회
**용도**: 이체 실행 전 OTP가 검증됐는지 확인

```sql
SELECT status, attempt_count, max_attempts, expires_at, verified_at
FROM otp_verifications
WHERE transfer_session_id = ?;
```
- 인덱스: `UK(transfer_session_id)`

---

---

# 4) `transfer_sessions`

## 4.1 멱등 가드: client_request_id로 기존 세션 조회
**용도**: 중복 요청 처리 — 이미 존재하면 기존 응답 재구성

```sql
SELECT id, session_uuid, status,
       transaction_uuid, failure_reason_code,
       post_execution_balance, completed_at, expires_at
FROM transfer_sessions
WHERE client_request_id = ?;
```
- 인덱스: `UK(client_request_id)`
- **멱등 응답 정책**: `client_request_id` DB UK 충돌 시 `409 Conflict`가 아니라 **기존 세션 상태 그대로 `200 OK` 반환**
  - `COMPLETED` → `transaction_uuid` + `post_execution_balance` 스냅샷으로 재구성
  - `FAILED` → `failure_reason_code` 포함 오류 응답 재구성
  - `OTP_PENDING/AUTHED` → 현재 세션 상태 반환 (다음 단계 안내)

---

## 4.2 이체 세션 생성 (OTP_PENDING)
**용도**: 최초 이체 요청

```sql
INSERT INTO transfer_sessions (
  session_uuid, member_id, correlation_uuid, client_request_id,
  status, from_account_id, from_account_number,
  receiver_account_id, receiver_account_number, receiver_name,
  to_bank_code, amount, expires_at,
  created_at, updated_at
) VALUES (
  ?, ?, ?, ?,
  'OTP_PENDING', ?, ?,
  ?, ?, ?,
  ?, ?, ?,
  NOW(6), NOW(6)
);
```

---

## 4.3 OTP 검증 완료 → AUTHED 전이
**용도**: `OTP_VERIFICATIONS.status = VERIFIED` 확인 후 전이

```sql
UPDATE transfer_sessions
SET status     = 'AUTHED',
    updated_at = NOW(6)
WHERE id = ?
  AND status = 'OTP_PENDING'
  AND expires_at > NOW(6);
```

---

## 4.4 이체 실행 → EXECUTING 전이
**용도**: 코어 이체 API 호출 시작 시 기록  
**중요**: `executing_started_at` 기록 — timeout 판정의 독립적 기준점

```sql
UPDATE transfer_sessions
SET status               = 'EXECUTING',
    executing_started_at = NOW(6),
    updated_at           = NOW(6)
WHERE id = ?
  AND status = 'AUTHED';
```

---

## 4.5 이체 완료 → COMPLETED 확정 + 스냅샷
**용도**: 코어 성공 응답 수신 후 최종 결과 저장

```sql
UPDATE transfer_sessions
SET status                 = 'COMPLETED',
    transaction_uuid       = ?,
    post_execution_balance = ?,
    completed_at           = NOW(6),
    updated_at             = NOW(6)
WHERE id = ?
  AND status = 'EXECUTING';
```

---

## 4.6 이체 실패 → FAILED 확정
**용도**: 코어 명확한 실패 응답

```sql
UPDATE transfer_sessions
SET status              = 'FAILED',
    failure_reason_code = ?,
    fep_reference_id    = ?,  -- 타행이면 저장
    completed_at        = NOW(6),
    updated_at          = NOW(6)
WHERE id = ?
  AND status IN ('AUTHED', 'EXECUTING');
```

---

## 4.7 내 이체 내역 조회 (최신순 페이지네이션)
**용도**: "내 이체 내역" 목록 화면

```sql
SELECT session_uuid, status, amount,
       from_account_number, receiver_account_number, receiver_name,
       to_bank_code, transaction_uuid, failure_reason_code,
       post_execution_balance, completed_at, created_at
FROM transfer_sessions
WHERE member_id = ?
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
```
- 인덱스: `IDX(member_id, created_at)`

---

## 4.8 만료 세션 배치 처리
**용도**: `OTP_PENDING` 및 `AUTHED` 상태에서 만료 시각이 지난 세션 정리  
**범위 확장**: `AUTHED` 상태도 포함 — 이체 실행 없이 방치된 인증 세션도 만료 처리

```sql
-- Step 1. 만료 세션 ID 수집
SELECT id
FROM transfer_sessions
WHERE status IN ('OTP_PENDING', 'AUTHED')
  AND expires_at < NOW(6)
LIMIT 500;

-- Step 2. transfer_sessions EXPIRED 전이
UPDATE transfer_sessions
SET status       = 'EXPIRED',
    completed_at = NOW(6),
    updated_at   = NOW(6)
WHERE status IN ('OTP_PENDING', 'AUTHED')
  AND expires_at < NOW(6)
LIMIT 500;
```
- 인덱스: `IDX(status, expires_at)`

## 4.9 EXECUTING timeout 스캔 및 FAILED 처리
**용도**: `executing_started_at` 기준 timeout 초과 세션 식별 및 FAILED 처리  
**판정 기준**: `executing_started_at < NOW(6) - INTERVAL 30 SECOND` (정책 조정 가능)

```sql
-- Step 1. timeout 초과 EXECUTING 세션 스캔
SELECT id, session_uuid, fep_reference_id, executing_started_at
FROM transfer_sessions
WHERE status = 'EXECUTING'
  AND executing_started_at < (NOW(6) - INTERVAL 30 SECOND)
ORDER BY executing_started_at ASC
LIMIT 100;
```
- 인덱스: `IDX(status, executing_started_at)` (db_schema 3.4에 추가 완료)
- **처리 방침**: 채널계는 Core API 재조회로 COMPLETED/FAILED를 확정  
  → 재조회 결과에 따라 4.5(COMPLETED) 또는 4.6(FAILED) 쿼리 적용

```sql
-- Step 2. Core 재조회 결과 확인 불가(네트워크 단절 등) 시 FAILED 확정
UPDATE transfer_sessions
SET status              = 'FAILED',
    failure_reason_code = 'EXECUTION_TIMEOUT',
    completed_at        = NOW(6),
    updated_at          = NOW(6)
WHERE id = ?
  AND status = 'EXECUTING';
```

---

## 4.10 만료 세션 OTP_VERIFICATIONS 연동 EXPIRED 처리  
**용도**: 만료된 이체 세션에 연결된 OTP 레코드도 동시에 EXPIRED 전이  
**원자성**: 4.8과 같은 배치 실행에서 수행 (동일 트랜잭션 권장)

```sql
UPDATE otp_verifications ov
JOIN transfer_sessions ts ON ts.id = ov.transfer_session_id
SET ov.status     = 'EXPIRED',
    ov.updated_at = NOW(6)
WHERE ov.status IN ('PENDING')
  AND ov.expires_at < NOW(6)
  AND ts.status = 'EXPIRED'
  AND ts.updated_at >= (NOW(6) - INTERVAL 5 MINUTE);
```
- 인덱스: `IDX(status, expires_at)` (otp_verifications) + `UK(transfer_session_id)`
- JOIN 패턴 사용: `IN (SELECT ...)` 서브쿼리 대비 MySQL 쿼리 플래너가 더 안정적인 실행 계획 생성

---

## 4.11 OTP 검증 성공 → 세션 AUTHED 원자적 전이
**용도**: OTP VERIFIED + 세션 AUTHED를 **같은 트랜잭션**에서 커밋 — 부분 실패 방지  
(OTP만 VERIFIED이고 세션이 OTP_PENDING으로 남는 불일치 차단)

```sql
-- 같은 트랜잭션 내에서 순서대로 실행

-- Step 1. OTP VERIFIED 전이 (3.3과 동일)
UPDATE otp_verifications
SET status      = 'VERIFIED',
    verified_at = NOW(6),
    updated_at  = NOW(6)
WHERE transfer_session_id = ?
  AND status = 'PENDING'
  AND expires_at > NOW(6);

-- Step 2. 전이 성공 확인 후 (affected rows = 1) 세션 AUTHED 전이
UPDATE transfer_sessions
SET status     = 'AUTHED',
    updated_at = NOW(6)
WHERE id = ?
  AND status = 'OTP_PENDING'
  AND expires_at > NOW(6);

COMMIT;
```
- **원자성 필수**: 두 UPDATE는 반드시 같은 트랜잭션
- Step 1 affected rows = 0 이면 롤백 (만료/소진/이미 VERIFIED)
```

---

# 5) `notifications`

## 5.1 알림 생성
**용도**: 이체 완료/실패/세션 만료 이벤트 발생 시 생성

```sql
INSERT INTO notifications
  (notification_uuid, member_id, transfer_session_id,
   type, status, title, message, expires_at, created_at, updated_at)
VALUES
  (?, ?, ?, ?, 'UNREAD', ?, ?, ?, NOW(6), NOW(6));
```

---

## 5.2 미읽음 알림 목록 조회 (SSE 재연결 시 재발행)
**용도**: 클라이언트 재연결 시 미수신 알림 재발행

```sql
SELECT notification_uuid, type, title, message, created_at
FROM notifications
WHERE member_id   = ?
  AND status      = 'UNREAD'
  AND deleted_at IS NULL
ORDER BY created_at ASC;
```
- 인덱스: `IDX(member_id, status, created_at)`

---

## 5.3 알림 읽음 처리
**용도**: 사용자 명시적 읽음 처리

```sql
UPDATE notifications
SET status     = 'READ',
    read_at    = NOW(6),
    updated_at = NOW(6)
WHERE notification_uuid = ?
  AND member_id = ?
  AND status = 'UNREAD';
```

---

## 5.4 내 알림 목록 (최신순, 소프트 삭제 제외)
**용도**: 알림함 화면

```sql
SELECT notification_uuid, type, status, title, message,
       read_at, created_at
FROM notifications
WHERE member_id   = ?
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
```

---

## 5.5 알림 소프트 삭제
**용도**: 사용자 알림 숨기기

```sql
UPDATE notifications
SET deleted_at = NOW(6),
    updated_at = NOW(6)
WHERE notification_uuid = ?
  AND member_id = ?
  AND deleted_at IS NULL;
```

---

## 5.6 알림 보존 만료 배치 처리
**용도**: `expires_at` 초과 알림을 `EXPIRED` 상태로 전이 — 이후 배치 삭제 대상

```sql
UPDATE notifications
SET status     = 'EXPIRED',
    updated_at = NOW(6)
WHERE status IN ('UNREAD', 'READ')
  AND expires_at IS NOT NULL
  AND expires_at < NOW(6)
  AND deleted_at IS NULL
LIMIT 1000;
```
- 인덱스: `IDX(status, expires_at)`
- 주의: `deleted_at IS NOT NULL`인 알림은 이미 숨겨진 것 — 별도 정책으로 처리 가능

---

# 6) `audit_logs`

## 6.1 감사 로그 삽입 (Append-only)
**용도**: 모든 주요 행위 발생 시 — 절대 UPDATE/DELETE 없음

```sql
INSERT INTO audit_logs
  (audit_uuid, member_id, transfer_session_id,
   action, target_type, target_id,
   ip_address, user_agent, correlation_uuid, created_at)
VALUES
  (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6));
```

---

## 6.2 회원 행위 타임라인 조회
**용도**: 특정 회원의 최근 이벤트 트레일 (CS/감사)

```sql
SELECT audit_uuid, action, target_type, target_id,
       ip_address, correlation_uuid, created_at
FROM audit_logs
WHERE member_id = ?
  AND created_at >= ?  -- "오늘" 또는 기간 조건
ORDER BY created_at DESC
LIMIT 100;
```
- 인덱스: `IDX(member_id, action, created_at)`

---

## 6.3 이체 세션 전 과정 이벤트 조회
**용도**: 단건 이체의 전 과정 감사 추적

```sql
SELECT audit_uuid, action, member_id, ip_address, created_at
FROM audit_logs
WHERE transfer_session_id = ?
ORDER BY created_at ASC;
```
- 인덱스: `IDX(transfer_session_id, created_at)`

---

# 7) `security_events`

## 7.1 보안 이벤트 생성
**용도**: 자동 트리거 (계정 잠금, OTP 소진, 레이트 리밋 등) 시 생성

```sql
INSERT INTO security_events
  (security_event_uuid, event_type, status, severity,
   member_id, transfer_session_id,
   detail, ip_address, correlation_uuid,
   occurred_at, created_at, updated_at)
VALUES
  (?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, NOW(6), NOW(6), NOW(6));
```

---

## 7.2 미해결 OPEN 이벤트 조회 (Admin 대시보드)
**용도**: Admin 보안 모니터링 화면 — 높은 심각도 우선

```sql
SELECT security_event_uuid, event_type, severity,
       member_id, occurred_at, created_at
FROM security_events
WHERE status = 'OPEN'
ORDER BY
  FIELD(severity, 'CRITICAL','HIGH','MEDIUM','LOW'),
  occurred_at DESC
LIMIT 50;
```
- 인덱스: `IDX(status, severity, occurred_at)`

---

## 7.3 보안 이벤트 ACKNOWLEDGED 전이 (Admin)
**용도**: Admin이 사건 확인 처리

```sql
UPDATE security_events
SET status          = 'ACKNOWLEDGED',
    admin_member_id = ?,
    updated_at      = NOW(6)
WHERE security_event_uuid = ?
  AND status = 'OPEN';
```

---

## 7.4 보안 이벤트 RESOLVED 전이 (Admin)
**용도**: Admin이 사건 종결 처리

```sql
UPDATE security_events
SET status          = 'RESOLVED',
    admin_member_id = ?,
    resolved_at     = NOW(6),
    updated_at      = NOW(6)
WHERE security_event_uuid = ?
  AND status IN ('OPEN', 'ACKNOWLEDGED');
```

---

## 7.5 회원별 보안 이벤트 타임라인
**용도**: 특정 회원에게 발생한 보안 이벤트 이력

```sql
SELECT security_event_uuid, event_type, status, severity,
       occurred_at, resolved_at
FROM security_events
WHERE member_id = ?
ORDER BY occurred_at DESC
LIMIT 50;
```
- 인덱스: `IDX(member_id, occurred_at)`

---

# 8) 트랜잭션 흐름 요약

## 정상 이체 흐름 (채널계 책임)

```
[이체 세션 생성]
1. transfer_sessions WHERE client_request_id = ?  -- 멱등 가드
2. INSERT transfer_sessions (OTP_PENDING)
3. INSERT otp_verifications (PENDING)
4. INSERT audit_logs (TRANSFER_INITIATED)

[OTP 검증]
5. SELECT otp_verifications WHERE transfer_session_id = ? FOR UPDATE   -- (선택) 동시 시도 직렬화
6. UPDATE otp_verifications (PENDING → VERIFIED)
7. UPDATE transfer_sessions (OTP_PENDING → AUTHED)
8. INSERT audit_logs (OTP_VERIFIED)

[이체 실행]
9.  UPDATE transfer_sessions (AUTHED → EXECUTING)
10. [Core API 호출 — core_db 책임 영역]
11a. 성공: UPDATE transfer_sessions (EXECUTING → COMPLETED) + 스냅샷 저장
         INSERT notifications (TRANSFER_COMPLETED)
         INSERT audit_logs (TRANSFER_EXECUTED)
11b. 실패: UPDATE transfer_sessions (EXECUTING → FAILED)
         INSERT notifications (TRANSFER_FAILED)
         INSERT audit_logs (TRANSFER_FAILED)
```

> **불변 규칙**: 채널계는 `core_db.accounts`의 잔액을 직접 수정하지 않는다.
> 이체 결과는 Core API 응답으로 받아 `post_execution_balance`에 스냅샷으로 저장한다.
