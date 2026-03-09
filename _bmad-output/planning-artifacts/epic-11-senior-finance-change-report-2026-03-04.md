# Epic 11 변경사항 설명 보고서 (금융권 시니어 리뷰 대응)

- 작성일: 2026-03-04
- 대상: 금융권 시니어/아키텍처 리뷰어
- 범위: Epic 11 관련 명세 정합성 보완 + 구현 추적성 강화

## 1. 요약 (Executive Summary)

외부 전문가 리뷰에서 제기된 5개 핵심 이슈(시세/가상체결 역할 명확화, MARKET 체결 로직 추적성, 포지션/손익 및 stale quote 통제, 동시성 락 범위 정밀화, Epic 11 구현 아티팩트 공백)에 대해 문서 기준으로 모두 반영했습니다.

이번 변경으로 다음이 개선되었습니다.

1. MARKET 주문의 시세 근거(`quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`)가 API-스토리-DB 전 구간에서 일관화되었습니다.
2. 체결 이력(`executions`)에서 시세 근거 역추적이 가능해져 감사/장애분석성이 강화되었습니다.
3. 동시성 정책이 계좌 단위 직렬화에서 `account_id + symbol` 단위로 구체화되어 종목 간 불필요한 블로킹 리스크가 줄었습니다.
4. Epic 11 스토리(11.1~11.5) 구현 준비 산출물이 생성되어 실행 추적 가능 상태(`ready-for-dev`)가 되었습니다.

## 2. 리뷰 지적사항별 조치 결과

| 리뷰 지적사항 | 조치 내용 | 근거 문서 | 기대 효과 |
|---|---|---|---|
| 모의투자에서 대외계는 실기관 연계보다 시세 수신 + 가상 체결 엔진 역할이 핵심 | Epic 11 AC에서 LIVE/DELAYED/REPLAY 모드별 snapshot 계약 필드 명시 강화 | `_bmad-output/planning-artifacts/epics.md` | 모드별 계약 모호성 제거, 시뮬레이터/리플레이 재현성 향상 |
| 주문 접수→호가→매칭→체결→잔고 반영에서 MARKET 매칭 규칙/근거가 약함 | 11.4 AC 유지 + DB에 MARKET 체결근거 필드 추가(`quote_snapshot_id` 등) | `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/planning-artifacts/accounts/db_schema.md` | 가격/시간 우선 매칭 결과 감사 가능성 강화 |
| 포지션/손익과 stale quote 통제가 실무 설계의 핵심 | API에 MARKET 내부 전달 필드 의무화 + `VALIDATION-003(STALE_QUOTE)` 명시 | `_bmad-output/planning-artifacts/accounts/api-spec.md` | 시세 신선도 위반 주문의 일관된 차단 |
| 증권형 동시성은 계좌 단위가 아닌 계좌+종목 단위가 적합 | 락 정책을 `(account_id, symbol)` 기준으로 재정렬 | `_bmad-output/planning-artifacts/accounts/db_schema.md`, `_bmad-output/planning-artifacts/accounts/api-spec.md` | cross-symbol 블로킹 완화, 처리량/지연 개선 |
| Epic 11 구현 준비 산출물 부재 | 11.1~11.5 스토리 문서 신설 + sprint-status 반영 | `_bmad-output/implementation-artifacts/11-*.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml` | 실행 준비 상태 추적 가능 |

## 3. 핵심 변경 상세

### 3.1 Story/AC 정합성 보완 (Epic 11)

1. Story 11.1 의존성에서 `Story 6.3` 제거, `Story 5.2` 중심으로 정리.
2. LIVE/DELAYED/REPLAY 각각에 `quoteSnapshotId`/`quoteSourceMode` 반영.
3. Story 11.2 성공 AC에 `quoteSourceMode`를 추가하여 계약 일치.

근거:
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md:2134`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md:2140`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md:2143`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md:2146`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/epics.md:2160`

### 3.2 API 계약 통일 (채널→계정계 MARKET 전달)

1. `API-CH-06` 요청 예시에 MARKET 필수 전달 필드 추가:
- `preTradePrice`
- `quoteSnapshotId`
- `quoteAsOf`
- `quoteSourceMode`
2. MARKET 필드 정책과 에러(`VALIDATION-003 / STALE_QUOTE`)를 명시.
3. OUTBOUND(FEP 송신)에서도 동일 필드 전달을 명문화.

근거:
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/api-spec.md:96`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/api-spec.md:109`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/api-spec.md:115`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/api-spec.md:129`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/api-spec.md:158`

