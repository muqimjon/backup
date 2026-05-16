#!/usr/bin/env bash
set -euo pipefail

readonly LOG_PREFIX="cleanup"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly MIN_LOCAL_BACKUPS="${MIN_LOCAL_BACKUPS:-2}"
readonly MAX_LOCAL_BACKUPS="${MAX_LOCAL_BACKUPS:-5}"

source /usr/local/bin/lib.sh

cleanup_local() {
    local count; count=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" 2>/dev/null | wc -l)
    local last_upload; last_upload=$(state_get LAST_UPLOAD 0)

    log "=========================================="
    log "Local files : ${count}"
    log "Limits      : min=${MIN_LOCAL_BACKUPS}  max=${MAX_LOCAL_BACKUPS}"

    if [ "$count" -eq 0 ]; then
        log "Nothing to clean up"
        log "=========================================="
        state_set LAST_CLEANUP "$(date +%s)"
        return 0
    fi

    local deleted=0

    # ── Hard cap: count > MAX → delete oldest regardless of upload status ──
    if [ "$count" -gt "$MAX_LOCAL_BACKUPS" ]; then
        local to_delete=$(( count - MAX_LOCAL_BACKUPS ))
        log "Exceeds max — removing ${to_delete} oldest file(s)"

        while IFS= read -r file; do
            log "Removed (max-cap): $(basename "$file")"
            rm -f "$file"
            (( deleted++ )) || true
        done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" | sort | head -n "$to_delete")

        count=$(( count - deleted ))
    fi

    # ── Soft floor: keep MIN, remove uploaded extras ──
    if [ "$count" -gt "$MIN_LOCAL_BACKUPS" ]; then
        if [ "$last_upload" -eq 0 ]; then
            log "No uploads recorded yet — keeping all local files"
        else
            local to_check=$(( count - MIN_LOCAL_BACKUPS ))
            local removed=0

            while IFS= read -r file; do
                [ "$removed" -ge "$to_check" ] && break

                local file_ts; file_ts=$(stat -c%Y "$file" 2>/dev/null \
                                         || stat -f%m "$file" 2>/dev/null \
                                         || echo 0)

                if [ "$file_ts" -le "$last_upload" ]; then
                    log "Removed (uploaded): $(basename "$file")"
                    rm -f "$file"
                    (( deleted++ )) || true
                    (( removed++ )) || true
                else
                    log "Kept (not yet uploaded): $(basename "$file")"
                fi
            done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" | sort | head -n "$to_check")
        fi
    else
        log "File count at or below min — nothing removed"
    fi

    local remaining; remaining=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" 2>/dev/null | wc -l)
    [ "$deleted" -gt 0 ] && log "Removed ${deleted} file(s)"
    log "Remaining   : ${remaining} file(s)"

    state_set LAST_CLEANUP "$(date +%s)"
    log "Cleanup done"
    log "=========================================="
}

cleanup_local