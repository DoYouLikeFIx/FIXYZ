#!/usr/bin/env sh
set -eu

MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
MYSQL_USER="${MYSQL_USER:-fix}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-fix}"
MYSQL_CONNECT_TIMEOUT_SECONDS="${MYSQL_CONNECT_TIMEOUT_SECONDS:-60}"

log() {
  printf '[mysql-grant-repair] %s\n' "$*"
}

deadline="$(( $(date +%s) + MYSQL_CONNECT_TIMEOUT_SECONDS ))"
while :; do
  if mysqladmin ping \
    -h"${MYSQL_HOST}" \
    -P"${MYSQL_PORT}" \
    -uroot \
    -p"${MYSQL_ROOT_PASSWORD}" \
    --silent >/dev/null 2>&1; then
    break
  fi

  if [ "$(date +%s)" -ge "${deadline}" ]; then
    log "MySQL did not become ready within ${MYSQL_CONNECT_TIMEOUT_SECONDS}s"
    exit 1
  fi

  sleep 2
done

log "Reconciling service databases and grants"
mysql \
  -h"${MYSQL_HOST}" \
  -P"${MYSQL_PORT}" \
  -uroot \
  -p"${MYSQL_ROOT_PASSWORD}" <<EOSQL
CREATE DATABASE IF NOT EXISTS channel_db;
CREATE DATABASE IF NOT EXISTS core_db;
CREATE DATABASE IF NOT EXISTS fep_gateway_db;
CREATE DATABASE IF NOT EXISTS fep_simulator_db;
CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'%' IDENTIFIED BY '${MYSQL_PASSWORD}';
GRANT ALL PRIVILEGES ON channel_db.* TO '${MYSQL_USER}'@'%';
GRANT ALL PRIVILEGES ON core_db.* TO '${MYSQL_USER}'@'%';
GRANT ALL PRIVILEGES ON fep_gateway_db.* TO '${MYSQL_USER}'@'%';
GRANT ALL PRIVILEGES ON fep_simulator_db.* TO '${MYSQL_USER}'@'%';
FLUSH PRIVILEGES;
EOSQL

log "Grant repair completed"
