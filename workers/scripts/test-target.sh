#!/usr/bin/env bash
# test-target.sh — ad-hoc connectivity test for one source or remote, triggered
# from the web UI (not tied to a job). Reports the outcome back to the hub, which
# pushes it to the browser as a toast.
#   test-target.sh remote <remoteId> <path>
#   test-target.sh source <sourceId>
set -uo pipefail

readonly LOG_PREFIX="test"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

TARGET="${1:-}"
TID="${2:-}"

api_get() { curl -fsS --max-time 15 -H "X-Hub-Token: ${HUB_TOKEN}" "$@"; }

# report OK MESSAGE   (OK = true|false)
report() {
    local ok="$1"; shift
    local msg="$*"
    log "result: ok=${ok} — ${msg}"
    [ -z "${HUB_URL:-}" ] && return 0
    local body
    body=$(printf '{"target":"%s","targetId":"%s","ok":%s,"message":"%s"}' \
        "$TARGET" "$TID" "$ok" "$(json_escape "$msg")")
    curl -fsS --max-time 15 -X POST "${HUB_URL}/api/ingest/test-result" \
        -H "X-Hub-Token: ${HUB_TOKEN}" -H "Content-Type: application/json" -d "$body" \
        >/dev/null 2>&1 || log "test-result POST failed"
}

test_remote() {
    local path="${1:-}"
    local conf; conf=$(mktemp)
    if ! api_get "${HUB_URL}/api/remotes/${TID}/rclone-conf" -o "$conf" 2>/dev/null; then
        report false "could not fetch destination config from hub"; rm -f "$conf"; return
    fi
    local out
    # A fresh backup folder doesn't exist until the first upload creates it, so a
    # plain `lsd` would wrongly fail with "directory not found". `mkdir` instead
    # proves auth + write access and leaves the folder ready (no-op if it already
    # exists). On object stores it's a cheap no-op; on Drive/SFTP it creates the path.
    if out=$(rclone mkdir --config "$conf" --low-level-retries 1 --retries 1 "remote:${path}" 2>&1) \
       && rclone lsd --config "$conf" --low-level-retries 1 --retries 1 "remote:${path}" >/dev/null 2>&1; then
        report true "destination reachable & writable"
    else
        report false "$(echo "$out" | grep -iE 'error|fail|denied|forbidden|not found|invalid|unauthor' | tail -n1 | cut -c1-200)"
    fi
    rm -f "$conf"
}

test_source() {
    local info
    info=$(api_get "${HUB_URL}/api/agents/source/${TID}/conninfo" 2>/dev/null) \
        || { report false "could not fetch source info from hub"; return; }

    local engine host port user secret target out
    engine=$(echo "$info" | jq -r '.engine')
    host=$(echo "$info" | jq -r '.host')
    port=$(echo "$info" | jq -r '.port')
    user=$(echo "$info" | jq -r '.username')
    secret=$(echo "$info" | jq -r '.secret')
    target=$(echo "$info" | jq -r '.target')

    case "$engine" in
        0) if out=$(PGPASSWORD="$secret" pg_isready -h "$host" -p "$port" -U "$user" -d "$target" 2>&1); then
               report true "postgres reachable"; else report false "$(echo "$out" | tail -n1 | cut -c1-200)"; fi ;;
        1) if out=$(mysqladmin ping -h "$host" -P "$port" -u "$user" -p"$secret" --connect-timeout=10 2>&1); then
               report true "mysql reachable"; else report false "$(echo "$out" | tail -n1 | cut -c1-200)"; fi ;;
        3) mc alias set _test "$host" "$user" "$secret" >/dev/null 2>&1
           if out=$(mc ls "_test/${target}" 2>&1); then report true "minio bucket reachable";
           else report false "$(echo "$out" | tail -n1 | cut -c1-200)"; fi
           mc alias rm _test >/dev/null 2>&1 || true ;;
        *) report false "this engine has no quick test — run a Drill via a job instead" ;;
    esac
}

if [ -z "$TARGET" ] || [ -z "$TID" ]; then
    log "usage: test-target.sh source|remote <id> [path]"; exit 1
fi

case "$TARGET" in
    remote) test_remote "${3:-}" ;;
    source) test_source ;;
    *)      log "unknown target: ${TARGET}" ;;
esac
