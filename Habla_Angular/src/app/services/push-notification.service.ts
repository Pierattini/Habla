import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications';
import { API_URL } from '../core/config/api.config';

@Injectable({
  providedIn: 'root',
})
export class PushNotificationService {
  private initialized = false;

  constructor(private http: HttpClient) {}

  async initialize(): Promise<void> {
    if (this.initialized || !this.isNativeApp()) return;
    this.initialized = true;

    PushNotifications.addListener('registration', (token: Token) => {
      this.saveDeviceToken(token.value);
    });

    PushNotifications.addListener('registrationError', () => {
      this.initialized = false;
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (_notification: PushNotificationSchema) => {},
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (_notification: ActionPerformed) => {},
    );

    await this.registerDevice();
  }

  async registerDevice(): Promise<void> {
    if (!this.isNativeApp() || !localStorage.getItem('token')) return;

    let permission = await PushNotifications.checkPermissions();

    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== 'granted') return;

    await PushNotifications.register();
  }

  private saveDeviceToken(token: string): void {
    if (!token || !localStorage.getItem('token')) return;

    this.http
      .post(`${API_URL}/notifications/device-token`, {
        token,
        platform: Capacitor.getPlatform(),
      })
      .subscribe({
        error: () => undefined,
      });
  }

  private isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }
}
