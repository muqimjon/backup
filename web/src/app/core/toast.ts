import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'ok' | 'fail';
export interface ToastItem { id: number; message: string; kind: ToastKind; }

// A small bottom-right notification stack. Toasts append (newest at the bottom),
// each self-dismisses after its own timeout, so the oldest (shown first) also
// leaves first. Replaces inline banners that used to push page content down.
@Injectable({ providedIn: 'root' })
export class Toast {
  private seq = 0;
  readonly items = signal<ToastItem[]>([]);

  show(message: string, kind: ToastKind = 'info', ms = 6000) {
    const id = ++this.seq;
    this.items.update(list => [...list, { id, message, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }

  ok(message: string, ms = 6000) { this.show(message, 'ok', ms); }
  fail(message: string, ms = 8000) { this.show(message, 'fail', ms); }

  dismiss(id: number) { this.items.update(list => list.filter(t => t.id !== id)); }
}
