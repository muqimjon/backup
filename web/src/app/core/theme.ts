import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly key = 'backuphub.theme';

  readonly mode = signal<ThemeMode>((localStorage.getItem(this.key) as ThemeMode) || 'dark');

  constructor() { this.apply(); }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    localStorage.setItem(this.key, mode);
    this.apply();
  }

  toggle() { this.set(this.mode() === 'dark' ? 'light' : 'dark'); }

  private apply() {
    if (this.mode() === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  }
}
