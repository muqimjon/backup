import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="layout">
      <aside>
        <div class="brand">🗄️ BackupHub</div>
        <nav>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active">{{ item.icon }} {{ item.label }}</a>
          }
        </nav>
        <div class="spacer"></div>
        <div class="user">
          <div>{{ auth.user()?.username }}</div>
          <button class="ghost" (click)="auth.logout()">Sign out</button>
        </div>
      </aside>
      <main><router-outlet /></main>
    </div>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    aside { background: var(--surface); border-right: 1px solid var(--border); padding: 18px 14px; display: flex; flex-direction: column; }
    .brand { font-size: 18px; font-weight: 700; padding: 6px 10px 18px; }
    nav { display: flex; flex-direction: column; gap: 2px; }
    nav a { padding: 10px 12px; border-radius: 8px; color: var(--muted); }
    nav a:hover { background: var(--surface-2); color: var(--text); }
    nav a.active { background: var(--primary); color: #fff; }
    .user { display: flex; flex-direction: column; gap: 8px; font-size: 13px; padding: 10px; border-top: 1px solid var(--border); }
    main { padding: 28px 32px; overflow: auto; }
  `,
})
export class Shell {
  auth = inject(AuthService);

  nav = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/sources', label: 'Sources', icon: '🗃️' },
    { path: '/destinations', label: 'Destinations', icon: '☁️' },
    { path: '/jobs', label: 'Jobs', icon: '⚙️' },
    { path: '/history', label: 'History', icon: '🕓' },
    { path: '/agents', label: 'Agents', icon: '🖥️' },
  ];
}
