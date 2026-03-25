# Release Go/No-Go Checklist Template

Use this template after Story `10.4` smoke and rehearsal evidence is generated.

## Release Metadata

- Release window:
- Environment:
- Operator:
- Change reference:
- Rollback owner:

## Linked Story 10.4 Evidence

- `smoke-summary.json`:
- `cold-start-timing.json`:
- `docs-summary.json`:
- `session-isolation-summary.json`:
- `rollback-rehearsal-summary.json`:
- `go-no-go-summary.json`:
- `go-no-go-summary.md`:

## Mandatory Checks

- [ ] Cold-start target is within 120 seconds.
- [ ] Mandatory API/docs endpoints responded correctly.
- [ ] Prometheus targets are `UP`.
- [ ] Grafana dashboard is reachable.
- [ ] Five authenticated sessions remained isolated.
- [ ] Rollback rehearsal completed successfully.

## Blocking Rules

- Any missing Story `10.4` evidence keeps the release at `no-go`.
- Any smoke, session isolation, or rollback rehearsal status other than `passed` keeps the release at `no-go`.
- Any undocumented degraded path or missing rollback owner keeps the release at `no-go`.

## Decision

- Final decision: `go` / `no-go`
- Decision timestamp:
- Blocking issues:
- Follow-up owner:

## Notes

- Reviewer notes:
- Required rerun scope:
- Evidence archive location:
