#!/usr/bin/env bash
set -euo pipefail

readonly LOG_PREFIX="entrypoint"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly CRONTAB_FILE=/etc/backup.crontab

source /usr/local/bin/lib.sh

setup_rclone() {
    local provided="${RCLONE_CONFIG:-/etc/rclone/rclone.conf}"
    # rclone refreshes OAuth tokens by writing config to a temp file then renaming
    # it into place — which FAILS on a single-file bind mount (you can't rename
    # over a bind-mounted inode). So we always work from a writable in-container
    # copy. The host file can safely be mounted read-only.
    local active="/etc/rclone-active/rclone.conf"
    mkdir -p "$(dirname "$active")"

    if [ -f "$provided" ]; then
        cp "$provided" "$active"
        chmod 600 "$active"
        export RCLONE_CONFIG="$active"
        log "Rclone: config loaded ($provided → writable copy)"
    elif [ -n "${RCLONE_CONFIG_CONTENT:-}" ]; then
        printf '%s' "$RCLONE_CONFIG_CONTENT" > "$active"
        chmod 600 "$active"
        export RCLONE_CONFIG="$active"
        log "Rclone: config loaded from RCLONE_CONFIG_CONTENT"
    else
        log "WARNING: No rclone config — uploads will be skipped"
        return 0
    fi

    # Fail loud, fail early: if the remote is unreachable at startup (expired /
    # revoked token), tell the operator NOW instead of silently at 02:00.
    if [ -n "${RCLONE_REMOTE:-}" ]; then
        if rclone --config "$active" lsd "${RCLONE_REMOTE}:" >/dev/null 2>&1; then
            log "Rclone: remote '${RCLONE_REMOTE}' reachable ✓"
        else
            log "WARNING: remote '${RCLONE_REMOTE}' NOT reachable — token may be expired/revoked"
            notify error "Rclone remote '${RCLONE_REMOTE}' unreachable at startup — auth/token likely invalid. Backups will be created but NOT uploaded until fixed."
        fi
    fi
}

format_ts() {
    local ts="$1"
    [ "$ts" -eq 0 ] && echo "never" && return
    date -d "@${ts}" +'%Y-%m-%d %H:%M:%S' 2>/dev/null \
        || date -r "${ts}" +'%Y-%m-%d %H:%M:%S' 2>/dev/null \
        || echo "unknown"
}

is_overdue() {
    local last="$1" schedule="$2"
    local current; current=$(date +%s)
    local interval; interval=$(cron_to_seconds "$schedule")
    [ "$last" -eq 0 ] && return 0
    [ "$current" -ge $(( last + interval )) ] && return 0
    return 1
}

