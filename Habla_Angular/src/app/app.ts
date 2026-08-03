import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { PushNotificationService } from './services/push-notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  imports: [IonApp, IonRouterOutlet]
})
export class App implements OnDestroy {
  private deepLinkListener?: PluginListenerHandle;

  constructor(
    private pushNotifications: PushNotificationService,
    private router: Router,
  ) {
    void this.pushNotifications.initialize().catch((error) => {
      // Push is optional and must never prevent the application from starting.
      console.error('[startup] Push notifications initialization failed', error);
    });
    void this.initializeDeepLinks();
  }

  ngOnDestroy(): void {
    void this.deepLinkListener?.remove();
  }

  private async initializeDeepLinks(): Promise<void> {
    this.deepLinkListener = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      void this.openPublicProfileDeepLink(url);
    });

    const launch = await CapacitorApp.getLaunchUrl();
    if (launch?.url) {
      await this.openPublicProfileDeepLink(launch.url);
    }
  }

  private async openPublicProfileDeepLink(rawUrl: string): Promise<void> {
    try {
      const url = new URL(rawUrl);
      const match = url.pathname.match(/^\/profesional\/([^/]+)\/?$/);

      if (url.protocol !== 'https:' || url.hostname !== 'app.turedpro.com' || !match) return;

      const slug = decodeURIComponent(match[1]);
      await this.router.navigate(['/profesional', slug]);
    } catch (error) {
      console.warn('[DeepLink] No se pudo procesar el enlace público', error);
    }
  }
}
