import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, NgFor } from '@angular/common';
import { IonAvatar } from '@ionic/angular/standalone';
import { IonButton } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { API_URL } from '../../core/config/api.config';

import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonHeader,
  IonToolbar,
  IonTitle
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-professionals',
  templateUrl: './professionals.component.html',
  styleUrls: ['./professionals.component.scss'],
  standalone: true,
  imports: [
  CommonModule, 
  NgFor,    
  IonAvatar,
  IonButton,
  IonContent,
  IonCard,
  //IonCardHeader,
  //IonCardTitle,
 // IonCardSubtitle,
  IonCardContent,
  IonHeader,
  IonToolbar,
  IonTitle
]
})
export class ProfessionalsComponent implements OnInit {

  professionals: any[] = [];

  constructor(
  private http: HttpClient,
  private router: Router,
  //private cd: ChangeDetectorRef
  
) {}

 ngOnInit() {
  this.getProfessionals();
}

getProfessionals() {
  this.http.get<any>(`${API_URL}/users/professionals`)
    .subscribe({
      next: (res) => {
        console.log('DATA:', res);

        this.professionals = Array.isArray(res) ? res : [res];
       // this.cd.detectChanges();

      },
      error: (err) => console.error(err)
    });
}
  goToDetail(id: string) {
  this.router.navigate(['/tabs/professional', id]);
}

}
