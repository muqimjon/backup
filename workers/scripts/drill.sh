#!/usr/bin/env bash
# drill.sh — automated restore drill.
# Restores the newest archive into an ephemeral scratch database, checks it
# holds real data, then drops it. Proves a backup is *restorable*, not just present.
# Supports postgres and mysql; other drivers are skipped (reported, not failed).
set -uo pipefail

readonly LOG_PREFIX="drill"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly TS="$(date +%Y%m%d_%H%M%S)"

source /usr/local/bin/lib.sh

newest_archive() {
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "*_${1}_*.zip" 2>/dev/null | sort | tail -1
}

extract_cmd() {
    if [ -n "${BACKUP_PASSWORD:-}" ]; then
        echo "unzip -P ${BACKUP_PASSWORD} -p"
    else
        echo "unzip -p"
    fi
}

drill_postgres() {
    : "${PG_HOST:?PG_HOST is required}" "${PG_USER:?}" "${PG_DATABASE:?}"
    local file; file=$(newest_archive postgres)
    [ -n "$file" ] || error_exit "No postgres archive found to drill"

    export PGPASSWORD="${PG_PASSWORD:-}"
    local maint="${DRILL_MAINT_DB:-postgres}"
    local scratch="drill_${PG_DATABASE}_${TS}"
    local psql_base=(psql --host="$PG_HOST" --port="${PG_PORT:-5432}" --username="$PG_USER" --no-password -v ON_ERROR_STOP=1)

    log "Drilling postgres from $(basename "$file") → ${scratch}"
    "${psql_base[@]}" -d "$maint" -c "CREATE DATABASE \"${scratch}\";" >/dev/null \
        || error_exit "Could not create scratch database (needs CREATE privilege)"

    drop_pg() { "${psql_base[@]}" -d "$maint" -c "DROP DATABASE IF EXISTS \"${scratch}\";" >/dev/null 2>&1 || true; }

    if ! $(extract_cmd) "$file" | "${psql_base[@]}" -d "$scratch" >/dev/null 2>&1; then
        drop_pg; error_exit "Restore into scratch DB failed (postgres)"
    fi

    local tables
    tables=$("${psql_base[@]}" -d "$scratch" -tAc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');" 2>/dev/null) || tables=0
    drop_pg

    [ "${tables:-0}" -gt 0 ] || error_exit "Drill failed: restored postgres DB has no tables"
    log "postgres drill OK — ${tables} table(s) restored ✓"
    REPORT="postgres: ${tables} tables"
}

drill_mysql() {
    : "${MYSQL_HOST:?MYSQL_HOST is required}" "${MYSQL_USER:?}" "${MYSQL_DATABASE:?}"
    local file; file=$(newest_archive mysql)
    [ -n "$file" ] || error_exit "No mysql archive found to drill"

    export MYSQL_PWD="${MYSQL_PASSWORD:-}"
    local scratch="drill_${MYSQL_DATABASE}_${TS}"
    local my_base=(mysql --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" --user="$MYSQL_USER")

    log "Drilling mysql from $(basename "$file") → ${scratch}"
    "${my_base[@]}" -e "CREATE DATABASE \`${scratch}\`;" \
        || error_exit "Could not create scratch database (needs CREATE privilege)"

    drop_my() { "${my_base[@]}" -e "DROP DATABASE IF EXISTS \`${scratch}\`;" >/dev/null 2>&1 || true; }

    if ! $(extract_cmd) "$file" | "${my_base[@]}" "$scratch" >/dev/null 2>&1; then
        drop_my; error_exit "Restore into scratch DB failed (mysql)"
    fi

    local tables
    tables=$("${my_base[@]}" -N -e \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='${scratch}';" 2>/dev/null) || tables=0
    drop_my

    [ "${tables:-0}" -gt 0 ] || error_exit "Drill failed: restored mysql DB has no tables"
    log "mysql drill OK — ${tables} table(s) restored ✓"
    REPORT="mysql: ${tables} tables"
}

log "=========================================="
log "Restore drill started"

REPORT=""
DRILLED=0
IFS='-' read -ra DRIVERS <<< "${BACKUP_DRIVER:-postgres}"
for driver in "${DRIVERS[@]}"; do
    case "$driver" in
        postgres) drill_postgres; DRILLED=1 ;;
        mysql)    drill_mysql;    DRILLED=1 ;;
        *)        log "Skipping drill for '${driver}' (only postgres/mysql supported)" ;;
    esac
done

if [ "$DRILLED" -eq 0 ]; then
    log "No drillable driver — nothing to verify"
    log "=========================================="
    exit 0
fi

state_set LAST_DRILL "$(date +%s)"
log "Restore drill passed"
log "=========================================="

notify success "Restore drill passed (${REPORT})"
hub_report 3 1 0 "Restore drill passed (${REPORT})" || true
