import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { AgentDto, CommandKind, CreateJob, JobDto, RemoteDto, SourceDto } from '../../core/models';

@Component({
  selector: 'app-jobs',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>Jobs</h1><p class="muted">A source + destination on a schedule</p></div>
      <div class="spacer"></div>
      <button (click)="adding.set(!adding())">{{ adding() ? 'Close' : '+ Add job' }}</button>
    </div>

    @if (adding()) {
      <div class="card form">
        @if (sources().length === 0 || remotes().length === 0) {
          <div class="hint">
            @if (sources().length === 0) { <span>⚠ Create a <b>Source</b> first.</span> }
            @if (remotes().length === 0) { <span>⚠ Add a <b>Destination</b> first.</span> }
          </div>
        }
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
        <div class="row">
          <div class="spacer"></div>
          <button (click)="save()" [disabled]="saving() || !form.name || !form.sourceId || !form.remoteId">Save</button>
        </div>
      </div>
    }

    @if (notice()) { <div class="notice">{{ notice() }}</div> }

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
                <td class="acts">
                  <a class="ghost btn" [routerLink]="['/backups', j.id]">Versions</a>
                  @if (j.agentId) {
                    <button class="ghost" (click)="test(j)">Test</button>
                    <button class="ghost" (click)="runDrill(j)">Drill</button>
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
    .hint { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px;
            padding: 10px 14px; border-radius: 8px; background: rgba(224,169,59,.12); color: var(--warn); }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px;
              background: rgba(47,191,113,.12); color: var(--ok); }
    .acts { display: flex; gap: 6px; align-items: center; }
    .acts button, .acts .btn { padding: 5px 10px; font-size: 13px; }
    a.btn { display: inline-block; border: 1px solid var(--border); border-radius: 8px; color: var(--text); }
    a.btn:hover { background: var(--surface-2); }
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
  notice = signal<string | null>(null);

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
    this.api.enqueue(job.agentId, CommandKind.RunDrill, job.id).subscribe({
      next: () => this.flash(`Restore-drill queued for "${job.name}" — watch History / Dashboard.`),
      error: () => this.flash('Failed to queue the drill.'),
    });
  }

  test(job: JobDto) {
    if (!job.agentId) return;
    this.api.enqueue(job.agentId, CommandKind.TestConnection, job.id).subscribe({
      next: () => this.flash(`Connection test queued for "${job.name}" — result in History.`),
      error: () => this.flash('Failed to queue the test.'),
    });
  }

  private flash(msg: string) {
    this.notice.set(msg);
    setTimeout(() => this.notice.set(null), 6000);
  }

  save() {
    this.saving.set(true);
    this.error.set(null);
    const body: CreateJob = {
      ...this.form,
      uploadSchedule: this.form.uploadSchedule?.trim() || null,
      cleanupSchedule: this.form.cleanupSchedule?.trim() || null,
      drillSchedule: this.form.drillSchedule?.trim() || null,
      backupPassword: this.form.backupPassword?.trim() || null,
    };
    this.api.createJob(body).subscribe({
      next: () => { this.saving.set(false); this.adding.set(false); this.form = this.empty(); this.load(); },
      error: e => { this.saving.set(false); this.error.set(this.errorMessage(e)); },
    });
  }

  private errorMessage(e: any): string {
    if (e?.error?.error) return e.error.error;
    if (e?.error?.errors) return Object.values(e.error.errors).flat().join('; ');
    if (e?.status === 0) return 'Cannot reach the server';
    return 'Failed to save';
  }

  private empty(): CreateJob {
    return {
      name: '', sourceId: '', remoteId: '', agentId: null,
      backupSchedule: '0 2 * * *', uploadSchedule: null, cleanupSchedule: null, drillSchedule: null,
      minLocalBackups: 2, maxLocalBackups: 5, maxRemoteBackups: 30, compressionLevel: 6, backupPassword: null,
    };
  }
}
