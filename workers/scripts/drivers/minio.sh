#!/usr/bin/env bash
# Driver: minio
set -euo pipefail

: "${MINIO_ENDPOINT:?MINIO_ENDPOINT is required}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY is required}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY is required}"
: "${MINIO_BUCKET:?MINIO_BUCKET is required}"

ALIAS="${MINIO_ALIAS:-backup-src}"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"; mc alias remove "$ALIAS" > /dev/null 2>&1 || true' EXIT

# MinIO ga ulanish
mc alias set "$ALIAS" \
    "$MINIO_ENDPOINT" \
    "$MINIO_ACCESS_KEY" \
    "$MINIO_SECRET_KEY" \
    --api "${MINIO_API:-S3v4}" \
    > /dev/null 2>&1 \
    || { echo "ERROR: MinIO ga ulanib bo'lmadi: ${MINIO_ENDPOINT}" >&2; exit 1; }

# Bucket mavjudligini tekshirish
if ! mc ls "${ALIAS}/${MINIO_BUCKET}" > /dev/null 2>&1; then
    echo "INFO: Bucket '${MINIO_BUCKET}' mavjud emas — obyektlar yuklanmagan bo'lishi mumkin. O'tkazib yuborildi." >&2
    tar -cf - -C "$TMPDIR" . 2>/dev/null   # bo'sh tar → bo'sh zip
    exit 0
fi

# Bucket bo'sh ekanligini tekshirish
OBJECT_COUNT=$(mc ls "${ALIAS}/${MINIO_BUCKET}" 2>/dev/null | grep -c '[^[:space:]]' || echo 0)

if [ "$OBJECT_COUNT" -eq 0 ]; then
    echo "INFO: Bucket '${MINIO_BUCKET}' bo'sh — backup o'tkazib yuborildi." >&2
    tar -cf - -C "$TMPDIR" . 2>/dev/null
    exit 0
fi

echo "INFO: ${OBJECT_COUNT} ta obyekt topildi, mirror boshlandi..." >&2

# Bucket ni mirror qilish
mc mirror \
    --overwrite \
    --quiet \
    "${ALIAS}/${MINIO_BUCKET}" \
    "${TMPDIR}/" \
    2>/dev/null

tar -cf - -C "$TMPDIR" .
