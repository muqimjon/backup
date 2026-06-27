# Zaxira guides

Step-by-step guides for getting the credentials each integration needs.
Everything is configured in the **web UI** — these pages just show *where to get* the values.

New here? Start with the **[5-minute walkthrough in the README](../../README.md#-your-first-backup-5-minutes)**
(destination → project → sources → job → run → restore).

> **Tip — auto-discovery:** run the agent with the host Docker socket mounted read-only
> (`-v /var/run/docker.sock:/var/run/docker.sock:ro`) and it finds the databases running next to
> it and lists them in the UI as *review* sources — confirm them instead of typing each by hand.

## No hub? Run standalone
- [Run backups without the hub (.env mode)](standalone.md) — the agent (or the lean
  `muqimjon/backup:*` images) backs up from `.env` on its own cron, no web hub required.

## Notifications
- [Email (SMTP)](notifications-email.md) — get an SMTP host/user/app-password
- [Telegram bot](notifications-telegram.md) — create a bot and link chats
- [Webhook](notifications-webhook.md) — the JSON payload we POST

## Destinations (where backups are uploaded)
Everything is powered by **rclone** — start here if your provider isn't listed:
- [Using rclone (the universal path)](rclone.md) — paste any of rclone's 70+ backends

Per-provider:
- [Google Drive](destination-google-drive.md) — one-button OAuth
- [Amazon S3](destination-s3.md)
- [MinIO](destination-minio.md)
- [Backblaze B2](destination-backblaze-b2.md)
- [SFTP / SSH](destination-sftp.md)
- [WebDAV — Nextcloud / Yandex / Koofr](destination-webdav.md)
- [OneDrive](destination-onedrive.md) — one-button OAuth
- **Dropbox** & **Yandex Disk** — now one-button OAuth too (Destinations → Dropbox / Yandex Disk)

> **DigitalOcean Spaces, Cloudflare R2, Wasabi** use the **S3** form — they all speak the S3 API.
> Just use their endpoint + access key + secret key.
