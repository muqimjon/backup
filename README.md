# 🗄️ Zaxira — Universal Backup Platform

Zaxira backs up your databases and storage **automatically, on a schedule**, and uploads the
copies to any cloud — then proves they can actually be restored.

It has two parts:

- **The Hub** — a web app where you set everything up and watch it run.
- **The Agent (zaxira)** — a small worker that sits next to your data and does the actual backups.

You install the Hub once, run an Agent next to each server you want to protect, and manage
everything from the browser. No SSH-ing into machines, no editing config files by hand.

```
   Browser ──▶  HUB (web UI + brain)  ◀──▶  AGENT  ──▶  your DB / storage
                      :8080                 (zaxira)         │
                        │                       │            ▼
                        └── tells the agent ────┘     dump → zip → upload ──▶  ☁️ cloud
                            what & when to back up
```

---

## 🚀 Quick start

```bash
cd deploy
cp .env.example .env        # set JWT_KEY, HUB_TOKEN and an admin password
docker compose up --build   # Hub UI → http://localhost:8080  (login: admin / admin)
```

That single command starts the **Hub** and one local **Agent**. Open the UI, create a project,
add your database, pick a destination — and you're backing up.

Optional monitoring stack (Prometheus + Grafana on `:3000`):

```bash
docker compose --profile metrics up
```

---

## 🧠 The mental model

Everything in the Hub follows one simple chain:

```
Project  ─contains─▶  Sources        (the things to back up: a database, a bucket…)
   │
   └──used by──▶  Job  ─sends to─▶  Destination   on a  Schedule
```

- **Project** — a group of related data that belongs together (e.g. an app's PostgreSQL database
  **and** its MinIO image bucket). Everything in a project is backed up together as **one
  consistent, point-in-time version**, so a restore never gives you a database that points at
  images that don't exist yet.
- **Source** — one thing to back up: a PostgreSQL/MySQL database, or an S3/MinIO bucket.
- **Destination** — where copies go: Google Drive, S3, Backblaze B2, SFTP, WebDAV… (70+ clouds).
- **Job** — ties a project's sources to a destination and a schedule. One click restores the
  whole project to any past version.

---

## ✅ Your first backup (5 minutes)

After `docker compose up`, open **http://localhost:8080** (login `admin` / `admin`) and follow the
chain above, top to bottom:

1. **Add a destination** — *Settings → Destinations*. Pick a cloud and enter its credentials:
   the no-OAuth options (Backblaze B2, S3-compatible, SFTP, WebDAV) just need a key/secret;
   Google Drive · OneDrive · Dropbox · Yandex are a one-click **Connect**. Where to get each
   value is in [`docs/guides/`](docs/guides/README.md).
2. **Create a project** — *Projects → + Add project* (e.g. `myapp`).
3. **Add its sources** — inside the project, *+ Source*: a PostgreSQL/MySQL database or an
   S3/MinIO bucket (host, port, user, password, database/bucket). **Shortcut:** if an agent runs
   on the same server with the Docker socket mounted, it **auto-discovers** the databases there —
   they appear pre-filled as *review* sources; just check the details and **Confirm**.
4. **Create a job** — *Jobs → + Add job*: choose the project → its sources (default: all) → the
   destination → a schedule (e.g. *Every day at 02:00*, or type cron). Save.
5. **Run & verify** — on the job click **Run now** and watch it in *History*. Then turn on a
   **Restore-drill** (job schedule, or the per-version *Drill* button) so Zaxira restores the
   backup into a throwaway database and marks the version **Verified** — proof it really restores.

**To restore later:** open the job's **Versions**, pick a point in time, and click **Restore** —
every source in the project rolls back together to that exact moment.

