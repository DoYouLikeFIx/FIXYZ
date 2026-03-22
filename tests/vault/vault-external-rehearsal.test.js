"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const makefilePath = path.join(repoRoot, "Makefile");
const runbookPath = path.join(repoRoot, "docs", "ops", "vault-external-operations.md");
const devServerRunbookPath = path.join(repoRoot, "docs", "ops", "vault-external-dev-server.md");
const devServerEnvTemplatePath = path.join(repoRoot, "docs", "ops", "vault-external-dev.env.template");
const rehearsalScriptPath = path.join(repoRoot, "scripts", "vault", "run-external-cutover-rehearsal.sh");
const externalDevBootstrapScriptPath = path.join(
  repoRoot,
  "scripts",
  "vault",
  "bootstrap-external-dev-server.sh",
);
const evidenceRoot = path.join(repoRoot, "docs", "ops", "evidence", "vault-external");
const evidenceReadmePath = path.join(evidenceRoot, "README.md");
const liveExternalEnvTemplatePath = path.join(evidenceRoot, "live-external.env.template");
const externalDevComposePath = path.join(repoRoot, "docker-compose.vault-external-dev.yml");
const externalDevVaultConfigPath = path.join(
  repoRoot,
  "docker",
  "vault",
  "config",
  "vault-external-dev.hcl",
);
const externalDevBootstrapPath = path.join(
  repoRoot,
  "docker",
  "vault",
  "init",
  "vault-single-node-bootstrap.sh",
);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function mustInclude(text, needle) {
  assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeSprintStatusFile(workspaceRoot, story013Status) {
  const sprintStatusPath = path.join(
    workspaceRoot,
    "_bmad-output",
    "implementation-artifacts",
    "sprint-status.yaml",
  );
  fs.mkdirSync(path.dirname(sprintStatusPath), { recursive: true });
  fs.writeFileSync(
    sprintStatusPath,
    [
      "generated: 2026-03-20 20:49",
      "project: fix",
      "development_status:",
      `  0-13-vault-production-separation-and-external-operations: ${story013Status}`,
      "",
    ].join("\n"),
  );

  return sprintStatusPath;
}

function createRehearsalWorkspace(prefix, story013Status = "review") {
  const workspaceRoot = makeTempDir(prefix);
  const scriptDir = path.join(workspaceRoot, "scripts", "vault");
  const workspaceScriptPath = path.join(scriptDir, "run-external-cutover-rehearsal.sh");

  fs.mkdirSync(scriptDir, { recursive: true });
  fs.copyFileSync(rehearsalScriptPath, workspaceScriptPath);
  writeSprintStatusFile(workspaceRoot, story013Status);

  return {
    workspaceRoot,
    workspaceScriptPath,
  };
}

function runBashScript(scriptPath, env = {}, options = {}) {
  const { cwd = repoRoot } = options;
  return spawnSync("bash", [scriptPath], {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
}

function buildEvidenceOutputDir(date = "20260320") {
  return path.join("docs", "ops", "evidence", "vault-external", date);
}

function resolveEvidenceOutputDir(workspaceRoot, date = "20260320") {
  return path.join(workspaceRoot, buildEvidenceOutputDir(date));
}

function buildBaseEnv(outputDir, runId) {
  return {
    VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR: outputDir,
    VAULT_EXTERNAL_REHEARSAL_RUN_ID: runId,
    VAULT_EXTERNAL_REHEARSAL_OPERATOR: "platform-ops",
    VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT: "staging-like",
    VAULT_EXTERNAL_REHEARSAL_CHANGE_REF: "CRQ-014",
    VAULT_EXTERNAL_REHEARSAL_ROLLBACK_OWNER: "vault-oncall",
    VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH: "/etc/ssl/certs/vault-ca.pem",
    VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH: "/opt/fix/vault-truststore.p12",
    VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS: `audit://vault/export?run_id=${runId}`,
    VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE: "S3 Object Lock Compliance mode",
    VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF: `s3://vault-evidence/fix/story-0-14/${runId}`,
    VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS: "120",
  };
}

function buildPassingLiveEnv(outputDir, runId, overrides = {}) {
  return {
    ...buildBaseEnv(outputDir, runId),
    VAULT_EXTERNAL_REHEARSAL_MODE: "live-external",
    VAULT_EXTERNAL_REHEARSAL_CONFIRM_LIVE: "1",
    VAULT_EXTERNAL_REHEARSAL_START_TS: "2026-03-20T14:00:00Z",
    VAULT_EXTERNAL_REHEARSAL_ALL_PROBES_GREEN_TS: "2026-03-20T14:04:30Z",
    VAULT_EXTERNAL_REHEARSAL_END_TS: "2026-03-20T14:05:00Z",
    VAULT_EXTERNAL_REHEARSAL_ROTATION_T0: "2026-03-20T14:10:00Z",
    VAULT_EXTERNAL_REHEARSAL_ROTATION_T1: "2026-03-20T14:20:00Z",
    VAULT_EXTERNAL_REHEARSAL_TRUST_DOWNTIME_SECONDS: "240",
    VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT: "0",
    VAULT_EXTERNAL_REHEARSAL_DECISION_MATRIX_VERDICT: "fail-fast-enforced",
    VAULT_EXTERNAL_REHEARSAL_PROTECTED_OUTAGE_VERDICT: "fail-fast",
    VAULT_EXTERNAL_REHEARSAL_NON_PROTECTED_OUTAGE_VERDICT: "degraded-allowed",
    VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT: "passed",
    VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT: "passed",
    VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE:
      `openssl s_client -verify_hostname vault.example.internal # run_id=${runId}`,
    VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_STATUS: "200",
    VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_DETAIL:
      "X-Internal-Secret accepted by corebank-service /internal/v1/ping",
    VAULT_EXTERNAL_REHEARSAL_ACTOR_PATH_METADATA_PRESENT: "1",
    VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE:
      "restart channel-service,restart corebank-service,restart fep-gateway,restart fep-simulator",
    ...overrides,
  };
}

test("Vault external rehearsal assets exist for docs, script, and evidence root", () => {
  for (const filePath of [
    makefilePath,
    runbookPath,
    devServerRunbookPath,
    devServerEnvTemplatePath,
    rehearsalScriptPath,
    externalDevBootstrapScriptPath,
    evidenceRoot,
    evidenceReadmePath,
    liveExternalEnvTemplatePath,
    externalDevComposePath,
    externalDevVaultConfigPath,
    externalDevBootstrapPath,
  ]) {
    assert.ok(fs.existsSync(filePath), `missing Story 0.14 asset: ${filePath}`);
  }
});

test("runbook documents entry gate, decision matrix, probes, immutable retention, trust continuity, and rotation formula", () => {
  const runbook = readText(runbookPath);

  mustInclude(runbook, "Story `0.13` is `done`");
  mustInclude(runbook, "live-external");
  mustInclude(runbook, "planning-review");
  mustInclude(runbook, "VAULT_EXTERNAL_REHEARSAL_RUN_ID");
  mustInclude(runbook, "fail-fast");
  mustInclude(runbook, "degraded");
  mustInclude(runbook, "S3 Object Lock Compliance mode");
  mustInclude(runbook, "docs/ops/evidence/vault-external/<YYYYMMDD>");
  mustInclude(runbook, "run_id=");
  mustInclude(runbook, "channel-service /actuator/health");
  mustInclude(runbook, "corebank-service /internal/v1/ping");
  mustInclude(runbook, "X-Internal-Secret");
  mustInclude(runbook, "critical secret-auth errors");
  mustInclude(runbook, "hostname/SAN verification");
  mustInclude(runbook, "VAULT_EXTERNAL_REHEARSAL_PROTECTED_OUTAGE_VERDICT");
  mustInclude(runbook, "VAULT_EXTERNAL_REHEARSAL_ACTOR_PATH_METADATA_PRESENT");
  mustInclude(runbook, "VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT");
  mustInclude(runbook, "VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS");
  mustInclude(runbook, "VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE");
  mustInclude(runbook, "live-external.env.template");
  mustInclude(runbook, "AWS single-node Docker Vault profile");
  mustInclude(runbook, "docker-compose.vault-external-dev.yml");
  mustInclude(runbook, "docs/ops/vault-external-dev.env.template");
  mustInclude(runbook, "docs/ops/vault-external-dev-server.md");
  mustInclude(runbook, "dev-docker-single-node");
  mustInclude(runbook, "t3.medium");
  mustInclude(runbook, "gp3 50GB");
  mustInclude(runbook, "bootstrap-external-dev-server.sh");
  mustInclude(runbook, "vault-external-dev-init-env");
  mustInclude(runbook, "vault-external-dev-up");
  mustInclude(runbook, "vault-external-dev-status");
  mustInclude(runbook, "vault-external-dev-exports");
  mustInclude(runbook, "vault-external-dev-live");
  mustInclude(runbook, "docker-volume-retained");
  mustInclude(runbook, "not-applicable-http-dev-server");
  mustInclude(runbook, "source \"${ENV_FILE}\"");
  mustInclude(runbook, "rg -n '^\\s*0-13-vault-production-separation-and-external-operations:\\s*done$'");
  mustInclude(runbook, "cumulative downtime SLO `<=300s`");
  mustInclude(runbook, "t0: successful rotation write response");
  mustInclude(runbook, "t1: first all-probe green timestamp with rotated secret");
  mustInclude(runbook, "t1 - t0 <= 15m");
});

test("AWS single-node dev-server doc defines both preparation and Docker live-completion flows", () => {
  const runbook = readText(devServerRunbookPath);

  mustInclude(runbook, "t3.medium");
  mustInclude(runbook, "gp3 50GB");
  mustInclude(runbook, "docker-compose.vault-external-dev.yml");
  mustInclude(runbook, "docs/ops/vault-external-dev.env.template");
  mustInclude(runbook, ".env.external-dev");
  mustInclude(runbook, "--env-file .env.external-dev");
  mustInclude(runbook, "bootstrap-external-dev-server.sh");
  mustInclude(runbook, "make vault-external-dev-init-env");
  mustInclude(runbook, "make vault-external-dev-up");
  mustInclude(runbook, "make vault-external-dev-status");
  mustInclude(runbook, "make vault-external-dev-exports");
  mustInclude(runbook, "make vault-external-dev-planning-review");
  mustInclude(runbook, "make vault-external-dev-live");
  mustInclude(runbook, "vault-single-node-bootstrap.sh");
  mustInclude(runbook, "persistent `raft`");
  mustInclude(runbook, "planning-review");
  mustInclude(runbook, "dev-docker-single-node");
  mustInclude(runbook, "may satisfy Story `0.14` completion");
  mustInclude(runbook, "not-applicable-http-dev-server");
  mustInclude(runbook, "make vault-external-dev-secret");
});

test("AWS single-node dev-server env template provides a safe host-local starting point", () => {
  const template = readText(devServerEnvTemplatePath);

  mustInclude(template, "INTERNAL_SECRET_BOOTSTRAP=replace-me");
  mustInclude(template, "VAULT_ADDR=http://vault-external-dev:8200");
  mustInclude(template, "VAULT_AUDIT_LOG_PATH=/vault/file/audit.log");
  mustInclude(template, "VAULT_RUNTIME_ROLE=runtime-core-services");
  mustInclude(template, "VAULT_ROTATION_ROLE=ops-rotate-internal-secret");
  mustInclude(template, "cp docs/ops/vault-external-dev.env.template .env.external-dev");
});

test("AWS single-node dev-server compose stack uses persistent raft instead of Vault dev mode", () => {
  const compose = readText(externalDevComposePath);
  const vaultConfig = readText(externalDevVaultConfigPath);
  const bootstrap = readText(externalDevBootstrapPath);

  mustInclude(compose, "vault-external-dev");
  mustInclude(compose, "vault-external-dev-init");
  mustInclude(compose, "vault-single-node-bootstrap.sh");
  mustInclude(compose, "docker/vault/config");
  mustInclude(compose, "vault-external-dev-data");
  mustInclude(compose, "mkdir -p /vault/file/raft");
  assert.doesNotMatch(compose, /-dev-listen-address/);
  assert.doesNotMatch(compose, /server"\s*,\s*"-dev"/);

  mustInclude(vaultConfig, 'storage "raft"');
  mustInclude(vaultConfig, 'path    = "/vault/file/raft"');
  mustInclude(vaultConfig, "disable_mlock = true");
  assert.doesNotMatch(vaultConfig, /tls_disable\s*=\s*0/);

  mustInclude(bootstrap, "vault operator init -key-shares=1 -key-threshold=1 -format=json");
  mustInclude(bootstrap, "vault operator unseal");
  mustInclude(bootstrap, "/vault/bootstrap/init/vault-bootstrap.sh");
  mustInclude(bootstrap, "external-dev-root-token");
});

test("AWS single-node dev-server bring-up helper validates host-local env input and prints next exports", () => {
  const helper = readText(externalDevBootstrapScriptPath);

  mustInclude(helper, "docs/ops/vault-external-dev.env.template");
  mustInclude(helper, "INTERNAL_SECRET_BOOTSTRAP=replace-me");
  mustInclude(helper, "docker compose --env-file");
  mustInclude(helper, "vault-external-dev-init");
  mustInclude(helper, "vault-external-dev");
  mustInclude(helper, "http://127.0.0.1:8200");
  mustInclude(helper, "runtime-role-id");
  mustInclude(helper, "rotation-role-id");
  mustInclude(helper, "./docker/vault/scripts/read-internal-secret.sh");
});

test("Makefile exposes the external dev-server bring-up and planning-review flow", () => {
  const makefile = readText(makefilePath);

  mustInclude(makefile, "vault-external-dev-init-env");
  mustInclude(makefile, "vault-external-dev-up");
  mustInclude(makefile, "vault-external-dev-status");
  mustInclude(makefile, "vault-external-dev-logs");
  mustInclude(makefile, "vault-external-dev-exports");
  mustInclude(makefile, "vault-external-dev-secret");
  mustInclude(makefile, "vault-external-dev-planning-review");
  mustInclude(makefile, "vault-external-dev-live");
  mustInclude(makefile, "bootstrap-external-dev-server.sh");
  mustInclude(makefile, "docker://$(EXTERNAL_DEV_CONTAINER_NAME)/vault/file/audit.log");
  mustInclude(makefile, "docker-volume-retained");
  mustInclude(makefile, "VAULT_ADDR=http://127.0.0.1:8200");
  mustInclude(makefile, "not-applicable-http-dev-server");
  mustInclude(makefile, "dev-docker-single-node");
});

test("live-external env template documents run-scoped references and measured inputs", () => {
  const template = readText(liveExternalEnvTemplatePath);

  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_RUN_ID");
  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR");
  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS");
  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF");
  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE");
  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT");
  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS");
  mustInclude(template, "VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE");
  mustInclude(template, "run_id=${VAULT_EXTERNAL_REHEARSAL_RUN_ID}");
  mustInclude(template, "dev-docker-single-node");
  mustInclude(template, "docker-volume-retained");
  mustInclude(template, "not-applicable-http-dev-server");
});

test("planning-review mode emits fresh indexed evidence but flags that live completion is still required", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-planning-");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T120000Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildBaseEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_MODE: "planning-review",
    },
    { cwd: workspaceRoot },
  );

  assert.equal(result.status, 0, `planning-review rehearsal failed: ${result.stderr}\n${result.stdout}`);

  const summaryPath = path.join(tempDir, `summary-${runId}.json`);
  const latestSummaryPath = path.join(tempDir, "latest-summary.json");
  const indexPath = path.join(tempDir, "index.json");
  const logPath = path.join(tempDir, `cutover-${runId}.log`);
  const auditPath = path.join(tempDir, `audit-retention-${runId}.json`);
  const trustPath = path.join(tempDir, `trust-continuity-${runId}.json`);
  const rotationPath = path.join(tempDir, `rotation-propagation-${runId}.json`);

  for (const filePath of [
    summaryPath,
    latestSummaryPath,
    indexPath,
    logPath,
    auditPath,
    trustPath,
    rotationPath,
  ]) {
    assert.ok(fs.existsSync(filePath), `missing planning-review artifact: ${filePath}`);
  }

  const summary = readJson(summaryPath);
  const index = readJson(indexPath);
  const audit = readJson(auditPath);
  const trust = readJson(trustPath);
  const rotation = readJson(rotationPath);

  assert.equal(summary.execution_mode, "planning-review");
  assert.equal(summary.acceptance_state, "preparation-only");
  assert.equal(summary.live_external_completion_eligible, false);
  assert.equal(summary.decision_matrix_verdict, "planning-review-only");
  assert.equal(summary.rollback_triggered, false);
  assert.equal(summary.audit_retention_days, 120);
  assert.equal(summary.immutable_store_type, "S3 Object Lock Compliance mode");
  assert.equal(summary.immutable_evidence_ref, `s3://vault-evidence/fix/story-0-14/${runId}`);
  assert.equal(summary.required_probes.length, 5);
  assert.equal(audit.execution_mode, "planning-review");
  assert.equal(trust.execution_mode, "planning-review");
  assert.equal(rotation.execution_mode, "planning-review");
  assert.equal(index.runs.length, 1);
  assert.equal(index.runs[0].run_id, runId);
  assert.equal(index.runs[0].execution_mode, "planning-review");
});

test("live-external mode requires Story 0.13 done and explicit confirmation", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-gate-");
  const outputDir = buildEvidenceOutputDir();
  const runId = "20260320T121500Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildBaseEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_MODE: "live-external",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "live mode should fail when entry gate is not satisfied");
  assert.match(result.stdout + result.stderr, /Story 0\.13/);
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_CONFIRM_LIVE=1/);
});

