import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { API_URL } from '../../core/config/api.config';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
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
  selectedDocumentMode: 'NONE' | 'MANUAL' | 'AUTOMATED' = 'NONE';
  wantsTaxDocumentByDefault = false;
  customerTaxReady = false;
  professionalTaxReady = false;

  constructor(
  private route: ActivatedRoute,
  private http: HttpClient,
  private auth: AuthService,
  private cdr: ChangeDetectorRef,
  private router: Router,
  private alertCtrl: AlertController ) {}

  ionViewWillEnter() {
    const routeId = this.route.snapshot.paramMap.get('id');

    if (this.id !== routeId) {
      this.professional = null;
      this.availableHours = [];
      this.selectedHour = null;
      this.successMessage = '';
      this.selectedDocumentMode = 'NONE';
      this.loaded = false;
    }

    this.loading = true;
    this.id = routeId;
    this.loadCustomerDocumentPreference();
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
    this.cdr.detectChanges();
    return;
  }

  this.http.get<any[]>(`${API_URL}/users/professionals`)
    .subscribe({
      next: (res) => {

        console.log('ID URL:', this.id);
        console.log('LISTA:', res);

        // 🔥 SOLUCIÓN
        this.professional = res.find(p => String(p.id) === String(this.id));
        this.professionalTaxReady = !!(
          this.professional?.taxId &&
          this.professional?.taxName &&
          (this.professional?.taxEmail || this.professional?.email) &&
          this.professional?.taxAddress &&
          this.professional?.taxCity
        );

        console.log('PROFESIONAL FINAL:', this.professional);

        this.applyDefaultDocumentMode();
        this.loadAvailability();
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        this.loaded = true;
        this.cdr.detectChanges();
      }
    });
}

  loadAvailability() {
  if (!this.professional?.id || !this.selectedDate) {
    this.loading = false;
    this.loaded = true;
    this.cdr.detectChanges();
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
  this.cdr.detectChanges();

},
    error: (err) => {
      console.error(err);
      this.availableHours = [];
      this.loading = false;
      this.loaded = true;
      this.cdr.detectChanges();
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
  
async bookAppointment() {
  if (!this.selectedHour || this.isBooking) return;

  const token = localStorage.getItem('token');

  if (!token) {
    alert('Debes iniciar sesión');
    return;
  }
  if (this.selectedDocumentMode !== 'NONE') {
    if (!this.customerTaxReady) {
      const shouldContinue = await this.confirmBookingWithoutDocument(
        'Completa tus datos tributarios en Perfil antes de solicitar documento.'
      );

      if (!shouldContinue) return;
    }

    if (!this.professionalTaxReady) {
      const shouldContinue = await this.confirmBookingWithoutDocument(
        'Este profesional debe completar sus datos tributarios antes de emitir documentos.'
      );

      if (!shouldContinue) return;
    }
  }



  this.isBooking = true;
  this.successMessage = '';

  const [hour, minute] = this.selectedHour.split(':');

  const date = new Date(this.selectedDate + 'T12:00:00');
  date.setHours(Number(hour), Number(minute), 0, 0);

  const payload = {
    professionalId: this.professional.id,
    date: date.toISOString(),
    documentRequested: this.selectedDocumentMode !== 'NONE',
    documentMode: this.selectedDocumentMode !== 'NONE'
      ? this.selectedDocumentMode
      : undefined,
    documentCurrency: 'CLP'
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

async confirmBookingWithoutDocument(message: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    const alert = await this.alertCtrl.create({
      header: 'Datos tributarios incompletos',
      message,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: () => resolve(false),
        },
        {
          text: 'Ir a perfil',
          handler: () => {
            this.router.navigate(['/tabs/profile']);
            resolve(false);
          },
        },
        {
          text: 'Reservar sin documento',
          handler: () => {
            this.selectedDocumentMode = 'NONE';
            resolve(true);
          },
        },
      ],
    });

    await alert.present();
  });
}
loadCustomerDocumentPreference() {
  const token = localStorage.getItem('token');

  if (!token) return;

  this.auth.getProfile().subscribe({
    next: (user: any) => {
      this.wantsTaxDocumentByDefault = user?.wantsTaxDocumentByDefault === true;
      this.customerTaxReady = !!(
        user?.taxId &&
        user?.taxName &&
        (user?.taxEmail || user?.email) &&
        user?.taxAddress &&
        user?.taxCity
      );
      this.applyDefaultDocumentMode();
    },
    error: () => {
      this.wantsTaxDocumentByDefault = false;
      this.customerTaxReady = false;
    }
  });
}

applyDefaultDocumentMode() {
  if (!this.wantsTaxDocumentByDefault || !this.professional) return;

  this.selectedDocumentMode = this.professional.documentAutomationEnabled
    ? 'AUTOMATED'
    : 'MANUAL';
}

onDocumentModeChange(mode: 'NONE' | 'MANUAL' | 'AUTOMATED') {
  if (mode === 'AUTOMATED' && !this.professional?.documentAutomationEnabled) {
    this.selectedDocumentMode = 'MANUAL';
    return;
  }

  this.selectedDocumentMode = mode;
}

getDocumentModeLabel(): string {
  if (this.selectedDocumentMode === 'AUTOMATED') {
    return 'Conecta gestionara el documento cuando el servicio este habilitado.';
  }

  if (this.selectedDocumentMode === 'MANUAL') {
    return 'El profesional emitira o subira el documento desde su panel.';
  }

  return 'No se solicitara documento tributario para esta cita.';
}
}
