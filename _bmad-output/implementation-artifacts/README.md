# Implementation Artifacts

As of 2026-03-12, this folder uses a hybrid structure.

Default rule:

- Epics use standalone story markdown files plus epic companion documents.

Use these sources:

- `_bmad-output/planning-artifacts/epics.md`: canonical story list and acceptance direction
- `_bmad-output/implementation-artifacts/epic-*.md`: epic-level implementation contracts and companion notes
- `_bmad-output/implementation-artifacts/sprint-status.yaml`: current delivery status

Notes:

- Epic 1 baseline stories `1.1`~`1.10` remain restored and marked as delivered, while new MFA rollout scope is added through Story `1.11`~`1.15`.
- Epic 4 story files `4.1`~`4.8` are regenerated from the canonical planning artifact, and the epic companion remains the shared implementation contract for cross-story invariants.
- Legacy filenames such as `epic-2-order-session-and-otp.md` are retained for continuity, even where the internal title now reflects risk-based authorization instead of always-on order OTP.
- Historical retrospectives remain archival context only.
- `usecase-branches-all-specs.md` remains removed because it would duplicate changed and unchanged sources in one stale aggregate file.
