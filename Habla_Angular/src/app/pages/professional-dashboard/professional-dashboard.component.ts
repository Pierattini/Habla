import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  templateUrl: './professional-dashboard.component.html',
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    //IonCard,
    //IonCardHeader,
    //IonCardTitle,
    //IonCardContent
  ]
})
export class ProfessionalDashboardComponent implements OnInit {

  todayAppointments: any[] = [];

  constructor(
    private http: HttpClient,
    //private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadTodayAppointments();
  }

  loadTodayAppointments() {
  const token = localStorage.getItem('token') || '';

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  this.http.get<any[]>(
    'http://localhost:3000/appointments/professional',
    { headers }
  ).subscribe({
    next: (res) => {

      const today = new Date();

      const data = (res || []).filter(appt => {
        const d = new Date(appt.date);

        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      });

      this.todayAppointments = [...data];

      console.log('CITAS DE HOY:', this.todayAppointments);

      setTimeout(() => {
       // this.cd.detectChanges();
      }, 0);
    },

    error: (err) => {
      console.error('ERROR:', err);
    }
  });
}}