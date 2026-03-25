"use strict";

const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");

function toBashPath(filePath) {
  if (process.platform !== "win32") {
    return filePath;
  }

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
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildBashCommand(repoRoot, scriptPath, options = {}) {
  const statements = [];

  for (const [name, value] of Object.entries(options.env || {})) {
    statements.push(`export ${name}=${quoteForBash(normalizeEnvValue(value))}`);
  }

  if ((options.prependPathEntries || []).length > 0) {
    const prepended = options.prependPathEntries.map((entry) => toBashPath(entry)).join(":");
    statements.push(`export PATH=${quoteForBash(`${prepended}:`)}"$PATH"`);
  }

  statements.push(`bash ${quoteForBash(toBashPath(path.join(repoRoot, scriptPath)))}`);
  return statements.join("; ");
}

function runBashScript(repoRoot, scriptPath, options = {}) {
  return spawnSync("bash", ["-lc", buildBashCommand(repoRoot, scriptPath, options)], {
    cwd: repoRoot,
    env: { ...process.env },
    encoding: "utf8",
    timeout: options.timeout ?? 30000,
    maxBuffer: 1024 * 1024,
  });
}

function runAsyncBashScript(repoRoot, scriptPath, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["-lc", buildBashCommand(repoRoot, scriptPath, options)], {
      cwd: repoRoot,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ status: 124, stdout, stderr: `${stderr}\nTimed out` });
    }, options.timeout ?? 30000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ status: code, stdout, stderr });
    });
  });
}

module.exports = {
  buildBashCommand,
  quoteForBash,
  runAsyncBashScript,
  runBashScript,
  toBashPath,
};
