#!/usr/bin/env sh
set -eu

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_INTERNAL_SECRET_PATH="${VAULT_INTERNAL_SECRET_PATH:-secret/fix/shared/core-services/internal-secret}"
VAULT_RUNTIME_ROLE_ID="${VAULT_RUNTIME_ROLE_ID:-${VAULT_ROLE_ID:-}}"
VAULT_RUNTIME_SECRET_ID="${VAULT_RUNTIME_SECRET_ID:-${VAULT_SECRET_ID:-}}"
ROTATION_ACTOR="${ROTATION_ACTOR:-manual-rotation-drill}"
NEW_SECRET_INPUT="${1:-}"
EVIDENCE_FILE="${EVIDENCE_FILE:-}"
VAULT_LOCAL_CONTAINER_NAME="${VAULT_LOCAL_CONTAINER_NAME:-}"

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
    return
  fi
  od -An -N24 -tx1 /dev/urandom | tr -d ' \n'
}

login_with_approle() {
  vault_exec write -field=token auth/approle/login \
    role_id="${VAULT_RUNTIME_ROLE_ID}" \
    secret_id="${VAULT_RUNTIME_SECRET_ID}"
}

resolve_vault_token() {
  if [ -n "${VAULT_RUNTIME_ROLE_ID}" ] && [ -n "${VAULT_RUNTIME_SECRET_ID}" ]; then
    login_with_approle
    return
  fi

  if [ -n "${VAULT_TOKEN:-}" ]; then
    printf '%s\n' "${VAULT_TOKEN}"
    return
  fi

  printf '%s\n' "ERROR: set AppRole credentials (VAULT_RUNTIME_ROLE_ID/VAULT_RUNTIME_SECRET_ID) or VAULT_TOKEN." >&2
  exit 1
}

vault_exec() {
  local_container_name="${VAULT_LOCAL_CONTAINER_NAME}"

  if command -v vault >/dev/null 2>&1; then
    if [ -n "${VAULT_TOKEN:-}" ]; then
      VAULT_ADDR="${VAULT_ADDR}" VAULT_TOKEN="${VAULT_TOKEN}" vault "$@"
    else
      VAULT_ADDR="${VAULT_ADDR}" vault "$@"
    fi
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    printf '%s\n' "ERROR: vault CLI not found and docker is unavailable." >&2
    exit 1
  fi

  if [ -z "${local_container_name}" ]; then
    if docker ps --format '{{.Names}}' | grep -qx "vault"; then
      local_container_name="vault"
    elif docker ps --format '{{.Names}}' | grep -qx "vault-external-dev"; then
      local_container_name="vault-external-dev"
    fi
  fi

  if [ -z "${local_container_name}" ]; then
    printf '%s\n' "ERROR: vault CLI missing and no running local Vault container was found (checked: vault, vault-external-dev)." >&2
    exit 1
  fi

  if [ -n "${VAULT_TOKEN:-}" ]; then
    docker exec -e VAULT_ADDR="http://127.0.0.1:8200" -e VAULT_TOKEN="${VAULT_TOKEN}" "${local_container_name}" vault "$@"
  else
    docker exec -e VAULT_ADDR="http://127.0.0.1:8200" "${local_container_name}" vault "$@"
  fi
}

new_secret="${NEW_SECRET_INPUT}"
if [ -z "${new_secret}" ]; then
  new_secret="$(generate_secret)"
fi

now_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
vault_token="$(resolve_vault_token)"

VAULT_TOKEN="${vault_token}" vault_exec kv put "${VAULT_INTERNAL_SECRET_PATH}" \
  value="${new_secret}" \
  rotated_at="${now_utc}" \
  rotated_by="${ROTATION_ACTOR}" >/dev/null

read_back="$(
  VAULT_TOKEN="${vault_token}" vault_exec kv get -field=value "${VAULT_INTERNAL_SECRET_PATH}"
)"

if [ "${read_back}" != "${new_secret}" ]; then
  printf '%s\n' "ERROR: rotation verification failed (read-back mismatch)." >&2
  exit 1
fi

if [ -n "${EVIDENCE_FILE}" ]; then
  mkdir -p "$(dirname "${EVIDENCE_FILE}")"
  {
    printf 'date_utc=%s\n' "${now_utc}"
    printf 'path=%s\n' "${VAULT_INTERNAL_SECRET_PATH}"
    printf 'actor=%s\n' "${ROTATION_ACTOR}"
    printf 'status=rotation_ok\n'
  } >> "${EVIDENCE_FILE}"
fi

printf '%s\n' "rotation_ok ${VAULT_INTERNAL_SECRET_PATH} ${now_utc}"
