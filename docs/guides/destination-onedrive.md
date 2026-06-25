# OneDrive

OneDrive now has a **one-button Connect** (like Google Drive). You register a Microsoft
app once; after that anyone clicks **Connect OneDrive** and approves.

## 1. Register an app (once)

1. Go to <https://entra.microsoft.com> → **App registrations → New registration**.
2. Name it (e.g. `BackupHub`). Supported account types: *Accounts in any organizational
   directory and personal Microsoft accounts* (for personal OneDrive).
3. **Redirect URI** → platform **Web** → `https://YOUR-HUB/api/remotes/onedrive/callback`
   (dev: `http://localhost:5080/api/remotes/onedrive/callback`).
4. **API permissions → Add → Microsoft Graph → Delegated**: add `Files.ReadWrite.All` and
   `offline_access`.
5. **Certificates & secrets → New client secret** → copy the **Value** (shown once).
6. From **Overview**, copy the **Application (client) ID**.

## 2. Enter them in BackupHub

- **Destinations → Add destination → OneDrive**
- First time it shows **Client ID / Client Secret** → paste and **Save credentials**.
  (Already set? Click **Change credentials**.)

## 3. Connect

- Click **Connect OneDrive** → Microsoft consent screen → approve.
- The drive is linked **automatically** (BackupHub fetches your `drive_id`/`drive_type` from
  Microsoft Graph and stores the encrypted refresh token — it won't expire).

Works for **personal** OneDrive and **OneDrive for Business / SharePoint** document libraries.

---

## Dropbox / Yandex / others

Those still use the **Custom (rclone)** path — see the [rclone guide](rclone.md): run
`rclone config`, then paste the resulting block into **Destinations → Custom (rclone)**.
