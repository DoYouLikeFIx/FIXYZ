#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_SESSION_COUNT = 5;
const DEFAULT_SESSION_TIMEOUT_MS = 60_000;
const DEFAULT_BUILD_ID = process.env.SESSION_ISOLATION_BUILD_ID?.trim() || "local";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_OUTPUT_DIR = path.join(
  ROOT_DIR,
  "_bmad-output",
  "test-artifacts",
  "epic-10",
  DEFAULT_BUILD_ID,
  "story-10-4",
);
const DEFAULT_HELPER_MODULE_URL = new URL("../story-11-5-live-dashboard-account.mjs", import.meta.url);

const startedAt = new Date().toISOString();
const outputDir = process.env.SESSION_ISOLATION_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
const summaryPath = path.join(outputDir, "session-isolation-summary.json");

function shortHash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function resolveHelperModuleUrl() {
  const override = process.env.SESSION_ISOLATION_HELPER_MODULE?.trim();
  if (!override) {
    return DEFAULT_HELPER_MODULE_URL;
  }
  if (/^file:/i.test(override)) {
    return new URL(override);
  }
  return pathToFileURL(path.resolve(override));
}

function extractCookieValue(cookieJar, name) {
  if (!cookieJar) {
    return "";
  }

  if (cookieJar.cookies instanceof Map) {
    const cookie = cookieJar.cookies.get(name);
    if (cookie?.value) {
      return cookie.value;
    }
  }

  if (typeof cookieJar.toPlaywrightCookies === "function") {
    const cookie = cookieJar.toPlaywrightCookies("http://127.0.0.1").find((candidate) => candidate.name === name);
    if (cookie?.value) {
      return cookie.value;
    }
  }

  if (typeof cookieJar.toCookieHeader === "function") {
    const cookieHeader = cookieJar.toCookieHeader();
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (match?.[1]) {
      return match[1];
    }
  }

  return "";
}

function isDashboardReady(dashboardData) {
  return Boolean(
    dashboardData
    && typeof dashboardData === "object"
    && dashboardData.summary
    && Array.isArray(dashboardData.positions)
    && dashboardData.positions.length > 0,
  );
}

function finalizeSessionResult(index, durationMs, payload, error) {
  if (error) {
    return {
      index,
      status: "failed",
      durationMs,
      error: error instanceof Error ? error.message : String(error),
      dashboardReady: false,
      identity: null,
      accountId: null,
      sessionCookieHash: null,
      xsrfTokenHash: null,
      orderSessionId: null,
    };
  }

  const accountId = String(payload.accountId ?? payload.member?.accountId ?? "");
  const createdOrderSessionId = String(payload.createdSession?.orderSessionId ?? "");
  const executedOrderSessionId = String(payload.executedSession?.orderSessionId ?? createdOrderSessionId);
  const sessionCookie = extractCookieValue(payload.cookieJar, "SESSION");
  const xsrfToken = extractCookieValue(payload.cookieJar, "XSRF-TOKEN");

  return {
    index,
    status: "passed",
    durationMs,
    error: null,
    dashboardReady: isDashboardReady(payload.dashboardData),
    identity: {
      email: payload.identity?.email ?? null,
      name: payload.identity?.name ?? null,
    },
    accountId: accountId || null,
    sessionCookieHash: sessionCookie ? shortHash(sessionCookie) : null,
    xsrfTokenHash: xsrfToken ? shortHash(xsrfToken) : null,
    orderSessionId: createdOrderSessionId || executedOrderSessionId || null,
  };
}

function hasDistinctValues(results, fieldName, expectedCount) {
  const values = results.map((result) => result[fieldName]).filter(Boolean);
  return values.length === expectedCount && new Set(values).size === expectedCount;
}

