#!/usr/bin/env bash
# Driver: mssql
# Strategy: export every user table to CSV via BCP, bundle as tar → stdout.
# Note: This is a logical/data backup. For schema+data .bacpac exports,
#       consider sqlpackage (https://learn.microsoft.com/en-us/sql/tools/sqlpackage).
set -euo pipefail

: "${MSSQL_HOST:?MSSQL_HOST is required}"
: "${MSSQL_USER:?MSSQL_USER is required}"
: "${MSSQL_PASSWORD:?MSSQL_PASSWORD is required}"
: "${MSSQL_DATABASE:?MSSQL_DATABASE is required}"

PORT="${MSSQL_PORT:-1433}"
SERVER="${MSSQL_HOST},${PORT}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# ─── Fetch table list ──────────────────────────────────────────────────────────
TABLES=$(sqlcmd \
    -S "$SERVER" \
    -U "$MSSQL_USER" \
    -P "$MSSQL_PASSWORD" \
    -d "$MSSQL_DATABASE" \
    -C \
    -h -1 -W \
    -Q "SET NOCOUNT ON; \
        SELECT SCHEMA_NAME(schema_id) + '.' + name \
        FROM sys.objects \
        WHERE type = 'U' \
        ORDER BY name" \
    2>/dev/null | grep -v '^$' | head -n -2) \
    || { echo "ERROR: could not list tables" >&2; exit 1; }

# Write metadata
{
    echo "MSSQL Backup"
    echo "Server  : ${MSSQL_HOST}"
    echo "Database: ${MSSQL_DATABASE}"
    echo "Date    : $(date -u +'%Y-%m-%d %H:%M:%S UTC')"
    echo ""
    echo "Tables  :"
    echo "$TABLES"
} > "${TMPDIR}/backup_info.txt"

# ─── Export each table ────────────────────────────────────────────────────────
mkdir -p "${TMPDIR}/data"
ERROR_LOG="${TMPDIR}/errors.txt"

while IFS= read -r TABLE; do
    [ -z "$TABLE" ] && continue
    SAFE=$(echo "$TABLE" | tr '.' '_' | tr -cd '[:alnum:]_')
    bcp "${MSSQL_DATABASE}.${TABLE}" out "${TMPDIR}/data/${SAFE}.csv" \
        -S "$SERVER" \
        -U "$MSSQL_USER" \
        -P "$MSSQL_PASSWORD" \
        -c -t ',' -r '\n' \
        2>/dev/null \
        || echo "Failed: $TABLE" >> "$ERROR_LOG"
done <<< "$TABLES"

tar -cf - -C "$TMPDIR" .
