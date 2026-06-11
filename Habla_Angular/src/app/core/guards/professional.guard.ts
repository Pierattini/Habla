import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const professionalGuard: CanActivateFn = () => {
  const router = inject(Router);
  const role = localStorage.getItem('role');

  if (role === 'PROFESSIONAL') {
    return true;
  }

  return router.parseUrl('/tabs/home');
};