test("live-external mode normalizes operator-supplied measurements into passing indexed evidence", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-pass-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T140000Z";
  const result = runBashScript(
    workspaceScriptPath,
    buildPassingLiveEnv(outputDir, runId),
    { cwd: workspaceRoot },
  );

  assert.equal(result.status, 0, `live rehearsal contract failed: ${result.stderr}\n${result.stdout}`);

  const summary = readJson(path.join(tempDir, `summary-${runId}.json`));
  const latestSummary = readJson(path.join(tempDir, "latest-summary.json"));
  const audit = readJson(path.join(tempDir, `audit-retention-${runId}.json`));
  const trust = readJson(path.join(tempDir, `trust-continuity-${runId}.json`));
  const rotation = readJson(path.join(tempDir, `rotation-propagation-${runId}.json`));
  const index = readJson(path.join(tempDir, "index.json"));

  assert.equal(summary.execution_mode, "live-external");
  assert.equal(summary.acceptance_state, "live-external-ready");
  assert.equal(summary.live_external_completion_eligible, true);
  assert.equal(summary.story_0_13_status, "done");
  assert.equal(summary.cutover_seconds, 270);
  assert.equal(summary.rotation_seconds, 600);
  assert.equal(summary.audit_retention_days, 120);
  assert.equal(summary.critical_secret_auth_error_count, 0);
  assert.equal(summary.decision_matrix_verdict, "fail-fast-enforced");
  assert.equal(summary.rollback_triggered, false);
  assert.equal(summary.environment, "staging-like");
  assert.equal(summary.audit_access, `audit://vault/export?run_id=${runId}`);
  assert.equal(summary.immutable_evidence_ref, `s3://vault-evidence/fix/story-0-14/${runId}`);
  assert.equal(
    summary.trust_continuity.verification_reference,
    `openssl s_client -verify_hostname vault.example.internal # run_id=${runId}`,
  );
  assert.equal(summary.gates.cutover_within_slo, true);
  assert.equal(summary.gates.rotation_within_slo, true);
  assert.equal(summary.gates.audit_retention_met, true);
  assert.equal(summary.gates.immutable_storage_configured, true);
  assert.equal(summary.gates.immutable_store_type_recognized, true);
  assert.equal(summary.gates.live_entry_gate_satisfied, true);
  assert.equal(summary.gates.target_environment_matched, true);
  assert.equal(summary.gates.audit_actor_path_metadata_present, true);
  assert.equal(summary.gates.protected_paths_fail_fast, true);
  assert.equal(summary.gates.non_protected_paths_documented, true);
  assert.equal(summary.gates.decision_matrix_enforced, true);
  assert.equal(summary.gates.decision_matrix_verdict_consistent, true);
  assert.equal(summary.gates.restart_sequence_documented, true);
  assert.equal(summary.gates.run_scoped_evidence_refs_present, true);
  assert.equal(summary.gates.output_dir_contract_met, true);
  assert.equal(summary.required_probes[4].name, "runtime-secret-effectiveness");
  assert.match(summary.required_probes[4].headers["X-Internal-Secret"], /\$\{COREBANK_INTERNAL_SECRET/);
  assert.deepEqual(summary.restart_sequence, [
    "restart channel-service",
    "restart corebank-service",
    "restart fep-gateway",
    "restart fep-simulator",
  ]);
  assert.deepEqual(summary, latestSummary);
  assert.equal(audit.retention_days, 120);
  assert.equal(audit.actor_path_metadata_present, true);
  assert.equal(audit.verdict, "pass");
  assert.equal(trust.hostname_verification.result, "passed");
  assert.equal(trust.downtime_seconds, 240);
  assert.equal(trust.verdict, "pass");
  assert.equal(rotation.measurement_formula, "t1 - t0");
  assert.equal(rotation.rotation_seconds, 600);
  assert.equal(rotation.verdict, "pass");
  assert.equal(index.runs.length, 1);
  assert.equal(index.runs[0].run_id, runId);
  assert.equal(index.runs[0].execution_mode, "live-external");
});

