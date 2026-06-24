import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { BackupEngine, CreateSource, SourceDto } from '../../core/models';
import { engineLabel } from '../../core/format';

@Component({
  selector: 'app-sources',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>Sources</h1><p class="muted">Databases and buckets to back up</p></div>
      <div class="spacer"></div>
      <button (click)="adding.set(!adding())">{{ adding() ? 'Close' : '+ Add source' }}</button>
    </div>

    @if (adding()) {
      <div class="card form">
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
          <div><label>Host</label><input [(ngModel)]="form.host" /></div>
          <div><label>Port</label><input type="number" [(ngModel)]="form.port" /></div>
          <div><label>Username</label><input [(ngModel)]="form.username" /></div>
          <div><label>Password / Secret</label><input type="password" [(ngModel)]="form.secret" /></div>
          <div><label>Database / Bucket</label><input [(ngModel)]="form.target" /></div>
        </div>
        @if (error()) { <div class="err">{{ error() }}</div> }
        <div class="row"><div class="spacer"></div><button (click)="save()" [disabled]="saving()">Save</button></div>
      </div>
    }

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">No sources yet.</p>
      } @else {
        <table>
          <thead><tr><th>Name</th><th>Engine</th><th>Host</th><th>Target</th></tr></thead>
          <tbody>
            @for (s of items(); track s.id) {
              <tr><td>{{ s.name }}</td><td>{{ engineLabel(s.engine) }}</td><td class="muted">{{ s.host }}:{{ s.port }}</td><td>{{ s.target }}</td></tr>
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
export class Sources {
  private api = inject(Api);

  items = signal<SourceDto[]>([]);
  adding = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  form: CreateSource = this.empty();
  engineLabel = engineLabel;

  constructor() { this.load(); }

  load() { this.api.sources().subscribe(s => this.items.set(s)); }

  save() {
    this.saving.set(true);
    this.error.set(null);
    this.api.createSource(this.form).subscribe({
      next: () => { this.saving.set(false); this.adding.set(false); this.form = this.empty(); this.load(); },
      error: e => { this.saving.set(false); this.error.set(e?.error?.error ?? 'Failed to save'); },
    });
  }

  private empty(): CreateSource {
    return { name: '', engine: BackupEngine.Postgres, host: '', port: 5432, username: '', secret: '', target: '' };
  }
}
