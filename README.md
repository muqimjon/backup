# 🗄️ Universal Backup Service

Automatic, scheduled backup service packaged as Docker images.  
Dumps your data, compresses it (optionally encrypted), and uploads it to any cloud storage via **rclone** — with local and remote retention management built in.

> **🆕 Zaxira platform (web UI).** These worker images can now run standalone (env config, below)
> **or** be driven from a web control plane. The hub gives you: one-button Google Drive OAuth,
> a UI to define sources/destinations/schedules/retention, live run history, Prometheus/Grafana
> metrics, and **automated restore-drills** that prove your backups are restorable. Deploy the whole
> stack with one `docker compose up`.
>
> ```bash
> cd deploy && cp .env.example .env   # set JWT_KEY, HUB_TOKEN, admin password
> docker compose up --build           # hub UI → http://localhost:8080
> docker compose --profile metrics up # + Prometheus & Grafana (http://localhost:3000)
> ```
>
> Add an agent on any server → it registers itself → define a job in the UI → it starts backing up.
> No SSH back to the box. See [`deploy/`](deploy/) and [`docs/google-oauth.md`](docs/google-oauth.md).
> Repo layout: `workers/` (these images) · `api/` (.NET 10 hub) · `web/` (Angular UI) · `deploy/`.

---

## ✨ Features

| Feature | Detail |
|---|---|
| **Multiple sources** | PostgreSQL, MySQL/MariaDB, MSSQL, MinIO/S3 |
| **Any cloud destination** | Google Drive, S3, Backblaze B2, SFTP, and 70+ via rclone |
| **Separate schedules** | backup · upload · cleanup can run on different crons |
| **Upload retry** | files stay local until upload succeeds; retried on next run |
| **Local retention** | `MIN_LOCAL_BACKUPS` / `MAX_LOCAL_BACKUPS` |
| **Remote retention** | `MAX_REMOTE_BACKUPS` — auto-deletes oldest from cloud |
| **Encryption** | AES-256 zip password via `BACKUP_PASSWORD` |
| **Integrity check** | every archive is size- and zip-tested before it counts as success |
| **Alerts** | Telegram / webhook on failure + startup auth check + dead-man's-switch ping |
| **Health probe** | Docker `HEALTHCHECK` flips unhealthy when backups go stale |
| **One-command restore** | `restore.sh` for postgres & mysql |
| **Missed-run recovery** | on container restart, catches up missed backups automatically |
| **Lightweight** | Alpine-based (~80 MB), Ubuntu only for MSSQL |

---

## 📦 Image Tags

| Tag | Base | Backup tools |
|---|---|---|
| `backup:postgres` | Alpine | pg_dump |
| `backup:mysql` | Alpine | mysqldump (MySQL & MariaDB) |
| `backup:mssql` | Ubuntu 22.04 | sqlcmd + bcp |
| `backup:minio` | Alpine | mc (MinIO / S3-compatible) |
| `backup:postgres-minio` | Alpine | pg_dump + mc |

> All images include **rclone** and **supercronic**.

---

## 🚀 Quick Start

### 1. Get your rclone config

```bash
# Configure rclone interactively (run locally, not in Docker)
rclone config
# The config file is at: ~/.config/rclone/rclone.conf
```

### 2a. Run with `docker run`

```bash
docker run -d \
  -e PG_HOST=myhost \
  -e PG_USER=myuser \
  -e PG_PASSWORD=mypassword \
  -e PG_DATABASE=mydb \
  -e RCLONE_REMOTE=gdrive \
  -e RCLONE_PATH=backups/myapp \
  -v $(pwd)/rclone.conf:/etc/rclone/rclone.conf:ro \
  -v $(pwd)/backup-data:/backup \
  muqimjon/backup:postgres
```

That's it — the container runs an initial backup immediately and then follows `BACKUP_SCHEDULE` (default: daily at 02:00).

### 2b. Run with `docker-compose` (minimal)

```yaml
services:
  backup:
    image: muqimjon/backup:postgres
    restart: always
    environment:
      PG_HOST: postgres
      PG_USER: myuser
      PG_PASSWORD: mypassword
      PG_DATABASE: mydb
      RCLONE_REMOTE: gdrive
      RCLONE_PATH: backups/myapp
    volumes:
      - ./data/backup:/backup
      - ./rclone.conf:/etc/rclone/rclone.conf:ro
    depends_on:
      - postgres
```

---

## ⚙️ Full Configuration

