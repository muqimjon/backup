#!/usr/bin/env bash
# delete-artifact.sh JOB_ID FILENAME
# Removes one backup archive locally and from the remote, then re-inventories so
# the hub's version list updates. Used to drop a drill-failed archive that should
# not keep occupying a retention slot.
set -uo pipefail

readonly LOG_PREFIX="delete"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

job_id="${1:?Usage: delete-artifact.sh <job-id> <filename>}"
fname="${2:?filename required}"
env_file="${BACKUP_DIR}/jobs/${job_id}.env"

[ -f "$env_file" ] || error_exit "Job env not found for ${job_id}"
set -a; source "$env_file"; set +a
export JOB_ID="$job_id"

# Only a bare archive name — never a path (no traversal).
case "$fname" in
    */*|"") error_exit "Invalid filename: ${fname}" ;;
esac

removed=0
if [ -f "${BACKUP_DIR}/${fname}" ]; then
    rm -f "${BACKUP_DIR}/${fname}" && { log "Deleted local ${fname}"; removed=1; }
fi

if [ -n "${RCLONE_REMOTE:-}" ]; then
    if rclone --config "${RCLONE_CONFIG}" deletefile "${RCLONE_REMOTE}:${RCLONE_PATH:-}/${fname}" >/dev/null 2>&1; then
        log "Deleted remote ${fname}"; removed=1
    else
        log "Remote ${fname} not found (already gone?)"
    fi
fi

[ "$removed" -eq 1 ] || log "Nothing to delete for ${fname}"

# Refresh the hub's version list so the row disappears immediately.
/usr/local/bin/inventory.sh || true
