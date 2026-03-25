"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeMockHelperModule(filePath) {
  fs.writeFileSync(filePath, `let invocation = 0;

function buildCookieJar(sessionValue, xsrfValue) {
  return {
    toPlaywrightCookies() {
      return [
        { name: "SESSION", value: sessionValue },
        { name: "XSRF-TOKEN", value: xsrfValue },
      ];
    },
  };
}

export async function createProvisionedStory115DashboardAccount() {
  invocation += 1;
  const mode = process.env.SESSION_ISOLATION_MOCK_MODE ?? "success";
  const sessionSuffix = mode === "duplicate-session" ? "shared-session" : "session-" + invocation;

  return {
    identity: {
      email: "session-" + invocation + "@example.com",
      name: "Session " + invocation,
    },
    accountId: String(1000 + invocation),
    cookieJar: buildCookieJar(sessionSuffix, "xsrf-" + invocation),
    createdSession: {
      orderSessionId: "order-session-" + invocation,
    },
    executedSession: {
      orderSessionId: "order-session-" + invocation,
      status: "COMPLETED",
    },
    dashboardData: {
      summary: {
        quoteAsOf: "2026-03-25T00:00:00Z",
      },
      positions: [
        {
          marketPrice: 10000,
          quoteAsOf: "2026-03-25T00:00:00Z",
        },
      ],
    },
  };
}
`, "utf8");
}

function runNodeScript(scriptPath, env = {}) {
  return spawnSync("node", [scriptPath], {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
}

test("session isolation script records five isolated authenticated sessions", () => {
  const tempDir = makeTempDir("session-isolation-success-");
  const helperPath = path.join(tempDir, "mock-session-helper.mjs");
  const outputDir = path.join(tempDir, "output");
  writeMockHelperModule(helperPath);

  const result = runNodeScript("scripts/release-readiness/run-five-session-isolation.mjs", {
    SESSION_ISOLATION_HELPER_MODULE: helperPath,
    SESSION_ISOLATION_OUTPUT_DIR: outputDir,
    SESSION_ISOLATION_SESSION_COUNT: "5",
  });

  assert.equal(result.status, 0, `session isolation script failed: ${result.stderr}\n${result.stdout}`);

  const summary = loadJson(path.join(outputDir, "session-isolation-summary.json"));
  assert.equal(summary.storyId, "10.4");
  assert.equal(summary.criterion, "AC6");
  assert.equal(summary.status, "passed");
  assert.equal(summary.checks.expectedSessionCount, 5);
  assert.equal(summary.checks.actualSessionCount, 5);
  assert.equal(summary.checks.uniqueAccounts, true);
  assert.equal(summary.checks.uniqueSessionCookies, true);
  assert.equal(summary.checks.uniqueXsrfTokens, true);
  assert.equal(summary.checks.uniqueOrderSessions, true);
  assert.equal(summary.sessions.length, 5);
  assert.equal(new Set(summary.sessions.map((session) => session.sessionCookieHash)).size, 5);
});

test("session isolation script fails when independent sessions reuse the same session cookie", () => {
  const tempDir = makeTempDir("session-isolation-duplicate-");
  const helperPath = path.join(tempDir, "mock-session-helper.mjs");
  const outputDir = path.join(tempDir, "output");
  writeMockHelperModule(helperPath);

  const result = runNodeScript("scripts/release-readiness/run-five-session-isolation.mjs", {
    SESSION_ISOLATION_HELPER_MODULE: helperPath,
    SESSION_ISOLATION_OUTPUT_DIR: outputDir,
    SESSION_ISOLATION_SESSION_COUNT: "5",
    SESSION_ISOLATION_MOCK_MODE: "duplicate-session",
  });

  assert.notEqual(result.status, 0, "session isolation script should fail for duplicate session cookies");

  const summary = loadJson(path.join(outputDir, "session-isolation-summary.json"));
  assert.equal(summary.status, "failed");
  assert.equal(summary.checks.uniqueAccounts, true);
  assert.equal(summary.checks.uniqueSessionCookies, false);
  assert.equal(summary.sessions.every((session) => session.status === "passed"), true);
});
