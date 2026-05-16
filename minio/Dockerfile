# ─────────────────────────────────────────────────────────────────────────────
# backup:minio
# Tools: mc (MinIO client)  •  rclone  •  supercronic
# Also works with any S3-compatible storage (AWS S3, Cloudflare R2, etc.)
#
# Build (from repo root):
#   docker build -f minio/Dockerfile -t muqimjon/backup:minio .
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:latest

ENV BACKUP_DRIVER=minio

RUN apk add --no-cache \
        bash \
        curl \
        wget \
        zip \
        rclone \
        tzdata \
        coreutils

# MinIO Client (mc)
RUN wget -q "https://dl.min.io/client/mc/release/linux-amd64/mc" \
        -O /usr/local/bin/mc \
    && chmod +x /usr/local/bin/mc

ARG SUPERCRONIC_VERSION=0.2.29
RUN wget -q \
        "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
        -O /usr/local/bin/supercronic \
    && chmod +x /usr/local/bin/supercronic

COPY scripts/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh \
             /usr/local/bin/drivers/*.sh \
    && mkdir -p /backup

VOLUME ["/backup"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
