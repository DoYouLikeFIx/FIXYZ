# Story 2.7: [BE][AC] Position Valuation & PnL Contract

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want position inquiry responses to include valuation and PnL with explicit freshness semantics,
so that I can interpret portfolio performance without trusting stale market data.

## Acceptance Criteria

1. Given valid owned account inquiry and fresh valuation inputs, when position or portfolio inquiry is requested, then the response includes `avgPrice`, `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, `realizedPnlDaily`, `valuationStatus=FRESH`, and `valuationUnavailableReason=null` alongside existing quantity/balance fields.
2. Given BUY and SELL executions already exist for the symbol, when valuation fields are computed, then `avgPrice`, `unrealizedPnl`, and `realizedPnlDaily` follow the documented MVP formulas and use deterministic DECIMAL scale consistent with the account inquiry contract.
3. Given the latest quote snapshot is stale for valuation, when the inquiry is processed, then the API still returns `200 OK`, preserves non-market-derived fields (`quantity`, `availableQuantity`, `balance`, `availableBalance`, `currency`, `asOf`, `avgPrice`), preserves `quoteSnapshotId`, `quoteAsOf`, and `quoteSourceMode` from the stale snapshot for honesty, returns `marketPrice`, `unrealizedPnl`, and `realizedPnlDaily` as `null`, sets `valuationStatus=STALE`, and sets `valuationUnavailableReason=STALE_QUOTE`.
4. Given no quote snapshot is available for valuation or the quote provider is unavailable, when the inquiry is processed, then the API still returns `200 OK`, preserves non-market-derived fields (`quantity`, `availableQuantity`, `balance`, `availableBalance`, `currency`, `asOf`, `avgPrice`), returns `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, and `realizedPnlDaily` as `null`, sets `valuationStatus=UNAVAILABLE`, and sets `valuationUnavailableReason` to `QUOTE_MISSING` or `PROVIDER_UNAVAILABLE`.
5. Given a non-owned account request, when authorization is evaluated using server-owned member/session identity, then the API returns deterministic `403 AUTH-005` and discloses no position, valuation, or PnL fields.
6. Given concurrent executions or position mutations are in progress, when inquiry reads occur, then quantity, balance, average price, and valuation-state fields are returned from one transactionally coherent snapshot without contradictory cash/position/PnL combinations.
7. Given the account has no open position row for the symbol or the symbol quantity is `0` and a fresh quote is available, when the inquiry is requested, then `quantity` and `availableQuantity` remain `0`, `avgPrice` is `null`, `marketPrice` plus quote metadata still reflect the fresh snapshot, `unrealizedPnl=0.0000`, and `realizedPnlDaily` remains the deterministic same-day realized PnL for the symbol or `0.0000` when no same-day sell executions exist.
8. Given the valuation contract is changed or extended, when OpenAPI generation and compatibility verification run, then channel/corebank specs remain aligned on nullable stale behavior, zero-position behavior, and canonical enum values for `valuationStatus` and `valuationUnavailableReason`.

## Tasks / Subtasks

