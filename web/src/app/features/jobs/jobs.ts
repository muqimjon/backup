import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { Toast } from '../../core/toast';
import { engineLabel } from '../../core/format';
import { Schedule } from '../../shared/schedule';
import { AgentDto, CommandKind, CreateJob, JobDto, ProjectDto, RemoteDto } from '../../core/models';

@Component({
  selector: 'app-jobs',
  imports: [FormsModule, RouterLink, Schedule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('jobs.title') }}</h1><p class="muted">{{ lang.t('jobs.subtitle') }}</p></div>
      <div class="spacer"></div>
      <button (click)="openNew()">{{ lang.t('jobs.add') }}</button>
    </div>

    @if (items().length === 0) {
      <div class="card"><p class="muted">{{ lang.t('empty.jobs') }}</p></div>
    } @else {
      <div class="jobs">
        @for (j of items(); track j.id) {
          <div class="card job">
            <div class="jhead">
              <div>
                <div class="jname">{{ j.name }} @if (!j.enabled) { <span class="off">{{ lang.t('j.paused') }}</span> }</div>
                <div class="what">{{ lang.t('j.backsUp') }} <b>{{ j.projectName }}</b> <span class="muted">({{ srcName(j) }})</span> → <b>{{ j.remoteName }}</b></div>
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
            @if (projects().length === 0 || remotes().length === 0) {
              <div class="hint">
                @if (projects().length === 0) { <span>⚠ {{ lang.t('j.needProject') }}</span> }
                @if (remotes().length === 0) { <span>⚠ {{ lang.t('j.needDest') }}</span> }
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
              <div class="span2"><label>{{ lang.t('f.project') }}</label>
                <select [ngModel]="form.projectId" (ngModelChange)="onProjectChange($event)">
                  <option [ngValue]="''" disabled>{{ lang.t('j.pickProject') }}</option>
                  @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
                </select>
              </div>
              @if (selectedProject(); as proj) {
                <div class="span2"><label>{{ lang.t('f.sources') }}</label>
                  <div class="srcpick">
                    @for (s of proj.sources; track s.id) {
                      <label class="chip" [class.on]="isPicked(s.id)">
                        <input type="checkbox" [checked]="isPicked(s.id)" (change)="toggleSource(s.id)" />
                        {{ s.name }} <span class="eng">{{ engineLabel(s.engine) }}</span>
                      </label>
                    }
                    @if (proj.sources.length === 0) { <span class="muted">{{ lang.t('projects.noSources') }}</span> }
                  </div>
                  <p class="pickhint">{{ lang.t('j.sourcesHint') }}</p>
                </div>
              }
              <div class="span2"><label>{{ lang.t('f.destination') }}</label>
                <select [(ngModel)]="form.remoteId">
                  <option [ngValue]="''" disabled>Select destination</option>
                  @for (r of remotes(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }
                </select>
              </div>
              <div class="span2 scheds">
                <app-schedule [label]="lang.t('f.sBackup')" [value]="form.backupSchedule" (valueChange)="form.backupSchedule = $event" />
                <app-schedule [label]="lang.t('f.sUpload')" [optional]="true" [value]="form.uploadSchedule" (valueChange)="form.uploadSchedule = $event" />
                <app-schedule [label]="lang.t('f.sCleanup')" [optional]="true" [value]="form.cleanupSchedule" (valueChange)="form.cleanupSchedule = $event" />
                <app-schedule [label]="lang.t('f.sDrill')" [optional]="true" [value]="form.drillSchedule" (valueChange)="form.drillSchedule = $event" />
              </div>
              <div><label>Min local</label><input type="number" [(ngModel)]="form.minLocalBackups" /></div>
              <div><label>Max local</label><input type="number" [(ngModel)]="form.maxLocalBackups" /></div>
              <div><label>Max remote</label><input type="number" [(ngModel)]="form.maxRemoteBackups" /></div>
              <div><label>Compression (1-9)</label><input type="number" [(ngModel)]="form.compressionLevel" /></div>
              <div class="span2"><label>Encryption password ({{ editingId() ? 'leave blank to keep' : 'optional' }})</label>
                <div class="pw">
                  <input [type]="showPw() ? 'text' : 'password'" [(ngModel)]="form.backupPassword" />
                  <button type="button" class="eye" (click)="showPw.set(!showPw())" [title]="showPw() ? 'Hide' : 'Show'">{{ showPw() ? '🙈' : '👁️' }}</button>
                </div>
              </div>
            </div>
            @if (error()) { <div class="err">{{ error() }}</div> }
            <div class="row foot">
              <label class="en"><input type="checkbox" [(ngModel)]="enabled" /> Enabled</label>
              <div class="spacer"></div>
              <button class="ghost" (click)="formOpen.set(false)">{{ lang.t('btn.cancel') }}</button>
              <button (click)="save()" [disabled]="saving() || !form.name || !form.projectId || form.sourceIds.length === 0 || !form.remoteId">{{ lang.t('btn.save') }}</button>
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
    .scheds { display: flex; flex-direction: column; gap: 10px; }
    .pw { position: relative; }
    .pw input { width: 100%; padding-right: 42px; }
    .pw .eye { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); margin: 0;
               background: transparent; border: none; padding: 4px 6px; cursor: pointer; font-size: 15px; }
    .srcpick { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 10px;
            border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; font-size: 13px; }
    .chip.on { border-color: var(--primary); background: rgba(91,140,255,.12); color: var(--text); }
    .chip input { width: auto; margin: 0; }
    .chip .eng { color: var(--muted); font-size: 11px; }
    .pickhint { margin: 6px 0 0; font-size: 12px; color: var(--muted); }
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
  private toast = inject(Toast);

  items = signal<JobDto[]>([]);
  projects = signal<ProjectDto[]>([]);
  remotes = signal<RemoteDto[]>([]);
  agents = signal<AgentDto[]>([]);
  formOpen = signal(false);
  editingId = signal<string | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);
  enabled = true;
  showPw = signal(false);

  form: CreateJob = this.empty();

  constructor() {
    this.load();
    this.api.projects().subscribe(p => this.projects.set(p));
    this.api.remotes().subscribe(r => this.remotes.set(r));
    this.api.agents().subscribe(a => this.agents.set(a));
  }

  selectedProject() { return this.projects().find(p => p.id === this.form.projectId) ?? null; }
  onProjectChange(projectId: string) {
    this.form.projectId = projectId;
    const proj = this.projects().find(p => p.id === projectId);
    this.form.sourceIds = proj ? proj.sources.map(s => s.id) : []; // default: all of the project
  }

  load() { this.api.jobs().subscribe(j => this.items.set(j)); }

  enabledAgents() { return this.agents().filter(a => a.enabled); }

  engineLabel = engineLabel;

  srcName(j: JobDto) { return j.sourceNames.join(' + '); }
  isPicked(id: string) { return this.form.sourceIds.includes(id); }
  toggleSource(id: string) {
    this.form.sourceIds = this.isPicked(id)
      ? this.form.sourceIds.filter(x => x !== id)
      : [...this.form.sourceIds, id];
  }
  agentName(j: JobDto) {
    if (!j.agentId) return '🖥️ no agent';
    return '🖥️ ' + (this.agents().find(a => a.id === j.agentId)?.name ?? 'agent');
  }

  openNew() {
    this.editingId.set(null);
    this.showPw.set(false);
    this.form = this.empty();
    if (this.enabledAgents().length === 1) this.form.agentId = this.enabledAgents()[0].id;
    this.enabled = true;
    this.error.set(null);
    this.formOpen.set(true);
  }

  edit(j: JobDto) {
    this.editingId.set(j.id);
    this.showPw.set(false);
    this.enabled = j.enabled;
    this.error.set(null);
    this.form = {
      name: j.name, projectId: j.projectId, sourceIds: [...j.sourceIds], remoteId: j.remoteId, agentId: j.agentId,
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

  private flash(msg: string) { this.toast.show(msg); }

  private msg(e: any): string {
    return e?.error?.error
      ?? (e?.error?.errors ? Object.values(e.error.errors).flat().join('; ') : null)
      ?? 'Failed';
  }

  private empty(): CreateJob {
    return {
      name: '', projectId: '', sourceIds: [], remoteId: '', agentId: null,
      backupSchedule: '0 2 * * *', uploadSchedule: null, cleanupSchedule: null, drillSchedule: null,
      minLocalBackups: 2, maxLocalBackups: 5, maxRemoteBackups: 30, compressionLevel: 6, backupPassword: null,
    };
  }
}
