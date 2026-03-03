# Collaboration Webhook Notifications

## Scope

This guide defines direct collaboration notifications from:

- GitHub (`pull_request`, `workflow_run`) -> MatterMost incoming webhook
- Jira issue transition events -> MatterMost incoming webhook

No relay service is introduced in this story.

## Multi-Repo Rollout Scope (Story 0.6)

| Repository | Owner | Workflow Run Coverage | Rollout Order | Rollback Switch |
| --- | --- | --- | --- | --- |
| `DoYouLikeFIx/FIXYZ` | Delivery platform | `Publish API Docs to GitHub Pages` completion | 1 | Disable `.github/workflows/collaboration-webhook-notifications.yml` in root repo |
| `DoYouLikeFIx/FIXYZ-BE` | BE platform | `ci-channel`, `ci-corebank`, `ci-fep-gateway`, `ci-fep-simulator` completion | 2 | Disable same workflow in BE repo only |
| `DoYouLikeFIx/FIXYZ-FE` | FE platform | `ci-frontend` completion | 3 | Disable same workflow in FE repo only |
| `DoYouLikeFIx/FIXYZ-MOB` | MOB platform | `ci-mobile` completion | 4 | Disable same workflow in MOB repo only |

Notes:

- Rollout is repository-scoped. One repository can be disabled without impacting the others.
- Root repository workflow remains active and aligned to Story 0.5 contracts.

## Security Configuration

### GitHub

- Secret required: `MATTERMOST_WEBHOOK_URL`
- Optional variable: `MATTERMOST_CHANNEL_KEY` (defaults to `${{ github.repository }}`)
- Configure both values independently in each repository (`FIXYZ`, `FIXYZ-BE`, `FIXYZ-FE`, `FIXYZ-MOB`).
- Secrets are read at runtime only by workflow environment variables.
- Workflow logs and persisted audit files never print `MATTERMOST_WEBHOOK_URL`.

### Jira

- Add secure automation variable `MATTERMOST_WEBHOOK_URL`.
- Store Jira dedupe state in issue properties:
  - `mm_last_hash`
  - `mm_last_ts`
- Never hardcode webhook URLs or tokens in rule JSON or documentation examples.

## Message Normalization Contract

### GitHub payload fields

- `source=github`
- `source_project=<owner/repo>`
- `event_type=pull_request.<action>` or `workflow_run.<status_or_conclusion>`
- `entity_id=<PR number or workflow_run.id>`
- `target_status=<open|closed|merged|success|failure|...>`
- `actor=<github login>`
- `event_url=<PR URL or workflow run URL>`

### Jira payload fields

- `source=jira`
- `source_project=<Jira project key>`
- `event_type=<jira webhook event>`
- `entity_id=<issue key>`
- `previous_status=<from status>`
- `target_status=<to status>`
- `summary=<issue summary>`
- `assignee=<display name or _>`
- `actor=<transition actor>`
- `issue_url=<browse URL>`

## Dedupe Contract

Normalized dedupe key schema:

`source + source_project + target_channel + event_type + entity_id + normalized_target_status + normalized_actor`

`null` or missing values are normalized to `_`.

Source event id precedence:

- Use source event id (`delivery_id` or equivalent) when available.
- Fallback to normalized dedupe key hash when source event id is unavailable.

Suppression window:

- GitHub: 10 minutes
- Jira: 10 minutes

GitHub persisted state contract:

- Cache key: `mm-dedupe-{dedupe_hash}-{window_bucket_10m}`
- Bucket formula: `window_bucket_10m=floor(event_epoch/600)`

Jira persisted state contract:

- Issue properties: `mm_last_hash`, `mm_last_ts`
- Suppress if same hash repeats and `(now - mm_last_ts) < 600000`.

## Retry and Ordering Contract

Retry policy (`max_attempts=3`):

- GitHub: retry delays `2s`, `5s` with jitter `+-20%`
- Jira: retry delays `2s`, `5s` fixed (no jitter)

Ordering guard:

- GitHub: workflow `concurrency` keyed by source+entity
- Jira: one execution per issue key at a time (rule option + issue-scoped property checks)

## Retention

- GitHub validation artifacts are uploaded with `retention-days: 90`.
- Jira audit export retention policy must be configured to keep artifacts for at least 90 days.

## Repository Rollback Procedure

### Disable notifications for one repository

1. Open the target repository Actions tab.
2. Open workflow `Collaboration Webhook Notifications`.
3. Click `Disable workflow`.

CLI alternative:

```bash
gh workflow disable collaboration-webhook-notifications.yml --repo DoYouLikeFIx/FIXYZ-BE
```

Re-enable:

```bash
gh workflow enable collaboration-webhook-notifications.yml --repo DoYouLikeFIx/FIXYZ-BE
```

### Optional guarded early-exit

- Temporarily remove `MATTERMOST_WEBHOOK_URL` in the affected repository.
- Workflow execution is preserved, but outbound post step is skipped and configuration-missing audit log is produced.

## Repository-Scoped Troubleshooting Matrix

| Symptom | Scope | Checks | Action |
| --- | --- | --- | --- |
| No MatterMost message for BE CI completion | `FIXYZ-BE` only | Verify workflow enabled, secret exists, `workflow_run` workflow name matches (`ci-*`) | Re-enable workflow or correct workflow names in BE workflow file |
| Duplicate messages within 10 minutes | One repository | Inspect cache key `mm-dedupe-{dedupe_hash}-{window_bucket_10m}` and cache-hit status | Validate dedupe hash inputs (`target_channel`, `event_type`, `entity_id`, `actor`) |
| Timeout / 429 retries not visible | One repository | Check `github-failure-*.log` and action logs for `mattermost_retry_wait` events | Confirm `max_attempts=3`, backoff `2s,5s` with jitter `±20%` |
| Secret leakage concern | Any repository | Search logs/files for webhook URL patterns, verify only secret env usage | Rotate secret and re-run validation evidence collection |
