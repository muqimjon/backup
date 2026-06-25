import { BackupEngine, RemoteType, RunStatus, RunType } from './models';

export const engineLabel = (e: BackupEngine) =>
  ({ 0: 'PostgreSQL', 1: 'MySQL', 2: 'MSSQL', 3: 'MinIO / S3' })[e] ?? 'Unknown';

export const remoteTypeLabel = (t: RemoteType) =>
  ({ 0: 'Google Drive', 1: 'S3-compatible', 2: 'Custom (rclone)', 3: 'Backblaze B2', 4: 'SFTP', 5: 'WebDAV' })[t] ?? 'Unknown';

export const runTypeLabel = (t: RunType) =>
  ({ 0: 'Backup', 1: 'Upload', 2: 'Cleanup', 3: 'Drill', 4: 'Restore', 5: 'Test' })[t] ?? '—';

export const statusLabel = (s: RunStatus) =>
  ({ 0: 'Running', 1: 'OK', 2: 'Failed' })[s] ?? '—';

export const statusClass = (s: RunStatus) =>
  ({ 0: 'run', 1: 'ok', 2: 'fail' })[s] ?? '';

export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
