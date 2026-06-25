# Google Drive OAuth setup (one-time)

The "Connect Google Drive" button needs a Google OAuth client. You create it once,
publish it, and paste the credentials into the hub config. After that, anyone using
the UI just clicks the button and authorizes — no tokens to copy.

## 1. Create an OAuth client

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create/select a project.
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → set it up (External), then
   **PUBLISH APP → In production** (so refresh tokens never expire).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URI**: the hub's callback, e.g.
     - dev:  `http://localhost:5080/api/remotes/google/callback`
     - prod: `https://your-host/api/remotes/google/callback`
5. Copy the **Client ID** and **Client secret**.

## 2. Give them to the hub

**Docker (`deploy/.env`):**
```
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
```

**Local dev (`api/src/Zaxira.WebApi/appsettings.json` or user-secrets):**
```json
"Google": { "ClientId": "xxxx.apps.googleusercontent.com", "ClientSecret": "xxxx" }
```

Restart the hub. The redirect URI you registered must match the hub's address exactly.

> Tip: for fully unattended servers a **service account** is even more robust (no
> consent screen, never expires). The current flow uses user OAuth, which is the
> simplest for a single team.
