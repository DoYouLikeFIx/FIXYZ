# Story 8.1: [CH] Audit/Security Event Model

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a compliance owner,
I want audit and security event schemas with retention rules,
So that investigations and compliance checks are reliable.

## Acceptance Criteria

1. Given significant user/system actions When events occur Then audit or security event is persisted in correct store.
2. Given retention schedule When cleanup job runs Then records older than policy are purged.
3. Given privileged actions When performed by admin Then actor identity is captured.
4. Given event insert failure When exception occurs Then fallback operational log captures failure context.

## Tasks / Subtasks

- [x] Implement acceptance-criteria scope 1 (AC: 1)
  - [x] Add test coverage for AC 1
- [x] Implement acceptance-criteria scope 2 (AC: 2)
  - [x] Add test coverage for AC 2
- [x] Implement acceptance-criteria scope 3 (AC: 3)
  - [x] Add test coverage for AC 3
- [x] Implement acceptance-criteria scope 4 (AC: 4)
  - [x] Add test coverage for AC 4

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 8.
- Supplemental artifact `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` has different scope/numbering; use it only as technical reference, not story ID authority.
- Depends on: Story 1.2, Story 4.3.
- This story is the canonical contract source for audit/security persistence consumed by Story 7.5 and any later admin query or admin UI work.
- The repository already contains partial `audit_logs` / `security_events` entities and scattered direct repository writes. This story must normalize those shapes and rules; do not introduce a second event store or another ad-hoc audit path.
- Execution gate: this story may move from `ready-for-dev` to `in-progress` only when `_bmad-output/planning-artifacts/channels/db_schema.md`, `_bmad-output/planning-artifacts/channels/table_spec.md`, and `_bmad-output/planning-artifacts/channels/api-spec.md` are treated as the naming and field source-of-truth bundle.

### Technical Requirements

- Implement only the scope defined in this story's acceptance criteria.
- Keep API, error, and ownership semantics consistent with architecture and PRD contracts.
- Avoid cross-lane coupling outside required integration boundaries.
- Canonical `audit_logs` schema must align with `_bmad-output/planning-artifacts/channels/db_schema.md` and include at minimum: `audit_uuid`, `member_id`, `order_session_id`, `action`, `target_type`, `target_id`, `ip_address`, `user_agent`, `correlation_uuid`, and `created_at`.
- Canonical `security_events` schema must align with `_bmad-output/planning-artifacts/channels/db_schema.md` and include at minimum: `security_event_uuid`, `event_type`, `status`, `severity`, `member_id`, `admin_member_id`, `order_session_id`, `detail`, `ip_address`, `correlation_uuid`, `occurred_at`, `resolved_at`, `created_at`, and `updated_at`.
- Retention contract is fixed by PRD and architecture: audit logs = 90 days, security events = 180 days, both purged by scheduled application jobs.
- Admin actor identity must be queryable for privileged actions; do not rely only on transient application logs for actor attribution.
- Canonical admin-visible audit filter vocabulary must be fixed here before Story 7.5 depends on it. Required values: `LOGIN_SUCCESS`, `LOGIN_FAIL`, `LOGOUT`, `ADMIN_FORCE_LOGOUT`, `ORDER_SESSION_CREATE`, `ORDER_OTP_SUCCESS`, `ORDER_OTP_FAIL`, `ORDER_EXECUTE`, `ORDER_CANCEL`, `MANUAL_REPLAY`, `TOTP_ENROLL`, `TOTP_CONFIRM`.
- If internal enum names differ from canonical admin-visible filter values, define one deterministic mapping layer and test it; do not expose mixed legacy and canonical names to consumers.

### Architecture Compliance

