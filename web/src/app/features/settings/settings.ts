import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { NotificationSettingsDto } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Settings</h1>
    <p class="muted">OAuth credentials and notifications — all configured here, nothing in the server files</p>

    @if (notice()) { <div class="notice">{{ notice() }}</div> }

    <div class="card">
      <h3>☁️ Google Drive OAuth
        @if (googleConfigured()) { <span class="ok-badge">configured ✓</span> }
      </h3>
      <p class="muted">Create an OAuth client in Google Cloud (Drive API + consent screen → Production),
        with redirect URI <code>{{ origin }}/api/remotes/google/callback</code>, then paste the credentials.</p>
      <label>Client ID</label><input [(ngModel)]="googleId" placeholder="xxxx.apps.googleusercontent.com" />
      <label>Client Secret</label><input type="password" [(ngModel)]="googleSecret" />
      <button (click)="saveGoogle()" [disabled]="busy()">Save Google credentials</button>
    </div>

    <div class="card">
      <h3>🔔 Notifications</h3>
      <p class="muted">Use <b>your own</b> SMTP and <b>your own</b> Telegram bot — nothing is shared. Secrets are encrypted.</p>

      @if (n(); as s) {
        <label>Notify on</label>
        <select [(ngModel)]="notifyOn">
          <option value="failure">Failures only</option>
          <option value="always">Every run</option>
          <option value="never">Never</option>
        </select>

        <h4>Email (SMTP)</h4>
        <div class="g2">
          <div><label>Host</label><input [(ngModel)]="smtpHost" placeholder="smtp.gmail.com" /></div>
          <div><label>Port</label><input type="number" [(ngModel)]="smtpPort" placeholder="587" /></div>
        </div>
        <div class="g2">
          <div><label>Username</label><input [(ngModel)]="smtpUser" /></div>
          <div><label>Password {{ s.smtpPassSet ? '(set — leave blank to keep)' : '' }}</label><input type="password" [(ngModel)]="smtpPass" /></div>
        </div>
        <div class="g2">
          <div><label>From</label><input [(ngModel)]="smtpFrom" /></div>
          <div><label>To (comma-separated)</label><input [(ngModel)]="smtpTo" /></div>
        </div>

        <h4>Webhook</h4>
        <label>URL (optional)</label><input [(ngModel)]="webhookUrl" placeholder="https://…" />

        <h4>Telegram</h4>
        <label>Bot token {{ s.telegramBotSet ? '(set — leave blank to keep)' : '(from @BotFather)' }}</label>
        <input type="password" [(ngModel)]="telegramToken" placeholder="123456:ABC-..." />

        <div class="row btns">
          <button (click)="saveNotifications()" [disabled]="busy()">Save notifications</button>
          <button class="ghost" (click)="sendTest()" [disabled]="busy()">Send test</button>
        </div>

        <h4>Link a Telegram chat</h4>
        <p class="muted">Press <b>Start</b> on your bot → it replies with a 6-digit code → enter it here.</p>
        <div class="row">
          <input class="code" [(ngModel)]="linkCode" placeholder="123456" />
          <button class="ghost" (click)="link()" [disabled]="busy()">Link</button>
        </div>
        @if (s.chats.length) {
          <table>
            <thead><tr><th>Chat</th><th>ID</th><th></th></tr></thead>
            <tbody>
              @for (c of s.chats; track c.id) {
                <tr>
                  <td>{{ c.label || '—' }}</td><td class="muted">{{ c.chatId }}</td>
                  <td><button class="ghost sm" (click)="unlink(c.id)">Remove</button></td>
                </tr>
              }
            </tbody>
          </table>
        } @else { <p class="muted">No chats linked yet.</p> }
      }
    </div>
  `,
  styles: `
    .card { margin-bottom: 18px; max-width: 720px; }
    h3 { margin-bottom: 8px; }
    h4 { margin: 18px 0 6px; font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
    label { margin-top: 8px; }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .btns { margin-top: 16px; }
    .code { max-width: 160px; }
    button.sm { padding: 4px 10px; }
    .ok-badge { font-size: 12px; color: var(--ok); background: rgba(47,191,113,.15); padding: 2px 10px; border-radius: 20px; margin-left: 8px; }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }
    button { margin-top: 8px; }
  `,
})
export class Settings {
  private api = inject(Api);
  protected origin = location.origin;

  n = signal<NotificationSettingsDto | null>(null);
  googleConfigured = signal(false);
  busy = signal(false);
  notice = signal<string | null>(null);

  googleId = ''; googleSecret = '';
  notifyOn = 'failure';
  smtpHost = ''; smtpPort: number | null = 587; smtpUser = ''; smtpPass = ''; smtpFrom = ''; smtpTo = '';
  webhookUrl = ''; telegramToken = ''; linkCode = '';

  constructor() { this.load(); }

  load() {
    this.api.settings().subscribe(s => this.googleConfigured.set(s.googleConfigured));
    this.api.notifications().subscribe(s => {
      this.n.set(s);
      this.notifyOn = s.notifyOn;
      this.smtpHost = s.smtpHost ?? ''; this.smtpPort = s.smtpPort ?? 587;
      this.smtpUser = s.smtpUser ?? ''; this.smtpFrom = s.smtpFrom ?? ''; this.smtpTo = s.smtpTo ?? '';
      this.webhookUrl = s.webhookUrl ?? '';
    });
  }

  saveGoogle() {
    if (!this.googleId || !this.googleSecret) return;
    this.busy.set(true);
    this.api.updateGoogle(this.googleId, this.googleSecret).subscribe({
      next: () => { this.busy.set(false); this.googleSecret = ''; this.flash('Google credentials saved.'); this.load(); },
      error: () => { this.busy.set(false); this.flash('Failed to save Google credentials.'); },
    });
  }

  saveNotifications() {
    this.busy.set(true);
    this.api.updateNotifications({
      notifyOn: this.notifyOn,
      smtpHost: this.smtpHost || null, smtpPort: this.smtpPort, smtpUser: this.smtpUser || null,
      smtpPass: this.smtpPass || null, smtpFrom: this.smtpFrom || null, smtpTo: this.smtpTo || null,
      webhookUrl: this.webhookUrl || null, telegramBotToken: this.telegramToken || null,
    }).subscribe({
      next: () => { this.busy.set(false); this.smtpPass = ''; this.telegramToken = ''; this.flash('Notifications saved.'); this.load(); },
      error: () => { this.busy.set(false); this.flash('Failed to save notifications.'); },
    });
  }

  sendTest() {
    this.busy.set(true);
    this.api.testNotification().subscribe({
      next: r => { this.busy.set(false); this.flash(r); },
      error: () => { this.busy.set(false); this.flash('Test failed.'); },
    });
  }

  link() {
    if (!this.linkCode) return;
    this.api.linkTelegram(this.linkCode).subscribe({
      next: ok => { this.flash(ok ? 'Telegram chat linked.' : 'Invalid or expired code.'); this.linkCode = ''; this.load(); },
      error: () => this.flash('Linking failed.'),
    });
  }

  unlink(id: string) {
    this.api.unlinkTelegram(id).subscribe(() => this.load());
  }

  private flash(msg: string) {
    this.notice.set(msg);
    setTimeout(() => this.notice.set(null), 6000);
  }
}
