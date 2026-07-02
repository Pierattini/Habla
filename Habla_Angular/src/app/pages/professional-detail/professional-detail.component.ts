import { ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { API_URL } from '../../core/config/api.config';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { ConectaMessageType } from '../../shared/conecta-message/conecta-message.component';
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButtons,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
})
export class ProfessionalDetailComponent {

  id: string | null = null;
  slug: string | null = null;
  professional: any = null;
  loading = true;
  loaded = false;
  private profileViewRecordedFor = '';

  selectedDate: string = new Date().toISOString().split('T')[0];
  minBookingDate: string = this.toDateInputValue(new Date());
  maxBookingDate: string = this.toDateInputValue(this.addMonths(new Date(), 6));
  availableHours: string[] = [];
  selectedHour: string | null = null;
  isBooking: boolean = false;
  messageOpen = false;
  messageType: ConectaMessageType = 'info';
  messageTitle = '';
  messageDescription = '';
  selectedDocumentMode: 'NONE' | 'MANUAL' = 'NONE';
  selectedAttentionMode: 'ONLINE' | 'PRESENTIAL' = 'ONLINE';
  wantsTaxDocumentByDefault = false;
  customerTaxReady = false;
  professionalTaxReady = false;
  customerProfile: any = null;
  customerTaxData: {
    taxName?: string;
    taxId?: string;
    taxAddress?: string;
    taxPhone?: string;
    taxComment?: string;
  } | null = null;

  constructor(
  private route: ActivatedRoute,
  private http: HttpClient,
  private auth: AuthService,
  private cdr: ChangeDetectorRef,
  private router: Router,
  private alertCtrl: AlertController ) {}