- [x] Extend the account inquiry contract with valuation and PnL fields (AC: 1, 3, 4, 7, 8)
  - [x] Add `avgPrice`, `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, `realizedPnlDaily`, `valuationStatus`, and `valuationUnavailableReason` to the canonical BE DTO/OpenAPI surfaces.
  - [x] Keep Story 2.2 canonical fields and compatibility aliases unchanged while layering valuation fields on top.
- [x] Implement deterministic valuation and PnL computation rules (AC: 1, 2, 6, 7)
  - [x] Reuse committed execution and position-ledger truth from Story 5.2 for weighted-average cost and realized/unrealized PnL math.
  - [x] Enforce fixed DECIMAL serialization and one coherent read snapshot across quantity, balance, average price, and valuation status.
- [x] Implement the stale and unavailable valuation policy (AC: 3, 4, 5)
  - [x] Return `200 OK` for inquiry reads even when quote freshness is stale or unavailable.
  - [x] Preserve stale quote metadata for `valuationStatus=STALE`, null quote metadata for `valuationStatus=UNAVAILABLE`, and populate canonical `valuationStatus` and `valuationUnavailableReason` enums without leaking unauthorized data.
- [x] Add compatibility and regression coverage for the valuation contract (AC: 2, 3, 4, 6, 7, 8)
  - [x] Add BE tests for fresh, stale, unavailable, zero-position, ownership-denied, and concurrent-read scenarios.
  - [x] Add contract verification that channel/corebank schemas and serialized field nullability remain aligned.

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 2.
- Depends on Story 2.2 and Story 5.2.
- PRD carries FR-55 and FR-56 plus the MVP PnL formulas; this story is the plan-level owner for aligning inquiry-time graceful degradation with order-time stale-quote rejection.
- Story 2.2 keeps the base inquiry scope (`quantity`, `availableQuantity`, `balance` plus aliases). Story 2.7 adds valuation and PnL without redefining Story 2.2.

### Technical Requirements

- Read-side stale policy:
  - Inquiry endpoints degrade gracefully with `200 OK` and explicit freshness metadata.
  - `marketPrice`, `unrealizedPnl`, and `realizedPnlDaily` become `null` when valuation is stale or unavailable.
  - Non-market-derived fields (`quantity`, `availableQuantity`, `balance`, `availableBalance`, `currency`, `asOf`, `avgPrice`) remain present.
- Response nullability matrix:
  - `valuationStatus=FRESH`: valuation fields are present, `valuationUnavailableReason=null`.
  - `valuationStatus=STALE`: `quoteSnapshotId`, `quoteAsOf`, and `quoteSourceMode` remain present from the stale snapshot, while `marketPrice`, `unrealizedPnl`, and `realizedPnlDaily` are `null`.
  - `valuationStatus=UNAVAILABLE`: `marketPrice`, `quoteSnapshotId`, `quoteAsOf`, `quoteSourceMode`, `unrealizedPnl`, and `realizedPnlDaily` are `null`.
  - Zero-position fresh reads return `avgPrice=null`, `unrealizedPnl=0.0000`, and deterministic `realizedPnlDaily` derived from same-day same-symbol sell executions or `0.0000` when none exist.
- Canonical enums:
  - `valuationStatus`: `FRESH`, `STALE`, `UNAVAILABLE`
  - `valuationUnavailableReason`: `STALE_QUOTE`, `QUOTE_MISSING`, `PROVIDER_UNAVAILABLE`
- Scope boundary:
  - This story owns inquiry-time valuation semantics only.
  - Order prepare/execute fail-closed stale-quote enforcement remains owned by order-validation stories and must not be weakened here.
  - `VALIDATION-003 (STALE_QUOTE)` continues to apply to order prepare/execute flows and does not apply to read-only inquiry degradation.

### Architecture Compliance

- Preserve channel-service ownership checks that derive `memberId` from the authenticated session and enforce `403 AUTH-005` on mismatch.
- Keep valuation math server-owned; FE/MOB must remain pure renderers of the returned contract.
- Reuse existing quote snapshot metadata and ledger/execution records rather than introducing duplicate valuation storage.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/account/**`
  - `BE/corebank-service/src/main/**/account/**`
  - `BE/*/src/main/**/quote/**`
  - `BE/*/src/test/**`

### Testing Requirements

- Validate fresh, stale, and unavailable valuation responses.
- Validate stale vs unavailable quote-metadata nullability and canonical reason mapping.
- Validate zero-position responses (`avgPrice=null`, `unrealizedPnl=0.0000`, deterministic `realizedPnlDaily`).
- Validate ownership denial (`AUTH-005`) never leaks valuation data.
- Validate concurrent inquiry reads observe a coherent quantity/balance/avgPrice/valuation snapshot.
- Validate OpenAPI and compatibility tests cover nullable valuation fields and enum values.

### Quinn Reinforcement Checks

- Numbering regression gate:
  - Verify `story_key`, filename, and sprint-status entry all match `2-7-position-valuation-and-pnl-contract`.
- Stale-policy gate:
  - Verify stale valuation returns `200 OK`, preserves stale quote metadata, and nulls only market-derived values.
  - Verify unavailable valuation returns `200 OK`, nulls quote metadata plus market-derived values, and uses canonical unavailable reasons.
- Contract determinism gate:
  - Verify fixed DECIMAL scale and canonical enum values across repeated responses.
- Zero-position gate:
  - Verify `quantity=0` contract uses `avgPrice=null`, `unrealizedPnl=0.0000`, and deterministic `realizedPnlDaily`.
- Evidence gate:
  - Attach contract-test and stale-state regression evidence before closing the story.

