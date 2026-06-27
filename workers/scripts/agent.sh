#!/usr/bin/env bash
# agent.sh — BackupHub generic agent entrypoint.
# Registers with the hub, pulls its job list (→ supercronic crontab), and polls
# for one-off commands ("Run now"). All driven from the web UI — no env config
# of sources needed on the host.
set -uo pipefail

readonly LOG_PREFIX="agent"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
readonly JOBS_DIR="${BACKUP_DIR}/jobs"
# Persisted on the /backup volume (not /tmp) so a hub-assigned job survives a
# container restart and keeps running even when the hub is offline.
readonly CRONTAB_FILE="${BACKUP_DIR}/.agent.crontab"
# Poll one-off commands often so "Run / Test / Drill" feel instant; re-sync the
# job list (heavier) less frequently.
readonly POLL="${AGENT_POLL_INTERVAL:-5}"
readonly SYNC_EVERY="${AGENT_SYNC_INTERVAL:-20}"

source /usr/local/bin/lib.sh

mkdir -p "$JOBS_DIR"
CRON_PID=""

api() { curl -fsS --max-time 15 -H "X-Hub-Token: ${HUB_TOKEN}" "$@"; }

# kv KEY VALUE  →  shell-safe assignment (quotes values with spaces/specials).
# Sourced back by run-job.sh (bash), so %q round-trips correctly.
kv() { printf '%s=%q\n' "$1" "$2"; }

# Emit env vars for ONE source (engine + connection). Appends the driver name to
# the global $drivers list. Runs inside write_job_env's redirected { } block.
emit_source() {
    local engine="$1" host="$2" port="$3" user="$4" secret="$5" target="$6"
    case "$engine" in
        0) drivers="${drivers:+$drivers-}postgres"
           kv PG_HOST "$host"; kv PG_PORT "$port"; kv PG_USER "$user"; kv PG_PASSWORD "$secret"; kv PG_DATABASE "$target" ;;
        1) drivers="${drivers:+$drivers-}mysql"
           kv MYSQL_HOST "$host"; kv MYSQL_PORT "$port"; kv MYSQL_USER "$user"; kv MYSQL_PASSWORD "$secret"; kv MYSQL_DATABASE "$target" ;;
        2) drivers="${drivers:+$drivers-}mssql"
           kv MSSQL_HOST "$host"; kv MSSQL_PORT "$port"; kv MSSQL_USER "$user"; kv MSSQL_PASSWORD "$secret"; kv MSSQL_DATABASE "$target" ;;
        3) drivers="${drivers:+$drivers-}minio"
           kv MINIO_ENDPOINT "$host"; kv MINIO_ACCESS_KEY "$user"; kv MINIO_SECRET_KEY "$secret"; kv MINIO_BUCKET "$target" ;;
    esac
}

write_job_env() {
    local job="$1" jid rid rpath bp name minl maxl maxr comp
    jid=$(echo "$job" | jq -r '.jobId')
    name=$(echo "$job" | jq -r '.name')
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

        # A job ("project") backs up one or more sources in one combined run. The
        # hub returns them already ordered (databases first, MinIO last), so we just
        # join the driver names into BACKUP_DRIVER=postgres-minio and emit each
        # source's env vars.
        local drivers="" scount i
        scount=$(echo "$job" | jq '.sources | length')
        for ((i = 0; i < scount; i++)); do
            emit_source \
                "$(echo "$job" | jq -r ".sources[$i].engine")" \
                "$(echo "$job" | jq -r ".sources[$i].host")" \
                "$(echo "$job" | jq -r ".sources[$i].port")" \
                "$(echo "$job" | jq -r ".sources[$i].username")" \
                "$(echo "$job" | jq -r ".sources[$i].secret")" \
                "$(echo "$job" | jq -r ".sources[$i].target")"
        done
        kv BACKUP_DRIVER "${drivers:-postgres}"
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
            1) dfile=$(echo "$payload" | jq -r '.file // empty')
               [ -n "$jid" ] && DRILL_FILE="$dfile" /usr/local/bin/run-job.sh "$jid" drill || true ;;
            2) sync_jobs ;;
            3) file=$(echo "$payload" | jq -r '.file // empty')
               ver=$(echo "$payload" | jq -r '.version // empty')
               snap=$(echo "$payload" | jq -r '.snapshot // false')
               rfiles=$(echo "$payload" | jq -c '.files // []')
               # version (whole project) wins over a single file (advanced restore)
               restore_target="${ver:-$file}"
               [ -n "$jid" ] && [ -n "$restore_target" ] && /usr/local/bin/restore-job.sh "$jid" "$restore_target" "$snap" "$rfiles" || true ;;
            4) [ -n "$jid" ] && /usr/local/bin/test-job.sh "$jid" || true ;;
            5) file=$(echo "$payload" | jq -r '.file // empty')
               [ -n "$jid" ] && [ -n "$file" ] && /usr/local/bin/deliver.sh "$jid" "$file" || true ;;
            6) sid=$(echo "$payload" | jq -r '.sourceId // empty')
               [ -n "$sid" ] && /usr/local/bin/test-target.sh source "$sid" || true ;;
            7) rid=$(echo "$payload" | jq -r '.remoteId // empty')
               rpath=$(echo "$payload" | jq -r '.path // ""')
               [ -n "$rid" ] && /usr/local/bin/test-target.sh remote "$rid" "$rpath" || true ;;
            8) /usr/local/bin/discover.sh || true ;;
            9) file=$(echo "$payload" | jq -r '.file // empty')
               [ -n "$jid" ] && [ -n "$file" ] && /usr/local/bin/delete-artifact.sh "$jid" "$file" || true ;;
            10) reset_agent || true ;;
        esac
        api -X POST "${HUB_URL}/api/agents/commands/${cid}/ack" >/dev/null 2>&1 || true
    done
}

