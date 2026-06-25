import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { RemoteDto } from '../../core/models';
import { remoteTypeLabel } from '../../core/format';
import { Lang } from '../../core/lang';
import { Modal } from '../../shared/modal';

type Kind = 'gdrive' | 'onedrive' | 'dropbox' | 'yandex' | 's3' | 'b2' | 'sftp' | 'webdav' | 'custom';

const CATALOG: Record<Kind, { title: string; covers: string }> = {
  gdrive: { title: 'Google Drive', covers: 'Google Drive — one-button OAuth' },
  onedrive: { title: 'OneDrive', covers: 'Microsoft OneDrive (personal & business) — one-button OAuth' },
  dropbox: { title: 'Dropbox', covers: 'Dropbox — one-button OAuth' },
  yandex: { title: 'Yandex Disk', covers: 'Yandex Disk — one-button OAuth' },
  s3: { title: 'S3-compatible', covers: 'AWS S3 · MinIO · Cloudflare R2 · Wasabi · Backblaze B2 (S3) · DigitalOcean Spaces · any S3 API' },
  b2: { title: 'Backblaze B2', covers: 'Backblaze B2 — native application key' },
  sftp: { title: 'SFTP / SSH', covers: 'any SSH/SFTP server · VPS · NAS' },
  webdav: { title: 'WebDAV', covers: 'Nextcloud · ownCloud · Yandex Disk · Koofr · any WebDAV server' },
  custom: { title: 'Custom (rclone)', covers: 'pCloud · Storj · Mega · Jottacloud · Box · 70+ rclone backends' },
};

