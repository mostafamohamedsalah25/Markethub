import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TokenService } from './token';
import { User, AuthResponse } from '../../models/user.model';
import { tap, catchError, map } from 'rxjs/operators';
import { throwError, Observable, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private tokenService = inject(TokenService);
  private router = inject(Router);

  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);
  initialized = signal<boolean>(false);

  private readonly API_URL = `${environment.apiUrl}/auth`;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initializeAuth();
  }

  waitForInit(): Promise<void> {
    return this.initPromise ?? this.initializeAuth();
  }

  initializeAuth(): Promise<void> {
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    const accessToken = this.tokenService.getAccessToken();
    const refreshToken = this.tokenService.getRefreshToken();

    if (!accessToken && !refreshToken) {
      this.initialized.set(true);
      return;
    }

    if (accessToken && !this.isTokenExpired(accessToken)) {
      this.applyTokenPayload(accessToken);
      try {
        await firstValueFrom(this.fetchProfile());
      } catch {
        // Profile fetch failed; keep JWT-derived session
      }
      this.initialized.set(true);
      return;
    }

    if (refreshToken) {
      try {
        await firstValueFrom(this.refreshAccessToken());
        const newToken = this.tokenService.getAccessToken();
        if (newToken) {
          this.applyTokenPayload(newToken);
          await firstValueFrom(this.fetchProfile());
        }
      } catch {
        this.clearSession();
      }
    } else {
      this.clearSession();
    }

    this.initialized.set(true);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return !!(payload.exp && payload.exp < now);
    } catch {
      return true;
    }
  }

  private applyTokenPayload(token: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.isAuthenticated.set(true);
      this.currentUser.set({
        id: payload.user_id || '',
        email: '',
        phone: null,
        role: payload.role || 'customer',
        is_verified: true,
        created_at: '',
      });
    } catch {
      this.clearSession();
    }
  }

  refreshAccessToken(): Observable<string> {
    const refresh = this.tokenService.getRefreshToken();
    if (!refresh) {
      return throwError(() => new Error('No refresh token'));
    }

    return this.http
      .post<{ access: string }>(`${this.API_URL}/token/refresh/`, { refresh })
      .pipe(
        tap((res) => {
          this.tokenService.setTokens(res.access, refresh);
          this.applyTokenPayload(res.access);
        }),
        map((res) => res.access),
        catchError((err) => {
          this.clearSession();
          return throwError(() => err);
        }),
      );
  }

  private fetchProfile(): Observable<User> {
    return this.http.get<{ data: User }>(`${this.API_URL}/me/`).pipe(
      tap((res) => {
        this.currentUser.set(res.data);
        this.isAuthenticated.set(true);
      }),
      map((res) => res.data),
    );
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login/`, credentials).pipe(
      tap((response) => {
        if (response.data.access && response.data.refresh) {
          this.tokenService.setTokens(response.data.access, response.data.refresh);
          this.applyTokenPayload(response.data.access);
          this.currentUser.update((u) =>
            u
              ? { ...u, email: response.data.user.email, role: response.data.user.role }
              : {
                  id: '',
                  email: response.data.user.email,
                  phone: null,
                  role: response.data.user.role,
                  is_verified: true,
                  created_at: '',
                },
          );
          this.isAuthenticated.set(true);
          this.fetchProfile().subscribe();
        }
      }),
    );
  }

  register(userData: Record<string, unknown>): Observable<unknown> {
    return this.http.post(`${this.API_URL}/register/`, userData);
  }

  verifyEmail(token: string): Observable<unknown> {
    return this.http.get(`${this.API_URL}/verify-email/${token}/`);
  }

  loadUserProfile(): Observable<User> {
    return this.fetchProfile().pipe(
      catchError((err) => {
        if (err.status === 401) {
          this.clearSession();
        }
        return throwError(() => err);
      }),
    );
  }

  clearSession(): void {
    this.tokenService.clearTokens();
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  logout(): void {
    const refresh = this.tokenService.getRefreshToken();
    if (refresh) {
      this.http.post(`${this.API_URL}/logout/`, { refresh }).subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }
}
