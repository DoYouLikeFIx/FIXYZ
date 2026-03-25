#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUILD_ID = process.env.STORY_10_4_BUILD_ID?.trim()
  || process.env.RELEASE_READINESS_BUILD_ID?.trim()
  || process.env.SMOKE_BUILD_ID?.trim()
  || "local";
const OUTPUT_DIR = process.env.STORY_10_4_OUTPUT_DIR?.trim()
  || path.join(ROOT_DIR, "_bmad-output", "test-artifacts", "epic-10", BUILD_ID, "story-10-4");
const MATRIX_JSON_PATH = path.join(OUTPUT_DIR, "matrix-summary.json");
const MATRIX_MARKDOWN_PATH = path.join(OUTPUT_DIR, "matrix-summary.md");

const SCENARIO_CATALOG = [
  {
    scenarioId: "E10-SMOKE-001",
    description: "Fresh compose boot returns the first mandatory API response within 120 seconds and keeps critical services healthy.",
    owner: "Story 10.4 cold-start smoke summary",
    evidence: "cold-start-timing.json",
  },
  {
    scenarioId: "E10-SMOKE-002",
    description: "Critical API/docs endpoints respond correctly during smoke validation.",
    owner: "Story 10.4 docs smoke summary",
    evidence: "docs-summary.json",
  },
  {
    scenarioId: "E10-SMOKE-003",
    description: "Rollback rehearsal remains executable and documented for the release window.",
    owner: "Story 10.4 rollback rehearsal summary",
    evidence: "rollback-rehearsal-summary.json",
  },
  {
    scenarioId: "E10-OBS-001",
    description: "Prometheus targets are UP during the rehearsal run.",
    owner: "Story 10.4 observability smoke summary",
    evidence: "observability-validation.log",
  },
  {
    scenarioId: "E10-OBS-002",
    description: "Grafana dashboard is reachable during the rehearsal run.",
    owner: "Story 10.4 observability smoke summary",
    evidence: "observability-validation.log",
  },
  {
    scenarioId: "E10-SESSION-001",
    description: "Five authenticated sessions remain isolated with no demo-blocking degradation.",
    owner: "Story 10.4 session isolation rehearsal",
    evidence: "session-isolation-summary.json",
  },
];

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return readJson(filePath);
  } catch (error) {
    return {
      status: "failed",
      message: `Unable to parse ${path.basename(filePath)}: ${error instanceof Error ? error.message : String(error)}`,
      parseError: true,
    };
  }
}

function normalizeResult(status) {
  if (typeof status !== "string") {
    return "MISSING";
  }
  const normalized = status.trim().toLowerCase();
  if (normalized === "passed" || normalized === "go") {
    return "PASSED";
  }
  if (normalized === "failed" || normalized === "no-go") {
    return "FAILED";
  }
  return "MISSING";
}

function relativizeEvidence(filePath) {
  const relativePath = path.relative(OUTPUT_DIR, filePath);
  if (!relativePath || relativePath.startsWith("..")) {
    return filePath.replace(/\\/g, "/");
  }
  return relativePath.replace(/\\/g, "/");
}

function scenarioFromSmoke(smokeSummary, scenarioId, description, owner, evidencePath) {
  if (!smokeSummary || !Array.isArray(smokeSummary.scenarios)) {
    return {
      scenarioId,
      description,
      result: "MISSING",
      ownerTest: owner,
      evidence: evidencePath,
      source: "smoke-summary.json",
    };
  }

  const matched = smokeSummary.scenarios.find((scenario) => scenario?.id === scenarioId);
  if (!matched) {
    return {
      scenarioId,
      description,
      result: "MISSING",
      ownerTest: owner,
      evidence: evidencePath,
      source: "smoke-summary.json",
    };
  }

  return {
    scenarioId,
    description,
    result: normalizeResult(matched.status),
    ownerTest: owner,
    evidence: matched.evidencePath ? relativizeEvidence(matched.evidencePath) : evidencePath,
    source: "smoke-summary.json",
  };
}

function scenarioFromStatus(filePayload, scenarioId, description, owner, evidencePath) {
  if (!filePayload) {
    return {
      scenarioId,
      description,
      result: "MISSING",
      ownerTest: owner,
      evidence: evidencePath,
    };
  }

  return {
    scenarioId,
    description,
    result: normalizeResult(filePayload.status),
    ownerTest: owner,
    evidence: evidencePath,
  };
}

function scenarioFromColdStart(smokeSummary, filePayload, scenarioId, description, owner, evidencePath) {
  const smokeScenario = scenarioFromSmoke(smokeSummary, scenarioId, description, owner, evidencePath);
  if (!filePayload) {
    return {
      scenarioId,
      description,
      result: smokeScenario.result === "MISSING" ? "MISSING" : "FAILED",
      ownerTest: owner,
      evidence: evidencePath,
    };
  }

  const withinTarget = Boolean(filePayload.firstMandatoryApi?.withinTarget);
  return {
    scenarioId,
    description,
    result: smokeScenario.result === "PASSED" && withinTarget ? "PASSED" : "FAILED",
    ownerTest: owner,
    evidence: evidencePath,
  };
}

