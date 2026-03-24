#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const DASHBOARD_UID = process.env.OBSERVABILITY_GRAFANA_DASHBOARD_UID || 'ops-monitoring-overview';
const DASHBOARD_SLUG = process.env.OBSERVABILITY_GRAFANA_DASHBOARD_SLUG || 'fixyz-operations-monitoring';
const GRAFANA_BASE_URL = process.env.OBSERVABILITY_GRAFANA_BASE_URL || 'http://127.0.0.1:3000';
const GRAFANA_MODE = process.env.OBSERVABILITY_GRAFANA_MODE === 'embed' ? 'embed' : 'link';
const PROMETHEUS_BASE_URL = process.env.OBSERVABILITY_PROMETHEUS_BASE_URL || 'http://127.0.0.1:9090';
const PROMETHEUS_TIMEOUT_MS = parsePositiveInteger(process.env.OBSERVABILITY_PROMETHEUS_TIMEOUT_MS, 1500);
const LIVE_AGE_SECONDS = parsePositiveInteger(process.env.OBSERVABILITY_FRESHNESS_LIVE_MAX_AGE_SECONDS, 60);
const UNAVAILABLE_AGE_SECONDS = parsePositiveInteger(
  process.env.OBSERVABILITY_FRESHNESS_UNAVAILABLE_MAX_AGE_SECONDS,
  300,
);
const CHECKED_AT = parseCheckedAt(process.env.OBSERVABILITY_LAST_UPDATED_AT);
const CHECKED_AT_EPOCH_SECONDS = Math.floor(CHECKED_AT.getTime() / 1000);
const CHECKED_AT_ISO = CHECKED_AT.toISOString();

const PANEL_DEFINITIONS = [
  {
    key: 'executionVolume',
    title: 'Execution volume',
    description: '최근 15분 주문 실행 추이를 Grafana 대시보드에서 확인합니다.',
    panelId: 101,
    freshnessPanelId: 201,
    sourceMetricHint: 'PromQL: sum(increase(channel_order_execution_completed_total[15m]))',
    adminAuditUrl: '/admin?auditEventType=ORDER_EXECUTE',
    targetJob: 'channel-service',
    freshnessMetric: 'channel_order_execution_last_completed_epoch_seconds',
  },
  {
    key: 'pendingSessions',
    title: 'Pending sessions',
    description: '재조회 또는 수동 개입이 필요한 recovery backlog 추이를 Grafana 대시보드에서 확인합니다.',
    panelId: 102,
    freshnessPanelId: 202,
    sourceMetricHint: 'PromQL: sum(channel_order_sessions_recovery_backlog)',
    adminAuditUrl: '/admin?auditEventType=ORDER_RECOVERY',
    targetJob: 'channel-service',
    freshnessMetric: 'channel_order_sessions_recovery_backlog_last_updated_epoch_seconds',
  },
  {
    key: 'marketDataIngest',
    title: 'Market data ingest',
    description: '최근 15분 시세 snapshot 적재 추이를 Grafana 대시보드에서 확인합니다.',
    panelId: 103,
    freshnessPanelId: 203,
    sourceMetricHint: 'PromQL: sum(increase(fep_marketdata_snapshots_persisted_total[15m]))',
    targetJob: 'fep-gateway',
    freshnessMetric: 'fep_marketdata_snapshots_last_persisted_epoch_seconds',
  },
];

function parsePositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCheckedAt(rawValue) {
  if (!rawValue) {
    return new Date();
  }
  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function buildDashboardUrl(panelId) {
  const url = new URL(`/d/${DASHBOARD_UID}/${DASHBOARD_SLUG}`, GRAFANA_BASE_URL);
  url.searchParams.set('from', 'now-6h');
  url.searchParams.set('to', 'now');
  if (panelId !== undefined) {
    url.searchParams.set('viewPanel', String(panelId));
  }
  return url.toString();
}

function buildSoloUrl(panelId) {
  const url = new URL(`/d-solo/${DASHBOARD_UID}/${DASHBOARD_SLUG}`, GRAFANA_BASE_URL);
  url.searchParams.set('from', 'now-6h');
  url.searchParams.set('to', 'now');
  url.searchParams.set('panelId', String(panelId));
  url.searchParams.set('theme', 'light');
  return url.toString();
}

async function fetchPrometheusInstantValue(expression) {
  const url = new URL('/api/v1/query', PROMETHEUS_BASE_URL);
  url.searchParams.set('query', expression);
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), PROMETHEUS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: abortController.signal,
      headers: {
        accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Prometheus query failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (payload.status !== 'success') {
      throw new Error(`Prometheus query returned ${payload.status}`);
    }

    const rows = Array.isArray(payload.data?.result) ? payload.data.result : [];
    const values = rows
      .map((row) => Number.parseFloat(row?.value?.[1] ?? 'NaN'))
      .filter(Number.isFinite);

    return values.length > 0 ? Math.max(...values) : null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildUnavailableFreshness(statusMessage) {
  return {
    source: 'grafana-companion-panel',
    indicatorLabel: 'Prometheus freshness',
    lastUpdatedLabel: 'Freshness checked at',
    status: 'unavailable',
    statusMessage,
    lastUpdatedAt: CHECKED_AT_ISO,
  };
}

function formatAge(ageSeconds) {
  if (ageSeconds < 60) {
    return `${ageSeconds}s`;
  }

  if (ageSeconds < 3600) {
    const minutes = Math.floor(ageSeconds / 60);
    const seconds = ageSeconds % 60;
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(ageSeconds / 3600);
  const minutes = Math.floor((ageSeconds % 3600) / 60);
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function resolveFreshnessStatus(ageSeconds) {
  if (ageSeconds <= LIVE_AGE_SECONDS) {
    return 'live';
  }

  if (ageSeconds <= UNAVAILABLE_AGE_SECONDS) {
    return 'stale';
  }

  return 'unavailable';
}

function buildStatusMessage(status, ageSeconds) {
  const ageLabel = formatAge(ageSeconds);

  if (status === 'live') {
    return `Prometheus freshness healthy (${ageLabel} old)`;
  }

  if (status === 'stale') {
    return `Prometheus freshness stale (${ageLabel} old)`;
  }

  return `Prometheus freshness unavailable (${ageLabel} old)`;
}

async function resolveFreshness(definition) {
  const companionPanelUrl = buildDashboardUrl(definition.freshnessPanelId);

  try {
    const [targetUp, freshnessEpochSeconds] = await Promise.all([
      fetchPrometheusInstantValue(`max(up{job="${definition.targetJob}"})`),
      fetchPrometheusInstantValue(`max(${definition.freshnessMetric})`),
    ]);

    if (targetUp === null || targetUp < 1) {
      return {
        ...buildUnavailableFreshness(`Prometheus target unavailable (${definition.targetJob})`),
        companionPanelUrl,
      };
    }

    if (freshnessEpochSeconds === null || freshnessEpochSeconds <= 0) {
      return {
        ...buildUnavailableFreshness(`Freshness metric unavailable (${definition.freshnessMetric})`),
        companionPanelUrl,
      };
    }

    const lastUpdatedAt = new Date(freshnessEpochSeconds * 1000);
    if (Number.isNaN(lastUpdatedAt.getTime())) {
      return {
        ...buildUnavailableFreshness(`Freshness metric unreadable (${definition.freshnessMetric})`),
        companionPanelUrl,
      };
    }

    const ageSeconds = Math.max(0, CHECKED_AT_EPOCH_SECONDS - Math.floor(freshnessEpochSeconds));
    const status = resolveFreshnessStatus(ageSeconds);

    return {
      source: 'grafana-companion-panel',
      indicatorLabel: 'Prometheus freshness',
      lastUpdatedLabel: 'Last event at',
      companionPanelUrl,
      status,
      statusMessage: buildStatusMessage(status, ageSeconds),
      lastUpdatedAt: lastUpdatedAt.toISOString(),
    };
  } catch {
    return {
      ...buildUnavailableFreshness('Prometheus freshness lookup failed'),
      companionPanelUrl,
    };
  }
}

async function buildDescriptors() {
  const freshnessEntries = await Promise.all(PANEL_DEFINITIONS.map((definition) => resolveFreshness(definition)));

  return PANEL_DEFINITIONS.map((definition, index) => {
    const descriptor = {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      mode: GRAFANA_MODE,
      linkUrl: buildDashboardUrl(),
      dashboardUid: DASHBOARD_UID,
      panelId: definition.panelId,
      sourceMetricHint: definition.sourceMetricHint,
      freshness: freshnessEntries[index],
      drillDown: {
        grafanaUrl: buildDashboardUrl(definition.panelId),
      },
    };

    if (GRAFANA_MODE === 'embed') {
      descriptor.embedUrl = buildSoloUrl(definition.panelId);
    }

    if (definition.adminAuditUrl) {
      descriptor.drillDown.adminAuditUrl = definition.adminAuditUrl;
    }

    return descriptor;
  });
}

function upsertEnvFile(filePath, envLine) {
  const resolvedPath = path.resolve(process.cwd(), filePath);
  const existing = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, 'utf8') : '';
  const lines = existing === '' ? [] : existing.split(/\r?\n/);
  const nextLines = [];
  let replaced = false;

  for (const line of lines) {
    if (line.startsWith('VITE_ADMIN_MONITORING_PANELS_JSON=')) {
      nextLines.push(envLine);
      replaced = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== '') {
      nextLines.push('');
    }
    nextLines.push(envLine);
  }

  fs.writeFileSync(resolvedPath, `${nextLines.join('\n')}\n`, 'utf8');
  return resolvedPath;
}

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes('--json') || !args.includes('--dotenv');
  const outputDotenv = args.includes('--dotenv');
  const envFileFlagIndex = args.indexOf('--write-env-file');
  const envFile = envFileFlagIndex >= 0 ? args[envFileFlagIndex + 1] : undefined;

  if (envFileFlagIndex >= 0 && !envFile) {
    console.error('Missing path after --write-env-file');
    process.exit(1);
  }

  const descriptors = await buildDescriptors();
  const serialized = JSON.stringify(descriptors);
  const envLine = `VITE_ADMIN_MONITORING_PANELS_JSON=${serialized}`;

  if (envFile) {
    const updatedPath = upsertEnvFile(envFile, envLine);
    console.log(`Updated ${updatedPath}`);
    return;
  }

  if (outputDotenv) {
    console.log(envLine);
    return;
  }

  if (outputJson) {
    console.log(serialized);
  }
}

await main();
