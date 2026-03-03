# Jira Automation -> MatterMost Setup

## Rule Purpose

Send Jira Story/Epic transition notifications to MatterMost with dedupe and bounded retries.

## Preconditions

- Jira Automation enabled for the project.
- Secure variable configured in Jira Automation:
  - `MATTERMOST_WEBHOOK_URL`
- Team-managed custom issue properties available:
  - `mm_last_hash`
  - `mm_last_ts`

## Rule Steps

1. Trigger: `Issue transitioned`
2. Condition: issue type in `Story`, `Epic`
3. Create variables:
   - `mm_source = jira`
   - `mm_source_project = {{issue.project.key}}`
   - `mm_target_channel = fix-delivery` (or project-specific channel key)
   - `mm_event_type = {{webhookEvent}}`
   - `mm_entity_id = {{issue.key}}`
   - `mm_target_status = {{issue.status.name}}`
   - `mm_actor = {{initiator.displayName}}`
4. Build normalized dedupe key with `_` fallback for missing values.
5. Compute `mm_hash` from the dedupe key (or source event id when available).
6. Read issue properties:
   - `mm_last_hash`
   - `mm_last_ts`
7. Stop rule if duplicate within 10 minutes:
   - `mm_last_hash == mm_hash`
   - `now - mm_last_ts < 600000`
8. Prepare MatterMost JSON payload (issue key, summary, from/to status, assignee, actor, link).
9. Send webhook request attempt 1.
10. If request fails (timeout/non-2xx), wait `2s` and retry attempt 2.
11. If request still fails, wait `5s` and retry attempt 3.
12. Persist dedupe issue properties on success:
   - `mm_last_hash = mm_hash`
   - `mm_last_ts = {{now.millis}}`
13. Write audit event for success/failure, including retry count and HTTP status.

## Retry and Ordering Rules

- `max_attempts=3`
- Delay sequence is fixed to `2s`, `5s` (no jitter)
- Configure rule execution mode to avoid parallel execution for the same issue key.

## Artifact Retention

- Export Jira automation audit logs weekly.
- Store under `docs/ops/webhook-validation/<YYYYMMDD>/jira-*.json`.
- Retain exported artifacts for at least 90 days.

## Template

Import and adapt:

- `docs/ops/jira/mattermost-automation-rule-template.json`