test("live-external mode accepts the repository-owned Docker completion environment", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-docker-pass-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260321T120000Z";
  const result = runBashScript(
    workspaceScriptPath,
    buildPassingLiveEnv(outputDir, runId, {
      VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT: "dev-docker-single-node",
      VAULT_EXTERNAL_REHEARSAL_CA_DISTRIBUTION_PATH: "not-applicable-http-dev-server",
      VAULT_EXTERNAL_REHEARSAL_TRUSTSTORE_PATH: "not-applicable-http-dev-server",
      VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS: `docker://vault-external-dev/vault/file/audit.log?run_id=${runId}`,
      VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE: "docker-volume-retained",
      VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF: `docker://vault-external-dev-data/vault-external/${runId}`,
      VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT: "not-applicable-http-dev-server",
      VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT: "not-applicable-http-dev-server",
      VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE: `docker-http-exception # run_id=${runId}`,
    }),
    { cwd: workspaceRoot },
  );

  assert.equal(result.status, 0, `docker live rehearsal contract failed: ${result.stderr}\n${result.stdout}`);

  const summary = readJson(path.join(tempDir, `summary-${runId}.json`));
  const trust = readJson(path.join(tempDir, `trust-continuity-${runId}.json`));

  assert.equal(summary.execution_mode, "live-external");
  assert.equal(summary.acceptance_state, "live-external-ready");
  assert.equal(summary.live_external_completion_eligible, true);
  assert.equal(summary.environment, "dev-docker-single-node");
  assert.equal(summary.immutable_store_type, "docker-volume-retained");
  assert.equal(summary.gates.target_environment_matched, true);
  assert.equal(summary.gates.immutable_store_type_recognized, true);
  assert.equal(summary.gates.hostname_verification_passed, true);
  assert.equal(summary.gates.san_verification_passed, true);
  assert.equal(trust.hostname_verification.result, "not-applicable-http-dev-server");
  assert.equal(trust.san_verification.result, "not-applicable-http-dev-server");
  assert.equal(trust.verdict, "pass");
});

