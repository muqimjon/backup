import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Theme } from '../../core/theme';
import { Lang, Locale } from '../../core/lang';

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
  `,
})
export class Shell {
  auth = inject(AuthService);
  theme = inject(Theme);
  lang = inject(Lang);

  nav = [
    { path: '/dashboard', key: 'nav.dashboard', icon: '📊' },
    { path: '/sources', key: 'nav.sources', icon: '🗃️' },
    { path: '/destinations', key: 'nav.destinations', icon: '☁️' },
    { path: '/jobs', key: 'nav.jobs', icon: '⚙️' },
    { path: '/history', key: 'nav.history', icon: '🕓' },
    { path: '/agents', key: 'nav.agents', icon: '🖥️' },
    { path: '/settings', key: 'nav.settings', icon: '🔔' },
  ];
}
