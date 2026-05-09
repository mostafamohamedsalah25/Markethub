import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TokenService } from './token';
import { User, AuthResponse } from '../../models/user.model';
import { tap, catchError } from 'rxjs/operators';
import { throwError, Observable } from 'rxjs';
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

  private readonly API_URL = `${environment.apiUrl}/auth`;

  login(credentials: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login/`, credentials).pipe(
      tap((response) => {
        if (response.data.access && response.data.refresh) {
          this.tokenService.setTokens(response.data.access, response.data.refresh);
          this.isAuthenticated.set(true);
          this.loadUserProfile().subscribe();
        }
      }),
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post(`${this.API_URL}/register/`, userData);
  }

  loadUserProfile(): Observable<any> {
    return this.http.get(`${this.API_URL}/me/`).pipe(
      tap((res: any) => {
        this.currentUser.set(res.data);
        this.isAuthenticated.set(true);
      }),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      }),
    );
  }

  logout(): void {
    this.tokenService.clearTokens();
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }
}
