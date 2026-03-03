# FIX 전체 UseCase 분기 카탈로그

이 문서는 다음 명세를 기준으로 유스케이스 분기를 통합 정리한다.
- `_bmad-output/planning-artifacts/epics.md` (정식 스토리/AC 분기 원천)
- `_bmad-output/planning-artifacts/prd.md` (운영/복구/오류코드 보강)
- `_bmad-output/planning-artifacts/architecture.md` (기술 제약/복구 분기 보강)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (화면/경험 분기 보강)

## 1) 스토리 기반 전체 분기 (Epic 0~10)

### Story 0.1: [BE][CH] Core Platform Baseline

- Depends On: 없음
- 분기 수: 9

- BR-0.1-01
  - Given: a clean checkout  
  - When: `./gradlew build` runs  
  - Then: all backend modules compile without error.
- BR-0.1-02
  - Given: docker compose setup files  
  - When: `docker compose up` is executed  
  - Then: channel/corebank/fep-gateway/fep-simulator services become healthy.
- BR-0.1-03
  - Given: Flyway configuration for channel/corebank schemas  
  - When: services start  
  - Then: baseline migrations and local/test seed data run without error.
- BR-0.1-04
  - Given: internal service boundaries  
  - When: internal endpoint is called without secret header  
  - Then: request is blocked by scaffold filter.
- BR-0.1-05
  - Given: common error contract requirement  
  - When: API exception occurs  
  - Then: standardized error schema is returned.
- BR-0.1-06
  - Given: local developer visibility requirements  
  - When: `docker-compose.override.yml` is applied  
  - Then: MySQL/Redis/internal service ports are reachable for local tools only.
- BR-0.1-07
  - Given: SpringDoc build-time generation is configured for channel/corebank/fep-gateway/fep-simulator services  
  - When: `generateOpenApiDocs` tasks run  
  - Then: each service outputs a valid OpenAPI 3.0 JSON artifact.
- BR-0.1-08
  - Given: a merge to `main` with backend CI passing  
  - When: `docs-publish.yml` completes  
  - Then: GitHub Pages (`https://<org>.github.io/<repo>/`) is the canonical API docs endpoint and renders Channel/CoreBank/FEP Gateway/FEP Simulator selectors from latest generated specs.
- BR-0.1-09
  - Given: first deployment on a repository without Pages source configuration  
  - When: initial docs publish run completes  
  - Then: one-time Pages source setup (`gh-pages` / root) is completed and recorded in ops runbook.

### Story 0.2: [BE][CH] Test & CI Foundation

- Depends On: Story 0.1
- 분기 수: 4

- BR-0.2-01
  - Given: Testcontainers base classes  
  - When: integration tests execute  
  - Then: MySQL/Redis test resources spin up deterministically.
- BR-0.2-02
  - Given: WireMock dependency policy  
  - When: contract test stubs are compiled  
  - Then: test module resolves all required classes.
- BR-0.2-03
  - Given: CI split workflow design in BE repository workflows (`BE/.github/workflows`)  
  - When: push/PR occurs  
  - Then: service-scoped pipelines execute independently.
- BR-0.2-04
  - Given: failed quality check  
  - When: pipeline runs  
  - Then: merge is blocked by status check in BE repository branch protection.

### Story 0.3: [FE] Frontend Foundation Scaffold

- Depends On: Story 0.1
- 분기 수: 4

- BR-0.3-01
  - Given: Vite + TypeScript scaffold  
  - When: local dev server runs  
  - Then: build and HMR work without runtime error.
- BR-0.3-02
  - Given: API base URL configuration  
  - When: client requests backend health endpoint  
  - Then: call succeeds via configured proxy/baseURL.
- BR-0.3-03
  - Given: path alias convention  
  - When: imports use alias paths  
  - Then: compile and runtime resolution both succeed.
- BR-0.3-04
  - Given: shared error interceptor policy  
  - When: backend returns standard error schema  
  - Then: web layer parses and displays normalized message.

### Story 0.4: [MOB] Mobile Foundation Scaffold

- Depends On: Story 0.1
- 분기 수: 6

- BR-0.4-01
  - Given: mobile project scaffold  
  - When: project is built and launched  
  - Then: baseline app runs on target simulator/device.
- BR-0.4-02
  - Given: env-based API config  
  - When: mobile calls backend health endpoint  
  - Then: request succeeds against host matrix (`Android emulator=http://10.0.2.2:8080`, `iOS simulator=http://localhost:8080`, `physical device=http://<LAN_IP>:8080`) with `GET /actuator/health` HTTP 200 within 5s.
- BR-0.4-03
  - Given: common network module  
  - When: API errors occur  
  - Then: mobile receives parsed standardized error payload.
- BR-0.4-04
  - Given: server-side cookie session policy  
  - When: session is issued  
  - Then: mobile persists no raw credentials/password/OTP in app storage and uses OS-approved secure storage controls for any sensitive client-side secret material.
- BR-0.4-05
  - Given: cookie-session + CSRF contract for state-changing API calls  
  - When: mobile sends non-GET request  
  - Then: client includes credentials and `X-XSRF-TOKEN` header derived from `XSRF-TOKEN` cookie after explicit CSRF bootstrap/refresh (`GET /api/v1/auth/csrf`) on app start/login/resume.
- BR-0.4-06
  - Given: foundation CI runs bundle-only checks  
  - When: PR is prepared for merge  
  - Then: AC1 is satisfied only after manual simulator/device smoke evidence (boot log/screenshot + health-call capture) is attached in PR checklist.

### Story 0.5: [BE][CH] Collaboration Webhook Notifications (MatterMost + Jira + GitHub)

- Depends On: Story 0.2
- 분기 수: 7

- BR-0.5-01
  - Given: GitHub webhook events (`pull_request`, `workflow_run`)  
  - When: GitHub Actions workflow posts to MatterMost incoming webhook  
  - Then: MatterMost receives standardized notifications with repository, actor, link, and result.
- BR-0.5-02
  - Given: Jira webhook events for issue lifecycle transitions  
  - When: Jira Automation rule sends transition event to MatterMost webhook  
  - Then: MatterMost receives issue key, summary, previous/new status, and assignee context.
- BR-0.5-03
  - Given: webhook secrets and integration endpoints  
  - When: runtime configuration is applied  
  - Then: credentials are managed only via GitHub Secrets and Jira secured webhook settings (no hardcoding).
- BR-0.5-04
  - Given: duplicate delivery or retry from source systems  
  - When: normalized dedupe key `source + source_project + target_channel + event_type + entity_id + normalized_target_status + normalized_actor` (`null`/missing -> `_`) or source event id (`delivery_id`/equivalent) repeats within source suppression window (`GitHub=10m`, `Jira=10m`)  
  - Then: duplicated user-visible posts are suppressed.
- BR-0.5-05
  - Given: direct integration architecture (no central relay)  
  - When: dedupe state is persisted  
  - Then: source-specific dedupe contract is explicit and auditable (`GitHub`: Actions cache key `mm-dedupe-{dedupe_hash}-{window_bucket_10m}` where `window_bucket_10m=floor(event_epoch/600)`; `Jira`: entity/property `mm_last_hash` + `mm_last_ts` with 10-minute timestamp comparison).
- BR-0.5-06
  - Given: outbound posting failure to MatterMost  
  - When: network timeout or non-2xx response occurs  
  - Then: source retry policy executes with bounded retries (`max_attempts=3`) using source-specific backoff contract (`GitHub`: `2s`,`5s` + jitter `±20%`; `Jira`: fixed `2s`,`5s` without jitter due platform limits), per-source+per-entity ordering guard, and final failure visibility in run/audit logs.
- BR-0.5-07
  - Given: reliability validation runbook execution  
  - When: duplicate and failure scenarios are replayed  
  - Then: evidence artifacts are indexed under `docs/ops/webhook-validation/<YYYYMMDD>/` with reproducible naming and enforced retention configuration (`>=90 days`).

### Story 0.6: [BE][FE][MOB][CH] Multi-Repo Collaboration Webhook Rollout

- Depends On: Story 0.5
- 분기 수: 5