### Story Completion Status

- Status set to `done`.
- Completion note: Implementation, review remediation, and targeted verification for the valuation/PnL inquiry contract are complete.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.7)
- `_bmad-output/planning-artifacts/prd.md` (`PnL Model (MVP)`, `FR-55`, `FR-56`)
- `_bmad-output/planning-artifacts/accounts/api-spec.md` (`API-CH-04`, `API-CH-05`, PnL calculation rules)
- `_bmad-output/planning-artifacts/architecture.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `./gradlew :corebank-service:compileJava :channel-service:compileJava`
- `./gradlew :corebank-service:test --tests 'com.fix.corebank.service.CorebankOrderServiceTest' --tests 'com.fix.corebank.integration.CorebankAccountPositionIntegrationTest'`
- `./gradlew :channel-service:test --tests 'com.fix.channel.service.OrderSessionServiceTest' --tests 'com.fix.channel.client.CorebankClientTest' --tests 'com.fix.channel.controller.ChannelErrorContractTest'`
- `./gradlew :channel-service:test --tests 'com.fix.channel.integration.OrderSessionIntegrationTest' --tests 'com.fix.channel.contract.ChannelOpenApiCompatibilityTest' :corebank-service:test --tests 'com.fix.corebank.contract.CorebankOpenApiCompatibilityTest'`
- `./gradlew :corebank-service:compileJava :channel-service:compileJava :corebank-service:compileTestJava :channel-service:compileTestJava`
- `./gradlew :corebank-service:test --tests 'com.fix.corebank.service.CorebankOrderServiceTest' --tests 'com.fix.corebank.integration.CorebankAccountPositionIntegrationTest' --tests 'com.fix.corebank.integration.CorebankAccountPositionRepeatableReadIntegrationTest' --tests 'com.fix.corebank.contract.CorebankOpenApiCompatibilityTest' :corebank-service:verifyCommittedOpenApi`
- `./gradlew :channel-service:test --tests 'com.fix.channel.client.CorebankClientTest' --tests 'com.fix.channel.controller.ChannelErrorContractTest' --tests 'com.fix.channel.contract.ChannelOpenApiCompatibilityTest' :channel-service:verifyCommittedOpenApi`
- `./gradlew :corebank-service:refreshOpenApiDocs :channel-service:refreshOpenApiDocs`
- `./gradlew :corebank-service:verifyCommittedOpenApi :channel-service:verifyCommittedOpenApi`
- `./gradlew :corebank-service:test --tests 'com.fix.corebank.service.CorebankOrderServiceTest' --tests 'com.fix.corebank.integration.CorebankAccountPositionIntegrationTest' --tests 'com.fix.corebank.integration.CorebankAccountPositionRepeatableReadIntegrationTest' --tests 'com.fix.corebank.contract.CorebankOpenApiCompatibilityTest' :channel-service:test --tests 'com.fix.channel.client.CorebankClientTest' --tests 'com.fix.channel.controller.ChannelErrorContractTest' --tests 'com.fix.channel.service.OrderSessionServiceTest' --tests 'com.fix.channel.integration.OrderSessionIntegrationTest' --tests 'com.fix.channel.contract.ChannelOpenApiCompatibilityTest' :corebank-service:verifyCommittedOpenApi :channel-service:verifyCommittedOpenApi`

### Completion Notes List

- Implemented inquiry-time valuation contract across corebank and channel with canonical `avgPrice`, PnL, freshness status, and unavailable-reason fields.
- Added deterministic realized/unrealized PnL computation from execution replay and zero-position handling with `avgPrice=null` plus `0.0000` fresh PnL defaults.
- Separated inquiry degradation from market-order fail-closed behavior so read APIs return `200 OK` while order prepare still emits `VALIDATION-003`.
- Refreshed committed OpenAPI snapshots and aligned compatibility tests with the new valuation schema.
- Remediated Senior Developer Review findings by forcing explicit `null` serialization for nullable valuation fields instead of omitting them from inquiry responses.
- Added a repeatable-read integration test backed by containerized infrastructure to prove inquiry responses stay transactionally coherent during concurrent account and position mutations.
- Tightened OpenAPI compatibility assertions to lock canonical nullable valuation fields plus enum members for `valuationStatus` and `valuationUnavailableReason`.
- Replaced portfolio-level per-symbol execution-history replays with batch execution loading for realized same-day PnL calculation during position-list inquiries.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-7-position-valuation-and-pnl-contract.md
- /Users/yeongjae/fixyz/BE/core-common/src/main/java/com/fix/common/valuation/ValuationStatus.java
- /Users/yeongjae/fixyz/BE/core-common/src/main/java/com/fix/common/valuation/ValuationUnavailableReason.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/config/CorebankOpenApiDocumentationConfig.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/controller/InternalCorebankController.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/dto/response/ApiResponseInternalAccountSummaryResponse.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalAccountSummaryResponse.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/repository/ExecutionRepository.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderService.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/vo/AccountPositionResult.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalAccountPositionResponse.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/config/ChannelOpenApiDocumentationConfig.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/controller/AccountController.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/dto/response/ApiResponseAccountSummaryResponse.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/vo/AccountPositionResult.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/dto/response/AccountPositionResponse.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/dto/response/AccountSummaryResponse.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderServiceTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/controller/CorebankInternalApiSkeletonTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankAccountPositionIntegrationTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankAccountPositionRepeatableReadIntegrationTest.java
- /Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/contract/CorebankOpenApiCompatibilityTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/client/CorebankClientTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/contract/ChannelOpenApiCompatibilityTest.java
- /Users/yeongjae/fixyz/BE/contracts/openapi/channel-service.json
- /Users/yeongjae/fixyz/BE/contracts/openapi/corebank-service.json
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-7-position-valuation-and-pnl-contract-test-summary.md

### Change Log

- 2026-03-24: Implemented Story 2.7 BE valuation/PnL contract, added stale/unavailable inquiry degradation, preserved market-order stale rejection, expanded regression coverage, and refreshed committed OpenAPI snapshots.
- 2026-03-24: Resolved Senior Developer Review findings by restoring explicit nullable valuation fields on the wire contract, adding repeatable-read concurrency evidence, tightening OpenAPI compatibility assertions, batching realized-PnL execution loading, and rerunning targeted verification plus `verifyCommittedOpenApi`.
- 2026-03-24: Performed a follow-up adversarial pass, removed unused valuation result factories that could bypass the required `valuationStatus` invariant, deduplicated summary-schema OpenAPI patch beans, and aligned artifact bookkeeping with the final implementation set.

## Senior Developer Review (AI)

### Review Date

- 2026-03-24

### Reviewer

- GPT-5 Codex

### Outcome

- Approved after remediation

### Summary

- Closed the wire-contract nullability gap by making nullable valuation fields serialize explicitly as `null` and by locking the same behavior into channel/corebank OpenAPI compatibility coverage.
- Added a container-backed repeatable-read integration test that proves account inquiry returns one coherent snapshot even when cash, position, and same-day execution rows change concurrently.
- Removed the position-list N+1 realized-PnL replay pattern by batch loading executions per account inquiry and reusing those grouped histories in valuation assembly.

### Acceptance Criteria Validation

- AC3: Pass. Stale valuation now preserves stale quote metadata while returning explicit `null` for market-derived fields on both services.
- AC4: Pass. Unavailable valuation now returns explicit `null` for quote metadata and market-derived fields with canonical unavailable reasons.
- AC6: Pass. Repeatable-read integration coverage now proves inquiry responses stay transactionally coherent under concurrent mutation.
- AC8: Pass. Compatibility tests now assert nullable valuation fields and canonical enum members in both committed OpenAPI contracts.

### Action Items

- None.

## QA Update - 2026-03-24

- Automated QA completed for Story 2.7 valuation freshness semantics, unavailable-reason propagation, and account-position API boundary coverage.
- Added provider-unavailable boundary coverage in `/Users/yeongjae/fixyz/BE/corebank-service/src/test/java/com/fix/corebank/integration/CorebankAccountPositionIntegrationTest.java`.
- Added matching channel boundary coverage in `/Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java`.
- Verified targeted backend QA suites pass with `./gradlew :corebank-service:test --tests 'com.fix.corebank.integration.CorebankAccountPositionIntegrationTest'` and `./gradlew :channel-service:test --tests 'com.fix.channel.controller.ChannelErrorContractTest'`.
- Shared QA summary saved to `/Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/2-7-position-valuation-and-pnl-contract-test-summary.md`.
- QA outcome: pass
