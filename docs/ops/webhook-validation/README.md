# Webhook Validation Runbook

## Goal

Validate collaboration webhook reliability for GitHub and Jira flows:

- payload format correctness
- duplicate suppression (10-minute window)
- timeout and non-2xx retry behavior
- auditable evidence artifact storage

## Required Scenarios

1. Duplicate GitHub delivery suppression
2. Duplicate Jira delivery suppression
3. MatterMost timeout during post
4. MatterMost HTTP `429` or `5xx` during post
5. Webhook URL misconfiguration handling

## Artifact Rules

- Save artifacts to `docs/ops/webhook-validation/<YYYYMMDD>/`
- Use fixed naming patterns:
  - `github-*.log`
  - `jira-*.json`
  - `payload-*.json`
- Keep GitHub artifact upload retention at `>= 90` days.
- Keep Jira audit export retention at `>= 90` days.

## GitHub Replay Validation

1. Trigger `pull_request` or `workflow_run`.
2. Confirm payload output includes repo, actor, link, and result/status.
3. Replay identical event within 10 minutes and confirm suppression.
4. Inject timeout/non-2xx in MatterMost endpoint and confirm:
   - `max_attempts=3`
   - delays follow `2s`, `5s` with jitter range `+-20%`
5. Export and archive logs/payload artifacts.

## Jira Replay Validation

1. Trigger issue transition for Story/Epic.
2. Confirm payload includes issue key, summary, status transition, assignee.
3. Replay identical transition within 10 minutes and confirm suppression from issue properties.
4. Inject timeout/non-2xx and confirm:
   - `max_attempts=3`
   - fixed delays `2s`, `5s` (no jitter)
5. Export Jira audit data into `jira-*.json`.

