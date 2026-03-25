#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "${ROOT_DIR}"

BASE_URL="${EDGE_BASE_URL:-https://127.0.0.1}"
COMPOSE_FILE="${EDGE_COMPOSE_FILE:-docker-compose.yml}"
TLS_HOST="${EDGE_TLS_HOST:-}"
TLS_PORT="${EDGE_TLS_PORT:-}"
TLS_SERVERNAME="${EDGE_TLS_SERVERNAME:-}"
need_channel_service_restart=0

tmp_dir="$(mktemp -d)"
rendered_conf=""
channel_service_was_running=0

cleanup() {
  if [[ "${need_channel_service_restart}" == "1" && "${channel_service_was_running}" == "1" ]]; then
    docker compose -f "${COMPOSE_FILE}" up -d channel-service >/dev/null 2>&1 || true
  fi
  rm -rf "${tmp_dir}"
}

trap cleanup EXIT

canonical_runtime_checks=(
  "GET /api/v1/auth/csrf edge-unhealthy-auth-csrf"
  "POST /api/v1/auth/register edge-unhealthy-auth-register"
  "POST /api/v1/auth/login edge-unhealthy-auth-login"
  "GET /api/v1/auth/session edge-unhealthy-auth-session"
  "POST /api/v1/auth/logout edge-unhealthy-auth-logout"
  "POST /api/v1/auth/otp/verify edge-unhealthy-auth-otp-verify"
  "POST /api/v1/auth/password/forgot edge-unhealthy-auth-password-forgot"
  "POST /api/v1/auth/password/forgot/challenge edge-unhealthy-auth-password-challenge"
  "POST /api/v1/auth/password/forgot/challenge/fail-closed edge-unhealthy-auth-password-challenge-fail-closed"
  "POST /api/v1/auth/password/reset edge-unhealthy-auth-password-reset"
  "POST /api/v1/auth/mfa-recovery/rebind edge-unhealthy-auth-mfa-recovery-rebind"
  "POST /api/v1/auth/mfa-recovery/rebind/confirm edge-unhealthy-auth-mfa-recovery-rebind-confirm"
  "POST /api/v1/members/me/totp/enroll edge-unhealthy-member-totp-enroll"
  "POST /api/v1/members/me/totp/confirm edge-unhealthy-member-totp-confirm"
  "POST /api/v1/members/me/totp/rebind edge-unhealthy-member-totp-rebind"
  "POST /api/v1/orders/sessions edge-unhealthy-order-create"
  "GET /api/v1/orders/sessions/example edge-unhealthy-order-status"
  "POST /api/v1/orders/sessions/example/otp/verify edge-unhealthy-order-otp-verify"
  "POST /api/v1/orders/sessions/example/extend edge-unhealthy-order-extend"
  "POST /api/v1/orders/sessions/example/execute edge-unhealthy-order-execute"
  "GET /api/v1/notifications edge-unhealthy-notification-list"
  "PATCH /api/v1/notifications/example/read edge-unhealthy-notification-read"
  "GET /api/v1/notifications/stream edge-unhealthy-notification-stream"
)

fail() {
  echo "$1" >&2
  exit 1
}

curl_status() {
  local route="$1"
  local output_file="$2"
  local method="${3:-GET}"
  curl -k -sS -X "${method}" -o "${output_file}" -w '%{http_code}' "${BASE_URL}${route}"
}

assert_status() {
  local route="$1"
  local expected_status="$2"
  local output_file="$3"
  local method="${4:-GET}"
  local status
  status="$(curl_status "${route}" "${output_file}" "${method}")"
  if [[ "${status}" != "${expected_status}" ]]; then
    fail "Unexpected status for ${method} ${route}: expected ${expected_status}, got ${status}"
  fi
}

assert_body_contains() {
  local file_path="$1"
  local expected="$2"
  if ! grep -q "${expected}" "${file_path}"; then
    fail "Response body missing ${expected}: ${file_path}"
  fi
}

assert_rendered_conf_contains() {
  local expected="$1"
  if ! grep -Fq "${expected}" <<<"${rendered_conf}"; then
    fail "Rendered nginx config missing: ${expected}"
  fi
}

assert_headers_contain() {
  local file_path="$1"
  local expected="$2"
  if ! grep -Fqi "${expected}" "${file_path}"; then
    fail "Response headers missing ${expected}: ${file_path}"
  fi
}

assert_json_field_present() {
  local file_path="$1"
  local field_name="$2"
  if ! grep -Eq "\"${field_name}\":\"[^\"]+\"" "${file_path}"; then
    fail "Response body missing JSON field ${field_name}: ${file_path}"
  fi
}

