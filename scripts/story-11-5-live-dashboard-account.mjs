#!/usr/bin/env node

import { createHmac, randomUUID } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_TIMEOUT_MS = 30_000;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const wait = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isRetryableOrderExecutionError = (error) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('/execute returned 500')
    && (
      message.includes('Deadlock found when trying to get lock')
      || message.includes('Lock wait timeout exceeded')
    );
};

const shellQuote = (value) => `'${String(value).replace(/'/g, `'\"'\"'`)}'`;

const unwrapEnvelope = (payload) => (
  typeof payload === 'object'
  && payload !== null
  && 'data' in payload
  && typeof payload.data === 'object'
  && payload.data !== null
)
  ? payload.data
  : payload;

export class LiveCookieJar {
  constructor() {
    this.cookies = new Map();
  }

  rememberFromHeaders(headers) {
    const candidate = headers;
    const setCookieHeaders = typeof candidate.getSetCookie === 'function'
      ? candidate.getSetCookie()
      : headers.get('set-cookie')
        ? [headers.get('set-cookie')]
        : [];

    for (const header of setCookieHeaders) {
      const [pair, ...attributes] = header.split(';').map((value) => value.trim());
      const separatorIndex = pair.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = pair.slice(0, separatorIndex);
      const value = pair.slice(separatorIndex + 1);
      const metadata = {
        value,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      };

      for (const attribute of attributes) {
        const [attributeName, attributeValue] = attribute.split('=');
        const normalizedName = attributeName.toLowerCase();

        if (normalizedName === 'path' && attributeValue) {
          metadata.path = attributeValue;
        }
        if (normalizedName === 'httponly') {
          metadata.httpOnly = true;
        }
        if (normalizedName === 'secure') {
          metadata.secure = true;
        }
        if (normalizedName === 'samesite' && attributeValue) {
          metadata.sameSite = this.normalizeSameSite(attributeValue);
        }
      }

      this.cookies.set(name, metadata);
    }
  }

  setCookie(name, value, overrides = {}) {
    this.cookies.set(name, {
      value,
      path: overrides.path ?? '/',
      httpOnly: overrides.httpOnly ?? false,
      secure: overrides.secure ?? false,
      sameSite: this.normalizeSameSite(overrides.sameSite ?? 'Lax'),
    });
  }

  normalizeSameSite(value) {
    const normalized = String(value).toLowerCase();

    if (normalized === 'strict') {
      return 'Strict';
    }
    if (normalized === 'none') {
      return 'None';
    }
    return 'Lax';
  }

  toCookieHeader() {
    return [...this.cookies.entries()]
      .map(([name, metadata]) => `${name}=${metadata.value}`)
      .join('; ');
  }

  toPlaywrightCookies(baseUrl) {
    const hostname = new URL(baseUrl).hostname;

    return [...this.cookies.entries()].map(([name, metadata]) => ({
      name,
      value: metadata.value,
      domain: hostname,
      path: metadata.path,
      httpOnly: metadata.httpOnly,
      secure: metadata.secure,
      sameSite: metadata.sameSite,
      expires: -1,
    }));
  }
}

export const fetchLiveJson = async (
  cookieJar,
  baseUrl,
  requestPath,
  init,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init.headers);
  const cookieHeader = cookieJar.toCookieHeader();

  if (cookieHeader) {
    headers.set('Cookie', cookieHeader);
  }

  try {
    const response = await fetch(`${baseUrl}${requestPath}`, {
      ...init,
      headers,
      signal: controller.signal,
    });

    cookieJar.rememberFromHeaders(response.headers);

    const rawBody = await response.text();
    const jsonBody = rawBody ? JSON.parse(rawBody) : {};

    if (!response.ok) {
      throw new Error(`${requestPath} returned ${response.status}: ${rawBody}`);
    }

    return jsonBody;
  } finally {
    clearTimeout(timer);
  }
};

export const fetchLiveCsrf = async (
  cookieJar,
  baseUrl,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) => {
  const payload = unwrapEnvelope(await fetchLiveJson(
    cookieJar,
    baseUrl,
    '/api/v1/auth/csrf',
    { method: 'GET' },
    timeoutMs,
  ));
  const csrfToken = payload.csrfToken ?? payload.token;

  if (!csrfToken) {
    throw new Error('Live csrf bootstrap did not return a token.');
  }

  cookieJar.setCookie('XSRF-TOKEN', csrfToken, { sameSite: 'Strict' });

  return {
    csrfToken,
    headerName: payload.headerName ?? 'X-CSRF-TOKEN',
  };
};

const decodeBase32 = (value) => {
  const normalized = value.trim().replace(/[\s=-]/g, '').toUpperCase();
  let buffer = 0;
  let bitsLeft = 0;
  const output = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index < 0) {
      throw new Error(`Unsupported base32 character: ${character}`);
    }

    buffer = (buffer << 5) | index;
    bitsLeft += 5;

    if (bitsLeft >= 8) {
      output.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }

  return Buffer.from(output);
};

