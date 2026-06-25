# Backblaze B2

B2 is cheap object storage. Use the native **Backblaze B2** destination form.

## 1. Create an application key

1. Backblaze → **Account → Application Keys**.
2. **Add a New Application Key**, restricted to a bucket if you like.
3. Copy the **keyID** and the **applicationKey** (shown once).
4. Create a **bucket** (B2 Cloud Storage → Buckets → Create a Bucket).

## 2. Add the destination

- **Destinations → Add destination → Backblaze B2**
- **Account ID / Key ID:** the `keyID`
- **Application key:** the `applicationKey`
- **Folder path:** `bucket-name/backups/myapp`
- Save.

> You can also use B2 through the **S3-compatible** form with its S3 endpoint
> (`https://s3.<region>.backblazeb2.com`) — both work.
