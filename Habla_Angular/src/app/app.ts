import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { PushNotificationService } from './services/push-notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  imports: [IonApp, IonRouterOutlet]
})
export class App {
  constructor(private pushNotifications: PushNotificationService) {
    void this.pushNotifications.initialize();
  }
}
