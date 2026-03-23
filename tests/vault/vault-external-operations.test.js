"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const allowlistPath = path.join(repoRoot, ".github", "vault-protected-workflows.txt");
const resolveSecretScriptPath = path.join(repoRoot, ".github", "scripts", "vault", "resolve-internal-secret.sh");
const validateNonlocalProfileScriptPath = path.join(repoRoot, "scripts", "vault", "validate-nonlocal-profile.sh");
const externalOpsDocPath = path.join(repoRoot, "docs", "ops", "vault-external-operations.md");
const componentMatrixPath = path.join(repoRoot, "scripts", "infra-bootstrap", "component-matrix.yaml");
const composePath = path.join(repoRoot, "docker-compose.yml");
const channelProdPath = path.join(repoRoot, "BE", "channel-service", "src", "main", "resources", "application-prod.yml");
const channelStagingPath = path.join(
  repoRoot,
  "BE",
  "channel-service",
  "src",
  "main",
  "resources",
  "application-staging.yml",
);
const corebankProdPath = path.join(repoRoot, "BE", "corebank-service", "src", "main", "resources", "application-prod.yml");
const corebankStagingPath = path.join(
  repoRoot,
  "BE",
  "corebank-service",
  "src",
  "main",
  "resources",
  "application-staging.yml",
);
const fepGatewayProdPath = path.join(repoRoot, "BE", "fep-gateway", "src", "main", "resources", "application-prod.yml");
const fepGatewayStagingPath = path.join(
  repoRoot,
  "BE",
  "fep-gateway",
  "src",
  "main",
  "resources",
  "application-staging.yml",
);
const fepSimulatorProdPath = path.join(
  repoRoot,
  "BE",
  "fep-simulator",
  "src",
  "main",
  "resources",
  "application-prod.yml",
);
const fepSimulatorStagingPath = path.join(
  repoRoot,
  "BE",
  "fep-simulator",
  "src",
  "main",
  "resources",
  "application-staging.yml",
);

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function toBashPath(filePath) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
}

function normalizeEnvValue(key, value) {
  if (typeof value !== "string") {
    return value;
  }
  if (key === "PATH") {
    return value;
  }
  if (/^[A-Za-z]:[\\/]/.test(value)) {
    return toBashPath(value);
  }
  return value.replace(/\\/g, "/");
}

function quoteForBash(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function pathOverrideForBash(value) {
  return String(value)
    .split(";")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "")
    .map((segment) => (/^[A-Za-z]:[\\/]/.test(segment) ? toBashPath(segment) : segment.replace(/\\/g, "/")))
    .join(":");
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeExecutable(dirPath, fileName, content) {
  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, content, { mode: 0o755 });
  return filePath;
}

function createCaBundle(dirPath) {
  const caBundlePath = path.join(dirPath, "vault-ca.pem");
  fs.writeFileSync(caBundlePath, "mock-ca\n");
  return caBundlePath;
}

