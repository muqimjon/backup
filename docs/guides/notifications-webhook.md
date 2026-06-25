# Webhook notifications

A webhook lets you forward notifications to **any** service — Slack, Discord, Mattermost,
n8n, your own API, etc.

## Configure

- **Settings → Notifications → Webhook**
- Paste the URL and press **Save**.

## Payload

On every notification BackupHub sends an HTTP **POST** with JSON:

```json
{
  "level": "error",          // "success" | "error" | "info"
  "title": "myapp · Backup FAILED",
  "message": "postgres: Backup failed (connection refused)"
}
```

## Slack / Discord

These expect their own JSON shape, so point the webhook at a small relay (n8n, Pipedream,
a Cloud Function) that reshapes `{level,title,message}` into their format. For Discord, for
example, map `message` → `content`.

> Test it from **Settings → Send test**.
