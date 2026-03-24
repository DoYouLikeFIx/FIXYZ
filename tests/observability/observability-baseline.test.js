"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const composePath = path.join(repoRoot, "docker-compose.yml");
const prometheusConfigPath = path.join(repoRoot, "docker", "observability", "prometheus", "prometheus.yml");
const dashboardPath = path.join(
  repoRoot,
  "docker",
  "observability",
  "grafana",
  "dashboards",
  "ops-monitoring-overview.json",
);
const generatorPath = path.join(repoRoot, "scripts", "observability", "generate-monitoring-panels.mjs");
const validatorPath = path.join(repoRoot, "scripts", "observability", "validate-observability-stack.sh");
const runbookPath = path.join(repoRoot, "docs", "ops", "observability-stack-runbook.md");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function mustInclude(text, needle) {
  assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("compose file provisions observability profile with loopback-only operator surfaces", () => {
  const compose = readText(composePath);

  mustInclude(compose, "profiles:");
  mustInclude(compose, "- observability");
  mustInclude(compose, "prom/prometheus:v3.3.1");
  mustInclude(compose, "grafana/grafana-oss:11.6.2");
  mustInclude(compose, "127.0.0.1:9090:9090");
  mustInclude(compose, "127.0.0.1:3000:3000");
});

test("prometheus scrape config covers all required backend targets", () => {
  const config = readText(prometheusConfigPath);

  mustInclude(config, "job_name: channel-service");
  mustInclude(config, "channel-service:18080");
  mustInclude(config, "job_name: corebank-service");
  mustInclude(config, "corebank-service:19081");
  mustInclude(config, "job_name: fep-gateway");
  mustInclude(config, "fep-gateway:18083");
  mustInclude(config, "job_name: fep-simulator");
  mustInclude(config, "fep-simulator:18082");
});

test("grafana dashboard keeps stable UID and panel identifiers for story 7.8 contract", () => {
  const dashboard = JSON.parse(readText(dashboardPath));
  const panelIds = dashboard.panels.map((panel) => panel.id);
  const panelTypes = Object.fromEntries(dashboard.panels.map((panel) => [panel.id, panel.type]));
  const dashboardText = readText(dashboardPath);

  assert.equal(dashboard.uid, "ops-monitoring-overview");
  assert.deepEqual(panelIds.filter((id) => [101, 102, 103, 201, 202, 203].includes(id)).sort(), [
    101, 102, 103, 201, 202, 203,
  ]);
  assert.equal(panelTypes[101], "timeseries");
  assert.equal(panelTypes[102], "timeseries");
  assert.equal(panelTypes[103], "timeseries");
  assert.equal(panelTypes[201], "stat");
  assert.equal(panelTypes[202], "stat");
  assert.equal(panelTypes[203], "stat");
  mustInclude(dashboardText, "channel_order_execution_last_completed_epoch_seconds");
  mustInclude(dashboardText, "channel_order_sessions_recovery_backlog_last_updated_epoch_seconds");
  mustInclude(dashboardText, "fep_marketdata_snapshots_last_persisted_epoch_seconds");
});

test("generator and validator scripts encode the repo-owned monitoring contract", () => {
  const generator = readText(generatorPath);
  const validator = readText(validatorPath);

  mustInclude(generator, "executionVolume");
  mustInclude(generator, "pendingSessions");
  mustInclude(generator, "marketDataIngest");
  mustInclude(generator, "ops-monitoring-overview");
  mustInclude(generator, "OBSERVABILITY_GRAFANA_MODE");
  mustInclude(generator, "channel_order_execution_last_completed_epoch_seconds");
  mustInclude(generator, "channel_order_sessions_recovery_backlog_last_updated_epoch_seconds");
  mustInclude(generator, "fep_marketdata_snapshots_last_persisted_epoch_seconds");
  mustInclude(validator, "Static observability checks passed");
  mustInclude(validator, "Runtime observability checks passed");
  mustInclude(validator, "up -d --force-recreate prometheus grafana");
  mustInclude(validator, "/api/datasources/uid/prometheus");
  mustInclude(validator, "/api/dashboards/uid/ops-monitoring-overview");
  mustInclude(validator, "Channel actuator prometheus endpoint should not be exposed");
  mustInclude(validator, "Grafana anonymous API access should not be enabled");
});

test("runbook documents bootstrap, validation, and recovery workflow", () => {
  const runbook = readText(runbookPath);

  mustInclude(runbook, "First-Time Bootstrap");
  mustInclude(runbook, "Stable Dashboard Contract");
  mustInclude(runbook, "Runtime validation");
  mustInclude(runbook, "Partial-Failure Recovery");
});
