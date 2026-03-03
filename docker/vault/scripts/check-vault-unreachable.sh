#!/usr/bin/env sh
set -eu

VAULT_READ_TIMEOUT_SECONDS="${VAULT_READ_TIMEOUT_SECONDS:-5}"
VAULT_FAILURE_MODE="${VAULT_FAILURE_MODE:-fail-fast}"
SERVICE_HEALTH_URL="${SERVICE_HEALTH_URL:-}"
VAULT_RESTART_WAIT_SECONDS="${VAULT_RESTART_WAIT_SECONDS:-60}"

if ! command -v docker >/dev/null 2>&1; then
  printf '%s\n' "ERROR: docker command is required for chaos drill." >&2
  exit 1
fi

if ! command -v timeout >/dev/null 2>&1; then
  printf '%s\n' "ERROR: timeout command is required for chaos drill." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "vault"; then
  printf '%s\n' "ERROR: running container 'vault' not found." >&2
  exit 1
fi

printf '%s\n' "[vault-chaos] stopping vault container"
docker stop vault >/dev/null

set +e
timeout "${VAULT_READ_TIMEOUT_SECONDS}" ./docker/vault/scripts/read-internal-secret.sh >/dev/null 2>&1
read_exit_code=$?
set -e

if [ "${read_exit_code}" -eq 0 ]; then
  printf '%s\n' "ERROR: secret read unexpectedly succeeded while Vault was stopped." >&2
  docker start vault >/dev/null
  exit 1
fi

printf '%s\n' "[vault-chaos] read failed as expected (exit=${read_exit_code})"

if [ -n "${SERVICE_HEALTH_URL}" ]; then
  set +e
  status_code="$(curl -sS -o /dev/null -w '%{http_code}' "${SERVICE_HEALTH_URL}")"
  curl_exit_code=$?
  set -e

  if [ "${curl_exit_code}" -ne 0 ]; then
    printf '%s\n' "[vault-chaos] service health probe failed (network/error) as expected for fail-fast mode"
  else
    printf '%s\n' "[vault-chaos] service health HTTP status=${status_code} mode=${VAULT_FAILURE_MODE}"
  fi
fi

printf '%s\n' "[vault-chaos] restarting vault + vault-init"
docker start vault >/dev/null

wait_for_vault_healthy() {
  elapsed=0
  while [ "${elapsed}" -lt "${VAULT_RESTART_WAIT_SECONDS}" ]; do
    container_state="$(docker inspect -f '{{.State.Status}}' vault 2>/dev/null || true)"
    if [ "${container_state}" != "running" ]; then
      sleep 1
      elapsed=$((elapsed + 1))
      continue
    fi

    health_state="$(
      docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' vault 2>/dev/null || true
    )"

    if [ "${health_state}" != "none" ] && [ "${health_state}" != "healthy" ]; then
      sleep 1
      elapsed=$((elapsed + 1))
      continue
    fi

    # Explicit readiness gate: Vault API must answer status from inside container namespace.
    if docker exec vault sh -lc 'VAULT_ADDR=http://127.0.0.1:8200 vault status >/dev/null 2>&1'; then
      return
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  printf '%s\n' "ERROR: vault did not become ready within ${VAULT_RESTART_WAIT_SECONDS}s." >&2
  exit 1
}

wait_for_vault_init_exit() {
  elapsed=0
  while [ "${elapsed}" -lt "${VAULT_RESTART_WAIT_SECONDS}" ]; do
    state="$(docker inspect -f '{{.State.Status}}' vault-init 2>/dev/null || true)"
    if [ "${state}" = "exited" ]; then
      code="$(docker inspect -f '{{.State.ExitCode}}' vault-init 2>/dev/null || true)"
      if [ "${code}" != "0" ]; then
        printf '%s\n' "ERROR: vault-init exited with code ${code}." >&2
        exit 1
      fi
      return
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  printf '%s\n' "ERROR: vault-init did not exit successfully within ${VAULT_RESTART_WAIT_SECONDS}s." >&2
  exit 1
}

wait_for_vault_healthy

if docker ps -a --format '{{.Names}}' | grep -qx "vault-init"; then
  vault_init_state="$(docker inspect -f '{{.State.Status}}' vault-init 2>/dev/null || true)"
  if [ "${vault_init_state}" != "running" ]; then
    docker start vault-init >/dev/null
  fi
  wait_for_vault_init_exit
  wait_for_vault_healthy
fi

printf '%s\n' "[vault-chaos] completed: fallback behavior should match mode=${VAULT_FAILURE_MODE}"
