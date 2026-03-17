# Story 7.5: [CH] Admin Session & Audit APIs

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an administrator,
I want forced session invalidation and audit retrieval,
So that security incidents can be handled quickly.

## Acceptance Criteria

1. Given admin role request When invalidate-session API called Then target member sessions are removed.
2. Given audit query filters When endpoint executes Then paginated and filterable audit list is returned.
3. Given non-admin caller When admin API is called Then forbidden response is returned.
4. Given privileged action executed When operation completes Then admin identity is recorded.

## Tasks / Subtasks

- [ ] Implement acceptance-criteria scope 1 (AC: 1)
  - [ ] Add test coverage for AC 1
- [ ] Implement acceptance-criteria scope 2 (AC: 2)
  - [ ] Add test coverage for AC 2
- [ ] Implement acceptance-criteria scope 3 (AC: 3)
  - [ ] Add test coverage for AC 3
- [ ] Implement acceptance-criteria scope 4 (AC: 4)
  - [ ] Add test coverage for AC 4

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

- Status set to `ready-for-dev`.
- Completion note: Epic 7 story context prepared from canonical planning artifact with explicit endpoint, error, and dependency guardrails added.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 7, Story 7.5)
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `_bmad-output/planning-artifacts/channels/api-spec.md`
- `_bmad-output/implementation-artifacts/8-1-audit-security-event-model.md`
- `_bmad-output/implementation-artifacts/epic-7-observability-api-docs-and-readme.md` (supplemental only)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Generated from canonical planning artifact for Epic 7.

### Completion Notes List

- Story scaffold generated with canonical numbering guardrail.
- Added explicit admin endpoint contract, idempotency rules, and dependency gate against Story 8.1.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/7-5-admin-session-and-audit-apis.md
