# Story 9.4: [INT/CH] Cross-system Idempotency Reconciliation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an integration data owner,
I want reconciliation anchored on canonical `clOrdId` across CH/AC/FEP,
So that retries and downstream sync gaps converge without producing divergent order identities.

> **Architecture Note:** Stories `3.3` and `5.4` already lock channel/CoreBank idempotent replay and the current release invariant `referenceId == clOrdId`. Story `9.4` is the integrated reconciliation delta: restore missing supplemental downstream linkage around that canonical identity, and surface non-restorable divergence to operations instead of silently drifting.

## Acceptance Criteria

1. Given a same-owner replay for a `clOrdId` that already exists in CH/CoreBank When the integrated replay boundary is hit Then the response reuses the existing canonical local outcome and identity (`orderSessionId`, `clOrdId`, current status, `idempotent=true`) instead of creating a second posting, order row, or alternate terminal state.
2. Given channel/CoreBank local state already owns the canonical `clOrdId` and CoreBank snapshot evidence agrees with the current business state, but channel-side linkage is partial (`externalOrderId` missing or `externalSyncStatus` is not `CONFIRMED`) When reconciliation queries downstream evidence Then the run restores only channel-side supplemental external linkage fields against that existing `clOrdId`, leaving owner/account, `orderSessionId`, and canonical `clOrdId` unchanged.
3. Given reconciliation discovers a non-restorable divergence such as requery-contract `clOrdId` drift, owner/account mismatch, terminal-state mismatch, or conflicting external reference When classification completes Then business state is left unchanged and an operations-visible `ORDER_RECONCILIATION` audit event is emitted queryable through `/api/v1/admin/audit-logs`, including `clOrdId`, mismatch type, source systems, and correlation evidence.
4. Given a reconciliation run completes When reporting is recorded Then a deterministic run summary exposes `scanned`, `restored`, `mismatched`, and `failed` counts, and Micrometer counters `channel.order.idempotency.reconciliation.runs{outcome=success|failed}` plus `channel.order.idempotency.reconciliation.records{result=restored|mismatch|failed}` are incremented.

## Tasks / Subtasks

- [x] Freeze existing CH/AC replay behavior as the reconciliation baseline (AC: 1)
  - [x] Reuse current same-owner replay path and keep canonical replay regression coverage in the targeted verification suite
- [x] Implement partial-linkage reconciliation around canonical `clOrdId` (AC: 2)
  - [x] Restore only channel-side supplemental downstream linkage fields (`externalOrderId`, `externalSyncStatus`) without rewriting canonical identity or ownership
- [x] Surface non-restorable divergence to operations through canonical audit evidence (AC: 3)
  - [x] Add `ORDER_RECONCILIATION` audit mapping and cover admin-audit queryability for account/reference/terminal-state mismatch evidence
