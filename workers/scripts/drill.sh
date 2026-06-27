#!/usr/bin/env bash
# drill.sh — automated restore drill.
# Restores an archive into an ephemeral scratch database, checks it holds real
# data (tables + rows), then drops it. Proves a backup is *restorable*, not just
# present. Supports postgres and mysql; other drivers are skipped.
#
#   DRILL_FILE set  → drill that one archive (the per-version "Drill" button);
#                     fetched from the remote first if it isn't local.
#   DRILL_FILE unset→ drill the newest archive of each drillable driver (auto).
#
# Each outcome is reported to the hub so the version gets a Verified/Failed badge.
set -uo pipefail

readonly LOG_PREFIX="drill"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly TS="$(date +%Y%m%d_%H%M%S)"

source /usr/local/bin/lib.sh

newest_archive() {
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "*_${1}_*.zip" 2>/dev/null | sort | tail -1
}

extract_cmd() {
    if [ -n "${BACKUP_PASSWORD:-}" ]; then echo "unzip -P ${BACKUP_PASSWORD} -p"; else echo "unzip -p"; fi
}

driver_of() {
    case "$1" in
        *_postgres_*) echo postgres ;;
        *_mysql_*)    echo mysql ;;
        *_mssql_*)    echo mssql ;;
        *_minio_*)    echo minio ;;
        *)            echo "" ;;
    esac
}

# Tell the hub how the drill of one archive went (updates its badge + toast).
report_drill() {  # file ok(true|false) tables rows msg
    local agent_id; agent_id=$(hub_agent_id)
    [ -z "$agent_id" ] && return 0
    [ -z "${JOB_ID:-}" ] && return 0
    [ -z "${HUB_URL:-}" ] && return 0
    local body
    body=$(jq -nc --arg a "$agent_id" --arg j "$JOB_ID" --arg f "$1" \
        --argjson ok "$2" --argjson t "${3:-0}" --argjson r "${4:-0}" --arg m "${5:-}" \
        '{agentId:$a,jobId:$j,fileName:$f,ok:$ok,tables:$t,rows:$r,message:$m}')
    curl -fsS --max-time 20 -X POST "${HUB_URL}/api/agents/drill-result" \
        -H "X-Hub-Token: ${HUB_TOKEN}" -H "Content-Type: application/json" -d "$body" >/dev/null 2>&1 \
        || log "drill-result POST failed"
}

# Globals set by the drill_* functions.
DR_MSG=""; DR_TABLES=0; DR_ROWS=0