  private addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private toDateInputValue(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  ionViewWillEnter() {
    const routeId = this.route.snapshot.paramMap.get('id');
    const routeSlug = this.route.snapshot.paramMap.get('slug');

    if (this.id !== routeId || this.slug !== routeSlug) {
      this.professional = null;
      this.availableHours = [];
      this.selectedHour = null;
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
  this.loaded = false;
  this.loadAvailability();
}
  getProfessional() {
    if (!this.id && !this.slug) {
      this.loading = false;
      this.loaded = true;
      this.cdr.detectChanges();
      return;
    }

    const stateProfessional = history.state?.professional;

    if (
      !this.slug &&
      stateProfessional?.id &&
      String(stateProfessional.id) === String(this.id)
    ) {
      this.professional = {
        ...stateProfessional,
        sessionDuration: stateProfessional.sessionDuration ?? stateProfessional.duration,
      };
      this.professionalTaxReady = this.professional?.taxDocumentReady === true;
      this.selectedAttentionMode =
        this.professional?.attentionMode === 'PRESENTIAL'
          ? 'PRESENTIAL'
          : 'ONLINE';
      this.applyDefaultDocumentMode();
      this.loadAvailability();
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
    this.showMessage(
      'warning',
      'Inicia sesion',
      'Debes iniciar sesion para solicitar una cita.'
    );
    return;
  }
  if (this.selectedDocumentMode !== 'NONE') {
    this.ensureCustomerTaxDraft();

    const validationError = this.validateTaxPayload(this.customerTaxData || {});

    if (validationError) {
      this.showMessage(
        'warning',
        'Datos tributarios incompletos',
        validationError
      );
      return;
    }

    if (this.professional?.documentAutomationEnabled && !this.professionalTaxReady) {
      const shouldContinue = await this.confirmBookingWithoutDocument(
        'Este profesional debe completar sus datos tributarios para activar la emision automatica.'
      );

      if (!shouldContinue) return;
    }
  }



  this.isBooking = true;

  const [hour, minute] = this.selectedHour.split(':');

  const date = new Date(this.selectedDate + 'T12:00:00');
  date.setHours(Number(hour), Number(minute), 0, 0);

  const payload = {
    professionalId: this.professional.id,
    date: date.toISOString(),
    documentRequested: this.selectedDocumentMode !== 'NONE',
    documentCurrency: 'CLP',
    attentionMode: this.selectedAttentionMode,
    customerTaxName: this.customerTaxData?.taxName,
    customerTaxId: this.customerTaxData?.taxId,
    customerTaxAddress: this.customerTaxData?.taxAddress,
    customerTaxPhone: this.customerTaxData?.taxPhone,
    customerTaxComment: this.customerTaxData?.taxComment,
  };


  this.http.post(
    `${API_URL}/appointments`,
    payload
  ).subscribe({
    next: () => {
      console.log('✅ CITA OK');

      this.selectedHour = null;
      this.isBooking = false;
      this.showMessage(
        'success',
        'Reserva realizada',
        'Tu cita fue registrada correctamente en Conecta.'
      );

      // 👇 navegar después
      setTimeout(() => {
        this.router.navigate(['/tabs/appointments'], {
          queryParams: { filter: 'upcoming' },
        });
      }, 800);
    },
    error: (err) => {
      console.error('❌ ERROR BACKEND:', err);

      // 🔥 MUY IMPORTANTE (esto te faltaba)
      this.isBooking = false;

      this.showMessage(
        'error',
        'No pudimos reservar',
        err?.error?.message || 'No fue posible completar la reserva. Intentalo nuevamente.'
      );
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

  this.selectedDocumentMode = 'MANUAL';
  this.ensureCustomerTaxDraft();
}

onDocumentModeChange(mode: 'NONE' | 'MANUAL' | 'AUTOMATED') {
  this.selectedDocumentMode = mode === 'NONE' ? 'NONE' : 'MANUAL';

  if (this.selectedDocumentMode === 'NONE') {
    this.customerTaxData = null;
    return;
  }

  this.ensureCustomerTaxDraft();
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
  if (this.selectedDocumentMode === 'MANUAL') {
    return 'Completa los datos para que el profesional pueda emitir el documento.';
  }

  return 'No se solicitara documento tributario para esta cita.';
}

canSubmitBooking(): boolean {
  if (this.selectedDocumentMode === 'NONE') return true;

  return !this.validateTaxPayload(this.customerTaxData || {});
}

getCustomerTaxValidationMessage(): string {
  if (this.selectedDocumentMode === 'NONE') return '';

  return this.validateTaxPayload(this.customerTaxData || {}) || 'Datos listos para enviar con la reserva.';
}

private ensureCustomerTaxDraft(): void {
  if (this.customerTaxData) return;

  const current = this.customerProfile || {};

  this.customerTaxData = {
    taxName: current.taxName || current.name || '',
    taxId: current.taxId || '',
    taxAddress: current.taxAddress || '',
    taxPhone: current.phone || '',
    taxComment: '',
  };
}

private cleanOptional(value: string): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

private validateTaxPayload(payload: {
  taxId?: string;
  taxName?: string;
  taxAddress?: string;
  taxPhone?: string;
  taxComment?: string;
}): string | null {
  const taxIdPattern = /^[a-zA-Z0-9.\-\s]{6,20}$/;
  const phonePattern = /^[+0-9\s().-]{6,30}$/;

  if (!payload.taxId || !taxIdPattern.test(payload.taxId)) {
    return 'El RUT / NIF / DNI debe tener entre 6 y 20 caracteres. Usa solo letras, numeros, puntos, guion o espacios.';
  }

  if (!payload.taxName || payload.taxName.length < 3 || payload.taxName.length > 120) {
    return 'El nombre tributario debe tener entre 3 y 120 caracteres.';
  }

  if (!payload.taxAddress || payload.taxAddress.length < 5 || payload.taxAddress.length > 160) {
    return 'La direccion debe tener entre 5 y 160 caracteres.';
  }

  if (!payload.taxPhone || !phonePattern.test(payload.taxPhone)) {
    return 'El telefono debe tener entre 6 y 30 caracteres y usar un formato valido.';
  }

  if (payload.taxComment && payload.taxComment.length > 300) {
    return 'El comentario debe tener maximo 300 caracteres.';
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

showMessage(type: ConectaMessageType, title: string, description: string): void {
  this.messageType = type;
  this.messageTitle = title;
  this.messageDescription = description;
  this.messageOpen = true;
  this.cdr.detectChanges();
}

closeMessage(): void {
  this.messageOpen = false;
  this.cdr.detectChanges();
}
}
