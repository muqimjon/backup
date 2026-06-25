import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AgentDto, BackupVersionDto, CommandKind, CreateB2Remote, CreateCustomRemote, CreateJob,
  CreateS3Remote, CreateSftpRemote, CreateSource, CreateWebDavRemote, JobDto,
  NotificationSettingsDto, RemoteDto, RunDto, SettingsDto, SourceDto, StatsDto,
} from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  sources() { return this.http.get<SourceDto[]>('/api/sources'); }
  createSource(body: CreateSource) { return this.http.post<string>('/api/sources', body); }
  deleteSource(id: string) { return this.http.delete<boolean>(`/api/sources/${id}`); }

  remotes() { return this.http.get<RemoteDto[]>('/api/remotes'); }
  createS3(body: CreateS3Remote) { return this.http.post<string>('/api/remotes/s3', body); }
  createB2(body: CreateB2Remote) { return this.http.post<string>('/api/remotes/b2', body); }
  createSftp(body: CreateSftpRemote) { return this.http.post<string>('/api/remotes/sftp', body); }
  createWebDav(body: CreateWebDavRemote) { return this.http.post<string>('/api/remotes/webdav', body); }
  createCustom(body: CreateCustomRemote) { return this.http.post<string>('/api/remotes/custom', body); }
  deleteRemote(id: string) { return this.http.delete<boolean>(`/api/remotes/${id}`); }
  googleConnect(name: string, path: string) {
    const q = `name=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}`;
    return this.http.get<{ url: string }>(`/api/remotes/google/connect?${q}`);
  }
  oneDriveConnect(name: string, path: string) {
    const q = `name=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}`;
    return this.http.get<{ url: string }>(`/api/remotes/onedrive/connect?${q}`);
  }
  updateOneDrive(clientId: string, clientSecret: string) {
    return this.http.put<boolean>('/api/settings/onedrive', { clientId, clientSecret });
  }
  dropboxConnect(name: string, path: string) {
    const q = `name=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}`;
    return this.http.get<{ url: string }>(`/api/remotes/dropbox/connect?${q}`);
  }
  updateDropbox(clientId: string, clientSecret: string) {
    return this.http.put<boolean>('/api/settings/dropbox', { clientId, clientSecret });
  }
  yandexConnect(name: string, path: string) {
    const q = `name=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}`;
    return this.http.get<{ url: string }>(`/api/remotes/yandex/connect?${q}`);
  }
  updateYandex(clientId: string, clientSecret: string) {
    return this.http.put<boolean>('/api/settings/yandex', { clientId, clientSecret });
  }

  jobs() { return this.http.get<JobDto[]>('/api/jobs'); }
  createJob(body: CreateJob) { return this.http.post<string>('/api/jobs', body); }
  updateJob(id: string, body: CreateJob & { enabled: boolean }) { return this.http.put<boolean>(`/api/jobs/${id}`, body); }
  deleteJob(id: string) { return this.http.delete<boolean>(`/api/jobs/${id}`); }

  agents() { return this.http.get<AgentDto[]>('/api/agents'); }
  deleteAgent(id: string) { return this.http.delete<boolean>(`/api/agents/${id}`); }
  setAgentEnabled(id: string, enabled: boolean) { return this.http.put<boolean>(`/api/agents/${id}/enabled`, enabled); }
  enqueue(agentId: string, kind: CommandKind, jobId: string | null = null) {
    return this.http.post<string>(`/api/agents/${agentId}/enqueue`, { kind, jobId });
  }

  history(take = 100, skip = 0) { return this.http.get<RunDto[]>(`/api/history?take=${take}&skip=${skip}`); }
  stats() { return this.http.get<StatsDto>('/api/stats'); }

  versions(jobId: string) { return this.http.get<BackupVersionDto[]>(`/api/jobs/${jobId}/versions`); }
  restore(jobId: string, fileName: string, snapshotFirst: boolean) {
    return this.http.post<string>(`/api/jobs/${jobId}/restore`, { fileName, snapshotFirst });
  }
  deliver(jobId: string, fileName: string) { return this.http.post<string>(`/api/jobs/${jobId}/deliver`, { fileName }); }
  download(jobId: string, file: string) {
    return this.http.get(`/api/jobs/${jobId}/download?file=${encodeURIComponent(file)}`, { responseType: 'blob', observe: 'response' });
  }

  settings() { return this.http.get<SettingsDto>('/api/settings'); }
  updateGoogle(clientId: string, clientSecret: string) {
    return this.http.put<boolean>('/api/settings/google', { clientId, clientSecret });
  }
  saveLocale(locale: string) { return this.http.put<boolean>('/api/settings/locale', { locale }); }
  hubToken() { return this.http.get<{ token: string }>('/api/settings/hub-token'); }

  notifications() { return this.http.get<NotificationSettingsDto>('/api/notifications'); }
  saveNotifyMode(notifyOn: string) { return this.http.put<boolean>('/api/notifications/mode', { notifyOn }); }
  saveEmail(body: { smtpHost: string | null; smtpPort: number | null; smtpUser: string | null; smtpPass: string | null; smtpFrom: string | null; }) {
    return this.http.put<boolean>('/api/notifications/email', body);
  }
  addRecipient(email: string, name: string | null, lang: string | null) { return this.http.post<string>('/api/notifications/email/recipients', { email, name, lang }); }
  removeRecipient(id: string) { return this.http.delete<boolean>(`/api/notifications/email/recipients/${id}`); }
  saveWebhook(webhookUrl: string | null) { return this.http.put<boolean>('/api/notifications/webhook', { webhookUrl }); }
  saveTelegramToken(telegramBotToken: string | null) { return this.http.put<boolean>('/api/notifications/telegram/token', { telegramBotToken }); }
  linkTelegram(code: string) { return this.http.post<boolean>('/api/notifications/telegram/link', { code }); }
  unlinkTelegram(id: string) { return this.http.delete<boolean>(`/api/notifications/telegram/${id}`); }
  setChatLang(id: string, lang: string | null) { return this.http.put<boolean>(`/api/notifications/telegram/${id}/lang`, lang); }
  setChatName(id: string, name: string | null) { return this.http.put<boolean>(`/api/notifications/telegram/${id}/name`, name); }
  testNotification() { return this.http.post<string>('/api/notifications/test', {}); }
}
