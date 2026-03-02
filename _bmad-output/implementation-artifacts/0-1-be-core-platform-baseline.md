# Story 0.1: BE Core Platform Baseline

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend engineer,
I want a stable multi-module platform baseline,
so that all system lanes can build on a consistent runtime and coding contract.

## Acceptance Criteria

1. Given a clean checkout, when `./gradlew build` runs from repo root, then all backend modules compile without error.
2. Given docker compose setup files, when `docker compose up` is executed, then `channel`, `corebank`, `fep-gateway`, and `fep-simulator` containers report healthy status via compose health checks (default host exposure policy applies).
3. Given Flyway configuration for channel/corebank schemas, when services start, then baseline migrations and local/test seed data run without error.
4. Given internal service boundaries, when `/internal/**` or `/fep-internal/**` is called without internal secret header, then request is blocked by scaffold filter.
5. Given common error contract requirement, when API exception occurs, then standardized error schema is returned.
6. Given local developer visibility requirements, when `docker-compose.override.yml` is applied, then MySQL/Redis/internal service ports are reachable for local tools only.
7. Given SpringDoc build-time generation is configured for channel/corebank/fep-gateway/fep-simulator services, when `generateOpenApiDocs` tasks run, then each service outputs a valid OpenAPI 3.0 JSON artifact.
8. Given a merge to `main` with backend CI passing, when `docs-publish.yml` completes, then the GitHub Pages site at `https://<org>.github.io/<repo>/` is the canonical API docs endpoint and renders Channel/CoreBank/FEP Gateway/FEP Simulator selectors from the latest generated specs; runtime Swagger endpoints remain disabled in production profile.
9. Given first deployment on a repository where Pages source is not yet configured, when the initial docs publish run finishes, then the one-time Pages source setup (`gh-pages` / root) is completed and recorded in the ops runbook.

## Tasks / Subtasks

- [ ] Create and verify 8-module backend skeleton with explicit dependency direction (AC: 1)
  - [ ] Ensure module roles match architecture: `core-common`, `testing-support`, `channel-domain`, `channel-service`, `corebank-domain`, `corebank-service`, `fep-gateway`, `fep-simulator`
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
  - [ ] Add `FepGatewayInternalSecretFilter` in fep-gateway service on `/fep-internal/**`
  - [ ] Add `FepSimulatorInternalSecretFilter` in fep-simulator service on `/fep-internal/**`
  - [ ] Externalize secrets with env variables and safe defaults for local
- [ ] Add common error envelope baseline (AC: 5)
  - [ ] Define/confirm shared API error schema in common module
  - [ ] Ensure initial exception handling returns normalized contract in channel/corebank/fep-gateway/fep-simulator
- [ ] Add smoke verification commands for Day 1 handoff (AC: 1, 2, 3, 4)
  - [ ] Build: `./gradlew build`
  - [ ] Bring-up: `docker compose up`
  - [ ] Health checks for all four services
- [ ] Enable SpringDoc OpenAPI spec generation on all four services (AC: 7)
  - [ ] Add `org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.15` to each service's `build.gradle`
  - [ ] Add `springdoc-openapi-gradle-plugin` (`id 'org.springdoc.openapi-gradle-plugin' version '1.9.0'`) to each service's `build.gradle` for build-time spec generation — **no running Docker stack needed in CI**
  - [ ] Add `application-openapi.yml` for each service with isolated `server.port` (channel=18080, corebank=18081, fep-gateway=18082, fep-simulator=18083) and OpenAPI-generation-only datasource overrides (H2 in-memory)
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
  - [ ] If Spring Security scaffold exists on any service, add profile-scoped `permitAll` rules for doc paths (local/dev only):
    ```java
    .requestMatchers("/v3/api-docs/**", "/swagger-ui/**").permitAll()
    ```
  - [ ] Verify local build-time generation: each service writes valid JSON to `build/openapi/`
  - [ ] Verify prod guard: `SPRING_PROFILES_ACTIVE=prod ./gradlew bootRun` → `/v3/api-docs` and `/swagger-ui/**` are not externally exposed
