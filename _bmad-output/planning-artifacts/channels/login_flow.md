# FIX — Login Flow Reference

> **기준**: Party Mode Round 2~3 결론 반영 (2026-02-24) / Round 4 검토 반영  
> **인증 방식**: Spring Session Redis (JSESSIONID) — JWT AT stateless 방식 폐기  
> **타협 범위**: Let's Encrypt TLS + nginx, Redis AUTH, FDS 기초 룰  
> **세션 타임아웃**: 30분 비활성 (UX 타협 — 금감원 권고 10~15분 대비 완화, MVP 단계 적용. 실 운영 시 단축 검토 필요)  
> **MVP 제약**: 단일 Redis 인스턴스 (SPOF) — P2 Sentinel 전환 예정  
> **대상 독자**: 구현 개발자, 면접관 설명용

---

## 전체 흐름 요약

```
[회원가입] ──▶ [로그인] ──▶ [세션 발급 (JSESSIONID)] ──▶ [API 호출]
                   │                                         │
            [TOTP 등록]                               [세션 비활성 30분]
        (Google Authenticator)                               │
        Secret ──▶ Vault 저장                    [SSE: "5분 후 만료 알림"]
        QR 스캔 ──▶ confirm                               ↙       ↘
                    ↓                             [연장 클릭]   [무응답/만료]
              주문 기능 해금                      세션 갱신      /login redirect
```

### JWT AT 방식과의 핵심 차이

| 항목 | 이전 (JWT AT) | 현재 (Spring Session) | 근거 |
|------|-------------|----------------------|------|
| 세션 즉각 무효화 | ❌ AT 30분 잔존 | ✅ `deleteById()` 즉시 | 전금감§34 |
| 서버 세션 통제 | ❌ 서버가 토큰 목록 없음 | ✅ Redis 완전 통제 | ISMS-P 2.5.4(b) |
| Silent Refresh | 필요 (50줄 인터셉터) | **불필요** (제거) | 구조 단순화 |
| 중복 세션 | 제어 불가 | `maximumSessions(1)` | 계정 공유 방지 |
| 세션 고정 공격 | 해당 없음 | `changeSessionId()` 자동 | 보안 강화 |
| 프론트 토큰 관리 | AT 메모리 저장 필요 | **불필요** (브라우저 자동) | 코드 단순화 |

---

## 1. 회원가입 (Story 1.1)

### 엔드포인트

```
POST /api/v1/auth/register
```

### 요청

```json
{
  "email": "user@example.com",
  "password": "Test1234!",
  "name": "홍길동"
}
```

### 처리 흐름

```
Client
  │
  ├─ POST /api/v1/auth/register
  │
  ▼
nginx (TLS 종단) → channel-service (AuthController)
  │
  ├─ Bean Validation (@Valid)
  │   ├─ email: @Email, @NotBlank
  │   └─ password: ^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$
  │         실패 → HTTP 400 (field-level error details)
  │
  ├─ 중복 email 확인 (MemberRepository)
  │   중복 → HTTP 409 { code: "MEMBER_ALREADY_EXISTS" }
  │
  ├─ BCrypt 해싱 (strength=12)
  │   member 저장 → ROLE_USER, ACTIVE
  │
  ├─ corebank-service 계좌 자동 생성
  │   POST /internal/v1/accounts (X-Internal-Secret 헤더)
  │   실패(5xx/timeout) → member rollback → HTTP 503 { code: "ACCOUNT_CREATION_FAILED" }
  │
  └─ HTTP 201 { memberId, email, name, createdAt }
      ※ 세션 발급 없음 — 로그인 후 세션 생성
```

### 보안 규칙

| 항목 | 규칙 |
|------|------|
| 비밀번호 정책 | 대문자 1+, 숫자 1+, 특수문자 1+, 최소 8자 (D-022) |
| 해싱 알고리즘 | BCrypt strength=12 (D-011) |
| 역할 부여 | 항상 `ROLE_USER` — `ROLE_ADMIN`은 DB seed 전용 |
| 내부 API | `X-Internal-Secret` 헤더 필수 (RULE-008) |

---

## 2. 로그인 (Story 1.2)

### 엔드포인트

```
POST /api/v1/auth/login
```

### 요청

```json
{
  "email": "user@example.com",
  "password": "Test1234!"
}
```

### 처리 흐름

```
Client
  │
  ├─ POST /api/v1/auth/login
  │
  ▼
nginx (Let's Encrypt TLS) → channel-service
  │
  ├─ Bucket4j Rate Limit (Redis-backed)
  │   ch:ratelimit:login:{IP} → 5 req/min 초과 → HTTP 429
  │
  ├─── FdsService.analyze(FdsContext{LOGIN_ATTEMPT, ip, userAgent})
  │   ├─ FDS-001: IP 실패 누적 (fds:ip-fail:{ip}) — 10분 내 10회 → BLOCK
  │   ├─ FDS-003: 비정상 시간대 (새벽 1~5시) → MONITOR
  │   └─ BLOCK 판정 → HTTP 403 { code: "FDS_BLOCKED" }
  │
  ├─ Spring Security UsernamePasswordAuthenticationFilter
  │   ├─ MemberDetailsService.loadUserByUsername(email)
  │   │   email 없음 → HTTP 401 { code: "INVALID_CREDENTIALS" }
  │   │                 ※ email enumeration 방지 (NFR-S2)
  │   ├─ 계정 상태 확인: LOCKED → HTTP 401 { code: "ACCOUNT_LOCKED" }
  │   ├─ BCrypt 비교 (strength=12)
  │   │   불일치 → ipLoginFailureRule.recordFailure(ip)
  │   │          → member.failedCount +1 → 5회 시 LOCKED
  │   │          → HTTP 401 { code: "INVALID_CREDENTIALS" }
  │   └─ 인증 성공
  │
  ├─ sessionFixation().changeSessionId()
  │   ※ 로그인 전 임시 세션 ID → 새 세션 ID 발급 (세션 고정 공격 방어)
  │
  ├─ Spring Session Redis 저장
  │   KEY: spring:session:sessions:{sessionId}
  │   TTL: 30분 (슬라이딩 — 요청마다 갱신)
  │   VALUE (JSON): { memberId, email, roles, loginAt }
  │
  ├─ deviceFingerprintRule.updateKnownDevice(memberId, userAgent)
  │
  └─ HTTP 200
      Response body: { memberId, email, name }
      ※ tokenType / accessToken / expiresIn 없음
      Set-Cookie: JSESSIONID={sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/
```