drill_postgres() {  # file
    local file="$1"
    : "${PG_HOST:?PG_HOST is required}" "${PG_USER:?}" "${PG_DATABASE:?}"
    export PGPASSWORD="${PG_PASSWORD:-}"
    local maint="${DRILL_MAINT_DB:-postgres}"
    local scratch="drill_${PG_DATABASE}_${TS}"
    local base=(psql --host="$PG_HOST" --port="${PG_PORT:-5432}" --username="$PG_USER" --no-password -v ON_ERROR_STOP=1)

    "${base[@]}" -d "$maint" -c "CREATE DATABASE \"${scratch}\";" >/dev/null 2>&1 \
        || { DR_MSG="cannot create scratch DB (needs CREATE privilege)"; return 1; }
    drop() { "${base[@]}" -d "$maint" -c "DROP DATABASE IF EXISTS \"${scratch}\";" >/dev/null 2>&1 || true; }

    if ! $(extract_cmd) "$file" | "${base[@]}" -d "$scratch" >/dev/null 2>&1; then
        drop; DR_MSG="restore into scratch DB failed"; return 1
    fi
    "${base[@]}" -d "$scratch" -c "ANALYZE;" >/dev/null 2>&1 || true

    local tables rows
    tables=$("${base[@]}" -d "$scratch" -tAc \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');" 2>/dev/null) || tables=0
    rows=$("${base[@]}" -d "$scratch" -tAc \
        "SELECT coalesce(sum(n_live_tup),0)::bigint FROM pg_stat_user_tables;" 2>/dev/null) || rows=0
    drop

    tables=${tables//[^0-9]/}; rows=${rows//[^0-9]/}
    [ "${tables:-0}" -gt 0 ] || { DR_MSG="restored DB has no tables"; return 1; }
    DR_TABLES="${tables:-0}"; DR_ROWS="${rows:-0}"; return 0
}

drill_mysql() {  # file
    local file="$1"
    : "${MYSQL_HOST:?MYSQL_HOST is required}" "${MYSQL_USER:?}" "${MYSQL_DATABASE:?}"
    export MYSQL_PWD="${MYSQL_PASSWORD:-}"
    local scratch="drill_${MYSQL_DATABASE}_${TS}"
    local base=(mysql --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" --user="$MYSQL_USER")

    "${base[@]}" -e "CREATE DATABASE \`${scratch}\`;" >/dev/null 2>&1 \
        || { DR_MSG="cannot create scratch DB (needs CREATE privilege)"; return 1; }
    drop() { "${base[@]}" -e "DROP DATABASE IF EXISTS \`${scratch}\`;" >/dev/null 2>&1 || true; }

    if ! $(extract_cmd) "$file" | "${base[@]}" "$scratch" >/dev/null 2>&1; then
        drop; DR_MSG="restore into scratch DB failed"; return 1
    fi

    local tables rows
    tables=$("${base[@]}" -N -e \
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='${scratch}';" 2>/dev/null) || tables=0
    rows=$("${base[@]}" -N -e \
        "SELECT coalesce(sum(table_rows),0) FROM information_schema.tables WHERE table_schema='${scratch}';" 2>/dev/null) || rows=0
    drop

    tables=${tables//[^0-9]/}; rows=${rows//[^0-9]/}
    [ "${tables:-0}" -gt 0 ] || { DR_MSG="restored DB has no tables"; return 1; }
    DR_TABLES="${tables:-0}"; DR_ROWS="${rows:-0}"; return 0
}

log "=========================================="
log "Restore drill started"

# Build the list of archive filenames to drill.
targets=()
if [ -n "${DRILL_FILE:-}" ]; then
    targets=("$(basename "${DRILL_FILE}")")
else
    IFS='-' read -ra DRIVERS <<< "${BACKUP_DRIVER:-postgres}"
    for d in "${DRIVERS[@]}"; do
        case "$d" in
            postgres|mysql) f=$(newest_archive "$d"); [ -n "$f" ] && targets+=("$(basename "$f")") ;;
        esac
    done
fi

OK_ALL=1; ANY=0; SUMMARY=""

for name in "${targets[@]}"; do
    [ -n "$name" ] || continue
    driver=$(driver_of "$name")
    if [ -z "$driver" ]; then log "Unknown driver for ${name} — skipping"; continue; fi
    if [ "$driver" != postgres ] && [ "$driver" != mysql ]; then
        log "Skipping drill for '${driver}' (only postgres/mysql can be drilled)"
        continue
    fi

    local_file="${BACKUP_DIR}/${name}"
    fetched=0
    if [ ! -f "$local_file" ] && [ -n "${RCLONE_REMOTE:-}" ]; then
        log "Fetching ${name} from remote for drill…"
        if rclone --config "${RCLONE_CONFIG}" copy "${RCLONE_REMOTE}:${RCLONE_PATH:-}/${name}" "${BACKUP_DIR}/" >/dev/null 2>&1; then
            fetched=1
        fi
    fi
    if [ ! -f "$local_file" ]; then
        log "Archive ${name} not available (local or remote)"
        report_drill "$name" false 0 0 "archive not available"
        OK_ALL=0; ANY=1; continue
    fi

    ANY=1
    DR_MSG=""; DR_TABLES=0; DR_ROWS=0
    if [ "$driver" = postgres ]; then drill_postgres "$local_file"; rc=$?; else drill_mysql "$local_file"; rc=$?; fi

    if [ "$rc" -eq 0 ]; then
        log "${driver} drill OK — ${DR_TABLES} table(s), ${DR_ROWS} row(s) ✓  [${name}]"
        report_drill "$name" true "$DR_TABLES" "$DR_ROWS" ""
        SUMMARY="${SUMMARY}${SUMMARY:+, }${driver}: ${DR_TABLES}t/${DR_ROWS}r"
    else
        log "${driver} drill FAILED — ${DR_MSG}  [${name}]"
        report_drill "$name" false 0 0 "${DR_MSG}"
        OK_ALL=0
        SUMMARY="${SUMMARY}${SUMMARY:+, }${driver}: FAILED"
    fi

    # Don't let a drill-only fetch disturb local retention.
    [ "$fetched" -eq 1 ] && rm -f "$local_file" 2>/dev/null || true
done

log "=========================================="

if [ "$ANY" -eq 0 ]; then
    # An on-demand drill (DRILL_FILE set) of a non-drillable driver is a no-op.
    # But a SCHEDULED drill that expected a postgres/mysql archive and found none
    # means backups have stopped being produced — surface it instead of a silent
    # success, or a backup gap goes unnoticed until a real restore is attempted.
    if [ -z "${DRILL_FILE:-}" ] && [[ "${BACKUP_DRIVER:-}" =~ (postgres|mysql) ]]; then
        log "No database archive found to drill — backups may have stopped"
        notify error "Restore drill: no database backup found to verify — backups may have stopped"
        hub_report 3 2 0 "Restore drill: no backup archive to verify (backups may have stopped)" || true
        exit 1
    fi
    log "No drillable archive — nothing to verify"
    exit 0
fi

if [ "$OK_ALL" -eq 1 ]; then
    state_set LAST_DRILL "$(date +%s)"
    notify success "Restore drill passed (${SUMMARY})"
    hub_report 3 1 0 "Restore drill passed (${SUMMARY})" || true
else
    notify error "Restore drill FAILED (${SUMMARY})"
    hub_report 3 2 0 "Restore drill failed (${SUMMARY})" || true
fi
