# ─────────────────────────────────────────────────────────────────────────────
# backup:postgres-minio
# Tools: pg_dump  •  mc  •  rclone  •  supercronic
#
# Backs up BOTH a PostgreSQL database AND a MinIO bucket in one container.
# Each source produces its own separate zip file per run.
#
# Build (from repo root):
#   docker build -f workers/images/postgres-minio/Dockerfile -t muqimjon/backup:postgres-minio .
#
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:latest

ENV BACKUP_DRIVER=postgres-minio

# System deps + PostgreSQL client (always installs latest stable version)
RUN apk add --no-cache \
        bash \
        curl \
        wget \
        zip \
        unzip \
        rclone \
        tzdata \
        coreutils \
        postgresql-client

# MinIO Client (mc)
RUN wget -q "https://dl.min.io/client/mc/release/linux-amd64/mc" \
        -O /usr/local/bin/mc \
    && chmod +x /usr/local/bin/mc

ARG SUPERCRONIC_VERSION=0.2.29
RUN wget -q \
        "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
        -O /usr/local/bin/supercronic \
    && chmod +x /usr/local/bin/supercronic

COPY workers/scripts/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh \
             /usr/local/bin/drivers/*.sh \
    && mkdir -p /backup

VOLUME ["/backup"]

HEALTHCHECK --interval=6h --timeout=20s --start-period=3m --retries=2 \
    CMD /usr/local/bin/healthcheck.sh || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