function renderMarkdown(summary) {
  const passed = summary.scenarios.filter((scenario) => scenario.result === "PASSED").length;
  const failed = summary.scenarios.filter((scenario) => scenario.result === "FAILED").length;
  const missing = summary.scenarios.filter((scenario) => scenario.result === "MISSING").length;
  const blockerLines = summary.goNoGo.blockers.length === 0
    ? "- none"
    : summary.goNoGo.blockers.map((blocker) => `- ${blocker}`).join("\n");

  return `# Story 10.4 Full-Stack Smoke/Rehearsal Summary

- Build ID: \`${summary.buildId}\`
- Generated At: \`${summary.generatedAt}\`
- Overall Result: \`${summary.overallResult}\`
- Go/No-Go Decision: \`${summary.goNoGo.decision}\`
- Release Ready: \`${summary.goNoGo.releaseReady}\`
- Cold-Start Duration: \`${summary.coldStart.durationMs} ms\`
- Cold-Start Target Met: \`${summary.coldStart.withinTarget}\`
- Totals: passed=${passed}, failed=${failed}, missing=${missing}

## Scenario Matrix

| Scenario ID | Result | Owner | Evidence |
| --- | --- | --- | --- |
${summary.scenarios.map((scenario) => `| \`${scenario.scenarioId}\` | \`${scenario.result}\` | \`${scenario.ownerTest}\` | \`${scenario.evidence}\` |`).join("\n")}

## Go/No-Go Blockers

${blockerLines}
`;
}

function main() {
  ensureDirectory(OUTPUT_DIR);

  const coldStartPath = path.join(OUTPUT_DIR, "cold-start-timing.json");
  const docsSummaryPath = path.join(OUTPUT_DIR, "docs-summary.json");
  const smokeSummaryPath = path.join(OUTPUT_DIR, "smoke-summary.json");
  const sessionSummaryPath = path.join(OUTPUT_DIR, "session-isolation-summary.json");
  const rollbackSummaryPath = path.join(OUTPUT_DIR, "rollback-rehearsal-summary.json");
  const goNoGoSummaryPath = path.join(OUTPUT_DIR, "go-no-go-summary.json");

  const coldStart = safeReadJson(coldStartPath);
  const docsSummary = safeReadJson(docsSummaryPath);
  const smokeSummary = safeReadJson(smokeSummaryPath);
  const sessionSummary = safeReadJson(sessionSummaryPath);
  const rollbackSummary = safeReadJson(rollbackSummaryPath);
  const goNoGoSummary = safeReadJson(goNoGoSummaryPath);

  const scenarios = [
    scenarioFromColdStart(smokeSummary, coldStart, "E10-SMOKE-001", SCENARIO_CATALOG[0].description, SCENARIO_CATALOG[0].owner, relativizeEvidence(coldStartPath)),
    scenarioFromStatus(docsSummary, "E10-SMOKE-002", SCENARIO_CATALOG[1].description, SCENARIO_CATALOG[1].owner, relativizeEvidence(docsSummaryPath)),
    scenarioFromStatus(rollbackSummary, "E10-SMOKE-003", SCENARIO_CATALOG[2].description, SCENARIO_CATALOG[2].owner, relativizeEvidence(rollbackSummaryPath)),
    scenarioFromSmoke(smokeSummary, "E10-OBS-001", SCENARIO_CATALOG[3].description, SCENARIO_CATALOG[3].owner, SCENARIO_CATALOG[3].evidence),
    scenarioFromSmoke(smokeSummary, "E10-OBS-002", SCENARIO_CATALOG[4].description, SCENARIO_CATALOG[4].owner, SCENARIO_CATALOG[4].evidence),
    scenarioFromStatus(sessionSummary, "E10-SESSION-001", SCENARIO_CATALOG[5].description, SCENARIO_CATALOG[5].owner, relativizeEvidence(sessionSummaryPath)),
  ];

  const scenarioFailures = scenarios.filter((scenario) => scenario.result !== "PASSED");
  const goNoGoDecision = (goNoGoSummary?.decision ?? "no-go").toString();
  const goNoGoResult = normalizeResult(goNoGoDecision);
  const releaseReady = goNoGoSummary?.releaseReady === true;
  const overallResult = scenarioFailures.length === 0 && goNoGoResult === "PASSED" && releaseReady ? "PASSED" : "FAILED";
  const summary = {
    buildId: BUILD_ID,
    generatedAt: new Date().toISOString(),
    overallResult,
    scenarios,
    coldStart: {
      durationMs: coldStart?.firstMandatoryApi?.durationMs ?? -1,
      withinTarget: Boolean(coldStart?.firstMandatoryApi?.withinTarget),
      evidence: relativizeEvidence(coldStartPath),
    },
    docs: {
      status: normalizeResult(docsSummary?.status),
      evidence: relativizeEvidence(docsSummaryPath),
    },
    goNoGo: {
      decision: goNoGoDecision,
      releaseReady,
      blockers: Array.isArray(goNoGoSummary?.blockers) ? goNoGoSummary.blockers : [],
      evidence: relativizeEvidence(goNoGoSummaryPath),
    },
    linkedEvidence: {
      coldStart: relativizeEvidence(coldStartPath),
      docs: relativizeEvidence(docsSummaryPath),
      smoke: relativizeEvidence(smokeSummaryPath),
      sessionIsolation: relativizeEvidence(sessionSummaryPath),
      rollback: relativizeEvidence(rollbackSummaryPath),
      goNoGo: relativizeEvidence(goNoGoSummaryPath),
    },
  };

  fs.writeFileSync(MATRIX_JSON_PATH, JSON.stringify(summary, null, 2));
  fs.writeFileSync(MATRIX_MARKDOWN_PATH, renderMarkdown(summary));

  if (overallResult !== "PASSED") {
    const failingScenarios = scenarios
      .filter((scenario) => scenario.result !== "PASSED")
      .map((scenario) => `${scenario.scenarioId}:${scenario.result}`);
    console.error(`Story 10.4 evidence gate failed: ${failingScenarios.join(", ") || "go-no-go-contract"}`);
    console.error(`Matrix summary: ${MATRIX_JSON_PATH}`);
    process.exitCode = 1;
  }
}

main();
