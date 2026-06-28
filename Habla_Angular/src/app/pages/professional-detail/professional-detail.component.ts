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
  slug: string | null = null;
  professional: any = null;
  loading = true;
  loaded = false;
  private profileViewRecordedFor = '';

  selectedDate: string = new Date().toISOString().split('T')[0];
  availableHours: string[] = [];
  selectedHour: string | null = null;
  isBooking: boolean = false;
  successMessage: string = '';
  selectedDocumentMode: 'NONE' | 'MANUAL' | 'AUTOMATED' = 'NONE';
  selectedAttentionMode: 'ONLINE' | 'PRESENTIAL' = 'ONLINE';
  wantsTaxDocumentByDefault = false;
  customerTaxReady = false;
  professionalTaxReady = false;
  customerProfile: any = null;

  constructor(
  private route: ActivatedRoute,
  private http: HttpClient,
  private auth: AuthService,
  private cdr: ChangeDetectorRef,
  private router: Router,
  private alertCtrl: AlertController ) {}

  ionViewWillEnter() {
    const routeId = this.route.snapshot.paramMap.get('id');
    const routeSlug = this.route.snapshot.paramMap.get('slug');

    if (this.id !== routeId || this.slug !== routeSlug) {
      this.professional = null;
      this.availableHours = [];
      this.selectedHour = null;
      this.successMessage = '';
      this.selectedDocumentMode = 'NONE';
      this.selectedAttentionMode = 'ONLINE';
      this.loaded = false;
    }

    this.loading = true;
    this.id = routeId;
    this.slug = routeSlug;
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
    if (!this.id && !this.slug) {
      this.loading = false;
      this.loaded = true;
      this.cdr.detectChanges();
      return;
    }

    const request$ = this.slug
      ? this.http.get<any>(`${API_URL}/users/professionals/public/${this.slug}`)
      : this.http.get<any>(`${API_URL}/users/professionals`);

    request$.subscribe({
      next: (res) => {
        if (this.slug) {
          this.professional = res;
          this.recordProfileView();
        } else {
          const professionals = Array.isArray(res) ? res : res?.data || [];
          this.professional = professionals.find((p: any) => String(p.id) === String(this.id));
        }

        this.professionalTaxReady = this.professional?.taxDocumentReady === true;
        this.selectedAttentionMode =
          this.professional?.attentionMode === 'PRESENTIAL'
            ? 'PRESENTIAL'
            : 'ONLINE';
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
      const shouldContinue = await this.openCustomerTaxDataModal();

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
    documentCurrency: 'CLP',
    attentionMode: this.selectedAttentionMode
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

async openCustomerTaxDataModal(): Promise<boolean> {
  return new Promise(async (resolve) => {
    let settled = false;
    let taxAlert: HTMLIonAlertElement;

    const current = this.customerProfile || {};
    const fallbackEmail = current.email || '';

    taxAlert = await this.alertCtrl.create({
      header: 'Datos para documento',
      message: 'Completa estos datos una sola vez. RUT/NIF/DNI: 6 a 20 caracteres. Nombre: 3 a 120. Email valido. Ciudad: 2 a 80. Direccion: 5 a 160.',
      inputs: [
        {
          name: 'taxName',
          type: 'text',
          value: current.taxName || current.name || '',
          placeholder: 'Nombre completo o razon social',
          attributes: {
            maxlength: 120,
          },
        },
        {
          name: 'taxId',
          type: 'text',
          value: current.taxId || '',
          placeholder: 'RUT / NIF / DNI',
          attributes: {
            maxlength: 20,
            inputmode: 'text',
          },
        },
        {
          name: 'taxEmail',
          type: 'email',
          value: current.taxEmail || fallbackEmail,
          placeholder: 'Correo para documento',
          attributes: {
            maxlength: 120,
            inputmode: 'email',
          },
        },
        {
          name: 'taxCity',
          type: 'text',
          value: current.taxCity || '',
          placeholder: 'Ciudad o comuna',
          attributes: {
            maxlength: 80,
          },
        },
        {
          name: 'taxAddress',
          type: 'text',
          value: current.taxAddress || '',
          placeholder: 'Direccion tributaria',
          attributes: {
            maxlength: 160,
          },
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar y continuar',
          handler: (data) => {
            const payload = {
              taxName: this.cleanOptional(data.taxName),
              taxId: this.cleanOptional(data.taxId),
              taxEmail: this.cleanOptional(data.taxEmail) || fallbackEmail,
              taxCity: this.cleanOptional(data.taxCity),
              taxAddress: this.cleanOptional(data.taxAddress),
              taxCountry: current.taxCountry || current.country || 'CL',
            };

            const missing = [
              !payload.taxName ? 'nombre completo' : null,
              !payload.taxId ? 'RUT / NIF / DNI' : null,
              !payload.taxEmail ? 'correo' : null,
              !payload.taxCity ? 'ciudad o comuna' : null,
              !payload.taxAddress ? 'direccion' : null,
            ].filter(Boolean);

            if (missing.length > 0) {
              alert(`Faltan datos para el documento: ${missing.join(', ')}.`);
              return false;
            }

            const validationError = this.validateTaxPayload(payload);

            if (validationError) {
              alert(validationError);
              return false;
            }

            this.auth.updateProfile(payload).subscribe({
              next: (updatedUser: any) => {
                this.updateCustomerTaxState(updatedUser);
                settled = true;
                taxAlert.dismiss(null, 'saved');
                resolve(true);
              },
              error: () => {
                alert('No se pudieron guardar los datos tributarios. Intenta nuevamente.');
              },
            });

            return false;
          },
        },
      ],
    });

    taxAlert.onDidDismiss().then((event) => {
      if (!settled && event.role !== 'saved') {
        resolve(false);
      }
    });

    await taxAlert.present();
  });
}

loadCustomerDocumentPreference() {
  const token = localStorage.getItem('token');

  if (!token) return;

  this.auth.getProfile().subscribe({
    next: (user: any) => {
      this.updateCustomerTaxState(user);
      this.applyDefaultDocumentMode();
    },
    error: () => {
      this.wantsTaxDocumentByDefault = false;
      this.customerTaxReady = false;
    }
  });
}

updateCustomerTaxState(user: any) {
  this.customerProfile = user || null;
  this.wantsTaxDocumentByDefault = user?.wantsTaxDocumentByDefault === true;
  this.customerTaxReady = !!(
    user?.taxId &&
    user?.taxName &&
    (user?.taxEmail || user?.email) &&
    user?.taxAddress &&
    user?.taxCity
  );
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

onAttentionModeChange(mode: 'ONLINE' | 'PRESENTIAL') {
  if (!this.professional) return;

  if (this.professional.attentionMode === 'ONLINE') {
    this.selectedAttentionMode = 'ONLINE';
    return;
  }

  if (this.professional.attentionMode === 'PRESENTIAL') {
    this.selectedAttentionMode = 'PRESENTIAL';
    return;
  }

  this.selectedAttentionMode = mode;
}

getAttentionModeLabel(): string {
  if (!this.professional) return '';

  if (this.professional.attentionMode === 'ONLINE') return 'Atencion online';
  if (this.professional.attentionMode === 'PRESENTIAL') return 'Atencion presencial';

  return 'Online o presencial';
}

getVideoProviderLabel(): string {
  const provider = this.professional?.videoProvider || 'CONNECTA_AUTO';

  if (provider === 'GOOGLE_MEET') return 'Google Meet';
  if (provider === 'ZOOM') return 'Zoom';
  if (provider === 'MICROSOFT_TEAMS') return 'Microsoft Teams';
  if (provider === 'CUSTOM') return 'Enlace personalizado';

  return 'Sala online generada por Conecta';
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

private cleanOptional(value: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

private validateTaxPayload(payload: {
  taxId?: string;
  taxName?: string;
  taxEmail?: string;
  taxAddress?: string;
  taxCity?: string;
}): string | null {
  const taxIdPattern = /^[a-zA-Z0-9.\-\s]{6,20}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  if (!payload.taxId || !taxIdPattern.test(payload.taxId)) {
    return 'El RUT / NIF / DNI debe tener entre 6 y 20 caracteres. Usa solo letras, numeros, puntos, guion o espacios.';
  }

  if (!payload.taxName || payload.taxName.length < 3 || payload.taxName.length > 120) {
    return 'El nombre tributario debe tener entre 3 y 120 caracteres.';
  }

  if (!payload.taxEmail || payload.taxEmail.length > 120 || !emailPattern.test(payload.taxEmail)) {
    return 'Ingresa un email tributario valido.';
  }

  if (!payload.taxCity || payload.taxCity.length < 2 || payload.taxCity.length > 80) {
    return 'La ciudad o comuna debe tener entre 2 y 80 caracteres.';
  }

  if (!payload.taxAddress || payload.taxAddress.length < 5 || payload.taxAddress.length > 160) {
    return 'La direccion tributaria debe tener entre 5 y 160 caracteres.';
  }

  return null;
}

private recordProfileView(): void {
  if (!this.slug || this.profileViewRecordedFor === this.slug) return;

  this.profileViewRecordedFor = this.slug;

  this.http.post(
    `${API_URL}/users/professionals/public/${this.slug}/events`,
    { type: 'VIEW' }
  ).subscribe({
    error: (err) => console.warn('No se pudo registrar vista de perfil:', err),
  });
}
}
