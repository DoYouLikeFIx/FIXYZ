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
7. Given SpringDoc is added to all three services, when `docker compose up` is run with local profile, then `GET /swagger-ui/index.html` returns HTTP 200 for each service, and `GET /v3/api-docs` returns a valid OpenAPI 3.0 JSON; Swagger UI is disabled (HTTP 404) when `SPRING_PROFILES_ACTIVE=prod`.
8. Given a merge to `main` with all backend CI workflows passing, when the `docs-publish.yml` workflow completes, then the GitHub Pages site at `https://<org>.github.io/<repo>/` shows a Swagger UI page with selector tabs for Channel, CoreBank, and FEP services, updated to reflect the latest spec.

## Tasks / Subtasks

- [ ] Create and verify 7-module backend skeleton with explicit dependency direction (AC: 1)
  - [ ] Ensure module roles match architecture: `core-common`, `testing-support`, `channel-domain`, `channel-service`, `corebank-domain`, `corebank-service`, `fep-service`
  - [ ] Enforce dependency rule: `core-common` has zero Spring dependency and no downstream module imports
- [ ] Implement compose baseline with health and startup sequencing (AC: 2, 6)
  - [ ] Add `depends_on: condition: service_healthy` sequencing
  - [ ] Ensure default compose exposes only channel externally; keep internal services isolated by default
  - [ ] Add local-only override for host port debugging
- [ ] Implement baseline Flyway migrations and repeatable local/test seed strategy (AC: 3)
  - [ ] Add `V1__create_order_session_table.sql` for channel schema
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
- [ ] Enable SpringDoc OpenAPI (Swagger UI) on all three services (AC: 7)
  - [ ] Add `org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.15` to each service's `build.gradle`
  - [ ] Add `springdoc-openapi-gradle-plugin` (`id 'org.springdoc.openapi-gradle-plugin' version '1.9.0'`) to each service's `build.gradle` for build-time spec generation — **no running Docker stack needed in CI**
  - [ ] Configure per-service `application.yml` (local/default profile only):
    ```yaml
    springdoc:
      api-docs:
        path: /v3/api-docs
      swagger-ui:
        path: /swagger-ui/index.html
    ```
  - [ ] Add a `application-prod.yml` override in each service to disable docs on prod profile:
    ```yaml
    springdoc:
      api-docs:
        enabled: false
      swagger-ui:
        enabled: false
    ```
  - [ ] If Spring Security scaffold exists on any service, add explicit `permitAll` rules for doc paths:
    ```java
    .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
    ```
  - [ ] Verify locally: after `docker compose up`, all three `GET /swagger-ui/index.html` return HTTP 200
  - [ ] Verify prod guard: `SPRING_PROFILES_ACTIVE=prod ./gradlew bootRun` → `/v3/api-docs` returns HTTP 404
- [ ] Configure build-time OpenAPI spec generation via Gradle plugin (AC: 8)
  - [ ] In each service `build.gradle`, configure the `openApi` extension block:
    ```groovy
    openApi {
      apiDocsUrl = "http://localhost:${project.ext.springdocPort}/v3/api-docs"
      outputDir = file("$buildDir/openapi")
      outputFileName = "${project.name}.json"
      waitTimeInSeconds = 30
    }
    ```
    Assign distinct ports (e.g., channel=18080, corebank=18081, fep=18082) to avoid conflicts during parallel spec generation
  - [ ] Run `./gradlew :channel-service:generateOpenApiDocs :corebank-service:generateOpenApiDocs :fep-service:generateOpenApiDocs` and confirm each produces a valid JSON file under `build/openapi/`
- [ ] Add GitHub Actions workflow `docs-publish.yml` for automated GitHub Pages deployment (AC: 8)
  - [ ] Create `.github/workflows/docs-publish.yml` with the following structure:
    ```yaml
    name: Publish API Docs to GitHub Pages
    on:
      push:
        branches: [main]
        paths:
          - 'BE/**'
          - '.github/workflows/docs-publish.yml'
    permissions:
      contents: write   # required for peaceiris/actions-gh-pages@v4
    concurrency:
      group: gh-pages
      cancel-in-progress: true
    jobs:
      publish:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-java@v4
            with:
              java-version: '21'
              distribution: 'temurin'
          - name: Generate OpenAPI specs (build-time, no Docker needed)
            working-directory: BE
            run: |
              ./gradlew :channel-service:generateOpenApiDocs \
                        :corebank-service:generateOpenApiDocs \
                        :fep-service:generateOpenApiDocs
          - name: Assemble static docs site
            run: |
              mkdir -p docs-site
              cp BE/channel-service/build/openapi/channel-service.json docs-site/channel.json
              cp BE/corebank-service/build/openapi/corebank-service.json docs-site/corebank.json
              cp BE/fep-service/build/openapi/fep-service.json docs-site/fep.json
              cat > docs-site/index.html << 'EOF'
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="utf-8">
                <title>FIX API Docs</title>
                <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
              </head>
              <body>
              <div id="swagger-ui"></div>
              <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
              <script>
                SwaggerUIBundle({
                  urls: [
                    { url: "channel.json",  name: "Channel Service" },
                    { url: "corebank.json", name: "CoreBank Service" },
                    { url: "fep.json",      name: "FEP Service" }
                  ],
                  "urls.primaryName": "Channel Service",
                  dom_id: "#swagger-ui",
                  deepLinking: true,
                  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
                  layout: "StandaloneLayout"
                });
              </script>
              </body>
              </html>
              EOF
          - name: Deploy to GitHub Pages
            uses: peaceiris/actions-gh-pages@v4
            with:
              github_token: ${{ secrets.GITHUB_TOKEN }}
              publish_dir: ./docs-site
              force_orphan: true
              commit_message: "docs: update API specs from ${{ github.sha }}"
    ```
  - [ ] **First-deployment one-time step (manual):** After first workflow run, go to repo Settings → Pages → Source → set to `gh-pages` branch, `/ (root)`. Subsequent deployments are automatic.
  - [ ] Add API docs badge to `README.md`:
    ```markdown
    [![API Docs](https://img.shields.io/badge/API%20Docs-GitHub%20Pages-blue)](https://<org>.github.io/<repo>/)
    ```
  - [ ] Verify: after merging to `main`, the Pages URL loads Swagger UI with all three service tabs within ~2 minutes

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