@Component({
  selector: 'app-destinations',
  imports: [FormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('dest.title') }}</h1><p class="muted">{{ lang.t('dest.subtitle') }}</p></div>
      <div class="spacer"></div>
      <button (click)="open()">{{ lang.t('dest.add') }}</button>
    </div>

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">{{ lang.t('empty.destinations') }}</p>
      } @else {
        <table>
          <thead><tr><th>{{ lang.t('f.name') }}</th><th>{{ lang.t('f.type') }}</th><th>{{ lang.t('f.path') }}</th><th></th></tr></thead>
          <tbody>
            @for (r of items(); track r.id) {
              <tr>
                <td>{{ r.name }}</td><td>{{ remoteTypeLabel(r.type) }}</td><td class="muted">{{ r.path }}</td>
                <td class="right"><button class="ghost danger" (click)="remove(r)">{{ lang.t('btn.delete') }}</button></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (adding()) {
      <app-modal [title]="lang.t('m.addDestination')" (close)="adding.set(false)">
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
            @if (googleConfigured() && !editGoogle()) {
              <p class="ok-note">✓ Google OAuth app configured. <a class="lnk" (click)="editGoogle.set(true)">Change credentials</a></p>
              <label>Name</label><input [(ngModel)]="name" />
              <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
              <button class="g" (click)="connectGoogle()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : 'Connect Google Drive' }}</button>
              <p class="hint">Clicking Connect opens Google's consent screen. After you approve, the Drive is linked <b>automatically</b> — no token to copy or paste.</p>
            } @else {
              <p class="hint">One-time setup: create an OAuth client in Google Cloud (enable Drive API, configure the consent screen → Production), with redirect URI <code>{{ origin }}/api/remotes/google/callback</code>, then paste its credentials here. After saving, click Connect to authorize a Drive.</p>
              <label>Client ID</label><input [(ngModel)]="gClientId" placeholder="xxxx.apps.googleusercontent.com" />
              <label>Client Secret</label><input type="password" [(ngModel)]="gClientSecret" />
              <div class="row" style="gap:10px;margin-top:16px">
                <button (click)="saveGoogleCreds()" [disabled]="busy()">Save credentials</button>
                @if (googleConfigured()) { <button class="ghost" (click)="editGoogle.set(false)">Cancel</button> }
              </div>
            }
          }
          @case ('onedrive') {
            @if (oneDriveConfigured() && !editOneDrive()) {
              <p class="ok-note">✓ OneDrive OAuth app configured. <a class="lnk" (click)="editOneDrive.set(true)">Change credentials</a></p>
              <label>Name</label><input [(ngModel)]="name" />
              <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
              <button class="g" (click)="connectOneDrive()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : 'Connect OneDrive' }}</button>
              <p class="hint">Clicking Connect opens Microsoft's consent screen. After you approve, the drive is linked <b>automatically</b> — no token to copy.</p>
            } @else {
              <p class="hint">One-time setup: register an app in <b>Azure / Microsoft Entra</b> (App registrations → New), add a Web redirect URI <code>{{ origin }}/api/remotes/onedrive/callback</code>, grant Microsoft Graph <code>Files.ReadWrite.All</code> + <code>offline_access</code>, then paste the Application (client) ID and a client secret.</p>
              <label>Client ID</label><input [(ngModel)]="odClientId" placeholder="00000000-0000-0000-0000-000000000000" />
              <label>Client Secret</label><input type="password" [(ngModel)]="odClientSecret" />
              <div class="row" style="gap:10px;margin-top:16px">
                <button (click)="saveOneDriveCreds()" [disabled]="busy()">Save credentials</button>
                @if (oneDriveConfigured()) { <button class="ghost" (click)="editOneDrive.set(false)">Cancel</button> }
              </div>
            }
          }
          @case ('dropbox') {
            @if (dropboxConfigured() && !editDropbox()) {
              <p class="ok-note">✓ Dropbox app configured. <a class="lnk" (click)="editDropbox.set(true)">Change credentials</a></p>
              <label>Name</label><input [(ngModel)]="name" />
              <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
              <button class="g" (click)="connectDropbox()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : 'Connect Dropbox' }}</button>
              <p class="hint">Connect opens Dropbox's consent screen. After you approve, it's linked <b>automatically</b> — no token to copy.</p>
            } @else {
              <p class="hint">One-time setup: create an app at <b>dropbox.com/developers/apps</b> (Scoped access → Full Dropbox), add redirect URI <code>{{ origin }}/api/remotes/dropbox/callback</code>, enable <code>files.content.read</code> + <code>files.content.write</code>, then paste the App key and App secret.</p>
              <label>App key (Client ID)</label><input [(ngModel)]="dbClientId" />
              <label>App secret</label><input type="password" [(ngModel)]="dbClientSecret" />
              <div class="row" style="gap:10px;margin-top:16px">
                <button (click)="saveDropboxCreds()" [disabled]="busy()">Save credentials</button>
                @if (dropboxConfigured()) { <button class="ghost" (click)="editDropbox.set(false)">Cancel</button> }
              </div>
            }
          }
          @case ('yandex') {
            @if (yandexConfigured() && !editYandex()) {
              <p class="ok-note">✓ Yandex app configured. <a class="lnk" (click)="editYandex.set(true)">Change credentials</a></p>
              <label>Name</label><input [(ngModel)]="name" />
              <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
              <button class="g" (click)="connectYandex()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : 'Connect Yandex Disk' }}</button>
              <p class="hint">Connect opens Yandex's consent screen. After you approve, it's linked <b>automatically</b>.</p>
            } @else {
              <p class="hint">One-time setup: create an app at <b>oauth.yandex.com</b>, add the <b>Web service</b> platform with callback URI <code>{{ origin }}/api/remotes/yandex/callback</code>, grant <b>Yandex.Disk REST API</b> (read+write), then paste the Client ID and password.</p>
              <label>Client ID</label><input [(ngModel)]="yaClientId" />
              <label>Client password (secret)</label><input type="password" [(ngModel)]="yaClientSecret" />
              <div class="row" style="gap:10px;margin-top:16px">
                <button (click)="saveYandexCreds()" [disabled]="busy()">Save credentials</button>
                @if (yandexConfigured()) { <button class="ghost" (click)="editYandex.set(false)">Cancel</button> }
              </div>
            }
          }
          @case ('s3') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Endpoint</label><input [(ngModel)]="s3.endpoint" placeholder="https://s3.amazonaws.com (or MinIO/R2 URL)" />
            <div class="g2">
              <div><label>Access key</label><input [(ngModel)]="s3.accessKey" /></div>
              <div><label>Secret key</label><input type="password" [(ngModel)]="s3.secretKey" /></div>
            </div>
            <label>Region (optional)</label><input [(ngModel)]="s3.region" placeholder="us-east-1" />
            <button (click)="save(api.createS3({ name: name, path: path, endpoint: s3.endpoint, accessKey: s3.accessKey, secretKey: s3.secretKey, region: s3.region || null }))" [disabled]="busy()">Add destination</button>
          }
          @case ('b2') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Account ID / Key ID</label><input [(ngModel)]="b2.account" />
            <label>Application key</label><input type="password" [(ngModel)]="b2.key" />
            <button (click)="save(api.createB2({ name: name, path: path, account: b2.account, key: b2.key }))" [disabled]="busy()">Add destination</button>
          }
          @case ('sftp') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Remote path</label><input [(ngModel)]="path" placeholder="/backups/myapp" />
            <div class="g2">
              <div><label>Host</label><input [(ngModel)]="sftp.host" /></div>
              <div><label>Port</label><input type="number" [(ngModel)]="sftp.port" /></div>
            </div>
            <label>Username</label><input [(ngModel)]="sftp.username" />
            <label>Password (or leave blank to use a key file)</label><input type="password" [(ngModel)]="sftp.password" />
            <label>Key file path on agent (optional)</label><input [(ngModel)]="sftp.keyFile" placeholder="/keys/id_rsa" />
            <button (click)="save(api.createSftp({ name: name, path: path, host: sftp.host, port: sftp.port, username: sftp.username, password: sftp.password || null, keyFile: sftp.keyFile || null }))" [disabled]="busy()">Add destination</button>
          }
          @case ('webdav') {
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
            <button (click)="save(api.createWebDav({ name: name, path: path, url: webdav.url, vendor: webdav.vendor, username: webdav.username, password: webdav.password }))" [disabled]="busy()">Add destination</button>
          }
          @case ('custom') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Paste an rclone config block</label>
            <textarea rows="7" [(ngModel)]="custom" placeholder="[onedrive]&#10;type = onedrive&#10;token = {...}&#10;drive_id = ...&#10;drive_type = personal"></textarea>
            <p class="hint">Run <code>rclone config</code> on any machine (it handles the browser login for OneDrive, Dropbox, Yandex, …), then paste the resulting <code>[name]</code> block. The header is rewritten automatically.</p>
            <button (click)="save(api.createCustom({ name: name, path: path, rcloneConfig: custom }))" [disabled]="busy()">Add destination</button>
          }
        }
        @if (error()) { <div class="err">{{ error() }}</div> }
      </app-modal>
    }
  `,
  styles: `
    h1 { margin: 0; }
    .right { text-align: right; }
    .kinds { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .chip { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 7px 13px; }
    .chip.on { background: var(--primary); border-color: var(--primary); color: #fff; }
    .covers { font-size: 13px; color: var(--muted); margin: 0 0 16px; }
    .covers span { color: var(--text); }
    label { margin-top: 10px; }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    textarea { font: 13px/1.5 monospace; width: 100%; padding: 10px 12px; background: var(--surface-2);
               border: 1px solid var(--border); border-radius: 8px; color: var(--text); resize: vertical; }
    .hint { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
    .ok-note { font-size: 13px; color: var(--ok); margin: 0 0 8px; }
    .lnk { color: var(--primary); cursor: pointer; text-decoration: underline; }
    button { margin-top: 16px; }
    button.g { background: #fff; color: #222; }
    button.danger { color: var(--fail); border-color: var(--fail); margin-top: 0; }
    button.danger:hover { background: rgba(226,85,78,.12); }
    .err { color: var(--fail); margin-top: 14px; }
  `,
})
export class Destinations {
  protected api = inject(Api);
  lang = inject(Lang);
  protected catalog = CATALOG;
  protected kinds: Kind[] = ['gdrive', 'onedrive', 'dropbox', 'yandex', 's3', 'b2', 'sftp', 'webdav', 'custom'];
  protected origin = location.origin;

  items = signal<RemoteDto[]>([]);
  adding = signal(false);
  kind = signal<Kind>('s3');
  busy = signal(false);
  error = signal<string | null>(null);
  googleConfigured = signal(false);
  editGoogle = signal(false);
  oneDriveConfigured = signal(false);
  editOneDrive = signal(false);
  dropboxConfigured = signal(false);
  editDropbox = signal(false);
  yandexConfigured = signal(false);
  editYandex = signal(false);

  name = 's3';
  path = 'backups/myapp';
  custom = '';
  gClientId = ''; gClientSecret = '';
  odClientId = ''; odClientSecret = '';
  dbClientId = ''; dbClientSecret = '';
  yaClientId = ''; yaClientSecret = '';
  s3 = { endpoint: '', accessKey: '', secretKey: '', region: '' };
  b2 = { account: '', key: '' };
  sftp = { host: '', port: 22, username: '', password: '', keyFile: '' };
  webdav = { url: '', vendor: 'nextcloud', username: '', password: '' };

  remoteTypeLabel = remoteTypeLabel;

  constructor() {
    this.load();
    this.api.settings().subscribe(s => {
      this.googleConfigured.set(s.googleConfigured);
      this.oneDriveConfigured.set(s.oneDriveConfigured);
      this.dropboxConfigured.set(s.dropboxConfigured);
      this.yandexConfigured.set(s.yandexConfigured);
    });
  }

  load() { this.api.remotes().subscribe(r => this.items.set(r)); }

  open() { this.error.set(null); this.select('s3'); this.adding.set(true); }

  select(k: Kind) {
    this.kind.set(k);
    this.error.set(null);
    if (!this.name || this.kinds.includes(this.name as Kind)) this.name = (k === 'gdrive' ? 'gdrive' : k);
  }

  save(obs: { subscribe: Function }) {
    this.busy.set(true);
    this.error.set(null);
    (obs as any).subscribe({
      next: () => { this.busy.set(false); this.adding.set(false); this.load(); },
      error: (e: any) => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  saveGoogleCreds() {
    if (!this.gClientId || !this.gClientSecret) return;
    this.busy.set(true);
    this.api.updateGoogle(this.gClientId, this.gClientSecret).subscribe({
      next: () => { this.busy.set(false); this.googleConfigured.set(true); this.editGoogle.set(false); this.gClientSecret = ''; },
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  connectGoogle() {
    this.busy.set(true);
    this.error.set(null);
    this.api.googleConnect(this.name || 'gdrive', this.path).subscribe({
      next: res => (window.location.href = res.url),
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  saveOneDriveCreds() {
    if (!this.odClientId || !this.odClientSecret) return;
    this.busy.set(true);
    this.api.updateOneDrive(this.odClientId, this.odClientSecret).subscribe({
      next: () => { this.busy.set(false); this.oneDriveConfigured.set(true); this.editOneDrive.set(false); this.odClientSecret = ''; },
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  connectOneDrive() {
    this.busy.set(true);
    this.error.set(null);
    this.api.oneDriveConnect(this.name || 'onedrive', this.path).subscribe({
      next: res => (window.location.href = res.url),
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  saveDropboxCreds() {
    if (!this.dbClientId || !this.dbClientSecret) return;
    this.busy.set(true);
    this.api.updateDropbox(this.dbClientId, this.dbClientSecret).subscribe({
      next: () => { this.busy.set(false); this.dropboxConfigured.set(true); this.editDropbox.set(false); this.dbClientSecret = ''; },
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  connectDropbox() {
    this.busy.set(true);
    this.error.set(null);
    this.api.dropboxConnect(this.name || 'dropbox', this.path).subscribe({
      next: res => (window.location.href = res.url),
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  saveYandexCreds() {
    if (!this.yaClientId || !this.yaClientSecret) return;
    this.busy.set(true);
    this.api.updateYandex(this.yaClientId, this.yaClientSecret).subscribe({
      next: () => { this.busy.set(false); this.yandexConfigured.set(true); this.editYandex.set(false); this.yaClientSecret = ''; },
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  connectYandex() {
    this.busy.set(true);
    this.error.set(null);
    this.api.yandexConnect(this.name || 'yandex', this.path).subscribe({
      next: res => (window.location.href = res.url),
      error: e => { this.busy.set(false); this.error.set(this.msg(e)); },
    });
  }

  remove(r: RemoteDto) {
    if (!confirm(`Delete destination "${r.name}"?`)) return;
    this.api.deleteRemote(r.id).subscribe({ next: () => this.load(), error: e => alert(this.msg(e)) });
  }

  private msg(e: any): string {
    return e?.error?.error
      ?? (e?.error?.errors ? Object.values(e.error.errors).flat().join('; ') : null)
      ?? (e?.status === 0 ? 'Cannot reach the server' : 'Failed to save');
  }
}
