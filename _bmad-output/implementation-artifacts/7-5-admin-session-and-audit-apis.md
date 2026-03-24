# Story 7.5: [CH] Admin Session & Audit APIs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an administrator,
I want forced session invalidation and audit retrieval,
So that security incidents can be handled quickly.

## Acceptance Criteria

1. Given admin role request When invalidate-session API called Then target member sessions are removed and stale member-owned non-terminal order sessions enter the documented cleanup path.
2. Given audit query filters When endpoint executes Then paginated and filterable audit list is returned.
3. Given non-admin caller When admin API is called Then forbidden response is returned.
4. Given privileged action executed When operation completes Then admin identity is recorded.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Keep force-logout aligned with the order-session cleanup policy (AC: 1)
  - [x] Ensure stale client-owned `PENDING_NEW` or `AUTHED` order sessions converge through the session-expiry cleanup path after admin invalidation
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Extend OpenAPI responses for `GET /api/v1/admin/audit-logs` and `DELETE /api/v1/admin/members/{memberUuid}/sessions` to include non-200 error contracts (at minimum 403/429 + standardized error envelope) to match implemented auth/rate-limit behavior. [BE/contracts/openapi/channel-service.json]
- [x] [AI-Review][MEDIUM] Align invalid query-window error semantics for admin audit query (`from > to`) with canonical validation error contract (`VALIDATION_001`) instead of contract-only variant, or explicitly document and test the exception contract decision. [BE/channel-service/src/main/java/com/fix/channel/dto/request/AdminAuditLogQueryRequest.java]
- [x] [AI-Review][MEDIUM] Add explicit automated assertion that privileged-action audit evidence contains admin identity context (e.g., `adminEmail`) to fully prove AC4 evidence claim. [BE/channel-service/src/test/java/com/fix/channel/integration/AdminSessionAuditIntegrationTest.java]

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 7.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 1.2, Story 8.1.
- Story 8.1 fixes the shared audit/security schema and admin-visible event vocabulary. This story consumes that contract; do not redesign table semantics or event naming here.
- Existing code already contains `AdminController` and `ChannelSessionInvalidationService`; extend those paths instead of creating a parallel admin stack.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only when Story 8.1 is `done` or its schema/vocabulary contract is explicitly frozen unchanged for the same implementation branch.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Canonical admin endpoints for this story are fixed by PRD + `_bmad-output/planning-artifacts/channels/api-spec.md`:
  - `GET /api/v1/admin/audit-logs`
  - `DELETE /api/v1/admin/members/{memberUuid}/sessions`
