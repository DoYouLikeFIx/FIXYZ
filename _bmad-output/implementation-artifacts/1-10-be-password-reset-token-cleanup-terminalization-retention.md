# Story 1.10: BE Password Reset Token Cleanup, Terminalization and Retention

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want password recovery tokens to be terminalized and purged under a bounded retention policy,
so that password recovery storage remains operationally safe while preserving short-term forensic visibility.

## Acceptance Criteria

1. Given the password recovery cleanup policy, when the scheduler is active, then it runs every `15 minutes` against `channel_db.password_reset_tokens` in the single-instance channel-service runtime.
2. Given password reset token rows that are expired but still active (`active_slot = 1` and `expires_at < now`), when the cleanup job runs, then those rows are transitioned to terminal state with `active_slot = NULL`, `terminal_reason = 'EXPIRED'`, `terminalized_at` set to the terminalization time, `consumed_at` remaining `NULL`, and they no longer participate in active-token semantics.
3. Given a successful password reset that consumes a token, when the token is terminalized by the reset flow, then the row is stored with `active_slot = NULL`, `terminal_reason = 'CONSUMED'`, `consumed_at` set, and `terminalized_at` set in the same lifecycle transition.
4. Given a password recovery reissue that invalidates a prior active token, when the prior token is terminalized by the reissue flow, then the row is stored with `active_slot = NULL`, `terminal_reason = 'SUPERSEDED'`, `consumed_at` remaining `NULL`, and `terminalized_at` set in the same lifecycle transition.
5. Given password reset token rows that are already terminal, when their terminal retention age based on `terminalized_at` exceeds `30 days`, then the cleanup job purges them in bounded batches ordered by the oldest `expires_at` first.
6. Given a cleanup cycle with more eligible rows than one batch can process, when the job executes, then each batch processes at most `500` rows, the job runs at most `8` batches per cycle, and the cycle stops once `20 seconds` of work time has elapsed.
7. Given password recovery cleanup configuration, when the application starts, then cleanup cadence, retention days, batch size, max batches per run, max run seconds, and backlog alert threshold are externally configurable and default to the canonical values of `15 minutes`, `30 days`, `500`, `8`, `20 seconds`, and `10000 rows`.
8. Given a cleanup backlog at or above the operational threshold, when the scheduler evaluates eligible rows, then it emits structured log and/or metric evidence with backlog count visibility at `10000` rows or more without exposing raw reset tokens or unhashed secrets.
9. Given repeated cleanup execution over the same eligible dataset in the single-instance runtime, when the cleanup logic is invoked again after a prior successful cycle, then terminalization and purge behavior remain idempotent and valid non-expired active-token semantics are not corrupted.
10. Given valid, non-expired active password reset tokens, when the cleanup job runs, then those tokens remain untouched and the forgot/challenge/reset contract from Story 1.7 behaves unchanged.
11. Given repository, integration, and scheduler tests, when the feature is verified, then tests prove expired-active terminalization, `CONSUMED` / `SUPERSEDED` / `EXPIRED` terminal-reason assignment, `terminalized_at`-based retention, bounded purge execution, structured backlog evidence emission, idempotent reruns, and non-regression of Story 1.7 recovery behavior.

## Tasks / Subtasks

- [x] Extend password-recovery persistence schema for terminal lifecycle state (AC: 2, 3, 4, 5)
  - [x] Add `terminal_reason` and `terminalized_at` to `password_reset_tokens`
  - [x] Enforce allowed reason values and add retention-friendly indexing
  - [x] Keep raw-token prohibition and one-active-token semantics unchanged
- [x] Update existing recovery lifecycle writes to stamp terminal state deterministically (AC: 3, 4, 10)
  - [x] Set `terminal_reason='CONSUMED'` and `terminalized_at` when reset succeeds
  - [x] Set `terminal_reason='SUPERSEDED'` and `terminalized_at` when reissue invalidates the prior active token
  - [x] Preserve `consumed_at = NULL` for non-consumed terminal states
- [x] Implement bounded cleanup scheduler for expired-active terminalization and terminal purge (AC: 1, 2, 5, 6, 9, 10)
  - [x] Run every `15 minutes` in the single-instance runtime
  - [x] Terminalize expired active rows before purge evaluation
  - [x] Purge only terminal rows older than `30 days` from `terminalized_at`
  - [x] Enforce `batchSize=500`, `maxBatchesPerRun=8`, `maxRunSeconds=20`
