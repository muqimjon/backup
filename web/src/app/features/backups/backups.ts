import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ArtifactLocation, BackupVersionDto, DrillStatus, JobDto } from '../../core/models';
import { Live } from '../../core/live';
import { Toast } from '../../core/toast';
import { formatBytes } from '../../core/format';

// One point-in-time version of a project = every source's archive sharing the
// same backup timestamp (e.g. forex_postgres_T.zip + forex_minio_T.zip).
interface VersionGroup {
  key: string;
  archivedAt: string;
  drivers: string[];
  totalBytes: number;
  location: ArtifactLocation;
  files: BackupVersionDto[];
}

const DRIVER_LABEL: Record<string, string> = {
  postgres: 'PostgreSQL', mysql: 'MySQL', mssql: 'MSSQL', minio: 'MinIO',
};

@Component({
  selector: 'app-backups',
  imports: [DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div>
        <h1>Versions — {{ job()?.name || '…' }}</h1>
        <p class="muted">Restore the whole project to any point in time — every source rolls back together.</p>
      </div>
      <div class="spacer"></div>
      <a routerLink="/jobs" class="back">← Projects</a>
      <button class="ghost" (click)="load()">Refresh</button>
    </div>

    <div class="card">
      @if (versions().length === 0) {
        <p class="muted">No versions yet. Run a backup first — they’ll appear here (local and cloud).</p>
      } @else {
        <table>
          <thead><tr><th>Archived</th><th>Sources</th><th>Size</th><th>Where</th><th>Verified</th><th></th></tr></thead>
          <tbody>
            @for (v of versions(); track v.key) {
              <tr>
                <td>{{ v.archivedAt | date: 'medium' }}</td>
                <td><div class="srcs">@for (d of v.drivers; track d) { <span class="src">{{ label(d) }}</span> }</div></td>
                <td>{{ formatBytes(v.totalBytes) }}</td>
                <td><span class="loc {{ locClass(v.location) }}">{{ locLabel(v.location) }}</span></td>
                <td>
                  @if (vStatus(v) === DS.Verified) { <span class="drill ok" [title]="drillTitle(v)">✓ {{ drillTip(v) }}</span> }
                  @else if (vStatus(v) === DS.Failed) { <span class="drill fail">✗ failed</span> }
                  @else if (hasDrillable(v)) { <span class="drill none">untested</span> }
                  @else { <span class="drill na">n/a</span> }
                </td>
                <td class="acts">
                  <button (click)="ask(v)">Restore</button>
                  @if (hasDrillable(v)) { <button class="ghost" (click)="drill(v)" title="Restore-test this version into a scratch DB">Drill</button> }
                  <button class="ghost" (click)="toggle(v.key)">{{ expanded() === v.key ? 'Hide' : 'Per-source' }}</button>
                </td>
              </tr>
              @if (expanded() === v.key) {
                <tr class="detail"><td colspan="6">
                  <div class="advhead">Advanced — drill, restore, download or delete a single source (the whole-version restore above keeps them consistent):</div>
                  <table class="inner">
                    <tbody>
                      @for (f of v.files; track f.id) {
                        <tr [class.failrow]="f.drillStatus === DS.Failed">
                          <td>{{ label(f.driver) }}</td>
                          <td class="muted">{{ f.fileName }}
                            @if (f.drillStatus === DS.Verified) { <span class="drill ok sm" [title]="f.drilledAt || ''">✓ {{ f.drillTables }}t · {{ fmt(f.drillRows) }}r</span> }
                            @else if (f.drillStatus === DS.Failed) { <span class="drill fail sm">✗ failed</span> }
                          </td>
                          <td>{{ formatBytes(f.bytes) }}</td>
                          <td class="acts">
                            @if (drillable(f.driver)) { <button class="ghost sm" (click)="drillFile(f)">Drill</button> }
                            <button class="ghost sm" (click)="download(f)" [disabled]="downloading() === f.fileName">
                              {{ downloading() === f.fileName ? '…' : 'Download' }}
                            </button>
                            <button class="ghost sm" (click)="askFile(f)">Restore</button>
                            <button class="ghost sm danger" (click)="deleteFile(f)" title="Delete this archive (local + cloud)">Delete</button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </td></tr>
              }
            }
          </tbody>
        </table>
      }
    </div>

    @if (target(); as t) {
      <div class="backdrop" (click)="target.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>⚠️ Restore {{ t.kind === 'version' ? 'this version?' : 'a single source?' }}</h3>
          @if (t.kind === 'version') {
            <p>This <b>overwrites the live data of every source</b> in this project with the version from
               <b>{{ t.label }}</b>: <span class="srcs">@for (d of t.drivers; track d) { <span class="src">{{ label(d) }}</span> }</span></p>
          } @else {
            <p>This <b>overwrites just this one source</b> with:<br><code>{{ t.label }}</code>
               <br><span class="warn">⚠ Restoring one source alone can make it inconsistent with the others.</span></p>
          }

          <label class="check">
            <input type="checkbox" [(ngModel)]="snapshot" />
            Save the current state first (recommended) — so this rollback is itself undoable
          </label>

          <p class="muted">Type the project name <b>{{ job()?.name }}</b> to confirm:</p>
          <input [(ngModel)]="confirmText" placeholder="project name" />

          <div class="row actions">
            <button class="ghost" (click)="target.set(null)">Cancel</button>
            <div class="spacer"></div>
            <button class="danger" [disabled]="confirmText !== job()?.name" (click)="doRestore()">Restore now</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    h1 { margin: 0; }
    .back { color: var(--muted); align-self: center; }
    .srcs { display: inline-flex; flex-wrap: wrap; gap: 6px; }
    .src { font-size: 12px; padding: 2px 9px; border-radius: 20px; background: rgba(91,140,255,.14); color: var(--text); }
    .loc { font-size: 12px; padding: 2px 9px; border-radius: 20px; }
    .loc.local { background: rgba(79,124,255,.15); color: var(--primary); }
    .loc.remote { background: rgba(224,169,59,.15); color: var(--warn); }
    .loc.both { background: rgba(47,191,113,.15); color: var(--ok); }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }
    .acts { display: flex; gap: 8px; justify-content: flex-end; }
    .acts button { padding: 5px 12px; font-size: 13px; }
    .acts .sm { padding: 4px 10px; font-size: 12px; }
    .acts .danger { color: var(--fail); border-color: var(--fail); }
    .acts .danger:hover { background: rgba(226,85,78,.12); }
    .drill { font-size: 12px; padding: 2px 9px; border-radius: 20px; white-space: nowrap; }
    .drill.ok { background: rgba(47,191,113,.16); color: var(--ok); }
    .drill.fail { background: rgba(226,85,78,.16); color: var(--fail); }
    .drill.none { background: var(--surface-2); color: var(--muted); }
    .drill.na { color: var(--muted); opacity: .6; }
    .drill.sm { margin-left: 8px; font-size: 11px; }
    .failrow td { background: rgba(226,85,78,.07); }
    .detail td { background: var(--surface-2); }
    .advhead { font-size: 12px; color: var(--muted); margin: 4px 2px 10px; }
    table.inner { width: 100%; }
    table.inner td { border: none; padding: 6px 8px; }
    .warn { color: var(--warn); font-size: 13px; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; width: 480px; max-width: 92vw; }
    .modal h3 { margin-bottom: 12px; }
    .check { display: flex; gap: 8px; align-items: flex-start; margin: 16px 0; font-size: 13px; color: var(--text); }
    .check input { width: auto; margin-top: 2px; }
    .actions { margin-top: 20px; }
    button.danger { background: var(--fail); }
  `,
})
export class Backups {
  private api = inject(Api);
  private route = inject(ActivatedRoute);
  private live = inject(Live);
  private toast = inject(Toast);

  protected DS = DrillStatus;
  jobId = this.route.snapshot.paramMap.get('jobId')!;
  job = signal<JobDto | null>(null);
  items = signal<BackupVersionDto[]>([]);
  expanded = signal<string | null>(null);
  target = signal<{ kind: 'version' | 'file'; value: string; label: string; drivers: string[] } | null>(null);
  snapshot = true;
  confirmText = '';
  downloading = signal<string | null>(null);

  formatBytes = formatBytes;
  label = (d: string) => DRIVER_LABEL[d] ?? d;

  // Group the flat archive list into point-in-time project versions by timestamp.
  versions = computed<VersionGroup[]>(() => {
    const map = new Map<string, BackupVersionDto[]>();
    for (const v of this.items()) {
      const m = v.fileName.match(/_(\d{8}_\d{6})\.zip$/);
      const key = m ? m[1] : v.fileName;
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return [...map.entries()]
      .map(([key, files]) => ({
        key,
        archivedAt: files[0].archivedAt,
        drivers: files.map(f => f.driver),
        totalBytes: files.reduce((s, f) => s + f.bytes, 0),
        location: this.combineLoc(files),
        files,
      }))
      .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  });

  constructor() {
    this.api.jobs().subscribe(js => this.job.set(js.find(j => j.id === this.jobId) ?? null));
    this.load();
    // A drill result arrives as a 'drill' toast — reload so the badge updates.
    effect(() => {
      const t = this.live.lastTest();
      if (t?.target === 'drill' && t.targetId === this.jobId) setTimeout(() => this.load(), 500);
    });
  }

  load() { this.api.versions(this.jobId).subscribe(v => this.items.set(v)); }
  toggle(key: string) { this.expanded.set(this.expanded() === key ? null : key); }

  // ── Drill status helpers ──
  drillable = (d: string) => d === 'postgres' || d === 'mysql';
  fmt = (n: number | null) => (n ?? 0).toLocaleString();
  private drillFiles(v: VersionGroup) { return v.files.filter(f => this.drillable(f.driver)); }
  hasDrillable(v: VersionGroup) { return this.drillFiles(v).length > 0; }

  vStatus(v: VersionGroup): DrillStatus {
    const df = this.drillFiles(v);
    if (df.length === 0) return DrillStatus.Untested;
    if (df.some(f => f.drillStatus === DrillStatus.Failed)) return DrillStatus.Failed;
    if (df.every(f => f.drillStatus === DrillStatus.Verified)) return DrillStatus.Verified;
    return DrillStatus.Untested;
  }
  drillTip(v: VersionGroup): string {
    const f = this.drillFiles(v).find(x => x.drillStatus === DrillStatus.Verified);
    return f ? `${f.drillTables}t · ${this.fmt(f.drillRows)}r` : 'verified';
  }
  drillTitle(v: VersionGroup): string {
    const f = this.drillFiles(v).find(x => x.drillStatus === DrillStatus.Verified);
    return f?.drilledAt ? `Restore-tested ${new Date(f.drilledAt).toLocaleString()} — ${f.drillTables} tables, ${this.fmt(f.drillRows)} rows` : 'Restore-tested';
  }

  drill(v: VersionGroup) {
    const df = this.drillFiles(v);
    if (df.length === 0) { this.flash('No database source to drill in this version.'); return; }
    df.forEach(f => this.api.drillVersion(this.jobId, f.fileName).subscribe());
    this.flash('Drill queued — the agent restores it into a scratch database to verify. The result appears as a toast.');
  }
  drillFile(f: BackupVersionDto) {
    this.api.drillVersion(this.jobId, f.fileName).subscribe();
    this.flash('Drill queued for ' + f.fileName + ' — result appears shortly.');
  }
  deleteFile(f: BackupVersionDto) {
    if (!confirm(`Delete this archive?\n\n${f.fileName}\n\nIt is removed locally AND from the cloud. This cannot be undone.`)) return;
    this.api.deleteArtifact(this.jobId, f.fileName).subscribe({
      next: () => { this.flash('Delete queued — the list refreshes once the agent removes it.'); setTimeout(() => this.load(), 4000); },
      error: e => this.flash(e?.error?.error ?? 'Delete failed to queue.'),
    });
  }

  ask(v: VersionGroup) {
    this.confirmText = ''; this.snapshot = true;
    this.target.set({ kind: 'version', value: v.key, label: new Date(v.archivedAt).toLocaleString(), drivers: v.drivers });
  }
  askFile(f: BackupVersionDto) {
    this.confirmText = ''; this.snapshot = true;
    this.target.set({ kind: 'file', value: f.fileName, label: f.fileName, drivers: [f.driver] });
  }

  doRestore() {
    const t = this.target();
    if (!t) return;
    const body = t.kind === 'version'
      ? { version: t.value, snapshotFirst: this.snapshot }
      : { fileName: t.value, snapshotFirst: this.snapshot };
    this.api.restore(this.jobId, body).subscribe({
      next: () => { this.target.set(null); this.flash('Restore queued — watch History. ' + (this.snapshot ? 'Current state is being snapshotted first.' : '')); },
      error: e => this.flash(e?.error?.error ?? 'Restore failed to queue.'),
    });
  }

  download(v: BackupVersionDto) {
    this.downloading.set(v.fileName);
    this.flash('Preparing download — the agent is sending the file…');
    this.api.deliver(this.jobId, v.fileName).subscribe({
      next: () => this.poll(v.fileName, 0),
      error: e => { this.downloading.set(null); this.flash(e?.error?.error ?? 'Could not request the file.'); },
    });
  }

  private poll(file: string, tries: number) {
    if (tries > 40) { this.downloading.set(null); this.flash('Timed out preparing the file.'); return; }
    this.api.download(this.jobId, file).subscribe({
      next: res => {
        const blob = res.body!;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file; a.click();
        URL.revokeObjectURL(url);
        this.downloading.set(null);
        this.flash('Download started.');
      },
      error: () => setTimeout(() => this.poll(file, tries + 1), 2000),
    });
  }

  private combineLoc(files: BackupVersionDto[]): ArtifactLocation {
    const hasLocal = files.every(f => f.location === ArtifactLocation.Local || f.location === ArtifactLocation.Both);
    const hasRemote = files.every(f => f.location === ArtifactLocation.Remote || f.location === ArtifactLocation.Both);
    if (hasLocal && hasRemote) return ArtifactLocation.Both;
    return hasRemote ? ArtifactLocation.Remote : ArtifactLocation.Local;
  }

  locLabel(l: ArtifactLocation) { return l === ArtifactLocation.Remote ? 'cloud' : l === ArtifactLocation.Both ? 'local+cloud' : 'local'; }
  locClass(l: ArtifactLocation) { return l === ArtifactLocation.Remote ? 'remote' : l === ArtifactLocation.Both ? 'both' : 'local'; }

  private flash(msg: string) { this.toast.show(msg); }
}
