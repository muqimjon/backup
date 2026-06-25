import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { AgentDto } from '../../core/models';

@Component({
  selector: 'app-agents',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('agents.title') }}</h1><p class="muted">{{ lang.t('agents.subtitle') }}</p></div>
      <div class="spacer"></div>
      <button class="ghost" (click)="load()">{{ lang.t('btn.refresh') }}</button>
    </div>

    @if (notice()) { <div class="notice">{{ notice() }}</div> }

    <div class="card info">
      <h3>{{ lang.t('a.what') }}</h3>
      <p>{{ lang.t('a.explain') }}</p>
      <p class="muted"><b>{{ lang.t('a.addTitle') }}</b></p>
      <pre>{{ cmd() }}</pre>
      <div class="tok">
        <div class="muted">🔑 {{ lang.t('a.tokenNote') }}</div>
        <div class="trow">
          <code>{{ revealed() ? token() : masked() }}</code>
          <button class="ghost sm" (click)="revealed.set(!revealed())">{{ revealed() ? '🙈' : '👁' }}</button>
          <button class="ghost sm" (click)="copyToken()">📋 {{ copied() ? '✓' : 'Copy' }}</button>
        </div>
      </div>
    </div>

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">{{ lang.t('empty.agents') }}</p>
      } @else {
        <table>
          <thead><tr><th>{{ lang.t('f.name') }}</th><th>{{ lang.t('f.host') }}</th><th>{{ lang.t('f.project') }}</th><th>{{ lang.t('f.version') }}</th><th>{{ lang.t('f.lastSeen') }}</th><th></th></tr></thead>
          <tbody>
            @for (a of items(); track a.id) {
              <tr [class.dim]="!a.enabled">
                <td>{{ a.name }} <span class="dot" [class.live]="isLive(a)"></span>
                  @if (!a.enabled) { <span class="off">{{ lang.t('a.disabled') }}</span> }</td>
                <td class="muted">{{ a.hostname }}</td>
                <td>{{ a.project }}</td>
                <td class="muted">{{ a.version }}</td>
                <td class="muted">{{ a.lastSeenAt ? (a.lastSeenAt | date: 'short') : 'never' }}</td>
                <td class="right acts">
                  <button class="ghost sm" (click)="toggle(a)">{{ a.enabled ? lang.t('a.disable') : lang.t('a.enable') }}</button>
                  <button class="ghost sm danger" (click)="remove(a)">{{ lang.t('btn.remove') }}</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    h1 { margin: 0; }
    h3 { margin-bottom: 8px; }
    .info { margin-bottom: 16px; }
    .info p { margin: 0 0 8px; line-height: 1.55; }
    .info pre { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
                padding: 12px 14px; font-size: 12px; overflow-x: auto; margin: 4px 0 12px; }
    .tok { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; }
    .trow { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .trow code { font-size: 13px; flex: 1; word-break: break-all; }
    .tok .sm { padding: 4px 9px; font-size: 13px; }
    .right { text-align: right; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); margin-left: 4px; }
    .dot.live { background: var(--ok); }
    .off { font-size: 11px; color: var(--warn); background: rgba(224,169,59,.15); padding: 2px 8px; border-radius: 20px; margin-left: 6px; }
    tr.dim td { opacity: .55; }
    .acts { display: flex; gap: 6px; justify-content: flex-end; }
    .acts .sm { padding: 4px 10px; font-size: 13px; }
    button.danger { color: var(--fail); border-color: var(--fail); }
    button.danger:hover { background: rgba(226,85,78,.12); }
    .notice { margin: 14px 0; padding: 10px 14px; border-radius: 8px; background: rgba(47,191,113,.12); color: var(--ok); }
  `,
})
export class Agents {
  private api = inject(Api);
  lang = inject(Lang);
  items = signal<AgentDto[]>([]);
  notice = signal<string | null>(null);
  token = signal('');
  revealed = signal(false);
  copied = signal(false);
  private hubUrl = location.origin;

  constructor() { this.load(); this.api.hubToken().subscribe(r => this.token.set(r.token)); }

  load() { this.api.agents().subscribe(a => this.items.set(a)); }

  cmd() {
    return `docker run -d --restart=always \\
  -e HUB_URL=${this.hubUrl} \\
  -e HUB_TOKEN=<paste-token-below> \\
  -e AGENT_NAME=server-2 \\
  --add-host host.docker.internal:host-gateway \\
  -v bh_agent:/backup \\
  muqimjon/backuphub-agent`;
  }

  masked() {
    const t = this.token();
    if (t.length <= 14) return t ? '••••••' : '';
    return t.slice(0, 6) + ' •••••••••• ' + t.slice(-4);
  }

  copyToken() {
    navigator.clipboard?.writeText(this.token()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  toggle(a: AgentDto) {
    this.api.setAgentEnabled(a.id, !a.enabled).subscribe({
      next: () => { this.flash(a.enabled ? `"${a.name}" paused.` : `"${a.name}" enabled.`); this.load(); },
      error: () => this.flash('Failed.'),
    });
  }

  isLive(a: AgentDto) {
    if (!a.lastSeenAt) return false;
    return Date.now() - new Date(a.lastSeenAt).getTime() < 90_000;
  }

  remove(a: AgentDto) {
    if (!confirm(`Remove agent "${a.name}"? Stop its container too, or it will re-register.`)) return;
    this.api.deleteAgent(a.id).subscribe({
      next: () => { this.flash(`Agent "${a.name}" removed. Jobs using it are now unassigned.`); this.load(); },
      error: () => this.flash('Failed to remove agent.'),
    });
  }

  private flash(msg: string) { this.notice.set(msg); setTimeout(() => this.notice.set(null), 6000); }
}
