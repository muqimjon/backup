#!/usr/bin/env bash
# Driver: mysql  (works for MySQL and MariaDB)
# Output: SQL dump to stdout (piped to zip by backup.sh)
set -euo pipefail

: "${MYSQL_HOST:?MYSQL_HOST is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"

# mysqldump accepts password via env var MYSQL_PWD
export MYSQL_PWD="${MYSQL_PASSWORD:-}"

exec mysqldump \
    --host="${MYSQL_HOST}" \
    --port="${MYSQL_PORT:-3306}" \
    --user="${MYSQL_USER}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --set-gtid-purged=OFF \
    "${MYSQL_DATABASE}"