test("live-external mode ignores legacy Story 0.13 env overrides and uses sprint tracking", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-legacy-override-", "review");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T141500Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildBaseEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_MODE: "live-external",
      VAULT_EXTERNAL_REHEARSAL_CONFIRM_LIVE: "1",
      VAULT_EXTERNAL_REHEARSAL_STORY_0_13_STATUS: "done",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "legacy Story 0.13 env override must not bypass the entry gate");
  assert.match(result.stdout + result.stderr, /is ignored/i);
  assert.match(result.stdout + result.stderr, /Story 0\.13 must be done/i);
  assert.equal(
    fs.existsSync(path.join(tempDir, `summary-${runId}.json`)),
    false,
    "failed entry-gate runs must not emit partial evidence artifacts",
  );
});

test("live-external mode ignores custom sprint-status file overrides and uses the repository sprint ledger", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-ledger-override-", "review");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T142000Z";
  const overrideSprintStatusPath = path.join(workspaceRoot, "override-sprint-status.yaml");
  fs.writeFileSync(
    overrideSprintStatusPath,
    [
      "generated: 2026-03-20 20:49",
      "project: fix",
      "development_status:",
      "  0-13-vault-production-separation-and-external-operations: done",
      "",
    ].join("\n"),
  );

  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildBaseEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_MODE: "live-external",
      VAULT_EXTERNAL_REHEARSAL_CONFIRM_LIVE: "1",
      VAULT_EXTERNAL_REHEARSAL_SPRINT_STATUS_FILE: overrideSprintStatusPath,
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "custom sprint-status path must not bypass the entry gate");
  assert.match(result.stdout + result.stderr, /SPRINT_STATUS_FILE is ignored/i);
  assert.match(result.stdout + result.stderr, /Story 0\.13 must be done/i);
  assert.equal(
    fs.existsSync(path.join(tempDir, `summary-${runId}.json`)),
    false,
    "ignored sprint-status overrides must not create live evidence artifacts",
  );
});