### 성공 응답

```json
{
  "memberId": 1,
  "email": "user@fix.com",
  "name": "홍길동"
}
```

### 에러 응답 일람

| 시나리오 | HTTP | code |
|---------|------|------|
| 비밀번호 불일치 | 401 | `INVALID_CREDENTIALS` |
| 존재하지 않는 email | 401 | `INVALID_CREDENTIALS` |
| 계정 잠금 | 401 | `ACCOUNT_LOCKED` |
| IP Rate Limit 초과 | 429 | — |
| FDS 차단 | 403 | `FDS_BLOCKED` |

> **[S8] 비밀번호 재설정**: MVP 범위 외 — 이메일 인증 기반 비밀번호 재설정 플로우는 Epic N(미지정) 예정. 현재 잠금 해제는 관리자 전용.

### Spring Session 설정 (`SecurityConfig`)

```java
@Configuration
@EnableRedisHttpSession(maxInactiveIntervalInSeconds = 1800)
public class SessionConfig {

    // Java 기본 직렬화 대신 JSON 직렬화 — Redis 가독성 + 타입 안전성
    @Bean
    public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
        return new GenericJackson2JsonRedisSerializer();
    }

    // ⚠️ [W1] 다중 인스턴스 환경에서 maximumSessions(1) 동작하려면
    // SessionRegistryImpl(in-memory) 대신 SpringSessionBackedSessionRegistry 필수
    // [A8] FindByIndexNameSessionRepository<?> 실제 주입 타입: RedisIndexedSessionRepository
    //      (Spring Session Redis에서 유일하게 이 인터페이스를 구현하는 클래스)
    @Bean
    public SpringSessionBackedSessionRegistry<?> sessionRegistry(
            FindByIndexNameSessionRepository<?> sessionRepository) {
        return new SpringSessionBackedSessionRegistry<>(sessionRepository);
    }
}

// SecurityConfig.java
// [A5] SecurityConfig 전체 구조 — @EnableWebSecurity는 SecurityConfig에만 위치 (SessionConfig에 없음)
// [A6] @EnableRedisHttpSession은 SessionConfig에 위치, @EnableWebSecurity는 SecurityConfig에만 위치
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    // [A1] SessionConfig Bean 직접 메서드 호출 금지 — @Autowired 필드 주입으로 Spring 프록시 보장
    // [A10] 실제 새 코드에서는 @RequiredArgsConstructor + final 필드로 생성자 주입 권장
    //       필드 주입은 간결성을 위한 예시 용도 (Mock 주입 용이성 + 순환의존 컴파일 시점 탐지 목적)
    @Autowired
    private SpringSessionBackedSessionRegistry<?> sessionRegistry;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http.sessionManagement(s -> s
            .sessionCreationPolicy(IF_REQUIRED)
            .sessionFixation().changeSessionId()         // 세션 고정 방어 (로그인 시 새 ID)
            .maximumSessions(1)                          // 중복 로그인 → 이전 세션 kick-out
            .sessionRegistry(sessionRegistry)            // Redis 기반 — @Autowired 주입 (직접 메서드 호출 X)
            .maxSessionsPreventsLogin(false)             // 새 로그인 허용, 이전 세션 만료
            // ⚠️ [MA2] MVP 1기기 제한 정책 — PM 승인 필요. 실 운영 시 멀티 기기(최대 N개) 정책 재검토 예정
            // 현재: PC 로그인 중 모바일 로그인 → PC 세션 강제 만료 (사용자 약관 고지 필요)
            .expiredSessionStrategy(event -> {           // [S2] kick-out 시 명시적 메시지 반환
                event.getResponse().setStatus(401);
                event.getResponse().setContentType("application/json");   // [Q3] Content-Type 명시
                event.getResponse().setCharacterEncoding("UTF-8");
                event.getResponse().getWriter().write(
                    "{\"code\":\"SESSION_EXPIRED_BY_NEW_LOGIN\",\"message\":\"다른 기기에서 로그인하여 세션이 종료되었습니다.\"}");
            })
        );
        return http.build();  // [A7] filterChain() 메서드 반환 — 누락 시 컴파일 오류
    }
}
```

> **⚠️ MVP 제약 (W3)**: 현재 단일 Redis 인스턴스 구성. Redis 장애 시 전체 인증 불가. P2에서 Redis Sentinel 도입 예정.

> **[M1] 세션 고정 방어 검증 시나리오 (OWASP A07)**:
> ```gherkin
> Scenario: 로그인 후 JSESSIONID 교체 확인
>   Given  GET /api/v1/auth/csrf 호출 → 임시 세션 쿠키 JSESSIONID=A 발급
>   When   POST /api/v1/auth/login 성공 (changeSessionId() 실행)
>   Then   응답 Set-Cookie의 JSESSIONID != A  ← 새 ID 발급 확인 (세션 고정 방어)
>   And    구 JSESSIONID=A로 API 호출 시 401 반환
> ```

> **[Q7] 중복 로그인 kick-out 검증 시나리오**:
> ```gherkin
> Scenario: 동일 계정 재로그인 시 기존 세션 강제 만료
>   Given  세션 A로 로그인 완료
>   When   동일 계정으로 새 세션 B 로그인
>   Then   세션 A로 GET /api/v1/accounts 요청 시
>          HTTP 401 + code="SESSION_EXPIRED_BY_NEW_LOGIN" 반환
>   And    세션 B는 정상 동작
> ```

---

## 3. 보호된 API 호출 (Spring Session 자동 처리)

```
Client
  │
  ├─ GET /api/v1/accounts
  │   Cookie: JSESSIONID={sessionId}  ← 브라우저 자동 첨부 (코드 없음)
  │
  ▼
nginx → channel-service
  │
  ├─ HttpSessionSecurityContextRepository (Spring Security 내장)
  │   ├─ JSESSIONID 쿠키 추출
  │   ├─ Redis 조회: spring:session:sessions:{sessionId}
  │   │   세션 없음 (만료/로그아웃) → HTTP 401 { code: "UNAUTHORIZED" }
  │   ├─ maxInactiveInterval 슬라이딩 갱신 (요청마다 TTL 30분 재설정)
  │   └─ SecurityContext에 MemberDetails 등록
  │
  └─ Controller 처리 → 응답 반환
```

> **JwtAuthenticationFilter 완전 삭제** — Spring Session이 모든 세션 검증 처리.

### SecurityConfig permitAll 경로

