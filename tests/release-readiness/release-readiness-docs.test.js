"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const runbookPath = path.join(repoRoot, "docs", "ops", "full-stack-smoke-rehearsal-runbook.md");
const checklistPath = path.join(repoRoot, "docs", "ops", "release-go-no-go-checklist-template.md");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

test("full-stack smoke rehearsal runbook links canonical Story 10.4 automation and rollback flow", () => {
  const runbook = read(runbookPath);

  assert.match(runbook, /run-full-stack-smoke\.sh/);
  assert.match(runbook, /run-five-session-isolation\.mjs/);
  assert.match(runbook, /run-rollback-rehearsal\.sh/);
  assert.match(runbook, /deterministic re-run/i);
  assert.match(runbook, /go-no-go-summary\.json/);
  assert.match(runbook, /go-no-go-summary\.md/);
});

test("go-no-go checklist template keeps Story 10.4 evidence and blocking rules explicit", () => {
  const checklist = read(checklistPath);

  assert.match(checklist, /smoke-summary\.json/);
  assert.match(checklist, /session-isolation-summary\.json/);
  assert.match(checklist, /rollback-rehearsal-summary\.json/);
  assert.match(checklist, /go-no-go-summary\.json/);
  assert.match(checklist, /Any missing Story `10\.4` evidence keeps the release at `no-go`\./);
  assert.match(checklist, /Any smoke, session isolation, or rollback rehearsal status other than `passed` keeps the release at `no-go`\./);
});
