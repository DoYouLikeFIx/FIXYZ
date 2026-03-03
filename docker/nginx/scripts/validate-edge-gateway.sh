#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "${ROOT_DIR}"

BASE_URL="${EDGE_BASE_URL:-https://localhost}"
COMPOSE_FILE="${EDGE_COMPOSE_FILE:-docker-compose.yml}"

if [[ "${SKIP_COMPOSE_UP:-0}" != "1" ]]; then
  docker compose -f "${COMPOSE_FILE}" up -d edge-gateway
fi

# nginx -t

docker compose -f "${COMPOSE_FILE}" exec -T edge-gateway nginx -t

# Route smoke checks
for route in \
  "/health/channel" \
  "/health/corebank" \
  "/health/fep-gateway" \
  "/health/fep-simulator"; do
  code="$(curl -k -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${route}")"
  if [[ "${code}" != "200" ]]; then
    echo "Route smoke failed for ${route}, status=${code}" >&2
    exit 1
  fi
done

# Security-header verification
headers="$(curl -k -sS -D - -o /dev/null "${BASE_URL}/health/channel")"
for header in \
  "Strict-Transport-Security" \
  "X-Content-Type-Options" \
  "X-Frame-Options"; do
  if ! grep -qi "^${header}:" <<<"${headers}"; then
    echo "Missing security header: ${header}" >&2
    exit 1
  fi
done

# TLS certificate chain and expiry
cert_dates="$(echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -dates)"
if ! grep -q "notAfter=" <<<"${cert_dates}"; then
  echo "TLS certificate inspection failed" >&2
  exit 1
fi

# SSE/EventStream
if ! docker compose -f "${COMPOSE_FILE}" exec -T edge-gateway sh -c "nginx -T 2>/dev/null | grep -q 'location /api/v1/channel/notifications/stream'"; then
  echo "SSE location not configured" >&2
  exit 1
fi
if ! docker compose -f "${COMPOSE_FILE}" exec -T edge-gateway sh -c "nginx -T 2>/dev/null | grep -q 'proxy_buffering off'"; then
  echo "SSE buffering policy missing" >&2
  exit 1
fi

# Unhealthy upstream behavior
probe_code="$(curl -k -sS -o /tmp/edge-unhealthy.json -w '%{http_code}' "${BASE_URL}/_edge/upstream-probe")"
if [[ "${probe_code}" != "503" ]]; then
  echo "Unhealthy upstream probe expected 503, got ${probe_code}" >&2
  exit 1
fi
if ! grep -q 'EDGE_UPSTREAM_UNAVAILABLE' /tmp/edge-unhealthy.json; then
  echo "Unhealthy upstream response payload mismatch" >&2
  exit 1
fi

echo "Edge gateway validation passed"