- BR-0.6-01
  - Given: repository topology includes `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, and `FIXYZ-MOB`  
  - When: rollout is complete  
  - Then: each repository has a repository-local GitHub->MatterMost workflow for PR/workflow events.
- BR-0.6-02
  - Given: secure runtime configuration  
  - When: workflows are configured  
  - Then: `MATTERMOST_WEBHOOK_URL` is configured per repository secret and never hardcoded.
- BR-0.6-03
  - Given: channel routing requirements  
  - When: variable configuration is applied  
  - Then: each repository can independently set `MATTERMOST_CHANNEL_KEY` without code edits.
- BR-0.6-04
  - Given: reliability contracts from Story 0.5  
  - When: notifications are posted from each repository  
  - Then: dedupe/retry/failure-observability behavior remains contract-compatible.
- BR-0.6-05
  - Given: per-repository validation runs  
  - When: duplicate and failure scenarios are replayed in each repository  
  - Then: repository-scoped evidence is indexed under `docs/ops/webhook-validation/<YYYYMMDD>/`.

### Story 0.7: [BE][CH] Edge Gateway Baseline (Nginx)

- Depends On: Story 0.1
- 분기 수: 4

- BR-0.7-01
  - Given: edge proxy option decision (`Nginx`)  
  - When: Epic 0 edge baseline is finalized  
  - Then: a documented ADR records selected option, rationale, and operational trade-offs.
- BR-0.7-02
  - Given: external traffic enters through edge proxy  
  - When: requests are routed  
  - Then: channel/corebank/fep-gateway/fep-simulator routes are forwarded by explicit upstream rules.
- BR-0.7-03
  - Given: TLS and security baseline requirements  
  - When: edge config is applied  
  - Then: HTTPS termination, HSTS, and baseline security headers are enforced.
- BR-0.7-04
  - Given: edge failure scenarios  
  - When: upstream is unhealthy  
  - Then: health-check and deterministic error responses are observable in logs/metrics.

### Story 0.8: [BE][CH] Vault Secrets Foundation

- Depends On: Story 0.1
- 분기 수: 4

- BR-0.8-01
  - Given: secret management policy  
  - When: Vault baseline is configured  
  - Then: app/infrastructure secrets are sourced from Vault paths rather than hardcoded or committed files.
- BR-0.8-02
  - Given: CI/CD and runtime authentication needs  
  - When: service identity is configured  
  - Then: Vault access uses short-lived auth mechanisms and least-privilege policies.
- BR-0.8-03
  - Given: secret rotation requirement  
  - When: rotation drill is executed  
  - Then: at least one critical secret is rotated without service outage.
- BR-0.8-04
  - Given: audit requirements  
  - When: secret read/write happens  
  - Then: Vault audit logs provide traceable access records.

### Story 0.9: [BE][CH] Additional Infrastructure Bootstrap

- Depends On: Story 0.7, Story 0.8
- 분기 수: 3

- BR-0.9-01
  - Given: infrastructure baseline scope  
  - When: bootstrap scripts/IaC are executed  
  - Then: required shared components (network, ingress, cache, message/event utilities if needed) are provisioned reproducibly.
- BR-0.9-02
  - Given: environment drift risk  
  - When: bootstrap validation runs  
  - Then: configuration parity checks detect missing or divergent components.
- BR-0.9-03
  - Given: onboarding requirements  
  - When: a new engineer follows runbook  
  - Then: environment bootstrap succeeds using documented commands only.

### Story 0.10: [AC][CH] Database High Availability and Replication Baseline

- Depends On: Story 0.9
- 분기 수: 7

- BR-0.10-01
  - Given: primary-replica architecture baseline  
  - When: database topology is provisioned  
  - Then: replication is healthy and lag is observable with alert thresholds.
- BR-0.10-02
  - Given: application read/write contract  
  - When: runtime configuration is applied  
  - Then: writes are pinned to primary and read-routing strategy is explicit/documented.
- BR-0.10-03
  - Given: failover drill scenario  
  - When: primary node is simulated unavailable  
  - Then: recovery procedure and measured targets (`RTO <= 300s`, `RPO <= 60s`) are captured with explicit calculation method.
- BR-0.10-04
  - Given: backup and restore requirements  
  - When: recovery rehearsal is executed  
  - Then: restore integrity is validated against deterministic `SHA-256` checksum procedure.
- BR-0.10-05
  - Given: alerting requirements  
  - When: lag/failure thresholds are evaluated  
  - Then: alert rules apply explicit windows (`warn: lag >= 5s for 3 samples @10s`, `critical: lag >= 30s for 2 samples @10s` or replication stopped >= 60s).
- BR-0.10-06
  - Given: architecture baseline contains single-node local runtime decision  
  - When: HA baseline is introduced  
  - Then: ADR records HA scope boundary (`deploy/staging`) and rollback assumptions.
- BR-0.10-07
  - Given: read-replica consistency trade-off  
  - When: read-routing is enabled  
  - Then: strong-consistency endpoint allowlist is pinned to primary and tested against stale-read risk.

### Story 0.11: [BE][FE][MOB][CH] Supply Chain Security Baseline

- Depends On: Story 0.2, Story 0.6
- 분기 수: 12

- BR-0.11-01
  - Given: repository topology includes `FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, and `FIXYZ-MOB`  
  - When: supply-chain baseline is applied  
  - Then: each repository has ecosystem-appropriate dependency update and scan configuration.
- BR-0.11-02
  - Given: scheduled and PR-triggered security scans  
  - When: vulnerabilities are analyzed  
  - Then: findings are published with repository, package, severity, and fix availability context.
- BR-0.11-03
  - Given: high-risk vulnerability policy (`CVSS >= 7.0`)  
  - When: unresolved critical/high findings exist on target branch  
  - Then: merge is blocked by required security status checks.
- BR-0.11-04
  - Given: unavoidable false-positive or temporary exception cases  
  - When: suppression is requested  
  - Then: time-bounded exception process with owner, reason, expiry, audit trail, and auto-expiry re-blocking is enforced.
- BR-0.11-05
  - Given: evidence and audit requirements  
  - When: scan workflow completes  
  - Then: reports are retained and indexed under `docs/ops/security-scan/<YYYYMMDD>/`.
- BR-0.11-06
  - Given: secret-handling constraints  
  - When: scan/reporting workflows run  
  - Then: credentials/tokens are not hardcoded or exposed in logs.
- BR-0.11-07
  - Given: branch-protection integration needs  
  - When: baseline rollout completes  
  - Then: required security checks are verifiably bound in all 4 repositories with evidence artifacts.
- BR-0.11-08
  - Given: multi-source CVSS scoring differences  
  - When: threshold decision is made  
  - Then: score precedence is explicit (`GitHub Advisory CVSS` primary, `NVD` fallback).
- BR-0.11-09
  - Given: GitHub Actions supply-chain risk  
  - When: security workflows are defined  
  - Then: actions are SHA-pinned or temporary exception record is required with auto-expiry.
- BR-0.11-10
  - Given: advisories without CVSS score in primary/fallback sources  
  - When: risk is evaluated  
  - Then: finding enters mandatory manual-triage state and merge remains blocked until decision.
- BR-0.11-11
  - Given: action pinning operational constraints  
  - When: action cannot be pinned immediately  
  - Then: time-bounded exception record is required and policy reverts to blocking on expiry.
- BR-0.11-12
  - Given: evidence collection requirements  
  - When: workflows complete  
  - Then: evidence follows fixed machine-readable artifact contract (`index.json`, `scan-summary-<repo>.json`, `branch-protection-<repo>.json`, `exceptions-<repo>.json`).

### Story 0.12: [BE][CH] Redis Recovery and Self-Healing Baseline

- Depends On: Story 0.2, Story 0.9
- 분기 수: 8

- BR-0.12-01
  - Given: Redis restart fault injection scenario  
  - When: `redis` is restarted during active platform runtime  
  - Then: all backend services recover to healthy status within 60 seconds without manual service restarts, using internal-network probe execution context.
- BR-0.12-02
  - Given: outage window during Redis unavailability  
  - When: stateful endpoints are called  
  - Then: failures are deterministic and normalized, with no unrecoverable stuck session/order state after recovery.
- BR-0.12-03
  - Given: post-restart verification flow  
  - When: recovery checks run  
  - Then: representative authentication/session/order smoke scenarios pass after Redis returns.
