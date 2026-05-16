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
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
