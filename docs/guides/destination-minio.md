# MinIO

MinIO is S3-compatible, so use the **S3-compatible** destination form.

## 1. Get credentials

- In the MinIO Console → **Identity → Service Accounts → Create** (or use your root
  `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` for testing).
- Note the **Access Key** and **Secret Key**.
- Create a **bucket** (Buckets → Create Bucket).

## 2. Add the destination

- **Destinations → Add destination → S3-compatible**
- **Endpoint:** your MinIO URL, e.g. `https://minio.example.com:9000`
  (use `http://` if TLS isn't configured)
- **Access key / Secret key:** from step 1
- **Region:** `us-east-1` (MinIO ignores it but rclone likes a value)
- **Folder path:** `bucket-name/backups/myapp`
- Save.

> If MinIO runs on the same host as the agent, reach it at
> `http://host.docker.internal:9000`.