- BR-0.12-04
  - Given: repeatable recovery drill requirement  
  - When: automation script or CI job executes the drill  
  - Then: timestamps, measured recovery duration, and pass/fail threshold outputs are captured.
- BR-0.12-05
  - Given: operations runbook requirements  
  - When: an engineer follows documented recovery steps  
  - Then: troubleshooting matrix and escalation path are actionable from runbook only.
- BR-0.12-06
  - Given: stuck-state guardrail requirement  
  - When: recovery validation runs  
  - Then: no non-terminal order session exceeds `TTL + 60s` (`TTL` default 600s unless documented override).
- BR-0.12-07
  - Given: full-operational verdict requirement  
  - When: drill completes  
  - Then: success quorum is 100% pass across required probes in a single run.
- BR-0.12-08
  - Given: internal service exposure policy (`NFR-S4`)  
  - When: recovery probes are executed  
  - Then: internal service probes run from compose network context, not host-exposed ports.

### Story 1.1: [BE][CH] Registration & Login Session Core

- Depends On: Story 0.1
- 분기 수: 4

- BR-1.1-01
  - Given: valid registration payload  
  - When: user submits sign-up request  
  - Then: member is created with default role and secure password hash.
- BR-1.1-02
  - Given: valid login credentials  
  - When: authentication succeeds  
  - Then: Redis-backed session cookie is issued with secure attributes.
- BR-1.1-03
  - Given: duplicate login attempts from same account  
  - When: second session is established  
  - Then: previous session is invalidated by policy.
- BR-1.1-04
  - Given: invalid credentials  
  - When: login fails  
  - Then: normalized authentication error is returned.

### Story 1.2: [BE][CH] Logout, Profile, Session Security

- Depends On: Story 1.1
- 분기 수: 4

- BR-1.2-01
  - Given: valid authenticated session  
  - When: logout API is called  
  - Then: session is deleted server-side and cookie is expired.
- BR-1.2-02
  - Given: profile/password update request  
  - When: validation passes  
  - Then: account profile is updated with audit trail.
- BR-1.2-03
  - Given: expired or invalidated session  
  - When: protected endpoint is called  
  - Then: API returns authentication-required error.
- BR-1.2-04
  - Given: session timeout policy  
  - When: inactivity exceeds threshold  
  - Then: session is treated as expired.

### Story 1.3: [FE] Web Auth Flow

- Depends On: Story 1.1, Story 1.2, Story 0.3
- 분기 수: 4

- BR-1.3-01
  - Given: login and register screens  
  - When: valid credentials are submitted  
  - Then: user is navigated to protected area.
- BR-1.3-02
  - Given: unauthenticated access to private route  
  - When: route guard runs  
  - Then: user is redirected to login.
- BR-1.3-03
  - Given: server-auth error  
  - When: response arrives  
  - Then: standardized UX error message is shown.
- BR-1.3-04
  - Given: session expiration notification event  
  - When: web receives it  
  - Then: user sees re-auth guidance.

### Story 1.4: [MOB] Mobile Auth Flow

- Depends On: Story 1.1, Story 1.2, Story 0.4
- 분기 수: 4

- BR-1.4-01
  - Given: mobile login/register screens  
  - When: valid form is submitted  
  - Then: user enters authenticated app stack.
- BR-1.4-02
  - Given: invalid or expired session  
  - When: protected API is called  
  - Then: mobile routes user to re-auth flow.
- BR-1.4-03
  - Given: auth API validation error  
  - When: response is returned  
  - Then: field-level or global message is shown.
- BR-1.4-04
  - Given: device app resume  
  - When: session state is checked  
  - Then: stale sessions are rejected deterministically.

### Story 1.5: [BE][CH] Auth Guardrails (Lockout/Rate Limit)

- Depends On: Story 1.1
- 분기 수: 4

- BR-1.5-01
  - Given: repeated failed login attempts by IP  
  - When: threshold is exceeded  
  - Then: login endpoint returns rate-limit error.
- BR-1.5-02
  - Given: repeated failed login attempts by account  
  - When: threshold is exceeded  
  - Then: account transitions to locked state.
- BR-1.5-03
  - Given: locked account  
  - When: correct password is submitted  
  - Then: login remains denied until admin unlock.
- BR-1.5-04
  - Given: lockout event  
  - When: recorded  
  - Then: security event is persisted.

### Story 1.6: [FE/MOB] Auth Error Standardization

- Depends On: Story 1.3, Story 1.4, Story 1.5
- 분기 수: 3

- BR-1.6-01
  - Given: identical backend auth code  
  - When: FE and MOB render message  
  - Then: user-facing semantics are aligned.
- BR-1.6-02
  - Given: lockout/expired/rate-limit cases  
  - When: triggered  
  - Then: both clients show recoverable next actions.
- BR-1.6-03
  - Given: untranslated or unknown code  
  - When: received  
  - Then: fallback message and correlation id are surfaced.

### Story 2.1: [BE][AC] Schema & Auto Account Provisioning

- Depends On: Story 0.1, Story 1.1
- 분기 수: 4

- BR-2.1-01
  - Given: migration scripts  
  - When: service boots  
  - Then: account/member tables are created with required constraints.
- BR-2.1-02
  - Given: successful member registration event  
  - When: provisioning endpoint is called  
  - Then: default account is created idempotently.
- BR-2.1-03
  - Given: duplicate provisioning request  
  - When: same member is targeted  
  - Then: account duplication does not occur.
- BR-2.1-04
  - Given: provisioning failure  
  - When: transaction is rolled back  
  - Then: failure reason is returned with normalized code.

### Story 2.2: [BE][AC] Position & Available-Quantity API

- Depends On: Story 2.1, Story 1.2
- 분기 수: 4

- BR-2.2-01
  - Given: valid owned account  
  - When: position/balance API is called  
  - Then: current position quantity, available quantity, and cash balance are returned.
- BR-2.2-02
  - Given: non-owned account request  
  - When: authorization is checked  
  - Then: access is denied.
- BR-2.2-03
  - Given: concurrent updates  
  - When: reads occur  
  - Then: response remains transactionally consistent.
- BR-2.2-04
  - Given: downstream error  
  - When: query fails  
  - Then: normalized retriable/non-retriable code is returned.

### Story 2.3: [BE][AC] Order History API

- Depends On: Story 2.1, Story 1.2
- 분기 수: 5

- BR-2.3-01
  - Given: owned account with order records  
  - When: order history API is called  
  - Then: results are paginated, include symbol/qty/status/clOrdID, and ordered by created time desc.
- BR-2.3-02
  - Given: order history table columns  
  - When: rendered  
  - Then: columns are: 종목명(symbolName), 구분(side: BUY/SELL), 수량(qty), 체결단가(unitPrice), 체결금액(totalAmount), 상태(status), ClOrdID.
- BR-2.3-03
  - Given: empty history  
  - When: query executes  
  - Then: empty content contract is returned consistently.
- BR-2.3-04
  - Given: unauthorized account id  
  - When: access check fails  
  - Then: API returns forbidden error.
- BR-2.3-05
  - Given: malformed pagination params  
  - When: validation runs  
  - Then: 400 validation error is returned.

### Story 2.4: [FE] Web Portfolio Dashboard & History

- Depends On: Story 2.2, Story 2.3, Story 1.3
- 분기 수: 4

- BR-2.4-01
  - Given: authenticated session  
  - When: dashboard loads  
  - Then: portfolio summary and position quantities are displayed.
- BR-2.4-02
  - Given: order history tab interaction  
  - When: page/filter is changed  
  - Then: server-driven order history list updates correctly.
- BR-2.4-03
  - Given: API failure  
  - When: error occurs  
  - Then: user sees standardized retry guidance.
- BR-2.4-04
  - Given: account number policy  
  - When: UI renders values  
  - Then: masking format is applied consistently.

### Story 2.5: [MOB] Mobile Portfolio Dashboard & History

- Depends On: Story 2.2, Story 2.3, Story 1.4
- 분기 수: 4

- BR-2.5-01
  - Given: authenticated mobile session  
  - When: dashboard screen opens  
  - Then: positions and portfolio summaries render correctly.
