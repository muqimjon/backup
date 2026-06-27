#!/usr/bin/env bash
# discover.sh — auto-discovery: look at the databases / object stores running on
# THIS host and report them to the hub as pending ("Discovered") sources for the
# operator to review. Read-only: it only inspects containers via the Docker API
# (mount /var/run/docker.sock:ro to enable). No socket → no-op, agent stays light.
#
# Hub side parks them in a per-agent project, Confirmed=false, until the operator
# approves them in the web UI. Re-running just refreshes the same entries.
set -uo pipefail

readonly LOG_PREFIX="discover"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"
source /usr/local/bin/lib.sh

readonly DOCKER_SOCK="${DOCKER_SOCK:-/var/run/docker.sock}"

hub_api()    { curl -fsS --max-time 15 -H "X-Hub-Token: ${HUB_TOKEN}" "$@"; }
docker_api() { curl -fsS --max-time 15 --unix-socket "$DOCKER_SOCK" "http://localhost$1"; }

# env_val ENV_JSON KEY  →  value of KEY in a docker .Config.Env array, or empty.
env_val() {
    echo "$1" | jq -r --arg k "$2" 'map(select(startswith($k+"=")))[0] // "" | sub("^[^=]*=";"")'
}

main() {
    hub_enabled || { log "No HUB_URL/HUB_TOKEN — discovery skipped"; return 0; }
    local id; id=$(hub_agent_id)
    [ -z "$id" ] && { log "Agent not registered yet — discovery skipped"; return 0; }
    if [ ! -S "$DOCKER_SOCK" ]; then
        log "No Docker socket at $DOCKER_SOCK — mount it ':ro' to let the agent find local sources"
        return 0
    fi

    local list
    list=$(docker_api "/containers/json") || { log "Docker API unreachable — discovery skipped"; return 0; }

    local items="[]" count i cid image insp cenv name engine port user secret target vis published
    count=$(echo "$list" | jq 'length' 2>/dev/null || echo 0)
    for ((i = 0; i < count; i++)); do
        image=$(echo "$list" | jq -r ".[$i].Image")
        engine=""; port=0
        case "$image" in
            *postgres*|*postgis*)   engine=0; port=5432 ;;
            *mariadb*|*mysql*)      engine=1; port=3306 ;;
            *minio/minio*|*minio*)  engine=3; port=9000 ;;
            *) continue ;;
        esac

        cid=$(echo "$list" | jq -r ".[$i].Id")
        insp=$(docker_api "/containers/${cid}/json") || continue
        name=$(echo "$insp" | jq -r '.Name // ""' | sed 's#^/##')
        cenv=$(echo "$insp" | jq -c '.Config.Env // []')

        # A published host port means another machine/agent could reach it too
        # (Public); otherwise only a co-located agent can (Private).
        published=$(echo "$insp" | jq '[(.NetworkSettings.Ports // {}) | to_entries[] | (.value // []) | length] | add // 0')
        vis=0; [ "${published:-0}" -gt 0 ] 2>/dev/null && vis=1

        case "$engine" in
            0) user=$(env_val "$cenv" POSTGRES_USER);     [ -z "$user" ] && user="postgres"
               secret=$(env_val "$cenv" POSTGRES_PASSWORD)
               target=$(env_val "$cenv" POSTGRES_DB);     [ -z "$target" ] && target="$user" ;;
            1) user=$(env_val "$cenv" MYSQL_USER)
               if [ -n "$user" ]; then secret=$(env_val "$cenv" MYSQL_PASSWORD)
               else user="root"; secret=$(env_val "$cenv" MYSQL_ROOT_PASSWORD); fi
               target=$(env_val "$cenv" MYSQL_DATABASE) ;;
            3) user=$(env_val "$cenv" MINIO_ROOT_USER);   [ -z "$user" ] && user=$(env_val "$cenv" MINIO_ACCESS_KEY)
               secret=$(env_val "$cenv" MINIO_ROOT_PASSWORD); [ -z "$secret" ] && secret=$(env_val "$cenv" MINIO_SECRET_KEY)
               target=$(env_val "$cenv" MINIO_DEFAULT_BUCKETS) ;;
        esac

        items=$(echo "$items" | jq -c \
            --argjson e "$engine" --arg h "$name" --argjson p "$port" \
            --arg u "$user" --arg s "$secret" --arg t "$target" --argjson v "$vis" --arg n "$name" \
            '. += [{engine:$e,host:$h,port:$p,username:$u,secret:$s,target:$t,visibility:$v,name:$n}]')
    done

    local found; found=$(echo "$items" | jq 'length')
    if [ "${found:-0}" -eq 0 ]; then
        log "Scan complete — no databases or object stores found next to this agent"
        return 0
    fi

    if hub_api -X POST "${HUB_URL}/api/agents/${id}/discovered-sources" \
            -H "Content-Type: application/json" -d "$items" >/dev/null 2>&1; then
        log "Reported ${found} discovered source(s) to the hub — review them in the web UI"
    else
        log "Discovery report failed — will retry on next scan"
    fi
}

main "$@"