- [x] Externalize cleanup configuration and operational evidence (AC: 7, 8)
  - [x] Add configuration properties and environment overrides for cadence, retention, batch, runtime, and alert threshold
  - [x] Emit structured logs and/or metrics for backlog visibility without exposing raw tokens or unhashed secrets
- [x] Add regression coverage for cleanup lifecycle and Story 1.7 non-regression (AC: 2, 3, 4, 5, 6, 8, 9, 10, 11)
  - [x] Add repository/service tests for `EXPIRED`, `SUPERSEDED`, and `CONSUMED` transitions
  - [x] Add scheduler/integration coverage for bounded purge behavior and idempotent reruns
  - [x] Prove valid active tokens remain untouched and existing forgot/challenge/reset behavior does not regress

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 1 (`1.1`~`1.10`).
- Canonical tracking source for this story is `_bmad-output/implementation-artifacts/sprint-status.yaml` key `1-10-be-password-reset-token-cleanup-terminalization-retention`.
- Depends on Story 1.7 and must preserve the existing password recovery API and error contract.
- This story is an internal persistence and operations hardening story; it must not alter FE/MOB recovery UX contracts owned by Stories 1.8 and 1.9.
- Single-instance channel-service runtime is assumed. Distributed locking and horizontal-scale cleanup coordination are explicitly out of scope unless deployment topology changes.

### Technical Requirements

- Canonical cleanup policy:
  - scheduler cadence: every `15 minutes`
  - retention window: `30 days`
  - bounded loop: `batchSize=500`, `maxBatchesPerRun=8`, `maxRunSeconds=20`
  - backlog evidence threshold: `10000` rows
- Terminal lifecycle semantics:
  - `terminal_reason='CONSUMED'` when reset succeeds
  - `terminal_reason='SUPERSEDED'` when reissue invalidates a prior active token
  - `terminal_reason='EXPIRED'` when cleanup terminalizes an expired active token
  - `terminalized_at` is the canonical purge anchor for all terminal rows
  - `consumed_at` must remain `NULL` for `SUPERSEDED` and `EXPIRED`
- Ordering and safety:
  - expired-active terminalization candidates process oldest `expires_at` first
  - purge candidates process oldest `terminalized_at` first
  - cleanup reruns must remain idempotent in the single-instance runtime
- Contract preservation:
  - Story 1.7 forgot/challenge/reset HTTP behavior and `AUTH-012`~`AUTH-016` mappings remain unchanged
  - valid non-expired active tokens must remain eligible for normal reset behavior
  - raw reset tokens must never be logged or persisted

### Architecture Compliance

- Keep cleanup orchestration inside `BE/channel-service` and reuse the existing password-recovery service/repository lane.
- Keep persistent auth entities in `BE/channel-domain` and migration ownership in `BE/channel-service/src/main/resources/db/migration`.
- Prefer deterministic scheduled execution plus bounded DB work over ad hoc manual cleanup paths.
- Do not introduce a second recovery-token ownership model or a new external API just to run cleanup.

### File Structure Requirements

- Expected touched areas:
  - `BE/channel-domain/src/main/**/entity/**`
  - `BE/channel-service/src/main/**/service/**`
  - `BE/channel-service/src/main/**/repository/**`
  - `BE/channel-service/src/main/**/config/**`
  - `BE/channel-service/src/main/resources/application.yml`
  - `BE/channel-service/src/main/resources/db/migration/**`
  - `BE/channel-service/src/test/**`

### Testing Requirements

- Required checks:
  - expired active tokens become `EXPIRED` terminal rows with `terminalized_at` set and `consumed_at = NULL`
  - reissued tokens become `SUPERSEDED` terminal rows with `terminalized_at` set
  - successful reset produces `CONSUMED` rows with both `consumed_at` and `terminalized_at` set
  - purge removes only terminal rows older than `30 days` from `terminalized_at`
  - bounded scheduler execution respects batch and run-time limits
  - backlog evidence emits without leaking secrets
  - Story 1.7 recovery behavior remains unchanged

### Quinn Reinforcement Checks

- Numbering gate:
  - `story_key`, filename, and sprint-status key must remain `1-10-be-password-reset-token-cleanup-terminalization-retention`.