- BR-2.5-02
  - Given: pull-to-refresh on order history  
  - When: user requests refresh  
  - Then: latest order records load without duplications.
- BR-2.5-03
  - Given: empty or error response  
  - When: screen state resolves  
  - Then: empty/error states follow UI standard.
- BR-2.5-04
  - Given: masked account display policy  
  - When: numbers render  
  - Then: same masking rule as web is applied.

### Story 2.6: [BE][AC] Account Status Contract

- Depends On: Story 2.1
- 분기 수: 3

- BR-2.6-01
  - Given: account status model  
  - When: status endpoint is queried  
  - Then: `ACTIVE/LOCKED` and related metadata are returned.
- BR-2.6-02
  - Given: locked account  
  - When: order flow requests eligibility  
  - Then: denial reason code is deterministic.
- BR-2.6-03
  - Given: status transition event  
  - When: status changes  
  - Then: audit/security event is emitted.

### Story 3.1: [BE][FEP] FEP DTO/Client Contract

- Depends On: Story 0.1
- 분기 수: 4

- BR-3.1-01
  - Given: outbound order payload  
  - When: mapped to FEP DTO  
  - Then: required fields (clOrdID, symbol, qty, side) are validated before send.
- BR-3.1-02
  - Given: response payload from FEP  
  - When: parsed  
  - Then: internal contract is mapped with explicit status values.
- BR-3.1-03
  - Given: contract-breaking change  
  - When: build/test runs  
  - Then: failing contract test blocks merge.
- BR-3.1-04
  - Given: contract versioning policy  
  - When: schema evolves  
  - Then: backward compatibility rule is enforced.

### Story 3.2: [BE][FEP] External Error Taxonomy

- Depends On: Story 3.1
- 분기 수: 4

- BR-3.2-01
  - Given: FEP rejection/system errors  
  - When: adapter receives them  
  - Then: internal error taxonomy is applied deterministically.
- BR-3.2-02
  - Given: unmapped FEP code  
  - When: received  
  - Then: fallback unknown-external code is returned.
- BR-3.2-03
  - Given: mapped external error  
  - When: propagated to channel  
  - Then: user-facing message key and operator code are both available.
- BR-3.2-04
  - Given: taxonomy table update  
  - When: regression test runs  
  - Then: mapping matrix assertions pass.

### Story 3.3: [BE][FEP] ReferenceId & Idempotency Policy

- Depends On: Story 3.1
- 분기 수: 4

- BR-3.3-01
  - Given: duplicate external request identity  
  - When: replayed  
  - Then: adapter returns existing processing context.
- BR-3.3-02
  - Given: cross-owner duplicate misuse  
  - When: validation executes  
  - Then: request is rejected as unauthorized.
- BR-3.3-03
  - Given: idempotency retention window  
  - When: expired key is reused  
  - Then: policy behavior is deterministic and documented.
- BR-3.3-04
  - Given: replay-denied case  
  - When: handled  
  - Then: security/audit event is recorded.

### Story 3.4: [BE][FEP] FEP Status Query API

- Depends On: Story 3.1
- 분기 수: 4

- BR-3.4-01
  - Given: known external reference  
  - When: status API is queried  
  - Then: latest known status is returned in normalized shape.
- BR-3.4-02
  - Given: unknown external reference  
  - When: status API is queried  
  - Then: `UNKNOWN` result is returned without schema drift.
- BR-3.4-03
  - Given: temporary external timeout  
  - When: status query fails  
  - Then: retriable classification is returned.
- BR-3.4-04
  - Given: repeated query from scheduler  
  - When: threshold is exceeded  
  - Then: escalation signal is produced.

### Story 3.5: [BE][FEP] Contract Test Suite

- Depends On: Story 3.2, Story 3.4
- 분기 수: 4

- BR-3.5-01
  - Given: canonical WireMock stubs  
  - When: CI runs  
  - Then: request header/body and response mapping assertions pass.
- BR-3.5-02
  - Given: changed contract field  
  - When: stub and mapper diverge  
  - Then: pipeline fails with explicit mismatch.
- BR-3.5-03
  - Given: error taxonomy scenarios  
  - When: test matrix executes  
  - Then: all expected code mappings are validated.
- BR-3.5-04
  - Given: correlation-id propagation requirement  
  - When: outbound call verified  
  - Then: trace header presence is asserted.

### Story 3.6: [FE/MOB] Visible External Error UX

- Depends On: Story 3.2
- 분기 수: 3

- BR-3.6-01
  - Given: external failure code mapping  
  - When: FE/MOB receives error  
  - Then: action-oriented message is displayed.
- BR-3.6-02
  - Given: ambiguous unknown external state  
  - When: shown to user  
  - Then: recovery guidance avoids false completion claims.
- BR-3.6-03
  - Given: same error code on FE and MOB  
  - When: rendered  
  - Then: parity of UX semantics is maintained.

### Story 4.1: [BE][CH] Order Session Create/Status + Ownership

- Depends On: Story 1.2, Story 2.2
- 분기 수: 4

- BR-4.1-01
  - Given: valid order initiation request  
  - When: session API is called  
  - Then: order session is created with PENDING_NEW status and TTL.
- BR-4.1-02
  - Given: status query for owned session  
  - When: endpoint is called  
  - Then: current session state is returned.
- BR-4.1-03
  - Given: non-owner session access  
  - When: query or action occurs  
  - Then: forbidden error is returned.
- BR-4.1-04
  - Given: expired session  
  - When: status/action is requested  
  - Then: not-found/expired contract is returned.

### Story 4.2: [BE][CH] OTP Verification Policy

- Depends On: Story 4.1, Story 1.2
- 분기 수: 4

- BR-4.2-01
  - Given: valid OTP in allowed time window  
  - When: verify endpoint is called  
  - Then: verification succeeds and session can advance.
- BR-4.2-02
  - Given: duplicate rapid verify attempts  
  - When: debounce policy applies  
  - Then: request is throttled without attempt over-consumption.
- BR-4.2-03
  - Given: OTP replay in same window  
  - When: replay is detected  
  - Then: request is rejected.
- BR-4.2-04
  - Given: max attempts exceeded  
  - When: further verify is attempted  
  - Then: session is failed and execution blocked.

### Story 4.3: [BE][CH] FSM Transition Governance

- Depends On: Story 4.2
- 분기 수: 4

- BR-4.3-01
  - Given: order session FSM definition (see `architecture.md §OrderSession FSM`)  
  - When: state transition command is applied  
  - Then: only allowed transitions are accepted.
- BR-4.3-02
  - Given: invalid transition request  
  - When: attempted  
  - Then: deterministic conflict/error is returned.
- BR-4.3-03
  - Given: state persistence event  
  - When: transition completes  
  - Then: status and timestamps are stored consistently.
- BR-4.3-04
  - Given: API status response  
  - When: serialized  
  - Then: optional fields follow status-specific contract.

### Story 4.4: [FE] Web Order Step A/B

- Depends On: Story 4.1, Story 2.4
- 분기 수: 4

- BR-4.4-01
  - Given: step A order form (symbol/qty input)  
  - When: user submits valid symbol and quantity  
  - Then: order session initiation API is called successfully.
- BR-4.4-02
  - Given: invalid form data  
  - When: validation runs  
  - Then: client-side and server-side errors are shown.
- BR-4.4-03
  - Given: transition to step B  
  - When: order session advances to OTP step  
  - Then: OTP input UI becomes active.
- BR-4.4-04
  - Given: API/network error  
  - When: request fails  
  - Then: user receives retry guidance.

### Story 4.5: [FE] Web OTP + Step C

- Depends On: Story 4.2, Story 4.3, Story 4.4
- 분기 수: 4

- BR-4.5-01
  - Given: valid OTP submission  
  - When: verify succeeds  
  - Then: UI transitions to confirmation/execution step.
- BR-4.5-02
  - Given: OTP failure cases  
  - When: code is invalid/expired/replayed  
  - Then: mapped error message is displayed.
- BR-4.5-03
  - Given: execution in progress  
  - When: status polling/SSE updates  
  - Then: result screen reflects final order state (FILLED/REJECTED/FAILED).
