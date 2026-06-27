#!/usr/bin/env bash
# test-job.sh JOB_ID — check that the job's source and destination are reachable,
# then report a Test run event to the hub.
set -uo pipefail

readonly LOG_PREFIX="test"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

job_id="${1:?Usage: test-job.sh <job-id>}"
env_file="${BACKUP_DIR}/jobs/${job_id}.env"

[ -f "$env_file" ] || error_exit "Job env not found for ${job_id}"

set -a
source "$env_file"
set +a
export JOB_ID="$job_id"
export RUN_TYPE=5

ok=1
msg=""

# A job may bundle several sources (e.g. postgres-minio) — check EVERY driver,
# not just the first, so a broken source in a combined project is caught.
check_source() {  # driver
    case "$1" in
        postgres)
            if PGPASSWORD="${PG_PASSWORD:-}" pg_isready -h "${PG_HOST}" -p "${PG_PORT:-5432}" -U "${PG_USER}" >/dev/null 2>&1; then
                msg="${msg:+$msg; }postgres OK"
            else ok=0; msg="${msg:+$msg; }postgres unreachable"; fi ;;
        mysql)
            if mysqladmin --host="${MYSQL_HOST}" --port="${MYSQL_PORT:-3306}" --user="${MYSQL_USER}" --password="${MYSQL_PASSWORD:-}" ping >/dev/null 2>&1; then
                msg="${msg:+$msg; }mysql OK"
            else ok=0; msg="${msg:+$msg; }mysql unreachable"; fi ;;
        minio)
            if mc alias set _test "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" --api "${MINIO_API:-S3v4}" >/dev/null 2>&1 \
               && mc ls "_test/${MINIO_BUCKET}" >/dev/null 2>&1; then
                msg="${msg:+$msg; }minio OK"
            else ok=0; msg="${msg:+$msg; }minio unreachable"; fi
            mc alias remove _test >/dev/null 2>&1 || true ;;
        *) msg="${msg:+$msg; }${1} check skipped" ;;
    esac
}

IFS='-' read -ra DRIVERS <<< "${BACKUP_DRIVER:-postgres}"
for driver in "${DRIVERS[@]}"; do
    check_source "$driver"
done

if [ -n "${RCLONE_CONFIG:-}" ] && [ -f "${RCLONE_CONFIG}" ]; then
    if rclone --config "${RCLONE_CONFIG}" lsd "${RCLONE_REMOTE:-remote}:" >/dev/null 2>&1; then
        msg="${msg}; remote OK"
    else ok=0; msg="${msg}; remote unreachable"; fi
fi

if [ "$ok" = 1 ]; then
    log "Test OK — ${msg}"
    hub_report 5 1 0 "$msg" || true
    notify success "Connection test: ${msg}"
else
    log "Test FAILED — ${msg}"
    hub_report 5 2 0 "$msg" || true
    notify error "Connection test failed: ${msg}"
fi
