import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { RunDto } from '../../core/models';
import { formatBytes, runTypeLabel, statusClass, statusLabel } from '../../core/format';

@Component({
  selector: 'app-history',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>History</h1><p class="muted">Every backup, upload, cleanup and drill</p></div>
      <div class="spacer"></div>
      <button class="ghost" (click)="load()">Refresh</button>
    </div>

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">No runs recorded yet.</p>
      } @else {
        <table>
          <thead><tr><th>Status</th><th>Type</th><th>Job</th><th>Size</th><th>Started</th><th>Message</th></tr></thead>
          <tbody>
            @for (r of items(); track r.id) {
              <tr>
                <td><span class="badge {{ statusClass(r.status) }}">{{ statusLabel(r.status) }}</span></td>
                <td>{{ runTypeLabel(r.type) }}</td>
                <td>{{ r.jobName }}</td>
                <td>{{ formatBytes(r.bytes) }}</td>
                <td class="muted">{{ r.startedAt | date: 'short' }}</td>
                <td class="muted msg">{{ r.message }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    h1 { margin: 0; }
    .msg { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class History {
  private api = inject(Api);
  items = signal<RunDto[]>([]);

  statusClass = statusClass;
  statusLabel = statusLabel;
  runTypeLabel = runTypeLabel;
  formatBytes = formatBytes;

  constructor() { this.load(); }

  load() { this.api.history(200).subscribe(r => this.items.set(r)); }
}
