#!/usr/bin/env bash
set -euo pipefail

readonly LOG_PREFIX="upload"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly RCLONE_CONFIG="${RCLONE_CONFIG:-/etc/rclone/rclone.conf}"
readonly RCLONE_REMOTE="${RCLONE_REMOTE:-}"
readonly RCLONE_PATH="${RCLONE_PATH:-}"
readonly MAX_REMOTE_BACKUPS="${MAX_REMOTE_BACKUPS:-30}"

source /usr/local/bin/lib.sh

upload_pending() {
    if [ -z "$RCLONE_REMOTE" ] || [ -z "$RCLONE_PATH" ]; then
        log "Rclone not configured — skipping"
        return 0
    fi

    if ! find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" -print -quit 2>/dev/null | grep -q .; then
        log "No backup files found in ${BACKUP_DIR}"
        return 0
    fi

    local last_upload; last_upload=$(state_get LAST_UPLOAD 0)

    log "Destination : ${RCLONE_REMOTE}:${RCLONE_PATH}"
    if [ "$last_upload" -gt 0 ]; then
        log "Last upload : $(date -d "@${last_upload}" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "unknown")"
    else
        log "Last upload : never"
    fi

    local uploaded=0 failed=0 total_bytes=0

    while IFS= read -r file; do
        local filename; filename=$(basename "$file")
        local file_ts; file_ts=$(stat -c%Y "$file" 2>/dev/null || stat -f%m "$file" 2>/dev/null || echo 0)

        if [ "$file_ts" -le "$last_upload" ]; then
            log "Skip (already uploaded): ${filename}"
            continue
        fi

        local size; size=$(du -sh "$file" 2>/dev/null | cut -f1)
        log "Uploading: ${filename}  (${size})"

        if rclone copy \
            --config "$RCLONE_CONFIG" \
            --no-update-modtime \
            --retries 3 \
            --low-level-retries 5 \
            --quiet \
            "$file" "${RCLONE_REMOTE}:${RCLONE_PATH}" 2>/dev/null; then
            log "Uploaded : ${filename}"
            (( uploaded++ )) || true
            local bytes; bytes=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
            (( total_bytes += bytes )) || true
        else
            log "FAILED   : ${filename}"
            (( failed++ )) || true
        fi
    done < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.zip" | sort)

    if [ "$uploaded" -gt 0 ]; then
        local total_mb=$(( total_bytes / 1024 / 1024 ))
        log "Summary: uploaded ${uploaded} file(s) — ${total_mb} MB"
        state_set LAST_UPLOAD "$(date +%s)"
        prune_remote
    else
        log "No new files to upload"
    fi

    [ "$failed" -gt 0 ] && log "WARNING: ${failed} file(s) failed — will retry on next run" || true
}

prune_remote() {
    local max="${MAX_REMOTE_BACKUPS:-0}"
    [ "$max" -le 0 ] && return 0

    log "Remote retention check (max: ${max} per driver)..."

    # Remote dagi barcha fayllarni ol
    local all_files
    all_files=$(rclone lsf \
        --config "$RCLONE_CONFIG" \
        "${RCLONE_REMOTE}:${RCLONE_PATH}" \
        --include "*.zip" \
        2>/dev/null | sort) || { log "WARNING: Could not list remote files"; return 0; }

    if [ -z "$all_files" ]; then
        log "No remote files found"
        return 0
    fi

    # Driver nomlarini topish (postgres, minio, va hokazo)
    local drivers
    drivers=$(echo "$all_files" | sed 's/.*_\([^_]*\)_[0-9]\{8\}_[0-9]\{6\}\.zip/\1/' | sort -u)

    while IFS= read -r driver; do
        [ -z "$driver" ] && continue

        # Shu driver uchun fayllarni fil
        local driver_files
        driver_files=$(echo "$all_files" | grep "_${driver}_" | sort)

        local count; count=$(echo "$driver_files" | grep -c '[^[:space:]]' || echo 0)

        if [ "$count" -le "$max" ]; then
            log "Remote [$driver]: ${count}/${max} — within limit"
            continue
        fi

        local to_delete=$(( count - max ))
        log "Remote [$driver]: ${count} — removing ${to_delete} oldest file(s)"

        local deleted=0
        while IFS= read -r f; do
            [ -z "$f" ] && continue
            [ "$deleted" -ge "$to_delete" ] && break
            log "Deleting remote: ${f}"
            rclone deletefile \
                --config "$RCLONE_CONFIG" \
                "${RCLONE_REMOTE}:${RCLONE_PATH}/${f}" \
                2>/dev/null && log "Deleted: ${f}" || log "WARNING: Could not delete: ${f}"
            (( deleted++ )) || true
        done <<< "$driver_files"

    done <<< "$drivers"
}

log "=========================================="
log "Upload started"
upload_pending
log "Upload finished"
log "=========================================="

# Cleanup ergashuvchi — schedule berilmagan bo'lsa o'zi chaqiradi
if [ -z "${CLEANUP_SCHEDULE:-}" ]; then
    /usr/local/bin/cleanup.sh
fi