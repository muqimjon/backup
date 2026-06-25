#!/usr/bin/env bash
# inventory.sh — report this job's backup archives (local + remote) to the hub,
# so the web UI can list versions and restore any of them. No-op without HUB+JOB.
set -uo pipefail

readonly LOG_PREFIX="inventory"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

hub_enabled || exit 0
[ -z "${JOB_ID:-}" ] && exit 0
agent_id=$(hub_agent_id); [ -z "$agent_id" ] && exit 0

items="[]"
declare -A seen

add_item() {  # name driver bytes iso location(0 local,1 remote)
    items=$(echo "$items" | jq -c \
        --arg n "$1" --arg d "$2" --argjson b "${3:-0}" --arg t "$4" --argjson l "$5" \
        '. += [{"fileName":$n,"driver":$d,"bytes":$b,"archivedAt":$t,"location":$l}]')
}

IFS='-' read -ra DRIVERS <<< "${BACKUP_DRIVER:-postgres}"
for driver in "${DRIVERS[@]}"; do
    for f in "$BACKUP_DIR"/*_"${driver}"_*.zip; do
        [ -e "$f" ] || continue
        name=$(basename "$f")
        bytes=$(stat -c%s "$f" 2>/dev/null || echo 0)
        iso=$(date -u -d "@$(stat -c%Y "$f" 2>/dev/null || echo 0)" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "1970-01-01T00:00:00Z")
        add_item "$name" "$driver" "$bytes" "$iso" 0
        seen["$name"]=1
    done

    if [ -n "${RCLONE_CONFIG:-}" ] && [ -f "${RCLONE_CONFIG}" ]; then
        remote=$(rclone --config "$RCLONE_CONFIG" lsjson "${RCLONE_REMOTE:-remote}:${RCLONE_PATH:-}" 2>/dev/null || echo "[]")
        count=$(echo "$remote" | jq 'length' 2>/dev/null || echo 0)
        for ((i = 0; i < count; i++)); do
            name=$(echo "$remote" | jq -r ".[$i].Name")
            case "$name" in *_"${driver}"_*.zip) ;; *) continue ;; esac
            [ -n "${seen[$name]:-}" ] && continue
            bytes=$(echo "$remote" | jq -r ".[$i].Size // 0")
            iso=$(echo "$remote" | jq -r ".[$i].ModTime // empty")
            [ -z "$iso" ] && iso="1970-01-01T00:00:00Z"
            add_item "$name" "$driver" "$bytes" "$iso" 1
            seen["$name"]=1
        done
    fi
done

body=$(echo "$items" | jq -c --arg a "$agent_id" --arg j "$JOB_ID" '{agentId:$a,jobId:$j,items:.}')
curl -fsS --max-time 20 -X POST "${HUB_URL}/api/agents/inventory" \
    -H "X-Hub-Token: ${HUB_TOKEN}" -H "Content-Type: application/json" -d "$body" \
    >/dev/null 2>&1 \
    && log "Inventory reported ($(echo "$items" | jq 'length') archive(s))" \
    || log "Inventory report failed"
