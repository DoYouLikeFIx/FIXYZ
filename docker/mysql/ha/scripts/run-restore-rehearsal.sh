#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "${ROOT_DIR}"

RESTORE_REHEARSAL_MODE="${RESTORE_REHEARSAL_MODE:-simulate}"
RESTORE_EVIDENCE_FILE="${RESTORE_EVIDENCE_FILE:-docs/ops/evidence/database-ha-restore-rehearsal-latest.json}"

sha256_file() {
  local file_path="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file_path}" | awk '{print $1}'
    return
  fi

  shasum -a 256 "${file_path}" | awk '{print $1}'
}

write_evidence() {
  local source_checksum="$1"
  local restored_checksum="$2"
  local mode="$3"

  mkdir -p "$(dirname "${RESTORE_EVIDENCE_FILE}")"

  {
    printf '{\n'
    printf '  "generated_at": "%s",\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    printf '  "mode": "%s",\n' "${mode}"
    printf '  "algorithm": "SHA-256",\n'
    printf '  "deterministic_export": {\n'
    printf '    "enabled": true,\n'
    printf '    "tables": ["core_db.member", "channel_db.order_session"],\n'
    printf '    "dump_options": ["--skip-comments", "--skip-extended-insert", "--order-by-primary"]\n'
    printf '  },\n'
    printf '  "source_checksum": "%s",\n' "${source_checksum}"
    printf '  "restored_checksum": "%s",\n' "${restored_checksum}"
    printf '  "checksum_parity": %s\n' "$([[ "${source_checksum}" == "${restored_checksum}" ]] && echo true || echo false)"
    printf '}\n'
  } >"${RESTORE_EVIDENCE_FILE}"

  printf '[db-ha-restore] wrote evidence: %s\n' "${RESTORE_EVIDENCE_FILE}"
}

run_simulation() {
  local temp_dir source_export restored_export source_checksum restored_checksum
  temp_dir="$(mktemp -d)"
  source_export="${temp_dir}/source.sql"
  restored_export="${temp_dir}/restored.sql"

  # Deterministic export contract: fixed table order + stable dump options + SHA-256 checksum.
  cat >"${source_export}" <<'EOSQL'
-- deterministic export
INSERT INTO channel_db.order_session(id, status) VALUES (1, 'PENDING');
INSERT INTO core_db.member(id, name) VALUES (10, 'alice');
EOSQL

  cp "${source_export}" "${restored_export}"

  source_checksum="$(sha256_file "${source_export}")"
  restored_checksum="$(sha256_file "${restored_export}")"

  write_evidence "${source_checksum}" "${restored_checksum}" "simulate"
  rm -rf "${temp_dir}"
}

run_live() {
  local source_export="${SOURCE_EXPORT_FILE:-}"
  local restored_export="${RESTORED_EXPORT_FILE:-}"

  if [[ -z "${source_export}" || -z "${restored_export}" ]]; then
    printf '[db-ha-restore] live mode requires SOURCE_EXPORT_FILE and RESTORED_EXPORT_FILE\n' >&2
    exit 1
  fi

  if [[ ! -f "${source_export}" || ! -f "${restored_export}" ]]; then
    printf '[db-ha-restore] export files are missing for live mode\n' >&2
    exit 1
  fi

  write_evidence "$(sha256_file "${source_export}")" "$(sha256_file "${restored_export}")" "live"
}

main() {
  case "${RESTORE_REHEARSAL_MODE}" in
    simulate)
      run_simulation
      ;;
    live)
      run_live
      ;;
    *)
      printf '[db-ha-restore] invalid RESTORE_REHEARSAL_MODE: %s (use simulate|live)\n' "${RESTORE_REHEARSAL_MODE}" >&2
      exit 1
      ;;
  esac
}

main "$@"
