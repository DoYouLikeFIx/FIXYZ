#!/usr/bin/env bash
set -euo pipefail

: "${EDGE_SERVER_NAME:=localhost}"
: "${EDGE_TLS_CERT_PATH:=/etc/nginx/certs/tls.crt}"
: "${EDGE_TLS_KEY_PATH:=/etc/nginx/certs/tls.key}"

: "${CHANNEL_SERVICE_HOST:=channel-service}"
: "${CHANNEL_SERVICE_PORT:=8080}"
: "${COREBANK_SERVICE_HOST:=corebank-service}"
: "${COREBANK_SERVICE_PORT:=8081}"
: "${FEP_GATEWAY_HOST:=fep-gateway}"
: "${FEP_GATEWAY_PORT:=8083}"
: "${FEP_SIMULATOR_HOST:=fep-simulator}"
: "${FEP_SIMULATOR_PORT:=8082}"

mkdir -p "$(dirname "${EDGE_TLS_CERT_PATH}")"
if [[ ! -s "${EDGE_TLS_CERT_PATH}" || ! -s "${EDGE_TLS_KEY_PATH}" ]]; then
  /usr/local/bin/generate-dev-cert.sh "${EDGE_SERVER_NAME}" "${EDGE_TLS_CERT_PATH}" "${EDGE_TLS_KEY_PATH}"
fi

envsubst '${EDGE_SERVER_NAME} ${EDGE_TLS_CERT_PATH} ${EDGE_TLS_KEY_PATH} ${CHANNEL_SERVICE_HOST} ${CHANNEL_SERVICE_PORT} ${COREBANK_SERVICE_HOST} ${COREBANK_SERVICE_PORT} ${FEP_GATEWAY_HOST} ${FEP_GATEWAY_PORT} ${FEP_SIMULATOR_HOST} ${FEP_SIMULATOR_PORT}' \
  < /etc/nginx/templates/fixyz-edge.conf.template \
  > /etc/nginx/conf.d/fixyz-edge.conf

exec "$@"
