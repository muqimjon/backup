import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { AgentDto, CommandKind, CreateJob, JobDto, RemoteDto, SourceDto } from '../../core/models';

@Component({
  selector: 'app-jobs',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('jobs.title') }}</h1><p class="muted">{{ lang.t('jobs.subtitle') }}</p></div>
      <div class="spacer"></div>
      <button (click)="openNew()">{{ lang.t('jobs.add') }}</button>
    </div>

    @if (notice()) { <div class="notice">{{ notice() }}</div> }

    @if (items().length === 0) {
      <div class="card"><p class="muted">{{ lang.t('empty.jobs') }}</p></div>
    } @else {
      <div class="jobs">
        @for (j of items(); track j.id) {
          <div class="card job">
            <div class="jhead">
              <div>
                <div class="jname">{{ j.name }} @if (!j.enabled) { <span class="off">{{ lang.t('j.paused') }}</span> }</div>
                <div class="what">{{ lang.t('j.backsUp') }} <b>{{ srcName(j) }}</b> → <b>{{ j.remoteName }}</b></div>
              </div>
              <div class="spacer"></div>
              <a class="ghost btn" [routerLink]="['/backups', j.id]">{{ lang.t('btn.versions') }}</a>
              <button class="ghost" (click)="edit(j)">{{ lang.t('btn.edit') }}</button>
              <button class="ghost danger" (click)="remove(j)">{{ lang.t('btn.delete') }}</button>
            </div>
            <div class="meta">
              <span title="cron">🕒 {{ j.backupSchedule }}</span>
              <span>📦 {{ lang.t('j.keeps') }} {{ j.minLocalBackups }}–{{ j.maxLocalBackups }} {{ lang.t('j.local') }} · {{ j.maxRemoteBackups }} {{ lang.t('j.remote') }}</span>
              <span>🗜️ {{ lang.t('j.zip') }} {{ j.compressionLevel }}</span>
              @if (j.drillSchedule) { <span title="drill cron">🧪 {{ lang.t('j.drill') }} {{ j.drillSchedule }}</span> }
              <span class="agent">{{ agentName(j) }}</span>
            </div>
            @if (j.agentId) {
              <div class="acts">
                <button class="ghost sm" (click)="run(j)">{{ lang.t('btn.runNow') }}</button>
                <button class="ghost sm" (click)="test(j)">{{ lang.t('btn.test') }}</button>
                <button class="ghost sm" (click)="drill(j)">{{ lang.t('btn.drill') }}</button>
              </div>
            } @else {
              <div class="acts"><span class="muted">{{ lang.t('j.noAgent') }}</span></div>
            }
          </div>
        }
      </div>
    }

    @if (formOpen()) {
      <div class="backdrop" (click)="formOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="mhead"><h3>{{ editingId() ? lang.t('m.editJob') : lang.t('m.addJob') }}</h3><button class="x" (click)="formOpen.set(false)">✕</button></div>
          <div class="mbody">
            @if (sources().length === 0 || remotes().length === 0) {
              <div class="hint">
                @if (sources().length === 0) { <span>⚠ Create a <b>Source</b> first.</span> }
                @if (remotes().length === 0) { <span>⚠ Add a <b>Destination</b> first.</span> }
              </div>
            }
            <div class="grid g2">
              <div><label>{{ lang.t('f.name') }}</label><input [(ngModel)]="form.name" /></div>
              <div><label>{{ lang.t('f.agent') }}</label>
                <select [(ngModel)]="form.agentId">
                  <option [ngValue]="null">— unassigned —</option>
                  @for (a of enabledAgents(); track a.id) { <option [ngValue]="a.id">{{ a.name }} ({{ a.project }})</option> }
                </select>
              </div>
              <div><label>{{ lang.t('f.source') }}</label>
                <select [(ngModel)]="form.sourceId">
                  <option [ngValue]="''" disabled>Select source</option>
                  @for (s of sources(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
                </select>
              </div>
              <div><label>{{ lang.t('f.destination') }}</label>
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
              <div class="span2"><label>Encryption password ({{ editingId() ? 'leave blank to keep' : 'optional' }})</label><input type="password" [(ngModel)]="form.backupPassword" /></div>
            </div>
            @if (error()) { <div class="err">{{ error() }}</div> }
            <div class="row foot">
              <label class="en"><input type="checkbox" [(ngModel)]="enabled" /> Enabled</label>
              <div class="spacer"></div>
              <button class="ghost" (click)="formOpen.set(false)">{{ lang.t('btn.cancel') }}</button>
              <button (click)="save()" [disabled]="saving() || !form.name || !form.sourceId || !form.remoteId">{{ lang.t('btn.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    h1 { margin: 0; }
    .jobs { display: grid; gap: 14px; margin-top: 4px; }
    .job { padding: 16px 18px; }
    .jhead { display: flex; align-items: center; gap: 8px; }
    .jname { font-weight: 600; font-size: 15px; }
    .off { font-size: 11px; color: var(--warn); background: rgba(224,169,59,.15); padding: 2px 8px; border-radius: 20px; margin-left: 6px; }
    .what { color: var(--muted); font-size: 13px; margin-top: 2px; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 12px 0; font-size: 13px; color: var(--muted); }
    .meta .agent { color: var(--text); }
    .acts { display: flex; gap: 8px; }
    .acts .sm { padding: 5px 12px; font-size: 13px; }
    .btn { display: inline-block; border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 6px 12px; }
    .btn:hover { background: var(--surface-2); }
    button.danger { color: var(--fail); border-color: var(--fail); }
    button.danger:hover { background: rgba(226,85,78,.12); }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }

    .backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(8,12,20,.45);
      backdrop-filter: blur(6px) saturate(120%); -webkit-backdrop-filter: blur(6px) saturate(120%);
      display: flex; align-items: center; justify-content: center; padding: 24px; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow);
      width: 680px; max-width: 100%; max-height: 90vh; display: flex; flex-direction: column; }
    .mhead { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid var(--border); }
    .mhead h3 { margin: 0; }
    .x { background: transparent; color: var(--muted); padding: 4px 8px; }
    .mbody { padding: 22px; overflow-y: auto; }
    .g2 { grid-template-columns: 1fr 1fr; }
    .span2 { grid-column: 1 / -1; }
    .hint { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; padding: 10px 14px;
            border-radius: 8px; background: rgba(224,169,59,.12); color: var(--warn); }
    .err { color: var(--fail); margin-top: 12px; }
    .foot { margin-top: 18px; gap: 10px; align-items: center; }
    .en { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 13px; }
    .en input { width: auto; }
  `,
})
export class Jobs {
  private api = inject(Api);
  lang = inject(Lang);

  items = signal<JobDto[]>([]);
  sources = signal<SourceDto[]>([]);
  remotes = signal<RemoteDto[]>([]);
  agents = signal<AgentDto[]>([]);
  formOpen = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);
  notice = signal<string | null>(null);
  enabled = true;

  form: CreateJob = this.empty();

  constructor() {
    this.load();
    this.api.sources().subscribe(s => this.sources.set(s));
    this.api.remotes().subscribe(r => this.remotes.set(r));
    this.api.agents().subscribe(a => this.agents.set(a));
  }

  load() { this.api.jobs().subscribe(j => this.items.set(j)); }

  enabledAgents() { return this.agents().filter(a => a.enabled); }

  srcName(j: JobDto) { return j.sourceName; }
  agentName(j: JobDto) {
    if (!j.agentId) return '🖥️ no agent';
    return '🖥️ ' + (this.agents().find(a => a.id === j.agentId)?.name ?? 'agent');
  }

  openNew() {
    this.editingId.set(null);
    this.form = this.empty();
    if (this.enabledAgents().length === 1) this.form.agentId = this.enabledAgents()[0].id;
    this.enabled = true;
    this.error.set(null);
    this.formOpen.set(true);
  }

  edit(j: JobDto) {
    this.editingId.set(j.id);
    this.enabled = j.enabled;
    this.error.set(null);
    this.form = {
      name: j.name, sourceId: j.sourceId, remoteId: j.remoteId, agentId: j.agentId,
      backupSchedule: j.backupSchedule, uploadSchedule: j.uploadSchedule,
      cleanupSchedule: j.cleanupSchedule, drillSchedule: j.drillSchedule,
      minLocalBackups: j.minLocalBackups, maxLocalBackups: j.maxLocalBackups,
      maxRemoteBackups: j.maxRemoteBackups, compressionLevel: j.compressionLevel, backupPassword: null,
    };
    this.formOpen.set(true);
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
    const handlers = {
      next: () => { this.saving.set(false); this.formOpen.set(false); this.load(); },
      error: (e: any) => { this.saving.set(false); this.error.set(this.msg(e)); },
    };
    const id = this.editingId();
    if (id) this.api.updateJob(id, { ...body, enabled: this.enabled }).subscribe(handlers);
    else this.api.createJob(body).subscribe(handlers);
  }

  remove(j: JobDto) {
    if (!confirm(`Delete job "${j.name}"? Its run history and version list are removed too (the backup files on the agent stay).`)) return;
    this.api.deleteJob(j.id).subscribe({ next: () => this.load(), error: e => this.flash(this.msg(e)) });
  }

  run(j: JobDto) { this.cmd(j, CommandKind.RunBackup, `Backup queued for "${j.name}".`); }
  test(j: JobDto) { this.cmd(j, CommandKind.TestConnection, `Connection test queued for "${j.name}".`); }
  drill(j: JobDto) { this.cmd(j, CommandKind.RunDrill, `Restore-drill queued for "${j.name}".`); }

  private cmd(j: JobDto, kind: CommandKind, ok: string) {
    if (!j.agentId) return;
    this.api.enqueue(j.agentId, kind, j.id).subscribe({
      next: () => this.flash(ok + ' Watch History.'),
      error: () => this.flash('Failed to queue.'),
    });
  }

  private flash(msg: string) { this.notice.set(msg); setTimeout(() => this.notice.set(null), 6000); }

  private msg(e: any): string {
    return e?.error?.error
      ?? (e?.error?.errors ? Object.values(e.error.errors).flat().join('; ') : null)
      ?? 'Failed';
  }

  private empty(): CreateJob {
    return {
      name: '', sourceId: '', remoteId: '', agentId: null,
      backupSchedule: '0 2 * * *', uploadSchedule: null, cleanupSchedule: null, drillSchedule: null,
      minLocalBackups: 2, maxLocalBackups: 5, maxRemoteBackups: 30, compressionLevel: 6, backupPassword: null,
    };
  }
}
