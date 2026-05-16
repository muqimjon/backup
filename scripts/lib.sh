#!/usr/bin/env bash
# lib.sh — shared utilities sourced by all backup scripts

readonly STATE_FILE="${BACKUP_DIR:-/backup}/.state"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${LOG_PREFIX:-backup}] $*"
}

error_exit() {
    log "ERROR: $1" >&2
    exit "${2:-1}"
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
