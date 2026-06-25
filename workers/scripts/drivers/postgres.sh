#!/usr/bin/env bash
# Driver: postgres
# Output: SQL plain-text dump to stdout (piped to zip by backup.sh)
set -euo pipefail

: "${PG_HOST:?PG_HOST is required}"
: "${PG_USER:?PG_USER is required}"
: "${PG_DATABASE:?PG_DATABASE is required}"

export PGPASSWORD="${PG_PASSWORD:-}"

# --clean --if-exists makes the dump self-cleaning so it restores over an
# existing database without "already exists" collisions.
exec pg_dump \
    --host="${PG_HOST}" \
    --port="${PG_PORT:-5432}" \
    --username="${PG_USER}" \
    --dbname="${PG_DATABASE}" \
    --format=plain \
    --clean \
    --if-exists \
    --no-password
