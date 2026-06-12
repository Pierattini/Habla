import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectorRef } from '@angular/core';
import { API_URL } from '../../core/config/api.config';
//import { IonicModule } from '@ionic/angular';


import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonAvatar,
  IonButton,
  IonButtons,
  IonItem,
  IonLabel,
  IonDatetime,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonIcon,
  
  
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-professional-detail',
  standalone: true,
  templateUrl: './professional-detail.component.html',
  styleUrls: ['./professional-detail.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    //IonicModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonAvatar,
    IonButton,
    //IonItem,
    //IonLabel,
    IonDatetime,
    //IonGrid,
    //IonRow,
   // IonCol,
    IonText,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButtons,
  ]
})
export class ProfessionalDetailComponent {

  id: string | null = null;
  professional: any = null;
  loading = true;
  loaded = false;

  selectedDate: string = new Date().toISOString().split('T')[0];
  availableHours: string[] = [];
  selectedHour: string | null = null;
  isBooking: boolean = false;
  successMessage: string = '';

  constructor(
  private route: ActivatedRoute,
  private http: HttpClient,
  //private cdr: ChangeDetectorRef,
  private router: Router 
) {}

  ionViewWillEnter() {
    const routeId = this.route.snapshot.paramMap.get('id');

    if (this.id !== routeId) {
      this.professional = null;
      this.availableHours = [];
      this.selectedHour = null;
      this.successMessage = '';
      this.loaded = false;
    }

    this.loading = true;
    this.id = routeId;
    this.getProfessional();
  }
 onDateChange(event: any) {
  const value = event.detail.value;

  if (!value) return;

  this.selectedDate = value.split('T')[0];
  this.successMessage = '';
  this.loaded = false;
  console.log('FECHA CAMBIADA:', this.selectedDate);

  this.loadAvailability();
}
  getProfessional() {
  if (!this.id) {
    this.loading = false;
    this.loaded = true;
    return;
  }

  this.http.get<any[]>(`${API_URL}/users/professionals`)
    .subscribe({
      next: (res) => {

        console.log('ID URL:', this.id);
        console.log('LISTA:', res);

        // 🔥 SOLUCIÓN
        this.professional = res.find(p => String(p.id) === String(this.id));

        console.log('PROFESIONAL FINAL:', this.professional);

        this.loadAvailability();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.loaded = true;
      }
    });
}

  loadAvailability() {
  if (!this.professional?.id || !this.selectedDate) {
    this.loading = false;
    this.loaded = true;
    return;
  }

  this.loading = true;
  this.loaded = false;

  // 🔥 LIMPIAR FECHA
  //const cleanDate = this.selectedDate.split('T')[0];
  //const date = new Date(cleanDate + 'T12:00:00');

  this.http.get<string[]>(
  `${API_URL}/appointments/available-slots?professionalId=${this.professional.id}&date=${this.selectedDate}`
)
  .subscribe({
   next: (res: any[]) => {
  console.log('HORAS REALES:', res);

  this.availableHours = res;
  this.loading = false;
  this.loaded = true;

  //this.cdr.detectChanges();
},
    error: (err) => {
      console.error(err);
      this.availableHours = [];
      this.loading = false;
      this.loaded = true;
    }
  });
}
isHourDisabled(hour: string): boolean {
  const [h, m] = hour.split(':');

  const selected = new Date(this.selectedDate + 'T00:00:00');
  selected.setHours(Number(h), Number(m), 0, 0);

  const now = new Date();

  return selected < now;
}

getHourColor(hour: string): string {
  if (this.isHourDisabled(hour)) return 'medium';
  if (this.selectedHour === hour) return 'primary';
  return 'success';
}
  
bookAppointment() {
  if (!this.selectedHour || this.isBooking) return;

  const token = localStorage.getItem('token');

  if (!token) {
    alert('Debes iniciar sesión');
    return;
  }

  this.isBooking = true;
  this.successMessage = '';

  const [hour, minute] = this.selectedHour.split(':');

  const date = new Date(this.selectedDate + 'T12:00:00');
  date.setHours(Number(hour), Number(minute), 0, 0);

  const payload = {
    professionalId: this.professional.id,
    date: date.toISOString()
  };


  console.log('POST → /appointments');
  console.log('PAYLOAD:', payload);

  this.http.post(
    `${API_URL}/appointments`,
    payload
  ).subscribe({
    next: () => {
      console.log('✅ CITA OK');

      this.successMessage = '✅ Cita reservada correctamente';
      this.selectedHour = null;
      this.isBooking = false;

      // 👇 navegar después
      setTimeout(() => {
        this.router.navigate(['/tabs/appointments']);
      }, 800);
    },
    error: (err) => {
      console.error('❌ ERROR BACKEND:', err);

      // 🔥 MUY IMPORTANTE (esto te faltaba)
      this.isBooking = false;

      alert(err?.error?.message || 'Error al reservar');
    }
  });
}
goHome() {
  this.router.navigate(['/tabs/home']);
}
toggleHour(hour: string) {
  if (this.selectedHour === hour) {
    this.selectedHour = null;
  } else {
    this.selectedHour = hour;
  }
}
goToChat() {
  this.router.navigate(['/tabs/messages'], {
    queryParams: {
      professionalId: this.professional.id
    }
  });
}
}
