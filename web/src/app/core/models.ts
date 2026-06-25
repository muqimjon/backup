export enum BackupEngine { Postgres = 0, MySql = 1, Mssql = 2, Minio = 3 }
export enum RemoteType { GoogleDrive = 0, S3 = 1 }
export enum RunType { Backup = 0, Upload = 1, Cleanup = 2, Drill = 3 }
export enum RunStatus { Running = 0, Ok = 1, Fail = 2 }
export enum CommandKind { RunBackup = 0, RunDrill = 1, RepullConfig = 2 }

export interface AuthResult { token: string; username: string; role: string; }
export interface AuthUser { username: string; role: string; }

export interface SourceDto {
  id: string; name: string; engine: BackupEngine;
  host: string; port: number; username: string; target: string;
}
export interface CreateSource {
  name: string; engine: BackupEngine; host: string; port: number;
  username: string; secret: string; target: string;
}

export interface RemoteDto { id: string; name: string; type: RemoteType; path: string; }
export interface CreateS3Remote {
  name: string; path: string; endpoint: string;
  accessKey: string; secretKey: string; region: string | null;
}

export interface JobDto {
  id: string; name: string; enabled: boolean;
  sourceId: string; sourceName: string;
  remoteId: string; remoteName: string;
  agentId: string | null;
  backupSchedule: string; uploadSchedule: string | null;
  cleanupSchedule: string | null; drillSchedule: string | null;
  minLocalBackups: number; maxLocalBackups: number;
  maxRemoteBackups: number; compressionLevel: number;
}
export interface CreateJob {
  name: string; sourceId: string; remoteId: string; agentId: string | null;
  backupSchedule: string; uploadSchedule: string | null;
  cleanupSchedule: string | null; drillSchedule: string | null;
  minLocalBackups: number; maxLocalBackups: number;
  maxRemoteBackups: number; compressionLevel: number; backupPassword: string | null;
}

export interface AgentDto {
  id: string; name: string; hostname: string; project: string;
  drivers: string; version: string; lastSeenAt: string | null;
}

export interface RunDto {
  id: string; jobId: string; jobName: string;
  type: RunType; status: RunStatus;
  startedAt: string; finishedAt: string | null;
  bytes: number; message: string | null;
}

export interface RunBroadcast extends RunDto {
  project: string; driver: string;
}

export interface StatsDto {
  agents: number; jobs: number;
  ok24h: number; fail24h: number;
  lastBackupBytes: number;
  lastSuccessAt: string | null;
  lastDrillStatus: RunStatus | null;
  lastDrillAt: string | null;
}
