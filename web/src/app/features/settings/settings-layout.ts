import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Lang } from '../../core/lang';

@Component({
  selector: 'app-settings-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('settings.hub.title') }}</h1><p class="muted">{{ lang.t('settings.hub.subtitle') }}</p></div>
    </div>

    <nav class="tabs">
      <a routerLink="destinations" routerLinkActive="active">☁️ {{ lang.t('settings.tab.destinations') }}</a>
      <a routerLink="agents" routerLinkActive="active">🖥️ {{ lang.t('settings.tab.agents') }}</a>
      <a routerLink="notifications" routerLinkActive="active">🔔 {{ lang.t('settings.tab.notifications') }}</a>
    </nav>

    <div class="tabbody"><router-outlet /></div>
  `,
  styles: `
    h1 { margin: 0; }
    .tabs { display: flex; gap: 4px; margin: 18px 0 4px; border-bottom: 1px solid var(--border); }
    .tabs a { padding: 10px 16px; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px; font-size: 14px; }
    .tabs a:hover { color: var(--text); }
    .tabs a.active { color: var(--text); border-bottom-color: var(--primary); }
    .tabbody { padding-top: 20px; }
  `,
})
export class SettingsLayout {
  lang = inject(Lang);
}