- BR-4.5-04
  - Given: final state response  
  - When: FILLED/REJECTED/FAILED returned  
  - Then: ClOrdID and failure reason are rendered conditionally.

### Story 4.6: [MOB] Mobile Order Step A/B

- Depends On: Story 4.1, Story 2.5
- 분기 수: 4

- BR-4.6-01
  - Given: step A mobile order form  
  - When: submission succeeds  
  - Then: order session is created and step B is shown.
- BR-4.6-02
  - Given: invalid symbol/quantity input  
  - When: validation fails  
  - Then: contextual error indicators are displayed.
- BR-4.6-03
  - Given: OTP pending session  
  - When: user navigates to OTP step  
  - Then: remaining session context is preserved.
- BR-4.6-04
  - Given: navigation interruption  
  - When: user returns  
  - Then: state restoration logic preserves flow continuity.

### Story 4.7: [MOB] Mobile OTP + Step C

- Depends On: Story 4.2, Story 4.3, Story 4.6
- 분기 수: 4

- BR-4.7-01
  - Given: OTP verify on mobile  
  - When: valid code is entered  
  - Then: app transitions to confirmation/execution.
- BR-4.7-02
  - Given: OTP or execution errors  
  - When: response received  
  - Then: user sees mapped action guidance.
- BR-4.7-03
  - Given: final result response  
  - When: FILLED/REJECTED/FAILED  
  - Then: ClOrdID and failure reasons are rendered.
- BR-4.7-04
  - Given: app background/foreground cycle  
  - When: session resumes  
  - Then: current order status is recovered.

### Story 4.8: [FE/MOB] Cross-client FSM Parity Validation

- Depends On: Story 4.5, Story 4.7
- 분기 수: 3

- BR-4.8-01
  - Given: same scenario input sequence  
  - When: run on FE and MOB  
  - Then: state transitions are equivalent.
- BR-4.8-02
  - Given: same error codes  
  - When: rendered on both clients  
  - Then: severity/action semantics are aligned.
- BR-4.8-03
  - Given: regression suite  
  - When: CI runs  
  - Then: parity checks pass.

### Story 5.1: [BE][AC] Limit Engine

- Depends On: Story 2.2
- 분기 수: 4

- BR-5.1-01
  - Given: order request with position context  
  - When: position availability and limit check executes  
  - Then: available quantity and daily sell remaining capacity are computed accurately.
- BR-5.1-02
  - Given: order quantity exceeds available position or daily limit  
  - When: availability check fails  
  - Then: rejection includes available quantity and remaining-limit metadata.
- BR-5.1-03
  - Given: exactly-at-limit order request  
  - When: check runs  
  - Then: acceptance/rejection behavior follows documented boundary.
- BR-5.1-04
  - Given: daily window rollover  
  - When: date boundary changes  
  - Then: counters reset according to timezone rule.

### Story 5.2: [BE][AC] Order Execution & Position Update

- Depends On: Story 5.1, Story 4.3
- 분기 수: 4

- BR-5.2-01
  - Given: authorized order execution  
  - When: execution occurs  
  - Then: position deduction and OrderHistory record are committed atomically.
- BR-5.2-02
  - Given: execution failure mid-transaction  
  - When: transaction aborts  
  - Then: neither partial position update nor OrderHistory record persists.
- BR-5.2-03
  - Given: insufficient position quantity condition  
  - When: availability pre-check fails  
  - Then: no position mutation occurs.
- BR-5.2-04
  - Given: successful execution  
  - When: response is built  
  - Then: ClOrdID and order reference are included.

### Story 5.3: [BE][AC] FEP Order Execution Semantics

- Depends On: Story 5.1, Story 3.1, Story 3.2, Story 4.3
- 분기 수: 4

- BR-5.3-01
  - Given: FEP-routed order execution request  
  - When: pre-execution position reservation occurs  
  - Then: order state records FEP reference and clOrdID metadata.
- BR-5.3-02
  - Given: FEP rejection/failure requiring position restoration  
  - When: position restoration path runs  
  - Then: position quantity is restored with traceable order linkage.
- BR-5.3-03
  - Given: FEP unknown/pending outcome  
  - When: order settlement deferred  
  - Then: position state remains reconcilable for later recovery.
- BR-5.3-04
  - Given: FEP order FILLED  
  - When: finalized  
  - Then: final order status (FILLED) and clOrdID references are consistent.

### Story 5.4: [BE][AC] Idempotent Posting

- Depends On: Story 5.2, Story 5.3
- 분기 수: 4

- BR-5.4-01
  - Given: same idempotency key and same owner  
  - When: execution retried  
  - Then: original result is returned without new posting.
- BR-5.4-02
  - Given: same key from different owner  
  - When: request arrives  
  - Then: unauthorized duplication is rejected.
- BR-5.4-03
  - Given: concurrent duplicate requests  
  - When: race occurs  
  - Then: only one execution path commits.
- BR-5.4-04
  - Given: dedupe hit  
  - When: response returned  
  - Then: idempotency indicator is included for diagnostics.

### Story 5.5: [BE][AC] Concurrency Control

- Depends On: Story 5.2
- 분기 수: 5

- BR-5.5-01
  - Given: concurrent order attempts on same symbol  
  - When: symbol-level pessimistic lock policy is applied  
  - Then: final available_qty never becomes negative.
- BR-5.5-02
  - Given: lock contention  
  - When: threshold exceeded  
  - Then: request fails with deterministic conflict/error contract.
- BR-5.5-03
  - Given: 10-thread concurrency test on single symbol (005930 삼성전자)  
  - When: executed in CI  
  - Then: expected success/failure counts and final available_qty assertions pass.
- BR-5.5-04
  - Given: concurrent orders on two different symbols (005930 삼성전자 / 000660 SK하이닉스)  
  - When: executed in parallel  
  - Then: symbol-level lock isolation is verified — each symbol's available_qty converges independently.
- BR-5.5-05
  - Given: lock duration observation  
  - When: measured  
  - Then: operational threshold alerting is available.

### Story 5.6: [BE][AC] Ledger Integrity

- Depends On: Story 5.2, Story 5.3
- 분기 수: 4

- BR-5.6-01
  - Given: completed order set  
  - When: integrity query runs  
  - Then: position deduction/execution(+restoration) invariants hold.
- BR-5.6-02
  - Given: detected mismatch  
  - When: integrity check fails  
  - Then: anomaly is reported with traceable identifiers.
- BR-5.6-03
  - Given: scheduled integrity job  
  - When: executed  
  - Then: summary metrics are stored for operations.
- BR-5.6-04
  - Given: release gate  
  - When: position integrity test fails  
  - Then: build is blocked.

### Story 5.7: [FE/MOB] Visible Result/Error UX

- Depends On: Story 5.1, Story 4.8
- 분기 수: 3

- BR-5.7-01
  - Given: insufficient position/limit errors  
  - When: FE/MOB receives codes  
  - Then: both clients show aligned actionable guidance.
- BR-5.7-02
  - Given: order failure reason code  
  - When: rendered  
  - Then: reason category is distinguishable (internal/external/validation).
- BR-5.7-03
  - Given: successful order execution (FILLED)  
  - When: result rendered  
  - Then: ClOrdID and updated position quantity are shown where required.

### Story 6.1: [BE][FEP] Timeout & Circuit Breaker

- Depends On: Story 3.1
- 분기 수: 4

- BR-6.1-01
  - Given: external call exceeding timeout threshold  
  - When: request executes  
  - Then: timeout classification is returned.
- BR-6.1-02
  - Given: consecutive failures at configured threshold  
  - When: next call occurs  
  - Then: circuit breaker transitions to open behavior.
- BR-6.1-03
  - Given: cool-down window elapsed  
  - When: probe request succeeds  
  - Then: breaker transitions toward closed state.
- BR-6.1-04
  - Given: probe request fails  
  - When: half-open state active  
  - Then: breaker returns to open.

### Story 6.2: [BE][FEP] Retry Boundary Policy

- Depends On: Story 6.1
- 분기 수: 4

- BR-6.2-01
  - Given: retriable status query failure  
  - When: policy applies  
  - Then: bounded retry executes.
- BR-6.2-02
  - Given: non-retriable execution path  
  - When: failure occurs  
  - Then: no automatic duplicate execution retry occurs.
