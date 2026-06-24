# ─────────────────────────────────────────────────────────────────────────────
# backup:mysql
# Tools: mysqldump  •  rclone  •  supercronic
# Also works with MariaDB.
#
# Build (from repo root):
#   docker build -f mysql/Dockerfile -t muqimjon/backup:mysql .
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:latest

ENV BACKUP_DRIVER=mysql

RUN apk add --no-cache \
        bash \
        curl \
        wget \
        zip \
        unzip \
        rclone \
        tzdata \
        coreutils \
        mysql-client

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

HEALTHCHECK --interval=6h --timeout=20s --start-period=3m --retries=2 \
    CMD /usr/local/bin/healthcheck.sh || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