export const generateTotp = (manualEntryKey, now = Date.now()) => {
  const counter = Math.floor(now / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', decodeBase32(manualEntryKey))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
};

export const millisUntilNextTotpWindow = (now = Date.now()) => 30_000 - (now % 30_000);

export const generateStableTotp = async (
  manualEntryKey,
  minRemainingMs = 8_000,
) => {
  if (millisUntilNextTotpWindow() < minRemainingMs) {
    await wait(millisUntilNextTotpWindow() + 1_500);
  }

  return generateTotp(manualEntryKey);
};

const isChartReadyPosition = (position) =>
  typeof position === 'object'
  && position !== null
  && position.marketPrice !== null
  && position.marketPrice !== undefined
  && Boolean(position.quoteAsOf)
  && ['LIVE', 'DELAYED', 'REPLAY'].includes(position.quoteSourceMode ?? '');

const createLiveIdentity = ({
  prefix,
  password,
  namePrefix,
}) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

  return {
    email: `${prefix}_${suffix}@example.com`,
    name: `${namePrefix} ${suffix}`,
    password,
  };
};

const waitForDashboardQuoteData = async (
  cookieJar,
  baseUrl,
  accountId,
  timeoutMs,
) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const summary = unwrapEnvelope(await fetchLiveJson(
      cookieJar,
      baseUrl,
      `/api/v1/accounts/${accountId}/summary`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
    ));
    const positions = unwrapEnvelope(await fetchLiveJson(
      cookieJar,
      baseUrl,
      `/api/v1/accounts/${accountId}/positions/list`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      },
    ));

    if (
      Array.isArray(positions)
      && positions.length > 0
      && (isChartReadyPosition(summary) || positions.some((position) => isChartReadyPosition(position)))
    ) {
      return {
        summary,
        positions,
      };
    }

    await wait(1_000);
  }

  throw new Error(`Timed out waiting for dashboard quote metadata for account ${accountId}.`);
};