- BR-6.2-03
  - Given: retry exhausted  
  - When: final error returned  
  - Then: classification includes retry metadata.
- BR-6.2-04
  - Given: policy review  
  - When: runbook checked  
  - Then: retriable/non-retriable matrix is documented.

### Story 6.3: [BE][FEP] Chaos Control API

- Depends On: Story 3.1
- 분기 수: 4

- BR-6.3-01
  - Given: admin chaos mode endpoint  
  - When: mode set to NORMAL/TIMEOUT/FAILURE  
  - Then: subsequent behavior reflects chosen mode.
- BR-6.3-02
  - Given: non-admin access  
  - When: mode change is attempted  
  - Then: request is denied.
- BR-6.3-03
  - Given: chaos config query endpoint  
  - When: called  
  - Then: active mode and parameters are returned.
- BR-6.3-04
  - Given: mode switch audit requirement  
  - When: mode changes  
  - Then: operational event is logged.

### Story 6.4: [BE][FEP] UNKNOWN Requery Scheduler

- Depends On: Story 3.4, Story 6.2, Story 4.3
- 분기 수: 4

- BR-6.4-01
  - Given: order in UNKNOWN/EXECUTING timeout state  
  - When: scheduler runs  
  - Then: clOrdID status requery is executed with backoff policy.
- BR-6.4-02
  - Given: requery returns accepted/completed  
  - When: reconciliation runs  
  - Then: order state converges to terminal success (FILLED).
- BR-6.4-03
  - Given: requery repeatedly unknown/failing  
  - When: threshold exceeded  
  - Then: order is escalated to manual recovery queue.
- BR-6.4-04
  - Given: scheduler cycle execution  
  - When: metrics collected  
  - Then: attempt and convergence counters are recorded.

### Story 6.5: [BE][FEP] Manual Replay/Recovery API

- Depends On: Story 6.4
- 분기 수: 4

- BR-6.5-01
  - Given: authorized operator request  
  - When: replay endpoint called  
  - Then: operation is accepted with replay tracking id.
- BR-6.5-02
  - Given: unauthorized caller  
  - When: replay is attempted  
  - Then: forbidden response and security event are produced.
- BR-6.5-03
  - Given: duplicate replay request  
  - When: same replay identity used  
  - Then: idempotent replay behavior is enforced.
- BR-6.5-04
  - Given: replay completion/failure  
  - When: operation ends  
  - Then: final result is auditable.

### Story 6.6: [BE][FEP] Resilience Scenario Tests

- Depends On: Story 6.1, Story 6.2, Story 6.4
- 분기 수: 4

- BR-6.6-01
  - Given: controlled timeout scenario  
  - When: repeated failures occur  
  - Then: CB open transition is asserted.
- BR-6.6-02
  - Given: recovery probe scenario  
  - When: downstream recovers  
  - Then: CB close transition path is asserted.
- BR-6.6-03
  - Given: UNKNOWN requery scenario  
  - When: scheduler executes  
  - Then: convergence/escalation outcomes are asserted.
- BR-6.6-04
  - Given: CI gate policy  
  - When: resilience tests fail  
  - Then: merge/release is blocked.

### Story 6.7: [FE/MOB] Degraded Operation UX

- Depends On: Story 6.3, Story 6.4
- 분기 수: 3

- BR-6.7-01
  - Given: degraded external mode signal  
  - When: FE/MOB receives state  
  - Then: banner/notice communicates delay and expected behavior.
- BR-6.7-02
  - Given: recovery complete signal  
  - When: state normalizes  
  - Then: warning UI is cleared.
- BR-6.7-03
  - Given: prolonged unresolved state  
  - When: threshold exceeded  
  - Then: user sees support/escalation guidance.

### Story 7.1: [BE][CH] SSE Stream Registry

- Depends On: Story 1.2, Story 4.3
- 분기 수: 4

- BR-7.1-01
  - Given: authenticated SSE stream request  
  - When: connection established  
  - Then: emitter is registered for member identity.
- BR-7.1-02
  - Given: duplicate connection for same member  
  - When: new stream opens  
  - Then: previous stream is replaced safely.
- BR-7.1-03
  - Given: disconnected or failed emitter  
  - When: send fails  
  - Then: registry cleanup occurs.
- BR-7.1-04
  - Given: heartbeat policy  
  - When: stream idle  
  - Then: keepalive events are emitted.

### Story 7.2: [BE][CH] Notification Persistence APIs

- Depends On: Story 7.1
- 분기 수: 4

- BR-7.2-01
  - Given: order terminal event (FILLED/REJECTED/FAILED)  
  - When: notification pipeline runs  
  - Then: notification is persisted before/with dispatch.
- BR-7.2-02
  - Given: list API request  
  - When: pagination params applied  
  - Then: ordered notifications are returned.
- BR-7.2-03
  - Given: read-mark request  
  - When: notification id belongs to user  
  - Then: read status is updated.
- BR-7.2-04
  - Given: unauthorized notification access  
  - When: validation fails  
  - Then: request is denied.

### Story 7.3: [FE] Web Notification Center

- Depends On: Story 7.1, Story 7.2
- 분기 수: 4

- BR-7.3-01
  - Given: authenticated web session  
  - When: app mounts provider  
  - Then: single SSE connection is established.
- BR-7.3-02
  - Given: SSE disconnect  
  - When: retry policy executes  
  - Then: bounded retries occur before fallback.
- BR-7.3-03
  - Given: missed-event window  
  - When: reconnection succeeds  
  - Then: fallback list API backfills notifications.
- BR-7.3-04
  - Given: no notifications  
  - When: feed renders  
  - Then: empty state message is shown.

### Story 7.4: [MOB] Mobile Notification Feed

- Depends On: Story 7.1, Story 7.2
- 분기 수: 4

- BR-7.4-01
  - Given: active mobile session  
  - When: notification module starts  
  - Then: live updates are received and stored in UI state.
- BR-7.4-02
  - Given: app network loss/recovery  
  - When: connection is restored  
  - Then: missed notifications are synchronized.
- BR-7.4-03
  - Given: notification read action  
  - When: user marks as read  
  - Then: read state is reflected in app and backend.
- BR-7.4-04
  - Given: repeated disconnects  
  - When: retry threshold exceeded  
  - Then: user sees retry guidance.

### Story 7.5: [BE][CH] Admin Session & Audit APIs

- Depends On: Story 1.2, Story 8.1
- 분기 수: 4

- BR-7.5-01
  - Given: admin role request  
  - When: invalidate-session API called  
  - Then: target member sessions are removed.
- BR-7.5-02
  - Given: audit query filters  
  - When: endpoint executes  
  - Then: paginated and filterable audit list is returned.
- BR-7.5-03
  - Given: non-admin caller  
  - When: admin API is called  
  - Then: forbidden response is returned.
- BR-7.5-04
  - Given: privileged action executed  
  - When: operation completes  
  - Then: admin identity is recorded.

### Story 7.6: [FE] Web Admin Console Screens

- Depends On: Story 7.5
- 분기 수: 4

- BR-7.6-01
  - Given: admin authenticated user  
  - When: admin console opened  
  - Then: session-invalidate and audit search UIs are available.
- BR-7.6-02
  - Given: unauthorized user  
  - When: route access attempted  
  - Then: access is blocked.
- BR-7.6-03
  - Given: admin action result  
  - When: API responds  
  - Then: success/failure feedback is shown.
- BR-7.6-04
  - Given: audit filter input  
  - When: search executed  
  - Then: result list and pagination work correctly.

### Story 7.7: [BE][CH] Channel Security Hardening

- Depends On: Story 1.5, Story 4.2
- 분기 수: 4

- BR-7.7-01
  - Given: sensitive endpoints  
  - When: rate-limit policy applied  
  - Then: endpoint-specific thresholds are enforced.
- BR-7.7-02
  - Given: state-changing browser requests  
  - When: CSRF validation runs  
  - Then: invalid token requests are blocked.
- BR-7.7-03
  - Given: session cookie issuance  
  - When: response generated  
  - Then: secure cookie attributes are enforced.
- BR-7.7-04
  - Given: direct internal endpoint call without secret  
  - When: request reaches boundary  
  - Then: blocked with security error.

