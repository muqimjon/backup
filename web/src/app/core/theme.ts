import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly key = 'backuphub.theme';
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  readonly mode = signal<ThemeMode>((localStorage.getItem(this.key) as ThemeMode) || 'system');

  constructor() {
    this.media.addEventListener('change', () => this.apply());
    this.apply();
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    localStorage.setItem(this.key, mode);
    this.apply();
  }

  cycle() {
    const order: ThemeMode[] = ['system', 'light', 'dark'];
    this.set(order[(order.indexOf(this.mode()) + 1) % order.length]);
  }

  private apply() {
    const resolved = this.mode() === 'system'
      ? (this.media.matches ? 'dark' : 'light')
      : this.mode();
    if (resolved === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  }
}
