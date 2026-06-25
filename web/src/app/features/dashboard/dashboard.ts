import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { Live } from '../../core/live';
import { RunDto, RunStatus, StatsDto } from '../../core/models';
import { formatBytes, runTypeLabel, statusClass, statusLabel } from '../../core/format';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <div>
        <h1>{{ lang.t('dash.title') }}</h1>
        <p class="muted">{{ lang.t('dash.subtitle') }}</p>
      </div>
      <span class="live" [class.on]="live.connected()">
        {{ live.connected() ? 'live' : 'offline' }}
      </span>
    </div>

    <div class="stats">
      <div class="card stat"><div class="n">{{ stats()?.agents ?? 0 }}</div><div class="muted">Agents</div></div>
      <div class="card stat"><div class="n">{{ stats()?.jobs ?? 0 }}</div><div class="muted">Jobs</div></div>
      <div class="card stat"><div class="n ok">{{ stats()?.ok24h ?? 0 }}</div><div class="muted">OK · 24h</div></div>
      <div class="card stat"><div class="n fail">{{ stats()?.fail24h ?? 0 }}</div><div class="muted">Failed · 24h</div></div>
    </div>

    <div class="stats">
      <div class="card stat">
        <div class="label">Last backup size</div>
        <div class="big">{{ formatBytes(stats()?.lastBackupBytes ?? 0) }}</div>
      </div>
      <div class="card stat">
        <div class="label">Last success</div>
        <div class="big">{{ stats()?.lastSuccessAt ? (stats()!.lastSuccessAt | date: 'short') : '—' }}</div>
      </div>
      <div class="card stat drill">
        <div class="label">Restore verified</div>
        @if (stats()?.lastDrillAt) {
          <div class="big" [class.ok]="drillOk()" [class.fail]="!drillOk()">
            {{ drillOk() ? '✓ passed' : '✗ failed' }}
          </div>
          <div class="muted">{{ stats()!.lastDrillAt | date: 'short' }}</div>
        } @else {
          <div class="big muted">not run yet</div>
        }
      </div>
    </div>

    <div class="card">
      <h3>{{ lang.t('recentRuns') }}</h3>
      @if (runs().length === 0) {
        <p class="muted">No runs yet. Once an agent runs a backup it will appear here.</p>
      } @else {
        <table>
          <thead><tr><th>Status</th><th>Type</th><th>Job</th><th>Size</th><th>Started</th></tr></thead>
          <tbody>
            @for (r of runs(); track r.id) {
              <tr>
                <td><span class="badge {{ statusClass(r.status) }}">{{ statusLabel(r.status) }}</span></td>
                <td>{{ runTypeLabel(r.type) }}</td>
                <td>{{ r.jobName }}</td>
                <td>{{ formatBytes(r.bytes) }}</td>
                <td class="muted">{{ r.startedAt | date: 'short' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: `
    .head { display: flex; align-items: flex-start; justify-content: space-between; }
    .live { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; padding: 4px 10px;
            border-radius: 20px; background: var(--surface-2, #eee); color: var(--muted); }
    .live.on { background: rgba(34,197,94,.15); color: var(--ok); }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .stats:has(.drill) { grid-template-columns: repeat(3, 1fr); }
    .stat .n { font-size: 30px; font-weight: 700; }
    .stat .n.ok { color: var(--ok); }
    .stat .n.fail { color: var(--fail); }
    .stat .label { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
    .stat .big { font-size: 20px; font-weight: 600; }
    .stat .big.ok { color: var(--ok); }
    .stat .big.fail { color: var(--fail); }
    h3 { margin-bottom: 14px; }
  `,
})
export class Dashboard implements OnInit, OnDestroy {
  private api = inject(Api);
  protected live = inject(Live);
  lang = inject(Lang);

  stats = signal<StatsDto | null>(null);
  runs = signal<RunDto[]>([]);

  statusClass = statusClass;
  statusLabel = statusLabel;
  runTypeLabel = runTypeLabel;
  formatBytes = formatBytes;

  drillOk = () => this.stats()?.lastDrillStatus === RunStatus.Ok;

  constructor() {
    effect(() => {
      if (this.live.last()) this.refresh();
    });
  }

  ngOnInit() {
    this.live.start();
    this.refresh();
  }

  ngOnDestroy() {
    this.live.stop();
  }

  private refresh() {
    this.api.stats().subscribe(s => this.stats.set(s));
    this.api.history(8).subscribe(r => this.runs.set(r));
  }
}