```
/api/v1/auth/login              ← 인증 불필요
/api/v1/auth/register           ← 인증 불필요
/api/v1/auth/csrf               ← CSRF 토큰 조회 (인증 전 필요)
/api/v1/notifications/sse/**    ← SSE 연결 (세션 만료 알림) — [S6] 인증 필요 엔드포인트 (세션 없으면 SSE 불필요)
/swagger-ui/**                  ← 개발 편의
/v3/api-docs/**                 ← 개발 편의
/actuator/health                ← 헬스체크
/actuator/circuitbreakers       ← CB 상태 조회
```

> **[S6] SSE 엔드포인트**: `permitAll` 하지 않음 — 미인증 요청은 401 반환, 프론트엔드는 로그인 성공 후에만 SSE 연결 시도.

> `/api/v1/auth/refresh` **삭제됨** — Silent Refresh 흐름 자체가 없으므로 해당 엔드포인트 불필요.

---

## 4. 세션 만료 알림 (Story 1.7 — Silent Refresh 대체, SSE)

JWT Silent Refresh는 **완전히 제거**됩니다. 대신 SSE(Server-Sent Events)로 만료 5분 전에 사용자에게 알림을 보내는 방식을 채택합니다.

### 서버 측 — 세션 만료 5분 전 SSE 푸시

```java
// NotificationService.java
// ⚠️ [A2] findAll() 대신 Redis Keyspace Notification 사용
// findAll()은 SCAN으로 전체 key 순회 → 세션 수 증가 시 Redis 블로킹 위험
// Redis 설정 필요: notify-keyspace-events = "Ex" (만료 이벤트 활성화)
@Component
public class SessionExpiryListener implements MessageListener {

    // Redis expired 이벤트 구독: __keyevent@0__:expired
    @Override
    public void onMessage(Message message, byte[] pattern) {
        String expiredKey = message.toString();
        if (expiredKey.startsWith("spring:session:sessions:")) {
            // [D4] 의존 방향: SessionExpiryListener → NotificationService.closeConnection(sessionId)
            // SessionExpiryListener가 NotificationService를 @Autowired받아 SSE 종료 호출
            // (역방향 의존 금지 — NotificationService가 Listener를 알면 순환 의존)
            //
            // [D5] extractMemberId() 직접 구현 불가 — 만료된 세션은 이미 Redis에서 삭제되어 findById() 불가
            // 해결책: sessionId 기준으로 activeSseConnections에서 역조회하거나,
            //         세션 저장 시 별도 매핑 키(ch:session-member:{sessionId} → memberId, TTL 30분+여유) 유지
            // 내부에서 activeSseConnections.get(sessionId) → sseEmitter.complete() 호출
            // [D6] complete() 사용 — 정상 만료이므로 completeWithError() 아닌 complete() 사용
            //     complete() 수신 시 EventSource는 재연결 시도 안 함 (만료 후 재연결 방지)
            String sessionId = expiredKey.replace("spring:session:sessions:", "");
            notificationService.closeBySessionId(sessionId); // sseEmitter.complete() 내부 호출
        }
    }
}

// [A4] SessionExpiryListener를 Redis pub/sub 채널에 등록 — 이 Bean이 없으면 onMessage() 호출 안 됨
@Bean
public RedisMessageListenerContainer redisContainer(RedisConnectionFactory factory,
        SessionExpiryListener sessionExpiryListener) {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(factory);
    container.addMessageListener(sessionExpiryListener,
        // [Q6] PatternTopic: 모든 DB의 expired 이벤트 수신 (멀티 DB 대비)
        // 단일 DB 환경이라면 ChannelTopic("__keyevent@0__:expired") 대체 가능
        new PatternTopic("__keyevent@*__:expired"));
    return container;
}

// 만료 5분 전 경고: principal 인덱스 기반 조회 (SCAN 없음)
@Scheduled(fixedDelay = 60_000)
public void checkSessionExpiry() {
    // [D1/D7] sessionId를 키로 사용 — closeBySessionId()와 키 타입 통일
    // private final ConcurrentHashMap<String, SseEmitter> activeSseConnections = new ConcurrentHashMap<>();
    // private final ConcurrentHashMap<String, Long> sessionToMember = new ConcurrentHashMap<>();
    //
    // [A9] 두 맵 생명주기 반드시 함께 관리 (메모리 누수 방지):
    //   SSE 연결 등록 시: activeSseConnections.put(sessionId, emitter)
    //                    sessionToMember.put(sessionId, memberId)
    //   SSE 연결 해제 시: activeSseConnections.remove(sessionId)
    //                    sessionToMember.remove(sessionId)
    //   세션 만료(onMessage) closeBySessionId() 내부에서도 두 맵 모두 remove(sessionId)
    activeSseConnections.forEach((sessionId, sseEmitter) -> {
        Long memberId = sessionToMember.get(sessionId);
        if (memberId == null) return;
        sessionRepository.findByPrincipalName(memberId.toString())
            .values().forEach(session -> {
                long remainingSecs = session.getMaxInactiveInterval().getSeconds()
                    - Duration.between(session.getLastAccessedTime(), Instant.now()).getSeconds();
                if (remainingSecs > 0 && remainingSecs <= 300) {
                    notificationService.push(sessionId, new SessionExpiryEvent(remainingSecs));
                } else if (remainingSecs <= 0) {
                    // [D9] 세션이 이미 만료된 경우 stale emitter 정리
                    // Redis evict 늘섬 시 race condition 안전망
                    notificationService.closeBySessionId(sessionId);
                }
            });
    });
}
```

```yaml
# redis.conf or docker command — Keyspace Notification 활성화 필수
notify-keyspace-events: "Ex"
```

### 프론트엔드 측 — 단순 401 핸들러 (`src/lib/axios.ts`)

```typescript
// Silent Refresh 50줄 → 10줄로 단순화
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const code = error.response.data?.code;
      if (code === 'SESSION_EXPIRED_BY_NEW_LOGIN') {
        showToast('다른 기기에서 로그인하여 세션이 종료되었습니다.');
      } else {
        showToast('세션이 만료되었습니다. 다시 로그인해주세요.');
      }
      // [Q11] 위 코드 분기는 단위 테스트 필수:
      //   테스트 1: code=SESSION_EXPIRED_BY_NEW_LOGIN → 기기 교체 메시지
      //   테스트 2: code=undefined(일반 만료) → 기본 만료 메시지
      //   vi.mock('react-router-dom', ...) + vi.mock('../stores/authStore', ...)
      authStore.clearMember();
      navigate('/login');
    }
    return Promise.reject(error);
  }
);
// withCredentials: true → JSESSIONID 자동 전송 (변경 없음)
```

