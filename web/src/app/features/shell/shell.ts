import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Theme } from '../../core/theme';
import { Lang, Locale } from '../../core/lang';
import { Live } from '../../core/live';
import { Toast } from '../../core/toast';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <aside>
        <div class="brand">🗄️ Zaxira</div>
        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active">{{ item.icon }} {{ lang.t(item.key) }}</a>
          }
        </nav>
        <div class="spacer"></div>
        <div class="prefs">
          <select [ngModel]="lang.locale()" (ngModelChange)="lang.set($event)" [title]="lang.t('app.language')">
            <option value="en">🇬🇧 English</option>
            <option value="ru">🇷🇺 Русский</option>
            <option value="uz">🇺🇿 O‘zbekcha</option>
          </select>
          <button class="ghost theme" (click)="theme.toggle()" [title]="lang.t('app.theme')">
            {{ theme.mode() === 'dark' ? '🌙' : '☀️' }}
          </button>
        </div>
        <div class="user">
          <div>{{ auth.user()?.username }}</div>
          <button class="ghost" (click)="auth.logout()">{{ lang.t('app.signOut') }}</button>
        </div>
      </aside>
      <main><router-outlet /></main>
    </div>
    @if (toast.items().length) {
      <div class="toasts">
        @for (t of toast.items(); track t.id) {
          <div class="toast" [class.ok]="t.kind === 'ok'" [class.fail]="t.kind === 'fail'" [class.info]="t.kind === 'info'" (click)="toast.dismiss(t.id)">
            <span class="ic">{{ t.kind === 'ok' ? '✓' : t.kind === 'fail' ? '✗' : 'ℹ️' }}</span><span>{{ t.message }}</span>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 240px 1fr; height: 100vh; overflow: hidden; }
    aside { background: var(--surface); border-right: 1px solid var(--border); padding: 18px 14px;
            display: flex; flex-direction: column; height: 100vh; overflow-y: auto; }
    .brand { font-size: 18px; font-weight: 700; padding: 6px 10px 18px; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a { padding: 10px 12px; border-radius: 8px; color: var(--muted); }
    nav a:hover { background: var(--surface-2); color: var(--text); }
    nav a.active { background: var(--primary); color: #fff; }
    .prefs { display: flex; gap: 8px; margin-bottom: 10px; }
    .prefs select { flex: 1; }
    .theme { padding: 8px 12px; }
    .user { display: flex; flex-direction: column; gap: 8px; font-size: 13px; padding: 10px; border-top: 1px solid var(--border); }
    main { padding: 28px 32px; overflow-y: auto; height: 100vh; }
    .toasts { position: fixed; bottom: 22px; right: 22px; display: flex; flex-direction: column; gap: 10px; z-index: 50; }
    .toast { max-width: 460px; display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px;
             border-radius: 10px; font-size: 14px; box-shadow: 0 8px 28px rgba(0,0,0,.35);
             animation: pop .18s ease; z-index: 50; cursor: pointer; }
    .toast .ic { font-weight: 700; }
    .toast.ok { background: rgba(47,191,113,.16); color: var(--ok); border: 1px solid rgba(47,191,113,.4); }
    .toast.fail { background: rgba(226,85,78,.16); color: var(--fail); border: 1px solid rgba(226,85,78,.4); }
    .toast.info { background: rgba(96,125,224,.18); color: var(--text); border: 1px solid rgba(96,125,224,.4); }
    @keyframes pop { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
  `,
})
export class Shell {
  auth = inject(AuthService);
  theme = inject(Theme);
  lang = inject(Lang);
  toast = inject(Toast);
  private live = inject(Live);

  constructor() {
    this.live.start();
    // Test / drill results arrive over SignalR → push them onto the toast stack.
    effect(() => {
      const t = this.live.lastTest();
      if (!t) return;
      this.toast.show(t.message || (t.ok ? 'OK' : 'Failed'), t.ok ? 'ok' : 'fail', 7000);
    });
  }

  nav = [
    { path: '/dashboard', key: 'nav.dashboard', icon: '📊' },
    { path: '/projects', key: 'nav.projects', icon: '📁' },
    { path: '/jobs', key: 'nav.jobs', icon: '⚙️' },
    { path: '/history', key: 'nav.history', icon: '🕓' },
    { path: '/settings', key: 'nav.settings', icon: '🛠️' },
  ];
}