export const createProvisionedStory115DashboardAccount = async ({
  baseUrl = process.env.LIVE_API_BASE_URL?.trim() || DEFAULT_BASE_URL,
  password = process.env.LIVE_REGISTER_PASSWORD ?? 'LiveVideo115!',
  emailPrefix = 'story11_5_video',
  namePrefix = 'Story 11.5 Live',
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  pollTimeoutMs = DEFAULT_POLL_TIMEOUT_MS,
  skipDashboardQuoteWait = false,
  orderExecuteRetryCount = Number.parseInt(process.env.LIVE_ORDER_EXECUTE_RETRY_COUNT ?? '3', 10),
  orderExecuteRetryDelayMs = Number.parseInt(process.env.LIVE_ORDER_EXECUTE_RETRY_DELAY_MS ?? '400', 10),
} = {}) => {
  const identity = createLiveIdentity({
    prefix: emailPrefix,
    password,
    namePrefix,
  });
  const cookieJar = new LiveCookieJar();
  let csrf = await fetchLiveCsrf(cookieJar, baseUrl, requestTimeoutMs);

  await fetchLiveJson(
    cookieJar,
    baseUrl,
    '/api/v1/auth/register',
    {
      method: 'POST',
      headers: {
        [csrf.headerName]: csrf.csrfToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: identity.email,
        password: identity.password,
        name: identity.name,
      }).toString(),
    },
    requestTimeoutMs,
  );

  csrf = await fetchLiveCsrf(cookieJar, baseUrl, requestTimeoutMs);
  const loginPayload = unwrapEnvelope(await fetchLiveJson(
    cookieJar,
    baseUrl,
    '/api/v1/auth/login',
    {
      method: 'POST',
      headers: {
        [csrf.headerName]: csrf.csrfToken,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: identity.email,
        password: identity.password,
      }).toString(),
    },
    requestTimeoutMs,
  ));
  const loginToken = loginPayload.loginToken ?? '';

  if (!loginToken) {
    throw new Error('Live login bootstrap did not return a loginToken.');
  }

  const enrollPayload = unwrapEnvelope(await fetchLiveJson(
    cookieJar,
    baseUrl,
    '/api/v1/members/me/totp/enroll',
    {
      method: 'POST',
      headers: {
        [csrf.headerName]: csrf.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ loginToken }),
    },
    requestTimeoutMs,
  ));
  const manualEntryKey = enrollPayload.manualEntryKey ?? '';
  const enrollmentToken = enrollPayload.enrollmentToken ?? '';

  if (!manualEntryKey || !enrollmentToken) {
    throw new Error('Live TOTP enrollment did not return manualEntryKey/enrollmentToken.');
  }

  const enrollmentCode = await generateStableTotp(manualEntryKey);
  csrf = await fetchLiveCsrf(cookieJar, baseUrl, requestTimeoutMs);
  await fetchLiveJson(
    cookieJar,
    baseUrl,
    '/api/v1/members/me/totp/confirm',
    {
      method: 'POST',
      headers: {
        [csrf.headerName]: csrf.csrfToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        loginToken,
        enrollmentToken,
        otpCode: enrollmentCode,
      }),
    },
    requestTimeoutMs,
  );

  const member = unwrapEnvelope(await fetchLiveJson(
    cookieJar,
    baseUrl,
    '/api/v1/auth/session',
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
    requestTimeoutMs,
  ));
  const accountId = String(member.accountId ?? '');

  if (!accountId) {
    throw new Error('Registered live account did not expose accountId via /api/v1/auth/session.');
  }

  csrf = await fetchLiveCsrf(cookieJar, baseUrl, requestTimeoutMs);
  const createdSession = unwrapEnvelope(await fetchLiveJson(
    cookieJar,
    baseUrl,
    '/api/v1/orders/sessions',
    {
      method: 'POST',
      headers: {
        [csrf.headerName]: csrf.csrfToken,
        'Content-Type': 'application/json',
        'X-ClOrdID': randomUUID(),
      },
      body: JSON.stringify({
        accountId: Number(accountId),
        symbol: '005930',
        side: 'BUY',
        orderType: 'LIMIT',
        qty: 1,
        price: 10_000,
      }),
    },
    requestTimeoutMs,
  ));

  if (!createdSession.orderSessionId) {
    throw new Error('Low-risk live order session bootstrap did not return orderSessionId.');
  }

  let executedSession;
  for (let attempt = 1; attempt <= orderExecuteRetryCount; attempt += 1) {
    try {
      csrf = await fetchLiveCsrf(cookieJar, baseUrl, requestTimeoutMs);
      executedSession = unwrapEnvelope(await fetchLiveJson(
        cookieJar,
        baseUrl,
        `/api/v1/orders/sessions/${createdSession.orderSessionId}/execute`,
        {
          method: 'POST',
          headers: {
            [csrf.headerName]: csrf.csrfToken,
            'Content-Type': 'application/json',
          },
          body: '{}',
        },
        requestTimeoutMs,
      ));
      break;
    } catch (error) {
      if (attempt >= orderExecuteRetryCount || !isRetryableOrderExecutionError(error)) {
        throw error;
      }
      await wait(orderExecuteRetryDelayMs * attempt);
    }
  }

  const dashboardData = skipDashboardQuoteWait
    ? null
    : await waitForDashboardQuoteData(
      cookieJar,
      baseUrl,
      accountId,
      pollTimeoutMs,
    );

  return {
    identity,
    accountId,
    manualEntryKey,
    enrollmentCode,
    cookieJar,
    member,
    createdSession,
    executedSession,
    dashboardData,
  };
};

const runCli = async () => {
  const args = process.argv.slice(2);
  const formatFlag = args.find((argument) => argument.startsWith('--format='));
  const baseUrlFlag = args.find((argument) => argument.startsWith('--base-url='));
  const passwordFlag = args.find((argument) => argument.startsWith('--password='));
  const emailPrefixFlag = args.find((argument) => argument.startsWith('--email-prefix='));
  const namePrefixFlag = args.find((argument) => argument.startsWith('--name-prefix='));

  const provisioned = await createProvisionedStory115DashboardAccount({
    baseUrl: baseUrlFlag?.slice('--base-url='.length),
    password: passwordFlag?.slice('--password='.length),
    emailPrefix: emailPrefixFlag?.slice('--email-prefix='.length),
    namePrefix: namePrefixFlag?.slice('--name-prefix='.length),
  });

  if (formatFlag?.slice('--format='.length) === 'env') {
    process.stdout.write([
      `LIVE_EMAIL=${shellQuote(provisioned.identity.email)}`,
      `LIVE_NAME=${shellQuote(provisioned.identity.name)}`,
      `LIVE_PASSWORD=${shellQuote(provisioned.identity.password)}`,
      `LIVE_ACCOUNT_ID=${shellQuote(provisioned.accountId)}`,
      `LIVE_TOTP_KEY=${shellQuote(provisioned.manualEntryKey)}`,
    ].join('\n'));
    process.stdout.write('\n');
    return;
  }

  process.stdout.write(JSON.stringify({
    email: provisioned.identity.email,
    name: provisioned.identity.name,
    password: provisioned.identity.password,
    accountId: provisioned.accountId,
    manualEntryKey: provisioned.manualEntryKey,
  }));
  process.stdout.write('\n');
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const currentPath = fileURLToPath(import.meta.url);

if (invokedPath === currentPath) {
  await runCli();
}
