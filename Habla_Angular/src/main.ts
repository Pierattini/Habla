import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/* 🔥 IMPORTAR ICONOS */
import { addIcons } from 'ionicons';
import {
  homeOutline,
  calendarOutline,
  chatbubbleEllipsesOutline,
  personOutline,
  documentOutline
} from 'ionicons/icons';

/* 🔥 REGISTRAR ICONOS */
addIcons({
  'home-outline': homeOutline,
  'calendar-outline': calendarOutline,
  'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
  'person-outline': personOutline,
  'document-outline': documentOutline
});

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));