- Do not introduce a second force-logout API contract. The older PRD summary line `POST /api/v1/admin/sessions/force-invalidate` is treated as historical shorthand until the PRD is amended; implementation and tests should follow the detailed `DELETE /api/v1/admin/members/{memberUuid}/sessions` contract.
- Audit-log query must support `page`, `size`, `from`, `to`, `memberId`, and `eventType`. `size` default = 20, max = 100.
- Force logout must be idempotent: if the target member exists but has no active sessions, return `200 OK` with `invalidatedCount: 0` and still record the `ADMIN_FORCE_LOGOUT` audit event.
- Force logout must reuse the order-session cleanup policy so stale client-owned `PENDING_NEW` or `AUTHED` order sessions converge to `EXPIRED` instead of lingering active.
- Admin identity, caller IP, and user agent must be persisted for privileged actions.
- Error contract is fixed: `AUTH-003`, `AUTH-006`, `CHANNEL-001`, `AUTH-005`, `RATE-001`, `SYS-001`.
- Rate limiting is fixed at 20 req/min per admin session with `Retry-After` response header.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Reuse `ChannelSessionInvalidationService` and Spring Session indexed lookup; do not fall back to Redis keyspace scans to discover member sessions.
- Extend the existing admin controller/openapi surface rather than creating a second admin namespace.
- Read/query event names must remain aligned with Story 8.1 canonical vocabulary.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-service/src/main/**/controller/**`
  - `BE/channel-service/src/main/**/service/**`
  - `BE/channel-service/src/main/**/dto/**`
  - `BE/channel-service/src/test/**`
  - `BE/contracts/openapi/**`

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Verify non-admin callers receive deterministic `403 AUTH-006`.
- Verify valid admin force logout removes active sessions and stale sessions fail on the next protected request.
- Verify forced logout also drives stale client-owned `PENDING_NEW` / `AUTHED` order sessions through the documented cleanup policy.
- Verify idempotent force logout (`invalidatedCount: 0`) still records the privileged audit event.
- Verify audit filtering, pagination, and canonical `eventType` handling match the API spec.
- Verify OpenAPI/contract coverage reflects the chosen canonical endpoints.

### Previous Story Intelligence

- From Story 1.2:
  - Reuse the existing session invalidation behavior and stale-session handling path; do not invent a second revocation mechanism for admin flows.

### Quinn Reinforcement Checks

- Dependency gate:
  - Reject implementation start if Story 8.1 schema/vocabulary ownership is still ambiguous.
- Endpoint-contract gate:
  - Reject implementation that ships both `POST /api/v1/admin/sessions/force-invalidate` and `DELETE /api/v1/admin/members/{memberUuid}/sessions` as competing canonical contracts.
- Idempotency gate:
  - Verify `invalidatedCount: 0` is treated as a successful operational outcome, not as an error branch.
- Evidence gate:
  - Attach one forced-logout proof, one stale-session-after-invalidation proof, and one audit-filter proof before status moves to `review`.

### Story Completion Status

- Status set to `done`.
- Completion note: Story 7.5 admin session invalidation and audit APIs are implemented and validated, including second-round adversarial review fixes for OpenAPI error contracts, query validation semantics, and AC4 identity-evidence assertions.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.5)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/8-1-audit-security-event-model.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

- `runTests` (targeted): `BE/channel-service/src/test/java/com/fix/channel/integration/AdminSessionAuditIntegrationTest.java` passed.
- `runTests` (broad contract class): existing unrelated baseline failures observed in `BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java` environment run.
- `get_errors` on changed main files: no new compile/lint errors from Story 7.5 implementation files.

### Completion Notes List

- Implemented canonical admin endpoints:
  - `GET /api/v1/admin/audit-logs`
  - `DELETE /api/v1/admin/members/{memberUuid}/sessions`
- Added admin API rate limiting (20 req/min per admin session) with `Retry-After` support.
- Implemented idempotent force logout (`invalidatedCount: 0` success path) with mandatory `ADMIN_FORCE_LOGOUT` audit recording.
- Implemented audit query filtering/pagination (`page`, `size`, `from`, `to`, `memberId`, `eventType`) using canonical event mapping.
- Extended OpenAPI contract for Story 7.5 endpoints and response schemas.
- Evidence gate coverage attached:
  - Forced-logout proof: `shouldInvalidateTargetMemberSessionsAndRejectStaleSessionAfterAdminForceLogout`
  - Stale-session-after-invalidation proof: same test validates subsequent protected request returns `CHANNEL-001`.
  - Audit-filter proof: `shouldReturnPaginatedFilteredAuditLogsForAdminAuditEndpoint`

### File List

- `BE/channel-service/src/main/java/com/fix/channel/controller/AdminController.java`
- `BE/channel-service/src/main/java/com/fix/channel/repository/AuditLogRepository.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/ChannelSessionInvalidationService.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/AdminApiRateLimitService.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/AdminAuditLogQueryService.java`
- `BE/channel-service/src/main/java/com/fix/channel/service/AdminMemberSessionService.java`
- `BE/channel-service/src/main/java/com/fix/channel/dto/request/AdminAuditLogQueryRequest.java`
- `BE/channel-service/src/main/java/com/fix/channel/dto/response/AdminAuditLogQueryResponse.java`
- `BE/channel-service/src/main/java/com/fix/channel/dto/response/AdminSessionInvalidationResponse.java`
- `BE/channel-service/src/main/java/com/fix/channel/vo/AdminActorContext.java`
- `BE/channel-service/src/main/java/com/fix/channel/vo/AdminAuditLogItemVo.java`
- `BE/channel-service/src/main/java/com/fix/channel/vo/AdminAuditLogQueryCommand.java`
- `BE/channel-service/src/main/java/com/fix/channel/vo/AdminAuditLogQueryResult.java`
- `BE/channel-service/src/main/java/com/fix/channel/vo/AdminSessionInvalidationResult.java`
- `BE/channel-service/src/test/java/com/fix/channel/integration/AdminSessionAuditIntegrationTest.java`
- `BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java`
- `BE/contracts/openapi/channel-service.json`
- `_bmad-output/implementation-artifacts/7-5-admin-session-and-audit-apis.md`

### Change Log

- Added Story 7.5 admin audit/session APIs and supporting service, DTO, and VO layers.
- Added idempotent session invalidation count pathway and privileged audit recording.
- Added Story 7.5 integration tests and admin authorization contract assertions.
- Updated channel-service OpenAPI with canonical admin endpoint contracts.
- Senior Developer adversarial review completed; follow-up action items appended and status moved to `in-progress` pending resolution.
- Applied second-round review fixes (OpenAPI non-200 contracts, validation code alignment, AC4 audit identity assertion) and moved story to `done`.

## Senior Developer Review (AI)

### Review Summary

- Outcome: Changes Requested
- AC coverage check:
  - AC1 implemented and evidenced (`AdminSessionAuditIntegrationTest` force-logout + stale-session assertion)
  - AC2 implemented and evidenced (filtered/paginated audit query assertion)
  - AC3 implemented and evidenced (non-admin forbidden contract tests)
  - AC4 implemented in code path, but test evidence is partial (identity context assertion gap)
- Git vs Story discrepancy: no critical mismatch in BE code file listing for this story scope.

### Findings

1. **[HIGH] OpenAPI error responses are incomplete for new admin endpoints**
  - Evidence: New paths only define `200` responses; implemented runtime behavior includes `403 AUTH-006` and `429 RATE_001`.
  - Impact: Contract consumers cannot rely on documented error envelopes for authorization and throttling.
  - Location: `BE/contracts/openapi/channel-service.json` (`/api/v1/admin/audit-logs`, `/api/v1/admin/members/{memberUuid}/sessions`).

2. **[MEDIUM] Admin audit query uses `CONTRACT_VALIDATION_FAILED` for range validation without explicit story-level contract alignment**
  - Evidence: `AdminAuditLogQueryRequest` throws `ErrorCode.CONTRACT_VALIDATION_FAILED` when `from > to`.
  - Impact: Potential divergence from lane-wide validation semantics (`VALIDATION_001`) unless explicitly intended and documented.
  - Location: `BE/channel-service/src/main/java/com/fix/channel/dto/request/AdminAuditLogQueryRequest.java`.

3. **[MEDIUM] AC4 evidence is not fully asserted in automated tests**
  - Evidence: Integration assertions validate action/memberId/IP/userAgent, but do not assert persisted admin identity field evidence (e.g., `adminEmail` within audit detail).
  - Impact: Story claims complete AC4 proof while test signal can miss regression in identity persistence detail.
  - Location: `BE/channel-service/src/test/java/com/fix/channel/integration/AdminSessionAuditIntegrationTest.java`.

### Senior Developer Review (AI) - Round 2

### Review Summary

- Outcome: Approved
- Re-review scope: prior HIGH/MEDIUM findings from round 1
- Result: all previous HIGH/MEDIUM findings resolved

### Resolution Notes

1. OpenAPI non-200 response contracts added for both admin endpoints (`403`, `429`, plus `400` for audit query validation path).
2. Audit query invalid range (`from > to`) now uses lane-consistent validation code path (`VALIDATION_001`).
3. Integration tests now explicitly assert privileged audit identity evidence via `adminEmail` detail content.