### SpringDoc OpenAPI & GitHub Pages Implementation Notes

- **Spec generation strategy:** Use `springdoc-openapi-gradle-plugin` (build-time, no running Docker stack) rather than runtime `curl` to avoid CI environment complexity. The plugin starts the Spring app in a forked JVM with an H2 in-memory datasource override for spec generation only.
- **Port isolation for parallel generation:** Each service must declare a distinct `server.port` in its `application-openapi.yml` profile (channel=18080, corebank=18081, fep=18082) to prevent port conflicts when all three `generateOpenApiDocs` tasks run in parallel.
- **Static site pattern:** The `index.html` uses `swagger-ui-dist@5` via unpkg CDN with the multi-spec `urls` array — no npm build step required in the workflow. GitHub Pages serves pure static files.
- **GitHub Pages permissions:** `peaceiris/actions-gh-pages@v4` requires `permissions: contents: write` at the job level. `GITHUB_TOKEN` is sufficient; no PAT needed for same-repo deployment.
- **Concurrency guard:** Set `concurrency: group: gh-pages, cancel-in-progress: true` to prevent overlapping deployments when rapid merges occur.
- **First deployment caveat:** `GITHUB_TOKEN` cannot configure the Pages source on first run. The developer must manually enable Pages (Settings → Pages → `gh-pages` branch) after the first workflow execution creates the branch.
- **`force_orphan: true`:** Keeps the `gh-pages` branch as a single-commit branch to minimize repo size (no docs history needed).
- **prod safety:** `springdoc.api-docs.enabled=false` and `springdoc.swagger-ui.enabled=false` in `application-prod.yml` ensure zero doc surface exposure in production.

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
  - `/Users/yeongjae/fixyz/.github/workflows/docs-publish.yml`
  - `/Users/yeongjae/fixyz/docs/api/` (generated OpenAPI JSON artifacts, gitignored except index)
- Do not place shared constants in service modules when they belong to `core-common`.

### Testing Requirements

- Minimum checks for story completion:
  - `./gradlew build` passes from clean checkout.
  - Health endpoints return `UP` for all three services after compose startup.
  - Filter boundary check: internal endpoints reject missing secret header.
  - Flyway migrations apply successfully for both channel/core schemas.
  - `GET localhost:8080/swagger-ui.html` returns HTTP 200 on local profile.
  - `docs-publish.yml` workflow completes successfully on `main` branch and GitHub Pages URL is reachable.
- Regression guard:
  - Empty baseline integration test compiles with Testcontainers dependencies available via `testing-support`.
  - Swagger UI must be disabled (HTTP 404 or 403) when `SPRING_PROFILES_ACTIVE=prod`.

### Latest Tech Information

- Latest versions researched to prevent stale setup decisions:
  - Spring Boot metadata: latest stable `4.0.3`, with `3.4.13` as latest patch in the architecture-aligned minor line.
  - Gradle current: `9.3.1`.
  - `springdoc-openapi-starter-webmvc-ui`: latest stable `2.8.15` (released 2026-01-02); supports Spring Boot 3.x + OpenAPI 3.0. Source: https://github.com/springdoc/springdoc-openapi/releases
  - `org.springdoc.openapi-gradle-plugin`: latest stable `1.9.0`; generates OpenAPI spec at build time without a running server. Source: https://github.com/springdoc/springdoc-openapi-gradle-plugin
  - `peaceiris/actions-gh-pages`: latest stable `v4.0.0` (Apr 2024); supports `ubuntu-latest`, `GITHUB_TOKEN`, `force_orphan`. Source: https://github.com/peaceiris/actions-gh-pages/releases
  - `swagger-ui-dist` (unpkg CDN): current major is `v5.x`; use `@5` tag for latest minor auto-resolution.
- Implementation decision for this story:
  - Stay on architecture-pinned Spring Boot 3.4.x for consistency.
  - Use latest patch within selected major/minor where compatible.
  - Use build-time spec generation (Gradle plugin) over runtime curl to keep the docs CI job self-contained and fast.

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
