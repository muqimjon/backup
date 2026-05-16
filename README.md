# 🗄️ Universal Backup Service

Automatic, scheduled backup service packaged as Docker images.  
Dumps your data, compresses it (optionally encrypted), and uploads it to any cloud storage via **rclone** — with local and remote retention management built in.

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
│   ├── backup.sh                # orchestrates driver + compression
│   ├── upload.sh                # rclone upload + remote retention
│   ├── cleanup.sh               # local retention
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

```bash
# PostgreSQL
unzip -p backup.zip | psql -h myhost -U myuser -d mydb

# MySQL
unzip -p backup.zip | mysql -h myhost -u myuser -p mydb

# MinIO (extract then re-upload)
unzip backup.zip -d ./restore/
mc mirror ./restore/ myminio/mybucket

# Encrypted backup — unzip will prompt for password
unzip -p backup.zip | psql ...
```

---

## 📝 License

MIT
