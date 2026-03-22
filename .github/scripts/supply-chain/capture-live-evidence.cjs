"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function normalizeText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : fallback;
}

function todayUtcYyyymmdd(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function sanitizePathSegment(value, fallback) {
  const normalized = normalizeText(value, fallback);
  const sanitized = normalized
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized || fallback;
}

function readPositiveNumberEnv(name, fallback) {
  const parsed = Number(process.env[name] || String(fallback));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function runGit(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed in ${repoRoot}: ${normalizeText(result.stderr, result.stdout)}`,
    );
  }

  return normalizeText(result.stdout);
}

function parseGitHubSlug(remoteUrl) {
  const normalized = normalizeText(remoteUrl);
  const httpsMatch = normalized.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`.replace(/\.git$/i, "");
  }

  throw new Error(`Could not parse GitHub repository slug from remote URL: ${normalized}`);
}

function relativeToRepo(repoRoot, targetPath) {
  return path.relative(repoRoot, targetPath).replace(/\\/g, "/");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main() {
  const workspaceRoot = process.cwd();
  const liveToken =
    normalizeText(process.env.LIVE_GITHUB_TOKEN) ||
    normalizeText(process.env.BRANCH_PROTECTION_TOKEN) ||
    normalizeText(process.env.ALERTS_TOKEN) ||
    normalizeText(process.env.GITHUB_TOKEN);

  if (!liveToken) {
    throw new Error(
      "LIVE_GITHUB_TOKEN (or BRANCH_PROTECTION_TOKEN / ALERTS_TOKEN / GITHUB_TOKEN) is required for live evidence capture",
    );
  }

  const evidenceDate = normalizeText(process.env.EVIDENCE_DATE, todayUtcYyyymmdd());
  const snapshotId = sanitizePathSegment(
    process.env.EVIDENCE_RUN_ID || `live-evidence-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z")}`,
    "live-evidence",
  );
  const repoConfigs = [
    { id: "fixyz", root: workspaceRoot },
    { id: "fixyz-be", root: path.join(workspaceRoot, "BE") },
    { id: "fixyz-fe", root: path.join(workspaceRoot, "FE") },
    { id: "fixyz-mob", root: path.join(workspaceRoot, "MOB") },
  ];
  const runs = [];
  const failures = [];

  for (const repoConfig of repoConfigs) {
    const repoRoot = repoConfig.root;
    const outputRoot = path.join(repoRoot, "docs", "ops", "security-scan", evidenceDate, snapshotId);

    try {
      const remoteUrl = runGit(repoRoot, ["remote", "get-url", "origin"]);
      const repoSlug = parseGitHubSlug(remoteUrl);
      const result = spawnSync(process.execPath, [".github/scripts/supply-chain/run-security-baseline.cjs"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          REPO_SLUG: repoSlug,
          EVIDENCE_DATE: evidenceDate,
          EVIDENCE_RUN_ID: snapshotId,
          ALERTS_TOKEN: liveToken,
          BRANCH_PROTECTION_TOKEN: liveToken,
          FAIL_ON_BRANCH_PROTECTION_AUDIT_ERROR: "true",
          EXPECTED_REQUIRED_CHECK: "supply-chain-security",
        },
      });
      const summaryPath = path.join(outputRoot, `scan-summary-${repoConfig.id}.json`);
      const summary = fs.existsSync(summaryPath) ? readJson(summaryPath) : null;
      const errorText = normalizeText(result.stderr, result.stdout);

      runs.push({
        repo: repoConfig.id,
        repoSlug,
        repoRoot: relativeToRepo(workspaceRoot, repoRoot) || ".",
        outputDirectory: relativeToRepo(workspaceRoot, outputRoot),
        statusCode: result.status,
        summaryStatus: summary ? summary.summary.status : "missing-summary",
        blockingFindings: summary ? summary.summary.blockingFindings : null,
        branchProtectionStatus: summary ? summary.summary.branchProtectionStatus : null,
        error: errorText || null,
      });

      if (result.status !== 0) {
        failures.push(`${repoSlug}: ${errorText || "run-security-baseline exited non-zero"}`);
      }
    } catch (error) {
      runs.push({
        repo: repoConfig.id,
        repoSlug: null,
        repoRoot: relativeToRepo(workspaceRoot, repoRoot) || ".",
        outputDirectory: relativeToRepo(workspaceRoot, outputRoot),
        statusCode: null,
        summaryStatus: "capture-failed",
        blockingFindings: null,
        branchProtectionStatus: null,
        error: error.message,
      });
      failures.push(`${repoConfig.id}: ${error.message}`);
    }
  }

  const manifestPath = path.join(
    workspaceRoot,
    "docs",
    "ops",
    "security-scan",
    evidenceDate,
    snapshotId,
    "live-evidence-manifest.json",
  );
  writeJson(manifestPath, {
    capturedAt: new Date().toISOString(),
    evidenceDate,
    snapshotId,
    overallStatus: failures.length === 0 ? "pass" : "failed",
    repositories: runs,
  });

  const relativeManifestPath = relativeToRepo(workspaceRoot, manifestPath);
  console.log(`Live evidence manifest written to ${relativeManifestPath}`);

  if (failures.length > 0) {
    throw new Error(`Live evidence capture finished with failures. See ${relativeManifestPath}: ${failures.join("; ")}`);
  }
}

main();
