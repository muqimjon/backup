import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AgentDto, CommandKind, CreateJob, JobDto, RemoteDto, SourceDto } from '../../core/models';

@Component({
  selector: 'app-jobs',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>Jobs</h1><p class="muted">A source + destination on a schedule</p></div>
      <div class="spacer"></div>
      <button (click)="adding.set(!adding())">{{ adding() ? 'Close' : '+ Add job' }}</button>
    </div>

    @if (adding()) {
      <div class="card form">
        <div class="grid g2">
          <div><label>Name</label><input [(ngModel)]="form.name" /></div>
          <div><label>Agent</label>
            <select [(ngModel)]="form.agentId">
              <option [ngValue]="null">— unassigned —</option>
              @for (a of agents(); track a.id) { <option [ngValue]="a.id">{{ a.name }} ({{ a.project }})</option> }
            </select>
          </div>
          <div><label>Source</label>
            <select [(ngModel)]="form.sourceId">
              <option [ngValue]="''" disabled>Select source</option>
              @for (s of sources(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
            </select>
          </div>
          <div><label>Destination</label>
            <select [(ngModel)]="form.remoteId">
              <option [ngValue]="''" disabled>Select destination</option>
              @for (r of remotes(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }
            </select>
          </div>
          <div><label>Backup schedule (cron)</label><input [(ngModel)]="form.backupSchedule" /></div>
          <div><label>Upload schedule (optional)</label><input [(ngModel)]="form.uploadSchedule" /></div>
          <div><label>Cleanup schedule (optional)</label><input [(ngModel)]="form.cleanupSchedule" /></div>
          <div><label>Restore-drill schedule (optional)</label><input [(ngModel)]="form.drillSchedule" placeholder="0 4 * * 0" /></div>
          <div><label>Min local</label><input type="number" [(ngModel)]="form.minLocalBackups" /></div>
          <div><label>Max local</label><input type="number" [(ngModel)]="form.maxLocalBackups" /></div>
          <div><label>Max remote</label><input type="number" [(ngModel)]="form.maxRemoteBackups" /></div>
          <div><label>Compression (1-9)</label><input type="number" [(ngModel)]="form.compressionLevel" /></div>
          <div><label>Encryption password (optional)</label><input type="password" [(ngModel)]="form.backupPassword" /></div>
        </div>
        @if (error()) { <div class="err">{{ error() }}</div> }
        <div class="row"><div class="spacer"></div><button (click)="save()" [disabled]="saving()">Save</button></div>
      </div>
    }

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">No jobs yet.</p>
      } @else {
        <table>
          <thead><tr><th>Name</th><th>Source</th><th>Destination</th><th>Schedule</th><th>Retention</th><th></th></tr></thead>
          <tbody>
            @for (j of items(); track j.id) {
              <tr>
                <td>{{ j.name }}</td><td>{{ j.sourceName }}</td><td>{{ j.remoteName }}</td>
                <td class="muted">{{ j.backupSchedule }}</td>
                <td class="muted">{{ j.minLocalBackups }}–{{ j.maxLocalBackups }} local · {{ j.maxRemoteBackups }} remote</td>
                <td>
                  @if (j.agentId) {
                    <button class="ghost" (click)="runDrill(j)">Run drill</button>
                  } @else {
                    <span class="muted">no agent</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    .form { margin: 16px 0; }
    .g2 { grid-template-columns: 1fr 1fr; }
    .err { color: var(--fail); margin-top: 10px; }
    h1 { margin: 0; }
  `,
})
export class Jobs {
  private api = inject(Api);

  items = signal<JobDto[]>([]);
  sources = signal<SourceDto[]>([]);
  remotes = signal<RemoteDto[]>([]);
  agents = signal<AgentDto[]>([]);
  adding = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  form: CreateJob = this.empty();

  constructor() {
    this.load();
    this.api.sources().subscribe(s => this.sources.set(s));
    this.api.remotes().subscribe(r => this.remotes.set(r));
    this.api.agents().subscribe(a => this.agents.set(a));
  }

  load() { this.api.jobs().subscribe(j => this.items.set(j)); }

  runDrill(job: JobDto) {
    if (!job.agentId) return;
    this.api.enqueue(job.agentId, CommandKind.RunDrill, job.id).subscribe();
  }

  save() {
    this.saving.set(true);
    this.error.set(null);
    this.api.createJob(this.form).subscribe({
      next: () => { this.saving.set(false); this.adding.set(false); this.form = this.empty(); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e?.error?.error ?? 'Failed to save'); },
    });
  }

  private empty(): CreateJob {
    return {
      name: '', sourceId: '', remoteId: '', agentId: null,
      backupSchedule: '0 2 * * *', uploadSchedule: null, cleanupSchedule: null, drillSchedule: null,
      minLocalBackups: 2, maxLocalBackups: 5, maxRemoteBackups: 30, compressionLevel: 6, backupPassword: null,
    };
  }
}
