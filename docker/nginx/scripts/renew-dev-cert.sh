#!/usr/bin/env bash
set -euo pipefail

EDGE_SERVER_NAME="${EDGE_SERVER_NAME:-localhost}"
EDGE_TLS_CERT_PATH="${EDGE_TLS_CERT_PATH:-/etc/nginx/certs/tls.crt}"
EDGE_TLS_KEY_PATH="${EDGE_TLS_KEY_PATH:-/etc/nginx/certs/tls.key}"

/usr/local/bin/generate-dev-cert.sh "${EDGE_SERVER_NAME}" "${EDGE_TLS_CERT_PATH}" "${EDGE_TLS_KEY_PATH}"
nginx -s reload
