#!/usr/bin/env bash
set -euo pipefail

readonly LOG_PREFIX="backup"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly COMPRESSION_LEVEL="${COMPRESSION_LEVEL:-6}"
readonly PROJECT_NAME="${PROJECT_NAME:-backup}"

source /usr/local/bin/lib.sh

run_backup() {
    local driver="$1"
    local timestamp; timestamp=$(date +%Y%m%d_%H%M%S)
    local name="${PROJECT_NAME}_${driver}_${timestamp}"
    local outfile="${BACKUP_DIR}/${name}.zip"
    local driver_script="/usr/local/bin/drivers/${driver}.sh"

    [ -f "$driver_script" ] || error_exit "Driver not found: ${driver}.sh"

    log "──────────────────────────────────────────"
    log "Driver  : ${driver}"
    log "Output  : ${name}.zip"

    if [ -n "${BACKUP_PASSWORD:-}" ]; then
        log "Encryption: enabled"
        "$driver_script" \
            | zip -j -"${COMPRESSION_LEVEL}" -P "${BACKUP_PASSWORD}" -q "${outfile}" - \
            || error_exit "Backup failed (driver: ${driver})"
    else
        "$driver_script" \
            | zip -j -"${COMPRESSION_LEVEL}" -q "${outfile}" - \
            || error_exit "Backup failed (driver: ${driver})"
    fi

    local size; size=$(du -sh "$outfile" 2>/dev/null | cut -f1)
    log "Done    : ${name}.zip  (${size})"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

log "=========================================="
log "Backup started"

mkdir -p "$BACKUP_DIR"

IFS='-' read -ra DRIVERS <<< "${BACKUP_DRIVER:-postgres}"
for driver in "${DRIVERS[@]}"; do
    run_backup "$driver"
done

state_set LAST_BACKUP "$(date +%s)"
log "State updated"
log "Backup finished"
log "=========================================="

# Upload ergashuvchi — o'z scheduli yo'q bo'lsa darhol ishga tushiradi
# (upload.sh o'zi cleanup ni ham chaqiradi agar cleanup scheduli yo'q bo'lsa)
if [ -z "${UPLOAD_SCHEDULE:-}" ]; then
    /usr/local/bin/upload.sh
fi