function buildChecks(results, expectedCount) {
  const allSessionsSucceeded = results.length === expectedCount && results.every((result) => result.status === "passed");
  const dashboardReady = results.every((result) => result.dashboardReady);
  const uniqueAccounts = hasDistinctValues(results, "accountId", expectedCount);
  const uniqueSessionCookies = hasDistinctValues(results, "sessionCookieHash", expectedCount);
  const uniqueXsrfTokens = hasDistinctValues(results, "xsrfTokenHash", expectedCount);
  const uniqueOrderSessions = hasDistinctValues(results, "orderSessionId", expectedCount);

  return {
    expectedSessionCount: expectedCount,
    actualSessionCount: results.length,
    allSessionsSucceeded,
    dashboardReady,
    uniqueAccounts,
    uniqueSessionCookies,
    uniqueXsrfTokens,
    uniqueOrderSessions,
  };
}

function overallStatus(checks) {
  return Object.entries(checks)
    .filter(([name]) => name !== "expectedSessionCount" && name !== "actualSessionCount")
    .every(([, passed]) => Boolean(passed))
    ? "passed"
    : "failed";
}

async function main() {
  const helperModuleUrl = resolveHelperModuleUrl();
  const helperModule = await import(helperModuleUrl.href);
  const createProvisionedStory115DashboardAccount = helperModule.createProvisionedStory115DashboardAccount;

  if (typeof createProvisionedStory115DashboardAccount !== "function") {
    throw new Error(`Helper module ${helperModuleUrl.href} does not export createProvisionedStory115DashboardAccount().`);
  }

  const sessionCount = Number.parseInt(process.env.SESSION_ISOLATION_SESSION_COUNT ?? String(DEFAULT_SESSION_COUNT), 10);
  const sessionTimeoutMs = Number.parseInt(process.env.SESSION_ISOLATION_SESSION_TIMEOUT_MS ?? String(DEFAULT_SESSION_TIMEOUT_MS), 10);
  const baseUrl = process.env.SESSION_ISOLATION_BASE_URL?.trim();
  const password = process.env.SESSION_ISOLATION_PASSWORD?.trim();
  const requestTimeoutMs = Number.parseInt(process.env.SESSION_ISOLATION_REQUEST_TIMEOUT_MS ?? String(DEFAULT_SESSION_TIMEOUT_MS), 10);
  const pollTimeoutMs = Number.parseInt(process.env.SESSION_ISOLATION_POLL_TIMEOUT_MS ?? String(DEFAULT_SESSION_TIMEOUT_MS), 10);

  if (!Number.isInteger(sessionCount) || sessionCount <= 0) {
    throw new Error(`Invalid SESSION_ISOLATION_SESSION_COUNT: ${process.env.SESSION_ISOLATION_SESSION_COUNT ?? ""}`);
  }

  const sessionTasks = Array.from({ length: sessionCount }, (_, zeroBasedIndex) => {
    const index = zeroBasedIndex + 1;
    const started = Date.now();

    return (async () => {
      try {
        const payload = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Session ${index} exceeded ${sessionTimeoutMs}ms timeout.`));
          }, sessionTimeoutMs);

          createProvisionedStory115DashboardAccount({
            ...(baseUrl ? { baseUrl } : {}),
            ...(password ? { password } : {}),
            requestTimeoutMs,
            pollTimeoutMs,
            emailPrefix: `story10_4_session_${index}`,
            namePrefix: `Story 10.4 Session ${index}`,
          })
            .then((value) => {
              clearTimeout(timer);
              resolve(value);
            })
            .catch((error) => {
              clearTimeout(timer);
              reject(error);
            });
        });
        return finalizeSessionResult(index, Date.now() - started, payload, null);
      } catch (error) {
        return finalizeSessionResult(index, Date.now() - started, null, error);
      }
    })();
  });

  const sessionResults = await Promise.all(sessionTasks);
  const checks = buildChecks(sessionResults, sessionCount);
  const status = overallStatus(checks);
  const completedAt = new Date().toISOString();

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify({
    storyId: "10.4",
    criterion: "AC6",
    startedAt,
    completedAt,
    status,
    message: status === "passed"
      ? "Five authenticated sessions remained isolated with no blocking degradation."
      : "Session isolation rehearsal found one or more isolation or readiness failures.",
    checks,
    sessions: sessionResults,
  }, null, 2));

  if (status !== "passed") {
    process.exitCode = 1;
  }
}

await main();