### 3.3 DB 추적성 강화 (ORDER/EXECUTION)

1. `orders`에 MARKET 근거 컬럼 추가:
- `pre_trade_price`
- `quote_snapshot_id`
- `quote_as_of`
- `quote_source_mode`
2. `executions`에도 동일 계열 컬럼 추가해 체결 근거 역추적 가능화.
3. `exec_type='TRADE'` 행의 근거 복제 정책 명시.
4. 인덱스 추가: `IDX(quote_snapshot_id, created_at)`.

근거:
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/db_schema.md:170`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/db_schema.md:171`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/db_schema.md:188`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/db_schema.md:229`
- `/Users/yeongjae/fixyz/_bmad-output/planning-artifacts/accounts/db_schema.md:237`

### 3.4 구현 준비 산출물 생성 (Epic 11)

11.1~11.5 스토리 문서를 생성하고 상태를 `ready-for-dev`로 반영했습니다.

근거:
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-1-market-data-source-adapter-live-delayed-replay.md:1`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-2-quote-snapshot-freshness-guard.md:1`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-3-replay-timeline-controller.md:1`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-4-market-order-sweep-matching-validation.md:1`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/11-5-web-mob-quote-freshness-and-source-visibility-ux.md:1`
- `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/sprint-status.yaml:150`

## 4. 통제·감사 관점 평가

### 4.1 감사 추적성 (Auditability)

이전에는 `quoteSnapshotId`가 스토리/계약에는 존재하나 DB 레벨 체결 이력 추적성이 약했습니다. 현재는 주문/체결 테이블 모두에서 시세 근거 키를 유지하므로, 다음 감사 질문에 문서상 답이 가능합니다.

1. 어떤 시세 스냅샷을 근거로 MARKET 주문을 검증/체결했는가?
2. 체결 시점의 source mode(LIVE/DELAYED/REPLAY)는 무엇인가?
3. stale quote 정책 위반이 어떤 코드로 거절되었는가?

### 4.2 운영 안정성 (Operational Stability)

`(account_id, symbol)` 단위 락 명시는 증권형 동시성 문제(동일 종목 집중 주문) 대응에 직접적입니다. 계좌 전체 직렬화 대비 종목 분리 병렬성이 올라가므로, 혼잡 시 tail latency와 lock contention 완화에 유리합니다.

### 4.3 도메인 정합성 (Domain Correctness)

MARKET 주문에서 사전검증 필드 누락을 명시적으로 오류화한 것은 모의투자 환경에서 "가상 체결의 근거 시세"를 제도화한 조치입니다. 이는 규정 준수보다는 내부 통제/설계 일관성 측면에서 의미가 큽니다.

## 5. 추가 개선 권고 (다음 라운드)

현재 변경은 "문서 정합성"과 "추적성 계약"을 맞춘 단계입니다. 실무 품질을 위해 아래를 추가 권고합니다.

1. DB 마이그레이션 명시화
- `orders`/`executions` 신규 컬럼 추가 DDL, backfill 전략, 롤백 전략 문서화.

2. 체결 엔진 상세 규약 문서 신설
- 시장가 sweep 알고리즘(가격우선/시간우선), partial fill/잔량 정책, no-liquidity reject 조건을 별도 섹션으로 고정.

3. 시세 소스 SLA/신선도 운영 기준
- `maxQuoteAgeMs` 환경별 기본값, 경보 임계치, 운영 대시보드 지표(stale reject rate) 정의.

4. 검증 자동화 강화
- 계약 테스트에 MARKET 필수 필드 누락/오염 케이스 포함.
- 리플레이 seed 고정 CI 테스트에 snapshot sequence hash gate 추가.

5. 회계 분개 예시 부록
- BUY/SELL 시 분개 패턴(현금/주식자산 증감, realized/unrealized PnL 반영)을 숫자 예시로 명시.

## 6. 결론

이번 반영으로 Epic 11은 전문가 피드백의 핵심 취지(모의투자형 시세-체결 일관성, MARKET 근거 추적성, 동시성 정밀화)를 문서 레벨에서 충족하도록 개선되었습니다. 특히 MARKET 주문의 "근거 시세 계약"이 AC/API/DB에 관통되도록 맞춰진 점이 가장 큰 개선점입니다.

다음 단계는 구현/테스트 단계에서 위 권고사항을 실행해, 문서 정합성을 운영 가능한 품질로 전환하는 것입니다.