- [x] Emit deterministic reconciliation reporting and telemetry (AC: 4)
  - [x] Cover run-summary counts and Micrometer counter increments for success, mismatch, and failure paths

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 9.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md` is available for epic-level context; canonical story ID authority remains `epics.md`.
- Depends on: Story 5.4, Story 3.3, Story 9.1.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Stories `3.3` and `5.4` are the idempotent replay baseline; Story `9.4` must not re-implement generic same-owner replay or unique-key dedupe.
- Current release invariant: channel/CoreBank canonical client-visible identity is `clOrdId`, and CoreBank submit to FEP binds `referenceId == clOrdId`.
- Reconciliation scope begins only after canonical local state already exists. The current release performs channel-side backfill only: it reads CoreBank snapshot evidence and may restore channel `externalOrderId`/`externalSyncStatus` without mutating downstream CoreBank/FEP rows.
- Reconciliation must never mutate `clOrdId`, `orderSessionId`, member/account ownership, or invent a second client-visible order identity.
- Reconciliation must classify business-state divergence conservatively: if CoreBank snapshot status conflicts with the current channel terminal state, the run is recorded as mismatch instead of rewriting channel business state.
- Non-restorable divergence must be surfaced through canonical admin-audit queryability rather than silent logs only; use `ORDER_RECONCILIATION` as the canonical event type.
- The reporting contract for this story is deterministic: `scanned`, `restored`, `mismatched`, and `failed` counts plus the named Micrometer counters above. FE/MOB rendering changes are out of scope.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Keep source-of-truth ordering explicit: channel order-session and CoreBank order rows keyed by `clOrdId` own canonical identity; downstream FEP evidence can only enrich linkage or signal mismatch.

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Cover same-owner replay baseline at the channel and CoreBank boundaries.
- Cover restorable partial-linkage reconciliation and non-restorable mismatch classification.
- Cover admin-audit queryability for canonical `ORDER_RECONCILIATION` evidence.
- Cover deterministic run-summary and counter emission, and verify failed runs do not mutate canonical identity.

### Story Completion Status

- Status set to `review`.
- Completion note: On 2026-03-23 the story was implemented end-to-end with admin-triggered channel-side reconciliation, downstream snapshot lookup, canonical audit surfacing, deterministic counters, tightened terminal-state mismatch classification, and passing channel/corebank module regression suites.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 9, Story 9.4)
- `_bmad-output/implementation-artifacts/epic-9-integration-orchestration-and-end-to-end-recovery.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`


## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- 2026-03-23 targeted red/green verification: `.\gradlew.bat :channel-service:test --tests "com.fix.channel.service.AdminOrderIdempotencyReconciliationServiceTest" --tests "com.fix.channel.service.AdminAuditActionMapperTest" --tests "com.fix.channel.integration.AdminSessionAuditIntegrationTest" --tests "com.fix.channel.service.OrderSessionServiceTest" :corebank-service:test --tests "com.fix.corebank.service.CorebankOrderServiceTest"`
- 2026-03-23 contract + module regression: `.\gradlew.bat :channel-service:verifyCommittedOpenApi :corebank-service:verifyCommittedOpenApi :channel-service:test :corebank-service:test`

### Completion Notes List

- Added admin-triggered reconciliation flow that keeps `clOrdId` and `orderSessionId` canonical while restoring only channel-side supplemental linkage from CoreBank snapshot evidence.
- Added channel admin endpoint `/api/v1/admin/orders/{clOrdId}/idempotency-reconciliation` with explicit admin rate limiting and structured reconciliation response counts.
- Added CoreBank internal snapshot endpoint `/internal/v1/orders/{clOrdId}` so reconciliation can classify restorable linkage gaps versus non-restorable divergence.
- Added canonical `ORDER_RECONCILIATION` audit mapping plus admin-audit integration coverage for operations queryability, including terminal-state mismatch evidence.
- Added Micrometer reconciliation run/record counters and regression coverage for restored, mismatch, and failure paths.
- Added dedicated reconciliation rate-limit and CoreBank snapshot/OpenAPI compatibility regression coverage, then passed channel/corebank module regression suites.

### File List

- `BE/channel-domain/src/main/java/com/fix/channel/entity/AuditAction.java`
- `BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java`
- `BE/channel-service/src/main/java/com/fix/channel/client/CorebankClient.java`
- `BE/channel-service/src/main/java/com/fix/channel/controller/AdminController.java`
- `BE/channel-service/src/main/java/com/fix/channel/dto/response/AdminOrderIdempotencyReconciliationResponse.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/AdminApiRateLimitService.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/AdminAuditActionMapper.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/AdminOrderIdempotencyReconciliationService.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java`
- `BE/channel-service/src/main/java/com/fix/channel/vo/AdminOrderIdempotencyReconciliationResult.java`
- `BE/channel-service/src/main/java/com/fix/channel/vo/CorebankOrderSnapshotResult.java`
- `BE/channel-service/src/test/java/com/fix/channel/controller/AdminControllerContractTest.java`
- `BE/channel-service/src/test/java/com/fix/channel/integration/AdminSessionAuditIntegrationTest.java`
- `BE/channel-service/src/test/java/com/fix/channel/service/AdminApiRateLimitServiceTest.java`
- `BE/channel-service/src/test/java/com/fix/channel/service/AdminAuditActionMapperTest.java`
- `BE/channel-service/src/test/java/com/fix/channel/service/AdminOrderIdempotencyReconciliationServiceTest.java`
- `BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java`
- `BE/contracts/openapi/channel-service.json`
- `BE/contracts/openapi/corebank-service.json`
- `BE/corebank-service/src/main/java/com/fix/corebank/controller/InternalCorebankController.java`
- `BE/corebank-service/src/main/java/com/fix/corebank/dto/response/InternalOrderSnapshotResponse.java`
- `BE/corebank-service/src/main/java/com/fix/corebank/service/CorebankOrderService.java`
- `BE/corebank-service/src/main/java/com/fix/corebank/vo/InternalOrderSnapshotResult.java`
- `BE/corebank-service/src/test/java/com/fix/corebank/contract/CorebankOpenApiCompatibilityTest.java`
- `BE/corebank-service/src/test/java/com/fix/corebank/controller/CorebankInternalApiSkeletonTest.java`
- `BE/corebank-service/src/test/java/com/fix/corebank/service/CorebankOrderServiceTest.java`
- `_bmad-output/implementation-artifacts/9-4-cross-system-idempotency-reconciliation.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-03-23: Implemented cross-system idempotency reconciliation, added admin/CoreBank reconciliation endpoints, refreshed committed OpenAPI snapshots, and moved story status to `review`.
