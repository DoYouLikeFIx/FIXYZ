#!/usr/bin/env bash
set -euo pipefail

HOSTNAME_VALUE="${1:-localhost}"
CERT_PATH="${2:-/etc/nginx/certs/tls.crt}"
KEY_PATH="${3:-/etc/nginx/certs/tls.key}"

mkdir -p "$(dirname "${CERT_PATH}")"
openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -keyout "${KEY_PATH}" \
  -out "${CERT_PATH}" \
  -subj "/CN=${HOSTNAME_VALUE}"
