#!/usr/bin/env sh
set -eu

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_INTERNAL_SECRET_PATH="${VAULT_INTERNAL_SECRET_PATH:-secret/fix/shared/core-services/internal-secret}"
VAULT_RUNTIME_ROLE_ID="${VAULT_RUNTIME_ROLE_ID:-${VAULT_ROLE_ID:-}}"
VAULT_RUNTIME_SECRET_ID="${VAULT_RUNTIME_SECRET_ID:-${VAULT_SECRET_ID:-}}"
OUTPUT_MODE="${1:-value}"
VAULT_LOCAL_CONTAINER_NAME="${VAULT_LOCAL_CONTAINER_NAME:-}"

usage() {
  cat <<'EOF'
Usage:
  read-internal-secret.sh [value|--export|--help]

Credential priority:
  1) VAULT_RUNTIME_ROLE_ID + VAULT_RUNTIME_SECRET_ID (AppRole login)
  2) VAULT_TOKEN
EOF
}

if [ "${OUTPUT_MODE}" = "--help" ]; then
  usage
  exit 0
fi

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

vault_token="$(resolve_vault_token)"
internal_secret="$(
  VAULT_TOKEN="${vault_token}" vault_exec kv get -field=value "${VAULT_INTERNAL_SECRET_PATH}"
)"

if [ "${OUTPUT_MODE}" = "--export" ]; then
  printf 'export INTERNAL_SECRET=%s\n' "${internal_secret}"
  exit 0
fi

printf '%s\n' "${internal_secret}"
