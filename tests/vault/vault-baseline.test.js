"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const composePath = path.join(repoRoot, "docker-compose.yml");
const vaultComposePath = path.join(repoRoot, "docker-compose.vault.yml");
const envExamplePath = path.join(repoRoot, ".env.example");
const docsPath = path.join(repoRoot, "docs", "ops", "vault-secrets-foundation.md");
const docsPublishWorkflowPath = path.join(repoRoot, ".github", "workflows", "docs-publish.yml");

const vaultPolicyCiPath = path.join(
  repoRoot,
  "docker",
  "vault",
  "policies",
  "ci-docs-publish.hcl",
);
const vaultPolicyRuntimePath = path.join(
  repoRoot,
  "docker",
  "vault",
  "policies",
  "runtime-internal-secret.hcl",
);
const vaultPolicyRotationPath = path.join(
  repoRoot,
  "docker",
  "vault",
  "policies",
  "ops-rotation-internal-secret.hcl",
);
const vaultBootstrapPath = path.join(repoRoot, "docker", "vault", "init", "vault-bootstrap.sh");
const vaultReadScriptPath = path.join(repoRoot, "docker", "vault", "scripts", "read-internal-secret.sh");
const vaultRotateScriptPath = path.join(
  repoRoot,
  "docker",
  "vault",
  "scripts",
  "rotate-internal-secret.sh",
);
const vaultChaosScriptPath = path.join(
  repoRoot,
  "docker",
  "vault",
  "scripts",
  "check-vault-unreachable.sh",
);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function mustInclude(text, needle) {
  assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("Vault baseline assets exist for bootstrap, runtime retrieval, rotation, and policies", () => {
  for (const filePath of [
    vaultBootstrapPath,
    vaultReadScriptPath,
    vaultRotateScriptPath,
    vaultPolicyCiPath,
    vaultPolicyRuntimePath,
    vaultPolicyRotationPath,
    docsPath,
  ]) {
    assert.ok(fs.existsSync(filePath), `missing required file: ${filePath}`);
  }
});

test("Vault bootstrap config enforces least-privilege policy mapping and short-lived auth credentials", () => {
  const ciPolicy = readText(vaultPolicyCiPath);
  const runtimePolicy = readText(vaultPolicyRuntimePath);
  const rotationPolicy = readText(vaultPolicyRotationPath);
  const bootstrap = readText(vaultBootstrapPath);
  const readScript = readText(vaultReadScriptPath);
  const rotateScript = readText(vaultRotateScriptPath);

  mustInclude(ciPolicy, 'capabilities = ["read"]');
  mustInclude(runtimePolicy, 'capabilities = ["read"]');
  mustInclude(rotationPolicy, 'capabilities = ["create", "update", "read"]');
  assert.doesNotMatch(ciPolicy, /\bcreate\b|\bupdate\b|\bdelete\b/);
  assert.doesNotMatch(runtimePolicy, /\bcreate\b|\bupdate\b|\bdelete\b/);

  mustInclude(bootstrap, "auth/jwt/role/ci-docs-publish");
  assert.match(bootstrap, /token_ttl\": \"5m\"|token_ttl="5m"/);
  assert.match(bootstrap, /token_max_ttl\": \"15m\"|token_max_ttl="15m"/);
  mustInclude(bootstrap, "job_workflow_ref");
  mustInclude(bootstrap, "auth/approle/role/${VAULT_RUNTIME_ROLE}");
  mustInclude(bootstrap, 'token_ttl="5m"');
  mustInclude(bootstrap, 'token_max_ttl="30m"');
  mustInclude(bootstrap, 'secret_id_ttl="24h"');
  mustInclude(readScript, 'grep -qx "vault-external-dev"');
  mustInclude(readScript, "http://127.0.0.1:8200");
  mustInclude(rotateScript, 'grep -qx "vault-external-dev"');
  mustInclude(rotateScript, "http://127.0.0.1:8200");
});

test("docker compose includes Vault + vault-init services and removes static INTERNAL_SECRET fallback", () => {
  const compose = readText(composePath);

  mustInclude(compose, "vault:");
  mustInclude(compose, "container_name: vault");
  mustInclude(compose, "vault-init:");
  mustInclude(compose, "VAULT_ADDR:");
  mustInclude(compose, "${INTERNAL_SECRET:?INTERNAL_SECRET must be provided");
  assert.doesNotMatch(compose, /\$\{INTERNAL_SECRET:-local-internal-secret\}/);
});

test("Vault bootstrap compose file exists and does not require runtime INTERNAL_SECRET interpolation", () => {
  assert.ok(fs.existsSync(vaultComposePath), `missing vault bootstrap compose: ${vaultComposePath}`);
  const vaultCompose = readText(vaultComposePath);

  mustInclude(vaultCompose, "vault:");
  mustInclude(vaultCompose, "vault-init:");
  assert.doesNotMatch(vaultCompose, /\$\{INTERNAL_SECRET:\?/);
});

test(".env.example includes Vault-focused variables and avoids plain-text secret defaults", () => {
  const envExample = readText(envExamplePath);

  mustInclude(envExample, "INTERNAL_SECRET=");
  mustInclude(envExample, "VAULT_ADDR=");
  mustInclude(envExample, "VAULT_AUDIT_LOG_PATH=");
  assert.doesNotMatch(envExample, /INTERNAL_SECRET=local-internal-secret/);
});

test("docs-publish workflow includes OIDC permissions and Vault JWT login flow", () => {
  const workflow = readText(docsPublishWorkflowPath);

  mustInclude(workflow, "id-token: write");
  mustInclude(workflow, "VAULT_ADDR");
  mustInclude(workflow, "VAULT_SECRET_MODE=degraded");
  mustInclude(workflow, "env.VAULT_ADDR == ''");
  mustInclude(workflow, "vault write -field=token auth/jwt/login");
  mustInclude(workflow, "role=ci-docs-publish");
  mustInclude(workflow, "assemble-openapi-docs-site.mjs --output-dir \"$PWD/docs-site\"");
  assert.doesNotMatch(workflow, /assemble-openapi-docs-site\.mjs --repo-root "\$PWD"/);
});

test("Vault runbook defines secret paths, least-privilege matrix, rotation drill, audit check, and fallback behavior", () => {
  const runbook = readText(docsPath);

  mustInclude(runbook, "secret/fix/shared/core-services/internal-secret");
  mustInclude(runbook, "GitHub Actions OIDC");
  mustInclude(runbook, "AppRole");
  mustInclude(runbook, "Rotation drill");
  mustInclude(runbook, "vault audit");
  mustInclude(runbook, "fail-fast");
  mustInclude(runbook, "degraded mode");
  mustInclude(runbook, "docker-compose.vault.yml");
  mustInclude(runbook, "ops-rotate-internal-secret");
});

test("Vault chaos drill enforces post-restart readiness checks before completion", () => {
  const chaosScript = readText(vaultChaosScriptPath);

  mustInclude(chaosScript, "wait_for_vault_healthy");
  mustInclude(chaosScript, "wait_for_vault_init_exit");
  mustInclude(chaosScript, "ERROR: vault-init exited with code");
  mustInclude(chaosScript, "ERROR: vault did not become ready");
  assert.match(
    chaosScript,
    /docker start vault[\s\S]*wait_for_vault_healthy[\s\S]*docker start vault-init[\s\S]*wait_for_vault_init_exit[\s\S]*wait_for_vault_healthy/,
  );
});