function runBashScript(scriptPath, env = {}, args = []) {
  const normalizedEnv = {
    ...process.env,
  };
  const envAssignments = Object.entries(env)
    .map(([key, value]) => {
      if (key === "PATH") {
        return `${key}=${quoteForBash(pathOverrideForBash(value))}:"$PATH"`;
      }
      return `${key}=${quoteForBash(normalizeEnvValue(key, value))}`;
    });
  const command = [
    ...envAssignments,
    quoteForBash("/bin/bash"),
    quoteForBash(toBashPath(scriptPath)),
    ...args.map((value) => quoteForBash(String(value).replace(/\\/g, "/"))),
  ].join(" ");
  return spawnSync("bash", ["-lc", command], {
    cwd: repoRoot,
    env: normalizedEnv,
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
}

function parseGitHubEnv(filePath) {
  const lines = readText(filePath).split(/\r?\n/);
  const values = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    const multilineMatch = line.match(/^([^=]+)<<(.+)$/);
    if (multilineMatch) {
      const [, key, delimiter] = multilineMatch;
      const chunks = [];
      index += 1;
      while (index < lines.length && lines[index] !== delimiter) {
        chunks.push(lines[index]);
        index += 1;
      }
      values[key] = chunks.join("\n");
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    values[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1);
  }

  return values;
}

function runResolver(stubConfig = {}, envOverrides = {}) {
  const stubDir = makeTempDir("vault-gha-stubs-");
  const githubEnvPath = path.join(stubDir, "github.env");
  const caBundlePath = createCaBundle(stubDir);
  const curlArgsPath = path.join(stubDir, "curl.args");
  const curlRequestUrlPath = path.join(stubDir, "curl.request-url");
  const curlStdoutPath = path.join(stubDir, "curl.stdout");
  const curlStderrPath = path.join(stubDir, "curl.stderr");
  const curlExitPath = path.join(stubDir, "curl.exit");
  const loginStdoutPath = path.join(stubDir, "vault-login.stdout");
  const loginStderrPath = path.join(stubDir, "vault-login.stderr");
  const loginExitPath = path.join(stubDir, "vault-login.exit");
  const kvStdoutPath = path.join(stubDir, "vault-kv.stdout");
  const kvStderrPath = path.join(stubDir, "vault-kv.stderr");
  const kvExitPath = path.join(stubDir, "vault-kv.exit");
  const bashCurlArgsPath = toBashPath(curlArgsPath);
  const bashCurlRequestUrlPath = toBashPath(curlRequestUrlPath);
  const bashCurlStdoutPath = toBashPath(curlStdoutPath);
  const bashCurlStderrPath = toBashPath(curlStderrPath);
  const bashCurlExitPath = toBashPath(curlExitPath);
  const bashLoginStdoutPath = toBashPath(loginStdoutPath);
  const bashLoginStderrPath = toBashPath(loginStderrPath);
  const bashLoginExitPath = toBashPath(loginExitPath);
  const bashKvStdoutPath = toBashPath(kvStdoutPath);
  const bashKvStderrPath = toBashPath(kvStderrPath);
  const bashKvExitPath = toBashPath(kvExitPath);

  fs.writeFileSync(curlStdoutPath, stubConfig.curlStdout ?? '{"value":"mock-jwt"}');
  fs.writeFileSync(curlStderrPath, stubConfig.curlStderr ?? "");
  fs.writeFileSync(curlExitPath, String(stubConfig.curlExit ?? 0));
  fs.writeFileSync(loginStdoutPath, stubConfig.loginStdout ?? "vault-token\n");
  fs.writeFileSync(loginStderrPath, stubConfig.loginStderr ?? "");
  fs.writeFileSync(loginExitPath, String(stubConfig.loginExit ?? 0));
  fs.writeFileSync(kvStdoutPath, stubConfig.kvStdout ?? "resolved-secret\n");
  fs.writeFileSync(kvStderrPath, stubConfig.kvStderr ?? "");
  fs.writeFileSync(kvExitPath, String(stubConfig.kvExit ?? 0));

  writeExecutable(
    stubDir,
    "curl",
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" > "${bashCurlArgsPath}"
printf '%s\\n' "\${*: -1}" > "${bashCurlRequestUrlPath}"
if [[ -s "${bashCurlStderrPath}" ]]; then
  cat "${bashCurlStderrPath}" >&2
fi
if [[ "$(cat "${bashCurlExitPath}")" != "0" ]]; then
  exit "$(cat "${bashCurlExitPath}")"
fi
cat "${bashCurlStdoutPath}"
`,
  );

  writeExecutable(
    stubDir,
    "vault",
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == *"auth/jwt/login"* ]]; then
  if [[ -s "${bashLoginStderrPath}" ]]; then
    cat "${bashLoginStderrPath}" >&2
  fi
  if [[ "$(cat "${bashLoginExitPath}")" != "0" ]]; then
    exit "$(cat "${bashLoginExitPath}")"
  fi
  cat "${bashLoginStdoutPath}"
  exit 0
fi
if [[ "$*" == *"kv get -field=value secret/fix/shared/core-services/internal-secret"* ]]; then
  if [[ -s "${bashKvStderrPath}" ]]; then
    cat "${bashKvStderrPath}" >&2
  fi
  if [[ "$(cat "${bashKvExitPath}")" != "0" ]]; then
    exit "$(cat "${bashKvExitPath}")"
  fi
  cat "${bashKvStdoutPath}"
  exit 0
fi
printf 'unexpected vault call: %s\\n' "$*" >&2
exit 1
`,
  );

  const env = {
    PATH: `${stubDir};${String(process.env.PATH || "")}`,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.githubusercontent.com/request?existing=1",
    GITHUB_WORKFLOW_REF: "DoYouLikeFIx/FIXYZ/.github/workflows/docs-publish.yml@refs/heads/main",
    GITHUB_REF_NAME: "main",
    VAULT_PROTECTED_WORKFLOWS_FILE: allowlistPath,
    VAULT_ADDR: "https://vault.example.internal",
    VAULT_CACERT: caBundlePath,
    GITHUB_ENV: githubEnvPath,
    ...envOverrides,
  };

  const result = runBashScript(toBashPath(resolveSecretScriptPath), env);
  return { result, githubEnvPath, caBundlePath, curlArgsPath, curlRequestUrlPath };
}

function extractServiceBlock(compose, serviceName, nextServiceName) {
  const blockPattern = new RegExp(
    `\\n  ${serviceName}:([\\s\\S]*?)\\n  ${nextServiceName}:`,
    "m",
  );
  const match = compose.match(blockPattern);
  assert.ok(match, `unable to extract compose block for ${serviceName}`);
  return match[1];
}

test("external Vault guardrail assets exist and document the Story 0.14 handoff", () => {
  for (const filePath of [
    allowlistPath,
    resolveSecretScriptPath,
    validateNonlocalProfileScriptPath,
    externalOpsDocPath,
  ]) {
    assert.ok(fs.existsSync(filePath), `missing external Vault asset: ${filePath}`);
  }

  const runbook = readText(externalOpsDocPath);
  assert.match(runbook, /Story 0\.14/);
  assert.match(runbook, /channel-service.*TOTP Vault client/i);
  assert.match(runbook, /external-vault-only/);
  assert.match(runbook, /\.github\/vault-protected-workflows\.txt/);
  assert.match(runbook, /VAULT_CACERT/);
  assert.match(runbook, /16` -> `ALLOWLIST/);
});

test("workflow allowlist only references real workflow files and resolver avoids shell xtrace", () => {
  const allowlistEntries = readText(allowlistPath)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

  assert.ok(allowlistEntries.length > 0, "workflow allowlist should not be empty");
  for (const entry of allowlistEntries) {
    assert.ok(fs.existsSync(path.join(repoRoot, entry)), `allowlist entry does not exist: ${entry}`);
  }

  const resolverScript = readText(resolveSecretScriptPath);
  assert.doesNotMatch(resolverScript, /\nset -x\b/);
  assert.match(resolverScript, /::add-mask::/);
  assert.match(resolverScript, /unset internal_secret vault_token oidc_jwt oidc_response/);

  for (const entry of allowlistEntries) {
    const workflow = readText(path.join(repoRoot, entry));
    assert.match(workflow, /^[ \t]+id-token:\s*write(?:\s|$)/m);
    assert.match(workflow, /^(?!\s*#).*\.github\/scripts\/vault\/resolve-internal-secret\.sh/m);
  }
});

test("protected workflow secret resolver succeeds with explicit TLS guardrails", () => {
  const { result, githubEnvPath } = runResolver();

  assert.equal(result.status, 0, `resolver failed: ${result.stderr}\n${result.stdout}`);
  const githubEnv = parseGitHubEnv(githubEnvPath);
  assert.equal(githubEnv.INTERNAL_SECRET, "resolved-secret");
  assert.equal(githubEnv.VAULT_SECRET_MODE, "vault");
});

test("protected workflow secret resolver URL-encodes custom OIDC audiences", () => {
  const { result, curlRequestUrlPath } = runResolver({}, {
    VAULT_OIDC_AUDIENCE: "https://vault.example.internal?aud=docs&team=platform ops",
  });

  assert.equal(result.status, 0, `resolver failed: ${result.stderr}\n${result.stdout}`);
  const requestUrl = readText(curlRequestUrlPath).trim();
  assert.match(requestUrl, /audience=https%3A%2F%2Fvault\.example\.internal%3Faud%3Ddocs%26team%3Dplatform%20ops$/);
});

test("protected workflow secret resolver keeps Vault CA trust out of GitHub OIDC curl", () => {
  const { result, curlArgsPath } = runResolver();

  assert.equal(result.status, 0, `resolver failed: ${result.stderr}\n${result.stdout}`);
  const curlArgs = readText(curlArgsPath);
  assert.doesNotMatch(curlArgs, /--cacert/);
});

test("protected workflow secret resolver requires explicit CA trust for protected flows", () => {
  const { result } = runResolver({}, { VAULT_CACERT: "" });

  assert.equal(result.status, 12, `expected TLS trust failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:TLS_TRUST/);
});

test("protected workflow secret resolver fails closed when Vault endpoint is plaintext", () => {
  const { result } = runResolver({}, { VAULT_ADDR: "http://vault.example.internal" });

  assert.equal(result.status, 12, `expected TLS guard failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:TLS_TRUST/);
});

test("protected workflow secret resolver fails on stale allowlist entries", () => {
  const stubDir = makeTempDir("vault-gha-allowlist-");
  const staleAllowlistPath = path.join(stubDir, "vault-protected-workflows.txt");
  fs.writeFileSync(
    staleAllowlistPath,
    [
      ".github/workflows/docs-publish.yml",
      ".github/workflows/does-not-exist.yml",
      "",
    ].join("\n"),
  );

  const { result } = runResolver({}, { VAULT_PROTECTED_WORKFLOWS_FILE: staleAllowlistPath });

  assert.equal(result.status, 16, `expected allowlist failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:ALLOWLIST/);
});

test("protected workflow secret resolver fails when allowlisted workflow skips resolver policy", () => {
  const stubDir = makeTempDir("vault-gha-allowlist-policy-");
  const workflowPath = path.join(stubDir, "protected.yml");
  const allowlistFilePath = path.join(stubDir, "vault-protected-workflows.txt");
  fs.writeFileSync(
    workflowPath,
    [
      "name: Broken Protected Workflow",
      "permissions:",
      "  contents: read",
      "  id-token: write",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo missing vault resolver",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(allowlistFilePath, `${workflowPath}\n`);

  const { result } = runResolver({}, {
    GITHUB_WORKFLOW_REF: `DoYouLikeFIx/FIXYZ/${workflowPath}@refs/heads/main`,
    VAULT_WORKFLOW_PATH: workflowPath,
    VAULT_PROTECTED_WORKFLOWS_FILE: allowlistFilePath,
  });

  assert.equal(result.status, 16, `expected allowlist policy failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:ALLOWLIST/);
});

test("protected workflow secret resolver fails when resolver and id-token permission live in different jobs", () => {
  const stubDir = makeTempDir("vault-gha-allowlist-split-job-policy-");
  const workflowPath = path.join(stubDir, "protected.yml");
  const allowlistFilePath = path.join(stubDir, "vault-protected-workflows.txt");
  fs.writeFileSync(
    workflowPath,
    [
      "name: Broken Protected Workflow",
      "jobs:",
      "  auth-only:",
      "    permissions:",
      "      id-token: write",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo token only",
      "  publish:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: ./.github/scripts/vault/resolve-internal-secret.sh",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(allowlistFilePath, `${workflowPath}\n`);

  const { result } = runResolver({}, {
    GITHUB_WORKFLOW_REF: `DoYouLikeFIx/FIXYZ/${workflowPath}@refs/heads/main`,
    VAULT_WORKFLOW_PATH: workflowPath,
    VAULT_PROTECTED_WORKFLOWS_FILE: allowlistFilePath,
  });

  assert.equal(result.status, 16, `expected split-job allowlist failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:ALLOWLIST/);
});

test("protected workflow secret resolver fails when allowlisted workflow only comments id-token permission", () => {
  const stubDir = makeTempDir("vault-gha-allowlist-commented-id-token-");
  const workflowPath = path.join(stubDir, "protected.yml");
  const allowlistFilePath = path.join(stubDir, "vault-protected-workflows.txt");
  fs.writeFileSync(
    workflowPath,
    [
      "name: Broken Protected Workflow",
      "permissions:",
      "  contents: read",
      "  # id-token: write",
      "jobs:",
      "  build:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: ./.github/scripts/vault/resolve-internal-secret.sh",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(allowlistFilePath, `${workflowPath}\n`);

  const { result } = runResolver({}, {
    GITHUB_WORKFLOW_REF: `DoYouLikeFIx/FIXYZ/${workflowPath}@refs/heads/main`,
    VAULT_WORKFLOW_PATH: workflowPath,
    VAULT_PROTECTED_WORKFLOWS_FILE: allowlistFilePath,
  });

  assert.equal(result.status, 16, `expected allowlist id-token failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:ALLOWLIST/);
});

test("protected GitHub Actions run ignores env spoofing for workflow policy inputs", () => {
  const stubDir = makeTempDir("vault-gha-spoofed-policy-env-");
  const staleAllowlistPath = path.join(stubDir, "vault-protected-workflows.txt");
  fs.writeFileSync(staleAllowlistPath, ".github/workflows/does-not-exist.yml\n");

  const { result, githubEnvPath } = runResolver({}, {
    GITHUB_ACTIONS: "true",
    VAULT_PROTECTED_BRANCH_REGEX: "^feature/",
    VAULT_PROTECTED_WORKFLOWS_FILE: staleAllowlistPath,
    VAULT_WORKFLOW_PATH: ".github/workflows/not-allowlisted.yml",
  });

  assert.equal(result.status, 0, `expected spoofed env overrides to be ignored: ${result.stderr}\n${result.stdout}`);
  const githubEnv = parseGitHubEnv(githubEnvPath);
  assert.equal(githubEnv.INTERNAL_SECRET, "resolved-secret");
  assert.equal(githubEnv.VAULT_SECRET_MODE, "vault");
});

test("protected workflow secret resolver fails when current workflow is not allowlisted", () => {
  const { result } = runResolver({}, {
    VAULT_WORKFLOW_PATH: ".github/workflows/not-allowlisted.yml",
  });

  assert.equal(result.status, 16, `expected allowlist failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:ALLOWLIST/);
});

test("protected workflow secret resolver classifies OIDC failures", () => {
  const { result } = runResolver({ curlExit: 1, curlStderr: "oidc token request failed" });

  assert.equal(result.status, 10, `expected OIDC failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:OIDC/);
});

test("protected workflow secret resolver classifies JWT login failures", () => {
  const { result } = runResolver({ loginExit: 1, loginStderr: "permission denied" });

  assert.equal(result.status, 11, `expected JWT login failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:JWT_LOGIN/);
});

test("protected workflow secret resolver classifies hostname SAN failures", () => {
  const { result } = runResolver({
    loginExit: 1,
    loginStderr: "x509: certificate is valid for vault.service, not vault.example.internal",
  });

  assert.equal(result.status, 13, `expected hostname SAN failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:HOSTNAME_SAN/);
});

test("protected workflow secret resolver classifies timeout failures", () => {
  const { result } = runResolver({
    loginExit: 1,
    loginStderr: "context deadline exceeded while connecting to Vault",
  });

  assert.equal(result.status, 14, `expected timeout failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:TIMEOUT_UNREACHABLE/);
});

test("protected workflow secret resolver classifies KV read failures", () => {
  const { result } = runResolver({ kvExit: 2, kvStderr: "permission denied to read secret" });

  assert.equal(result.status, 15, `expected KV read failure, got ${result.status}`);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:KV_READ/);
});

test("protected workflow secret resolver allows degraded mode only for non-protected flow", () => {
  const { result, githubEnvPath } = runResolver({}, {
    GITHUB_REF_NAME: "feature/external-vault",
    VAULT_ADDR: "",
    VAULT_CACERT: "",
  });

  assert.equal(result.status, 0, `expected degraded non-protected path: ${result.stderr}\n${result.stdout}`);
  const githubEnv = parseGitHubEnv(githubEnvPath);
  assert.equal(githubEnv.VAULT_SECRET_MODE, "degraded");
  assert.equal(githubEnv.INTERNAL_SECRET, undefined);
});

test("non-protected workflow ignores stale allowlist failures and still degrades", () => {
  const stubDir = makeTempDir("vault-gha-nonprotected-allowlist-");
  const staleAllowlistPath = path.join(stubDir, "vault-protected-workflows.txt");
  fs.writeFileSync(staleAllowlistPath, ".github/workflows/does-not-exist.yml\n");

  const { result, githubEnvPath } = runResolver({}, {
    GITHUB_REF_NAME: "feature/external-vault",
    VAULT_ADDR: "",
    VAULT_CACERT: "",
    VAULT_PROTECTED_WORKFLOWS_FILE: staleAllowlistPath,
  });

  assert.equal(result.status, 0, `expected degraded non-protected allowlist path: ${result.stderr}\n${result.stdout}`);
  const githubEnv = parseGitHubEnv(githubEnvPath);
  assert.equal(githubEnv.VAULT_SECRET_MODE, "degraded");
});

test("non-protected workflow degrades when CA bundle path is unreadable", () => {
  const { result, githubEnvPath } = runResolver({}, {
    GITHUB_REF_NAME: "feature/external-vault",
    VAULT_CACERT: path.join(repoRoot, "does-not-exist.pem"),
  });

  assert.equal(result.status, 0, `expected degraded unreadable CA path: ${result.stderr}\n${result.stdout}`);
  const githubEnv = parseGitHubEnv(githubEnvPath);
  assert.equal(githubEnv.VAULT_SECRET_MODE, "degraded");
  assert.equal(githubEnv.INTERNAL_SECRET, undefined);
});

test("non-protected workflow degrades after classified Vault login failure", () => {
  const { result, githubEnvPath } = runResolver(
    { loginExit: 1, loginStderr: "permission denied" },
    { GITHUB_REF_NAME: "feature/external-vault" },
  );

  assert.equal(result.status, 0, `expected degraded login failure path: ${result.stderr}\n${result.stdout}`);
  const githubEnv = parseGitHubEnv(githubEnvPath);
  assert.equal(githubEnv.VAULT_SECRET_MODE, "degraded");
  assert.equal(githubEnv.INTERNAL_SECRET, undefined);
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_RESOLUTION_ERROR:JWT_LOGIN/);
});

test("protected workflow secret resolver safely exports multiline secrets", () => {
  const { result, githubEnvPath } = runResolver({ kvStdout: "line-one\nline-two\n" });

  assert.equal(result.status, 0, `expected multiline secret export to succeed: ${result.stderr}\n${result.stdout}`);
  const githubEnv = parseGitHubEnv(githubEnvPath);
  assert.equal(githubEnv.INTERNAL_SECRET, "line-one\nline-two");
  assert.equal(githubEnv.VAULT_SECRET_MODE, "vault");
  assert.match(readText(githubEnvPath), /INTERNAL_SECRET<<EOF_/);
});

test("non-local deploy guard rejects local vault enablement", () => {
  const result = runBashScript(validateNonlocalProfileScriptPath, {
    VALIDATE_NONLOCAL_ENV: "staging",
    VALIDATE_NONLOCAL_ENABLED_PROFILES: "local-vault",
  });

  assert.notEqual(result.status, 0, "guard should fail for local-vault profile in staging");
  assert.match(`${result.stderr}\n${result.stdout}`, /local-vault/);
});

test("non-local deploy guard rejects local vault enablement from CLI profile arguments", () => {
  const result = runBashScript(
    validateNonlocalProfileScriptPath,
    { VALIDATE_NONLOCAL_ENV: "staging" },
    ["--profile", "local-vault", "up"],
  );

  assert.notEqual(result.status, 0, "guard should fail for --profile local-vault in staging");
  assert.match(`${result.stderr}\n${result.stdout}`, /local-vault/);
});

test("non-local deploy guard rejects inline CLI profile syntax", () => {
  const result = runBashScript(
    validateNonlocalProfileScriptPath,
    { VALIDATE_NONLOCAL_ENV: "staging" },
    ["--profile=local-vault", "up"],
  );

  assert.notEqual(result.status, 0, "guard should fail for --profile=local-vault in staging");
  assert.match(`${result.stderr}\n${result.stdout}`, /local-vault/);
});

test("non-local deploy guard rejects local Vault compose overlays", () => {
  const result = runBashScript(
    validateNonlocalProfileScriptPath,
    { VALIDATE_NONLOCAL_ENV: "staging" },
    ["-f", "docker-compose.yml", "-f", "docker-compose.vault.yml", "up"],
  );

  assert.notEqual(result.status, 0, "guard should fail when docker-compose.vault.yml is selected in staging");
  assert.match(`${result.stderr}\n${result.stdout}`, /Compose file must not enable local Vault bootstrap/);
});

test("non-local deploy guard rejects local Vault compose overlays from COMPOSE_FILE env", () => {
  const result = runBashScript(validateNonlocalProfileScriptPath, {
    VALIDATE_NONLOCAL_ENV: "staging",
    COMPOSE_FILE: "docker-compose.yml:docker-compose.vault.yml",
  });

  assert.notEqual(result.status, 0, "guard should fail when COMPOSE_FILE selects docker-compose.vault.yml in staging");
  assert.match(`${result.stderr}\n${result.stdout}`, /Compose file must not enable local Vault bootstrap/);
});

test("non-local deploy guard rejects direct local Vault service targeting", () => {
  const result = runBashScript(
    validateNonlocalProfileScriptPath,
    { VALIDATE_NONLOCAL_ENV: "prod" },
    ["up", "vault-init"],
  );

  assert.notEqual(result.status, 0, "guard should fail when vault-init is targeted in prod");
  assert.match(`${result.stderr}\n${result.stdout}`, /vault-init/);
});

test("non-local deploy guard rejects local Vault addresses", () => {
  const result = runBashScript(validateNonlocalProfileScriptPath, {
    VALIDATE_NONLOCAL_ENV: "staging",
    VAULT_ADDR: "https://vault:8200",
  });

  assert.notEqual(result.status, 0, "guard should fail for local Vault addresses in staging");
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_ADDR/);
});

test("non-local deploy guard rejects portless local Vault aliases", () => {
  const result = runBashScript(validateNonlocalProfileScriptPath, {
    VALIDATE_NONLOCAL_ENV: "staging",
    VAULT_ADDR: "https://vault",
  });

  assert.notEqual(result.status, 0, "guard should fail for portless local Vault aliases in staging");
  assert.match(`${result.stderr}\n${result.stdout}`, /VAULT_ADDR/);
});

test("non-local deploy guard rejects custom compose overlays with unprofiled vault services", () => {
  const tempDir = makeTempDir("vault-compose-overlay-");
  const composeFilePath = path.join(tempDir, "custom-compose.yml");
  fs.writeFileSync(
    composeFilePath,
    [
      "services:",
      "    vault:",
      "      image: hashicorp/vault:1.15",
      "      # local-vault profile intentionally absent",
      "",
    ].join("\n"),
  );

  const result = runBashScript(validateNonlocalProfileScriptPath, {
    VALIDATE_NONLOCAL_ENV: "staging",
    COMPOSE_FILE: composeFilePath,
  });

  assert.notEqual(result.status, 0, "guard should fail for custom overlays that define unprofiled local Vault services");
  assert.match(`${result.stderr}\n${result.stdout}`, /Compose file must not enable local Vault bootstrap/);
});

test("main compose no longer couples app services to vault-init and keeps local Vault opt-in", () => {
  const compose = readText(composePath);
  const corebankBlock = extractServiceBlock(compose, "corebank-service", "fep-gateway");
  const fepGatewayBlock = extractServiceBlock(compose, "fep-gateway", "fep-simulator");
  const fepSimulatorBlock = extractServiceBlock(compose, "fep-simulator", "channel-service");
  const channelBlock = extractServiceBlock(compose, "channel-service", "edge-gateway");

  assert.match(compose, /vault:\n[\s\S]*profiles:\n[\s\S]*- local-vault/);
  assert.match(compose, /vault-init:\n[\s\S]*profiles:\n[\s\S]*- local-vault/);
  assert.doesNotMatch(corebankBlock, /vault-init/);
  assert.doesNotMatch(fepGatewayBlock, /vault-init/);
  assert.doesNotMatch(fepSimulatorBlock, /vault-init/);
  assert.doesNotMatch(channelBlock, /vault-init/);
});

test("staging matrix records external-vault-only bootstrap contract", () => {
  const matrix = readText(componentMatrixPath);
  const stagingSection = matrix.match(/- environment: staging[\s\S]*?dependency_graph:/);

  assert.ok(stagingSection, "staging section missing from component matrix");
  assert.match(stagingSection[0], /component: external-vault-endpoint/);
  assert.doesNotMatch(stagingSection[0], /component: vault-init/);
  assert.doesNotMatch(stagingSection[0], /component: vault\s/);
});

test("prod and staging profiles override local secret fallbacks with explicit non-local values", () => {
  for (const filePath of [
    channelProdPath,
    channelStagingPath,
    corebankProdPath,
    corebankStagingPath,
    fepGatewayProdPath,
    fepGatewayStagingPath,
    fepSimulatorProdPath,
    fepSimulatorStagingPath,
  ]) {
    assert.ok(fs.existsSync(filePath), `missing non-local profile file: ${filePath}`);
  }

  const channelProd = readText(channelProdPath);
  const channelStaging = readText(channelStagingPath);
  const corebankProd = readText(corebankProdPath);
  const corebankStaging = readText(corebankStagingPath);
  const fepGatewayProd = readText(fepGatewayProdPath);
  const fepGatewayStaging = readText(fepGatewayStagingPath);
  const fepSimulatorProd = readText(fepSimulatorProdPath);
  const fepSimulatorStaging = readText(fepSimulatorStagingPath);

  for (const content of [channelProd, channelStaging]) {
    assert.match(content, /secret-store: vault/);
    assert.match(content, /base-url: \$\{AUTH_TOTP_VAULT_BASE_URL\}/);
    assert.match(content, /token: \$\{AUTH_TOTP_VAULT_TOKEN\}/);
    assert.match(content, /corebank:[\s\S]*secret: \$\{COREBANK_INTERNAL_SECRET:\$\{INTERNAL_SECRET\}\}/);
  }

  for (const content of [corebankProd, corebankStaging, fepGatewayProd, fepGatewayStaging, fepSimulatorProd, fepSimulatorStaging]) {
    assert.match(content, /internal:[\s\S]*secret: \$\{INTERNAL_SECRET\}/);
    assert.doesNotMatch(content, /local-internal-secret/);
  }
});