test("live-external mode requires explicit trust, decision matrix, audit, retention, error-count, and restart evidence inputs", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-required-inputs-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T142500Z";
  const env = buildPassingLiveEnv(outputDir, runId);
  delete env.VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT;
  delete env.VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS;
  delete env.VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE;
  delete env.VAULT_EXTERNAL_REHEARSAL_PROTECTED_OUTAGE_VERDICT;
  delete env.VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT;
  delete env.VAULT_EXTERNAL_REHEARSAL_ACTOR_PATH_METADATA_PRESENT;

  const result = runBashScript(
    workspaceScriptPath,
    env,
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "live rehearsal must require explicit trust and decision matrix evidence");
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT/);
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_RETENTION_DAYS/);
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_RESTART_SEQUENCE/);
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_PROTECTED_OUTAGE_VERDICT/);
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT/);
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_ACTOR_PATH_METADATA_PRESENT/);
  assert.equal(
    fs.existsSync(path.join(tempDir, `summary-${runId}.json`)),
    false,
    "missing live evidence inputs must fail before any evidence pack is written",
  );
});

test("live-external mode fails when actor or path audit metadata is missing", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-audit-metadata-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T143000Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_ACTOR_PATH_METADATA_PRESENT: "0",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "missing audit metadata must fail the live rehearsal contract");

  const summary = readJson(path.join(tempDir, `summary-${runId}.json`));
  const audit = readJson(path.join(tempDir, `audit-retention-${runId}.json`));

  assert.equal(summary.acceptance_state, "rollback-required");
  assert.equal(summary.gates.audit_actor_path_metadata_present, false);
  assert.equal(summary.gates.overall, false);
  assert.match(summary.rollback_reason, /actor\/path audit metadata is missing/i);
  assert.equal(audit.actor_path_metadata_present, false);
  assert.equal(audit.verdict, "fail");
});

