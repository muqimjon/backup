# Amazon S3

S3 needs only an **access key** and **secret key** — no browser login.

## 1. Create an IAM user + keys

1. AWS Console → **IAM → Users → Create user** (programmatic access).
2. Attach a policy granting access to your bucket (e.g. `AmazonS3FullAccess`, or a
   bucket-scoped policy).
3. Create an **access key** → copy the **Access key ID** and **Secret access key**.
4. Create (or pick) an **S3 bucket**.

## 2. Add the destination

- **Destinations → Add destination → S3-compatible**
- **Endpoint:** `https://s3.amazonaws.com` (or regional, e.g. `https://s3.eu-central-1.amazonaws.com`)
- **Access key / Secret key:** from step 1
- **Region:** e.g. `us-east-1`
- **Folder path:** `bucket-name/backups/myapp`
- Save.

> The same form works for **Cloudflare R2, Wasabi, DigitalOcean Spaces, Backblaze B2 (S3
> mode)** and any S3-compatible storage — just change the **endpoint**.