- Lifecycle semantics gate:
  - `CONSUMED`, `SUPERSEDED`, and `EXPIRED` must be mutually exclusive terminal reasons.
- Retention gate:
  - purge anchor is `terminalized_at`, not `updated_at`.
- Safety gate:
  - valid active tokens remain untouched and cleanup reruns are idempotent.
- Secrecy gate:
  - no raw reset token or unhashed secret appears in logs, metrics, or persistence.

### Previous Story Intelligence

- From Story 1.7:
  - hash-only persistence, one-active-token semantics, and stale-session invalidation are already in place and must be preserved
  - Story 1.7 review does not require retention cleanup by itself; this story closes the remaining token-lifecycle operations gap
- From the password-recovery addendum docs:
  - token cleanup policy is already documented at the DB design layer and should now be implemented as a tracked follow-on story

### Story Completion Status

- Status set to `done`.
- Completion note: Implemented password-reset token terminal lifecycle metadata, bounded cleanup scheduling, retention purge, backlog evidence, and regression coverage, and closed the final Epic 1 backend recovery-hardening gap.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.10)
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/channels/db_schema.md`
- `_bmad-output/planning-artifacts/channels/table_spec.md`
- `_bmad-output/planning-artifacts/channels/erd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/planning-artifacts/channels/primary_query.md`
- `_bmad-output/implementation-artifacts/1-7-be-password-forgot-reset-api.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Implementation Plan

- Add terminal lifecycle metadata and backfill/index migration for password reset tokens.
- Stamp `CONSUMED` and `SUPERSEDED` transitions inside the existing recovery flow without changing the Story 1.7 contract.
- Add a bounded cleanup service plus scheduled trigger, configurable retention knobs, and backlog metrics/logging.
- Prove lifecycle, purge, rerun idempotency, and Story 1.7 non-regression with unit and integration tests.

### Debug Log References

- Added `V7__password_reset_token_cleanup_retention.sql` with terminal-state backfill, constraints, and cleanup indexes.
- Added `PasswordRecoveryCleanupService` / `PasswordRecoveryCleanupScheduler` and wired cleanup configuration defaults through `PasswordRecoveryProperties`.
- Updated recovery lifecycle writes so reissue stores `SUPERSEDED` and reset stores `CONSUMED` with `terminalized_at`.
- Verified with `./gradlew :channel-domain:test :channel-service:test`.
- `./gradlew :channel-service:check` reached `generateOpenApiDocs`, but OpenAPI generation could not bind because local port `18080` was already in use by an unrelated `node` process.

### Completion Notes List

- Implemented terminal lifecycle persistence with `PasswordResetTokenTerminalReason`, `terminal_reason`, and `terminalized_at`.
- Added cleanup cadence/retention/batch/runtime/threshold configuration with default values matching the story.
- Implemented bounded expired-token terminalization and terminal-row purge with backlog counters/gauges and threshold logging.
- Added lifecycle and cleanup tests covering `CONSUMED`, `SUPERSEDED`, `EXPIRED`, bounded purge, reruns, backlog evidence, and Story 1.7 regression behavior.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/PasswordResetToken.java
- BE/channel-domain/src/main/java/com/fix/channel/entity/PasswordResetTokenTerminalReason.java
- BE/channel-service/src/main/java/com/fix/channel/config/PasswordRecoveryConfig.java
- BE/channel-service/src/main/java/com/fix/channel/config/PasswordRecoveryProperties.java
- BE/channel-service/src/main/java/com/fix/channel/repository/PasswordResetTokenRepository.java
- BE/channel-service/src/main/java/com/fix/channel/service/PasswordRecoveryCleanupScheduler.java
- BE/channel-service/src/main/java/com/fix/channel/service/PasswordRecoveryCleanupService.java
- BE/channel-service/src/main/java/com/fix/channel/service/PasswordRecoveryService.java
- BE/channel-service/src/main/resources/application.yml
- BE/channel-service/src/main/resources/db/migration/V7__password_reset_token_cleanup_retention.sql
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelPasswordRecoveryIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelPasswordRecoveryCleanupSchedulerIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/ChannelPasswordResetCleanupIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/PasswordRecoveryCleanupServiceTest.java
- _bmad-output/implementation-artifacts/1-10-be-password-reset-token-cleanup-terminalization-retention.md
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-03-11: Implemented password reset token terminalization, bounded cleanup retention, configuration, and regression coverage for Story 1.10.
