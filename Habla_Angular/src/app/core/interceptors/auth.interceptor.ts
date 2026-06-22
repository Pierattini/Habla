import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { clearStoredSession, getStoredToken, isTokenExpired } from '../auth/session.util';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = getStoredToken();
  const isAuthRequest = req.url.includes('/auth/login') || req.url.includes('/auth/register');

  if (token && isTokenExpired(token) && !isAuthRequest) {
    clearStoredSession();
    router.navigateByUrl('/login');
    return throwError(() => new Error('Session expired'));
  }

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthRequest) {
        clearStoredSession();
        router.navigateByUrl('/login');
      }

      return throwError(() => error);
    })
  );
};
