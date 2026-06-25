import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { NotificationSettingsDto } from '../../core/models';

type Tab = 'email' | 'telegram' | 'webhook';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Notifications</h1>
    <p class="muted">Use <b>your own</b> SMTP and <b>your own</b> Telegram bot — nothing is shared, secrets are encrypted.</p>

    @if (notice()) { <div class="notice">{{ notice() }}</div> }

    <div class="card">
      <div class="row top">
        <div><label>Notify on</label>
          <select [(ngModel)]="notifyOn">
            <option value="failure">Failures only</option>
            <option value="always">Every run</option>
            <option value="never">Never</option>
          </select>
        </div>
        <div class="spacer"></div>
        <button class="ghost" (click)="sendTest()" [disabled]="busy()">Send test</button>
        <button (click)="save()" [disabled]="busy()">Save</button>
      </div>

      <div class="tabs">
        @for (t of tabs; track t) {
          <button class="tab" [class.on]="tab() === t" (click)="tab.set(t)">{{ icon(t) }} {{ t }}</button>
        }
      </div>

      @if (n(); as s) {
        @switch (tab()) {
          @case ('email') {
            <div class="g2">
              <div><label>SMTP host</label><input [(ngModel)]="smtpHost" placeholder="smtp.gmail.com" /></div>
              <div><label>Port</label><input type="number" [(ngModel)]="smtpPort" placeholder="587" /></div>
              <div><label>Username</label><input [(ngModel)]="smtpUser" /></div>
              <div><label>Password {{ s.smtpPassSet ? '(set — blank keeps it)' : '' }}</label><input type="password" [(ngModel)]="smtpPass" /></div>
              <div><label>From</label><input [(ngModel)]="smtpFrom" /></div>
              <div><label>To — several allowed, comma-separated</label><input [(ngModel)]="smtpTo" placeholder="a@x.com, b@y.com" /></div>
            </div>
            <p class="hint">Tip: Gmail needs an <b>app password</b> (not your normal password) with host <code>smtp.gmail.com</code> port <code>587</code>.</p>
          }
          @case ('telegram') {
            <label>Bot token {{ s.telegramBotSet ? '(set — blank keeps it)' : '(from @BotFather)' }}</label>
            <input type="password" [(ngModel)]="telegramToken" placeholder="123456:ABC-..." />
            <div class="link">
              <h4>Linked chats — add as many as you like</h4>
              <p class="muted">In Telegram, open your bot and press <b>Start</b>. It replies with a 6-digit code — enter it here.</p>
              <div class="row">
                <input class="code" [(ngModel)]="linkCode" placeholder="123456" />
                <button class="ghost" (click)="link()" [disabled]="busy()">Link chat</button>
              </div>
              @if (s.chats.length) {
                <table>
                  <thead><tr><th>Chat</th><th>ID</th><th></th></tr></thead>
                  <tbody>
                    @for (c of s.chats; track c.id) {
                      <tr><td>{{ c.label || '—' }}</td><td class="muted">{{ c.chatId }}</td>
                        <td class="right"><button class="ghost sm" (click)="unlink(c.id)">Remove</button></td></tr>
                    }
                  </tbody>
                </table>
              } @else { <p class="muted">No chats linked yet.</p> }
            </div>
          }
          @case ('webhook') {
            <label>Webhook URL</label><input [(ngModel)]="webhookUrl" placeholder="https://hooks.example.com/…" />
            <p class="hint">A JSON POST <code>{{ '{' }} level, title, message {{ '}' }}</code> is sent to this URL on each notification.</p>
          }
        }
      }
    </div>
  `,
  styles: `
    .card { max-width: 760px; }
    .top { align-items: flex-end; gap: 10px; margin-bottom: 4px; }
    .top > div:first-child { min-width: 180px; }
    .tabs { display: flex; gap: 6px; margin: 18px 0 18px; border-bottom: 1px solid var(--border); }
    .tab { background: transparent; color: var(--muted); border-radius: 8px 8px 0 0; text-transform: capitalize; padding: 9px 16px; }
    .tab.on { color: var(--text); border-bottom: 2px solid var(--primary); }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { margin-top: 8px; }
    h4 { margin: 20px 0 6px; }
    .code { max-width: 160px; }
    .right { text-align: right; }
    button.sm { padding: 4px 10px; }
    .hint { font-size: 12px; color: var(--muted); margin-top: 10px; }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }
  `,
})
export class Settings {
  private api = inject(Api);

  tabs: Tab[] = ['email', 'telegram', 'webhook'];
  tab = signal<Tab>('email');
  n = signal<NotificationSettingsDto | null>(null);
  busy = signal(false);
  notice = signal<string | null>(null);

  notifyOn = 'failure';
  smtpHost = ''; smtpPort: number | null = 587; smtpUser = ''; smtpPass = ''; smtpFrom = ''; smtpTo = '';
  webhookUrl = ''; telegramToken = ''; linkCode = '';

  constructor() { this.load(); }

  icon(t: Tab) { return ({ email: '✉️', telegram: '💬', webhook: '🔗' })[t]; }

  load() {
    this.api.notifications().subscribe(s => {
      this.n.set(s);
      this.notifyOn = s.notifyOn;
      this.smtpHost = s.smtpHost ?? ''; this.smtpPort = s.smtpPort ?? 587;
      this.smtpUser = s.smtpUser ?? ''; this.smtpFrom = s.smtpFrom ?? ''; this.smtpTo = s.smtpTo ?? '';
      this.webhookUrl = s.webhookUrl ?? '';
    });
  }

  save() {
    this.busy.set(true);
    this.api.updateNotifications({
      notifyOn: this.notifyOn,
      smtpHost: this.smtpHost || null, smtpPort: this.smtpPort, smtpUser: this.smtpUser || null,
      smtpPass: this.smtpPass || null, smtpFrom: this.smtpFrom || null, smtpTo: this.smtpTo || null,
      webhookUrl: this.webhookUrl || null, telegramBotToken: this.telegramToken || null,
    }).subscribe({
      next: () => { this.busy.set(false); this.smtpPass = ''; this.telegramToken = ''; this.flash('Notifications saved.'); this.load(); },
      error: () => { this.busy.set(false); this.flash('Failed to save.'); },
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

  unlink(id: string) { this.api.unlinkTelegram(id).subscribe(() => this.load()); }

  private flash(msg: string) { this.notice.set(msg); setTimeout(() => this.notice.set(null), 6000); }
}