### Story 8.1: [BE][CH] Audit/Security Event Model

- Depends On: Story 1.2, Story 4.3
- 분기 수: 4

- BR-8.1-01
  - Given: significant user/system actions  
  - When: events occur  
  - Then: audit or security event is persisted in correct store.
- BR-8.1-02
  - Given: retention schedule  
  - When: cleanup job runs  
  - Then: records older than policy are purged.
- BR-8.1-03
  - Given: privileged actions  
  - When: performed by admin  
  - Then: actor identity is captured.
- BR-8.1-04
  - Given: event insert failure  
  - When: exception occurs  
  - Then: fallback operational log captures failure context.

### Story 8.2: [BE][CH] PII Masking Enforcement

- Depends On: Story 8.1
- 분기 수: 4

- BR-8.2-01
  - Given: logging of order/auth contexts  
  - When: sensitive fields included  
  - Then: masking rules are applied.
- BR-8.2-02
  - Given: password/otp/session token values  
  - When: logging attempted  
  - Then: raw values are never persisted.
- BR-8.2-03
  - Given: masking utility tests  
  - When: test suite runs  
  - Then: representative patterns are validated.
- BR-8.2-04
  - Given: log compliance check  
  - When: release gate runs  
  - Then: prohibited pattern scan returns clean.

### Story 8.3: [BE][CH/FEP] Correlation-id 3-hop Propagation

- Depends On: Story 3.1, Story 2.2, Story 4.3
- 분기 수: 4

- BR-8.3-01
  - Given: inbound request without correlation id  
  - When: channel filter runs  
  - Then: new id is generated and returned in response header.
- BR-8.3-02
  - Given: internal downstream calls  
  - When: channel calls account and FEP  
  - Then: same correlation id is propagated.
- BR-8.3-03
  - Given: log aggregation query  
  - When: searching by correlation id  
  - Then: all four backend services show traceable chain.
- BR-8.3-04
  - Given: propagation regression test  
  - When: CI runs  
  - Then: 3-hop header assertions pass.

### Story 8.4: [BE][CH/AC/FEP] OpenAPI Completeness

- Depends On: Story 1.2, Story 2.2, Story 3.1
- 분기 수: 4

- BR-8.4-01
  - Given: `docs-publish.yml` succeeds on `main`  
  - When: canonical API docs endpoint (`https://<org>.github.io/<repo>/`) is accessed  
  - Then: docs selector tabs for required services are reachable.
- BR-8.4-02
  - Given: controller endpoints  
  - When: docs generated  
  - Then: operation summaries and response schemas are present.
- BR-8.4-03
  - Given: error codes  
  - When: docs reviewed  
  - Then: common failure responses are documented.
- BR-8.4-04
  - Given: API change  
  - When: contract diff check runs  
  - Then: undocumented changes fail review gate.

### Story 8.5: [FE] Web Correlation Propagation Support

- Depends On: Story 8.3
- 분기 수: 3

- BR-8.5-01
  - Given: backend returns correlation header  
  - When: FE handles response  
  - Then: id is attached to error/report context.
- BR-8.5-02
  - Given: visible error state  
  - When: rendered  
  - Then: support trace key can be surfaced where appropriate.
- BR-8.5-03
  - Given: client logging policy  
  - When: diagnostics emitted  
  - Then: no sensitive values are included.

### Story 8.6: [MOB] Mobile Correlation Propagation Support

- Depends On: Story 8.3
- 분기 수: 3

- BR-8.6-01
  - Given: API response headers  
  - When: mobile network layer processes response  
  - Then: correlation id is captured.
- BR-8.6-02
  - Given: failure UX or support flow  
  - When: error information shown  
  - Then: trace id is available for troubleshooting.
- BR-8.6-03
  - Given: crash/error reporting integration  
  - When: event sent  
  - Then: correlation id is attached without PII leakage.

### Story 9.1: [BE][INT/CH] Execution Orchestration

- Depends On: Story 4.3, Story 5.2, Story 5.3, Story 3.2
- 분기 수: 4

- BR-9.1-01
  - Given: AUTHED order session  
  - When: execute command issued  
  - Then: `OrderExecutionService` initiates FEP-routed execution and records clOrdID.
- BR-9.1-02
  - Given: FEP execution completed  
  - When: FILLED/REJECTED received from FEP simulator  
  - Then: order session state reflects terminal outcome deterministically.
- BR-9.1-03
  - Given: FEP timeout/failure  
  - When: execution path fails  
  - Then: EXECUTING/UNKNOWN recovery-eligible state is assigned.
- BR-9.1-04
  - Given: orchestration logic update  
  - When: integration tests run  
  - Then: FEP-routed execution path remains green.

### Story 9.2: [BE][INT/CH] End-state Normalization

- Depends On: Story 9.1
- 분기 수: 4

- BR-9.2-01
  - Given: branch-specific outcomes  
  - When: response is normalized  
  - Then: terminal states follow common contract.
- BR-9.2-02
  - Given: failed order  
  - When: failure code is set  
  - Then: reason taxonomy matches documented categories.
- BR-9.2-03
  - Given: completed order (FILLED)  
  - When: response returned  
  - Then: ClOrdID is always present.
- BR-9.2-04
  - Given: state contract regression  
  - When: tests run  
  - Then: schema mismatch fails CI.

### Story 9.3: [BE][INT/CH] Recovery Scheduler Integration

- Depends On: Story 9.1, Story 6.4
- 분기 수: 4

- BR-9.3-01
  - Given: order session remains non-terminal beyond threshold  
  - When: scheduler runs  
  - Then: recovery sequence is triggered.
- BR-9.3-02
  - Given: external requery returns terminal result  
  - When: reconciliation succeeds  
  - Then: order is closed with normalized terminal state.
- BR-9.3-03
  - Given: repeated unresolved attempts  
  - When: max tries exceeded  
  - Then: manual recovery queue entry is created.
- BR-9.3-04
  - Given: recovery execution  
  - When: audited  
  - Then: attempt history is queryable.

### Story 9.4: [BE][INT/CH] Cross-system Idempotency Reconciliation

- Depends On: Story 5.4, Story 3.3, Story 9.1
- 분기 수: 4

- BR-9.4-01
  - Given: duplicate request at channel boundary  
  - When: dedupe applies  
  - Then: same canonical outcome is returned.
- BR-9.4-02
  - Given: AC/FEP partial records  
  - When: reconciliation runs  
  - Then: canonical order identity is restored.
- BR-9.4-03
  - Given: mismatch detection  
  - When: discovered  
  - Then: inconsistency is surfaced to operations.
- BR-9.4-04
  - Given: reconciliation run report  
  - When: completed  
  - Then: success/failure counters are emitted.

### Story 9.5: [FE] Integrated Final-state & Retry UX

- Depends On: Story 9.2, Story 4.5
- 분기 수: 4

- BR-9.5-01
  - Given: normalized terminal response  
  - When: FE renders result  
  - Then: completed/failed states are displayed consistently.
- BR-9.5-02
  - Given: recovery-in-progress state  
  - When: user views order status  
  - Then: proper pending/retry guidance is shown.
- BR-9.5-03
  - Given: retry-eligible failure  
  - When: user triggers retry action  
  - Then: operation follows guarded flow.
- BR-9.5-04
  - Given: unknown status resolution  
  - When: final state arrives  
  - Then: UI auto-updates without stale conflict.

### Story 9.6: [MOB] Integrated Final-state & Retry UX

- Depends On: Story 9.2, Story 4.7
- 분기 수: 4

- BR-9.6-01
  - Given: normalized final response  
  - When: mobile renders result  
  - Then: status/reason/ref fields follow same semantics as web.
- BR-9.6-02
  - Given: recovery-in-progress condition  
  - When: screen revisited  
  - Then: current status is restored and shown accurately.
- BR-9.6-03
  - Given: retryable failure condition  
  - When: user retries  
  - Then: guarded action path executes and prevents duplicates.
- BR-9.6-04
  - Given: connectivity interruption  
  - When: app resumes  
  - Then: latest order state is re-synced.

### Story 10.1: [BE][INT/CH] 7+1 Acceptance CI Gate

