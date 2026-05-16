# ─────────────────────────────────────────────────────────────────────────────
# backup:postgres
# Tools: pg_dump  •  rclone  •  supercronic
#
# Build (from repo root):
#   docker build -f postgres/Dockerfile -t muqimjon/backup:postgres .
#
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:latest

ENV BACKUP_DRIVER=postgres

# System deps + PostgreSQL client (always installs latest stable version)
RUN apk add --no-cache \
        bash \
        curl \
        wget \
        zip \
        rclone \
        tzdata \
        coreutils \
        postgresql-client

# supercronic — container-friendly cron (logs to stdout, inherits env)
ARG SUPERCRONIC_VERSION=0.2.29
RUN wget -q \
        "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/supercronic-linux-amd64" \
        -O /usr/local/bin/supercronic \
    && chmod +x /usr/local/bin/supercronic

# Copy all shared scripts (build context must be repo root)
COPY scripts/ /usr/local/bin/
RUN chmod +x /usr/local/bin/*.sh \
             /usr/local/bin/drivers/*.sh \
    && mkdir -p /backup

VOLUME ["/backup"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
