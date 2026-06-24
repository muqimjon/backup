import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <form class="card" (ngSubmit)="submit()">
        <div class="brand">🗄️ BackupHub</div>
        <p class="muted sub">Sign in to manage your backups</p>

        <label>Username</label>
        <input [ngModel]="username()" (ngModelChange)="username.set($event)" name="username" autocomplete="username" />

        <label>Password</label>
        <input type="password" [ngModel]="password()" (ngModelChange)="password.set($event)" name="password" autocomplete="current-password" />

        @if (error()) { <div class="err">{{ error() }}</div> }

        <button type="submit" [disabled]="loading()">{{ loading() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; }
    .card { width: 340px; display: flex; flex-direction: column; gap: 8px; }
    .brand { font-size: 22px; font-weight: 700; }
    .sub { margin: 0 0 12px; }
    label { margin-top: 8px; }
    button { margin-top: 18px; }
    .err { color: var(--fail); font-size: 13px; margin-top: 10px; }
  `,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = signal('admin');
  password = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  submit() {
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.username(), this.password()).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: err => {
        this.error.set(
          err.status === 0
            ? 'Cannot reach the server — is the API running on port 5080?'
            : err.status === 401
              ? 'Invalid username or password'
              : (err?.error?.error ?? 'Login failed'),
        );
        this.loading.set(false);
      },
    });
  }
}