test("live-external mode fails when protected outage handling is not fail-fast", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-decision-matrix-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T144500Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_DECISION_MATRIX_VERDICT: "protected-path-breach",
      VAULT_EXTERNAL_REHEARSAL_PROTECTED_OUTAGE_VERDICT: "degraded-allowed",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "protected paths must remain fail-fast during live rehearsal");

  const summary = readJson(path.join(tempDir, `summary-${runId}.json`));

  assert.equal(summary.acceptance_state, "rollback-required");
  assert.equal(summary.gates.protected_paths_fail_fast, false);
  assert.equal(summary.gates.non_protected_paths_documented, true);
  assert.equal(summary.gates.decision_matrix_enforced, false);
  assert.equal(summary.gates.overall, false);
  assert.match(summary.rollback_reason, /protected branches did not remain fail-fast/i);
});

test("live-external mode rejects unsupported environments", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-environment-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T145000Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_ENVIRONMENT: "dev",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "only accepted completion environments should be eligible for live-ready evidence");
  assert.match(result.stdout + result.stderr, /dev-docker-single-node/i);
  assert.equal(
    fs.existsSync(path.join(tempDir, `summary-${runId}.json`)),
    false,
    "unsupported environments must fail before any live evidence pack is written",
  );
});

test("live-external mode rejects unsupported immutable store types", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-store-type-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T145500Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_STORE_TYPE: "plain-s3 bucket",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "unsupported immutable store types must fail the live rehearsal contract");
  assert.match(result.stdout + result.stderr, /IMMUTABLE_STORE_TYPE/);
  assert.equal(
    fs.existsSync(path.join(tempDir, `summary-${runId}.json`)),
    false,
    "invalid immutable store types must fail before any evidence pack is written",
  );
});

