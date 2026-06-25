# Run backups without the hub (standalone .env mode)

You don't need the web hub running to make backups. The **same agent image** works two ways,
decided at startup by whether `HUB_URL` is set:

- **No `HUB_URL`** → standalone mode: the agent reads everything from **`.env`** and runs on its
  own cron (exactly like the classic `muqimjon/backup:*` images). No hub, no extra cost.
- **`HUB_URL` set** → hub mode: the agent is managed from the web UI.

> Prefer a smaller image? The single-source images `muqimjon/backup:postgres` · `:mysql` ·
> `:minio` · `:postgres-minio` are leaner (one client each) and run env-only too.

## Quick start (docker run)

```bash
docker run -d --restart=always --name myapp-backup \
  -e BACKUP_DRIVER=postgres \
  -e PROJECT_NAME=myapp \
  -e PG_HOST=db -e PG_PORT=5432 -e PG_USER=postgres -e PG_PASSWORD=secret -e PG_DATABASE=myapp \
  -e BACKUP_SCHEDULE="0 2 * * *" \
  -e MAX_LOCAL_BACKUPS=7 -e MAX_REMOTE_BACKUPS=30 \
  -e RCLONE_REMOTE=remote -e RCLONE_PATH=backups/myapp \
  -v /srv/backups:/backup \
  -v /srv/rclone.conf:/etc/rclone/rclone.conf:ro \
  muqimjon/zaxira
```

(No `HUB_URL` → it logs "standalone (.env) mode" and runs the cron.)

## Environment reference

**Source (pick one driver):**
| Driver | Vars |
|---|---|
| `BACKUP_DRIVER=postgres` | `PG_HOST` `PG_PORT` `PG_USER` `PG_PASSWORD` `PG_DATABASE` |
| `BACKUP_DRIVER=mysql` | `MYSQL_HOST` `MYSQL_PORT` `MYSQL_USER` `MYSQL_PASSWORD` `MYSQL_DATABASE` |
| `BACKUP_DRIVER=minio` | `MINIO_ENDPOINT` `MINIO_ACCESS_KEY` `MINIO_SECRET_KEY` `MINIO_BUCKET` |
| `BACKUP_DRIVER=postgres-minio` | both postgres + minio vars (two sources, paired retention) |

**Schedules (cron):** `BACKUP_SCHEDULE` (default `0 2 * * *`), optional `UPLOAD_SCHEDULE`,
`CLEANUP_SCHEDULE`, `DRILL_SCHEDULE`. If upload/cleanup schedules are omitted, they run right
after each backup.

**Retention / archive:** `MIN_LOCAL_BACKUPS` (default 2) · `MAX_LOCAL_BACKUPS` (5) ·
`MAX_REMOTE_BACKUPS` (30) · `COMPRESSION_LEVEL` (1–9, default 6) · `BACKUP_PASSWORD` (AES-256 zip).

**Destination (rclone):** mount your config to `/etc/rclone/rclone.conf` (read-only is fine) **or**
pass `RCLONE_CONFIG_CONTENT` with the file's text. Set `RCLONE_REMOTE` (the remote name in that
config) and `RCLONE_PATH` (the folder). Build the config once with `rclone config` — see
[the rclone guide](rclone.md).

**Notifications (optional, env-based):** `NOTIFY_ON` (failure|always|never) ·
`NOTIFY_TELEGRAM_TOKEN` + `NOTIFY_TELEGRAM_CHAT_ID` · `SMTP_HOST` `SMTP_PORT` `SMTP_USER`
`SMTP_PASS` `EMAIL_FROM` `EMAIL_TO` · `NOTIFY_WEBHOOK_URL` · `HEARTBEAT_URL`.

**Restore (manual):** `docker exec -it myapp-backup restore.sh postgres` (newest archive) or
`restore.sh postgres <file.zip>`.

## When to add the hub later

Set `HUB_URL` + `HUB_TOKEN` on the same agent and it switches to hub mode — web UI manages
sources, destinations, schedules, versions, restores and notifications. Nothing else changes.
