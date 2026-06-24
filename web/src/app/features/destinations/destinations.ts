import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { CreateS3Remote, RemoteDto } from '../../core/models';
import { remoteTypeLabel } from '../../core/format';

@Component({
  selector: 'app-destinations',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Destinations</h1>
    <p class="muted">Where backups are uploaded</p>

    <div class="grid g2 top">
      <div class="card">
        <h3>☁️ Connect Google Drive</h3>
        <p class="muted">Authorize once — no tokens to copy.</p>
        <label>Name</label><input [(ngModel)]="gName" placeholder="gdrive" />
        <label>Folder path</label><input [(ngModel)]="gPath" placeholder="backups/myapp" />
        <button class="g" (click)="connectGoogle()" [disabled]="connecting()">
          {{ connecting() ? 'Redirecting…' : 'Connect Google Drive' }}
        </button>
      </div>

      <div class="card">
        <h3>🪣 Add S3 / MinIO</h3>
        <label>Name</label><input [(ngModel)]="s3.name" placeholder="s3" />
        <label>Folder path</label><input [(ngModel)]="s3.path" placeholder="backups/myapp" />
        <label>Endpoint</label><input [(ngModel)]="s3.endpoint" placeholder="https://s3.amazonaws.com" />
        <div class="row">
          <div><label>Access key</label><input [(ngModel)]="s3.accessKey" /></div>
          <div><label>Secret key</label><input type="password" [(ngModel)]="s3.secretKey" /></div>
        </div>
        <button (click)="saveS3()" [disabled]="saving()">Save</button>
      </div>
    </div>

    <div class="card">
      <h3>Connected destinations</h3>
      @if (items().length === 0) {
        <p class="muted">None yet.</p>
      } @else {
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Path</th></tr></thead>
          <tbody>
            @for (r of items(); track r.id) {
              <tr><td>{{ r.name }}</td><td>{{ remoteTypeLabel(r.type) }}</td><td class="muted">{{ r.path }}</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    .top { grid-template-columns: 1fr 1fr; margin: 18px 0; }
    .g2 { display: grid; gap: 16px; }
    h3 { margin-bottom: 10px; }
    label { margin-top: 10px; }
    button { margin-top: 16px; }
    button.g { background: #fff; color: #222; }
  `,
})
export class Destinations {
  private api = inject(Api);

  items = signal<RemoteDto[]>([]);
  connecting = signal(false);
  saving = signal(false);

  gName = 'gdrive';
  gPath = 'backups/myapp';
  s3: CreateS3Remote = { name: 's3', path: 'backups/myapp', endpoint: '', accessKey: '', secretKey: '', region: null };

  remoteTypeLabel = remoteTypeLabel;

  constructor() { this.load(); }

  load() { this.api.remotes().subscribe(r => this.items.set(r)); }

  connectGoogle() {
    this.connecting.set(true);
    this.api.googleConnect(this.gName, this.gPath).subscribe({
      next: res => (window.location.href = res.url),
      error: () => this.connecting.set(false),
    });
  }

  saveS3() {
    this.saving.set(true);
    this.api.createS3(this.s3).subscribe({
      next: () => { this.saving.set(false); this.load(); },
      error: () => this.saving.set(false),
    });
  }
}