test("live-external mode requires run-scoped audit, immutable, and verification references", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-fresh-refs-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T146000Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_AUDIT_ACCESS: "audit://vault/export?window=last-week",
      VAULT_EXTERNAL_REHEARSAL_IMMUTABLE_EVIDENCE_REF: "s3://vault-evidence/fix/story-0-13/archive-20250301",
      VAULT_EXTERNAL_REHEARSAL_VERIFICATION_REFERENCE: "historical cert transcript from 2025-03-01",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "stale external references must not satisfy the live evidence contract");
  assert.match(result.stdout + result.stderr, /AUDIT_ACCESS/);
  assert.match(result.stdout + result.stderr, /IMMUTABLE_EVIDENCE_REF/);
  assert.match(result.stdout + result.stderr, /VERIFICATION_REFERENCE/);
  assert.equal(
    fs.existsSync(path.join(tempDir, `summary-${runId}.json`)),
    false,
    "non-run-scoped references must fail before any evidence pack is written",
  );
});

test("live-external mode rejects inconsistent decision-matrix verdict labels", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-verdict-consistency-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T146500Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_DECISION_MATRIX_VERDICT: "rollback-required",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "decision-matrix verdict labels must match the enforced matrix outcome");

  const summary = readJson(path.join(tempDir, `summary-${runId}.json`));

  assert.equal(summary.acceptance_state, "rollback-required");
  assert.equal(summary.gates.decision_matrix_verdict_consistent, false);
  assert.match(summary.rollback_reason, /decision matrix verdict does not match/i);
});

test("live-external mode rejects negative trust downtime values", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-negative-downtime-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T147000Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_TRUST_DOWNTIME_SECONDS: "-5",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "negative trust downtime must be rejected as invalid evidence");
  assert.match(result.stdout + result.stderr, /TRUST_DOWNTIME_SECONDS/);
  assert.equal(
    fs.existsSync(path.join(tempDir, `summary-${runId}.json`)),
    false,
    "negative trust downtime must fail before any evidence pack is written",
  );
});

