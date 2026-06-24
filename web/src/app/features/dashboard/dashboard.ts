import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { AgentDto, JobDto, RunDto, RunStatus } from '../../core/models';
import { formatBytes, runTypeLabel, statusClass, statusLabel } from '../../core/format';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Dashboard</h1>
    <p class="muted">Overview of your backups</p>

    <div class="stats">
      <div class="card stat"><div class="n">{{ agents().length }}</div><div class="muted">Agents</div></div>
      <div class="card stat"><div class="n">{{ jobs().length }}</div><div class="muted">Jobs</div></div>
      <div class="card stat"><div class="n ok">{{ okCount() }}</div><div class="muted">Recent OK</div></div>
      <div class="card stat"><div class="n fail">{{ failCount() }}</div><div class="muted">Recent failed</div></div>
    </div>

    <div class="card">
      <h3>Recent runs</h3>
      @if (runs().length === 0) {
        <p class="muted">No runs yet. Once an agent runs a backup it will appear here.</p>
      } @else {
        <table>
          <thead><tr><th>Status</th><th>Type</th><th>Job</th><th>Size</th><th>Started</th></tr></thead>
          <tbody>
            @for (r of runs(); track r.id) {
              <tr>
                <td><span class="badge {{ statusClass(r.status) }}">{{ statusLabel(r.status) }}</span></td>
                <td>{{ runTypeLabel(r.type) }}</td>
                <td>{{ r.jobName }}</td>
                <td>{{ formatBytes(r.bytes) }}</td>
                <td class="muted">{{ r.startedAt | date: 'short' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .stat .n { font-size: 30px; font-weight: 700; }
    .stat .n.ok { color: var(--ok); }
    .stat .n.fail { color: var(--fail); }
    h3 { margin-bottom: 14px; }
  `,
})
export class Dashboard {
  private api = inject(Api);

  agents = signal<AgentDto[]>([]);
  jobs = signal<JobDto[]>([]);
  runs = signal<RunDto[]>([]);

  okCount = computed(() => this.runs().filter(r => r.status === RunStatus.Ok).length);
  failCount = computed(() => this.runs().filter(r => r.status === RunStatus.Fail).length);

  statusClass = statusClass;
  statusLabel = statusLabel;
  runTypeLabel = runTypeLabel;
  formatBytes = formatBytes;

  constructor() {
    this.api.agents().subscribe(a => this.agents.set(a));
    this.api.jobs().subscribe(j => this.jobs.set(j));
    this.api.history(20).subscribe(r => this.runs.set(r));
  }
}
