#!/usr/bin/env bash
# run-job.sh JOB_ID PHASE
# Loads a hub-defined job's env file and runs one phase against it.
# PHASE: backup | upload | cleanup
set -euo pipefail

readonly LOG_PREFIX="job"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

job_id="${1:?Usage: run-job.sh <job-id> <phase>}"
phase="${2:-backup}"
env_file="${BACKUP_DIR}/jobs/${job_id}.env"

[ -f "$env_file" ] || error_exit "Job env not found for ${job_id}"

set -a
source "$env_file"
set +a
export JOB_ID="$job_id"

case "$phase" in
    backup)  export RUN_TYPE=0; exec /usr/local/bin/backup.sh ;;
    upload)  export RUN_TYPE=1; exec /usr/local/bin/upload.sh ;;
    cleanup) export RUN_TYPE=2; exec /usr/local/bin/cleanup.sh ;;
    *)       error_exit "Unknown phase: ${phase}" ;;
esac
