# Google Drive

Google Drive is the one provider with a **one-button Connect** in Zaxira. It needs a
one-time OAuth app setup by you (the deployer), then anyone clicks **Connect** and approves.

## Why the one-time setup?

Google requires every app to bring its **own** OAuth client (Client ID + Secret). You
create it once; after that the hub stores the refresh token and reuses it forever.

## 1. Create the OAuth client (once)

1. <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → External → fill the basics →
   **PUBLISH APP → In production**.
   *(Skipping this is what caused the old "token died after 7 days" — Testing mode revokes
   refresh tokens after a week. Production never does.)*
4. **Credentials → Create credentials → OAuth client ID → Web application**.
5. **Authorized redirect URI:** `https://YOUR-HUB/api/remotes/google/callback`
   (dev: `http://localhost:5080/api/remotes/google/callback`).
6. Copy the **Client ID** and **Client secret**.

## 2. Enter them in Zaxira

- **Destinations → Add destination → Google Drive**
- First time it shows **Client ID / Client Secret** fields → paste and **Save credentials**.
  (Already configured? Click **Change credentials** to update them.)

## 3. Connect a Drive

- Click **Connect Google Drive** → Google's consent screen → approve.
- The Drive is linked **automatically** — no token to copy. Done.

> Stored refresh token is encrypted at rest and refreshed automatically.

### Alternative: Service Account (Workspace / Shared Drives)

For Google Workspace with a **Shared Drive**, a service-account JSON key avoids the consent
screen entirely and never expires. Configure it via the **Custom (rclone)** destination
(`type = drive`, `service_account_file = ...`, `team_drive = ...`). Not available for
personal Gmail (service accounts have no usable My Drive storage).