test("live-external mode rejects output paths outside the dedicated evidence contract", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-output-dir-", "done");
  const runId = "20260320T147500Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(path.join(workspaceRoot, "artifacts"), runId),
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "live evidence must stay under the dedicated vault-external path");
  assert.match(result.stdout + result.stderr, /VAULT_EXTERNAL_REHEARSAL_OUTPUT_DIR/);
});

test("live-external gate breach records rollback and returns non-zero after writing artifacts", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-live-breach-", "done");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T150000Z";
  const result = runBashScript(
    workspaceScriptPath,
    {
      ...buildPassingLiveEnv(outputDir, runId),
      VAULT_EXTERNAL_REHEARSAL_START_TS: "2026-03-20T15:00:00Z",
      VAULT_EXTERNAL_REHEARSAL_ALL_PROBES_GREEN_TS: "2026-03-20T15:06:00Z",
      VAULT_EXTERNAL_REHEARSAL_END_TS: "2026-03-20T15:07:00Z",
      VAULT_EXTERNAL_REHEARSAL_ROTATION_T0: "2026-03-20T15:10:00Z",
      VAULT_EXTERNAL_REHEARSAL_ROTATION_T1: "2026-03-20T15:30:30Z",
      VAULT_EXTERNAL_REHEARSAL_TRUST_DOWNTIME_SECONDS: "420",
      VAULT_EXTERNAL_REHEARSAL_CRITICAL_SECRET_AUTH_ERROR_COUNT: "1",
      VAULT_EXTERNAL_REHEARSAL_HOSTNAME_VERIFICATION_RESULT: "failed",
      VAULT_EXTERNAL_REHEARSAL_SAN_VERIFICATION_RESULT: "failed",
      VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_STATUS: "503",
      VAULT_EXTERNAL_REHEARSAL_RUNTIME_SECRET_PROBE_DETAIL: "permission denied during Vault auth retry",
    },
    { cwd: workspaceRoot },
  );

  assert.notEqual(result.status, 0, "gate breach should fail the rehearsal contract");

  const summary = readJson(path.join(tempDir, `summary-${runId}.json`));
  const trust = readJson(path.join(tempDir, `trust-continuity-${runId}.json`));

  assert.equal(summary.execution_mode, "live-external");
  assert.equal(summary.rollback_triggered, true);
  assert.match(summary.rollback_reason, /gate breach/i);
  assert.equal(summary.gates.cutover_within_slo, false);
  assert.equal(summary.gates.rotation_within_slo, false);
  assert.equal(summary.gates.critical_secret_auth_errors_zero, false);
  assert.equal(summary.gates.trust_downtime_within_slo, false);
  assert.equal(summary.gates.hostname_verification_passed, false);
  assert.equal(trust.rollback_triggered, true);
});

test("index deduplicates repeated runs by run_id", () => {
  const { workspaceRoot, workspaceScriptPath } = createRehearsalWorkspace("vault-external-index-");
  const outputDir = buildEvidenceOutputDir();
  const tempDir = resolveEvidenceOutputDir(workspaceRoot);
  const runId = "20260320T160000Z";
  const baseEnv = {
    ...buildBaseEnv(outputDir, runId),
    VAULT_EXTERNAL_REHEARSAL_MODE: "planning-review",
  };

  const first = runBashScript(workspaceScriptPath, baseEnv, { cwd: workspaceRoot });
  assert.equal(first.status, 0, `first planning-review run failed: ${first.stderr}\n${first.stdout}`);

  const second = runBashScript(workspaceScriptPath, baseEnv, { cwd: workspaceRoot });
  assert.equal(second.status, 0, `second planning-review run failed: ${second.stderr}\n${second.stdout}`);

  const index = readJson(path.join(tempDir, "index.json"));
  const logLines = readText(path.join(tempDir, `cutover-${runId}.log`))
    .trim()
    .split(/\r?\n/);
  const matchingRuns = index.runs.filter((item) => item.run_id === runId);

  assert.equal(matchingRuns.length, 1, "duplicate run_id entries should be deduplicated");
  assert.match(matchingRuns[0].summary_file, new RegExp(`summary-${runId}\\.json$`));
  assert.equal(logLines.length, 5, "reused run IDs should rewrite deterministic evidence logs");
  assert.equal(
    logLines.filter((line) => line.includes("Generating planning-review rehearsal artifacts")).length,
    1,
    "reused run IDs should not append stale log output",
  );
});
