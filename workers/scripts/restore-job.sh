#!/usr/bin/env bash
# restore-job.sh JOB_ID TARGET SNAPSHOT
#
# Restores a project to a chosen point in time. TARGET is either:
#   • a VERSION key  (YYYYMMDD_HHMMSS) → restore EVERY source of the project for
#     that version together (postgres + minio …) — they are related data, so they
#     roll back as one consistent set. This is the normal, project-level restore.
#   • a single FILE (…_driver_….zip) → restore just that one archive (advanced,
#     per-source restore).
#
# If SNAPSHOT is true the current state is backed up first (a full combined
# backup), so the rollback is itself undoable. Missing archives are pulled from
# the remote.
set -uo pipefail

readonly LOG_PREFIX="restore"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

job_id="${1:?Usage: restore-job.sh <job-id> <version|file> <snapshot> [files-json]}"
# Strip any directory components so a crafted value can't escape (path traversal).
target=$(basename "${2:?version or file required}")
snapshot="${3:-false}"
# JSON array of the exact archive names the hub recorded for this version.
restore_files="${4:-[]}"
env_file="${BACKUP_DIR}/jobs/${job_id}.env"

[ -f "$env_file" ] || error_exit "Job env not found for ${job_id}"

set -a
source "$env_file"
set +a
export JOB_ID="$job_id"
export RUN_TYPE=4

# ── helpers ──────────────────────────────────────────────────────────────────
# Make sure an archive is present locally, pulling it from the remote if needed.
ensure_local() {  # filename → 0 if available, 1 if not found anywhere
    local f="$1"
    [ -f "${BACKUP_DIR}/${f}" ] && return 0
    if [ -n "${RCLONE_CONFIG:-}" ] && [ -f "${RCLONE_CONFIG}" ]; then
        log "Pulling ${f} from remote…"
        rclone --config "${RCLONE_CONFIG}" copy \
            "${RCLONE_REMOTE:-remote}:${RCLONE_PATH:-}/${f}" "$BACKUP_DIR" 2>/dev/null || true
    fi
    [ -f "${BACKUP_DIR}/${f}" ]
}

driver_of() {  # filename → driver name
    case "$1" in
        *_postgres_*) echo postgres ;;
        *_mysql_*)    echo mysql ;;
        *_mssql_*)    echo mssql ;;
        *_minio_*)    echo minio ;;
        *)            echo "${BACKUP_DRIVER%%-*}" ;;
    esac
}

restore_one() {  # filename → restore via its driver
    /usr/local/bin/restore.sh "$(driver_of "$1")" "${BACKUP_DIR}/${1}"
}

log "=========================================="
log "Restore requested: ${target}  (snapshot-first: ${snapshot})"

if [ "$snapshot" = "true" ] || [ "$snapshot" = "1" ]; then
    log "Snapshotting current state before rollback…"
    # Report a snapshot failure as a Backup (RUN_TYPE=0), then abort the restore
    # WITHOUT a second misleading "Restore failed" (live data left untouched).
    RUN_TYPE=0 UPLOAD_SCHEDULE="" /usr/local/bin/backup.sh \
        || { log "Pre-restore snapshot failed — aborting restore (live data untouched)"; exit 1; }
fi

# ── Project-level restore: TARGET is a version key ───────────────────────────
if [[ "$target" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
    log "Project restore → version ${target} (all sources together)"
    # The hub passes the exact archive names recorded for this version — use those
    # (not names rebuilt from the current project/source set, which drift when a
    # project is renamed or a source removed).
    mapfile -t files < <(printf '%s' "$restore_files" | jq -r '.[]? | select(. != "")' 2>/dev/null)
    [ "${#files[@]}" -gt 0 ] || error_exit "No archives recorded for version ${target}"

    # Restore object storage first, databases last, so when the DB comes back the
    # objects its rows reference already exist. A version is one consistent set:
    # if ANY recorded archive is unavailable, abort — a partial rollback would
    # leave the project's sources inconsistent and must never report success.
    minio_files=(); db_files=()
    for f in "${files[@]}"; do
        f=$(basename "$f")
        if [ "$(driver_of "$f")" = minio ]; then minio_files+=("$f"); else db_files+=("$f"); fi
    done
    for f in "${minio_files[@]}" "${db_files[@]}"; do
        ensure_local "$f" \
            || error_exit "Archive for version ${target} is unavailable: ${f} — restore aborted (a partial rollback would leave sources inconsistent)"
        restore_one "$f" || error_exit "Restore failed for ${f}"
    done
    summary="version ${target} (${#files[@]} source(s))"
else
    # ── Advanced: restore a single archive ───────────────────────────────────
    ensure_local "$target" || error_exit "Archive not found: ${target}"
    restore_one "$target" || error_exit "Restore failed for ${target}"
    summary="${target}"
fi

log "Restore complete: ${summary}"
log "=========================================="

hub_report 4 1 0 "Restored ${summary}" || true
notify success "Restored ${summary}"
/usr/local/bin/inventory.sh || true
