import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="head">
          <h3>{{ title }}</h3>
          <button class="x" (click)="close.emit()" aria-label="Close">✕</button>
        </div>
        <div class="body"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed; inset: 0; z-index: 100;
      background: rgba(8, 12, 20, .45);
      backdrop-filter: blur(6px) saturate(120%);
      -webkit-backdrop-filter: blur(6px) saturate(120%);
      display: flex; align-items: center; justify-content: center;
      padding: 24px; animation: fade .12s ease;
    }
    .modal {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 16px; box-shadow: var(--shadow);
      width: 560px; max-width: 100%; max-height: 88vh; display: flex; flex-direction: column;
      animation: pop .14s ease;
    }
    .head { display: flex; align-items: center; justify-content: space-between;
            padding: 18px 22px; border-bottom: 1px solid var(--border); }
    .head h3 { margin: 0; }
    .x { background: transparent; color: var(--muted); padding: 4px 8px; font-size: 16px; }
    .x:hover { background: var(--surface-2); color: var(--text); }
    .body { padding: 22px; overflow-y: auto; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.98); } }
  `,
})
export class Modal {
  @Input() title = '';
  @Output() close = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc() { this.close.emit(); }
}
