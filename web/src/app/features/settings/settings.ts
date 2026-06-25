import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { NotificationSettingsDto } from '../../core/models';

type Tab = 'email' | 'telegram' | 'webhook';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ lang.t('settings.title') }}</h1>
    <p class="muted">{{ lang.t('settings.subtitle') }}</p>

    @if (notice()) { <div class="notice">{{ notice() }}</div> }

    <div class="card">
      <div class="row top">
        <div><label>{{ lang.t('notify.on') }}</label>
          <select [(ngModel)]="notifyOn" (ngModelChange)="saveMode()">
            <option value="failure">{{ lang.t('notify.failure') }}</option>
            <option value="always">{{ lang.t('notify.always') }}</option>
            <option value="never">{{ lang.t('notify.never') }}</option>
          </select>
        </div>
        <div class="spacer"></div>
        <button class="ghost" (click)="sendTest()" [disabled]="busy()">{{ lang.t('btn.sendTest') }}</button>
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
              <div class="span2"><label>From</label><input [(ngModel)]="smtpFrom" /></div>
            </div>

            <div class="list">
              <div class="lhead"><h4>Recipients</h4><div class="spacer"></div>
                <input class="addbox" [(ngModel)]="newEmail" placeholder="name@example.com" (keyup.enter)="addEmail()" />
                <button class="ghost sm" (click)="addEmail()">{{ lang.t('btn.add') }}</button>
              </div>
              @if (recipients().length) {
                @for (r of recipients(); track r) {
                  <div class="lrow"><span>{{ r }}</span><div class="spacer"></div><button class="ghost sm danger" (click)="removeEmail(r)">{{ lang.t('btn.delete') }}</button></div>
                }
              } @else { <p class="muted">No recipients yet.</p> }
            </div>

            <button (click)="saveEmail()" [disabled]="busy()">{{ lang.t('btn.save') }}</button>
            <p class="hint">Tip: Gmail needs an <b>app password</b> with host <code>smtp.gmail.com</code> port <code>587</code>.</p>
          }
          @case ('telegram') {
            <label>Bot token {{ s.telegramBotSet ? '(set — blank keeps it)' : '(from @BotFather)' }}</label>
            <div class="row inline">
              <input type="password" [(ngModel)]="telegramToken" placeholder="123456:ABC-..." />
              <button (click)="connectTelegram()" [disabled]="busy()">{{ lang.t('btn.connect') }}</button>
            </div>
            <p class="hint">Save the token first (Connect). Then open your bot in Telegram and press <b>Start</b> — it replies with a 6-digit code.</p>

            <div class="list">
              <div class="lhead"><h4>Linked chats</h4><div class="spacer"></div>
                <input class="addbox" [(ngModel)]="linkCode" placeholder="123456" />
                <button class="ghost sm" (click)="link()" [disabled]="busy()">{{ lang.t('btn.link') }}</button>
              </div>
              @if (s.chats.length) {
                @for (c of s.chats; track c.id) {
                  <div class="lrow"><span>{{ c.label || '—' }}</span><span class="muted id">{{ c.chatId }}</span><div class="spacer"></div>
                    <button class="ghost sm danger" (click)="unlink(c.id)">{{ lang.t('btn.delete') }}</button></div>
                }
              } @else { <p class="muted">No chats linked yet.</p> }
            </div>
          }
          @case ('webhook') {
            <label>Webhook URL</label>
            <div class="row inline">
              <input [(ngModel)]="webhookUrl" placeholder="https://hooks.example.com/…" />
              <button (click)="saveWebhook()" [disabled]="busy()">{{ lang.t('btn.save') }}</button>
            </div>
            <p class="hint">A JSON POST <code>{{ '{' }} level, title, message {{ '}' }}</code> is sent here on each notification.</p>
          }
        }
      }
    </div>
  `,
  styles: `
    .card { max-width: 760px; }
    .top { align-items: flex-end; gap: 10px; margin-bottom: 4px; }
    .top > div:first-child { min-width: 180px; }
    .tabs { display: flex; gap: 6px; margin: 18px 0; border-bottom: 1px solid var(--border); }
    .tab { background: transparent; color: var(--muted); border-radius: 8px 8px 0 0; text-transform: capitalize; padding: 9px 16px; }
    .tab.on { color: var(--text); border-bottom: 2px solid var(--primary); }
    .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .span2 { grid-column: 1 / -1; }
    label { margin-top: 8px; }
    .inline { gap: 10px; align-items: flex-end; margin-top: 4px; }
    .inline input { flex: 1; }
    .list { margin: 18px 0; border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
    .lhead { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .lhead h4 { margin: 0; }
    .addbox { max-width: 230px; }
    .lrow { display: flex; align-items: center; gap: 12px; padding: 8px 4px; border-top: 1px solid var(--border); }
    .lrow .id { font-size: 12px; }
    button.sm { padding: 5px 11px; font-size: 13px; }
    button.danger { color: var(--fail); border-color: var(--fail); }
    .hint { font-size: 12px; color: var(--muted); margin-top: 12px; }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }
    h4 { font-size: 13px; }
  `,
})
export class Settings {
  private api = inject(Api);
  lang = inject(Lang);

  tabs: Tab[] = ['email', 'telegram', 'webhook'];
  tab = signal<Tab>('email');
  n = signal<NotificationSettingsDto | null>(null);
  recipients = signal<string[]>([]);
  busy = signal(false);
  notice = signal<string | null>(null);

  notifyOn = 'failure';
  smtpHost = ''; smtpPort: number | null = 587; smtpUser = ''; smtpPass = ''; smtpFrom = '';
  webhookUrl = ''; telegramToken = ''; linkCode = ''; newEmail = '';

  constructor() { this.load(); }

  icon(t: Tab) { return ({ email: '✉️', telegram: '💬', webhook: '🔗' })[t]; }

  load() {
    this.api.notifications().subscribe(s => {
      this.n.set(s);
      this.notifyOn = s.notifyOn;
      this.smtpHost = s.smtpHost ?? ''; this.smtpPort = s.smtpPort ?? 587;
      this.smtpUser = s.smtpUser ?? ''; this.smtpFrom = s.smtpFrom ?? '';
      this.webhookUrl = s.webhookUrl ?? '';
      this.recipients.set((s.smtpTo ?? '').split(',').map(x => x.trim()).filter(Boolean));
    });
  }

  saveMode() { this.api.saveNotifyMode(this.notifyOn).subscribe(() => this.flash('Saved.')); }

  addEmail() {
    const e = this.newEmail.trim();
    if (e && !this.recipients().includes(e)) this.recipients.update(r => [...r, e]);
    this.newEmail = '';
  }
  removeEmail(e: string) { this.recipients.update(r => r.filter(x => x !== e)); }

  saveEmail() {
    this.busy.set(true);
    this.api.saveEmail({
      smtpHost: this.smtpHost || null, smtpPort: this.smtpPort, smtpUser: this.smtpUser || null,
      smtpPass: this.smtpPass || null, smtpFrom: this.smtpFrom || null,
      smtpTo: this.recipients().join(',') || null,
    }).subscribe({
      next: () => { this.busy.set(false); this.smtpPass = ''; this.flash('Email settings saved.'); this.load(); },
      error: () => { this.busy.set(false); this.flash('Failed to save.'); },
    });
  }

  connectTelegram() {
    this.busy.set(true);
    this.api.saveTelegramToken(this.telegramToken || null).subscribe({
      next: () => { this.busy.set(false); this.telegramToken = ''; this.flash('Bot connected. Now press Start in your bot to get a code.'); this.load(); },
      error: () => { this.busy.set(false); this.flash('Failed to connect.'); },
    });
  }

  saveWebhook() {
    this.busy.set(true);
    this.api.saveWebhook(this.webhookUrl || null).subscribe({
      next: () => { this.busy.set(false); this.flash('Webhook saved.'); this.load(); },
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