# ── Local-config fallback (hybrid mode) ──────────────────────────────────────
# When hub creds are set we still want to keep working if the hub is
# unreachable / the token is wrong / the hub doesn't exist. If a local .env
# backup config is present (BACKUP_DRIVER set), run the standalone scheduler as
# a fallback. Hub-assigned jobs always take precedence: once the hub hands out a
# job we stop the local fallback and run the hub job (which is persisted).
LOCAL_PID=""

# A real local fallback config means BACKUP_DRIVER names an actual source.
# The generic agent image ships BACKUP_DRIVER=agent (a hub-only sentinel) — that
# is NOT a local config, so a plain hub agent just waits for hub jobs.
local_config_present() {
    case "${BACKUP_DRIVER:-}" in
        postgres|mysql|mssql|minio|postgres-minio) return 0 ;;
        *) return 1 ;;
    esac
}
have_hub_jobs() { [ -s "$CRONTAB_FILE" ]; }

start_local() {
    [ -n "$LOCAL_PID" ] && kill -0 "$LOCAL_PID" 2>/dev/null && return 0
    local_config_present || return 0
    log "Fallback: starting local-config scheduler (.env)"
    /usr/local/bin/entrypoint.sh &
    LOCAL_PID=$!
}

stop_local() {
    [ -n "$LOCAL_PID" ] || return 0
    log "Hub job assigned — stopping local-config fallback"
    kill "$LOCAL_PID" 2>/dev/null || true
    LOCAL_PID=""
}

# Hub jobs win when present; otherwise fall back to local config.
reconcile_fallback() {
    if have_hub_jobs; then stop_local; else start_local; fi
}

# ── Adopt: push the local docker-compose config UP to the hub ─────────────────
# When an agent is configured locally (BACKUP_DRIVER + creds in compose) AND can
# reach a hub, register that config as a hub job ONCE so it appears in the UI and
# becomes hub-managed. Idempotent: a marker file stops re-adoption; the hub side
# also upserts. After adoption sync_jobs pulls it back as a hub job and the local
# fallback stops — "configure once in compose, manage from the hub".
ADOPT_MARKER="${BACKUP_DIR}/.agent_adopted"

# Append one source object to $ADOPT_SOURCES (jq array) for the given driver.
adopt_add_source() {  # engine host port user secret target
    ADOPT_SOURCES=$(echo "$ADOPT_SOURCES" | jq -c \
        --argjson e "$1" --arg h "$2" --argjson p "$3" --arg u "$4" --arg s "$5" --arg t "$6" \
        '. += [{engine:$e,host:$h,port:$p,username:$u,secret:$s,target:$t}]')
}

