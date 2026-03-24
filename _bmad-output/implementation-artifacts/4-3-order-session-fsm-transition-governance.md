# Story 4.3: [BE][CH] FSM Transition Governance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a domain owner,
I want explicit order session transition rules,
So that invalid state progression cannot occur.

## Acceptance Criteria

1. Given the order-session FSM definition, when a transition command is applied, then only allowed transitions are accepted.
2. Given an invalid transition request, when it is attempted, then a deterministic conflict or validation error is returned.
3. Given a valid state persistence or authenticated-session invalidation event, when the transition completes, then status and timestamps are stored consistently, including forced expiry of stale client-owned `PENDING_NEW` or `AUTHED` sessions.
4. Given API status serialization, when a session is returned, then optional fields follow the status-specific response contract.

## Tasks / Subtasks

- [x] Implement the canonical order-session transition table in the domain layer (AC: 1, 2)
  - [x] Model low-risk auto-authorized sessions as direct `AUTHED` creation and reserve `PENDING_NEW -> AUTHED` for successful conditional step-up only
  - [x] Reject impossible or out-of-order transitions deterministically
- [x] Persist status and transition timestamps consistently (AC: 3)
  - [x] Reconcile active-session expiry using the canonical `3600s` TTL plus `expiresAt` contract rather than older `10 minute` shorthand references
  - [x] Maintain forced parent-session invalidation path that converges stale client-owned `PENDING_NEW` or `AUTHED` sessions to `EXPIRED`
  - [x] Ensure expiration and failure transitions remain auditable
- [x] Implement status-specific serialization rules for API consumers (AC: 4)
  - [x] Use explicit order-session DTO mapping for documented nullable fields instead of inheriting ambiguous global JSON omission behavior
  - [x] Expose only the optional fields allowed for the current state
- [x] Add automated coverage for valid transitions, invalid transitions, and response serialization behavior (AC: 1, 2, 3, 4)

## Dev Notes

### Developer Context Section

- Canonical numbering source: `_bmad-output/planning-artifacts/epics.md` Epic 4.
- Companion artifact `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md` is the epic-level implementation contract for canonical Epic 4.
- Depends on: Story 4.2.

### Technical Requirements

- Story `4.2` is the current review- and QA-passed behavioral baseline for create-time risk classification and verify-time step-up enforcement; this story may start against that baseline and must not redefine it.
- Low-risk auto-authorized sessions are created directly in `AUTHED` at session creation time. They do not traverse `PENDING_NEW`.
- `PENDING_NEW -> AUTHED` is reserved for successful conditional step-up verification on sessions where `challengeRequired=true`.
- The canonical active order-session TTL for this story is `3600s`. `expiresAt` plus Redis TTL are the source of truth; any legacy `10 minute` wording in older artifacts is non-canonical for Story `4.3`.
- Expiry reconciliation must persist `EXPIRED` using the same `3600s` rule for both live TTL loss and scheduled recovery paths.
- If the authenticated parent session is force-invalidated while the order session remains client-owned and non-terminal, `PENDING_NEW` or `AUTHED` must converge to `EXPIRED` via the same cleanup policy.
- Order-session status responses must use an explicit status-specific DTO contract: documented nullable fields are returned as explicit `null` when applicable, while fields outside the current status contract remain omitted.
- Terminal states must not re-open without an explicit documented recovery path.
- State-specific optional fields must stay consistent across persistence and API response layers.

### Architecture Compliance

- Follow the FSM defined in `architecture.md` with this story's canonical clarification that auto-authorized sessions start in `AUTHED`, while only challenge-required sessions move from `PENDING_NEW` to `AUTHED`.
- Keep state governance in the channel domain instead of duplicating it in controllers or clients.
- Preserve correlation between transition decisions and stored timestamps.

### Testing Requirements

- Cover the allowed transition matrix, invalid transition rejection, expiration handling, and status-specific serialization behavior.

### Story Completion Status

