import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ArtifactLocation, BackupVersionDto, JobDto } from '../../core/models';
import { formatBytes } from '../../core/format';

@Component({
  selector: 'app-backups',
  imports: [DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div>
        <h1>Backup versions</h1>
        <p class="muted">{{ job()?.name || '…' }} — restore any version, or roll back to the latest</p>
      </div>
      <div class="spacer"></div>
      <a routerLink="/jobs" class="back">← Jobs</a>
      <button class="ghost" (click)="load()">Refresh</button>
    </div>

    @if (notice()) { <div class="notice">{{ notice() }}</div> }

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">No versions yet. Run a backup first — they’ll appear here (local and cloud).</p>
      } @else {
        <table>
          <thead><tr><th>Archived</th><th>File</th><th>Driver</th><th>Size</th><th>Where</th><th></th></tr></thead>
          <tbody>
            @for (v of items(); track v.id) {
              <tr>
                <td>{{ v.archivedAt | date: 'medium' }}</td>
                <td class="muted">{{ v.fileName }}</td>
                <td>{{ v.driver }}</td>
                <td>{{ formatBytes(v.bytes) }}</td>
                <td><span class="loc {{ locClass(v.location) }}">{{ locLabel(v.location) }}</span></td>
                <td><button (click)="ask(v)">Restore</button></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (target(); as v) {
      <div class="backdrop" (click)="target.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>⚠️ Restore this version?</h3>
          <p>This <b>overwrites the live database</b> with:<br><code>{{ v.fileName }}</code></p>

          <label class="check">
            <input type="checkbox" [(ngModel)]="snapshot" />
            Save the current state first (recommended) — so this rollback is itself undoable
          </label>

          <p class="muted">Type the job name <b>{{ job()?.name }}</b> to confirm:</p>
          <input [(ngModel)]="confirmText" placeholder="job name" />

          <div class="row actions">
            <button class="ghost" (click)="target.set(null)">Cancel</button>
            <div class="spacer"></div>
            <button class="danger" [disabled]="confirmText() !== job()?.name" (click)="doRestore()">Restore now</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    h1 { margin: 0; }
    .back { color: var(--muted); align-self: center; }
    .loc { font-size: 12px; padding: 2px 9px; border-radius: 20px; }
    .loc.local { background: rgba(79,124,255,.15); color: var(--primary); }
    .loc.remote { background: rgba(224,169,59,.15); color: var(--warn); }
    .loc.both { background: rgba(47,191,113,.15); color: var(--ok); }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 50; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; width: 460px; max-width: 92vw; }
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

  jobId = this.route.snapshot.paramMap.get('jobId')!;
  job = signal<JobDto | null>(null);
  items = signal<BackupVersionDto[]>([]);
  target = signal<BackupVersionDto | null>(null);
  snapshot = signal(true);
  confirmText = signal('');
  notice = signal<string | null>(null);

  formatBytes = formatBytes;

  constructor() {
    this.api.jobs().subscribe(js => this.job.set(js.find(j => j.id === this.jobId) ?? null));
    this.load();
  }

  load() { this.api.versions(this.jobId).subscribe(v => this.items.set(v)); }

  ask(v: BackupVersionDto) { this.confirmText.set(''); this.snapshot.set(true); this.target.set(v); }

  doRestore() {
    const v = this.target();
    if (!v) return;
    this.api.restore(this.jobId, v.fileName, this.snapshot()).subscribe({
      next: () => { this.target.set(null); this.flash('Restore queued — watch History. ' + (this.snapshot() ? 'Current state is being snapshotted first.' : '')); },
      error: e => this.flash(e?.error?.error ?? 'Restore failed to queue.'),
    });
  }

  locLabel(l: ArtifactLocation) { return l === ArtifactLocation.Remote ? 'cloud' : l === ArtifactLocation.Both ? 'local+cloud' : 'local'; }
  locClass(l: ArtifactLocation) { return l === ArtifactLocation.Remote ? 'remote' : l === ArtifactLocation.Both ? 'both' : 'local'; }

  private flash(msg: string) { this.notice.set(msg); setTimeout(() => this.notice.set(null), 7000); }
}
