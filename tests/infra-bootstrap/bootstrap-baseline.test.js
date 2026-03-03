"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const matrixPath = path.join(repoRoot, "scripts", "infra-bootstrap", "component-matrix.yaml");
const bootstrapPath = path.join(repoRoot, "scripts", "infra-bootstrap", "bootstrap.sh");
const parityPath = path.join(repoRoot, "scripts", "infra-bootstrap", "check-parity.sh");
const integrationValidationPath = path.join(
  repoRoot,
  "scripts",
  "infra-bootstrap",
  "validate-nginx-vault.sh",
);
const runbookPath = path.join(repoRoot, "docs", "ops", "infrastructure-bootstrap-runbook.md");
const drillEvidencePath = path.join(
  repoRoot,
  "docs",
  "ops",
  "evidence",
  "infrastructure-bootstrap-recovery-drill.log",
);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function mustInclude(text, needle) {
  assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("component matrix defines environment components, owners, and dependency graph", () => {
  assert.ok(fs.existsSync(matrixPath), `missing matrix file: ${matrixPath}`);
  const matrix = readText(matrixPath);

  mustInclude(matrix, "environment: dev");
  mustInclude(matrix, "environment: staging");
  mustInclude(matrix, "component: vault");
  mustInclude(matrix, "component: edge-gateway");
  mustInclude(matrix, "owner:");
  mustInclude(matrix, "depends_on:");
});

test("bootstrap entrypoint is idempotent and produces machine-checkable outputs", () => {
  assert.ok(fs.existsSync(bootstrapPath), `missing bootstrap script: ${bootstrapPath}`);
  const bootstrap = readText(bootstrapPath);

  mustInclude(bootstrap, "BOOTSTRAP_SKIP_RUNTIME_VALIDATION:-0");
  mustInclude(bootstrap, "matrix_required_components_by_type");
  mustInclude(bootstrap, "docker network inspect");
  mustInclude(bootstrap, "docker volume inspect");
  mustInclude(bootstrap, "docker rm -f");
  mustInclude(bootstrap, "bootstrap-report.json");
  mustInclude(bootstrap, "already-present");
  mustInclude(bootstrap, "provisioned");
  assert.doesNotMatch(bootstrap, /\beval\b/);
});

test("nginx and vault integration validation script checks both baselines", () => {
  assert.ok(
    fs.existsSync(integrationValidationPath),
    `missing integration validation script: ${integrationValidationPath}`,
  );
  const validationScript = readText(integrationValidationPath);

  mustInclude(validationScript, "validate-edge-gateway.sh");
  mustInclude(validationScript, "read-internal-secret.sh");
  mustInclude(validationScript, "runtime-internal-secret.hcl");
  mustInclude(validationScript, "ci-docs-publish.hcl");
  mustInclude(validationScript, "MAIN_COMPOSE_FILE");
  mustInclude(validationScript, "VAULT_COMPOSE_FILE");
});

test("parity check script detects missing and mismatched baseline components", () => {
  assert.ok(fs.existsSync(parityPath), `missing parity script: ${parityPath}`);
  const parityScript = readText(parityPath);

  mustInclude(parityScript, "missing_components");
  mustInclude(parityScript, "misaligned_components");
  mustInclude(parityScript, "PARITY_STATUS");
  mustInclude(parityScript, "PARITY_MATRIX_PATH");
  mustInclude(parityScript, "matrix_components_by_type");
  mustInclude(parityScript, "PARITY_INDUCED_MISMATCH_COMPONENT");
});

test("runbook documents onboarding sequence and deterministic recovery strategy", () => {
  assert.ok(fs.existsSync(runbookPath), `missing runbook: ${runbookPath}`);
  const runbook = readText(runbookPath);

  mustInclude(runbook, "First-time bootstrap");
  mustInclude(runbook, "Idempotent re-run");
  mustInclude(runbook, "Partial-failure recovery");
  mustInclude(runbook, "rollback");
});

test("partial-failure drill evidence captures deterministic recovery outcome", () => {
  assert.ok(fs.existsSync(drillEvidencePath), `missing drill evidence: ${drillEvidencePath}`);
  const evidence = readText(drillEvidencePath);

  mustInclude(evidence, "failure_step=");
  mustInclude(evidence, "recovery_action=");
  mustInclude(evidence, "result=recovered");
});
