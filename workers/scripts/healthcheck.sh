#!/usr/bin/env bash
# healthcheck.sh — Docker HEALTHCHECK probe.
# Reports the container UNHEALTHY when the last successful backup is too old,
# so an orchestrator (or your eyes in `docker ps`) catches a silently stuck
# scheduler. Grace = 2 backup intervals + 1h.
set -euo pipefail

readonly LOG_PREFIX="healthcheck"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

last_backup=$(state_get LAST_BACKUP 0)

# Never ran yet — still inside the startup grace window, treat as healthy.
[ "$last_backup" -eq 0 ] && { echo "OK: no backup recorded yet"; exit 0; }

now=$(date +%s)
interval=$(cron_to_seconds "${BACKUP_SCHEDULE:-0 2 * * *}")
max_age=$(( interval * 2 + 3600 ))
age=$(( now - last_backup ))

if [ "$age" -gt "$max_age" ]; then
    echo "UNHEALTHY: last backup ${age}s ago (limit ${max_age}s)"
    exit 1
fi

echo "OK: last backup ${age}s ago"
