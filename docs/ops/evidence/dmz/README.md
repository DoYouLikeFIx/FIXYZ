# DMZ Drill Evidence

Store DMZ drill evidence under dated folders.

## Folder Rule

- `docs/ops/evidence/dmz/<YYYYMMDD>/`

## File Rule

- `dmz-<scenario>-<YYYYMMDDTHHMMSSZ>.json`
- Required summary file per drill set: `summary-index.json`
- Optional immutable copy per run: `summary-index-<YYYYMMDDTHHMMSSZ>.json`

## CI Retention Rule

- `.github/workflows/dmz-security-drill.yml` uploads this folder as a workflow artifact.
- Artifact retention must be at least 35 days to preserve a rolling four-week audit window.
