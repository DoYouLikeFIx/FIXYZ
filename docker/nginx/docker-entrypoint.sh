#!/usr/bin/env bash
set -euo pipefail

: "${EDGE_SERVER_NAME:=localhost}"
: "${EDGE_TLS_CERT_PATH:=/etc/nginx/certs/tls.crt}"
: "${EDGE_TLS_KEY_PATH:=/etc/nginx/certs/tls.key}"
: "${EDGE_NGINX_TEMPLATE:=/etc/nginx/templates/fixyz-edge.conf.template}"
: "${EDGE_TRUSTED_PROXY_CIDR_1:=127.0.0.1/32}"
: "${EDGE_TRUSTED_PROXY_CIDR_2:=::1/128}"
: "${DMZ_TEMP_DENYLIST_MAP_PATH:=/etc/nginx/conf.d/dmz-temp-denylist.map}"
: "${DMZ_TEMP_DENYLIST_STATE_PATH:=/var/lib/nginx/dmz-temp-denylist.tsv}"

: "${CHANNEL_SERVICE_HOST:=channel-service}"
: "${CHANNEL_SERVICE_PORT:=8080}"
: "${CHANNEL_SERVICE_HEALTH_PORT:=18080}"
: "${COREBANK_SERVICE_HOST:=corebank-service}"
: "${COREBANK_SERVICE_PORT:=8081}"
: "${FEP_GATEWAY_HOST:=fep-gateway}"
: "${FEP_GATEWAY_PORT:=8083}"
: "${FEP_SIMULATOR_HOST:=fep-simulator}"
: "${FEP_SIMULATOR_PORT:=8082}"

mkdir -p "$(dirname "${EDGE_TLS_CERT_PATH}")"
mkdir -p "$(dirname "${DMZ_TEMP_DENYLIST_MAP_PATH}")" "$(dirname "${DMZ_TEMP_DENYLIST_STATE_PATH}")"
if [[ ! -s "${EDGE_TLS_CERT_PATH}" || ! -s "${EDGE_TLS_KEY_PATH}" ]]; then
  /usr/local/bin/generate-dev-cert.sh "${EDGE_SERVER_NAME}" "${EDGE_TLS_CERT_PATH}" "${EDGE_TLS_KEY_PATH}"
fi
if [[ ! -f "${DMZ_TEMP_DENYLIST_MAP_PATH}" ]]; then
  cat > "${DMZ_TEMP_DENYLIST_MAP_PATH}" <<'EOF'
# Auto-generated denylist map. Format: "<ip> 1;"
EOF
fi
touch "${DMZ_TEMP_DENYLIST_STATE_PATH}"
/usr/local/bin/dmz-temp-denylist.sh sweep >/dev/null 2>&1 || true

envsubst '${EDGE_SERVER_NAME} ${EDGE_TLS_CERT_PATH} ${EDGE_TLS_KEY_PATH} ${EDGE_TRUSTED_PROXY_CIDR_1} ${EDGE_TRUSTED_PROXY_CIDR_2} ${CHANNEL_SERVICE_HOST} ${CHANNEL_SERVICE_PORT} ${CHANNEL_SERVICE_HEALTH_PORT} ${COREBANK_SERVICE_HOST} ${COREBANK_SERVICE_PORT} ${FEP_GATEWAY_HOST} ${FEP_GATEWAY_PORT} ${FEP_SIMULATOR_HOST} ${FEP_SIMULATOR_PORT}' \
  < "${EDGE_NGINX_TEMPLATE}" \
  > /etc/nginx/conf.d/fixyz-edge.conf

exec "$@"