assert_runtime_proxy_contract() {
  local headers_file="$1"
  local body_file="$2"
  local cookies_file="$3"
  local token
  local header_name
  local transport_status

  assert_headers_contain "${headers_file}" "Set-Cookie: SESSION="
  assert_headers_contain "${headers_file}" "X-Correlation-Id:"
  assert_headers_contain "${headers_file}" "traceparent:"
  assert_json_field_present "${body_file}" "token"
  assert_json_field_present "${body_file}" "headerName"

  token="$(grep -o '"token":"[^"]*' "${body_file}" | head -n1 | sed 's/"token":"//')"
  header_name="$(grep -o '"headerName":"[^"]*' "${body_file}" | head -n1 | sed 's/"headerName":"//')"

  if [[ -z "${token}" || -z "${header_name}" ]]; then
    fail "Unable to extract CSRF transport fields from ${body_file}"
  fi

  transport_status="$(
    curl -k -sS \
      -b "${cookies_file}" \
      -H "${header_name}: ${token}" \
      -H "Content-Type: application/json" \
      -o "${tmp_dir}/csrf-transport-register.json" \
      -w '%{http_code}' \
      -X POST \
      "${BASE_URL}/api/v1/auth/register" \
      --data '{}'
  )"

  if [[ "${transport_status}" == "403" ]]; then
    fail "CSRF bootstrap transport was not preserved for POST /api/v1/auth/register"
  fi
}

base_no_scheme="${BASE_URL#*://}"
base_authority="${base_no_scheme%%/*}"

if [[ -z "${TLS_HOST}" || -z "${TLS_PORT}" ]]; then
  if [[ "${base_authority}" =~ ^\[(.*)\]:(.+)$ ]]; then
    parsed_host="${BASH_REMATCH[1]}"
    parsed_port="${BASH_REMATCH[2]}"
  elif [[ "${base_authority}" =~ ^\[(.*)\]$ ]]; then
    parsed_host="${BASH_REMATCH[1]}"
    parsed_port="443"
  elif [[ "${base_authority}" == *:* ]]; then
    parsed_host="${base_authority%:*}"
    parsed_port="${base_authority##*:}"
  else
    parsed_host="${base_authority}"
    parsed_port="443"
  fi

  TLS_HOST="${TLS_HOST:-${parsed_host}}"
  TLS_PORT="${TLS_PORT:-${parsed_port}}"
fi

if [[ -z "${TLS_SERVERNAME}" ]]; then
  TLS_SERVERNAME="${TLS_HOST}"
fi

if [[ "${SKIP_COMPOSE_UP:-0}" != "1" ]]; then
  for required_env in \
    VAULT_DEV_ROOT_TOKEN_ID \
    INTERNAL_SECRET_BOOTSTRAP \
    INTERNAL_SECRET; do
    if [[ -z "${!required_env:-}" ]]; then
      fail "Missing required environment variable ${required_env} for docker compose bootstrap"
    fi
  done
  docker compose -f "${COMPOSE_FILE}" up -d edge-gateway channel-service
fi

# nginx -t
docker compose -f "${COMPOSE_FILE}" exec -T edge-gateway nginx -t
rendered_conf="$(docker compose -f "${COMPOSE_FILE}" exec -T edge-gateway sh -lc 'nginx -T 2>/dev/null')"

# Route smoke checks
assert_status "/health/channel" "200" "${tmp_dir}/health-channel.json"
csrf_headers_file="${tmp_dir}/auth-csrf.headers"
csrf_cookies_file="${tmp_dir}/auth-csrf.cookies"
csrf_status="$(
  curl -k -sS \
    -D "${csrf_headers_file}" \
    -c "${csrf_cookies_file}" \
    -o "${tmp_dir}/auth-csrf.json" \
    -w '%{http_code}' \
    "${BASE_URL}/api/v1/auth/csrf"
)"
if [[ "${csrf_status}" != "200" ]]; then
  fail "Unexpected status for GET /api/v1/auth/csrf: expected 200, got ${csrf_status}"
fi
assert_runtime_proxy_contract "${csrf_headers_file}" "${tmp_dir}/auth-csrf.json" "${csrf_cookies_file}"

for expected_route in \
  "location = /api/v1/auth/csrf" \
  "location = /api/v1/members/me/totp/rebind" \
  "location = /api/v1/orders/sessions" \
  "location ~ ^/api/v1/orders/sessions/[^/]+/otp/verify$" \
  "location = /api/v1/notifications" \
  "location = /api/v1/notifications/stream" \
  "location ~ ^/api/v1/notifications/[^/]+/read$"; do
  assert_rendered_conf_contains "${expected_route}"
