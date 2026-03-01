# Epic 0: Project Foundation

## Summary

Running `docker compose up` once brings up all three services (channel:8080, corebank:8081, fep:8082), GitHub Actions CI passes the baseline build, and the frontend Vite dev server communicates with the backend — achieving a full-stack Hello World state. This is the technical foundation for all subsequent Epics.

**FRs covered:** FR-41  
**Architecture requirements:** Gradle 7 modules, core-common, testing-support, docker-compose.yml + override, Flyway V1 migrations, 4 GitHub Actions workflows (basic skeleton), fix-frontend Vite scaffold, lib/axios.ts, vercel.json  

> **[ADR-TOTP-SEC-001] Interim TOTP Secret Storage Strategy**  
> **Decision:** When implementing Epic 2 (Story 2.2), TOTP secrets are stored encrypted in the DB using `@EncryptedColumn` (AES-256, with the key externalized via env var `TOTP_ENCRYPTION_KEY`). Migration to HashiCorp Vault KV v2 is deferred to Epic 6 Story 6.4.  
> **Rationale:** The complexity of Vault's `docker compose` initialization (unseal, init, depends_on chain) poses a risk of delaying Epic 0 foundational work. Since the implementation is abstracted behind the `TotpSecretRepository` interface, swapping the backend requires no changes to service code.

---

## Story 0.1: Backend Infrastructure Scaffold

As a **developer**,  
I want the Gradle multi-module project to build and all three services to start via `docker compose up` with seed data loaded,  
So that I have a verified foundation to build all subsequent features on.

### Acceptance Criteria

**Given** a clean checkout of the repository  
**When** `./gradlew build` is run from the project root  
**Then** all 7 modules (core-common, testing-support, channel-domain, channel-service, corebank-domain, corebank-service, fep-service) compile without errors  
**And** `gradle.properties` contains `org.gradle.parallel=true` and `org.gradle.caching=true`

**Given** `.env.example` is copied to `.env` with placeholder values filled  
**When** `docker compose up` is run  
**Then** all three services start within 90 seconds (NFR-P3)  
**And** `GET localhost:8080/actuator/health` returns HTTP 200 `{"status":"UP"}`  
**And** `GET localhost:8081/actuator/health` returns HTTP 200 `{"status":"UP"}`  
**And** `GET localhost:8082/actuator/health` returns HTTP 200 `{"status":"UP"}`

**Given** Flyway is configured for channel-service and corebank-service  
**When** services start  
**Then** `V1__create_order_session_table.sql` runs against channel_db without error  
**And** `V1__create_member_table.sql` runs against core_db without error  
**And** `R__seed_data.sql` runs on local/test profile and creates seed data including:
- `admin@fix.com` account with ROLE_ADMIN
- `user@fix.com` account with ROLE_USER
- Each account has at least one trading account with non-zero balance

**Given** `docker-compose.override.yml` exists at project root  
**When** `docker compose up` is run locally  
**Then** `mysql:3306`, `redis:6379`, `corebank-service:8081`, `fep-simulator:8082` ports are accessible from the host machine  
**And** DBeaver / Redis Insight can connect to each service directly

**Given** `curl localhost:8081/actuator/health` is run from the host machine without override  
**When** the base `docker-compose.yml` is used alone (production mode)  
**Then** connection is refused for corebank and fep (NFR-S4 — internal services not exposed)

**Given** `testing-support/build.gradle` declares TC and WireMock with `api` scope  
**When** `./gradlew :channel-service:test` is run (empty test class)  
**Then** `ChannelIntegrationTestBase` compiles successfully  
**And** Testcontainers MySQL container starts and stops without error  
**And** `MySQLContainer` and `WireMockServer` classes resolve on the test classpath

**Given** the internal API security scaffold for `corebank-service`  
**When** `corebank-service:8081/internal/**` is called without the `X-Internal-Secret` header  
**Then** `InternalSecretFilter` (`OncePerRequestFilter`) is applied to the `/internal/**` path  
**And** requests without the header → HTTP 403 (scaffold implementation — detailed logic completed in Story 6.3)  
**And** the secret is externalized via env var `COREBANK_INTERNAL_SECRET` (`application.yml: ${COREBANK_INTERNAL_SECRET:dev-secret}`)  
**And** `fep-simulator:8082/fep-internal/**` follows the same pattern with a `FepInternalSecretFilter` scaffold  
**And** Story 6.3 `SecurityBoundaryTest` is guaranteed to pass on top of this scaffold

---

## Story 0.2: CI Pipeline & Frontend Scaffold

As a **developer**,  
I want GitHub Actions to run a basic build on every push and the frontend Vite dev server to communicate with the backend,  
So that every code change is automatically validated and the full development environment is ready from day one.

### Acceptance Criteria

**Given** code is pushed to any branch  
**When** the GitHub Actions workflows trigger  
**Then** `ci-channel.yml`, `ci-corebank.yml`, `ci-fep.yml`, `ci-frontend.yml` all run  
**And** `./gradlew build` exits with code 0 on each backend workflow  
**And** `pnpm install && pnpm build` exits with code 0 on the frontend workflow

**Given** `fix-frontend/` is scaffolded with Vite 6 + React 19 + TypeScript + pnpm  
**When** `pnpm dev` is run in `fix-frontend/`  
**Then** `vite.config.ts` proxy routes `/api/*` to `http://localhost:8080`  
**And** `src/lib/axios.ts` exports a single configured Axios instance with `baseURL` from `VITE_API_BASE_URL`  
**And** `@/` path alias resolves to `src/` in both `vite.config.ts` (resolve.alias) and `tsconfig.json` (paths)

**Given** `fix-frontend/.env.local` contains `VITE_API_BASE_URL=http://localhost:8080`  
**When** the dev server is running and backend is up  
**Then** a `GET /actuator/health` call via the Axios instance returns HTTP 200

**Given** `vercel.json` exists in `fix-frontend/`  
**When** Vercel builds the project  
**Then** all routes are rewritten to `/index.html` (SPA routing support)

**Given** the repository root contains `README.md`  
**When** a developer clones the repo and reads the README  
**Then** a "Quick Start" section exists with exactly 3 commands:

```bash
cp .env.example .env
docker compose up
# → All services healthy at localhost:8080/8081/8082
```

**Given** `CONTRIBUTING.md` exists at the project root  
**When** a developer reads it  
**Then** it defines: branch naming convention, commit message format (Conventional Commits), and PR merge strategy
