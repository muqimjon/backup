import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Api } from '../../core/api';
import { Lang } from '../../core/lang';
import { RunDto } from '../../core/models';
import { formatBytes, runTypeLabel, statusClass, statusLabel } from '../../core/format';

@Component({
  selector: 'app-history',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <div><h1>{{ lang.t('history.title') }}</h1><p class="muted">{{ lang.t('history.subtitle') }}</p></div>
      <div class="spacer"></div>
      <button class="ghost" (click)="reload()">{{ lang.t('btn.refresh') }}</button>
    </div>

    <div class="card">
      @if (items().length === 0) {
        <p class="muted">{{ lang.t('empty.history') }}</p>
      } @else {
        <table>
          <thead><tr><th>{{ lang.t('f.status') }}</th><th>{{ lang.t('f.type') }}</th><th>{{ lang.t('f.job') }}</th><th>{{ lang.t('f.size') }}</th><th>{{ lang.t('f.started') }}</th><th>{{ lang.t('f.message') }}</th></tr></thead>
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
        @if (hasMore()) {
          <div class="more"><button class="ghost" (click)="loadMore()" [disabled]="loading()">{{ loading() ? '…' : lang.t('loadMore') }}</button></div>
        }
      }
    </div>
  `,
  styles: `
    h1 { margin: 0; }
    .msg { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .more { display: flex; justify-content: center; padding-top: 14px; }
  `,
})
export class History {
  private api = inject(Api);
  lang = inject(Lang);

  private readonly pageSize = 25;
  items = signal<RunDto[]>([]);
  loading = signal(false);
  hasMore = signal(false);

  statusClass = statusClass;
  statusLabel = statusLabel;
  runTypeLabel = runTypeLabel;
  formatBytes = formatBytes;

  constructor() { this.reload(); }

  reload() {
    this.items.set([]);
    this.hasMore.set(false);
    this.fetch(0);
  }

  loadMore() { this.fetch(this.items().length); }

  private fetch(skip: number) {
    this.loading.set(true);
    this.api.history(this.pageSize, skip).subscribe(rows => {
      this.items.update(cur => skip === 0 ? rows : [...cur, ...rows]);
      this.hasMore.set(rows.length === this.pageSize);
      this.loading.set(false);
    });
  }
}
