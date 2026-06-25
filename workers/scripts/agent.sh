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

# kv KEY VALUE  →  shell-safe assignment (quotes values with spaces/specials).
# Sourced back by run-job.sh (bash), so %q round-trips correctly.
kv() { printf '%s=%q\n' "$1" "$2"; }

write_job_env() {
    local job="$1" jid engine host port user secret target rid rpath bp name minl maxl maxr comp
    jid=$(echo "$job" | jq -r '.jobId')
    name=$(echo "$job" | jq -r '.name')
    engine=$(echo "$job" | jq -r '.engine')
    host=$(echo "$job" | jq -r '.host')
    port=$(echo "$job" | jq -r '.port')
    user=$(echo "$job" | jq -r '.username')
    secret=$(echo "$job" | jq -r '.secret')
    target=$(echo "$job" | jq -r '.target')
    rid=$(echo "$job" | jq -r '.remoteId')
    rpath=$(echo "$job" | jq -r '.remotePath')
    minl=$(echo "$job" | jq -r '.minLocalBackups')
    maxl=$(echo "$job" | jq -r '.maxLocalBackups')
    maxr=$(echo "$job" | jq -r '.maxRemoteBackups')
    comp=$(echo "$job" | jq -r '.compressionLevel')
    bp=$(echo "$job" | jq -r '.backupPassword // empty')

    local conf="${JOBS_DIR}/${jid}.rclone.conf"
    api "${HUB_URL}/api/remotes/${rid}/rclone-conf" -o "$conf" 2>/dev/null \
        || log "rclone config fetch failed for job ${jid}"

    {
        kv PROJECT_NAME "$name"
        kv RCLONE_CONFIG "$conf"
        kv RCLONE_REMOTE remote
        kv RCLONE_PATH "$rpath"
        kv MIN_LOCAL_BACKUPS "$minl"
        kv MAX_LOCAL_BACKUPS "$maxl"
        kv MAX_REMOTE_BACKUPS "$maxr"
        kv COMPRESSION_LEVEL "$comp"
        [ -n "$bp" ] && kv BACKUP_PASSWORD "$bp"
        case "$engine" in
            0) kv BACKUP_DRIVER postgres; kv PG_HOST "$host"; kv PG_PORT "$port"; kv PG_USER "$user"; kv PG_PASSWORD "$secret"; kv PG_DATABASE "$target" ;;
            1) kv BACKUP_DRIVER mysql; kv MYSQL_HOST "$host"; kv MYSQL_PORT "$port"; kv MYSQL_USER "$user"; kv MYSQL_PASSWORD "$secret"; kv MYSQL_DATABASE "$target" ;;
            2) kv BACKUP_DRIVER mssql; kv MSSQL_HOST "$host"; kv MSSQL_PORT "$port"; kv MSSQL_USER "$user"; kv MSSQL_PASSWORD "$secret"; kv MSSQL_DATABASE "$target" ;;
            3) kv BACKUP_DRIVER minio; kv MINIO_ENDPOINT "$host"; kv MINIO_ACCESS_KEY "$user"; kv MINIO_SECRET_KEY "$secret"; kv MINIO_BUCKET "$target" ;;
            *) kv BACKUP_DRIVER postgres ;;
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
    local count i job jid bs us cs ds
    count=$(echo "$jobs" | jq 'length' 2>/dev/null || echo 0)
    for ((i = 0; i < count; i++)); do
        job=$(echo "$jobs" | jq -c ".[$i]")
        jid=$(echo "$job" | jq -r '.jobId')
        write_job_env "$job"
        bs=$(echo "$job" | jq -r '.backupSchedule')
        us=$(echo "$job" | jq -r '.uploadSchedule // empty')
        cs=$(echo "$job" | jq -r '.cleanupSchedule // empty')
        ds=$(echo "$job" | jq -r '.drillSchedule // empty')
        echo "${bs} /usr/local/bin/run-job.sh ${jid} backup" >> "${CRONTAB_FILE}.new"
        [ -n "$us" ] && echo "${us} /usr/local/bin/run-job.sh ${jid} upload" >> "${CRONTAB_FILE}.new"
        [ -n "$cs" ] && echo "${cs} /usr/local/bin/run-job.sh ${jid} cleanup" >> "${CRONTAB_FILE}.new"
        [ -n "$ds" ] && echo "${ds} /usr/local/bin/run-job.sh ${jid} drill" >> "${CRONTAB_FILE}.new"
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
        payload=$(echo "$c" | jq -r '.payload // "{}"')
        case "$kind" in
            0) if [ -n "$jid" ]; then /usr/local/bin/run-job.sh "$jid" backup || true; else run_all_jobs; fi ;;
            1) [ -n "$jid" ] && /usr/local/bin/run-job.sh "$jid" drill || true ;;
            2) sync_jobs ;;
            3) file=$(echo "$payload" | jq -r '.file // empty')
               snap=$(echo "$payload" | jq -r '.snapshot // false')
               [ -n "$jid" ] && [ -n "$file" ] && /usr/local/bin/restore-job.sh "$jid" "$file" "$snap" || true ;;
            4) [ -n "$jid" ] && /usr/local/bin/test-job.sh "$jid" || true ;;
            5) file=$(echo "$payload" | jq -r '.file // empty')
               [ -n "$jid" ] && [ -n "$file" ] && /usr/local/bin/deliver.sh "$jid" "$file" || true ;;
        esac
        api -X POST "${HUB_URL}/api/agents/commands/${cid}/ack" >/dev/null 2>&1 || true
    done
}

log "=========================================="
log "  Zaxira Agent"
log "  Hub     : ${HUB_URL:-<unset>}"
log "  Project : ${PROJECT_NAME:-backup}"
log "=========================================="

if ! hub_enabled; then
    log "No HUB_URL/HUB_TOKEN set — running in standalone (.env) mode"
    exec /usr/local/bin/entrypoint.sh
fi

hub_register || log "Registration failed — will retry"

while true; do
    [ -z "$(hub_agent_id)" ] && hub_register
    sync_jobs
    poll_commands
    sleep "$POLL"
done
