# OneDrive / Dropbox / Yandex (via rclone)

These use OAuth (a browser login). BackupHub reaches them through the **Custom (rclone)**
destination — you authorize once with rclone, then paste the result.

> A native one-button "Connect" for these is on the roadmap; today the rclone path below
> works for **all** of them and takes about a minute.

## Steps

1. Install rclone — <https://rclone.org/downloads/>
2. Run `rclone config`, add a new remote, pick **onedrive** (or **dropbox**, **yandex**).
3. rclone opens your **browser** to sign in and approve.
4. Show the config:
   ```bash
   rclone config show myonedrive
   ```
5. **Destinations → Add destination → Custom (rclone)** → paste the whole block:
   ```ini
   [myonedrive]
   type = onedrive
   token = {"access_token":"...","refresh_token":"...","expiry":"..."}
   drive_id = b!xxxx
   drive_type = personal
   ```
6. Set a name + folder path → Save.

See the general [rclone guide](rclone.md) for more detail. The refresh token is stored
**encrypted** and refreshed automatically — it won't expire like the old 7-day testing
tokens did.
