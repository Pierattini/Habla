import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  calendarOutline,
  chatbubbleEllipsesOutline,
  personOutline,
  homeOutline,
  briefcaseOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],


  imports: [
    CommonModule,
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    RouterModule
  ]
})
export class TabsComponent implements OnInit {
  userRole = '';
  constructor() {
    addIcons({
      'home-outline': homeOutline,
      'calendar-outline': calendarOutline,
      'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
      'person-outline': personOutline,
      'briefcase-outline': briefcaseOutline,
    });
  }
  ngOnInit() {

  const token = localStorage.getItem('token');

  if (!token) return;

  const payload = JSON.parse(atob(token.split('.')[1]));

  this.userRole = payload.role;
}

}
