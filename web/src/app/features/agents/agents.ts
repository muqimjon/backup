import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { AgentDto, CommandKind } from '../../core/models';

@Component({
  selector: 'app-agents',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>Agents</h1><p class="muted">Worker containers reporting to this hub</p></div>
      <div class="spacer"></div>
      <button class="ghost" (click)="load()">Refresh</button>
    </div>

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">No agents registered yet. Start a <code>backuphub/agent</code> container pointed at this hub.</p>
      } @else {
        <table>
          <thead><tr><th>Name</th><th>Host</th><th>Project</th><th>Drivers</th><th>Version</th><th>Last seen</th><th></th></tr></thead>
          <tbody>
            @for (a of items(); track a.id) {
              <tr>
                <td>{{ a.name }}</td>
                <td class="muted">{{ a.hostname }}</td>
                <td>{{ a.project }}</td>
                <td class="muted">{{ a.drivers }}</td>
                <td class="muted">{{ a.version }}</td>
                <td class="muted">{{ a.lastSeenAt ? (a.lastSeenAt | date: 'short') : 'never' }}</td>
                <td><button (click)="runNow(a)">Run now</button></td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `h1 { margin: 0; } button { padding: 6px 12px; }`,
})
export class Agents {
  private api = inject(Api);
  items = signal<AgentDto[]>([]);

  constructor() { this.load(); }

  load() { this.api.agents().subscribe(a => this.items.set(a)); }

  runNow(agent: AgentDto) {
    this.api.enqueue(agent.id, CommandKind.RunBackup).subscribe();
  }
}
