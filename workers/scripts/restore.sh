#!/usr/bin/env bash
# restore.sh — restore a backup archive back into its source.
#
# Usage (inside the container):
#   restore.sh <driver> [file.zip]
#     driver : postgres | mysql
#     file   : path or filename in BACKUP_DIR; defaults to the newest matching zip
#
# Examples:
#   docker exec -it forex_backup restore.sh postgres
#   docker exec -it forex_backup restore.sh postgres myapp_postgres_20260624_020000.zip
#
# A restore you have never tested is just a hope. Test it on a throwaway DB.
set -euo pipefail

readonly LOG_PREFIX="restore"
readonly BACKUP_DIR="${BACKUP_DIR:-/backup}"

source /usr/local/bin/lib.sh

driver="${1:?Usage: restore.sh <postgres|mysql> [file.zip]}"
file="${2:-}"

# Default to the newest archive for this driver if none given.
if [ -z "$file" ]; then
    file=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*_${driver}_*.zip" | sort | tail -1)
    [ -n "$file" ] || error_exit "No ${driver} backup found in ${BACKUP_DIR}"
    log "No file given — using newest: $(basename "$file")"
fi
[ -f "$file" ] || file="${BACKUP_DIR}/${file}"
[ -f "$file" ] || error_exit "Backup file not found: $2"

# Build the unzip-to-stdout command, with password if the archive is encrypted.
extract=(unzip -p "$file")
[ -n "${BACKUP_PASSWORD:-}" ] && extract=(unzip -P "$BACKUP_PASSWORD" -p "$file")

log "Restoring ${driver} from $(basename "$file")"

case "$driver" in
    postgres)
        : "${PG_HOST:?PG_HOST is required}" "${PG_USER:?}" "${PG_DATABASE:?}"
        export PGPASSWORD="${PG_PASSWORD:-}"
        # Atomic restore: the dump (pg_dump --clean --if-exists) drops & recreates every
        # object inside ONE transaction. --single-transaction means any failure (corrupt
        # archive, mid-stream abort) ROLLS BACK — the live database is left untouched.
        # Never destroy existing data before the new dump is proven loadable.
        "${extract[@]}" | psql \
            --host="$PG_HOST" --port="${PG_PORT:-5432}" \
            --username="$PG_USER" --dbname="$PG_DATABASE" \
            --no-password --single-transaction -v ON_ERROR_STOP=1
        ;;
    mysql)
        : "${MYSQL_HOST:?MYSQL_HOST is required}" "${MYSQL_USER:?}" "${MYSQL_DATABASE:?}"
        export MYSQL_PWD="${MYSQL_PASSWORD:-}"
        "${extract[@]}" | mysql \
            --host="$MYSQL_HOST" --port="${MYSQL_PORT:-3306}" \
            --user="$MYSQL_USER" "$MYSQL_DATABASE"
        ;;
    *)
        error_exit "Automated restore not supported for '${driver}'. For minio/mssql, extract the zip and re-import manually (see README)."
        ;;
esac

log "Restore complete ✓"