- Status set to `done`.
- Completion note: Story implemented canonical auto-authorization semantics, `3600s` expiry governance, and explicit status-response serialization rules with terminal-state contract regressions covered.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.3)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/epic-4-order-execution-and-position-integrity.md`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- 2026-03-16: Added canonical FSM transition guards in the channel domain and active-window-aware result shaping in channel-service.
- 2026-03-16: Verified with `./gradlew :channel-domain:test :channel-service:test` plus targeted serializer and service regression suites.
- 2026-03-16: Senior Developer Review follow-up routed execute-time validation through the canonical active-window guard and added TTL-loss execute regression coverage.
- 2026-03-16: Adversarial review follow-up expanded terminal-state serializer and HTTP contract coverage, and aligned the story artifact with the actual reviewed file set.

### Completion Notes List

- Canonical order-session transitions now reject impossible or terminal reopen paths from the domain layer while preserving low-risk direct `AUTHED` creation semantics.
- Active-session TTL handling now only governs `PENDING_NEW` and `AUTHED`; terminal and in-flight status lookups no longer collapse into false `ORD-008` responses.
- Execute-time authorization now reuses the same active-window guard, so missing Redis TTL blocks stale `AUTHED` sessions before CoreBanking handoff.
- Order-session API serialization now emits documented nullable fields explicitly and omits active-window metadata outside active states.
- Expiry transitions now create audit records for both live TTL-loss reconciliation and scheduled batch expiry paths.
- Terminal-state regression coverage now locks `FAILED(OTP_EXCEEDED)` and `CANCELED(PARTIAL_FILL_CANCEL)` serializer semantics plus the real channel boundary response contract.

### File List

- BE/channel-domain/src/main/java/com/fix/channel/entity/AuditAction.java
- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSession.java
- BE/channel-domain/src/main/java/com/fix/channel/entity/OrderSessionStatus.java
- BE/channel-domain/src/test/java/com/fix/channel/entity/OrderSessionStateMachineTest.java
- BE/channel-service/src/main/java/com/fix/channel/dto/response/OrderSessionResponse.java
- BE/channel-service/src/main/java/com/fix/channel/serialization/OrderSessionResponseSerializer.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionPersistenceService.java
- BE/channel-service/src/main/java/com/fix/channel/service/OrderSessionService.java
- BE/channel-service/src/test/java/com/fix/channel/controller/ChannelErrorContractTest.java
- BE/channel-service/src/test/java/com/fix/channel/integration/OrderSessionIntegrationTest.java
- BE/channel-service/src/test/java/com/fix/channel/serialization/OrderSessionResponseSerializationTest.java
- BE/channel-service/src/test/java/com/fix/channel/service/OrderSessionServiceTest.java
- BE/channel-service/src/test/java/com/fix/channel/testsupport/OrderSessionTestFixture.java

### Change Log

- 2026-03-16: Implemented canonical backend order-session transition governance, expiry auditing, and status-specific response serialization.
- 2026-03-16: Senior Developer Review resolved the execute-path Redis TTL source-of-truth gap and added stale-`AUTHED` execute rejection coverage.
- 2026-03-16: Adversarial review pass added terminal-state serializer regressions and a real execute-response contract check for active-window metadata omission.

## Senior Developer Review (AI)

### Review Date

2026-03-16

### Reviewer

GPT-5 Codex (Adversarial Review Mode)

### Outcome

Approved after follow-up fixes

### Summary

- Total findings: 1
- High severity: 1
- Medium severity: 0
- Low severity: 0
- Git vs Story File List discrepancies: 0

### Findings

- [resolved][high] `BE/channel-service/src/main/java/com/fix/channel/service/OrderExecutionService.java` originally checked only DB `expiresAt` before execution, so an `AUTHED` session whose Redis TTL had already disappeared could still reach CoreBanking. The follow-up fix routes execute-time validation through the canonical active-window guard and covers the stale-session rejection with an integration regression test.

### Follow-up Round

- 2026-03-16: Resolved story artifact drift where `Story Completion Status` still said `ready-for-dev` after the story had already been marked `done`.
- 2026-03-16: Resolved evidence drift by adding `ChannelErrorContractTest` and `OrderSessionTestFixture` to the file list because they now carry accepted terminal-contract coverage for this story.
- 2026-03-16: Resolved terminal serializer blind spots by adding explicit `FAILED(OTP_EXCEEDED)` and `CANCELED(PARTIAL_FILL_CANCEL)` regression tests.
- 2026-03-16: Resolved the missing real-boundary execute response contract check by asserting terminal responses omit active-window metadata while keeping nullable terminal fields explicit.
- 2026-03-16: Additional high/medium findings after the follow-up fixes: 0.
