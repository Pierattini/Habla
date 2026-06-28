import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { clearStoredSession, getStoredToken, isTokenExpired } from '../auth/session.util';

export const appUserGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = getStoredToken();
  const role = localStorage.getItem('role');

  if (!token || isTokenExpired(token)) {
    clearStoredSession();
    return router.parseUrl('/login');
  }

  if (role === 'ADMIN') {
    return router.parseUrl('/admin/dashboard');
  }

  return true;
};
