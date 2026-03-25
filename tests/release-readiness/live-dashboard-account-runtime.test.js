"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const repoRoot = path.resolve(__dirname, "..", "..");

test("live dashboard helper step-up verifies pending order sessions with a fresh OTP", async () => {
  const moduleUrl = pathToFileURL(path.join(repoRoot, "scripts", "story-11-5-live-dashboard-account.mjs")).href;
  const helperModule = await import(moduleUrl);
  const { createProvisionedStory115DashboardAccount } = helperModule;

  const originalFetch = global.fetch;
  const originalDateNow = Date.now;
  let fakeNow = 1_710_000_000_000;
  let csrfCounter = 0;
  let confirmOtpCode = null;
  let verifyOtpCode = null;
  let executeCalls = 0;

  Date.now = () => fakeNow;
  global.fetch = async (url, init = {}) => {
    const requestUrl = new URL(url);
    const { pathname } = requestUrl;
    const method = init.method ?? "GET";
    const response = (status, body) => new Response(JSON.stringify({
      success: true,
      data: body,
    }), {
      status,
      headers: {
        "content-type": "application/json",
      },
    });

    if (pathname === "/api/v1/auth/csrf" && method === "GET") {
      csrfCounter += 1;
      return response(200, {
        csrfToken: `csrf-${csrfCounter}`,
        headerName: "X-CSRF-TOKEN",
      });
    }

    if (pathname === "/api/v1/auth/register" && method === "POST") {
      return response(200, {});
    }

    if (pathname === "/api/v1/auth/login" && method === "POST") {
      return response(200, {
        loginToken: "login-token",
      });
    }

    if (pathname === "/api/v1/members/me/totp/enroll" && method === "POST") {
      return response(200, {
        manualEntryKey: "JBSWY3DPEHPK3PXP",
        enrollmentToken: "enrollment-token",
      });
    }

    if (pathname === "/api/v1/members/me/totp/confirm" && method === "POST") {
      confirmOtpCode = JSON.parse(init.body).otpCode;
      return response(200, {
        verified: true,
      });
    }

    if (pathname === "/api/v1/auth/session" && method === "GET") {
      return response(200, {
        accountId: 101,
      });
    }

    if (pathname === "/api/v1/orders/sessions" && method === "POST") {
      fakeNow += 30_000;
      return response(201, {
        orderSessionId: "9849b374-bb4a-4684-94f3-4f238d8a19b2",
        status: "PENDING_NEW",
        challengeRequired: true,
        authorizationReason: "ELEVATED_ORDER_RISK",
      });
    }

    if (pathname === "/api/v1/orders/sessions/9849b374-bb4a-4684-94f3-4f238d8a19b2/otp/verify" && method === "POST") {
      verifyOtpCode = JSON.parse(init.body).otpCode;
      return response(200, {
        orderSessionId: "9849b374-bb4a-4684-94f3-4f238d8a19b2",
        status: "AUTHED",
        challengeRequired: true,
        authorizationReason: "ELEVATED_ORDER_RISK",
      });
    }

    if (pathname === "/api/v1/orders/sessions/9849b374-bb4a-4684-94f3-4f238d8a19b2/execute" && method === "POST") {
      executeCalls += 1;
      return response(200, {
        orderSessionId: "9849b374-bb4a-4684-94f3-4f238d8a19b2",
        status: "COMPLETED",
        executionResult: "FILLED",
      });
    }

    throw new Error(`Unexpected ${method} ${pathname}`);
  };

  try {
    const provisioned = await createProvisionedStory115DashboardAccount({
      baseUrl: "http://127.0.0.1:8080",
      password: "LiveVideo115!",
      skipDashboardQuoteWait: true,
      requestTimeoutMs: 1000,
      pollTimeoutMs: 1000,
      orderExecuteRetryCount: 1,
    });

    assert.equal(provisioned.createdSession.status, "PENDING_NEW");
    assert.equal(provisioned.authorizedSession.status, "AUTHED");
    assert.equal(provisioned.executedSession.status, "COMPLETED");
    assert.equal(executeCalls, 1);
    assert.ok(confirmOtpCode);
    assert.ok(verifyOtpCode);
    assert.notEqual(verifyOtpCode, confirmOtpCode);
  } finally {
    global.fetch = originalFetch;
    Date.now = originalDateNow;
  }
});