- Follow architecture-defined module boundaries, security contracts, and error envelope conventions.
- Keep lane ownership explicit (BE/FE/MOB) and avoid logic duplication across clients/services.
- Reuse the existing channel-service JPA/migration stack; do not create a parallel audit or security-event persistence mechanism.
- Converge write rules behind a shared audit/security recording boundary (`AuditLogService` or equivalent) instead of expanding direct ad-hoc repository writes further.
- Preserve correlation-id capture and PII-safe event detail payloads.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-domain/src/main/**/entity/**`
  - `BE/channel-service/src/main/**/repository/**`
  - `BE/channel-service/src/main/**/service/**`
  - `BE/channel-service/src/main/resources/db/migration/**`
  - `BE/channel-service/src/test/**`

### Testing Requirements

- Validate all acceptance criteria with automated tests (unit/integration/e2e as appropriate).
- Ensure negative paths and validation/authorization/error flows are covered.
- Verify migration shape matches canonical columns and indexes required by the planning artifacts.
- Verify scheduled purge deletes only records older than the 90d / 180d policy boundaries.
- Verify privileged actions persist actor identity in the canonical store.
- Verify event insert failure path emits deterministic fallback operational evidence without silently losing the failure context.

### Quinn Reinforcement Checks

- Contract freeze gate:
  - Reject implementation if column naming, event naming, or retention rules are inferred from current partial code instead of the planning artifacts.
- Vocabulary normalization gate:
  - Verify canonical admin-visible event names are stable and covered by tests before Story 7.5 audit filters depend on them.
- Centralization gate:
  - Do not add new direct repository-write locations without documenting why the shared audit/security write boundary cannot be used.
- Evidence gate:
  - Attach one migration proof, one purge proof, and one privileged-action actor-attribution proof before status moves to `review`.

### Story Completion Status

- Status set to `done`.
- Final review approval recorded.
- Completion note: Canonical audit/security schema alignment, centralized persistence boundaries, retention purge scheduling, actor-attribution capture, and fallback logging evidence are implemented and verified.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 8, Story 8.1)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/db_schema.md`
- `_bmad-output/planning-artifacts/channels/table_spec.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-8-full-system-validation-and-acceptance-testing.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- `./gradlew :channel-service:compileJava :channel-service:compileTestJava`
- `./gradlew :channel-service:test --tests 'com.fix.channel.integration.AuditSecurityRetentionIntegrationTest' --tests 'com.fix.channel.integration.ChannelAuthFlowTest' --tests 'com.fix.channel.integration.ChannelAuthGuardrailsIntegrationTest' --tests 'com.fix.channel.integration.ChannelPasswordRecoveryIntegrationTest' --tests 'com.fix.channel.integration.OrderSessionIntegrationTest' --tests 'com.fix.channel.service.OrderSessionServiceTest'`
- `./gradlew :channel-service:test --tests 'com.fix.channel.migration.ChannelFlywayMigrationTest' --tests 'com.fix.channel.service.AuditLogServiceTest' --tests 'com.fix.channel.service.SecurityEventServiceTest' --tests 'com.fix.channel.service.AdminAuditActionMapperTest' --tests 'com.fix.channel.service.OrderSessionServiceTest' --tests 'com.fix.channel.service.OrderSessionExpirySchedulerTest' --tests 'com.fix.channel.integration.AuditSecurityRetentionIntegrationTest' --tests 'com.fix.channel.integration.ChannelAuthFlowTest' --tests 'com.fix.channel.integration.ChannelAuthGuardrailsIntegrationTest' --tests 'com.fix.channel.integration.ChannelAuthDemoTotpIntegrationTest' --tests 'com.fix.channel.integration.ChannelAuthSessionIntegrationTest' --tests 'com.fix.channel.integration.ChannelPasswordRecoveryIntegrationTest' --tests 'com.fix.channel.integration.OrderSessionIntegrationTest'`
- `./gradlew :core-common:test :channel-service:compileTestJava`
- `./gradlew :core-common:test --tests 'com.fix.common.web.CorrelationIdSupportTest' :channel-service:test --tests 'com.fix.channel.service.AdminAuditActionMapperTest' --tests 'com.fix.channel.service.AuditLogServiceTest' --tests 'com.fix.channel.service.SecurityEventServiceTest' --tests 'com.fix.channel.migration.ChannelFlywayMigrationTest' --tests 'com.fix.channel.integration.AuditSecurityRetentionIntegrationTest' --tests 'com.fix.channel.integration.ChannelAuthFlowTest' --tests 'com.fix.channel.integration.OrderSessionIntegrationTest'`

### Completion Notes List

- Added canonical audit/security contract support with `audit_uuid`, `security_event_uuid`, `status`, `admin_member_id`, `order_session_id`, `correlation_uuid`, and `occurred_at` handling.
- Introduced centralized `AuditLogService` / `SecurityEventService` boundaries with deterministic fallback operational logging on persistence failure.
- Added audit/security retention cleanup service and scheduler using the fixed 90-day / 180-day purge windows.
- Added canonical admin audit vocabulary mapping and enriched order/auth/password recovery evidence so dependent admin stories can query a stable contract.
- Verified migration idempotence, retention cleanup behavior, privileged actor attribution, and impacted auth/order/password flows with automated tests.
- Review remediation: normalized correlation IDs to the canonical 36-character persistence contract across request/persistence paths, prevented `MANUAL_REPLAY` from swallowing OTP replay-abuse events, and hardened `audit_uuid` / `security_event_uuid` / `status` / `occurred_at` with DB-level `NOT NULL` enforcement.
- Review remediation: changed audit/security recording to best-effort `REQUIRES_NEW` persistence so fallback operational logging no longer masks primary auth/order outcomes when the event tables are unavailable.
- Review remediation follow-up: restored the shared platform correlation-id contract to 64 characters for non-channel services and introduced channel-local 36-character canonicalization so `channel-service` audit/security persistence stays compliant without regressing `corebank-service`, `fep-gateway`, or `fep-simulator`.

### File List

- /Users/yeongjae/fixyz/BE/core-common/src/main/java/com/fix/common/web/CorrelationIdSupport.java
- /Users/yeongjae/fixyz/BE/core-common/src/test/java/com/fix/common/web/CorrelationIdSupportTest.java
- /Users/yeongjae/fixyz/BE/channel-domain/src/main/java/com/fix/channel/entity/AuditAction.java
- /Users/yeongjae/fixyz/BE/channel-domain/src/main/java/com/fix/channel/entity/AuditLog.java
- /Users/yeongjae/fixyz/BE/channel-domain/src/main/java/com/fix/channel/entity/SecurityEvent.java
- /Users/yeongjae/fixyz/BE/channel-domain/src/main/java/com/fix/channel/entity/SecurityEventStatus.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/controller/AuthController.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/repository/AuditLogRepository.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/repository/SecurityEventRepository.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/client/HttpCorebankProvisioningClient.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/AdminAuditActionMapper.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/AuditLogService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/AuditSecurityRetentionScheduler.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/AuditSecurityRetentionService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/AuthService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/MemberService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/MfaRecoveryService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/PasswordRecoveryService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/service/SecurityEventService.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/com/fix/channel/support/ChannelCorrelationIdSupport.java
- /Users/yeongjae/fixyz/BE/channel-service/src/main/java/db/migration/V17__align_audit_security_event_contract.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/integration/AuditSecurityRetentionIntegrationTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/integration/ChannelAuthSessionIntegrationTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/migration/ChannelFlywayMigrationTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/AdminAuditActionMapperTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/AuditLogServiceTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionExpirySchedulerTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/service/SecurityEventServiceTest.java
- /Users/yeongjae/fixyz/BE/channel-service/src/test/java/com/fix/channel/support/ChannelCorrelationIdSupportTest.java
- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/8-1-audit-security-event-model.md

### Change Log

- Added V17 migration to align legacy `audit_logs` and `security_events` tables with canonical admin/compliance contracts and indexes.
- Replaced scattered audit/security repository writes with shared persistence services and added retention cleanup scheduling.
- Added regression and evidence tests for migration idempotence, fallback logging, retention purge, actor attribution, and affected auth/order flows.
