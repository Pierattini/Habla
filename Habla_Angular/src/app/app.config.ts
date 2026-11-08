import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    // Las pantallas esperan refrescarse solas al recibir datos; Angular 21 viene sin
    // zone.js por defecto y sin esto quedaban pegadas en "Cargando..." o "Validando...".
    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      routes,
      withRouterConfig({
        onSameUrlNavigation: 'reload'
      })
    ),

    provideHttpClient(
      withInterceptors([authInterceptor])
    ),

    provideIonicAngular(),

    importProvidersFrom(FormsModule),
  ]
};
