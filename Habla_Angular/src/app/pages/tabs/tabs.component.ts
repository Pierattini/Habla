import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  calendarOutline,
  chatbubbleEllipsesOutline,
  personOutline,
  homeOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],


  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    IonRouterOutlet,
    RouterModule
  ]
})
export class TabsComponent {

  constructor() {
    addIcons({
      'home-outline': homeOutline,
      'calendar-outline': calendarOutline,
      'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
      'person-outline': personOutline
    });
  }

}