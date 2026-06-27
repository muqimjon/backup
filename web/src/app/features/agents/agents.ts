import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { AgentDto, CommandKind } from '../../core/models';

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
      <div class="cmdbox">
        <div class="cmdhead">
          <span class="muted">🔑 {{ lang.t('a.tokenNote') }}</span>
          <span class="spacer"></span>
          <button class="ghost sm" (click)="revealed.set(!revealed())">{{ revealed() ? '🙈' : '👁' }}</button>
          <button class="ghost sm" (click)="copyCmd()">📋 {{ copied() ? '✓' : 'Copy' }}</button>
        </div>
        <pre>{{ cmd(revealed() ? token() : masked()) }}</pre>
      </div>
      <p class="muted">{{ lang.t('a.discoverNote') }}</p>
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
                  <button class="ghost sm" (click)="discover(a)">{{ lang.t('a.discover') }}</button>
                  <button class="ghost sm" (click)="reset(a)">{{ lang.t('a.reset') }}</button>
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
    .cmdbox { background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
              margin: 4px 0 12px; overflow: hidden; }
    .cmdhead { display: flex; align-items: center; gap: 6px; padding: 8px 10px 8px 14px;
               border-bottom: 1px solid var(--border); }
    .cmdhead .spacer { flex: 1; }
    .cmdhead .sm { padding: 4px 9px; font-size: 13px; }
    .info .cmdbox pre { background: none; border: 0; border-radius: 0;
                        padding: 12px 14px; font-size: 12px; overflow-x: auto; margin: 0; }
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

  cmd(tok: string) {
    return `docker run -d --restart=always \\
  -e HUB_URL=${this.hubUrl} \\
  -e HUB_TOKEN=${tok || '<your-hub-token>'} \\
  -e AGENT_NAME=server-2 \\
  --add-host host.docker.internal:host-gateway \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -v bh_agent:/backup \\
  muqimjon/zaxira`;
  }

  masked() {
    const t = this.token();
    if (t.length <= 14) return t ? '••••••' : '';
    return t.slice(0, 6) + '••••••••••' + t.slice(-4);
  }

  copyCmd() {
    navigator.clipboard?.writeText(this.cmd(this.token())).then(() => {
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

  discover(a: AgentDto) {
    this.api.enqueue(a.id, CommandKind.DiscoverSources).subscribe({
      next: () => this.flash(this.lang.t('a.discoverSent')),
      error: () => this.flash('Failed.'),
    });
  }

  reset(a: AgentDto) {
    if (!confirm(this.lang.t('a.resetConfirm').replace('{name}', a.name))) return;
    this.api.enqueue(a.id, CommandKind.ResetAgent).subscribe({
      next: () => this.flash(this.lang.t('a.resetSent')),
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
