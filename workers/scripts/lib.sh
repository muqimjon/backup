#!/usr/bin/env bash
# lib.sh — shared utilities sourced by all backup scripts

readonly STATE_FILE="${BACKUP_DIR:-/backup}/.state"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${LOG_PREFIX:-backup}] $*"
}

error_exit() {
    log "ERROR: $1" >&2
    notify error "$1" || true
    heartbeat /fail || true
    hub_report "${RUN_TYPE:-0}" 2 0 "$1" || true
    exit "${2:-1}"
}

# json_escape STRING  →  escape for safe embedding in a JSON string value
json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n\r\t' '   '
}

# notify LEVEL MESSAGE  →  push an alert to every configured channel.
# Channels (all optional): Telegram, generic JSON webhook.
# NOTIFY_ON controls verbosity:  failure (default) | always | never
#   failure → only level=error is sent
#   always  → every level is sent (success, warn, error)
notify() {
    local level="$1"; shift
    local message="$*"
    local mode="${NOTIFY_ON:-failure}"
    local project="${PROJECT_NAME:-backup}"

    [ "$mode" = "never" ] && return 0
    [ "$mode" = "failure" ] && [ "$level" != "error" ] && return 0

    local icon="ℹ️"
    case "$level" in
        error)   icon="🔴" ;;
        success) icon="✅" ;;
        warn)    icon="⚠️" ;;
    esac
    local text="${icon} [${project}] ${message}"

    if [ -n "${NOTIFY_TELEGRAM_TOKEN:-}" ] && [ -n "${NOTIFY_TELEGRAM_CHAT_ID:-}" ]; then
        curl -fsS --max-time 15 -X POST \
            "https://api.telegram.org/bot${NOTIFY_TELEGRAM_TOKEN}/sendMessage" \
            --data-urlencode "chat_id=${NOTIFY_TELEGRAM_CHAT_ID}" \
            --data-urlencode "text=${text}" \
            -d disable_web_page_preview=true \
            >/dev/null 2>&1 \
            && log "Notify: telegram sent" \
            || log "Notify: telegram FAILED"
    fi

    if [ -n "${NOTIFY_WEBHOOK_URL:-}" ]; then
        curl -fsS --max-time 15 -X POST "${NOTIFY_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"level\":\"${level}\",\"project\":\"${project}\",\"message\":\"$(json_escape "$message")\"}" \
            >/dev/null 2>&1 \
            && log "Notify: webhook sent" \
            || log "Notify: webhook FAILED"
    fi

    if [ -n "${SMTP_HOST:-}" ] && [ -n "${EMAIL_TO:-}" ] && [ -n "${EMAIL_FROM:-}" ]; then
        send_email "${icon} [${project}] backup ${level}" "$text"
    fi
}

# send_email SUBJECT BODY  →  send mail over SMTP using curl (no extra packages).
# Works with Gmail (smtp.gmail.com:587 + app password), or any SMTP relay.
# Port 465 → implicit TLS (smtps); any other port → STARTTLS (smtp + --ssl-reqd).
# EMAIL_TO may be a comma-separated list.
send_email() {
    local subject="$1" body="$2"
    local host="${SMTP_HOST}" port="${SMTP_PORT:-587}"
    local scheme="smtp"
    [ "$port" = "465" ] && scheme="smtps"

    local msg; msg=$(mktemp)
    {
        echo "From: ${EMAIL_FROM}"
        echo "To: ${EMAIL_TO}"
        echo "Subject: ${subject}"
        echo "Date: $(date -R 2>/dev/null || date)"
        echo "MIME-Version: 1.0"
        echo "Content-Type: text/plain; charset=UTF-8"
        echo ""
        echo "${body}"
    } > "$msg"

    local args=(--url "${scheme}://${host}:${port}" --ssl-reqd
                --mail-from "${EMAIL_FROM}" --upload-file "$msg")
    [ -n "${SMTP_USER:-}" ] && args+=(--user "${SMTP_USER}:${SMTP_PASS:-}")

    local rcpt
    local OLD_IFS="$IFS"; IFS=','
    for rcpt in $EMAIL_TO; do
        rcpt="${rcpt// /}"
        [ -n "$rcpt" ] && args+=(--mail-rcpt "$rcpt")
    done
    IFS="$OLD_IFS"

    curl -fsS --max-time 30 "${args[@]}" >/dev/null 2>&1 \
        && log "Notify: email sent" \
        || log "Notify: email FAILED"
    rm -f "$msg"
}