```yaml
services:
  backup:
    image: muqimjon/backup:postgres
    restart: always
    environment:
      # ── Identity ──────────────────────────────────────────────────────────
      PROJECT_NAME: myapp           # prefix in every backup filename
      TZ: Asia/Tashkent             # timezone for schedules and log timestamps

      # ── Database (PostgreSQL) ─────────────────────────────────────────────
      PG_HOST: postgres             # hostname / IP
      PG_PORT: 5432                 # default: 5432
      PG_USER: myuser
      PG_PASSWORD: mypassword
      PG_DATABASE: mydb

      # ── Schedules (standard cron syntax) ─────────────────────────────────
      BACKUP_SCHEDULE:  "0 2 * * *"   # when to create the dump
      UPLOAD_SCHEDULE:  "0 */6 * * *" # when to upload  (empty = after each backup)
      CLEANUP_SCHEDULE: "0 7 * * *"   # when to cleanup (empty = after each upload)

      # ── Local storage ─────────────────────────────────────────────────────
      BACKUP_DIR: /backup           # where zip files are stored inside the container
      MIN_LOCAL_BACKUPS: 2          # never delete below this count, even if uploaded
      MAX_LOCAL_BACKUPS: 5          # hard cap — oldest deleted regardless of status

      # ── Remote storage ────────────────────────────────────────────────────
      RCLONE_REMOTE: gdrive         # rclone remote name (from rclone.conf)
      RCLONE_PATH: backups/myapp    # folder path inside the remote
      RCLONE_CONFIG: /etc/rclone/rclone.conf
      MAX_REMOTE_BACKUPS: 30        # oldest remote files deleted after this count

      # ── Compression & encryption ──────────────────────────────────────────
      COMPRESSION_LEVEL: 6          # zip level: 1 (fast) … 9 (smallest)
      BACKUP_PASSWORD: "str0ngP@ss" # optional — enables AES-256 zip encryption

    volumes:
      - ./data/backup:/backup
      - ./rclone.conf:/etc/rclone/rclone.conf:ro
```

---

## 🗂️ Environment Variable Reference

### Common (all images)

| Variable | Default | Description |
|---|---|---|
| `PROJECT_NAME` | `backup` | Prefix in backup filenames |
| `TZ` | `UTC` | Container timezone |
| `BACKUP_DIR` | `/backup` | Local directory for zip files |
| `BACKUP_SCHEDULE` | `0 2 * * *` | Cron schedule for creating dumps |
| `UPLOAD_SCHEDULE` | *(empty)* | Cron for upload; empty = upload after each backup |
| `CLEANUP_SCHEDULE` | *(empty)* | Cron for cleanup; empty = cleanup after each upload |
| `COMPRESSION_LEVEL` | `6` | Zip compression level (1–9) |
| `BACKUP_PASSWORD` | *(empty)* | If set, zips are AES-256 encrypted |
| `MIN_LOCAL_BACKUPS` | `2` | Minimum files to keep locally |
| `MAX_LOCAL_BACKUPS` | `5` | Maximum files to keep locally (hard cap) |
| `RCLONE_REMOTE` | *(required)* | rclone remote name |
| `RCLONE_PATH` | *(required)* | Path inside the remote |
| `RCLONE_CONFIG` | `/etc/rclone/rclone.conf` | Path to rclone config file |
| `RCLONE_CONFIG_CONTENT` | *(empty)* | Paste config content directly (alternative to file) |
| `MAX_REMOTE_BACKUPS` | `30` | Maximum files to keep in cloud storage |
| `MIN_BACKUP_BYTES` | `256` | A fresh archive smaller than this is treated as a failed backup |

### Notifications & monitoring (all images, all optional)