- Depends On: Story 9.4, Story 7.7, Story 8.4
- 분기 수: 4

- BR-10.1-01
  - Given: protected branch policy  
  - When: PR to main is opened  
  - Then: all 7+1 scenarios must pass before merge.
- BR-10.1-02
  - Given: scenario regression  
  - When: any scenario fails  
  - Then: merge gate is blocked.
- BR-10.1-03
  - Given: scenario tagging policy  
  - When: tests run  
  - Then: scenario IDs are traceable in test reports.
- BR-10.1-04
  - Given: CI report artifact policy  
  - When: pipeline completes  
  - Then: evidence artifacts are stored.

### Story 10.2: [BE][AC] Concurrency/Performance Gate

- Depends On: Story 5.5, Story 9.1
- 분기 수: 4

- BR-10.2-01
  - Given: concurrency scenario suite  
  - When: CI executes tests  
  - Then: race/integrity assertions pass.
- BR-10.2-02
  - Given: p95 SLA thresholds  
  - When: perf tests run  
  - Then: configured targets are satisfied.
- BR-10.2-03
  - Given: threshold breach  
  - When: observed  
  - Then: release gate fails with metric evidence.
- BR-10.2-04
  - Given: repeated benchmark runs  
  - When: compared  
  - Then: unacceptable variance is reported.

### Story 10.3: [BE][FEP] FEP Resilience Drills

- Depends On: Story 6.6, Story 9.3
- 분기 수: 4

- BR-10.3-01
  - Given: timeout and failure drill setup  
  - When: test run executes  
  - Then: CB open behavior is verified.
- BR-10.3-02
  - Given: recovery drill scenario  
  - When: downstream recovers  
  - Then: state closes and normal flow resumes.
- BR-10.3-03
  - Given: replay/requery drill  
  - When: unresolved order simulated  
  - Then: recovery workflow converges or escalates as designed.
- BR-10.3-04
  - Given: drill evidence requirement  
  - When: drill completes  
  - Then: report/log artifacts are attached.

### Story 10.4: [BE][INT/CH] Full-stack Smoke & Rehearsal

- Depends On: Story 10.1
- 분기 수: 4

- BR-10.4-01
  - Given: fresh environment boot  
  - When: compose stack starts  
  - Then: health endpoints are green within threshold.
- BR-10.4-02
  - Given: critical API/docs endpoints  
  - When: smoke checks run  
  - Then: mandatory endpoints respond correctly.
- BR-10.4-03
  - Given: rollback rehearsal plan  
  - When: exercise performed  
  - Then: recovery procedure is executable and documented.
- BR-10.4-04
  - Given: rehearsal completion  
  - When: reviewed  
  - Then: go/no-go checklist can be updated.

### Story 10.5: [FE] Web Release Readiness Pack

- Depends On: Story 9.5, Story 10.1, Story 10.4
- 분기 수: 4

- BR-10.5-01
  - Given: FE E2E suite  
  - When: release pipeline runs  
  - Then: critical user journeys pass.
- BR-10.5-02
  - Given: regression in core order/auth paths  
  - When: detected  
  - Then: release gate fails.
- BR-10.5-03
  - Given: release checklist template  
  - When: preparing shipment  
  - Then: checklist items are completed with evidence links.
- BR-10.5-04
  - Given: final FE candidate build  
  - When: validated  
  - Then: versioned release notes are generated.

### Story 10.6: [MOB] Mobile Release Readiness Pack

- Depends On: Story 9.6, Story 10.1, Story 10.4
- 분기 수: 4

- BR-10.6-01
  - Given: MOB E2E suite  
  - When: release pipeline runs  
  - Then: critical flows pass on target test matrix.
- BR-10.6-02
  - Given: auth/order/notification regressions  
  - When: detected  
  - Then: release gate fails.
- BR-10.6-03
  - Given: release checklist template  
  - When: preparing distribution  
  - Then: checklist and artifact links are completed.
- BR-10.6-04
  - Given: final build candidate  
  - When: approved  
  - Then: release notes and handoff package are finalized.

## 2) 정량 요약

- 총 스토리 수: 70
- 총 분기 수(Given/When/Then 기준): 284

## 3) 타 명세 보강 분기 (PRD/Architecture/UX)

아래 분기는 스토리 AC에서 간접적으로만 드러나거나, 운영/UX 명세에서 명시된 조건을 추가 정리한 것이다.

### 3.1 주문 실행/복구(아키텍처·PRD)
- BR-OPS-01 (CB OPEN 선차단)
  - Given: Resilience4j CB 상태가 OPEN
  - When: 주문 execute 호출
  - Then: FEP 호출 없이 fallback 즉시 반환, 트랜잭션 미시작, 주문/포지션 무변경
- BR-OPS-02 (Post-commit 실패 보상)
  - Given: 코어 트랜잭션 커밋 후 FEP timeout/5xx/rejected
  - When: 후속 외부 호출 실패 감지
  - Then: 보상 트랜잭션으로 포지션 역보정, 추적 가능한 실패 상태로 정규화
- BR-OPS-03 (실행 락 경합)
  - Given: 동일 orderSessionId에 대해 `ch:txn-lock:{sessionId}` NX 획득 실패
  - When: 동시 execute 요청
  - Then: 409 동시실행 오류 반환(중복 실행 방지)
- BR-OPS-04 (OTP debounce)
  - Given: 1초 이내 OTP 중복 제출
  - When: `ch:otp-attempt-ts:{orderSessionId}` key 존재
  - Then: 429 RATE-001 반환, 시도 횟수는 차감하지 않음
- BR-OPS-05 (Idempotency 재요청)
  - Given: 동일 clOrdID 재요청
  - When: idempotency key TTL 내 재시도
  - Then: 기존 처리 결과/세션 컨텍스트 재사용

### 3.2 세션/보안(아키텍처·UX)
- BR-SEC-01 (CSRF bootstrap 미실행)
  - Given: 클라이언트가 `GET /api/v1/auth/csrf` 선호출 없이 non-GET 요청
  - When: 보호 엔드포인트 호출
  - Then: CSRF 검증 실패로 요청 거절
- BR-SEC-02 (로그인 후 CSRF 재발급)
  - Given: 로그인 성공 후 `changeSessionId()` 수행
  - When: 이전 토큰으로 non-GET 요청
  - Then: 토큰 불일치 오류, 재조회 후 정상 처리
- BR-SEC-03 (내부 API 비밀헤더 누락)
  - Given: internal endpoint 호출에 `X-Internal-Secret` 누락/불일치
  - When: corebank/fep-gateway/fep-simulator 진입
  - Then: 인증 거절
- BR-SEC-04 (PII 마스킹)
  - Given: 계좌번호가 API/로그 출력 경로를 통과
  - When: 응답/로그 직렬화
  - Then: 마스킹 규칙 적용, 원문 노출 금지

### 3.3 UX/운영 복원력(UX spec)
- BR-UX-01 (세션 만료 경고)
  - Given: 세션 만료 임박 이벤트(SSE)
  - When: 클라이언트 수신
  - Then: 경고 Toast 표시, 사용자 재인증 유도
- BR-UX-02 (SSE 재연결 실패)
  - Given: SSE onerror 연속 발생
  - When: 백오프 재시도 한도 초과
  - Then: 실패 상태 UI + 수동 새로고침 경로 제공
- BR-UX-03 (주문 모달 ERROR 유지)
  - Given: CB fallback/실패 상태 진입
  - When: Order Flow modal 표시 중
  - Then: 자동 dismiss 없이 ERROR step 유지, RESET 시 Step A 복귀
- BR-UX-04 (OTP 1회 실패 후 복구)
  - Given: OTP 1회 오입력
  - When: 재입력 성공
  - Then: 정상적으로 Step C로 진행
- BR-UX-05 (빈 데이터 상태)
  - Given: 계좌/주문내역/알림 데이터 없음
  - When: 화면 렌더
  - Then: empty-state 메시지와 다음 행동 안내 제공

## 4) 최종 커버리지 메모
- Story AC 기반 분기 284개를 기준 집합으로 사용했다.
- PRD/Architecture/UX에서 운영상 중요한 14개 보강 분기를 추가했다.
- 따라서 현재 통합 카탈로그 총 분기 수는 298개다.
