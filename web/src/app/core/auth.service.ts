import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthResult, AuthUser } from './models';

const TOKEN_KEY = 'bh_token';
const USER_KEY = 'bh_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<AuthUser | null>(this.readUser());
  readonly isAuthenticated = computed(() => this.user() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(username: string, password: string) {
    return this.http.post<AuthResult>('/api/auth/login', { username, password }).pipe(
      tap(result => {
        localStorage.setItem(TOKEN_KEY, result.token);
        const user: AuthUser = { username: result.username, role: result.role };
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.user.set(user);
      }),
    );
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
