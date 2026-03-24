"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

const composeHaPath = path.join(repoRoot, "docker-compose.ha.yml");
const scriptsRoot = path.join(repoRoot, "docker", "mysql", "ha", "scripts");
const initPrimaryPath = path.join(repoRoot, "docker", "mysql", "ha", "init-primary", "01-init-primary.sh");
const mysqlRepairScriptPath = path.join(
  repoRoot,
  "scripts",
  "infra-bootstrap",
  "repair-service-databases.sh",
);
const bootstrapReplicationScript = path.join(scriptsRoot, "bootstrap-replication.sh");
const healthScript = path.join(scriptsRoot, "collect-replication-health.sh");
const alertScript = path.join(scriptsRoot, "evaluate-replication-alerts.sh");
const failoverScript = path.join(scriptsRoot, "run-failover-drill.sh");
const restoreScript = path.join(scriptsRoot, "run-restore-rehearsal.sh");

const runbookPath = path.join(repoRoot, "docs", "ops", "database-ha-replication-runbook.md");
const consistencyInventoryPath = path.join(repoRoot, "docs", "ops", "read-routing-consistency-inventory.md");
const adrPath = path.join(repoRoot, "docs", "ops", "adr", "adr-0002-database-ha-profile-boundary.md");

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function toBashPath(filePath) {
  return filePath
    .replace(/\\/g, "/")
    .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
}

