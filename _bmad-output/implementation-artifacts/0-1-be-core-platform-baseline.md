# Story 0.1: BE Core Platform Baseline

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend engineer,
I want a stable multi-module platform baseline,
so that all system lanes can build on a consistent runtime and coding contract.

## Acceptance Criteria

1. Given a clean checkout, when `./gradlew build` runs from repo root, then all backend modules compile without error.
2. Given docker compose setup files, when `docker compose up` is executed, then `channel:8080`, `corebank:8081`, and `fep:8082` become healthy.
3. Given Flyway configuration for channel/corebank schemas, when services start, then baseline migrations and local/test seed data run without error.
4. Given internal service boundaries, when `/internal/**` or `/fep-internal/**` is called without internal secret header, then request is blocked by scaffold filter.
5. Given common error contract requirement, when API exception occurs, then standardized error schema is returned.
6. Given local developer visibility requirements, when `docker-compose.override.yml` is applied, then MySQL/Redis/internal service ports are reachable for local tools only.

## Tasks / Subtasks

- [ ] Create and verify 7-module backend skeleton with explicit dependency direction (AC: 1)
  - [ ] Ensure module roles match architecture: `core-common`, `testing-support`, `channel-domain`, `channel-service`, `corebank-domain`, `corebank-service`, `fep-service`
  - [ ] Enforce dependency rule: `core-common` has zero Spring dependency and no downstream module imports
- [ ] Implement compose baseline with health and startup sequencing (AC: 2, 6)
  - [ ] Add `depends_on: condition: service_healthy` sequencing
  - [ ] Ensure default compose exposes only channel externally; keep internal services isolated by default
  - [ ] Add local-only override for host port debugging
- [ ] Implement baseline Flyway migrations and repeatable local/test seed strategy (AC: 3)
  - [ ] Add `V1__create_transfer_session_table.sql` for channel schema
  - [ ] Add `V1__create_member_table.sql` for core schema
  - [ ] Add repeatable seed migration for local/test bootstrap accounts
- [ ] Add internal boundary scaffold filters (AC: 4)
  - [ ] Add `InternalSecretFilter` in corebank service on `/internal/**`
  - [ ] Add `FepInternalSecretFilter` in fep service on `/fep-internal/**`
  - [ ] Externalize secrets with env variables and safe defaults for local
- [ ] Add common error envelope baseline (AC: 5)
  - [ ] Define/confirm shared API error schema in common module
  - [ ] Ensure initial exception handling returns normalized contract in channel/corebank/fep
- [ ] Add smoke verification commands for Day 1 handoff (AC: 1, 2, 3, 4)
  - [ ] Build: `./gradlew build`
  - [ ] Bring-up: `docker compose up`
  - [ ] Health checks for all three services

## Dev Notes

### Developer Context Section

- Epic objective: establish non-negotiable baseline for all subsequent stories in Epic 0-10.
- This story is the root dependency for Stories 0.2, 0.3, and 0.4.
- Do not add feature logic here; only platform scaffolding, contracts, and runtime wiring.

### Technical Requirements

- Runtime and topology:
  - Java 21, Spring Boot 3.x baseline.
  - Three deployable services with compose health checks.
  - Cold start target: first API response within 90 seconds after `docker compose up`.
- Data/platform:
  - MySQL InnoDB + Redis required from Day 1.
  - Flyway validate-on-migrate behavior must fail fast on migration mismatch.
- Security baseline:
  - Internal boundary secret filters for service-to-service endpoints.
  - Cookie/security hardening is further expanded in later epics, but scaffold must exist now.

### Architecture Compliance

- Follow package and module conventions from architecture doc:
  - Package naming: `com.fix.{service}.{module}.{layer}`.
  - Module boundaries must align with ownership and compose network boundaries.
- Keep `core-common` pure Java.
- Avoid cross-schema ownership leakage (channel schema migration in channel service, core schema migration in corebank service).

### Library / Framework Requirements

- Backend baseline to use now:
  - Java 21
  - Spring Boot `3.4.x` line (project architecture baseline)
  - Gradle multi-module build
  - Flyway for schema migration
- Latest ecosystem snapshot (2026-02-25) to avoid outdated choices:
  - Spring Boot latest stable: `4.0.3`; latest in 3.4 line: `3.4.13`; latest in 3.5 line: `3.5.11`
  - Gradle current release: `9.3.1`
- Guardrail:
  - Keep this story on architecture-pinned 3.4 line unless architecture document is explicitly updated; do not silently jump major framework lines in foundation story.

### File Structure Requirements

- Expected touched areas:
  - `BE/settings.gradle*`
  - `BE/core-common/**`
  - `BE/testing-support/**`
  - `BE/channel-service/**`
  - `BE/corebank-service/**`
  - `BE/fep-service/**`
  - `/Users/yeongjae/fixyz/docker-compose.yml`
  - `/Users/yeongjae/fixyz/docker-compose.override.yml`
  - `/Users/yeongjae/fixyz/.env.example`
- Do not place shared constants in service modules when they belong to `core-common`.

### Testing Requirements

- Minimum checks for story completion:
  - `./gradlew build` passes from clean checkout.
  - Health endpoints return `UP` for all three services after compose startup.
  - Filter boundary check: internal endpoints reject missing secret header.
  - Flyway migrations apply successfully for both channel/core schemas.
- Regression guard:
  - Empty baseline integration test compiles with Testcontainers dependencies available via `testing-support`.

### Latest Tech Information

- Latest versions researched to prevent stale setup decisions:
  - Spring Boot metadata: latest stable `4.0.3`, with `3.4.13` as latest patch in the architecture-aligned minor line.
  - Gradle current: `9.3.1`.
- Implementation decision for this story:
  - Stay on architecture-pinned Spring Boot 3.4.x for consistency.
  - Use latest patch within selected major/minor where compatible.

### Project Context Reference

- `project-context.md` file was not found in repository scan (`**/project-context.md`).
- Use planning + implementation artifacts as primary context sources for this story.

### Story Completion Status

- Status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 0, Story 0.1)
- `_bmad-output/implementation-artifacts/epic-0-project-foundation.md` (Story 0.1 detailed acceptance criteria)
- `_bmad-output/planning-artifacts/architecture.md` (module boundaries, compose, security filters, Day 1 scaffold)
- `_bmad-output/planning-artifacts/prd.md` (FR-41, NFR-P3, NFR-S4)
- Spring Boot metadata: https://repo1.maven.org/maven2/org/springframework/boot/spring-boot/maven-metadata.xml
- Gradle current version API: https://services.gradle.org/versions/current

## Dev Agent Record

### Agent Model Used

GPT-5 Codex (Codex desktop)

### Debug Log References

- Story generated from create-story workflow instructions and Epic 0 artifact synthesis.

### Completion Notes List

- Story prepared with architecture and operations guardrails.
- Framework-version guidance included with stability constraints.

### File List

- /Users/yeongjae/fixyz/_bmad-output/implementation-artifacts/0-1-be-core-platform-baseline.md
