# Collaboration Webhook Notifications

## Scope

This guide defines direct collaboration notifications from:

- GitHub (`pull_request`, `workflow_run`) -> MatterMost incoming webhook
- Jira issue transition events -> MatterMost incoming webhook

No relay service is introduced in this story.

## Security Configuration

### GitHub

- Secret required: `MATTERMOST_WEBHOOK_URL`
- Optional variable: `MATTERMOST_CHANNEL_KEY` (defaults to `${{ github.repository }}`)
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

