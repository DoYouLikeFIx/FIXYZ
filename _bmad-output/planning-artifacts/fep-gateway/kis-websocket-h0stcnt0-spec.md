# KIS Open API WebSocket 계약 명세 — H0STCNT0 (국내주식 실시간체결가)

> Source of truth for provider-side market-data ingestion contract used by Epic 11.

## 1. 목적과 범위

이 문서는 FEP Gateway의 `LIVE` 시장데이터 소스로 한국투자 Open API WebSocket `H0STCNT0`를 연동할 때 필요한 **연결/구독/파싱/복호화/운영 규칙**을 정의한다.

- 적용 범위: `LIVE` 모드 시장데이터 수집
- 비적용 범위: 주문 실행(FIX 4.2), 체결통보(`H0STCNI0/H0STCNI9`)의 주문 이벤트 처리
- Canonical consumer: `fep-gateway` Market Data Adapter

## 2. 연결 계약

| 항목 | 값 |
|---|---|
| 프로토콜 | WebSocket |
| 실전 Domain | `ws://ops.koreainvestment.com:21000` |
| 모의 Domain | `ws://ops.koreainvestment.com:31000` |
| TR ID (실전/모의 공통) | `H0STCNT0` |
| 포맷 | JSON + 실시간 본문(`|`/`^` 구분 문자열) |
| Content-Type | `text/plain` (`utf-8`) |

### 2.1 사전 인증 (Approval Key)

WebSocket 연결 전 `/oauth2/Approval` 호출로 `approval_key`를 발급받아야 한다.

- 필수 키: `appkey`, `secretkey`
- 발급 성공 시: `approval_key`를 WebSocket 헤더에 주입
- 운영 규칙:
  - Approval key 만료/무효 응답 시 즉시 재발급 후 재연결
  - 재발급/재연결 실패는 `LIVE` source degraded 상태로 전환하고 `DELAYED/REPLAY` fallback 정책 적용

## 3. 구독 요청 계약

헤더와 바디를 합쳐 JSON 형태로 전송한다.

### 3.1 Request Header

| Element | Required | 설명 |
|---|---|---|
| `approval_key` | Y | `/oauth2/Approval` 발급값 |
| `custtype` | Y | `P`(개인) 또는 `B`(법인) |
| `tr_type` | Y | `1` 등록, `2` 해제 |
| `content-type` | Y | `utf-8` |

### 3.2 Request Body

| Element | Required | 설명 |
|---|---|---|
| `tr_id` | Y | `H0STCNT0` |
| `tr_key` | Y | 종목코드 (`6자리 숫자` 또는 ETN `Q` prefix, 예: `Q500001`) |

### 3.3 정합성 규칙

1. 등록은 `tr_type="1"`, 해제는 `tr_type="2"`를 기준으로 고정한다.
2. 심볼 검증은 `^\d{6}$`와 `^Q\d{6}$`를 모두 허용한다.
3. 동일 심볼 중복 등록 요청은 idempotent 처리(이미 구독 중이면 no-op)한다.

## 4. 응답 계약

### 4.1 등록 결과(JSON)

- 성공 응답: `body.msg1 = "SUBSCRIBE SUCCESS"`
- 필요 시 `body.output.iv`, `body.output.key` 제공 (암호화 payload 복호화용)

운영 규칙:

1. `key/iv` 수신 시 TR 컨텍스트(`tr_id`)에 저장한다.
2. key/iv는 메모리 전용으로 관리하고 로그/영속 저장을 금지한다.
3. 재연결 후 재구독 성공 시 이전 key/iv는 폐기하고 최신값으로 교체한다.

### 4.2 실시간 결과 프레임(문자열)

예시:

```text
0|H0STCNT0|004|005930^123929^73100^5^...
```

| 구간 | 설명 |
|---|---|
| `encFlag` | `0` 평문, `1` 암호화 |
| `tr_id` | `H0STCNT0` |
| `count` | payload 내 레코드 건수 (`001`, `004` 등) |
| `payload` | `^` 구분 필드 스트림 |

