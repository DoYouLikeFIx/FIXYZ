# Redis Recovery Evidence Directory

This directory is the runtime output root for Redis recovery drills.

- Drill artifacts are written to dated subfolders: `docs/ops/redis-recovery/<YYYYMMDD>/`.
- Runtime evidence files (`*.json`, `*.log`) are intentionally ignored by Git.
- Keep this README tracked so the directory exists in clean checkouts/CI.

Use the runbook for execution details:

- `docs/ops/redis-recovery-runbook.md`
