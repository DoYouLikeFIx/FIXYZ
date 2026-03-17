# PRD 대비 오더북 매칭 엔진 갭 체크리스트 (2026-03-17)

## 1) 범위

- 대상: PRD의 Order Book(price-time priority) 요구와 현재 BE 구현 비교
- 목적: 구현 공백(gap)을 체크리스트로 식별하고, 실제 매칭 엔진에 필요한 최소 컴포넌트를 정의

---

## 2) PRD 요구 vs 현재 코드 체크리스트

### A. 매칭 규칙/상태

- [ ] **LIMIT 가격/시간 우선 매칭**
  - PRD 요구: 매수 `price DESC + time ASC`, 매도 `price ASC + time ASC`
  - 근거: `_bmad-output/planning-artifacts/prd.md` (Order Book 규칙)
  - 현재 코드: `CorebankOrderPersistenceService.prepareOrderSubmission`에서 주문 생성 직후 `executedQty=orderQty`, `leavesQty=0`로 즉시 체결 처리
  - 판정: **갭 존재**

- [ ] **MARKET sweep(반대호가 베스트부터 순차 소진)**
  - PRD 요구: 반대편 북을 베스트 가격부터 소진하며 부분체결 허용
  - 근거: `_bmad-output/planning-artifacts/prd.md` (MARKET sweep)
  - 현재 코드: 반대호가 탐색/스윕 루프 없음, 단건 즉시 FILLED 패턴
  - 판정: **갭 존재**

- [ ] **유동성 부족 시 정책 분기**
  - PRD 요구: LIMIT는 NEW로 잔존 가능, MARKET은 부분체결 또는 no-liquidity reject
  - 근거: `_bmad-output/planning-artifacts/prd.md` (Compensation Protocol)
  - 현재 코드: CoreBanking 로컬 처리에서 no-liquidity 판정 경로 및 북 잔존 로직 부재
  - 판정: **갭 존재**

### B. 데이터/트레이서빌리티

- [ ] **다중 execution row 생성(체결 건별 기록)**
  - PRD 요구: 매칭 결과에 따라 execution row 다건 가능
  - 근거: `_bmad-output/planning-artifacts/prd.md` (Run Order Book matching and INSERT execution rows)
  - 현재 코드: `executionRepository.saveAndFlush(Execution.of(...))` 단건 저장
  - 판정: **갭 존재**

- [ ] **MARKET 체결 근거 필드 추적 (`quoteSnapshotId` 등)**
  - 요구: Story 11.4 AC3에서 추적성 명시
  - 근거: `_bmad-output/implementation-artifacts/11-4-market-order-sweep-matching-validation.md`
  - 현재 코드: `Execution` 생성 경로에서 quote snapshot linkage 확인 불가
  - 판정: **갭 존재**

### C. 트랜잭션/동시성

- [x] **동기 처리 + 트랜잭션 경계 내 실행**
  - PRD 요구: CoreBanking `@Transactional` 내 동기 매칭
  - 현재 코드: `prepareOrderSubmission`이 `@Transactional` 내에서 주문/체결/포지션 반영 수행
  - 판정: **부분 충족(동기/트랜잭션은 충족, 실제 매칭 로직은 미충족)**

- [x] **포지션 락 기반 무결성 보호**
  - 요구: 동시성 하에서 과매도 방지
  - 현재 코드: `findByAccountIdAndSymbolForUpdate`, 계정 `for update` 조회 사용
  - 판정: **충족(포지션 무결성 측면)**

### D. 외부(FEP) 연계 의미

- [ ] **로컬 매칭 결과와 외부 동기화 분리(정합성 유지)**
  - PRD 의도: 로컬 canonical match 후 FEP 동기화
  - 현재 코드: 로컬은 사실상 즉시 FILLED, FEP는 `sendNewOrder`에서 기본 FILLED 반환
  - 판정: **의도 일부만 충족, 매칭 엔진 관점 갭 존재**

---

## 3) 실제 매칭 엔진 구현에 필요한 최소 컴포넌트 (MVP-Real Matching)

1. **OrderBookRepository (영속 계층)**
   - 역할: 심볼/사이드별 미체결 주문 조회
   - 핵심 질의:
     - 매수 대기북: `symbol`, `side=BUY`, `status in (NEW, PARTIALLY_FILLED)`
     - 매도 대기북: `symbol`, `side=SELL`, `status in (NEW, PARTIALLY_FILLED)`
   - 정렬 규칙 내장(가격/시간 우선)

2. **MatchingPolicy (도메인 규칙)**
   - 역할: LIMIT/MARKET 체결 가능성 판정, fill qty/price 계산
   - 포함 규칙:
     - LIMIT 교차 여부(가격 조건)
     - MARKET sweep 순서
     - no-liquidity reject 조건

3. **MatchingEngineService (오케스트레이션)**
   - 역할: 단일 주문 입력 시 반대북 스캔 루프 수행
   - 출력:
     - 체결 목록(trade list)
     - 잔량(leavesQty)
     - 최종 주문 상태(NEW/PARTIALLY_FILLED/FILLED/REJECTED)

4. **ExecutionWriter (체결 ledger 반영기)**
   - 역할: trade list를 `executions` 다건으로 저장
   - 필수: `executedQty`, `executedPrice`, `leavesQty`, (MARKET이면) `quoteSnapshotId`

5. **OrderStateUpdater (상태 전이기)**
   - 역할: 매칭 결과로 주문 상태 전이 및 잔량 갱신
   - 규칙:
     - 체결 없음 + LIMIT => NEW
     - 일부 체결 => PARTIALLY_FILLED
     - 전량 체결 => FILLED
     - MARKET + 반대북 공백 => REJECTED(no-liquidity)

6. **PositionPostingService (포지션/현금 반영기)**
   - 역할: 체결 건 합산 결과를 포지션/현금/저널에 반영
   - 주의: 현재의 단건 fill 가정 제거 필요

7. **MatchingContractTests (필수 테스트 세트)**
   - 시나리오 최소 5개:
     - LIMIT 교차 체결
     - LIMIT 비체결 잔존(NEW)
     - MARKET multi-level sweep
     - MARKET 부분체결
     - MARKET no-liquidity reject

---

## 4) 최소 구현 순서(리스크 최소화)

1. `Execution`/`Order` 모델에 다건 체결 및 잔량 전이를 수용하도록 서비스 레이어 확장
2. `MatchingPolicy` + `MatchingEngineService`를 CoreBanking 내부 도메인 서비스로 추가
3. `CorebankOrderPersistenceService.prepareOrderSubmission`에서 “즉시 FILLED 고정” 제거 후 매칭 엔진 호출
4. `executions` 다건 저장 + order status 계산 + position posting을 매칭 결과 기반으로 전환
5. Story 11.4 AC 기준 테스트 및 회귀 테스트 보강

---

## 5) 즉시 확인 가능한 핵심 코드 위치

- 즉시 FILLED 고정값: `BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderPersistenceService.java`
- 단건 execution 저장: `BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderPersistenceService.java`
- 외부 기본 FILLED 응답: `BE/fep-gateway/src/main/java/com/fix/fepgateway/dataplane/fix/FixDataPlaneService.java`
- 실행 진입점: `BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java`
