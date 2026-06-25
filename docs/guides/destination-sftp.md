# SFTP / SSH

Upload backups to any server you can SSH into (a VPS, a NAS, another box).

## What you need

- **Host** and **port** (default `22`)
- **Username**
- **Either** a password **or** an SSH **key file** that exists on the agent

## Add the destination

- **Destinations → Add destination → SFTP / SSH**
- **Host / Port / Username**
- **Password** — or leave blank and set **Key file path on agent**
  (e.g. `/keys/id_rsa`; mount it into the agent container)
- **Remote path:** an absolute path the user can write to, e.g. `/home/backup/myapp`
- Save.

> Passwords are stored using rclone's reversible obscure format (encrypted at rest in
> BackupHub). For unattended servers an SSH **key file** is the most robust option.

### Mounting a key into the agent

```yaml
# docker-compose.yml (agent service)
volumes:
  - ./keys:/keys:ro
```
Then set the key file path to `/keys/id_rsa`.
