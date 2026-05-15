import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { TokenService } from '../services/token';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const token = tokenService.getAccessToken();

  const isAuthEndpoint =
    req.url.includes('/auth/login/') ||
    req.url.includes('/auth/register/') ||
    req.url.includes('/auth/token/refresh/') ||
    req.url.includes('/auth/verify-email/');

  let authReq = req;
  if (token && !isAuthEndpoint) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      const refresh = tokenService.getRefreshToken();
      if (!refresh || req.url.includes('/auth/token/refresh/')) {
        authService.clearSession();
        return throwError(() => error);
      }

      return authService.refreshAccessToken().pipe(
        switchMap((newAccess) => {
          const retryReq = req.clone({
            setHeaders: { Authorization: `Bearer ${newAccess}` },
          });
          return next(retryReq);
        }),
        catchError((refreshErr) => {
          authService.clearSession();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};
