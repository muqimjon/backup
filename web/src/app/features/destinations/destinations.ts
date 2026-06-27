import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { CommandKind, RemoteDto, RemoteType } from '../../core/models';
import { remoteTypeLabel } from '../../core/format';
import { Lang } from '../../core/lang';
import { Toast } from '../../core/toast';
import { Modal } from '../../shared/modal';

type Kind = 'gdrive' | 'onedrive' | 'dropbox' | 'yandex' | 's3' | 'b2' | 'sftp' | 'webdav' | 'custom';

const CATALOG: Record<Kind, { title: string; covers: string }> = {
  gdrive: { title: 'Google Drive', covers: 'Google Drive — one-time web setup, then one-click connect' },
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
                <td class="right acts">
                  <button class="ghost" (click)="test(r)">{{ lang.t('btn.test') }}</button>
                  <button class="ghost" (click)="edit(r)">{{ lang.t('btn.edit') }}</button>
                  <button class="ghost danger" (click)="remove(r)">{{ lang.t('btn.delete') }}</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    @if (adding()) {
      <app-modal [title]="editingId() ? lang.t('m.editDestination') : lang.t('m.addDestination')" (close)="adding.set(false)">
        @if (!editingId()) {
          <div class="kinds">
            @for (k of kinds; track k) {
              <button class="chip" [class.on]="kind() === k" (click)="select(k)" [title]="catalog[k].covers">
                {{ catalog[k].title }}
              </button>
            }
          </div>
          <p class="covers">☁️ Covers: <span>{{ catalog[kind()].covers }}</span></p>
        } @else {
          <p class="covers">{{ catalog[kind()].title }}</p>
        }

        @switch (kind()) {
          @case ('gdrive') {
            <label>Name</label><input [(ngModel)]="name" placeholder="e.g. client-a-gdrive" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />

            @if (editingId()) {
              <button (click)="submitMeta()" [disabled]="busy()">{{ lang.t('btn.save') }}</button>
              <p class="hint">To link a different Google account, delete this destination and add it again.</p>
            } @else if (gMethod() === 'app') {
              @if (googleConfigured() && !editGoogle()) {
                <p class="ok-note">✓ Google app configured once — connecting is one click.</p>
                <button class="g" (click)="connectGoogle()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : 'Connect Google Drive' }}</button>
                <p class="hint">Opens Google's <b>account chooser</b> — pick the account for this destination. You can link several accounts (one per destination). <a class="lnk" (click)="editGoogle.set(true)">Change app credentials</a> · <a class="lnk" (click)="gMethod.set('easy')">paste a token instead</a></p>
              } @else {
                <p class="ok-note">One-time setup — every Google Drive destination reuses it afterwards (≈ 2 min).</p>
                <ol class="steps">
                  <li>Open <a class="lnk" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credentials</a> → <b>Create credentials</b> → <b>OAuth client ID</b> → application type <b>Web application</b>.</li>
                  <li>Under <b>Authorized redirect URIs</b> → Add URI → paste exactly this:
                    <div class="cmd"><code>{{ gRedirect }}</code>
                      <button type="button" class="ghost sm" (click)="copy(gRedirect)">{{ copied() ? 'Copied ✓' : 'Copy' }}</button>
                    </div>
                  </li>
                  <li>Enable the <a class="lnk" href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener">Google Drive API</a>.</li>
                  <li>On the <b>OAuth consent screen</b>, set <b>Publishing status → In production</b> — otherwise the connection expires after 7 days. (A one-time “unverified app” notice is fine: Advanced → Go to … .)</li>
                  <li>Copy the client's <b>ID</b> and <b>secret</b> and paste them here:</li>
                </ol>
                <label>Client ID</label><input [(ngModel)]="gClientId" placeholder="xxxx.apps.googleusercontent.com" />
                <label>Client Secret</label><input type="password" [(ngModel)]="gClientSecret" />
                <div class="row" style="gap:10px;margin-top:16px">
                  <button (click)="saveGoogleCreds()" [disabled]="busy() || !gClientId || !gClientSecret">{{ busy() ? 'Saving…' : 'Save & continue' }}</button>
                  @if (googleConfigured()) { <button class="ghost" (click)="editGoogle.set(false)">Cancel</button> }
                </div>
                <p class="hint">No Google Cloud account? <a class="lnk" (click)="gMethod.set('easy')">Use the local rclone method instead</a></p>
              }
            } @else {
              <p class="ok-note">✓ No Google Cloud project — rclone signs you in with its own app, on your computer.</p>
              <ol class="steps">
                <li>On your computer, install <a class="lnk" href="https://rclone.org/downloads/" target="_blank" rel="noopener">rclone</a>, then run:
                  <div class="cmd"><code>rclone authorize "drive"</code>
                    <button type="button" class="ghost sm" (click)="copy('rclone authorize &quot;drive&quot;')">{{ copied() ? 'Copied ✓' : 'Copy' }}</button>
                  </div>
                </li>
                <li>A browser opens — sign in to the Google account and allow access.</li>
                <li>rclone prints a token. Copy the whole block and paste it here:</li>
              </ol>
              <textarea rows="5" [(ngModel)]="gToken" placeholder='{&#10;  "access_token": "ya29…",&#10;  "token_type": "Bearer",&#10;  "refresh_token": "1//…",&#10;  "expiry": "2026-…"&#10;}'></textarea>
              <button (click)="connectToken('drive')" [disabled]="busy() || !gToken.trim()">{{ busy() ? 'Saving…' : 'Add destination' }}</button>
              <p class="hint">Recommended: <a class="lnk" (click)="gMethod.set('app')">one-time web setup → one-click connect</a></p>
            }
          }
          @case ('onedrive') {
            <label>Name</label><input [(ngModel)]="name" placeholder="e.g. client-a-onedrive" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            @if (oneDriveConfigured() && !editOneDrive()) {
              <div class="row" style="gap:10px"><button class="g" (click)="connectOneDrive()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : (editingId() ? 'Reconnect OneDrive' : 'Connect OneDrive') }}</button>
                @if (editingId()) { <button (click)="submitMeta()" [disabled]="busy()">{{ lang.t('btn.save') }}</button> }</div>
              <p class="hint">Connect opens Microsoft's <b>account picker</b> — pick the account for this destination. You can link <b>several accounts</b> (one per client), each as its own destination. <a class="lnk" (click)="editOneDrive.set(true)">Change app credentials</a></p>
            } @else if (editOneDrive()) {
              <p class="hint">One-time setup: register an app in <b>Azure / Microsoft Entra</b> (App registrations → New), add a Web redirect URI <code>{{ origin }}/api/remotes/onedrive/callback</code>, grant Microsoft Graph <code>Files.ReadWrite.All</code> + <code>offline_access</code>, then paste the Application (client) ID and a client secret.</p>
              <label>Client ID</label><input [(ngModel)]="odClientId" placeholder="00000000-0000-0000-0000-000000000000" />
              <label>Client Secret</label><input type="password" [(ngModel)]="odClientSecret" />
              <div class="row" style="gap:10px;margin-top:16px">
                <button (click)="saveOneDriveCreds()" [disabled]="busy()">Save credentials</button>
                <button class="ghost" (click)="editOneDrive.set(false)">Cancel</button>
              </div>
            } @else {
              <p class="hint">This destination needs a one-time Azure / Microsoft Entra app. <a class="lnk" (click)="editOneDrive.set(true)">Set up app credentials</a></p>
            }
          }
          @case ('dropbox') {
            <label>Name</label><input [(ngModel)]="name" placeholder="e.g. client-a-dropbox" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            @if (dropboxConfigured() && !editDropbox()) {
              <div class="row" style="gap:10px"><button class="g" (click)="connectDropbox()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : (editingId() ? 'Reconnect Dropbox' : 'Connect Dropbox') }}</button>
                @if (editingId()) { <button (click)="submitMeta()" [disabled]="busy()">{{ lang.t('btn.save') }}</button> }</div>
              <p class="hint">Connect opens Dropbox's approval screen — sign in with the account for this destination. You can link <b>several accounts</b> (one per client), each as its own destination. <a class="lnk" (click)="editDropbox.set(true)">Change app credentials</a></p>
            } @else if (editDropbox()) {
              <p class="hint">One-time setup: create an app at <b>dropbox.com/developers/apps</b> (Scoped access → Full Dropbox), add redirect URI <code>{{ origin }}/api/remotes/dropbox/callback</code>, enable <code>files.content.read</code> + <code>files.content.write</code>, then paste the App key and App secret.</p>
              <label>App key (Client ID)</label><input [(ngModel)]="dbClientId" />
              <label>App secret</label><input type="password" [(ngModel)]="dbClientSecret" />
              <div class="row" style="gap:10px;margin-top:16px">
                <button (click)="saveDropboxCreds()" [disabled]="busy()">Save credentials</button>
                <button class="ghost" (click)="editDropbox.set(false)">Cancel</button>
              </div>
            } @else {
              <p class="hint">This destination needs a one-time Dropbox app. <a class="lnk" (click)="editDropbox.set(true)">Set up app credentials</a></p>
            }
          }
          @case ('yandex') {
            <label>Name</label><input [(ngModel)]="name" placeholder="e.g. client-a-yandex" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            @if (yandexConfigured() && !editYandex()) {
              <div class="row" style="gap:10px"><button class="g" (click)="connectYandex()" [disabled]="busy()">{{ busy() ? 'Redirecting…' : (editingId() ? 'Reconnect Yandex Disk' : 'Connect Yandex Disk') }}</button>
                @if (editingId()) { <button (click)="submitMeta()" [disabled]="busy()">{{ lang.t('btn.save') }}</button> }</div>
              <p class="hint">Connect opens Yandex's approval screen — sign in with the account for this destination. You can link <b>several accounts</b> (one per client), each as its own destination. <a class="lnk" (click)="editYandex.set(true)">Change app credentials</a></p>
            } @else if (editYandex()) {
              <p class="hint">One-time setup: create an app at <b>oauth.yandex.com</b>, add the <b>Web service</b> platform with callback URI <code>{{ origin }}/api/remotes/yandex/callback</code>, grant <b>Yandex.Disk REST API</b> (read+write), then paste the Client ID and password.</p>
              <label>Client ID</label><input [(ngModel)]="yaClientId" />
              <label>Client password (secret)</label><input type="password" [(ngModel)]="yaClientSecret" />
              <div class="row" style="gap:10px;margin-top:16px">
                <button (click)="saveYandexCreds()" [disabled]="busy()">Save credentials</button>
                <button class="ghost" (click)="editYandex.set(false)">Cancel</button>
              </div>
            } @else {
              <p class="hint">This destination needs a one-time Yandex OAuth app. <a class="lnk" (click)="editYandex.set(true)">Set up app credentials</a></p>
            }
          }
          @case ('s3') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Endpoint</label><input [(ngModel)]="s3.endpoint" placeholder="https://s3.amazonaws.com (or MinIO/R2 URL)" />
            <div class="g2">
              <div><label>Access key</label><input [(ngModel)]="s3.accessKey" [placeholder]="editingId() ? lang.t('f.keepSecret') : ''" /></div>
              <div><label>Secret key</label><input type="password" [(ngModel)]="s3.secretKey" [placeholder]="editingId() ? lang.t('f.keepSecret') : ''" /></div>
            </div>
            <label>Region (optional)</label><input [(ngModel)]="s3.region" placeholder="us-east-1" />
            <button (click)="submit()" [disabled]="busy()">{{ editingId() ? lang.t('btn.save') : 'Add destination' }}</button>
          }
          @case ('b2') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Account ID / Key ID</label><input [(ngModel)]="b2.account" />
            <label>Application key</label><input type="password" [(ngModel)]="b2.key" [placeholder]="editingId() ? lang.t('f.keepSecret') : ''" />
            <button (click)="submit()" [disabled]="busy()">{{ editingId() ? lang.t('btn.save') : 'Add destination' }}</button>
          }
          @case ('sftp') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Remote path</label><input [(ngModel)]="path" placeholder="/backups/myapp" />
            <div class="g2">
              <div><label>Host</label><input [(ngModel)]="sftp.host" /></div>
              <div><label>Port</label><input type="number" [(ngModel)]="sftp.port" /></div>
            </div>
            <label>Username</label><input [(ngModel)]="sftp.username" />
            <label>Password (or leave blank to use a private key)</label><input type="password" [(ngModel)]="sftp.password" [placeholder]="editingId() ? lang.t('f.keepSecret') : ''" />
            <label>Private key (optional — paste or upload for key auth)</label>
            <textarea rows="4" [(ngModel)]="sftp.keyPem" [placeholder]="editingId() ? lang.t('f.keepSecret') : '-----BEGIN OPENSSH PRIVATE KEY-----\n…'"></textarea>
            <input type="file" class="file" (change)="loadKeyFile($event)" />
            <p class="hint">Paste the private key above, or choose its file to load it. The key is stored encrypted on the hub — no path on the agent needed. Leave blank to use the password.</p>
            <button (click)="submit()" [disabled]="busy()">{{ editingId() ? lang.t('btn.save') : 'Add destination' }}</button>
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
              <div><label>Password</label><input type="password" [(ngModel)]="webdav.password" [placeholder]="editingId() ? lang.t('f.keepSecret') : ''" /></div>
            </div>
            <button (click)="submit()" [disabled]="busy()">{{ editingId() ? lang.t('btn.save') : 'Add destination' }}</button>
          }
          @case ('custom') {
            <label>Name</label><input [(ngModel)]="name" />
            <label>Folder path</label><input [(ngModel)]="path" placeholder="backups/myapp" />
            <label>Paste an rclone config block</label>
            <textarea rows="7" [(ngModel)]="custom" [placeholder]="editingId() ? lang.t('f.keepSecret') : '[onedrive]\ntype = onedrive\ntoken = {...}\ndrive_id = ...\ndrive_type = personal'"></textarea>
            <p class="hint">Run <code>rclone config</code> on any machine (it handles the browser login for OneDrive, Dropbox, Yandex, …), then paste the resulting <code>[name]</code> block. The header is rewritten automatically.</p>
            <button (click)="submit()" [disabled]="busy()">{{ editingId() ? lang.t('btn.save') : 'Add destination' }}</button>
          }
        }
        @if (error()) { <div class="err">{{ error() }}</div> }
      </app-modal>
    }
  `,
  styles: `
    h1 { margin: 0; }
    .right { text-align: right; }
    .acts { display: flex; gap: 6px; justify-content: flex-end; align-items: center; }
    .acts button { margin-top: 0; }
    .notice { margin: 0 0 14px; padding: 10px 14px; border-radius: 8px; background: rgba(96,125,224,.14); color: var(--text); }
    .kinds { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .chip { background: var(--surface-2); border: 1px solid var(--border); color: var(--text); padding: 7px 13px; }
    .chip.on { background: var(--primary); border-color: var(--primary); color: #fff; }
    .covers { font-size: 13px; color: var(--muted); margin: 0 0 16px; }
    .covers span { color: var(--text); }
    label { margin-top: 10px; }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    textarea { font: 13px/1.5 monospace; width: 100%; padding: 10px 12px; background: var(--surface-2);
               border: 1px solid var(--border); border-radius: 8px; color: var(--text); resize: vertical; }
    .file { margin-top: 8px; font-size: 13px; color: var(--muted); }
    .hint { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
    .ok-note { font-size: 13px; color: var(--ok); margin: 10px 0 4px; }
    .steps { margin: 6px 0 10px; padding-left: 20px; font-size: 13px; color: var(--text); line-height: 1.7; }
    .steps li { margin-bottom: 4px; }
    .cmd { display: flex; align-items: center; gap: 8px; margin: 6px 0; padding: 8px 12px;
           background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; }
    .cmd code { font: 13px/1.4 monospace; color: var(--text); flex: 1; }
    .sm { padding: 4px 10px; font-size: 12px; margin-top: 0; }
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
  private cdr = inject(ChangeDetectorRef);
  private toast = inject(Toast);
  lang = inject(Lang);
  protected catalog = CATALOG;
  protected kinds: Kind[] = ['gdrive', 'onedrive', 'dropbox', 'yandex', 's3', 'b2', 'sftp', 'webdav', 'custom'];
  protected origin = location.origin;

  items = signal<RemoteDto[]>([]);
  adding = signal(false);
  editingId = signal<string | null>(null);
  kind = signal<Kind>('s3');
  busy = signal(false);
  error = signal<string | null>(null);
  googleConfigured = signal(false);
  editGoogle = signal(false);
  gMethod = signal<'easy' | 'app'>('app');
  copied = signal(false);
  oneDriveConfigured = signal(false);
  editOneDrive = signal(false);
  dropboxConfigured = signal(false);
  editDropbox = signal(false);
  yandexConfigured = signal(false);
  editYandex = signal(false);

  name = 's3';
  path = 'backups/myapp';
  custom = '';
  gToken = '';
  gClientId = ''; gClientSecret = '';
  odClientId = ''; odClientSecret = '';
  dbClientId = ''; dbClientSecret = '';
  yaClientId = ''; yaClientSecret = '';
  s3 = { endpoint: '', accessKey: '', secretKey: '', region: '' };
  b2 = { account: '', key: '' };
  sftp = { host: '', port: 22, username: '', password: '', keyFile: '', keyPem: '' };
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

  open() { this.error.set(null); this.editingId.set(null); this.resetForm(); this.select('s3'); this.adding.set(true); }

  edit(r: RemoteDto) {
    this.error.set(null);
    this.resetForm();
    const k = this.typeToKind(r.type);
    this.kind.set(k);
    this.editingId.set(r.id);
    this.name = r.name;
    this.path = r.path;
    this.adding.set(true);
    // Prefill non-secret config (secrets stay blank → blank means "keep").
    this.api.remoteDetail(r.id).subscribe(d => {
      this.name = d.name; this.path = d.path;
      if (k === 's3') this.s3 = { endpoint: d.endpoint || '', accessKey: '', secretKey: '', region: d.region || '' };
      else if (k === 'b2') this.b2 = { account: d.account || '', key: '' };
      else if (k === 'sftp') this.sftp = { host: d.host || '', port: d.port || 22, username: d.username || '', password: '', keyFile: d.keyFile || '', keyPem: '' };
      else if (k === 'webdav') this.webdav = { url: d.url || '', vendor: d.vendor || 'other', username: d.username || '', password: '' };
      this.cdr.markForCheck();
    });
  }

  submit() {
    const id = this.editingId();
    const k = this.kind();
    let req: { subscribe: Function } | null = null;
    if (k === 's3') {
      const b = { name: this.name, path: this.path, endpoint: this.s3.endpoint, accessKey: this.s3.accessKey, secretKey: this.s3.secretKey, region: this.s3.region || null };
      req = id ? this.api.updateS3(id, b) : this.api.createS3(b);
    } else if (k === 'b2') {
      const b = { name: this.name, path: this.path, account: this.b2.account, key: this.b2.key };
      req = id ? this.api.updateB2(id, b) : this.api.createB2(b);
    } else if (k === 'sftp') {
      const b = { name: this.name, path: this.path, host: this.sftp.host, port: this.sftp.port, username: this.sftp.username, password: this.sftp.password || null, keyFile: this.sftp.keyFile || null, keyPem: this.sftp.keyPem || null };
      req = id ? this.api.updateSftp(id, b) : this.api.createSftp(b);
    } else if (k === 'webdav') {
      const b = { name: this.name, path: this.path, url: this.webdav.url, vendor: this.webdav.vendor, username: this.webdav.username, password: this.webdav.password };
      req = id ? this.api.updateWebDav(id, b) : this.api.createWebDav(b);
    } else if (k === 'custom') {
      const b = { name: this.name, path: this.path, rcloneConfig: this.custom };
      req = id ? this.api.updateCustom(id, b) : this.api.createCustom(b);
    }
    if (req) this.save(req);
  }

  submitMeta() {
    const id = this.editingId();
    if (!id) return;
    this.save(this.api.updateRemoteMeta(id, this.name, this.path));
  }

  private typeToKind(t: RemoteType): Kind {
    switch (t) {
      case RemoteType.GoogleDrive: return 'gdrive';
      case RemoteType.OneDrive: return 'onedrive';
      case RemoteType.Dropbox: return 'dropbox';
      case RemoteType.Yandex: return 'yandex';
      case RemoteType.S3: return 's3';
      case RemoteType.B2: return 'b2';
      case RemoteType.Sftp: return 'sftp';
      case RemoteType.WebDav: return 'webdav';
      default: return 'custom';
    }
  }

  private resetForm() {
    this.custom = '';
    this.gToken = '';
    this.gMethod.set('app');
    this.editGoogle.set(false);
    this.s3 = { endpoint: '', accessKey: '', secretKey: '', region: '' };
    this.b2 = { account: '', key: '' };
    this.sftp = { host: '', port: 22, username: '', password: '', keyFile: '', keyPem: '' };
    this.webdav = { url: '', vendor: 'nextcloud', username: '', password: '' };
  }

  loadKeyFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this.sftp.keyPem = String(reader.result || ''); this.cdr.markForCheck(); };
    reader.readAsText(file);
  }

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

  copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => { this.copied.set(false); this.cdr.markForCheck(); }, 1500);
    });
  }
  get gRedirect() { return this.origin + '/api/remotes/google/callback'; }

  // Easy cloud connect — store a token from `rclone authorize "<backend>"`.
  connectToken(backend: string) {
    if (!this.gToken.trim()) return;
    this.save(this.api.storeRcloneToken({ name: this.name || backend, path: this.path, backend, token: this.gToken }));
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

  test(r: RemoteDto) {
    this.api.agents().subscribe(agents => {
      const online = agents.find(a => a.enabled && a.lastSeenAt && Date.now() - new Date(a.lastSeenAt).getTime() < 90_000);
      if (!online) { this.flash(this.lang.t('test.noAgent')); return; }
      this.api.enqueue(online.id, CommandKind.TestRemote, null, JSON.stringify({ remoteId: r.id, path: r.path })).subscribe();
      this.flash(this.lang.t('test.sent'));
    });
  }

  private flash(msg: string) { this.toast.show(msg); }

  private msg(e: any): string {
    return e?.error?.error
      ?? (e?.error?.errors ? Object.values(e.error.errors).flat().join('; ') : null)
      ?? (e?.status === 0 ? 'Cannot reach the server' : 'Failed to save');
  }
}