### SSE 세션 만료 경고 UX

```
[SSE 이벤트: session-expiry { remainingSeconds: 300 }]
      │
      ▼
[토스트 알림] "5분 후 자동 로그아웃됩니다."
  ├── [계속 사용] 클릭 → GET /api/v1/auth/session (빈 API 호출)
  │                     → Spring Session TTL 30분 재갱신
  └── [무응답 5분] → 세션 만료 → 다음 API 요청 시 401 → /login redirect

[SSE 연결 끊김 시 — fallback]
  클라이언트 자체 타이머 (마지막 활동 기준 25분 후 경고 표시)
  → EventSource 재연결 시도 3회 (backoff 5s, 10s, 30s)
  → 모두 실패 시 클라이언트 타이머로 만료 처리
```

> **금융 앱 UX 관점**: 토스·카카오뱅크 등 실제 금융 앱은 Silent Refresh 대신 명시적 재인증을 유도합니다. 사용자가 세션 만료를 인지하는 것이 보안 신뢰감을 높입니다.

> **[S2] 다른 기기에서 kick-out 시**: 서버는 `expiredSessionStrategy`에서 `SESSION_EXPIRED_BY_NEW_LOGIN` 코드 반환 → 클라이언트 401 핸들러에서 코드 분기하여 "다른 기기에서 로그인하여 세션이 종료되었습니다." 토스트 표시 후 /login redirect.

---

## 5. 로그아웃 (Story 1.3)

```
POST /api/v1/auth/logout
Cookie: JSESSIONID={sessionId}  ← 브라우저 자동 첨부
  │
  ▼
channel-service
  │
  ├─ SecurityContextHolder.clearContext()
  ├─ HttpSession.invalidate()  → Redis KEY 즉시 삭제 (Spring Session)
  │   spring:session:sessions:{sessionId} 삭제
  ├─ Set-Cookie: JSESSIONID=; Max-Age=0; Path=/  (쿠키 즉시 만료)
  └─ HTTP 204
```

> **로그아웃 후 동일 JSESSIONID 재사용**: Redis key 없음 → Spring Session 조회 실패 → HTTP 401 즉시 (JWT AT 방식과 달리 30분 대기 없음)

---

## 6. 계정 잠금 (Story 1.2 — Sub-scenario: 계정 잠금)

```
동일 email 5회 연속 로그인 실패
  │
  ├─ member.failedLoginCount >= 5
  │   → member.status = LOCKED
  │   → HTTP 401 { code: "ACCOUNT_LOCKED" }
  │   → security_events INSERT (ACCOUNT_LOCKED 이벤트)
  │
  └─ FDS-001 카운터도 증가 (fds:ip-fail:{ip})

잠금 해제: 관리자 전용 (Epic 6 — AdminController, Story 6.N 별도 스프린트)
  POST /api/v1/admin/members/{memberId}/unlock
  → member.status = ACTIVE, failedLoginCount = 0
  → security_events INSERT (ACCOUNT_UNLOCKED, adminId 포함)
```

---

## 7. 프론트엔드 인증 상태 관리 (Story 1.7)

### 세션 저장 방식 — 토큰 관리 코드 전면 제거

| 방식 | 허용 여부 | 이유 |
|------|----------|------|
| `JSESSIONID` (HttpOnly Cookie) | ✅ 허용 | 브라우저 자동 관리, JS 접근 불가 |
| `localStorage` | ❌ 금지 | XSS 취약 (NFR-S1) |
| `sessionStorage` | ❌ 금지 | XSS 취약 (NFR-S1) |
| AT 메모리 변수 | **삭제됨** | Spring Session으로 불필요 |

### AuthContext 구조 (단순화)

```typescript
// 이전: accessToken + member 관리 (복잡)
// 현재: member 정보만 관리 (단순)
interface AuthState {
  member: MemberInfo | null;  // 로그인 여부 = member !== null
  isAuthenticated: boolean;
}

// 로그인 성공 시: response body { memberId, email, name } → store에 저장
// JSESSIONID: 브라우저가 자동으로 모든 요청에 첨부 (코드 0줄)

// 보호된 라우트
<PrivateRoute>   → member === null 이면 /login redirect
<NavBar>         → 로그인 사용자 정보 표시 + 로그아웃 버튼
```

### axios 전역 설정

```typescript
// src/lib/axios.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,  // JSESSIONID + CSRF 쿠키 자동 전송
});
// Authorization 헤더 설정 코드 없음 — 쿠키가 자동 처리
```

### 라우팅

```
/login            ← 인증 불필요 (LoginPage)
/register         ← 인증 불필요 (RegisterPage)
/ (Dashboard)     ← PrivateRoute 보호
/orders          ← PrivateRoute 보호
/settings/totp/*  ← PrivateRoute 보호 (TOTP 등록)
```

---

## 8. 쿠키 보안 설정