#### 4.3 멀티레코드(페이징) 파싱 규칙

1. `count` 값만큼 레코드를 분리해 파싱한다.
2. 레코드 필드 수(`H0STCNT0`)를 `RECORD_FIELD_COUNT` 상수로 고정 관리한다.
3. `payloadFieldCount % RECORD_FIELD_COUNT != 0`이면 malformed 이벤트로 분류하고 폐기/알림한다.
4. 레코드 분리 실패 시 해당 프레임만 격리(fail-fast)하고 스트림 연결은 유지한다.

### 4.4 복호화 규칙

`encFlag == 1`이면 `body.output.key`/`body.output.iv`를 사용해 AES256-CBC 복호화를 수행한다.

- 복호화 실패는 `DECODE_ERROR`로 계측하고 프레임 폐기
- 동일 TR에서 연속 실패 임계치 초과 시 재구독 또는 재연결 수행

## 5. 필드 매핑 (H0STCNT0 → 내부 정규 이벤트)

| KIS 필드 | 내부 필드 | 비고 |
|---|---|---|
| `MKSC_SHRN_ISCD` | `symbol` | 종목코드 |
| `STCK_CNTG_HOUR` + `BSOP_DATE` | `quoteAsOf` | KST 영업일/시간 조합 후 UTC로 정규화 |
| `STCK_PRPR` | `lastTrade` | 현재 체결가 |
| `ASKP1` | `bestAsk` | 매도1호가 |
| `BIDP1` | `bestBid` | 매수1호가 |
| `CNTG_VOL` | `tradeVolume` | 체결거래량 |
| `ACML_VOL` | `accumVolume` | 누적거래량 |
| `TRHT_YN` | `tradingHalt` | 거래정지 여부 |
| `NEW_MKOP_CLS_CODE` | `marketPhaseCode` | 장운영 구분 |
| `VI_STND_PRC` | `viReferencePrice` | 정적 VI 기준가 |

정규화 추가 규칙:

1. `quoteSourceMode = LIVE` 고정.
2. `quoteSnapshotId`는 `provider + symbol + quoteAsOf + streamOffset`로 결정적 생성.
3. `bestBid > bestAsk` 등 비정상 호가는 `SNAPSHOT_INVALID`로 폐기한다.

## 6. 장애/재연결 운영 규칙

1. ping/pong 누락 또는 socket 종료 시 exponential backoff 재연결 수행.
2. 재연결 성공 후 open subscription 목록을 자동 재등록한다.
3. 재연결 중 누락 구간은 REST snapshot 보정 또는 `REPLAY` 이벤트로 gap-fill 한다.
4. 연속 재연결 실패 임계치 초과 시 `LIVE` 소스를 `DEGRADED`로 표기하고 fallback 모드 전환 이벤트를 발행한다.

## 7. 관측 지표 (필수)

- `marketdata_ws_connect_success_total`
- `marketdata_ws_reconnect_total`
- `marketdata_ws_subscribe_success_total`
- `marketdata_ws_decode_error_total`
- `marketdata_ws_frame_malformed_total`
- `marketdata_snapshot_emitted_total`
- `marketdata_snapshot_stale_reject_total`

## 8. 테스트 체크리스트

1. 등록 성공(`SUBSCRIBE SUCCESS`) 및 key/iv 캐시 확인
2. `encFlag=0`/`encFlag=1` 모두 파싱·복호화 확인
3. `count=004` 멀티레코드 프레임 분리 검증
4. `tr_type=2` 해제 동작 검증
5. ETN 심볼(`Q500001`) 입력 검증
6. 연결 끊김 후 재연결 + 재구독 + gap-fill 검증

## 9. 참조

- 한국투자 Open API 포털 (`H0STCNT0`)
- 한국투자 공식 샘플: `open-trading-api` 저장소의 websocket/python 예제
