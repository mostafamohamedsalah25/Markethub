import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

export const roleGuard =
  (allowedRoles: string[]): CanActivateFn =>
  async (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.waitForInit();

    const user = authService.currentUser();
    if (authService.isAuthenticated() && user && allowedRoles.includes(user.role)) {
      return true;
    }

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url },
      });
    }

    return router.createUrlTree(['/']);
  };