function normalizeEnvValue(value) {
  if (typeof value !== "string") {
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

function mustInclude(text, needle) {
  assert.match(text, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

function runBashScript(scriptPath, env = {}) {
  const envAssignments = Object.entries(env)
    .map(([key, value]) => `${key}=${quoteForBash(normalizeEnvValue(value))}`);
  const command = [
    ...envAssignments,
    quoteForBash("/bin/bash"),
    quoteForBash(toBashPath(scriptPath)),
  ].join(" ");

  return spawnSync("bash", ["-lc", command], {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: "utf8",
    timeout: 20000,
    maxBuffer: 1024 * 1024,
  });
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("HA compose profile defines primary-replica topology and role-specific contracts", () => {
  assert.ok(fs.existsSync(composeHaPath), `missing HA compose profile: ${composeHaPath}`);
  const compose = readText(composeHaPath);

  mustInclude(compose, "mysql-primary:");
  mustInclude(compose, "mysql-replica:");
  mustInclude(compose, "profiles:");
  mustInclude(compose, "ha-db");
  mustInclude(compose, "MYSQL_REPLICATION_USER");
  mustInclude(compose, "MYSQL_REPLICATION_PASSWORD");
  mustInclude(compose, "read_only=ON");
});

test("Replication baseline scripts exist and encode required thresholds/formulas", () => {
  for (const filePath of [
    bootstrapReplicationScript,
    healthScript,
    alertScript,
    failoverScript,
    restoreScript,
  ]) {
    assert.ok(fs.existsSync(filePath), `missing DB-HA script: ${filePath}`);
  }

  const alerts = readText(alertScript);
  mustInclude(alerts, "lag >= 5s for 3 consecutive samples");
  mustInclude(alerts, "lag >= 30s for 2 consecutive samples");
  mustInclude(alerts, "replication stopped >= 60s");
  mustInclude(alerts, "10s interval");
  mustInclude(alerts, "dedupe");

  const failover = readText(failoverScript);
  mustInclude(failover, "RTO = t(all required probes green) - t(failover start)");
  mustInclude(failover, "RPO = t(last committed transaction before outage) - t(last recovered committed transaction after failover)");

  const restore = readText(restoreScript);
  mustInclude(restore, "SHA-256");
  mustInclude(restore, "deterministic export");
});

test("HA primary init pre-provisions every service database before replication bootstrap", () => {
  assert.ok(fs.existsSync(initPrimaryPath), `missing HA init script: ${initPrimaryPath}`);
  const initPrimary = readText(initPrimaryPath);

  for (const statement of [
    "CREATE DATABASE IF NOT EXISTS channel_db;",
    "CREATE DATABASE IF NOT EXISTS core_db;",
    "CREATE DATABASE IF NOT EXISTS fep_gateway_db;",
    "CREATE DATABASE IF NOT EXISTS fep_simulator_db;",
    "GRANT ALL PRIVILEGES ON channel_db.* TO '${MYSQL_USER}'@'%';",
    "GRANT ALL PRIVILEGES ON core_db.* TO '${MYSQL_USER}'@'%';",
    "GRANT ALL PRIVILEGES ON fep_gateway_db.* TO '${MYSQL_USER}'@'%';",
    "GRANT ALL PRIVILEGES ON fep_simulator_db.* TO '${MYSQL_USER}'@'%';",
  ]) {
    mustInclude(initPrimary, statement);
  }
});

test("HA compose auto-reconciles primary grants before replica bootstrap", () => {
  assert.ok(fs.existsSync(composeHaPath), `missing HA compose profile: ${composeHaPath}`);
  assert.ok(fs.existsSync(mysqlRepairScriptPath), `missing mysql repair script: ${mysqlRepairScriptPath}`);

  const compose = readText(composeHaPath);
  const mysqlRepairScript = readText(mysqlRepairScriptPath);

  mustInclude(compose, "mysql-primary-grant-repair:");
  mustInclude(compose, "MYSQL_HOST: mysql-primary");
  mustInclude(compose, "repair-service-databases.sh");
  mustInclude(compose, "condition: service_completed_successfully");
  mustInclude(mysqlRepairScript, "CREATE DATABASE IF NOT EXISTS fep_gateway_db;");
  mustInclude(mysqlRepairScript, "CREATE DATABASE IF NOT EXISTS fep_simulator_db;");
});

test("Replication bootstrap script supports MySQL 8.4 source status and legacy fallback", () => {
  const bootstrap = readText(bootstrapReplicationScript);
  mustInclude(bootstrap, "SHOW BINARY LOG STATUS");
  mustInclude(bootstrap, "SHOW MASTER STATUS");
  mustInclude(bootstrap, "Missing required live-mode env vars");
  mustInclude(bootstrap, "gtid-auto-position");
  mustInclude(bootstrap, "source_coordinates_usage");
});

test("Replication health collector normalizes NULL lag when replication is stopped", () => {
  const health = readText(healthScript);
  mustInclude(health, 'if [[ "${lag_seconds}" == "NULL" ]]');
  mustInclude(health, 'lag_seconds="0"');
  mustInclude(health, "Missing required live-mode env var: MYSQL_ROOT_PASSWORD");
});

test("Bootstrap replication live mode fails fast when required secrets are missing", () => {
  const result = runBashScript(bootstrapReplicationScript, {
    BOOTSTRAP_REPLICATION_MODE: "live",
    MYSQL_ROOT_PASSWORD: "",
    MYSQL_REPLICATION_PASSWORD: "",
  });

  assert.notEqual(result.status, 0, "bootstrap should fail when live secrets are missing");
  assert.match(result.stdout + result.stderr, /Missing required live-mode env vars/);
});

test("Replication health live mode fails fast when MYSQL_ROOT_PASSWORD is missing", () => {
  const result = runBashScript(healthScript, {
    REPLICATION_HEALTH_MODE: "live",
    MYSQL_ROOT_PASSWORD: "",
  });

  assert.notEqual(result.status, 0, "health collector should fail when root password is missing");
  assert.match(result.stdout + result.stderr, /Missing required live-mode env var: MYSQL_ROOT_PASSWORD/);
});

test("Alert evaluator emits warn/critical signals with dedupe controls", () => {
  const tempDir = makeTempDir("db-ha-alerts-");
  const samplesPath = path.join(tempDir, "samples.jsonl");
  const outputPath = path.join(tempDir, "alerts.json");

  fs.writeFileSync(
    samplesPath,
    [
      '{"ts":"2026-03-03T10:00:00Z","lag_seconds":5,"replication_running":true}',
      '{"ts":"2026-03-03T10:00:10Z","lag_seconds":6,"replication_running":true}',
      '{"ts":"2026-03-03T10:00:20Z","lag_seconds":7,"replication_running":true}',
      '{"ts":"2026-03-03T10:00:30Z","lag_seconds":31,"replication_running":true}',
      '{"ts":"2026-03-03T10:00:40Z","lag_seconds":32,"replication_running":true}',
      '{"ts":"2026-03-03T10:00:50Z","lag_seconds":35,"replication_running":true}',
    ].join("\n"),
    "utf8",
  );

  const result = runBashScript(alertScript, {
    ALERT_SAMPLE_FILE: samplesPath,
    ALERT_OUTPUT_FILE: outputPath,
  });

  assert.equal(result.status, 0, `alert evaluator failed: ${result.stderr}\n${result.stdout}`);
  assert.ok(fs.existsSync(outputPath), "alert output file not generated");

  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(payload.sample_interval_seconds, 10);
  assert.ok(payload.alerts.some((item) => item.severity === "warn"), "warn alert missing");
  assert.ok(payload.alerts.some((item) => item.severity === "critical"), "critical alert missing");
  assert.equal(
    payload.alerts.filter((item) => item.severity === "warn").length,
    1,
    "warn alerts should be deduped",
  );
});

test("Alert evaluator emits stopped-replication critical signal after 60s window", () => {
  const tempDir = makeTempDir("db-ha-alerts-stopped-");
  const samplesPath = path.join(tempDir, "samples-stopped.jsonl");
  const outputPath = path.join(tempDir, "alerts-stopped.json");

  fs.writeFileSync(
    samplesPath,
    [
      '{"ts":"2026-03-03T10:00:00Z","lag_seconds":0,"replication_running":false}',
      '{"ts":"2026-03-03T10:00:10Z","lag_seconds":0,"replication_running":false}',
      '{"ts":"2026-03-03T10:00:20Z","lag_seconds":0,"replication_running":false}',
      '{"ts":"2026-03-03T10:00:30Z","lag_seconds":0,"replication_running":false}',
      '{"ts":"2026-03-03T10:00:40Z","lag_seconds":0,"replication_running":false}',
      '{"ts":"2026-03-03T10:00:50Z","lag_seconds":0,"replication_running":false}',
      '{"ts":"2026-03-03T10:01:00Z","lag_seconds":0,"replication_running":false}',
    ].join("\n"),
    "utf8",
  );

  const result = runBashScript(alertScript, {
    ALERT_SAMPLE_FILE: samplesPath,
    ALERT_OUTPUT_FILE: outputPath,
  });

  assert.equal(result.status, 0, `alert evaluator failed: ${result.stderr}\n${result.stdout}`);
  assert.ok(fs.existsSync(outputPath), "alert output file not generated");

  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const stoppedAlerts = payload.alerts.filter(
    (item) => item.rule === "critical: replication stopped >= 60s",
  );
  assert.equal(stoppedAlerts.length, 1, "replication-stopped critical should be deduped");
  assert.equal(stoppedAlerts[0].severity, "critical");
  assert.equal(stoppedAlerts[0].context.duration_seconds, 60);
});

test("Failover drill simulation produces RTO/RPO evidence under baseline objectives", () => {
  const tempDir = makeTempDir("db-ha-failover-");
  const outputPath = path.join(tempDir, "failover-evidence.json");

  const result = runBashScript(failoverScript, {
    FAILOVER_DRILL_MODE: "simulate",
    FAILOVER_EVIDENCE_FILE: outputPath,
  });

  assert.equal(result.status, 0, `failover drill failed: ${result.stderr}\n${result.stdout}`);
  assert.ok(fs.existsSync(outputPath), "failover evidence file not generated");

  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(payload.measurement_formula.rto, "RTO = t(all required probes green) - t(failover start)");
  assert.equal(
    payload.measurement_formula.rpo,
    "RPO = t(last committed transaction before outage) - t(last recovered committed transaction after failover)",
  );
  assert.ok(payload.measured.rto_seconds <= 300, `RTO exceeded baseline: ${payload.measured.rto_seconds}`);
  assert.ok(payload.measured.rpo_seconds <= 60, `RPO exceeded baseline: ${payload.measured.rpo_seconds}`);
});

test("Restore rehearsal simulation validates deterministic SHA-256 checksum parity", () => {
  const tempDir = makeTempDir("db-ha-restore-");
  const outputPath = path.join(tempDir, "restore-evidence.json");

  const result = runBashScript(restoreScript, {
    RESTORE_REHEARSAL_MODE: "simulate",
    RESTORE_EVIDENCE_FILE: outputPath,
  });

  assert.equal(result.status, 0, `restore rehearsal failed: ${result.stderr}\n${result.stdout}`);
  assert.ok(fs.existsSync(outputPath), "restore evidence file not generated");

  const payload = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  assert.equal(payload.algorithm, "SHA-256");
  assert.equal(payload.checksum_parity, true);
  assert.equal(payload.deterministic_export.enabled, true);
  assert.ok(Array.isArray(payload.deterministic_export.tables));
  assert.ok(payload.deterministic_export.tables.length > 0);
});

test("Runbook + consistency inventory + ADR document HA scope and strong-consistency allowlist", () => {
  assert.ok(fs.existsSync(runbookPath), `missing DB-HA runbook: ${runbookPath}`);
  assert.ok(
    fs.existsSync(consistencyInventoryPath),
    `missing consistency inventory: ${consistencyInventoryPath}`,
  );
  assert.ok(fs.existsSync(adrPath), `missing DB-HA ADR: ${adrPath}`);

  const runbook = readText(runbookPath);
  mustInclude(runbook, "RTO <= 300s");
  mustInclude(runbook, "RPO <= 60s");
  mustInclude(runbook, "warn: lag >= 5s for 3 consecutive samples @10s interval");
  mustInclude(runbook, "critical: lag >= 30s for 2 consecutive samples @10s interval");
  mustInclude(runbook, "replication stopped >= 60s");
  mustInclude(runbook, "deploy/staging HA profile");
  mustInclude(runbook, "local default single-node profile");

  const consistency = readText(consistencyInventoryPath);
  mustInclude(consistency, "order session transition");
  mustInclude(consistency, "order execute");
  mustInclude(consistency, "admin force session invalidation");
  mustInclude(consistency, "stale-read risk scenarios");

  const adr = readText(adrPath);
  mustInclude(adr, "scope boundary");
  mustInclude(adr, "deploy/staging");
  mustInclude(adr, "local default single-node");
  mustInclude(adr, "migration assumptions");
  mustInclude(adr, "rollback strategy");
});
