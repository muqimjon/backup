#!/usr/bin/env bash
# agent.sh — BackupHub generic agent entrypoint.
# Registers with the hub, pulls its job list (→ supercronic crontab), and polls
# for one-off commands ("Run now"). All driven from the web UI — no env config
# of sources needed on the host.
set -uo pipefail

readonly LOG_PREFIX="agent"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly JOBS_DIR="${BACKUP_DIR}/jobs"
readonly CRONTAB_FILE=/tmp/agent.crontab
readonly POLL="${AGENT_POLL_INTERVAL:-20}"

source /usr/local/bin/lib.sh

mkdir -p "$JOBS_DIR"
CRON_PID=""

api() { curl -fsS --max-time 15 -H "X-Hub-Token: ${HUB_TOKEN}" "$@"; }

write_job_env() {
    local job="$1" jid engine host port user secret target rid rpath bp
    jid=$(echo "$job" | jq -r '.jobId')
    engine=$(echo "$job" | jq -r '.engine')
    host=$(echo "$job" | jq -r '.host')
    port=$(echo "$job" | jq -r '.port')
    user=$(echo "$job" | jq -r '.username')
    secret=$(echo "$job" | jq -r '.secret')
    target=$(echo "$job" | jq -r '.target')
    rid=$(echo "$job" | jq -r '.remoteId')
    rpath=$(echo "$job" | jq -r '.remotePath')
    bp=$(echo "$job" | jq -r '.backupPassword // empty')

    local conf="${JOBS_DIR}/${jid}.rclone.conf"
    api "${HUB_URL}/api/remotes/${rid}/rclone-conf" -o "$conf" 2>/dev/null \
        || log "rclone config fetch failed for job ${jid}"

    {
        echo "PROJECT_NAME=$(echo "$job" | jq -r '.name')"
        echo "RCLONE_CONFIG=${conf}"
        echo "RCLONE_REMOTE=remote"
        echo "RCLONE_PATH=${rpath}"
        echo "MIN_LOCAL_BACKUPS=$(echo "$job" | jq -r '.minLocalBackups')"
        echo "MAX_LOCAL_BACKUPS=$(echo "$job" | jq -r '.maxLocalBackups')"
        echo "MAX_REMOTE_BACKUPS=$(echo "$job" | jq -r '.maxRemoteBackups')"
        echo "COMPRESSION_LEVEL=$(echo "$job" | jq -r '.compressionLevel')"
        [ -n "$bp" ] && echo "BACKUP_PASSWORD=${bp}"
        case "$engine" in
            0) echo "BACKUP_DRIVER=postgres"; echo "PG_HOST=${host}"; echo "PG_PORT=${port}"; echo "PG_USER=${user}"; echo "PG_PASSWORD=${secret}"; echo "PG_DATABASE=${target}" ;;
            1) echo "BACKUP_DRIVER=mysql"; echo "MYSQL_HOST=${host}"; echo "MYSQL_PORT=${port}"; echo "MYSQL_USER=${user}"; echo "MYSQL_PASSWORD=${secret}"; echo "MYSQL_DATABASE=${target}" ;;
            3) echo "BACKUP_DRIVER=minio"; echo "MINIO_ENDPOINT=${host}"; echo "MINIO_ACCESS_KEY=${user}"; echo "MINIO_SECRET_KEY=${secret}"; echo "MINIO_BUCKET=${target}" ;;
            *) echo "BACKUP_DRIVER=postgres" ;;
        esac
    } > "${JOBS_DIR}/${jid}.env"
}

restart_cron() {
    [ -n "$CRON_PID" ] && kill "$CRON_PID" 2>/dev/null || true
    CRON_PID=""
    [ -s "$CRONTAB_FILE" ] || return 0
    supercronic "$CRONTAB_FILE" &
    CRON_PID=$!
}

sync_jobs() {
    local id; id=$(hub_agent_id); [ -z "$id" ] && return 0
    local jobs; jobs=$(api "${HUB_URL}/api/agents/${id}/jobs" 2>/dev/null) || { log "job sync failed"; return 0; }

    : > "${CRONTAB_FILE}.new"
    local count i job jid bs us cs
    count=$(echo "$jobs" | jq 'length' 2>/dev/null || echo 0)
    for ((i = 0; i < count; i++)); do
        job=$(echo "$jobs" | jq -c ".[$i]")
        jid=$(echo "$job" | jq -r '.jobId')
        write_job_env "$job"
        bs=$(echo "$job" | jq -r '.backupSchedule')
        us=$(echo "$job" | jq -r '.uploadSchedule // empty')
        cs=$(echo "$job" | jq -r '.cleanupSchedule // empty')
        echo "${bs} /usr/local/bin/run-job.sh ${jid} backup" >> "${CRONTAB_FILE}.new"
        [ -n "$us" ] && echo "${us} /usr/local/bin/run-job.sh ${jid} upload" >> "${CRONTAB_FILE}.new"
        [ -n "$cs" ] && echo "${cs} /usr/local/bin/run-job.sh ${jid} cleanup" >> "${CRONTAB_FILE}.new"
    done

    if ! cmp -s "${CRONTAB_FILE}.new" "$CRONTAB_FILE" 2>/dev/null; then
        mv "${CRONTAB_FILE}.new" "$CRONTAB_FILE"
        log "Synced ${count} job(s) — reloading scheduler"
        restart_cron
    else
        rm -f "${CRONTAB_FILE}.new"
    fi
}

run_all_jobs() {
    local f jid
    for f in "$JOBS_DIR"/*.env; do
        [ -e "$f" ] || continue
        jid=$(basename "$f" .env)
        /usr/local/bin/run-job.sh "$jid" backup || true
    done
}

poll_commands() {
    local id; id=$(hub_agent_id); [ -z "$id" ] && return 0
    local cmds; cmds=$(api "${HUB_URL}/api/agents/${id}/commands" 2>/dev/null) || return 0
    local count i c kind cid jid
    count=$(echo "$cmds" | jq 'length' 2>/dev/null || echo 0)
    for ((i = 0; i < count; i++)); do
        c=$(echo "$cmds" | jq -c ".[$i]")
        cid=$(echo "$c" | jq -r '.id')
        kind=$(echo "$c" | jq -r '.kind')
        jid=$(echo "$c" | jq -r '.jobId // empty')
        case "$kind" in
            0) if [ -n "$jid" ]; then /usr/local/bin/run-job.sh "$jid" backup || true; else run_all_jobs; fi ;;
            1) log "Drill command received — not available until Phase 3" ;;
            2) sync_jobs ;;
        esac
        api -X POST "${HUB_URL}/api/agents/commands/${cid}/ack" >/dev/null 2>&1 || true
    done
}

log "=========================================="
log "  BackupHub Agent"
log "  Hub     : ${HUB_URL:-<unset>}"
log "  Project : ${PROJECT_NAME:-backup}"
log "=========================================="

if ! hub_enabled; then
    error_exit "HUB_URL and HUB_TOKEN are required for the agent"
fi

hub_register || log "Registration failed — will retry"

while true; do
    [ -z "$(hub_agent_id)" ] && hub_register
    sync_jobs
    poll_commands
    sleep "$POLL"
done
