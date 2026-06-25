#!/usr/bin/env bash
# restore-job.sh JOB_ID FILE SNAPSHOT
# Restores a chosen backup version into the live DB (rollback). If SNAPSHOT is
# true, the current state is backed up first so the rollback is itself undoable.
# Pulls the archive from the remote if it isn't present locally.
set -uo pipefail

readonly LOG_PREFIX="restore"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

job_id="${1:?Usage: restore-job.sh <job-id> <file> <snapshot>}"
file="${2:?file required}"
snapshot="${3:-false}"
env_file="${BACKUP_DIR}/jobs/${job_id}.env"

[ -f "$env_file" ] || error_exit "Job env not found for ${job_id}"

set -a
source "$env_file"
set +a
export JOB_ID="$job_id"
export RUN_TYPE=4

log "=========================================="
log "Restore requested: ${file}  (snapshot-first: ${snapshot})"

if [ "$snapshot" = "true" ] || [ "$snapshot" = "1" ]; then
    log "Snapshotting current state before rollback…"
    UPLOAD_SCHEDULE="" /usr/local/bin/backup.sh || error_exit "Pre-restore snapshot failed"
fi

target="${BACKUP_DIR}/${file}"
if [ ! -f "$target" ]; then
    log "Archive not local — pulling from remote…"
    rclone --config "${RCLONE_CONFIG}" copy \
        "${RCLONE_REMOTE:-remote}:${RCLONE_PATH:-}/${file}" "$BACKUP_DIR" 2>/dev/null \
        || error_exit "Could not fetch ${file} from remote"
fi
[ -f "$target" ] || error_exit "Archive not found after fetch: ${file}"

driver="${BACKUP_DRIVER%%-*}"
case "$file" in
    *_postgres_*) driver=postgres ;;
    *_mysql_*)    driver=mysql ;;
esac

/usr/local/bin/restore.sh "$driver" "$target" || error_exit "Restore failed for ${file}"

log "Restore complete: ${file}"
log "=========================================="

hub_report 4 1 0 "Restored ${file}" || true
notify success "Restored backup version: ${file}"
/usr/local/bin/inventory.sh || true
