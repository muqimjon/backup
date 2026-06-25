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
              <div><label>{{ lang.t('f.port') }}</label><input type="number" [(ngModel)]="smtpPort" placeholder="587" /></div>
              <div><label>{{ lang.t('f.username') }}</label><input [(ngModel)]="smtpUser" /></div>
              <div><label>{{ lang.t('f.password') }} {{ s.smtpPassSet ? '••' : '' }}</label><input type="password" [(ngModel)]="smtpPass" /></div>
              <div class="span2"><label>{{ lang.t('s.from') }}</label><input [(ngModel)]="smtpFrom" /></div>
            </div>
            <button (click)="saveEmail()" [disabled]="busy()">{{ lang.t('btn.save') }}</button>
            <p class="hint">{{ lang.t('s.gmailTip') }}</p>

            <div class="list">
              <div class="lhead"><h4>{{ lang.t('s.recipients') }}</h4><div class="spacer"></div></div>
              <div class="addgrid">
                <input [(ngModel)]="newEmail" placeholder="name@example.com" />
                <input [(ngModel)]="newName" [placeholder]="lang.t('f.name')" />
                <select [(ngModel)]="newLang">
                  <option value="">{{ langLabel('') }}</option>
                  <option value="en">English</option><option value="ru">Русский</option><option value="uz">O‘zbekcha</option>
                </select>
                <button class="ghost sm" (click)="addRecipient()">{{ lang.t('btn.add') }}</button>
              </div>
              @if (s.recipients.length) {
                @for (r of s.recipients; track r.id) {
                  <div class="lrow">
                    <span class="who">{{ r.name || '—' }} <span class="muted">{{ r.email }}</span></span>
                    <div class="spacer"></div>
                    <select [ngModel]="r.lang || ''" (ngModelChange)="setRecipientLang(r, $event)" class="langsel">
                      <option value="">{{ langLabel('') }}</option>
                      <option value="en">EN</option><option value="ru">RU</option><option value="uz">UZ</option>
                    </select>
                    <button class="ghost sm danger" (click)="removeRecipient(r.id)">{{ lang.t('btn.delete') }}</button>
                  </div>
                }
              } @else { <p class="muted">{{ lang.t('s.noRecipients') }}</p> }
            </div>
          }
          @case ('telegram') {
            <label>Bot token {{ s.telegramBotSet ? '••' : '(@BotFather)' }}</label>
            <div class="row inline">
              <input type="password" [(ngModel)]="telegramToken" placeholder="123456:ABC-..." />
              <button (click)="connectTelegram()" [disabled]="busy()">{{ lang.t('btn.connect') }}</button>
            </div>
            <p class="hint">{{ lang.t('s.tokenHint') }}</p>

            <div class="list">
              <div class="lhead"><h4>{{ lang.t('s.linked') }}</h4><div class="spacer"></div>
                <input class="addbox" [(ngModel)]="linkCode" placeholder="123456" />
                <button class="ghost sm" (click)="link()" [disabled]="busy()">{{ lang.t('btn.link') }}</button>
              </div>
              <p class="hint">{{ lang.t('s.linkHint') }}</p>
              @if (s.chats.length) {
                @for (c of s.chats; track c.id) {
                  <div class="lrow">
                    <span class="who">{{ c.label || '—' }} <span class="muted">{{ c.chatId }}</span></span>
                    <div class="spacer"></div>
                    <select [ngModel]="c.lang || ''" (ngModelChange)="setChatLang(c.id, $event)" class="langsel">
                      <option value="">{{ langLabel('') }}</option>
                      <option value="en">EN</option><option value="ru">RU</option><option value="uz">UZ</option>
                    </select>
                    <button class="ghost sm danger" (click)="unlink(c.id)">{{ lang.t('btn.delete') }}</button>
                  </div>
                }
              } @else { <p class="muted">{{ lang.t('s.noChats') }}</p> }
            </div>
          }
          @case ('webhook') {
            <label>Webhook URL</label>
            <div class="row inline">
              <input [(ngModel)]="webhookUrl" placeholder="https://hooks.example.com/…" />
              <button (click)="saveWebhook()" [disabled]="busy()">{{ lang.t('btn.save') }}</button>
            </div>
            <p class="hint">{{ lang.t('s.webhookHint') }}</p>
          }
        }
      }
    </div>
  `,
  styles: `
    .card { max-width: 780px; }
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
    .list { margin: 18px 0 4px; border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
    .lhead { display: flex; align-items: center; gap: 8px; }
    .lhead h4 { margin: 0; }
    .addbox { max-width: 150px; }
    .addgrid { display: grid; grid-template-columns: 1.6fr 1.2fr 1fr auto; gap: 8px; margin: 10px 0; }
    .lrow { display: flex; align-items: center; gap: 10px; padding: 9px 4px; border-top: 1px solid var(--border); }
    .who { font-size: 14px; } .who .muted { font-size: 12px; }
    .langsel { width: auto; min-width: 92px; }
    button.sm { padding: 5px 11px; font-size: 13px; }
    button.danger { color: var(--fail); border-color: var(--fail); }
    .hint { font-size: 12px; color: var(--muted); margin-top: 10px; }
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
  busy = signal(false);
  notice = signal<string | null>(null);

  notifyOn = 'failure';
  smtpHost = ''; smtpPort: number | null = 587; smtpUser = ''; smtpPass = ''; smtpFrom = '';
  webhookUrl = ''; telegramToken = ''; linkCode = '';
  newEmail = ''; newName = ''; newLang = '';

  constructor() { this.load(); }

  icon(t: Tab) { return ({ email: '✉️', telegram: '💬', webhook: '🔗' })[t]; }
  langLabel(v: string) { return v ? v : (this.lang.locale() === 'ru' ? 'По умолч.' : this.lang.locale() === 'uz' ? 'Asosiy' : 'Default'); }

  load() {
    this.api.notifications().subscribe(s => {
      this.n.set(s);
      this.notifyOn = s.notifyOn;
      this.smtpHost = s.smtpHost ?? ''; this.smtpPort = s.smtpPort ?? 587;
      this.smtpUser = s.smtpUser ?? ''; this.smtpFrom = s.smtpFrom ?? '';
      this.webhookUrl = s.webhookUrl ?? '';
    });
  }

  saveMode() { this.api.saveNotifyMode(this.notifyOn).subscribe(() => this.flash('Saved.')); }

  saveEmail() {
    this.busy.set(true);
    this.api.saveEmail({
      smtpHost: this.smtpHost || null, smtpPort: this.smtpPort, smtpUser: this.smtpUser || null,
      smtpPass: this.smtpPass || null, smtpFrom: this.smtpFrom || null,
    }).subscribe({
      next: () => { this.busy.set(false); this.smtpPass = ''; this.flash('Saved.'); this.load(); },
      error: () => { this.busy.set(false); this.flash('Failed to save.'); },
    });
  }

  addRecipient() {
    const e = this.newEmail.trim();
    if (!e) return;
    this.api.addRecipient(e, this.newName.trim() || null, this.newLang || null).subscribe(() => {
      this.newEmail = ''; this.newName = ''; this.newLang = ''; this.load();
    });
  }
  setRecipientLang(r: { email: string; name: string | null }, lang: string) {
    this.api.addRecipient(r.email, r.name, lang || null).subscribe(() => this.load());
  }
  removeRecipient(id: string) { this.api.removeRecipient(id).subscribe(() => this.load()); }

  connectTelegram() {
    this.busy.set(true);
    this.api.saveTelegramToken(this.telegramToken || null).subscribe({
      next: () => { this.busy.set(false); this.telegramToken = ''; this.flash('Bot connected. Press Start in your bot for a code.'); this.load(); },
      error: e => { this.busy.set(false); this.flash(e?.error?.error ?? 'Failed to connect.'); },
    });
  }
  setChatLang(id: string, lang: string) { this.api.setChatLang(id, lang || null).subscribe(() => this.load()); }
  link() {
    if (!this.linkCode) return;
    this.api.linkTelegram(this.linkCode).subscribe({
      next: ok => { this.flash(ok ? 'Linked.' : 'Invalid or expired code.'); this.linkCode = ''; this.load(); },
      error: () => this.flash('Linking failed.'),
    });
  }
  unlink(id: string) { this.api.unlinkTelegram(id).subscribe(() => this.load()); }

  saveWebhook() {
    this.busy.set(true);
    this.api.saveWebhook(this.webhookUrl || null).subscribe({
      next: () => { this.busy.set(false); this.flash('Saved.'); this.load(); },
      error: () => { this.busy.set(false); this.flash('Failed.'); },
    });
  }

  sendTest() {
    this.busy.set(true);
    this.api.testNotification().subscribe({
      next: r => { this.busy.set(false); this.flash(r); },
      error: () => { this.busy.set(false); this.flash('Test failed.'); },
    });
  }

  private flash(msg: string) { this.notice.set(msg); setTimeout(() => this.notice.set(null), 6000); }
}
