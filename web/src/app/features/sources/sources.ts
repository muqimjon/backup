import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { BackupEngine, CreateSource, SourceDto } from '../../core/models';
import { engineLabel } from '../../core/format';
import { Lang } from '../../core/lang';
import { Modal } from '../../shared/modal';

@Component({
  selector: 'app-sources',
  imports: [FormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('sources.title') }}</h1><p class="muted">{{ lang.t('sources.subtitle') }}</p></div>
      <div class="spacer"></div>
      <button (click)="open()">{{ lang.t('sources.add') }}</button>
    </div>

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">No sources yet. Add a database or bucket to back up.</p>
      } @else {
        <table>
          <thead><tr><th>Name</th><th>Engine</th><th>Host</th><th>Target</th><th></th></tr></thead>
          <tbody>
            @for (s of items(); track s.id) {
              <tr>
                <td>{{ s.name }}</td><td>{{ engineLabel(s.engine) }}</td>
                <td class="muted">{{ s.host }}:{{ s.port }}</td><td>{{ s.target }}</td>
                <td class="right"><button class="ghost danger" (click)="remove(s)">{{ lang.t('btn.delete') }}</button></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (adding()) {
      <app-modal title="Add source" (close)="adding.set(false)">
        <div class="grid g2">
          <div><label>Name</label><input [(ngModel)]="form.name" /></div>
          <div><label>Engine</label>
            <select [(ngModel)]="form.engine">
              <option [ngValue]="0">PostgreSQL</option>
              <option [ngValue]="1">MySQL</option>
              <option [ngValue]="2">MSSQL</option>
              <option [ngValue]="3">MinIO / S3</option>
            </select>
          </div>
          <div><label>Host</label><input [(ngModel)]="form.host" placeholder="host.docker.internal" /></div>
          <div><label>Port</label><input type="number" [(ngModel)]="form.port" /></div>
          <div><label>Username</label><input [(ngModel)]="form.username" /></div>
          <div><label>Password / Secret</label><input type="password" [(ngModel)]="form.secret" /></div>
          <div class="span2"><label>Database / Bucket</label><input [(ngModel)]="form.target" /></div>
        </div>
        @if (error()) { <div class="err">{{ error() }}</div> }
        <div class="row foot"><div class="spacer"></div>
          <button class="ghost" (click)="adding.set(false)">Cancel</button>
          <button (click)="save()" [disabled]="saving()">Save source</button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    h1 { margin: 0; }
    .g2 { grid-template-columns: 1fr 1fr; }
    .span2 { grid-column: 1 / -1; }
    .err { color: var(--fail); margin-top: 12px; }
    .foot { margin-top: 18px; gap: 10px; }
    .right { text-align: right; }
    button.danger { color: var(--fail); border-color: var(--fail); }
    button.danger:hover { background: rgba(226,85,78,.12); }
  `,
})
export class Sources {
  private api = inject(Api);
  lang = inject(Lang);

  items = signal<SourceDto[]>([]);
  adding = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  form: CreateSource = this.empty();
  engineLabel = engineLabel;

  constructor() { this.load(); }

  load() { this.api.sources().subscribe(s => this.items.set(s)); }

  open() { this.form = this.empty(); this.error.set(null); this.adding.set(true); }

  save() {
    this.saving.set(true);
    this.error.set(null);
    this.api.createSource(this.form).subscribe({
      next: () => { this.saving.set(false); this.adding.set(false); this.load(); },
      error: e => { this.saving.set(false); this.error.set(this.msg(e)); },
    });
  }

  remove(s: SourceDto) {
    if (!confirm(`Delete source "${s.name}"?`)) return;
    this.api.deleteSource(s.id).subscribe({ next: () => this.load(), error: e => alert(this.msg(e)) });
  }

  private msg(e: any): string {
    return e?.error?.error
      ?? (e?.error?.errors ? Object.values(e.error.errors).flat().join('; ') : null)
      ?? 'Failed';
  }

  private empty(): CreateSource {
    return { name: '', engine: BackupEngine.Postgres, host: '', port: 5432, username: '', secret: '', target: '' };
  }
}