adopt_local_config() {
    hub_enabled || return 0
    local_config_present || return 0
    [ -f "$ADOPT_MARKER" ] && return 0
    local id; id=$(hub_agent_id); [ -z "$id" ] && return 0

    # The rclone.conf the agent already holds locally (writable copy preferred).
    local rconf="/etc/rclone-active/rclone.conf"
    [ -f "$rconf" ] || rconf="${RCLONE_CONFIG:-}"
    local rclone_content=""
    [ -n "$rconf" ] && [ -f "$rconf" ] && rclone_content=$(cat "$rconf")
    if [ -z "$rclone_content" ]; then
        log "Adopt: no rclone config to push yet — skipping"
        return 0
    fi

    ADOPT_SOURCES="[]"
    local d
    IFS='-' read -ra DR <<< "${BACKUP_DRIVER}"
    for d in "${DR[@]}"; do
        case "$d" in
            postgres) adopt_add_source 0 "${PG_HOST:-}"    "${PG_PORT:-5432}"  "${PG_USER:-}"         "${PG_PASSWORD:-}"     "${PG_DATABASE:-}" ;;
            mysql)    adopt_add_source 1 "${MYSQL_HOST:-}" "${MYSQL_PORT:-3306}" "${MYSQL_USER:-}"    "${MYSQL_PASSWORD:-}"  "${MYSQL_DATABASE:-}" ;;
            mssql)    adopt_add_source 2 "${MSSQL_HOST:-}" "${MSSQL_PORT:-1433}" "${MSSQL_USER:-}"    "${MSSQL_PASSWORD:-}"  "${MSSQL_DATABASE:-}" ;;
            minio)    adopt_add_source 3 "${MINIO_ENDPOINT:-}" 9000 "${MINIO_ACCESS_KEY:-}" "${MINIO_SECRET_KEY:-}" "${MINIO_BUCKET:-}" ;;
        esac
    done

    local payload
    payload=$(jq -nc \
        --arg name "${PROJECT_NAME:-backup}" \
        --arg bs "${BACKUP_SCHEDULE:-0 2 * * *}" \
        --arg us "${UPLOAD_SCHEDULE:-}" \
        --arg cs "${CLEANUP_SCHEDULE:-}" \
        --arg ds "${DRILL_SCHEDULE:-}" \
        --argjson minl "${MIN_LOCAL_BACKUPS:-2}" \
        --argjson maxl "${MAX_LOCAL_BACKUPS:-5}" \
        --argjson maxr "${MAX_REMOTE_BACKUPS:-30}" \
        --argjson comp "${COMPRESSION_LEVEL:-6}" \
        --arg bp "${BACKUP_PASSWORD:-}" \
        --argjson sources "$ADOPT_SOURCES" \
        --arg rname "${PROJECT_NAME:-backup} (agent)" \
        --arg rpath "${RCLONE_PATH:-}" \
        --arg rconf "$rclone_content" \
        '{name:$name, backupSchedule:$bs,
          uploadSchedule:  (if $us=="" then null else $us end),
          cleanupSchedule: (if $cs=="" then null else $cs end),
          drillSchedule:   (if $ds=="" then null else $ds end),
          minLocalBackups:$minl, maxLocalBackups:$maxl, maxRemoteBackups:$maxr,
          compressionLevel:$comp,
          backupPassword:  (if $bp=="" then null else $bp end),
          sources:$sources, remoteName:$rname, remotePath:$rpath, rcloneConfig:$rconf}')

    if api -X POST "${HUB_URL}/api/agents/${id}/adopt-job" \
            -H "Content-Type: application/json" -d "$payload" >/dev/null 2>&1; then
        printf '%s' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ADOPT_MARKER"
        log "Adopt: local config pushed to hub as project '${PROJECT_NAME:-backup}' — now hub-managed"
    else
        log "Adopt: push failed — will retry on next sync"
    fi
}

# ── Reset: drop hub-applied state, return to the agent's startup config ───────
# Triggered by the hub's "Reset" button (CommandKind.ResetAgent). Hub commands
# normally win and persist; reset is the one escape hatch. We forget the adopt
# marker and the cached hub job list, then replay the startup sequence:
# re-register, re-adopt the LOCAL compose config (which overwrites whatever the
# hub now holds for this agent), re-discover, and re-sync. Identity (.agent_id)
# is kept, and the agent immediately goes back to being hub-driven — from a clean
# slate that mirrors how it first came up.
reset_agent() {
    log "Reset requested — clearing hub-applied state and re-adopting local config"
    rm -f "$ADOPT_MARKER"
    rm -f "$JOBS_DIR"/*.env "$JOBS_DIR"/*.rclone.conf 2>/dev/null || true
    : > "$CRONTAB_FILE"
    restart_cron
    hub_register || true
    adopt_local_config
    /usr/local/bin/discover.sh || true
    sync_jobs
    reconcile_fallback
    log "Reset complete — back to startup config, watching the hub"
}

log "=========================================="
log "  Zaxira Agent"
log "  Hub     : ${HUB_URL:-<unset>}"
log "  Project : ${PROJECT_NAME:-backup}"
log "=========================================="

# No hub creds at all → pure standalone, exactly as before.
if ! hub_enabled; then
    log "No HUB_URL/HUB_TOKEN set — running in standalone (.env) mode"
    exec /usr/local/bin/entrypoint.sh
fi

log "Hybrid mode: hub control-plane$(local_config_present && echo ' + local-config fallback')"

# Resume any persisted hub job immediately — survives restarts and hub downtime
# (Item: configure once via hub, keep running even if the hub is later turned off).
if have_hub_jobs; then
    log "Resuming $(grep -c . "$CRONTAB_FILE" 2>/dev/null || echo 0) persisted hub job line(s)"
    restart_cron
fi

hub_register || log "Hub unreachable at startup — using persisted/local config for now"

# Push any locally-configured job up to the hub (once), so it shows up and is
# manageable there — before the first sync, so it comes straight back as a hub job.
adopt_local_config

# Look at what's running next to us and offer it to the hub as pending sources
# (no-op unless the Docker socket is mounted) — so a fresh agent self-populates
# instead of the operator hand-entering every database.
/usr/local/bin/discover.sh || true

# First sync before choosing the fallback, so a hub that already has a job for
# us doesn't trigger a spurious local run at startup.
sync_jobs
reconcile_fallback

ticks_per_sync=$(( SYNC_EVERY / POLL )); [ "$ticks_per_sync" -lt 1 ] && ticks_per_sync=1
tick=0
while true; do
    [ -z "$(hub_agent_id)" ] && hub_register
    if [ $(( tick % ticks_per_sync )) -eq 0 ]; then
        adopt_local_config
        sync_jobs
        reconcile_fallback
    fi
    poll_commands
    tick=$(( tick + 1 ))
    sleep "$POLL"
done
