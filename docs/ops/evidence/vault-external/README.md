# Vault External Evidence

Store Story `0.14` rehearsal evidence under date-scoped folders such as `docs/ops/evidence/vault-external/20260320/`.

Expected run-scoped artifacts:

- `summary-<RUN_ID>.json`
- `latest-summary.json`
- `index.json`
- `cutover-<RUN_ID>.log`
- `audit-retention-<RUN_ID>.json`
- `trust-continuity-<RUN_ID>.json`
- `rotation-propagation-<RUN_ID>.json`

Use `live-external.env.template` in this directory as the canonical checklist of operator-supplied measurements and run-scoped references for `live-external` execution.