done

# Deterministic deny checks
for denied_health_route in \
  "/health/corebank" \
  "/health/fep-gateway" \
  "/health/fep-simulator"; do
  deny_file_name="$(basename "${denied_health_route}")"
  assert_status "${denied_health_route}" "403" "${tmp_dir}/${deny_file_name}.json"
  assert_body_contains "${tmp_dir}/${deny_file_name}.json" "EDGE_INTERNAL_NAMESPACE_DENIED"
done

assert_status "/api/v1/channel/notifications/stream" "404" "${tmp_dir}/deny-legacy-alias.json"
assert_body_contains "${tmp_dir}/deny-legacy-alias.json" "EDGE_ROUTE_NOT_ALLOWED"

for denied_namespace_route in \
  "/api/v1/corebank/example" \
  "/api/v1/fep/example" \
  "/_edge/example" \
  "/internal/example" \
  "/admin/example" \
  "/api/v1/admin/example" \
  "/ops/dmz/example"; do
  deny_file_name="${denied_namespace_route#/}"
  deny_file_name="${deny_file_name//\//-}"
  assert_status "${denied_namespace_route}" "403" "${tmp_dir}/${deny_file_name}.json"
  assert_body_contains "${tmp_dir}/${deny_file_name}.json" "EDGE_INTERNAL_NAMESPACE_DENIED"
done

assert_status "/api/v1/auth/csrf" "404" "${tmp_dir}/deny-method.json" "POST"
assert_body_contains "${tmp_dir}/deny-method.json" "EDGE_METHOD_NOT_ALLOWED"

assert_status "/health/channel" "404" "${tmp_dir}/health-channel-method-deny.json" "POST"
assert_body_contains "${tmp_dir}/health-channel-method-deny.json" "EDGE_METHOD_NOT_ALLOWED"

assert_status "/health/channel" "404" "${tmp_dir}/health-channel-options-deny.json" "OPTIONS"
assert_body_contains "${tmp_dir}/health-channel-options-deny.json" "EDGE_METHOD_NOT_ALLOWED"

assert_status "/%ZZ" "400" "${tmp_dir}/malformed-encoding.html"
assert_body_contains "${tmp_dir}/malformed-encoding.html" "400 Bad Request"

# Security-header verification
headers="$(curl -k -sS -D - -o /dev/null "${BASE_URL}/health/channel")"
for header in \
  "Strict-Transport-Security" \
  "X-Content-Type-Options" \
  "X-Frame-Options"; do
  if ! grep -qi "^${header}:" <<<"${headers}"; then
    fail "Missing security header: ${header}"
  fi
done

# TLS certificate chain and expiry
cert_dates="$(
  echo \
    | openssl s_client -connect "${TLS_HOST}:${TLS_PORT}" -servername "${TLS_SERVERNAME}" 2>/dev/null \
    | openssl x509 -noout -dates
)"
if ! grep -q "notAfter=" <<<"${cert_dates}"; then
  fail "TLS certificate inspection failed"
fi

# SSE/EventStream
for expected_snippet in \
  "proxy_set_header Host \$host" \
  "proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for" \
  "proxy_set_header X-Forwarded-Proto https" \
  "proxy_set_header X-Request-Id \$request_id" \
  "location = /api/v1/notifications/stream" \
  "proxy_buffering off" \
  "proxy_read_timeout 3600s" \
  "proxy_set_header Connection \"\""; do
  assert_rendered_conf_contains "${expected_snippet}"
done

# Unhealthy upstream behavior
if docker compose -f "${COMPOSE_FILE}" ps --status running channel-service 2>/dev/null | grep -q "channel-service"; then
  channel_service_was_running=1
fi
docker compose -f "${COMPOSE_FILE}" stop channel-service >/dev/null # stop channel-service
need_channel_service_restart=1

for runtime_check in "${canonical_runtime_checks[@]}"; do
  method="${runtime_check%% *}"
  remainder="${runtime_check#* }"
  route="${remainder%% *}"
  file_stem="${remainder##* }"
  assert_status "${route}" "503" "${tmp_dir}/${file_stem}.json" "${method}"
  assert_body_contains "${tmp_dir}/${file_stem}.json" "EDGE_UPSTREAM_UNAVAILABLE"
done

if [[ "${channel_service_was_running}" == "1" ]]; then
  docker compose -f "${COMPOSE_FILE}" up -d channel-service >/dev/null
fi
need_channel_service_restart=0
channel_service_was_running=0

echo "Edge gateway validation passed"
