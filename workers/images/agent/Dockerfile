# ─────────────────────────────────────────────────────────────────────────────
# backuphub/agent — generic, web-driven agent.
# Pulls its job list from the BackupHub control plane and runs every job
# (postgres / mysql / minio-S3) on the schedule defined in the web UI.
# Tools: pg_dump • mysqldump • mc • rclone • jq • supercronic
#
# Build (from repo root):
#   docker build -f workers/images/agent/Dockerfile -t muqimjon/zaxira .
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:latest

ENV BACKUP_DRIVER=agent

RUN apk add --no-cache \
        bash \
        curl \
        wget \
        zip \
        unzip \
        jq \
        rclone \
        tzdata \
        coreutils \
        postgresql-client \
        mysql-client

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

ENTRYPOINT ["/usr/local/bin/agent.sh"]
