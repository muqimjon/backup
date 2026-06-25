import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { RemoteDto } from '../../core/models';
import { remoteTypeLabel } from '../../core/format';

type Kind = 'gdrive' | 's3' | 'b2' | 'sftp' | 'webdav' | 'custom';

const CATALOG: Record<Kind, { title: string; covers: string }> = {
  gdrive: { title: 'Google Drive', covers: 'Google Drive (one-button OAuth)' },
  s3: { title: 'S3-compatible', covers: 'AWS S3 · MinIO · Cloudflare R2 · Wasabi · Backblaze B2 (S3) · DigitalOcean Spaces · any S3 API' },
  b2: { title: 'Backblaze B2', covers: 'Backblaze B2 (native, application key)' },
  sftp: { title: 'SFTP / SSH', covers: 'any SSH/SFTP server · VPS · NAS' },
  webdav: { title: 'WebDAV', covers: 'Nextcloud · ownCloud · Yandex Disk · Koofr · any WebDAV server' },
  custom: { title: 'Custom (rclone)', covers: 'OneDrive · Dropbox · pCloud · Storj · Mega · Jottacloud · Yandex · 70+ rclone backends' },
};

@Component({
  selector: 'app-destinations',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Destinations</h1>
    <p class="muted">Where backups are uploaded — powered by rclone (70+ clouds)</p>

    <div class="card">
      <div class="kinds">
        @for (k of kinds; track k) {
          <button class="chip" [class.on]="kind() === k" (click)="select(k)" [title]="catalog[k].covers">
            {{ catalog[k].title }}
          </button>
        }
      </div>
      <p class="covers">☁️ Covers: <span>{{ catalog[kind()].covers }}</span></p>

      @switch (kind()) {
        @case ('gdrive') {
          <div class="form">
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <button class="g" (click)="connectGoogle()" [disabled]="busy()">
              {{ busy() ? 'Redirecting…' : 'Connect Google Drive' }}
            </button>
          </div>
        }
        @case ('s3') {
          <div class="form">
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Endpoint</label><input [(ngModel)]="s3.endpoint" placeholder="https://s3.amazonaws.com (or MinIO/R2 URL)" />
            <div class="g2">
              <div><label>Access key</label><input [(ngModel)]="s3.accessKey" /></div>
              <div><label>Secret key</label><input type="password" [(ngModel)]="s3.secretKey" /></div>
            </div>
            <label>Region (optional)</label><input [(ngModel)]="s3.region" placeholder="us-east-1" />
            <button (click)="save(api.createS3({ name: name(), path: path(), endpoint: s3.endpoint, accessKey: s3.accessKey, secretKey: s3.secretKey, region: s3.region || null }))" [disabled]="busy()">Save</button>
          </div>
        }
        @case ('b2') {
          <div class="form">
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Account ID / Key ID</label><input [(ngModel)]="b2.account" />
            <label>Application key</label><input type="password" [(ngModel)]="b2.key" />
            <button (click)="save(api.createB2({ name: name(), path: path(), account: b2.account, key: b2.key }))" [disabled]="busy()">Save</button>
          </div>
        }
        @case ('sftp') {
          <div class="form">
            <label>Name</label><input [(ngModel)]="name" />
            <label>Remote path</label><input [(ngModel)]="path" placeholder="/backups/myapp" />
            <div class="g2">
              <div><label>Host</label><input [(ngModel)]="sftp.host" /></div>
              <div><label>Port</label><input type="number" [(ngModel)]="sftp.port" /></div>
            </div>
            <label>Username</label><input [(ngModel)]="sftp.username" />
            <label>Password (or leave blank to use a key file)</label><input type="password" [(ngModel)]="sftp.password" />
            <label>Key file path on agent (optional)</label><input [(ngModel)]="sftp.keyFile" placeholder="/keys/id_rsa" />
            <button (click)="save(api.createSftp({ name: name(), path: path(), host: sftp.host, port: sftp.port, username: sftp.username, password: sftp.password || null, keyFile: sftp.keyFile || null }))" [disabled]="busy()">Save</button>
          </div>
        }
        @case ('webdav') {
          <div class="form">
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>WebDAV URL</label><input [(ngModel)]="webdav.url" placeholder="https://cloud.example.com/remote.php/dav/files/me/" />
            <label>Vendor</label>
            <select [(ngModel)]="webdav.vendor">
              <option value="nextcloud">Nextcloud</option>
              <option value="owncloud">ownCloud</option>
              <option value="other">Other / Yandex / Koofr</option>
            </select>
            <div class="g2">
              <div><label>Username</label><input [(ngModel)]="webdav.username" /></div>
              <div><label>Password</label><input type="password" [(ngModel)]="webdav.password" /></div>
            </div>
            <button (click)="save(api.createWebDav({ name: name(), path: path(), url: webdav.url, vendor: webdav.vendor, username: webdav.username, password: webdav.password }))" [disabled]="busy()">Save</button>
          </div>
        }
        @case ('custom') {
          <div class="form">
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Paste an rclone config block</label>
            <textarea rows="8" [(ngModel)]="custom" placeholder="[onedrive]&#10;type = onedrive&#10;token = {...}&#10;drive_id = ...&#10;drive_type = personal"></textarea>
            <p class="hint">Run <code>rclone config</code> on any machine (it handles the browser login for OneDrive, Dropbox, Yandex, pCloud, …), then paste the resulting <code>[name]</code> block here. The header is rewritten automatically.</p>
            <button (click)="save(api.createCustom({ name: name(), path: path(), rcloneConfig: custom() }))" [disabled]="busy()">Save</button>
          </div>
        }
      }
      @if (error()) { <div class="err">{{ error() }}</div> }
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
    .kinds { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .chip { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 7px 13px; }
    .chip.on { background: var(--primary); border-color: var(--primary); color: #fff; }
    .covers { font-size: 13px; color: var(--muted); margin: 0 0 16px; }
    .covers span { color: var(--text); }
    .form { display: grid; gap: 6px; max-width: 620px; }
    .form .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { margin-top: 8px; }
    textarea { font: 13px/1.5 monospace; width: 100%; padding: 10px 12px; background: var(--surface-2);
               border: 1px solid var(--border); border-radius: 8px; color: var(--text); resize: vertical; }
    .hint { font-size: 12px; color: var(--muted); margin: 6px 0 0; }
    button { margin-top: 16px; }
    button.g { background: #fff; color: #222; }
    .err { color: var(--fail); margin-top: 12px; }
    h3 { margin-bottom: 14px; }
  `,
})
export class Destinations {
  protected api = inject(Api);
  protected catalog = CATALOG;
  protected kinds: Kind[] = ['gdrive', 's3', 'b2', 'sftp', 'webdav', 'custom'];

  items = signal<RemoteDto[]>([]);
  kind = signal<Kind>('gdrive');
  busy = signal(false);
  error = signal<string | null>(null);

  name = signal('');
  path = signal('backups/myapp');
  custom = signal('');
  s3 = { endpoint: '', accessKey: '', secretKey: '', region: '' };
  b2 = { account: '', key: '' };
  sftp = { host: '', port: 22, username: '', password: '', keyFile: '' };
  webdav = { url: '', vendor: 'nextcloud', username: '', password: '' };

  remoteTypeLabel = remoteTypeLabel;

  constructor() { this.load(); }

  load() { this.api.remotes().subscribe(r => this.items.set(r)); }

  select(k: Kind) {
    this.kind.set(k);
    this.error.set(null);
    if (!this.name() || this.kinds.includes(this.name() as Kind)) this.name.set(k);
  }

  save(obs: { subscribe: Function }) {
    this.busy.set(true);
    this.error.set(null);
    (obs as any).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: (e: any) => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  connectGoogle() {
    this.busy.set(true);
    this.error.set(null);
    this.api.googleConnect(this.name() || 'gdrive', this.path()).subscribe({
      next: res => (window.location.href = res.url),
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  private msg(e: any): string {
    return e?.error?.error
      ?? (e?.error?.errors ? Object.values(e.error.errors).flat().join('; ') : null)
      ?? (e?.status === 0 ? 'Cannot reach the server' : 'Failed to save');
  }
}
