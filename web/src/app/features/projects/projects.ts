import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { Toast } from '../../core/toast';
import { engineLabel } from '../../core/format';
import { BackupEngine, CommandKind, CreateSource, ProjectDto, SourceDto, SourceOrigin } from '../../core/models';

@Component({
  selector: 'app-projects',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('projects.title') }}</h1><p class="muted">{{ lang.t('projects.subtitle') }}</p></div>
      <div class="spacer"></div>
      <button (click)="newProject()">{{ lang.t('projects.add') }}</button>
    </div>

    @if (projects().length === 0) {
      <div class="card"><p class="muted">{{ lang.t('empty.projects') }}</p></div>
    } @else {
      @for (p of projects(); track p.id) {
        <div class="card project">
          <div class="phead">
            <div class="pname">📁 {{ p.name }}</div>
            <div class="spacer"></div>
            <button class="ghost sm" (click)="addSource(p)">{{ lang.t('projects.addSource') }}</button>
            <button class="ghost sm" (click)="renameProject(p)">{{ lang.t('btn.edit') }}</button>
            <button class="ghost danger sm" (click)="removeProject(p)">{{ lang.t('btn.delete') }}</button>
          </div>

          @if (p.sources.length === 0) {
            <p class="muted empty">{{ lang.t('projects.noSources') }}</p>
          } @else {
            <table>
              <tbody>
                @for (s of p.sources; track s.id) {
                  <tr [class.pendingrow]="!s.confirmed">
                    <td class="eng">{{ engineLabel(s.engine) }}</td>
                    <td>{{ s.name }}
                      @if (s.origin !== 0) { <span class="origin" [class.adopted]="s.origin === 2">{{ originLabel(s.origin) }}</span> }
                      @if (!s.confirmed) { <span class="origin pending">{{ lang.t('src.pending') }}</span> }</td>
                    <td class="muted">{{ s.host }}:{{ s.port }}</td>
                    <td>{{ s.target }}</td>
                    @if (!s.confirmed) {
                      <td class="acts">
                        <button class="sm" (click)="confirmSource(s)">{{ lang.t('btn.confirm') }}</button>
                        <button class="ghost sm" (click)="editSource(p, s)">{{ lang.t('btn.edit') }}</button>
                        <button class="ghost danger sm" (click)="rejectSource(s)">{{ lang.t('btn.reject') }}</button>
                      </td>
                    } @else {
                      <td class="acts">
                        <button class="ghost sm" (click)="test(s)">{{ lang.t('btn.test') }}</button>
                        <button class="ghost sm" (click)="editSource(p, s)">{{ lang.t('btn.edit') }}</button>
                        <button class="ghost danger sm" (click)="removeSource(s)">{{ lang.t('btn.delete') }}</button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
    }

    <!-- Project create/rename modal -->
    @if (projOpen()) {
      <div class="backdrop" (click)="projOpen.set(false)">
        <div class="modal sm" (click)="$event.stopPropagation()">
          <div class="mhead"><h3>{{ projId() ? lang.t('m.editProject') : lang.t('m.addProject') }}</h3><button class="x" (click)="projOpen.set(false)">✕</button></div>
          <div class="mbody">
            <label>{{ lang.t('f.name') }}</label>
            <input [(ngModel)]="projName" placeholder="Forex" (keyup.enter)="saveProject()" />
            @if (error()) { <div class="err">{{ error() }}</div> }
            <div class="row foot"><div class="spacer"></div>
              <button class="ghost" (click)="projOpen.set(false)">{{ lang.t('btn.cancel') }}</button>
              <button (click)="saveProject()" [disabled]="saving() || !projName.trim()">{{ lang.t('btn.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Source create/edit modal -->
    @if (srcOpen()) {
      <div class="backdrop" (click)="srcOpen.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="mhead"><h3>{{ srcId() ? lang.t('m.editSource') : lang.t('m.addSource') }}</h3><button class="x" (click)="srcOpen.set(false)">✕</button></div>
          <div class="mbody">
            <div class="grid g2">
              <div><label>{{ lang.t('f.name') }}</label><input [(ngModel)]="form.name" /></div>
              <div><label>{{ lang.t('f.engine') }}</label>
                <select [ngModel]="form.engine" (ngModelChange)="setEngine($event)">
                  <option [ngValue]="0">PostgreSQL</option>
                  <option [ngValue]="1">MySQL / MariaDB</option>
                  <option [ngValue]="3">S3 / MinIO (object storage)</option>
                </select>
              </div>
              <div><label>{{ lang.t('f.host') }}</label><input [(ngModel)]="form.host" placeholder="host.docker.internal" /></div>
              <div><label>{{ lang.t('f.port') }}</label><input type="number" [(ngModel)]="form.port" /></div>
              <div><label>{{ lang.t('f.username') }}</label><input [(ngModel)]="form.username" /></div>
              <div><label>{{ lang.t('f.password') }}</label><input type="password" [(ngModel)]="form.secret" [placeholder]="srcId() ? lang.t('f.keepSecret') : ''" /></div>
              <div class="span2"><label>{{ lang.t('f.target') }}</label><input [(ngModel)]="form.target" /></div>
              @if (srcId()) {
                <div class="span2"><label>{{ lang.t('f.project') }} <span class="muted">— {{ lang.t('projects.moveHint') }}</span></label>
                  <select [(ngModel)]="form.projectId">
                    @for (p of projects(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
                  </select>
                </div>
              }
            </div>
            @if (error()) { <div class="err">{{ error() }}</div> }
            <div class="row foot"><div class="spacer"></div>
              <button class="ghost" (click)="srcOpen.set(false)">{{ lang.t('btn.cancel') }}</button>
              <button (click)="saveSource()" [disabled]="saving()">{{ lang.t('btn.save') }}</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    h1 { margin: 0; }
    .project { margin-bottom: 16px; }
    .phead { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .pname { font-weight: 600; font-size: 16px; }
    .empty { margin: 6px 2px; }
    .eng { color: var(--muted); font-size: 13px; }
    .acts { display: flex; gap: 6px; justify-content: flex-end; }
    .sm { padding: 5px 11px; font-size: 13px; }
    .origin { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; margin-left: 8px;
              padding: 2px 7px; border-radius: 20px; background: rgba(96,125,224,.16); color: var(--muted); }
    .origin.adopted { background: rgba(47,191,113,.16); color: var(--ok); }
    .origin.pending { background: rgba(224,169,59,.18); color: var(--warn); }
    tr.pendingrow td { background: rgba(224,169,59,.05); }
    button.danger { color: var(--fail); border-color: var(--fail); }
    button.danger:hover { background: rgba(226,85,78,.12); }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }
    .backdrop { position: fixed; inset: 0; z-index: 100; background: rgba(8,12,20,.45);
      backdrop-filter: blur(6px) saturate(120%); -webkit-backdrop-filter: blur(6px) saturate(120%);
      display: flex; align-items: center; justify-content: center; padding: 24px; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: var(--shadow);
      width: 620px; max-width: 100%; max-height: 90vh; display: flex; flex-direction: column; }
    .modal.sm { width: 420px; }
    .mhead { display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid var(--border); }
    .mhead h3 { margin: 0; }
    .x { background: transparent; color: var(--muted); padding: 4px 8px; }
    .mbody { padding: 22px; overflow-y: auto; }
    .g2 { grid-template-columns: 1fr 1fr; }
    .span2 { grid-column: 1 / -1; }
    .err { color: var(--fail); margin-top: 12px; }
    .foot { margin-top: 18px; gap: 10px; align-items: center; }
  `,
})
export class Projects {
  private api = inject(Api);
  lang = inject(Lang);
  private toast = inject(Toast);

  projects = signal<ProjectDto[]>([]);
  error = signal<string | null>(null);
  saving = signal(false);

  // project modal
  projOpen = signal(false);
  projId = signal<string | null>(null);
  projName = '';

  // source modal
  srcOpen = signal(false);
  srcId = signal<string | null>(null);
  form: CreateSource = this.emptySource('');

  engineLabel = engineLabel;

  constructor() { this.load(); }

  load() { this.api.projects().subscribe(p => this.projects.set(p)); }

  originLabel(o: SourceOrigin) {
    return o === SourceOrigin.Adopted ? this.lang.t('origin.adopted')
      : o === SourceOrigin.Discovered ? this.lang.t('origin.discovered') : '';
  }

  // ── projects ──
  newProject() { this.projId.set(null); this.projName = ''; this.error.set(null); this.projOpen.set(true); }
  renameProject(p: ProjectDto) { this.projId.set(p.id); this.projName = p.name; this.error.set(null); this.projOpen.set(true); }

  saveProject() {
    const name = this.projName.trim();
    if (!name) return;
    this.saving.set(true); this.error.set(null);
    const id = this.projId();
    const req: Observable<unknown> = id ? this.api.updateProject(id, name) : this.api.createProject(name);
    req.subscribe({
      next: () => { this.saving.set(false); this.projOpen.set(false); this.load(); },
      error: e => { this.saving.set(false); this.error.set(this.msg(e)); },
    });
  }

  removeProject(p: ProjectDto) {
    if (!confirm(`Delete project "${p.name}" and its ${p.sources.length} source(s)?`)) return;
    this.api.deleteProject(p.id).subscribe({ next: () => this.load(), error: e => this.flash(this.msg(e)) });
  }

  // ── sources ──
  private static readonly DEFAULTS: Record<number, { port: number; username: string }> = {
    0: { port: 5432, username: 'postgres' },
    1: { port: 3306, username: 'root' },
    3: { port: 9000, username: 'minioadmin' },
  };
  setEngine(engine: BackupEngine) {
    this.form.engine = engine;
    const d = Projects.DEFAULTS[engine];
    if (d) { this.form.port = d.port; this.form.username = d.username; }
  }

  addSource(p: ProjectDto) { this.srcId.set(null); this.form = this.emptySource(p.id); this.error.set(null); this.srcOpen.set(true); }
  editSource(p: ProjectDto, s: SourceDto) {
    this.srcId.set(s.id);
    this.form = { projectId: s.projectId, name: s.name, engine: s.engine, host: s.host, port: s.port, username: s.username, secret: '', target: s.target };
    this.error.set(null);
    this.srcOpen.set(true);
  }

  saveSource() {
    this.saving.set(true); this.error.set(null);
    const id = this.srcId();
    const req: Observable<unknown> = id ? this.api.updateSource(id, this.form) : this.api.createSource(this.form);
    req.subscribe({
      next: () => { this.saving.set(false); this.srcOpen.set(false); this.load(); },
      error: e => { this.saving.set(false); this.error.set(this.msg(e)); },
    });
  }

  removeSource(s: SourceDto) {
    if (!confirm(`Delete source "${s.name}"?`)) return;
    this.api.deleteSource(s.id).subscribe({ next: () => this.load(), error: e => this.flash(this.msg(e)) });
  }

  // Discovered sources land here Confirmed=false for the operator to review.
  confirmSource(s: SourceDto) {
    this.api.confirmSource(s.id).subscribe({
      next: () => { this.flash(this.lang.t('src.confirmed')); this.load(); },
      error: e => this.flash(this.msg(e)),
    });
  }

  rejectSource(s: SourceDto) {
    if (!confirm(this.lang.t('src.rejectConfirm').replace('{name}', s.name))) return;
    this.api.deleteSource(s.id).subscribe({ next: () => this.load(), error: e => this.flash(this.msg(e)) });
  }

  test(s: SourceDto) {
    this.api.agents().subscribe(agents => {
      const online = agents.find(a => a.enabled && a.lastSeenAt && Date.now() - new Date(a.lastSeenAt).getTime() < 90_000);
      if (!online) { this.flash(this.lang.t('test.noAgent')); return; }
      this.api.enqueue(online.id, CommandKind.TestSource, null, JSON.stringify({ sourceId: s.id })).subscribe();
      this.flash(this.lang.t('test.sent'));
    });
  }

  private emptySource(projectId: string): CreateSource {
    return { projectId, name: '', engine: BackupEngine.Postgres, host: '', port: 5432, username: 'postgres', secret: '', target: '' };
  }
  private flash(msg: string) { this.toast.show(msg); }
  private msg(e: any): string {
    return e?.error?.error ?? (e?.error?.errors ? Object.values(e.error.errors).flat().join('; ') : null) ?? 'Failed';
  }
}
