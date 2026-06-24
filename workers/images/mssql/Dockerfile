# ─────────────────────────────────────────────────────────────────────────────
# backup:mssql
# Tools: sqlcmd  •  bcp  •  rclone  •  supercronic
# Base : Ubuntu 22.04  (Microsoft's mssql-tools are not available on Alpine)
#
# Build (from repo root):
#   docker build -f workers/images/mssql/Dockerfile -t muqimjon/backup:mssql .
#
# Note: This driver exports data via BCP (CSV per table).
#       For a full schema+data export, consider mounting sqlpackage separately.
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:22.04

ENV BACKUP_DRIVER=mssql
ENV DEBIAN_FRONTEND=noninteractive

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
        bash \
        curl \
        wget \
        zip \
        unzip \
        ca-certificates \
        gnupg \
        apt-transport-https \
        coreutils \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

# rclone
RUN curl -fsSL https://rclone.org/install.sh | bash

# Microsoft SQL tools (sqlcmd + bcp)
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] \
             https://packages.microsoft.com/ubuntu/22.04/prod jammy main" \
        > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y mssql-tools18 unixodbc-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="$PATH:/opt/mssql-tools18/bin"

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