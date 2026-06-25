# Using rclone (the universal destination)

Zaxira uploads with [rclone](https://rclone.org), which supports **70+ cloud
backends**. Most are available as named forms in the UI (S3, B2, SFTP, WebDAV, Google
Drive). For anything else — **OneDrive, Dropbox, pCloud, Yandex Disk, Storj, Mega,
Jottacloud, Box, …** — use the **Custom (rclone)** destination: configure the remote once
with rclone on your computer, then paste its config block into Zaxira.

## 1. Install rclone

- Windows/macOS/Linux: <https://rclone.org/downloads/>
- Or `winget install Rclone.Rclone` / `brew install rclone` / `sudo apt install rclone`

## 2. Create the remote

```bash
rclone config
```

- `n` (new remote) → give it any name, e.g. `mycloud`
- Pick the storage type (e.g. `onedrive`, `dropbox`, `yandex`, `pcloud`, …)
- Follow the prompts. For OAuth providers rclone opens your **browser** to authorize —
  this is where the login happens; Zaxira never sees your password.
- Finish with `q` to quit.

## 3. Copy the config block

```bash
rclone config show mycloud
```

You'll get something like:

```ini
[mycloud]
type = onedrive
token = {"access_token":"...","refresh_token":"...","expiry":"..."}
drive_id = b!xxxx
drive_type = personal
```

## 4. Paste it into Zaxira

- **Destinations → Add destination → Custom (rclone)**
- Give it a name and a folder path (e.g. `backups/myapp`)
- Paste the **whole block** (the `[mycloud]` header is rewritten automatically)
- Save.

That's it — the destination now works like any other. The refresh token is stored
**encrypted** and used to upload your backups.

> Tip: anything you can configure with `rclone config` you can use here. See the full
> backend list at <https://rclone.org/overview/>.
