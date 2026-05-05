import { Component, AfterViewChecked } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  imports: [IonApp, IonRouterOutlet]
})
export class App implements AfterViewChecked {

  ngAfterViewChecked() {
    // 🔥 eliminar capas ocultas que bloquean clicks
    const hidden = document.querySelectorAll('.ion-page-hidden');

    hidden.forEach(el => {
      const html = el as HTMLElement;

      // SOLO eliminar si no es la página activa
      if (!html.classList.contains('ion-page')) return;

      html.style.pointerEvents = 'none';
      html.style.display = 'none';
    });
  }

}