check_missed() {
    local current; current=$(date +%s)

    local last_backup;  last_backup=$(state_get  LAST_BACKUP  0)
    local last_upload;  last_upload=$(state_get  LAST_UPLOAD  0)
    local last_cleanup; last_cleanup=$(state_get LAST_CLEANUP 0)

    local backup_schedule="${BACKUP_SCHEDULE:-0 2 * * *}"
    local upload_schedule="${UPLOAD_SCHEDULE:-}"
    local cleanup_schedule="${CLEANUP_SCHEDULE:-}"

    log "=========================================="
    log "Startup — checking missed tasks..."
    log "  Last backup  : $(format_ts "$last_backup")"
    log "  Last upload  : $(format_ts "$last_upload")"
    log "  Last cleanup : $(format_ts "$last_cleanup")"
    log "=========================================="

    # ── 1. Backup — har doim tekshiriladi ─────────────────────────────────────
    if is_overdue "$last_backup" "$backup_schedule"; then
        if [ "$last_backup" -eq 0 ]; then
            log "Backup: first run"
        else
            local overdue_min=$(( (current - last_backup - $(cron_to_seconds "$backup_schedule")) / 60 ))
            log "Backup: overdue by ~${overdue_min} min — running now"
        fi
        /usr/local/bin/backup.sh
        # backup.sh → upload.sh → cleanup.sh zanjirini o'zi hal qiladi
        # (agar independent schedule berilmagan bo'lsa)
        # Ammo independent schedule bo'lsa backup.sh upload ni chaqirmaydi —
        # shuning uchun quyida upload va cleanup ham tekshiriladi
    else
        local next_min=$(( (last_backup + $(cron_to_seconds "$backup_schedule") - current) / 60 ))
        log "Backup: on schedule (next in ~${next_min} min)"
    fi

    # ── 2. Upload — mustaqil schedule bo'lsa tekshiriladi ─────────────────────
    # Ergashuvchi bo'lsa (schedule bo'sh) backup.sh o'zi chaqirgan — bu yerda skip
    if [ -n "$upload_schedule" ]; then
        # State ni qayta o'qiymiz — backup.sh uni yangilagan bo'lishi mumkin
        last_upload=$(state_get LAST_UPLOAD 0)

        if is_overdue "$last_upload" "$upload_schedule"; then
            if [ "$last_upload" -eq 0 ]; then
                log "Upload: never ran — running now"
            else
                local overdue_min=$(( (current - last_upload - $(cron_to_seconds "$upload_schedule")) / 60 ))
                log "Upload: overdue by ~${overdue_min} min — running now"
            fi
            /usr/local/bin/upload.sh
        else
            local next_min=$(( (last_upload + $(cron_to_seconds "$upload_schedule") - current) / 60 ))
            log "Upload: on schedule (next in ~${next_min} min)"
        fi
    fi

    # ── 3. Cleanup — mustaqil schedule bo'lsa tekshiriladi ────────────────────
    if [ -n "$cleanup_schedule" ]; then
        # State ni qayta o'qiymiz
        last_cleanup=$(state_get LAST_CLEANUP 0)

        if is_overdue "$last_cleanup" "$cleanup_schedule"; then
            if [ "$last_cleanup" -eq 0 ]; then
                log "Cleanup: never ran — running now"
            else
                local overdue_min=$(( (current - last_cleanup - $(cron_to_seconds "$cleanup_schedule")) / 60 ))
                log "Cleanup: overdue by ~${overdue_min} min — running now"
            fi
            /usr/local/bin/cleanup.sh
        else
            local next_min=$(( (last_cleanup + $(cron_to_seconds "$cleanup_schedule") - current) / 60 ))
            log "Cleanup: on schedule (next in ~${next_min} min)"
        fi
    fi

    log "=========================================="
}

setup_cron() {
    local backup_schedule="${BACKUP_SCHEDULE:-0 2 * * *}"
    local upload_schedule="${UPLOAD_SCHEDULE:-}"
    local cleanup_schedule="${CLEANUP_SCHEDULE:-}"

    log "Configuring schedules..."

    {
        echo "${backup_schedule} /usr/local/bin/backup.sh"
        [ -n "$upload_schedule" ]  && echo "${upload_schedule} /usr/local/bin/upload.sh"
        [ -n "$cleanup_schedule" ] && echo "${cleanup_schedule} /usr/local/bin/cleanup.sh"
    } > "$CRONTAB_FILE"

    log "  Backup  : ${backup_schedule}"
    [ -n "$upload_schedule" ]  && log "  Upload  : ${upload_schedule} (independent)" \
                               || log "  Upload  : runs after each backup"
    [ -n "$cleanup_schedule" ] && log "  Cleanup : ${cleanup_schedule} (independent)" \
                               || log "  Cleanup : runs after each upload"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

log "=========================================="
log "  Universal Backup Service"
log "  Driver  : ${BACKUP_DRIVER:-unknown}"
log "  Project : ${PROJECT_NAME:-backup}"
log "  TZ      : ${TZ:-UTC}"
log "=========================================="

mkdir -p "$BACKUP_DIR"
setup_rclone
check_missed
setup_cron

log "Starting scheduler (supercronic)..."
log "=========================================="

exec supercronic "$CRONTAB_FILE"