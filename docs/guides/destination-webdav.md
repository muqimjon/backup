# WebDAV — Nextcloud, ownCloud, Yandex, Koofr

WebDAV covers self-hosted clouds and several providers that expose a WebDAV endpoint.

## Nextcloud / ownCloud

1. Find your WebDAV URL — Nextcloud Files → settings (bottom-left) shows it:
   `https://cloud.example.com/remote.php/dav/files/USERNAME/`
2. Best practice: create an **app password** (Settings → Security → *Create new app
   password*) instead of your login password.
3. **Destinations → Add destination → WebDAV**
   - **URL:** the WebDAV URL above
   - **Vendor:** Nextcloud (or ownCloud)
   - **Username / Password:** your user + app password
   - **Folder path:** `backups/myapp`

## Yandex Disk (via WebDAV)

- **URL:** `https://webdav.yandex.ru`
- **Vendor:** Other
- **Username:** your Yandex login
- **Password:** an **app password** from <https://id.yandex.com/security/app-passwords>
  (regular password won't work with 2FA)

## Koofr

- **URL:** `https://app.koofr.net/dav/Koofr`
- **Vendor:** Other
- **Username:** your Koofr email
- **Password:** an app password from Koofr **Preferences → Password → App passwords**

> Passwords are stored using rclone's reversible obscure format (encrypted at rest).