| Variable | Default | Description |
|---|---|---|
| `NOTIFY_ON` | `failure` | `failure` = alert only on errors · `always` = also on success · `never` = silent |
| `NOTIFY_TELEGRAM_TOKEN` | *(empty)* | Telegram bot token (from [@BotFather](https://t.me/BotFather)) |
| `NOTIFY_TELEGRAM_CHAT_ID` | *(empty)* | Chat/channel ID to send alerts to |
| `NOTIFY_WEBHOOK_URL` | *(empty)* | Generic endpoint — receives `{level, project, message}` JSON on each alert |
| `HEARTBEAT_URL` | *(empty)* | Dead-man's-switch ping URL (e.g. [healthchecks.io](https://healthchecks.io)); pinged on success, `<url>/fail` on failure |
| `SMTP_HOST` | *(empty)* | SMTP server, e.g. `smtp.gmail.com`. Enables email alerts when set with `EMAIL_TO`/`EMAIL_FROM` |
| `SMTP_PORT` | `587` | `465` = implicit TLS, anything else = STARTTLS |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | SMTP login (Gmail: use an [App Password](https://myaccount.google.com/apppasswords)) |
| `EMAIL_FROM` | *(empty)* | Sender address |
| `EMAIL_TO` | *(empty)* | Recipient(s) — comma-separated for multiple |

> Telegram **and** email can run together — every channel that's configured fires
> on each alert. With notifications on you learn about a broken token **the moment
> it breaks** — including a startup auth check that fires the instant the container
> can't reach the remote. A Docker `HEALTHCHECK` also turns **unhealthy** when the
> last backup is older than ~2 schedule intervals.

> **Per-driver retention.** `MIN_LOCAL_BACKUPS` / `MAX_LOCAL_BACKUPS` /
> `MAX_REMOTE_BACKUPS` are applied **per source**, not over a flat pool. With the
> combined `postgres-minio` image, "keep 5" means 5 postgres **and** 5 minio
> archives — kept paired by timestamp, so every retained DB dump has its matching
> object-storage snapshot.

### PostgreSQL (`backup:postgres`, `backup:postgres-minio`)

| Variable | Default | Description |
|---|---|---|
| `PG_HOST` | *(required)* | Database host |
| `PG_PORT` | `5432` | Database port |
| `PG_USER` | *(required)* | Database user |
| `PG_PASSWORD` | *(required)* | Database password |
| `PG_DATABASE` | *(required)* | Database name |

### MySQL / MariaDB (`backup:mysql`)

| Variable | Default | Description |
|---|---|---|
| `MYSQL_HOST` | *(required)* | Database host |
| `MYSQL_PORT` | `3306` | Database port |
| `MYSQL_USER` | *(required)* | Database user |
| `MYSQL_PASSWORD` | *(required)* | Database password |
| `MYSQL_DATABASE` | *(required)* | Database name |

### MSSQL (`backup:mssql`)

| Variable | Default | Description |
|---|---|---|
| `MSSQL_HOST` | *(required)* | SQL Server host |
| `MSSQL_PORT` | `1433` | SQL Server port |
| `MSSQL_USER` | *(required)* | Login name |
| `MSSQL_PASSWORD` | *(required)* | Password |
| `MSSQL_DATABASE` | *(required)* | Database name |

> **Note:** MSSQL exports tables to CSV using BCP. For a full schema + data export (.bacpac), install and use [sqlpackage](https://learn.microsoft.com/en-us/sql/tools/sqlpackage) separately.

### MinIO / S3 (`backup:minio`, `backup:postgres-minio`)

| Variable | Default | Description |
|---|---|---|
| `MINIO_ENDPOINT` | *(required)* | e.g. `http://minio:9000` or `https://s3.amazonaws.com` |
| `MINIO_ACCESS_KEY` | *(required)* | Access key / AWS_ACCESS_KEY_ID |
| `MINIO_SECRET_KEY` | *(required)* | Secret key / AWS_SECRET_ACCESS_KEY |
| `MINIO_BUCKET` | *(required)* | Bucket name to backup |
| `MINIO_API` | `S3v4` | API signature version |

---

## 🔄 How It Works

```
Container start
    │
    ├─ setup_rclone   → load rclone config (file or env)
    │
    ├─ check_missed   → if backup overdue → backup.sh immediately
    │                   else             → upload.sh (retry pending files)
    │
    └─ supercronic    → runs cron schedules forever
          │
          ├─ BACKUP_SCHEDULE  → backup.sh
          │       │  creates  {PROJECT_NAME}_{driver}_{timestamp}.zip
          │       └─ (if no UPLOAD_SCHEDULE) → upload.sh
          │
          ├─ UPLOAD_SCHEDULE  → upload.sh (optional, independent)
          │       │  uploads files newer than last successful upload
          │       │  prunes remote if count > MAX_REMOTE_BACKUPS
          │       └─ (if no CLEANUP_SCHEDULE) → cleanup.sh
          │
          └─ CLEANUP_SCHEDULE → cleanup.sh (optional, independent)
                  removes local files respecting MIN / MAX limits
```

**Filename format:** `{PROJECT_NAME}_{driver}_{YYYYMMDD_HHMMSS}.zip`  
Example: `myapp_postgres_20240815_020001.zip`

**Combined image (`postgres-minio`)** produces two separate files per run:  
`myapp_postgres_20240815_020001.zip` + `myapp_minio_20240815_020002.zip`

---

## 🏗️ Project Structure

```
backup/
├── Makefile                     # build & push helpers
├── docker-compose.example.yml   # usage examples
├── README.md
│
├── scripts/                     # shared across all images
│   ├── lib.sh                   # shared utilities (log, state_get/set)
│   ├── entrypoint.sh            # init, missed-task check, cron setup
│   ├── backup.sh                # orchestrates driver + compression + verify
│   ├── upload.sh                # rclone upload + remote retention
│   ├── cleanup.sh               # local retention
│   ├── healthcheck.sh           # Docker HEALTHCHECK probe
│   ├── restore.sh               # one-command restore (postgres / mysql)
│   └── drivers/
│       ├── postgres.sh          # pg_dump → stdout
│       ├── mysql.sh             # mysqldump → stdout
│       ├── mssql.sh             # bcp export → tar → stdout
│       └── minio.sh             # mc mirror → tar → stdout
│
├── postgres/Dockerfile
├── mysql/Dockerfile
├── mssql/Dockerfile
├── minio/Dockerfile
└── postgres-minio/Dockerfile
```

---

## 🔧 Building Locally

```bash
# Clone the repo
git clone https://github.com/muqimjon/backup.git
cd backup

# Build a single image (context must be repo root)
docker build -f postgres/Dockerfile -t backup:postgres .

# Or use the Makefile
make postgres
make all                    # build every tag
make IMAGE=myname/backup all
make IMAGE=myname/backup push
```

---

## 🤝 Adding a New Driver

1. Create `scripts/drivers/yourdb.sh`
2. The script must **write data to stdout** (backup.sh pipes it to zip):

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${YOURDB_HOST:?YOURDB_HOST is required}"
# ... validate other required vars

exec yourdb-dump-tool \
    --host="${YOURDB_HOST}" \
    --output=stdout
```

3. Create `yourdb/Dockerfile` (copy an existing one, adjust the client install and `BACKUP_DRIVER`).
4. Add a `make` target in `Makefile`.
5. Document env vars in README.

---

## 📋 Restore

The image ships a `restore.sh` helper (postgres & mysql). It auto-picks the
newest archive and handles the encryption password for you:

```bash
# Restore the newest postgres backup into the configured DB
docker exec -it mybackup restore.sh postgres

# Restore a specific file
docker exec -it mybackup restore.sh postgres myapp_postgres_20260624_020000.zip
```

Manual restore (any environment):

```bash
# PostgreSQL
unzip -p backup.zip | psql -h myhost -U myuser -d mydb

# MySQL
unzip -p backup.zip | mysql -h myhost -u myuser -p mydb

# MinIO (extract then re-upload)
unzip backup.zip -d ./restore/
mc mirror ./restore/ myminio/mybucket

# Encrypted backup
unzip -P "$BACKUP_PASSWORD" -p backup.zip | psql ...
```

> ⚠️ **Test your restore.** A backup you have never restored is a guess, not a
> backup. Try it once against a throwaway database.

---

## ☁️ Google Drive setup (avoid the #1 failure mode)

Google Drive over OAuth is the most common destination — and its tokens are the
most common reason uploads silently die. Two things matter:

**1. Publish your OAuth app to "Production".**
If your OAuth client sits in **Testing** mode, Google **revokes the refresh
token after 7 days** — backups upload for a week, then every upload fails with
`invalid_grant`. Fix it once:

> Google Cloud Console → **APIs & Services → OAuth consent screen** →
> **Publishing status: Testing → "PUBLISH APP" → In production**.
> (For a personal Drive you do not need Google's verification — just confirm the
> "unverified app" dialog. Then regenerate the token with `rclone config reconnect`.)

**2. For unattended servers, prefer a Service Account — no tokens to expire.**
A service account authenticates with a JSON key that never expires and needs no
browser. Best for headless backups.

```ini
# rclone.conf
[gdrive]
type = drive
scope = drive
service_account_file = /etc/rclone/sa.json
# To drop files in a normal Drive folder, share that folder with the service
# account's email and set:
# root_folder_id = <folder id from the Drive URL>
```

Mount the key alongside the config:

```yaml
    volumes:
      - ./rclone.conf:/etc/rclone/rclone.conf:ro
      - ./sa.json:/etc/rclone/sa.json:ro
```

> The container always copies your config to a writable location internally, so
> mounting `rclone.conf` **read-only (`:ro`) is correct and recommended** —
> token refreshes still work, and your host file is never modified.

---

## 📝 License

MIT
