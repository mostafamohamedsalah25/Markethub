import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TokenService } from '../services/token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const token = tokenService.getAccessToken();

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // If we get a 401, the token is likely invalid or expired.
        // We clear it so that subsequent requests don't send it.
        tokenService.clearTokens();
        
        // If it's a GET request, we retry once without the token.
        // This allows public endpoints to load successfully even if the user had a stale session.
        if (req.method === 'GET') {
          const retryReq = req.clone({
            headers: req.headers.delete('Authorization')
          });
          return next(retryReq);
        }
      }
      return throwError(() => error);
    })
  );
};
