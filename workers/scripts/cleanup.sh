#!/usr/bin/env bash
set -euo pipefail

readonly LOG_PREFIX="cleanup"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly MIN_LOCAL_BACKUPS="${MIN_LOCAL_BACKUPS:-2}"
readonly MAX_LOCAL_BACKUPS="${MAX_LOCAL_BACKUPS:-5}"

source /usr/local/bin/lib.sh

# Retention is applied PER DRIVER, not over a flat pool. With multiple sources
# (e.g. postgres + minio) a flat pool sorts "*_minio_*" before "*_postgres_*"
# alphabetically and would silently delete every minio backup first. Per-driver
# limits keep MIN/MAX of EACH source, so the two stay paired by timestamp.

# All driver names present among the local *.zip files.
list_drivers() {
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" -exec basename {} \; 2>/dev/null \
        | sed 's/.*_\([^_]*\)_[0-9]\{8\}_[0-9]\{6\}\.zip/\1/' \
        | sort -u
}

# Files for one driver, oldest → newest (timestamp is in the filename).
driver_files() {
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "*_${1}_*.zip" | sort
}

cleanup_driver() {
    local driver="$1" last_upload="$2"
    local files; files=$(driver_files "$driver")
    local count; count=$(printf '%s\n' "$files" | grep -c '[^[:space:]]' || echo 0)
    [ "$count" -eq 0 ] && return 0

    log "── [$driver] ${count} file(s)  (min=${MIN_LOCAL_BACKUPS} max=${MAX_LOCAL_BACKUPS})"
    local deleted=0

    # ── Hard cap: count > MAX → delete oldest regardless of upload status ──
    if [ "$count" -gt "$MAX_LOCAL_BACKUPS" ]; then
        local to_delete=$(( count - MAX_LOCAL_BACKUPS ))
        log "   exceeds max — removing ${to_delete} oldest"
        while IFS= read -r file; do
            [ -z "$file" ] && continue
            [ "$deleted" -ge "$to_delete" ] && break
            log "   removed (max-cap): $(basename "$file")"
            rm -f "$file"
            (( deleted++ )) || true
        done <<< "$files"
        files=$(driver_files "$driver")
        count=$(( count - deleted ))
    fi

    # ── Soft floor: keep MIN, remove only already-uploaded extras ──
    if [ "$count" -gt "$MIN_LOCAL_BACKUPS" ]; then
        if [ "$last_upload" -eq 0 ]; then
            log "   no uploads recorded yet — keeping all"
        else
            local to_check=$(( count - MIN_LOCAL_BACKUPS ))
            local removed=0
            while IFS= read -r file; do
                [ -z "$file" ] && continue
                [ "$removed" -ge "$to_check" ] && break
                local file_ts; file_ts=$(stat -c%Y "$file" 2>/dev/null \
                                         || stat -f%m "$file" 2>/dev/null \
                                         || echo 0)
                if [ "$file_ts" -le "$last_upload" ]; then
                    log "   removed (uploaded): $(basename "$file")"
                    rm -f "$file"
                    (( removed++ )) || true
                else
                    log "   kept (not yet uploaded): $(basename "$file")"
                fi
            done <<< "$files"
        fi
    fi
    return 0
}

cleanup_local() {
    local total; total=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" 2>/dev/null | wc -l)
    local last_upload; last_upload=$(state_get LAST_UPLOAD 0)

    log "=========================================="
    log "Local cleanup — ${total} file(s) total (per-driver retention)"

    if [ "$total" -eq 0 ]; then
        log "Nothing to clean up"
        log "=========================================="
        state_set LAST_CLEANUP "$(date +%s)"
        return 0
    fi

    while IFS= read -r driver; do
        [ -z "$driver" ] && continue
        cleanup_driver "$driver" "$last_upload"
    done <<< "$(list_drivers)"

    local remaining; remaining=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" 2>/dev/null | wc -l)
    log "Remaining   : ${remaining} file(s)"

    state_set LAST_CLEANUP "$(date +%s)"
    log "Cleanup done"
    log "=========================================="
}

cleanup_local

# Refresh the hub's version list after retention changes the local set
/usr/local/bin/inventory.sh || true
