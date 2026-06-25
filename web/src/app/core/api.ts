import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AgentDto, CommandKind, CreateJob, CreateS3Remote, CreateSource,
  JobDto, RemoteDto, RunDto, SourceDto, StatsDto,
} from './models';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  sources() { return this.http.get<SourceDto[]>('/api/sources'); }
  createSource(body: CreateSource) { return this.http.post<string>('/api/sources', body); }

  remotes() { return this.http.get<RemoteDto[]>('/api/remotes'); }
  createS3(body: CreateS3Remote) { return this.http.post<string>('/api/remotes/s3', body); }
  googleConnect(name: string, path: string) {
    const q = `name=${encodeURIComponent(name)}&path=${encodeURIComponent(path)}`;
    return this.http.get<{ url: string }>(`/api/remotes/google/connect?${q}`);
  }

  jobs() { return this.http.get<JobDto[]>('/api/jobs'); }
  createJob(body: CreateJob) { return this.http.post<string>('/api/jobs', body); }

  agents() { return this.http.get<AgentDto[]>('/api/agents'); }
  enqueue(agentId: string, kind: CommandKind, jobId: string | null = null) {
    return this.http.post<string>(`/api/agents/${agentId}/enqueue`, { kind, jobId });
  }

  history(take = 100) { return this.http.get<RunDto[]>(`/api/history?take=${take}`); }

  stats() { return this.http.get<StatsDto>('/api/stats'); }
}