- [ ] Configure build-time OpenAPI spec generation via Gradle plugin (AC: 8)
  - [ ] In each service `build.gradle`, declare service-specific OpenAPI generation port and bind it to the `openApi` extension block:
    ```groovy
    def springdocPort = 18080 // channel-service; corebank=18081, fep-gateway=18082, fep-simulator=18083

    openApi {
      apiDocsUrl = "http://localhost:${springdocPort}/v3/api-docs"
      outputDir = file("$buildDir/openapi")
      outputFileName = "${project.name}.json"
      waitTimeInSeconds = 30
    }
    ```
    Ensure `springdocPort` value exactly matches each service `application-openapi.yml` `server.port`
  - [ ] Run `./gradlew :channel-service:generateOpenApiDocs :corebank-service:generateOpenApiDocs :fep-gateway:generateOpenApiDocs :fep-simulator:generateOpenApiDocs` and confirm each produces a valid JSON file under `build/openapi/`
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
                        :fep-gateway:generateOpenApiDocs \
                        :fep-simulator:generateOpenApiDocs
          - name: Assemble static docs site
            run: |
              mkdir -p docs-site
              cp BE/channel-service/build/openapi/channel-service.json docs-site/channel.json
              cp BE/corebank-service/build/openapi/corebank-service.json docs-site/corebank.json
              cp BE/fep-gateway/build/openapi/fep-gateway.json docs-site/fep-gateway.json
              cp BE/fep-simulator/build/openapi/fep-simulator.json docs-site/fep-simulator.json
              python3 - << 'PY'
              import json, pathlib
              for name in ("channel.json", "corebank.json", "fep-gateway.json", "fep-simulator.json"):
                  p = pathlib.Path("docs-site") / name
                  data = json.loads(p.read_text(encoding="utf-8"))
                  assert str(data.get("openapi", "")).startswith("3.0"), f"{name}: openapi version missing/invalid"
                  assert "paths" in data and isinstance(data["paths"], dict), f"{name}: paths missing"
              print("OpenAPI structural validation passed")
              PY
              cat > docs-site/index.html << 'EOF'
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="utf-8">
                <title>FIX API Docs</title>
                <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css">
              </head>
              <body>
              <div id="swagger-ui"></div>
              <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
              <script>
                SwaggerUIBundle({
                  urls: [
                    { url: "channel.json",  name: "Channel Service" },
                    { url: "corebank.json", name: "CoreBank Service" },
                    { url: "fep-gateway.json",  name: "FEP Gateway" },
                    { url: "fep-simulator.json", name: "FEP Simulator" }
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
  - [ ] **First-deployment one-time step (manual, AC: 9):** After first workflow run, go to repo Settings → Pages → Source → set to `gh-pages` branch, `/ (root)`. Subsequent deployments are automatic.
  - [ ] Record first deployment completion in `docs/ops/docs-publish-onboarding.md` (date, actor, repo, configured Pages source)
  - [ ] Add API docs badge to `README.md`:
    ```markdown
    [![API Docs](https://img.shields.io/badge/API%20Docs-GitHub%20Pages-blue)](https://<org>.github.io/<repo>/)
    ```
  - [ ] Verify: after merging to `main`, the Pages URL loads Swagger UI with all four service tabs within ~2 minutes

## Dev Notes

### Developer Context Section

- Epic objective: establish non-negotiable baseline for all subsequent stories in Epic 0-10.
- This story is the root dependency for Stories 0.2, 0.3, and 0.4.
- Do not add feature logic here; only platform scaffolding, contracts, and runtime wiring.

### Technical Requirements

- Runtime and topology:
  - Java 21, Spring Boot 3.x baseline.
  - Four deployable services with compose health checks.
  - Cold start target: first API response within 120 seconds after `docker compose up` (Vault + vault-init baseline).
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
- **Architecture alignment note:** H2 is forbidden for runtime/integration behavior validation; `application-openapi.yml` H2 override is allowed only for isolated spec generation and must never be reused for transactional tests.
- **Port isolation for parallel generation:** Each service must declare a distinct `server.port` in its `application-openapi.yml` profile (channel=18080, corebank=18081, fep-gateway=18082, fep-simulator=18083) to prevent port conflicts when all four `generateOpenApiDocs` tasks run in parallel.
- **Port contract:** `application-openapi.yml` `server.port` and the Gradle `springdocPort` value must match per service; treat mismatches as build-breaking configuration drift.
- **Static site pattern:** The `index.html` uses `swagger-ui-dist@5` via unpkg CDN with the multi-spec `urls` array — no npm build step required in the workflow. GitHub Pages serves pure static files.
- **Spec validity gate:** `docs-publish.yml` must parse each generated JSON and enforce OpenAPI 3.0 + `paths` presence before deploy.
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
  - `BE/fep-gateway/**`
  - `BE/fep-simulator/**`
  - `/Users/yeongjae/fixyz/docker-compose.yml`
  - `/Users/yeongjae/fixyz/docker-compose.override.yml`
  - `/Users/yeongjae/fixyz/.env.example`
  - `/Users/yeongjae/fixyz/.github/workflows/docs-publish.yml`
  - `BE/*-service/src/main/resources/application-openapi.yml`
  - `/Users/yeongjae/fixyz/docs/ops/docs-publish-onboarding.md`
- Do not place shared constants in service modules when they belong to `core-common`.

### Testing Requirements

- Minimum checks for story completion:
  - `./gradlew build` passes from clean checkout.
  - Health endpoints return `UP` for all four services after compose startup.
  - Filter boundary check: internal endpoints reject missing secret header.
  - Flyway migrations apply successfully for both channel/core schemas.
  - `./gradlew :channel-service:generateOpenApiDocs :corebank-service:generateOpenApiDocs :fep-gateway:generateOpenApiDocs :fep-simulator:generateOpenApiDocs` produces valid spec JSON for all four services.
  - `docs-publish.yml` OpenAPI structural validation gate passes for all generated specs.
  - `docs-publish.yml` workflow completes successfully on `main` branch and GitHub Pages URL is reachable.
  - For first deployment, Pages source configuration completion is documented in `docs/ops/docs-publish-onboarding.md`.
- Regression guard:
  - Empty baseline integration test compiles with Testcontainers dependencies available via `testing-support`.
  - `/v3/api-docs` and `/swagger-ui/**` must be disabled (HTTP 404 or 403) when `SPRING_PROFILES_ACTIVE=prod`.

### Latest Tech Information

- Latest versions researched to prevent stale setup decisions:
  - Spring Boot metadata: latest stable `4.0.3`, with `3.4.13` as latest patch in the architecture-aligned minor line.
  - Gradle current: `9.3.1`.
  - `springdoc-openapi-starter-webmvc-ui`: latest stable `2.8.15` (released 2026-01-02); supports Spring Boot 3.x + OpenAPI 3.0. Source: https://github.com/springdoc/springdoc-openapi/releases
  - `org.springdoc.openapi-gradle-plugin`: latest stable `1.9.0`; generates OpenAPI spec at build time without a running server. Source: https://github.com/springdoc/springdoc-openapi-gradle-plugin
  - `peaceiris/actions-gh-pages`: latest stable `v4.0.0` (Apr 2024); supports `ubuntu-latest`, `GITHUB_TOKEN`, `force_orphan`. Source: https://github.com/peaceiris/actions-gh-pages/releases
  - `swagger-ui-dist` (unpkg CDN): pin exact version `5.17.14` in workflow template and update intentionally (do not float with `@5`).
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
