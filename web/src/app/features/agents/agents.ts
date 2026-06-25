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
      <h3>What is an agent?</h3>
      <p>An agent is a small <b>worker container</b> (bash + pg_dump/mysqldump/rclone) — <b>not AI</b>. You run one
        per server. It asks this hub “what should I back up?”, runs the jobs, and reports results back. That’s how
        you manage everything from the web without ever SSHing into the server.</p>
      <p class="muted"><b>Add an agent:</b> run the <code>muqimjon/backuphub-agent</code> container on a server,
        pointed at this hub (<code>HUB_URL</code> + <code>HUB_TOKEN</code>) — it registers itself and appears below.
        <b>Remove:</b> delete it here and stop that container.</p>
    </div>

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">No agents registered yet.</p>
      } @else {
        <table>
          <thead><tr><th>Name</th><th>Host</th><th>Project</th><th>Version</th><th>Last seen</th><th></th></tr></thead>
          <tbody>
            @for (a of items(); track a.id) {
              <tr>
                <td>{{ a.name }} <span class="dot" [class.live]="isLive(a)"></span></td>
                <td class="muted">{{ a.hostname }}</td>
                <td>{{ a.project }}</td>
                <td class="muted">{{ a.version }}</td>
                <td class="muted">{{ a.lastSeenAt ? (a.lastSeenAt | date: 'short') : 'never' }}</td>
                <td class="right"><button class="ghost danger" (click)="remove(a)">{{ lang.t('btn.remove') }}</button></td>
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
    .right { text-align: right; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); margin-left: 4px; }
    .dot.live { background: var(--ok); }
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

  constructor() { this.load(); }

  load() { this.api.agents().subscribe(a => this.items.set(a)); }

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
