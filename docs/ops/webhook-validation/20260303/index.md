# Webhook Validation Evidence Index (20260303)

## Scope

Story `0-5-collaboration-webhook-notifications` reliability replay artifacts.

## Included Artifacts

- `github-duplicate.log`
- `github-timeout.log`
- `jira-duplicate.json`
- `jira-failure-429.json`
- `payload-github-pr-opened.json`
- `payload-jira-transition.json`
- `index.json`

## Retention

- GitHub Actions artifact retention: `90` days (`actions/upload-artifact`)
- Jira automation audit export retention policy: `>=90` days

## Owner

- Delivery platform team

