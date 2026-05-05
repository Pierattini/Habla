import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
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