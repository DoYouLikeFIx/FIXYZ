#!/usr/bin/env bash
set -euo pipefail

HOSTNAME_VALUE="${1:-localhost}"
CERT_PATH="${2:-/etc/nginx/certs/tls.crt}"
KEY_PATH="${3:-/etc/nginx/certs/tls.key}"

if [[ "${HOSTNAME_VALUE}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  SAN_VALUE="DNS:localhost,IP:${HOSTNAME_VALUE},IP:127.0.0.1"
else
  SAN_VALUE="DNS:${HOSTNAME_VALUE},DNS:localhost,IP:127.0.0.1"
fi

mkdir -p "$(dirname "${CERT_PATH}")"
openssl req -x509 -nodes -newkey rsa:2048 -days 30 \
  -keyout "${KEY_PATH}" \
  -out "${CERT_PATH}" \
  -subj "/CN=${HOSTNAME_VALUE}" \
  -addext "subjectAltName=${SAN_VALUE}"
