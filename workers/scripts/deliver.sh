#!/usr/bin/env bash
# deliver.sh JOB_ID FILE
# Uploads a backup archive from the agent to the hub so the browser can download
# it. Pulls the file from the remote first if it isn't present locally.
set -uo pipefail

readonly LOG_PREFIX="deliver"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

job_id="${1:?Usage: deliver.sh <job-id> <file>}"
file=$(basename "${2:?file required}")   # bare filename only — no path traversal
env_file="${BACKUP_DIR}/jobs/${job_id}.env"

[ -f "$env_file" ] || error_exit "Job env not found for ${job_id}"

set -a
source "$env_file"
set +a

target="${BACKUP_DIR}/${file}"
if [ ! -f "$target" ]; then
    log "Archive not local — pulling from remote: ${file}"
    rclone --config "${RCLONE_CONFIG}" copy \
        "${RCLONE_REMOTE:-remote}:${RCLONE_PATH:-}/${file}" "$BACKUP_DIR" 2>/dev/null \
        || error_exit "Could not fetch ${file} from remote"
fi
[ -f "$target" ] || error_exit "Archive not found: ${file}"

log "Uploading ${file} to hub for download…"
curl -fsS --max-time 300 -X POST "${HUB_URL}/api/agents/artifact-upload" \
    -H "X-Hub-Token: ${HUB_TOKEN}" \
    -F "jobId=${job_id}" -F "fileName=${file}" -F "file=@${target}" \
    >/dev/null 2>&1 \
    && log "Delivered ${file}" \
    || log "Delivery failed for ${file}"
