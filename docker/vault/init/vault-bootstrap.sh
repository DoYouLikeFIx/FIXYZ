#!/usr/bin/env sh
set -eu

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
VAULT_TOKEN="${VAULT_TOKEN:?VAULT_TOKEN is required for bootstrap}"
INTERNAL_SECRET_BOOTSTRAP="${INTERNAL_SECRET_BOOTSTRAP:?INTERNAL_SECRET_BOOTSTRAP is required}"
GITHUB_OIDC_DISCOVERY_URL="${GITHUB_OIDC_DISCOVERY_URL:-https://token.actions.githubusercontent.com}"
GITHUB_OIDC_ISSUER="${GITHUB_OIDC_ISSUER:-https://token.actions.githubusercontent.com}"
GITHUB_OIDC_AUDIENCE="${GITHUB_OIDC_AUDIENCE:-https://github.com/DoYouLikeFIx}"
GITHUB_REPOSITORY_BOUND="${GITHUB_REPOSITORY_BOUND:-DoYouLikeFIx/FIXYZ}"
GITHUB_JOB_WORKFLOW_REF_GLOB="${GITHUB_JOB_WORKFLOW_REF_GLOB:-${GITHUB_REPOSITORY_BOUND}/.github/workflows/docs-publish.yml@*}"
VAULT_AUDIT_LOG_PATH="${VAULT_AUDIT_LOG_PATH:-/vault/file/audit.log}"
VAULT_RUNTIME_ROLE="${VAULT_RUNTIME_ROLE:-runtime-core-services}"
VAULT_ROTATION_ROLE="${VAULT_ROTATION_ROLE:-ops-rotate-internal-secret}"

export VAULT_ADDR
export VAULT_TOKEN

log() {
  printf '%s %s\n' "[vault-bootstrap]" "$*"
}

wait_for_vault() {
  attempts=0
  until vault status >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 90 ]; then
      log "Vault did not become ready in time"
      exit 1
    fi
    sleep 1
  done
}

enable_kv_v2() {
  if vault secrets list | awk '{print $1}' | grep -qx "secret/"; then
    log "KV mount secret/ already enabled"
    return
  fi
  vault secrets enable -path=secret kv-v2 >/dev/null
  log "Enabled KV v2 at secret/"
}

enable_audit_file() {
  if vault audit list | awk '{print $1}' | grep -qx "file/"; then
    log "Audit device file/ already enabled"
    return
  fi
  vault audit enable file "file_path=${VAULT_AUDIT_LOG_PATH}" >/dev/null
  log "Enabled file audit log at ${VAULT_AUDIT_LOG_PATH}"
}

write_policies() {
  vault policy write ci-docs-publish /vault/bootstrap/policies/ci-docs-publish.hcl >/dev/null
  vault policy write runtime-internal-secret /vault/bootstrap/policies/runtime-internal-secret.hcl >/dev/null
  vault policy write ops-rotation-internal-secret /vault/bootstrap/policies/ops-rotation-internal-secret.hcl >/dev/null
  log "Wrote policies: ci-docs-publish, runtime-internal-secret, ops-rotation-internal-secret"
}

write_initial_secret() {
  if vault kv get -field=value secret/fix/shared/core-services/internal-secret >/dev/null 2>&1; then
    log "Secret path already populated; skipping bootstrap seed"
    return
  fi

  now_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  vault kv put secret/fix/shared/core-services/internal-secret \
    value="${INTERNAL_SECRET_BOOTSTRAP}" \
    rotated_at="${now_utc}" \
    rotated_by="vault-bootstrap" >/dev/null
  log "Seeded secret/fix/shared/core-services/internal-secret"
}

configure_jwt_auth() {
  if ! vault auth list | awk '{print $1}' | grep -qx "jwt/"; then
    vault auth enable jwt >/dev/null
    log "Enabled auth method jwt/"
  fi

  vault write auth/jwt/config \
    oidc_discovery_url="${GITHUB_OIDC_DISCOVERY_URL}" \
    bound_issuer="${GITHUB_OIDC_ISSUER}" \
    default_role="ci-docs-publish" >/dev/null

  tmp_role_file="/tmp/ci-jwt-role.json"
  cat > "${tmp_role_file}" <<EOF
{
  "role_type": "jwt",
  "user_claim": "repository",
  "bound_audiences": "${GITHUB_OIDC_AUDIENCE}",
  "bound_claims_type": "glob",
  "bound_claims": {
    "repository": "${GITHUB_REPOSITORY_BOUND}",
    "job_workflow_ref": "${GITHUB_JOB_WORKFLOW_REF_GLOB}"
  },
  "token_policies": ["ci-docs-publish"],
  "token_ttl": "5m",
  "token_max_ttl": "15m"
}
EOF
  vault write auth/jwt/role/ci-docs-publish @"${tmp_role_file}" >/dev/null
  rm -f "${tmp_role_file}"
  log "Configured JWT role ci-docs-publish"
}

configure_approle_auth() {
  if ! vault auth list | awk '{print $1}' | grep -qx "approle/"; then
    vault auth enable approle >/dev/null
    log "Enabled auth method approle/"
  fi

  vault write "auth/approle/role/${VAULT_RUNTIME_ROLE}" \
    token_policies="runtime-internal-secret" \
    token_ttl="5m" \
    token_max_ttl="30m" \
    token_num_uses="50" \
    secret_id_ttl="24h" >/dev/null

  mkdir -p /vault/file
  vault read -field=role_id "auth/approle/role/${VAULT_RUNTIME_ROLE}/role-id" > /vault/file/runtime-role-id
  vault write -field=secret_id -f "auth/approle/role/${VAULT_RUNTIME_ROLE}/secret-id" > /vault/file/runtime-secret-id
  chmod 600 /vault/file/runtime-role-id /vault/file/runtime-secret-id

  vault write "auth/approle/role/${VAULT_ROTATION_ROLE}" \
    token_policies="ops-rotation-internal-secret" \
    token_ttl="5m" \
    token_max_ttl="15m" \
    token_num_uses="10" \
    secret_id_ttl="1h" >/dev/null
  vault read -field=role_id "auth/approle/role/${VAULT_ROTATION_ROLE}/role-id" > /vault/file/rotation-role-id
  vault write -field=secret_id -f "auth/approle/role/${VAULT_ROTATION_ROLE}/secret-id" > /vault/file/rotation-secret-id
  chmod 600 /vault/file/rotation-role-id /vault/file/rotation-secret-id

  log "Configured AppRole ${VAULT_RUNTIME_ROLE} + ${VAULT_ROTATION_ROLE} and wrote local dev credentials to /vault/file/"
}

main() {
  wait_for_vault
  enable_kv_v2
  enable_audit_file
  write_policies
  write_initial_secret
  configure_jwt_auth
  configure_approle_auth
  log "Vault bootstrap complete"
}

main "$@"
