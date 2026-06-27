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
    minio)
        : "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required}" "${MINIO_ACCESS_KEY:?}" \
          "${MINIO_SECRET_KEY:?}" "${MINIO_BUCKET:?}"
        # The archive holds a tar of the mirrored bucket. Unpack it, then mirror it
        # back so the bucket exactly matches this version: --overwrite replaces
        # changed objects, --remove deletes objects added since the backup. This is
        # a true point-in-time rollback, kept consistent with the paired DB restore.
        alias="${MINIO_ALIAS:-backup-restore}"
        tmp=$(mktemp -d)
        trap 'rm -rf "$tmp"; mc alias remove "$alias" >/dev/null 2>&1 || true' EXIT

        "${extract[@]}" | tar -xf - -C "$tmp" \
            || error_exit "Could not unpack minio archive: $(basename "$file")"

        mc alias set "$alias" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" \
            --api "${MINIO_API:-S3v4}" >/dev/null 2>&1 \
            || error_exit "MinIO ulanib bo'lmadi: ${MINIO_ENDPOINT}"
        mc mb --ignore-existing "${alias}/${MINIO_BUCKET}" >/dev/null 2>&1 || true
        mc mirror --overwrite --remove --quiet "$tmp/" "${alias}/${MINIO_BUCKET}" \
            || error_exit "MinIO mirror restore failed (bucket: ${MINIO_BUCKET})"
        ;;
    *)
        error_exit "Automated restore not supported for '${driver}'. For mssql, extract the zip and re-import manually (see README)."
        ;;
esac

log "Restore complete ✓"
