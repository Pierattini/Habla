import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { clearStoredSession, getStoredToken, isTokenExpired } from '../auth/session.util';

export const professionalGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = getStoredToken();
  const role = localStorage.getItem('role');

  if (token && !isTokenExpired(token) && role === 'PROFESSIONAL') {
    return true;
  }

  if (!token || isTokenExpired(token)) {
    clearStoredSession();
    return router.parseUrl('/login');
  }

  return router.parseUrl('/tabs/home');
};