> Running the agent on another server? See [The Agent](#-the-agent-zaxira) below. Want no hub at
> all (pure `.env` cron)? See [Standalone](docs/guides/standalone.md) and
> [`docker-compose.example.yml`](docker-compose.example.yml) for a full-configuration example.

---

## 🖥️ The Hub

The Hub is the control panel. It's a .NET 10 web app with an Angular UI, talks to the agents,
stores its settings in a small SQLite file, and serves everything on **port 8080**.
Default login is **admin / admin** (change it in `.env`).

What you do in the Hub:

| Page | What it's for |
|---|---|
| **Dashboard** | At-a-glance health: last backup, successes/failures, restore-drill status. |
| **Projects** | Create a project, then add the sources (databases, buckets) that belong to it. |
| **Jobs** | Pick a project → choose its sources (default: all) → a destination → a schedule. |
| **History** | Every backup, upload, cleanup, restore and drill, live as it happens. |
| **Settings** | Three tabs: **Destinations**, **Agents**, **Notifications**. |

### Highlights

- **Friendly schedules (or cron).** When you create a job you don't have to know cron. Pick
  *Every day at 02:00*, *Every Sunday at 04:00*, *Every hour*, etc. — the Hub shows the resulting
  cron line so power users can verify or switch to **Custom (cron)** and type `0 2 * * *` directly.
- **One-version restore.** Choose a single version (e.g. "1 week ago") and **all** of the
  project's sources are restored together to that exact moment. Per-source restore is available
  for advanced cases.
- **Easy Google Drive.** Connecting Google Drive normally means wrestling with OAuth. The Hub
  gives you a guided **one-time setup** (it shows the exact redirect URL with a copy button), then
  every Drive destination is a single **Connect** click. Prefer zero cloud setup? Paste a token
  from `rclone authorize "drive"` instead.
- **Restore-drills.** The Hub can periodically restore a backup into a throwaway database to
  **prove** it's restorable — so you find out about a broken backup *before* you need it.
- **Notifications.** Email (your own SMTP), Telegram bot, or a webhook — on failure, on every
  run, or never. Nothing is sent through us; secrets are encrypted at rest.

---

## 🤖 The Agent (zaxira)

The Agent is the worker. It's a small Alpine container (~80 MB) that runs **next to your data**
(same server / same Docker network) and carries the actual backup tools: `pg_dump`,
`mysqldump`, the MinIO client `mc`, plus **rclone** for uploads.

How it works:

1. You run the agent with just two things: the **Hub URL** and a **shared token** (`HUB_TOKEN`).
2. On start it **registers itself** with the Hub and appears under **Settings → Agents**.
3. It polls the Hub for instructions: *run a backup now*, *restore this version*, *test this
   destination*, etc. — and reports the result back, which you see live in **History**.

You never connect back to the box. Configure it once in compose, manage it from the Hub.

```yaml
# the agent service in deploy/docker-compose.yml
agent:
  image: muqimjon/zaxira:latest
  environment:
    HUB_URL: http://hub:8080
    HUB_TOKEN: ${HUB_TOKEN}      # the same secret the Hub knows
    AGENT_NAME: local-agent
  extra_hosts:
    - "host.docker.internal:host-gateway"   # so it can reach a DB on the host
```

### Two ways to set up an agent

- **Unconfigured (managed from the Hub).** Give it only `HUB_URL` + `HUB_TOKEN`. It shows up in
  the Hub and you create projects, sources and jobs from the browser.
- **Pre-configured (adopt).** If the compose file already describes a job (database, schedule,
  destination), the agent **pushes that setup to the Hub once** on first connect — the project,
  its sources and destination appear automatically, ready to manage. "Write it once in compose,
  run it from the Hub."

### Auto-discovery & reset

- **Auto-discovery (opt-in).** Mount the host Docker socket read-only and the agent finds the
  databases and object stores running next to it, then lists them in the Hub as **pending sources**
  for you to review and confirm — no hand-entering each one. It only *reads* container metadata.

  ```yaml
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro   # enables auto-discovery
  ```

- **Reset.** Hub commands always win and persist (the agent keeps running them even if the Hub
  goes offline). **Reset** on the Agents page is the escape hatch: the agent discards the
  Hub-applied state and re-uploads its own startup config, then carries on Hub-managed.

### Many servers, many agents

Run an agent on every server you want to protect. Each registers independently, so several
unrelated projects on different machines are backed up side by side — each its own consistent
unit.

---

## 🔒 What every backup gives you

- **Consistent versions** — all sources in a project share one timestamp; a restore is a true
  snapshot, never a mismatched mix.
- **Compression & encryption** — zip level 1–9, optional AES-256 password.
- **Integrity checks** — every archive is size- and zip-tested before it counts as a success.
- **Retention** — keep N copies locally and M in the cloud; the oldest are pruned automatically,
  per source (so a DB dump and its paired bucket snapshot are kept together).
- **Catch-up** — if the machine was off when a backup was due, the agent runs it on next start.

---

## ☁️ Destinations

Backups upload via **rclone**, so almost anything works. The simplest free options need no OAuth
at all — just a key or password:

| Destination | What you need |
|---|---|
| **Backblaze B2** | Account ID + application key (10 GB free) |
| **SFTP / SSH** | host + user + password (or a private key) |
| **WebDAV** | URL + user + password (Nextcloud, ownCloud…) |
| **S3-compatible** | endpoint + access/secret key (AWS, MinIO, R2, Wasabi…) |
| **Google Drive / OneDrive / Dropbox / Yandex** | guided OAuth, set up once |
| **Custom (rclone)** | paste any `rclone.conf` block — 70+ backends |

---

## 🗂️ Repo layout

```
backup/
├── api/        .NET 10 Hub (Clean Architecture, CQRS, EF Core + SQLite, SignalR)
├── web/        Angular UI (standalone components, signals, EN/RU/UZ)
├── workers/    the Agent (bash scripts + Docker image)
├── deploy/     docker-compose, Dockerfiles, .env.example
└── docs/        extra notes (e.g. Google OAuth)
```

Key `.env` settings (in `deploy/.env`):

| Variable | Meaning |
|---|---|
| `JWT_KEY` | secret that signs login tokens |
| `HUB_TOKEN` | shared secret between the Hub and its agents |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | first admin login (default admin / admin) |
| `AGENT_NAME` / `PROJECT_NAME` | names for the bundled local agent |
| `TZ` | timezone for schedules (e.g. `Asia/Tashkent`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional, for one-click Google Drive |

---

## 🔧 Standalone agent (advanced, no Hub)

The agent can also run completely on its own — configured purely with environment variables and
its own `rclone.conf`, with no Hub at all. This is the original lightweight mode and is still
supported; see [`docs/`](docs/) and `deploy/` for the full environment-variable reference
(`PG_*`, `MYSQL_*`, `MINIO_*`, `BACKUP_SCHEDULE`, `MAX_REMOTE_BACKUPS`, …).

> ⚠️ **Test your restore.** A backup you've never restored is a guess, not a backup. The Hub's
> restore-drills do this for you automatically — turn one on.

---

## 📝 License

MIT