| 속성 | 값 | 효과 |
|------|-----|------|
| `HttpOnly` | true | JavaScript에서 `document.cookie` 접근 불가 — XSS 방어 |
| `Secure` | true | HTTPS 전송만 허용 (Let's Encrypt TLS 필수) |
| `SameSite` | Strict (로컬) / None; Secure (배포 cross-origin) | CSRF 1차 방어 |
| `Path` | `/` | 모든 경로에 JSESSIONID 첨부 (RT와 달리 경로 제한 없음) |
| `Max-Age` | 미설정 → 브라우저 세션 쿠키 | 탭 닫으면 쿠키 삭제 |

```yaml
# application-local.yml
server.servlet.session.cookie.same-site: strict
server.servlet.session.cookie.http-only: true
server.servlet.session.cookie.secure: false  # 로컬 HTTP

# application-deploy.yml
server.servlet.session.cookie.same-site: none
server.servlet.session.cookie.secure: true   # HTTPS 필수
```

---

## 9. CSRF 방어

```
Synchronizer Token 패턴 (HttpSessionCsrfTokenRepository):
  1. 서버가 세션에 CSRF 토큰 저장
  2. GET /api/v1/auth/csrf → { token } 응답 (세션 쿠키 발급 전 프론트 요청)
  3. React Axios 인터셉터가 X-CSRF-TOKEN 헤더에 토큰 첨부
  4. 서버가 세션의 토큰 == 헤더 값 검증
  5. 외부 사이트는 서버 세션에 접근 불가 → 위조 불가

적용 대상: 모든 non-GET 요청 (POST, PUT, PATCH, DELETE)
구현체: HttpSessionCsrfTokenRepository (세션 연동 — Double-Submit Cookie보다 강력)
```

```java
// SecurityConfig
http.csrf(csrf -> csrf
    .csrfTokenRepository(new HttpSessionCsrfTokenRepository())
    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
);
```

> **⚠️ [W2] CSRF + sessionFixation 주의**: 로그인 전 `GET /api/v1/auth/csrf` 호출 시 임시 세션이 생성됩니다. 로그인 성공 후 `changeSessionId()`가 세션 ID를 교체하면 Spring Security는 CSRF 토큰도 새 세션에 자동 연결합니다. 단, 프론트엔드는 **로그인 성공 후 CSRF 토큰을 재조회**해야 합니다 — 로그인 응답 후 `GET /api/v1/auth/csrf` 재호출 또는 로그인 응답 body에 새 CSRF 토큰 포함.

---

## 10. 시퀀스 다이어그램

### 최초 로그인

```
Browser     nginx(TLS)    channel-service      Redis          corebank
   │             │                │               │               │
   │ POST /login │                │               │               │
   │────────────▶│                │               │               │
   │             │ (TLS 종단)      │               │               │
   │             │───────────────▶│               │               │
   │             │                │ Rate Limit    │               │
   │             │                │────────────▶  │               │
   │             │                │◀────OK──────  │               │
   │             │                │ FDS 분석      │               │
   │             │                │ BCrypt 검증    │               │
   │             │                │ changeSessionId()             │
   │             │                │ SET spring:session:{id}       │
   │             │                │────────────▶  │               │
   │             │                │◀────OK──────  │               │
   │◀────────────│◀───────────────│               │               │
   │  200 { memberId, email, name }               │               │
   │  Set-Cookie: JSESSIONID=...; HttpOnly        │               │
```

### 세션 만료 경고 (SSE)

```
Browser          channel-service       Redis
   │  [SSE 연결 중]      │                │
   │                    │ 매분 세션 TTL 체크
   │                    │────────────────▶│
   │                    │◀── TTL 300초 이하
   │                    │                │
   │◀── SSE: session-expiry { remainingSeconds: 300 }
   │                    │                │
   │ [토스트: "5분 후 자동 로그아웃"]      │
   │ ["계속 사용" 클릭]  │                │
   │                    │                │
   │ GET /api/v1/auth/session             │
   │────────────────────▶│               │
   │                    │ SET TTL=30분   │
   │                    │────────────────▶│
   │◀── 200 (세션 갱신 완료)              │
```

### 로그아웃

```
Browser          channel-service       Redis
   │                    │                │
   │ POST /auth/logout  │                │
   │ Cookie: JSESSIONID │                │
   │────────────────────▶│               │
   │                    │ session.invalidate()
   │                    │ DEL spring:session:sessions:{id}
   │                    │────────────────▶│
   │                    │◀────OK──────── │
   │◀── 204             │                │
   │  Set-Cookie: JSESSIONID=; Max-Age=0 │
   │                    │                │
   │ GET /api/accounts  │                │  ← 로그아웃 후 재시도
   │────────────────────▶│               │
   │                    │ Redis 조회 → 없음
   │◀── 401 { code: "UNAUTHORIZED" }     │  ← 즉시 (30분 대기 없음)
```

### Admin 강제 로그아웃

```java
// AdminController.java
@DeleteMapping("/members/{memberId}/sessions")
public ResponseEntity<Void> forceLogout(@PathVariable Long memberId) {
    // Spring Session이 principal 인덱스 자동 관리
    Map<String, MapSession> sessions = sessionRepository
        .findByPrincipalName(memberId.toString());
    sessions.keySet().forEach(sessionRepository::deleteById);  // 1줄로 해결

    securityEventService.record(FORCED_LOGOUT, memberId, adminId);
    return ResponseEntity.noContent().build();
}
// 이전 JWT 방식: Redis SCAN + bulk delete (복잡) → 1줄로 단순화
```

---

## 11. 환경 변수

| 변수 | 설명 | 예시 |
|------|------|------|
| `REDIS_PASSWORD` | Redis AUTH 비밀번호 **(필수 — RULE-079)** | `STRONG_REDIS_PASS_HERE` |
| `SESSION_COOKIE_SECURE` | 로컬 false / 배포 true | `true` |
| `VITE_API_BASE_URL` | 프론트엔드 API 베이스 URL | `https://fix-api.example.com` |
| `VAULT_ADDR` | HashiCorp Vault 서버 주소 | `http://vault:8200` |
| `VAULT_TOKEN` | Vault Root/AppRole Token (dev) | `dev-root-token` |
| `VAULT_ROLE_ID` | AppRole RoleID (prod) | `<uuid>` |
| `VAULT_SECRET_ID` | AppRole SecretID (prod) | `<uuid>` |
| `INTERNAL_API_SECRET` | 서비스 간 X-Internal-Secret | `CHANGE_ME_INTERNAL_SECRET` |

> **JWT_SECRET 완전 제거** — Spring Session Redis로 전환 후 불필요  
> **REDIS_PASSWORD 공백 시**: 애플리케이션 시작 실패 (startup validation — RULE-079)  
> **Vault 연결 실패 시 (TOTP verify 경로)**: TOTP 검증 불가 → HTTP 503. 세션 자체는 Vault 무관 (독립 경로)

---

## 12. 관련 Redis 키

| Key 패턴 | TTL | 용도 |
|----------|-----|------|
| `spring:session:sessions:{sessionId}` | 30분 (슬라이딩) | Spring Session 저장소 (주요 인증 상태) |
| `spring:session:index:...:{memberId}` | 30분 | Principal 인덱스 (Admin 강제 로그아웃용) |
| `ch:ratelimit:login:{IP}` | Bucket4j 관리 | 로그인 IP Rate Limit |
| `ch:totp-used:{memberId}:{w}:{code}` | 60초 | TOTP Replay Guard |
| `fds:ip-fail:{ip}` | 10분 | FDS-001: IP별 로그인 실패 누적 |
| `fds:device:{memberId}` | 30일 | FDS-002: 알려진 디바이스 지문 |
| `fds:order-velocity:{memberId}` | 10분 | FDS-005: 단시간 주문 횟수 |

> **삭제된 키**: `rt:{memberId}:{tokenUUID}` (RT), `session:{jti}` (AT Blacklist) — JWT 방식 폐기로 불필요

### Redis 보안 설정 (RULE-079)

```yaml
# docker-compose.yml
redis:
  image: redis:7-alpine
  command: >
    --requirepass ${REDIS_PASSWORD}
    --save 60 1
    --appendonly yes
    --notify-keyspace-events Ex   # [A2] 세션 만료 이벤트 활성화 (SSE용)
  volumes:
    - redis-data:/data

# application-local.yml
spring:
  data:
    redis:
      password: ${REDIS_PASSWORD}

# application-deploy.yml — [M4] 배포 환경 TLS 필수 (password 평문 전송 방지)
spring:
  data:
    redis:
      password: ${REDIS_PASSWORD}
      ssl:
        enabled: true   # ⚠️ 배포 시 필수 — 주석 아님
```

> **감사로그 보존 정책 (MA3)**: `security_events` 테이블은 전자금융거래법 제22조에 따라 **5년 보존** 의무. 배포 시 DB 아카이빙 정책(파티셔닝 or cold storage) 별도 설계 필요.

---

## 13. TOTP 등록 플로우 (Story 1.8)

> **목적**: 주문 기능 사용 전 선제조건. 로그인 직후 `/settings/totp/enroll`로 유도.

### [MA4/S3] TOTP 미등록 시 기능 제한 범위

| 기능 | TOTP 미등록 | TOTP 등록 완료 |
|------|------------|---------------|
| 로그인 · 세션 발급 | ✅ 가능 | ✅ 가능 |
| 잔액 조회 · 주문 내역 | ✅ 가능 | ✅ 가능 |
| 계좌 설정 변경 | ✅ 가능 | ✅ 가능 |
| **주문 시도** | ❌ `AUTH-009` 403 + `enrollUrl` 반환 | ✅ 가능 (step-up TOTP) |

> `/settings/totp/enroll` 유도는 **서버 강제 redirect가 아닌 UI 배너 + 403 응답의 `enrollUrl` 필드**로 처리.
> 신규 가입자는 Dashboard 진입 가능, 주문 시도 시점에 자연스럽게 TOTP 등록 흐름으로 안내.

> **[S4] enroll 이탈 처리**: `POST /totp/enroll`은 idempotent — 기존 미확인 Secret을 덮어쓰기 허용 (`totp_enabled=false` 상태에서 재호출 가능). `confirm` 없이 이탈해도 다음 `enroll` 호출로 재시도 가능.

> **[MA6] enroll 호출 인증 수준**: 현재 유효 세션(JSESSIONID)만으로 enroll 허용 — **비밀번호 재확인 없음** (MVP 결정). 세션 탈취 시 TOTP 교체 위협이 존재하나, 세션 탈취 자체가 선제 조건이므로 MVP 범위에서 허용. 보안 강화 시 enroll 전 비밀번호 step-up 인증 추가 권고.

### 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/v1/members/me/totp/enroll` | Secret 생성 + Vault 저장 + QR URI 반환 |
| `POST` | `/api/v1/members/me/totp/confirm` | 첫 코드 제출로 등록 확정 |
| `GET` | `/api/v1/members/me/totp/status` | 등록 여부 및 enrolledAt 조회 |
| `DELETE` | `/api/v1/members/me/totp` | 비밀번호 확인 후 등록 초기화 |

> **[MA7] `DELETE /totp` 요청 형식**: `{ "password": "현재 비밀번호" }` Request Body 포함. 서버에서 `BCrypt.matches()` 검증 후 Vault Secret 삭제 + `totp_enabled=false`. 비밀번호 불일치 시 `HTTP 401 { code: "INVALID_CREDENTIALS" }` 반환.

### 등록 흐름

```
Browser                channel-service                  Vault
   │                         │                             │
   │ POST /totp/enroll        │                             │
   │ Cookie: JSESSIONID={id} │                             │
   │────────────────────────▶│                             │
   │                         │ Spring Session 검증          │
   │                         │ (세션 유효 → 인증 통과)       │
   │                         │                             │
   │                         │ GoogleAuthenticator         │
   │                         │ .generateSecretKey()        │
   │                         │ (Base32 encoded)            │
   │                         │                             │
   │                         │ PUT secret/fix/member/      │
   │                         │   {memberId}/totp-secret    │
   │                         │────────────────────────────▶│
   │                         │◀────────── 200 OK ──────────│
   │                         │                             │
   │◀── 200 { qrUri, expiresAt } ────────────────────────  │
   │    otpauth://totp/FIX:{email}?secret={base32}&issuer=FIX
   │    ※ expiresAt: [MA8] UI 힌트 전용 ("N분 내 QR 스캔하세요" 표시용)
   │         서버는 자동 폐기 안 함 — idempotent 재호출로 덮어쓰기 가능 (S4)
   │                         │                             │
   │ [사용자: Google Authenticator 앱에서 QR 스캔]        │
   │                         │                             │
   │ POST /totp/confirm       │                             │
   │ Cookie: JSESSIONID={id} │                             │
   │ { totpCode: "123456" }  │                             │
   │────────────────────────▶│                             │
   │                         │ GET secret/fix/member/      │
   │                         │   {memberId}/totp-secret    │
   │                         │────────────────────────────▶│
   │                         │◀──── { secret: "..." } ─────│
   │                         │                             │
   │                         │ RFC 6238 TOTP 검증 (±1 윈도우)
   │                         │ 성공 → totp_enabled=true    │
   │◀──────── 200 { message: "Google OTP 등록이 완료되었습니다." }
   │                         │                             │
   │ [S7] confirm 성공 후 프론트엔드 navigate 처리:        │
   │   주문 AUTH-009에서 유도된 경우 → navigate(-1) 이전 페이지(주문 화면)
   │   직접 등록(/settings/totp/enroll) 진입 경우 → navigate('/') Dashboard
   │   + "Google OTP 등록이 완료되었습니다." 토스트 표시
```

### 에러 응답

| 시나리오 | HTTP | code |
|---------|------|------|
| 코드 불일치 | 401 | `AUTH-010` |
| 이미 등록됨 (`totp_enabled=true` 상태에서 enroll 재호출) | 409 | — |
| TOTP 미등록 상태에서 주문 시도 | 403 | `AUTH-009` + `"enrollUrl": "/settings/totp/enroll"` |

> **[S5] `enrollUrl` 형식**: React Router 상대 경로 (`"/settings/totp/enroll"`) — 프론트엔드는 `navigate(error.response.data.enrollUrl)` 처리
>
> **[MA5] enroll idempotent 재호출 보안**: `totp_enabled=false` 상태에서만 덮어쓰기 허용 — **추가 비밀번호 재확인 없음** (이미 유효한 세션 인증 상태이므로). `totp_enabled=true` 상태에서 재등록(초기화)은 `DELETE /totp` (비밀번호 확인 필수) → 재등록 순서 강제.

### DB 변경 (Flyway)

```sql
ALTER TABLE member ADD COLUMN totp_enabled     BOOLEAN   NOT NULL DEFAULT FALSE;
ALTER TABLE member ADD COLUMN totp_enrolled_at TIMESTAMP NULL;
```

---

## 14. Vault 보안 비밀 관리

### 개요

| 항목 | 값 |
|------|----|
| 라이브러리 | `org.springframework.vault:spring-vault-core` |
| TOTP 인증 라이브러리 | `com.warrenstrange:googleauth:1.5.0` |
| KV 마운트 | `secret/` (KV v2) |
| Secret 경로 패턴 | `secret/fix/member/{memberId}/totp-secret` |
| 저장 금지 위치 | DB, Redis (RULE-020 — FR-TOTP-04) |

### Vault KV 조작 시나리오

| 동작 | Vault API (HTTP) | 발생 시점 |
|------|------------------|-----------|
| Secret 저장 | `PUT /v1/secret/fix/member/{memberId}/totp-secret` | `POST /totp/enroll` |
| Secret 조회 | `GET /v1/secret/fix/member/{memberId}/totp-secret` | `POST /totp/confirm` + `POST /api/v1/orders/sessions/{sessionId}/otp/verify` |
| Secret 삭제 | `DELETE /v1/secret/fix/member/{memberId}/totp-secret` | `DELETE /totp` |

### OtpService 인터페이스

```java
public interface OtpService {
    TotpEnrollResult generateSecret(Long memberId);              // enroll: Vault PUT
    boolean confirmEnrollment(Long memberId, String code);       // confirm: Vault GET + 검증
    OtpVerifyResult verify(String sessionId,                     // 주문 step-up: Vault GET + RFC 6238
                           String code, Long memberId);
}
```

> **RULE-021**: `TotpOtpService` 생성자에 `Clock clock` 주입 필수 — production은 `Clock.systemUTC()`, 테스트는 `Clock.fixed(Instant, ZoneOffset)` 사용 (재전송 방지 윈도우 결정론적 테스트)

> **[Q10] Clock.fixed() 윈도우 경계 테스트 예시**:
> ```java
> // 윈도우 내 마지막 초 (t=29s): 현재 코드 유효
> Clock atWindowEnd = Clock.fixed(Instant.ofEpochSecond(1700000029L), ZoneOffset.UTC);
> // 다음 윈도우 첫 초 (t=30s): 새 코드 필요, 이전 코드 ❌ (±1 윈도우 제외 시)
> Clock atNextWindow = Clock.fixed(Instant.ofEpochSecond(1700000030L), ZoneOffset.UTC);
> // → 두 Clock 각각 주입하여 윈도우 경계 동작 검증
> ```

### 테스트 전략 (WireMock Vault + EmbeddedRedis)

> **[Q4] Keyspace Notification 테스트 환경 설정**: EmbeddedRedis(e.g. `it.ozimov:embedded-redis`)는 기본적으로 Keyspace Notification 비활성. 통합 테스트 시 `@BeforeAll`에서 `CONFIG SET notify-keyspace-events Ex` 명령 실행 필요:
> ```java
> @BeforeAll
> static void enableKeyspaceNotifications(@Autowired RedisTemplate<?, ?> redisTemplate) {
>     redisTemplate.getConnectionFactory().getConnection()
>         .serverCommands().setConfig("notify-keyspace-events", "Ex");
> }
> ```

### 테스트 전략 (WireMock Vault)

> **[Q12] 테스트 인프라 포트 충돌 방지**: WireMock(`@AutoConfigureWireMock(port=0)`) + EmbeddedRedis(랜덤 포트)를 동시 사용 시 `@TestPropertySource(properties={"spring.data.redis.port=0"})` 또는 `@DynamicPropertySource`로 랜덤 포트 지정 필요. CI 환경에서 포트 충돌 방지.

```java
// Vault WireMock stub 예시 (ChannelIntegrationTestBase)
wireMockServer.stubFor(put(urlPathMatching("/v1/secret/fix/member/.*/totp-secret"))
    .willReturn(aResponse().withStatus(200)));

wireMockServer.stubFor(get(urlPathMatching("/v1/secret/fix/member/.*/totp-secret"))
    .willReturn(aResponse()
        .withHeader("Content-Type", "application/json")
        .withBody("{\"data\":{\"secret\":\"BASE32TESTSECRET\"}}"))
    );

wireMockServer.stubFor(delete(urlPathMatching("/v1/secret/fix/member/.*/totp-secret"))
    .willReturn(aResponse().withStatus(204)));
```

### 재전송 방지 (Replay Attack Guard)

```
Redis 키: ch:totp-used:{memberId}:{windowIndex}:{code}
TTL: 60초
  ※ {w} = windowIndex = Unix timestamp(초) / 30  — RFC 6238 타임스텝 인덱스
      같은 30초 구간 내에서 동일 OTP 코드 재사용을 차단 (Replay Attack 방지)
      예) t=1700000000 → w=56666666, t=1700000029 → w=56666666 (같은 윈도우)
          t=1700000030 → w=56666667 (다음 윈도우 — 새 코드 사용 가능)

동작:
  1. TOTP 코드 검증 성공
  2. Redis SET (NX): ch:totp-used:{memberId}:{w}:{code}
  3. 이미 존재 → HTTP 401 { code: "AUTH-011" } (같은 윈도우 내 재사용 거부)
```

---

## 15. nginx + Let's Encrypt TLS (타협 인프라)

```nginx
# /etc/nginx/sites-available/fix-api
server {
    listen 80;
    server_name fix-api.example.com;
    return 301 https://$host$request_uri;  # HTTP → HTTPS 강제
}

server {
    listen 443 ssl;
    server_name fix-api.example.com;

    ssl_certificate     /etc/letsencrypt/live/fix-api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fix-api.example.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location / {
        proxy_pass          http://localhost:8080;
        proxy_set_header    X-Real-IP $remote_addr;         # FDS IP 추출 필수
        proxy_set_header    X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header    X-Forwarded-Proto https;
    }
}
```

```bash
# Let's Encrypt 발급 (EC2 Ubuntu)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d fix-api.example.com
# 자동 갱신: certbot이 /etc/cron.d/certbot 자동 등록 (90일 만료 → 30일 전 갱신)
```

```yaml
# application-deploy.yml — nginx가 TLS 종단이므로 Spring은 X-Forwarded 헤더 신뢰
server:
  forward-headers-strategy: native  # X-Real-IP → FdsService.analyze() IP 추출
```

---

## 16. FDS (이상거래탐지) — 기초 구현

> **목적**: 기존 Redis + audit_logs 인프라 재활용, 별도 서비스 불필요

### 발동 규칙 5가지

| Rule ID | 조건 | 판정 | Redis 키 |
|---------|------|------|----------|
| FDS-001 | 동일 IP, 10분 내 로그인 실패 10회+ | BLOCK | `fds:ip-fail:{ip}` TTL 10분 |
| FDS-002 | 알려진 디바이스(OS+브라우저 계열) 변경 | MONITOR | `fds:device:{memberId}` TTL 30일 |
| FDS-003 | 새벽 1시~5시(KST) 로그인 시도 | MONITOR | — |
| FDS-004 | 주문 시세 액 > 최근 90일 최대 주문시세액 × 3 | CHALLENGE | audit_logs 조회 |
| FDS-005 | 동일 계정, 10분 내 주문 시도 3회+ | CHALLENGE | `fds:order-velocity:{memberId}` TTL 10분 |

### 판정별 처리

| 판정 | 처리 | security_events 기록 |
|------|------|---------------------|
| ALLOW | 정상 처리 | 없음 |
| MONITOR | 정상 처리 + 기록 | ✅ FDS_TRIGGERED |
| CHALLENGE | 추가 TOTP 재확인 요구 | ✅ FDS_TRIGGERED |
| BLOCK | HTTP 403 `FDS_BLOCKED` + 세션 즉시 무효화 | ✅ FDS_BLOCKED |

### 연동 지점

```
로그인: AuthService.login() → FdsService.analyze(LOGIN_ATTEMPT)
주문 시작: OrderSessionService.initiate() → FdsService.analyze(ORDER_INITIATED)
```

---

## 17. 구현 파일 위치 참고

### 삭제된 파일 (JWT → Spring Session 전환)

| 삭제 파일 | 이유 |
|----------|------|
| `auth/service/JwtProvider.java` | JWT 발급 불필요 |
| `auth/filter/JwtAuthenticationFilter.java` | Spring Session이 대체 |
| `auth/controller/AuthController.java` (refresh 엔드포인트) | Silent Refresh 제거 |

### 추가/변경 파일

| 구성요소 | 경로 |
|---------|------|
| 인증 컨트롤러 | `channel-service/.../auth/controller/AuthController.java` |
| **Session 설정** | `channel-service/.../config/SessionConfig.java` (신규) |
| Security 설정 | `channel-service/.../config/SecurityConfig.java` |
| **FDS 서비스** | `channel-service/.../security/fds/FdsService.java` (신규) |
| **FDS 룰** | `channel-service/.../security/fds/rule/` (신규, 5개 룰) |
| OTP 서비스 인터페이스 | `channel-service/.../order/service/OtpService.java` |
| TOTP 구현체 | `channel-service/.../order/service/TotpOtpService.java` |
| TOTP 컨트롤러 | `channel-service/.../auth/controller/TotpController.java` |
| DevTools 컨트롤러 (`@Profile(local,dev)`) | `channel-service/.../dev/DevToolController.java` |
| Vault 설정 | `channel-service/.../config/VaultConfig.java` |
| Axios 인스턴스 | `fix-web/src/lib/axios.ts` |
| **Auth Context (단순화)** | `fix-web/src/contexts/AuthContext.tsx` |
| Login Page | `fix-web/src/pages/LoginPage.tsx` |
| Private Route | `fix-web/src/router/PrivateRoute.tsx` |
| TOTP 등록 페이지 | `fix-web/src/pages/settings/TotpEnrollPage.tsx` |

---

## 18. Definition of Done (DoD) 체크리스트

> **[B2]** Story 완료 전 아래 항목을 모두 충족해야 배포 가능.

### 기능 완성

- [ ] 회원가입 · 로그인 · 로그아웃 E2E 플로우 정상 동작
- [ ] TOTP 등록 → 주문 step-up 인증 플로우 정상 동작
- [ ] Admin 강제 로그아웃 (`DELETE /api/v1/admin/members/{memberId}/sessions`) 정상 동작

### 보안 검증

- [ ] 세션 고정 방어 통합 테스트 통과 (M1 시나리오)
- [ ] 중복 로그인 kick-out 통합 테스트 통과 (Q7 시나리오)
- [ ] CSRF 토큰 로그인 후 재조회 프론트 구현 확인 (W2)
- [ ] TOTP Replay Attack Guard 단위 테스트 통과 (같은 윈도우 코드 재사용 거부)

### 인프라

- [ ] Redis TLS `ssl.enabled: true` 배포 환경 적용 확인 (M4)
- [ ] `REDIS_PASSWORD` 미설정 시 애플리케이션 기동 실패 확인 (RULE-079)
- [ ] Redis `notify-keyspace-events Ex` 활성화 확인
- [ ] nginx Let's Encrypt 인증서 자동 갱신 설정 확인

### 코드 품질

- [ ] 단위 테스트 커버리지 ≥ 80% (`com.fix.channel.auth.*`, `com.fix.channel.security.*` 패키지 — JaCoCo `<include>` 설정) (Q8)
- [ ] FDS-004 `audit_logs` 쿼리 인덱스 확인 (`member_id`, `created_at` 복합 인덱스 존재) (Q9)
- [ ] **FDS-001 TTL 만료 엣지 케이스**: 10분 TTL 만료 후 미시도 시 Redis 카운터 자동 리셋 확인 (Q13)
- [ ] FDS 5개 룰 smoke test 통과
- [ ] `DevToolController` `@Profile("local","dev")` 외 배포 환경 노출 없음 확인
- [ ] `JwtProvider`, `JwtAuthenticationFilter` 파일 완전 삭제 확인

### 문서

- [ ] `security_events` 테이블 5년 보존 아카이빙 정책 설계 문서 작성 (MA3) — Story 1.2
- [ ] 1기기 제한 정책 사용자 약관 반영 (MA2) — Story 1.2

> **[B3] Story 연결**: 각 DoD 항목 끝의 `(Story N.N)` 레이블로 스프린트 추적 가능. 미표기 항목은 Epic 1 전체에 해당.