# heartbeat [SUFFIX]  →  ping a dead-man's-switch URL (e.g. healthchecks.io).
# Call with no arg on success, with "/fail" on failure. No-op if unset.
heartbeat() {
    [ -z "${HEARTBEAT_URL:-}" ] && return 0
    curl -fsS --max-time 15 "${HEARTBEAT_URL}${1:-}" >/dev/null 2>&1 || true
}

# ── BackupHub control-plane integration (all no-ops unless HUB_URL+HUB_TOKEN) ──

hub_enabled() { [ -n "${HUB_URL:-}" ] && [ -n "${HUB_TOKEN:-}" ]; }

# hub_register  →  announce this agent; caches the returned id in .agent_id
hub_register() {
    hub_enabled || return 0
    local host; host=$(hostname 2>/dev/null || echo unknown)
    local body resp
    body=$(printf '{"name":"%s","hostname":"%s","project":"%s","drivers":"%s","version":"%s"}' \
        "$(json_escape "${AGENT_NAME:-$host}")" "$(json_escape "$host")" \
        "$(json_escape "${PROJECT_NAME:-backup}")" "$(json_escape "${BACKUP_DRIVER:-agent}")" \
        "${AGENT_VERSION:-0.1.0}")
    resp=$(curl -fsS --max-time 15 -X POST "${HUB_URL}/api/agents/register" \
        -H "X-Hub-Token: ${HUB_TOKEN}" -H "Content-Type: application/json" -d "$body" 2>/dev/null) \
        || { log "Hub: register FAILED"; return 1; }
    printf '%s' "$resp" | tr -d '"' > "${BACKUP_DIR}/.agent_id"
    log "Hub: registered as $(cat "${BACKUP_DIR}/.agent_id")"
}

hub_agent_id() {
    [ -n "${AGENT_ID:-}" ] && { echo "$AGENT_ID"; return; }
    [ -f "${BACKUP_DIR}/.agent_id" ] && cat "${BACKUP_DIR}/.agent_id"
}

# hub_report TYPE STATUS [BYTES] [MESSAGE]
#   TYPE:   0 backup · 1 upload · 2 cleanup · 3 drill
#   STATUS: 1 ok · 2 fail
# Needs JOB_ID in the environment (set by the agent when running a hub job).
hub_report() {
    hub_enabled || return 0
    [ -z "${JOB_ID:-}" ] && return 0
    local agent_id; agent_id=$(hub_agent_id)
    [ -z "$agent_id" ] && return 0
    local now; now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local body
    body=$(printf '{"agentId":"%s","jobId":"%s","type":%s,"status":%s,"startedAt":"%s","finishedAt":"%s","bytes":%s,"message":"%s"}' \
        "$agent_id" "$JOB_ID" "${1:-0}" "${2:-1}" "$now" "$now" "${3:-0}" "$(json_escape "${4:-}")")
    curl -fsS --max-time 15 -X POST "${HUB_URL}/api/ingest/events" \
        -H "X-Hub-Token: ${HUB_TOKEN}" -H "Content-Type: application/json" -d "$body" \
        >/dev/null 2>&1 || log "Hub: report FAILED"
}

# state_get KEY [DEFAULT]  →  reads a value from the state file
state_get() {
    local key="$1" default="${2:-0}"
    [ -f "$STATE_FILE" ] || { echo "$default"; return; }
    local val
    val=$(grep "^${key}=" "$STATE_FILE" 2>/dev/null | tail -1 | sed "s/^${key}=//") || true
    echo "${val:-$default}"
}

# state_set KEY VALUE  →  writes / updates a value in the state file
state_set() {
    local key="$1" value="$2"
    mkdir -p "$(dirname "$STATE_FILE")"
    local tmp="${STATE_FILE}.tmp"
    {
        grep -v "^${key}=" "$STATE_FILE" 2>/dev/null || true
        echo "${key}=${value}"
    } > "$tmp"
    mv "$tmp" "$STATE_FILE"
}

# cron_to_seconds EXPR  →  approximate interval in seconds
cron_to_seconds() {
    local expr="$1"
    case "$expr" in
        @hourly)  echo 3600;   return ;;
        @daily)   echo 86400;  return ;;
        @weekly)  echo 604800; return ;;
    esac
    # */N * * * *
    if [[ "$expr" =~ ^\*/([0-9]+)[[:space:]] ]]; then
        echo $(( ${BASH_REMATCH[1]} * 60 )); return
    fi
    # M */H * * *
    if [[ "$expr" =~ ^[0-9]+[[:space:]]+\*/([0-9]+)[[:space:]] ]]; then
        echo $(( ${BASH_REMATCH[1]} * 3600 )); return
    fi
    # Any fixed daily schedule  (M H * * *)
    echo 86400
}
