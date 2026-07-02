import { ChangeDetectorRef, Component, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, Observable } from 'rxjs';
import {
  DashboardTaxDocument,
  TaxDocument,
  TaxDocumentsService
} from '../../services/tax-documents.service';
import {
  AvailabilityPayload,
  ProfessionalProfile,
  ProfessionalProfileService,
  ScheduleMode,
  VideoProvider
} from '../../services/professional-profile.service';
import {
  ProfessionalAccess,
  ProfessionalAppointmentRequest,
  ProfessionalPlanPricing,
  ProfessionalStats,
  ProfessionalPlanService
} from '../../services/professional-plan.service';
import { API_URL } from '../../core/config/api.config';
import { environment } from '../../../environments/environment';

import {
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
  IonInput,
  IonTextarea,
  IonItem,
  IonLabel
} from '@ionic/angular/standalone';

type AgendaTime = {
  time: string;
};

type AgendaBlock = {
  start: string;
  end: string;
};

type AgendaDay = {
  day: string;
  code: string;
  enabled: boolean;
  scheduleMode: ScheduleMode;
  start: string;
  end: string;
  specificSlots: AgendaTime[];
  blockedRanges: AgendaBlock[];
};

type GoogleConnectionState = {
  connected: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
};

type ZoomConnectionState = {
  connected: boolean;
  zoomEmail: string | null;
  connectedAt: string | null;
};

type TeamsConnectionState = {
  connected: boolean;
  microsoftEmail: string | null;
  connectedAt: string | null;
};

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  templateUrl: './professional-dashboard.component.html',
  styleUrls: ['./professional-dashboard.component.scss'],
  imports: [
    CommonModule,
    FormsModule,

    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
})
export class ProfessionalDashboardComponent {
  loading = true;
  loaded = false;
  professionalAvatarPickerOpen = false;
  imageVersion = Date.now();
  selectedDocumentFiles: Record<string, File> = {};
  uploadingDocumentIds: Record<string, boolean> = {};
  documentActionIds: Record<string, boolean> = {};
  selectedDocumentFilter = 'ALL';
  scheduleMode = 'automatic';
  isSaving = false;
  publicProfileUrl = '';
  publicProfileMessage = '';
  planActionMessage = '';
  profileFeedbackMessage = '';
  profileFeedbackType: 'success' | 'error' | 'warning' = 'success';
  private profileFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  subscriptionActionRunning = false;
  statsLoading = false;
  planPricing: ProfessionalPlanPricing = {
    country: 'CL',
    amount: 10000,
    currency: 'CLP',
    label: '$10.000 CLP/mes',
  };
  googleConnection: GoogleConnectionState = {
    connected: false,
    googleEmail: null,
    connectedAt: null,
  };
  googleConnectionLoading = false;
  zoomConnection: ZoomConnectionState = {
    connected: false,
    zoomEmail: null,
    connectedAt: null,
  };
  zoomConnectionLoading = false;
  teamsConnection: TeamsConnectionState = {
    connected: false,
    microsoftEmail: null,
    connectedAt: null,
  };
  teamsConnectionLoading = false;
  requestActionIds: Record<string, boolean> = {};
  private professionalUserId = '';
  private dashboardRequestsPending = 0;
  documentFilters = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Pendientes', value: 'DOCUMENT_PENDING' },
    { label: 'Subidos', value: 'DOCUMENT_UPLOADED' },
    { label: 'Enviados', value: 'DOCUMENT_SENT' },
    { label: 'Fallidos', value: 'DOCUMENT_FAILED' },
  ];
  private readonly allowedTaxDocumentTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png'
  ];
  readonly professionalDefaultAvatars = [
    this.buildDefaultAvatar('#a855f7', '#ec4899'),
    this.buildDefaultAvatar('#7c3aed', '#38bdf8'),
    this.buildDefaultAvatar('#14b8a6', '#a855f7'),
    this.buildDefaultAvatar('#f97316', '#facc15'),
    this.buildDefaultAvatar('#2563eb', '#22c55e'),
  ];

  constructor(
    private professionalProfileService: ProfessionalProfileService,
    private taxDocumentsService: TaxDocumentsService,
    private professionalPlanService: ProfessionalPlanService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ionViewWillEnter() {
    this.loading = true;
    this.loaded = false;
    this.dashboardRequestsPending = 5;

    this.loadProfile();
    this.loadPendingTaxDocuments();
    this.loadTaxDocuments();
    this.loadProfessionalAccess();
    this.loadAppointmentRequests();
  }

  profile: ProfessionalProfile = {
    slug: '',
    name: '',
    specialty: '',
    description: '',
    price: 0,

    // duración real sesión
    duration: 90,

    // cada cuánto aparece una nueva hora
    interval: 15,

    rules: '',
    image: '',
    attentionMode: 'ONLINE',
    officeAddress: '',
    officeCity: '',
    officeRegion: '',
    officeCountry: '',
    officeLatitude: null as number | null,
    officeLongitude: null as number | null,
    arrivalInstructions: '',
    videoProvider: 'CONNECTA_AUTO',
    customVideoUrl: '',
    bankName: '',
    accountType: '',
    accountNumber: '',
    accountHolder: '',
    accountEmail: '',
    documentAutomationEnabled: false,
    manualDocumentMode: true,
    taxId: '',
    taxName: '',
    taxEmail: '',
    taxAddress: '',
    taxCountry: '',
    taxCity: ''
  };

  // 🔥 BLOQUES HORARIOS
  availability: AgendaDay[] = [

    {
      day: 'Lunes',
      code: 'MON',
      enabled: true,
      scheduleMode: 'CONTINUOUS',
      start: '09:00',
      end: '18:00',
      specificSlots: [],
      blockedRanges: [],
    },

    {
      day: 'Martes',
      code: 'TUE',
      enabled: true,
      scheduleMode: 'CONTINUOUS',
      start: '09:00',
      end: '18:00',
      specificSlots: [],
      blockedRanges: [],
    },

    {
      day: 'Miércoles',
      code: 'WED',
      enabled: false,
      scheduleMode: 'CONTINUOUS',
      start: '09:00',
      end: '18:00',
      specificSlots: [],
      blockedRanges: [],
    },

    {
      day: 'Jueves',
      code: 'THU',
      enabled: false,
      scheduleMode: 'CONTINUOUS',
      start: '09:00',
      end: '18:00',
      specificSlots: [],
      blockedRanges: [],
    },

    {
      day: 'Viernes',
      code: 'FRI',
      enabled: false,
      scheduleMode: 'CONTINUOUS',
      start: '09:00',
      end: '18:00',
      specificSlots: [],
      blockedRanges: [],
    }

  ];

  pendingTaxDocuments: DashboardTaxDocument[] = [];
  taxDocuments: DashboardTaxDocument[] = [];
  professionalAccess: ProfessionalAccess = {
    subscriptionStatus: 'TRIAL',
    canReceiveUnlimitedRequests: false,
    canManageRequests: false,
    canReplyMessages: false,
    canViewStats: false,
    canUsePremiumTools: false,
  };
  appointmentRequests: ProfessionalAppointmentRequest[] = [];
  professionalStats: ProfessionalStats = {
    profileViews: 0,
    profileShares: 0,
    linkCopies: 0,
    appointmentRequests: 0,
    acceptedRequests: 0,
    conversionRate: 0,
  };
  dashboardView = {
    pendingDocumentsCount: 0,
    sentDocumentsCount: 0,
    emittedThisMonthCount: 0,
    filteredTaxDocuments: [] as DashboardTaxDocument[],
  };

  get professionalCompletionItems(): string[] {
    const missing: string[] = [];

    if (!this.profile.image) {
      missing.push('Sube una foto profesional');
    }

    if (!this.profile.specialty) {
      missing.push('Agrega tu especialidad');
    }

    if (!this.profile.description || this.profile.description.trim().length < 30) {
      missing.push('Completa una descripcion clara');
    }

    if (!Number(this.profile.price)) {
      missing.push('Define precio de sesion');
    }

    if (!Number(this.profile.duration)) {
      missing.push('Define duracion de sesion');
    }

    if (
      ['PRESENTIAL', 'BOTH'].includes(this.profile.attentionMode) &&
      (!this.profile.officeAddress || !this.profile.officeCity || !this.profile.officeCountry)
    ) {
      missing.push('Completa direccion presencial');
    }

    if (
      this.profile.attentionMode !== 'PRESENTIAL' &&
      this.profile.videoProvider === 'CUSTOM' &&
      !this.profile.customVideoUrl
    ) {
      missing.push('Agrega enlace de videollamada');
    }

    if (!this.availability.some((item) => item.enabled)) {
      missing.push('Activa al menos un dia de agenda');
    }

    return missing;
  }

  get professionalCompletionPercent(): number {
    const total = 8;
    return Math.max(0, Math.round(((total - this.professionalCompletionItems.length) / total) * 100));
  }

  get shouldShowProfessionalCompletion(): boolean {
    return this.loaded && this.professionalCompletionItems.length > 0;
  }

  get isPlanActive(): boolean {
    return this.professionalAccess.subscriptionStatus === 'ACTIVE' &&
      this.professionalAccess.canManageRequests === true;
  }

  get isDevelopmentMode(): boolean {
    return environment.production === false;
  }

  isVideoProvider(provider: VideoProvider): boolean {
    return this.profile.videoProvider === provider;
  }

  setDocumentEmissionMode(mode: 'MANUAL' | 'AUTOMATED') {
    this.profile.documentAutomationEnabled = mode === 'AUTOMATED';
    this.profile.manualDocumentMode = mode === 'MANUAL';
  }

  get isProfessionalTaxReady(): boolean {
    return !!(
      this.profile.taxName?.trim() &&
      this.profile.taxId?.trim() &&
      this.profile.taxAddress?.trim() &&
      this.profile.taxCity?.trim() &&
      this.profile.taxCountry?.trim() &&
      this.profile.taxEmail?.trim()
    );
  }

  saveProfile() {
    const validationErrors = this.validateAgenda();

    if (validationErrors.length > 0) {
      this.showProfileFeedback(validationErrors[0], 'warning', 2200);
      return;
    }

    this.isSaving = true;

    const availabilityRequests = this.availability.map((item) => {
      if (!item.enabled) {
        return this.professionalProfileService.deleteAvailability(item.code);
      }

      return this.professionalProfileService.saveAvailability(
        this.toAvailabilityPayload(item)
      );
    });

    forkJoin([
      this.professionalProfileService.updateProfile({
        name: this.profile.name,
        image: this.profile.image,
        specialty: this.profile.specialty,
        description: this.profile.description,
        rules: this.profile.rules,
        price: Number(this.profile.price),
        duration: Number(this.profile.duration),
        attentionMode: this.profile.attentionMode,
        officeAddress: this.profile.officeAddress,
        officeCity: this.profile.officeCity,
        officeRegion: this.profile.officeRegion,
        officeCountry: this.profile.officeCountry,
        officeLatitude: this.profile.officeLatitude,
        officeLongitude: this.profile.officeLongitude,
        arrivalInstructions: this.profile.arrivalInstructions,
        videoProvider: this.profile.videoProvider,
        customVideoUrl: this.profile.customVideoUrl,
        bankName: this.profile.bankName,
        accountType: this.profile.accountType,
        accountNumber: this.profile.accountNumber,
        accountHolder: this.profile.accountHolder,
        accountEmail: this.profile.accountEmail,
        documentAutomationEnabled: this.profile.documentAutomationEnabled,
        manualDocumentMode: !this.profile.documentAutomationEnabled,
        taxId: this.profile.taxId,
        taxName: this.profile.taxName,
        taxEmail: this.profile.taxEmail,
        taxAddress: this.profile.taxAddress,
        taxCountry: this.profile.taxCountry,
        taxCity: this.profile.taxCity,
      }),
      ...availabilityRequests,
    ])
    .pipe(finalize(() => {
      this.isSaving = false;
    }))
    .subscribe({
      next: () => {
        this.showProfileFeedback('Perfil y agenda actualizados', 'success');
        this.loadProfile();
      },
      error: (err) => {
        console.error(err);
        this.showProfileFeedback(err?.error?.message || 'Error actualizando perfil', 'error', 2200);
      }
    });
  }

  private showProfileFeedback(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
    duration = 1000,
  ): void {
    this.profileFeedbackMessage = message;
    this.profileFeedbackType = type;

    if (this.profileFeedbackTimer) {
      clearTimeout(this.profileFeedbackTimer);
    }

    this.profileFeedbackTimer = setTimeout(() => {
      this.profileFeedbackMessage = '';
      this.profileFeedbackTimer = null;
      this.cdr.detectChanges();
    }, duration);
  }

  loadGoogleConnectionStatus(): void {
    this.googleConnectionLoading = true;

    this.http
      .get<{
        connected: boolean;
        googleEmail: string | null;
        connectedAt: string | null;
      }>(`${API_URL}/meetings/google/status`)
      .subscribe({
        next: (status) => {
          this.googleConnection = status;
        },
        error: () => {
          this.googleConnection = {
            connected: false,
            googleEmail: null,
            connectedAt: null,
          };
        },
        complete: () => {
          this.googleConnectionLoading = false;
        },
      });
  }

  loadZoomConnectionStatus(): void {
    this.zoomConnectionLoading = true;

    this.http
      .get<{
        connected: boolean;
        zoomEmail: string | null;
        connectedAt: string | null;
      }>(`${API_URL}/meetings/zoom/status`)
      .subscribe({
        next: (status) => {
          this.zoomConnection = status;
        },
        error: () => {
          this.zoomConnection = {
            connected: false,
            zoomEmail: null,
            connectedAt: null,
          };
        },
        complete: () => {
          this.zoomConnectionLoading = false;
        },
      });
  }

  loadTeamsConnectionStatus(): void {
    this.teamsConnectionLoading = true;

    this.http
      .get<{
        connected: boolean;
        microsoftEmail: string | null;
        connectedAt: string | null;
      }>(`${API_URL}/meetings/teams/status`)
      .subscribe({
        next: (status) => {
          this.teamsConnection = status;
        },
        error: () => {
          this.teamsConnection = {
            connected: false,
            microsoftEmail: null,
            connectedAt: null,
          };
        },
        complete: () => {
          this.teamsConnectionLoading = false;
        },
      });
  }

  connectGoogleAccount(): void {
    this.http
      .get<{ url: string }>(`${API_URL}/meetings/google/connect`)
      .subscribe({
        next: (response) => {
          window.location.href = response.url;
        },
        error: (err) => {
          alert(err?.error?.message || 'No se pudo iniciar conexion con Google');
        },
      });
  }

  disconnectGoogleAccount(): void {
    this.http
      .delete(`${API_URL}/meetings/google/disconnect`)
      .subscribe({
        next: () => {
          this.googleConnection = {
            connected: false,
            googleEmail: null,
            connectedAt: null,
          };
        },
        error: (err) => {
          alert(err?.error?.message || 'No se pudo desconectar Google');
        },
      });
  }

  connectZoomAccount(): void {
    this.http
      .get<{ url: string }>(`${API_URL}/meetings/zoom/connect`)
      .subscribe({
        next: (response) => {
          window.location.href = response.url;
        },
        error: (err) => {
          alert(err?.error?.message || 'No se pudo iniciar conexion con Zoom');
        },
      });
  }

  disconnectZoomAccount(): void {
    this.http
      .delete(`${API_URL}/meetings/zoom/disconnect`)
      .subscribe({
        next: () => {
          this.zoomConnection = {
            connected: false,
            zoomEmail: null,
            connectedAt: null,
          };
        },
        error: (err) => {
          alert(err?.error?.message || 'No se pudo desconectar Zoom');
        },
      });
  }

  connectTeamsAccount(): void {
    this.http
      .get<{ url: string }>(`${API_URL}/meetings/teams/connect`)
      .subscribe({
        next: (response) => {
          window.location.href = response.url;
        },
        error: (err) => {
          alert(err?.error?.message || 'No se pudo iniciar conexion con Microsoft');
        },
      });
  }

  disconnectTeamsAccount(): void {
    this.http
      .delete(`${API_URL}/meetings/teams/disconnect`)
      .subscribe({
        next: () => {
          this.teamsConnection = {
            connected: false,
            microsoftEmail: null,
            connectedAt: null,
          };
        },
        error: (err) => {
          alert(err?.error?.message || 'No se pudo desconectar Microsoft');
        },
      });
  }

async onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Selecciona una imagen valida.');
    input.value = '';
    return;
  }

  try {
    const image = await this.prepareProfileImage(file);
    this.profile = {
      ...this.profile,
      image
    };
    this.imageVersion = Date.now();
    this.closeProfessionalAvatarPicker();
    this.cdr.detectChanges();
  } catch (error) {
    console.error(error);
    alert('No se pudo cargar la imagen. Intenta con otra foto.');
  } finally {
    input.value = '';
  }
}

selectProfessionalAvatar(avatar: string) {
  this.profile = {
    ...this.profile,
    image: avatar
  };
  this.closeProfessionalAvatarPicker();
}

clearProfessionalImage() {
  this.profile = {
    ...this.profile,
    image: ''
  };
  this.closeProfessionalAvatarPicker();
}

openProfessionalAvatarPicker(): void {
  this.professionalAvatarPickerOpen = true;
}

closeProfessionalAvatarPicker(): void {
  this.professionalAvatarPickerOpen = false;
}

private buildDefaultAvatar(primary: string, secondary: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
          <stop stop-color="${primary}" />
          <stop offset="1" stop-color="${secondary}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="46" fill="#fff" />
      <circle cx="80" cy="66" r="26" fill="url(#g)" />
      <path d="M34 136c7-28 25-43 46-43s39 15 46 43" fill="url(#g)" />
      <rect x="3" y="3" width="154" height="154" rx="43" fill="none" stroke="url(#g)" stroke-width="6" />
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

private prepareProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));

    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));

      img.onload = () => {
        const maxSide = 640;
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo preparar la imagen.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length > 180_000 && quality > 0.42) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };

      img.src = String(reader.result || '');
    };

    reader.readAsDataURL(file);
  });
}

  loadProfile() {

    this.professionalProfileService.getProfile().subscribe({
      next: (res) => {

      console.log('PROFILE:', res);
      this.professionalUserId = res.id;
      this.ensureAgendaDefaults();

      this.profile = {
        name: res.professional?.name || '',
        slug: res.professional?.slug || '',
        specialty: res.professional?.specialty || '',
        description: res.professional?.description || '',
        price: res.professional?.price || 0,
        duration: res.professional?.duration || 90,
        interval: res.professional?.interval || 15,
        rules: res.professional?.rules || '',
        image: res.professional?.image || '',
        attentionMode: res.professional?.attentionMode || 'ONLINE',
        officeAddress: res.professional?.officeAddress || '',
        officeCity: res.professional?.officeCity || '',
        officeRegion: res.professional?.officeRegion || '',
        officeCountry: res.professional?.officeCountry || '',
        officeLatitude: res.professional?.officeLatitude ?? null,
        officeLongitude: res.professional?.officeLongitude ?? null,
        arrivalInstructions: res.professional?.arrivalInstructions || '',
        videoProvider: this.normalizeVideoProvider(res.professional?.videoProvider),
        customVideoUrl: res.professional?.customVideoUrl || '',
        bankName: res.professional?.bankName || '',
        accountType: res.professional?.accountType || '',
        accountNumber: res.professional?.accountNumber || '',
        accountHolder: res.professional?.accountHolder || '',
        accountEmail: res.professional?.accountEmail || '',
        documentAutomationEnabled: res.professional?.documentAutomationEnabled === true,
        manualDocumentMode: res.professional?.manualDocumentMode !== false,
        taxId: res.professional?.taxId || '',
        taxName: res.professional?.taxName || '',
        taxEmail: res.professional?.taxEmail || '',
        taxAddress: res.professional?.taxAddress || '',
        taxCountry: res.professional?.taxCountry || res.professional?.officeCountry || '',
        taxCity: res.professional?.taxCity || ''
      };
      this.publicProfileUrl = this.buildPublicProfileUrl(this.profile.slug || '');
      this.loadPlanPricing(this.profile.officeCountry || 'CL');
      this.loadGoogleConnectionStatus();
      this.loadZoomConnectionStatus();
      this.loadTeamsConnectionStatus();

      this.loadAvailability(() => this.finishDashboardRequest());

    },
      error: (err) => {
        console.error('Error cargando perfil:', err);
        this.finishDashboardRequest();
      }
    });

  }

  private normalizeVideoProvider(provider?: string | null): VideoProvider {
    if (
      provider === 'GOOGLE_MEET' ||
      provider === 'ZOOM' ||
      provider === 'MICROSOFT_TEAMS' ||
      provider === 'CUSTOM'
    ) {
      return provider;
    }

    return 'CONNECTA_AUTO';
  }

  loadAvailability(onDone?: () => void): void {
    if (!this.professionalUserId) {
      onDone?.();
      return;
    }

    this.professionalProfileService
      .getAvailability(this.professionalUserId)
      .subscribe({
        next: (items) => {
          this.ensureAgendaDefaults();

          for (const item of this.availability) {
            item.enabled = false;
          }

          for (const item of items) {
            const agendaDay = this.availability.find(
              (day) => day.code === item.day
            );

            if (!agendaDay) continue;

            agendaDay.enabled = true;
            agendaDay.scheduleMode = item.scheduleMode || 'CONTINUOUS';
            agendaDay.start = this.minutesToTime(item.startMinute ?? 540);
            agendaDay.end = this.minutesToTime(item.endMinute ?? 1080);
            agendaDay.specificSlots = Array.isArray(item.specificSlots)
              ? item.specificSlots.map((minute: number) => ({
                time: this.minutesToTime(minute),
              }))
              : [];
            agendaDay.blockedRanges = Array.isArray(item.blockedRanges)
              ? item.blockedRanges.map((range) => ({
                start: this.minutesToTime(range.startMinute),
                end: this.minutesToTime(range.endMinute),
              }))
              : [];

            if (Number.isInteger(item.breakMinute)) {
              this.profile.interval = Number(item.breakMinute);
            }
          }
        },
        error: (err) => {
          console.error('Error cargando disponibilidad:', err);
          onDone?.();
        },
        complete: () => {
          onDone?.();
        }
      });
  }

  ensureAgendaDefaults(): void {
    const defaults = [
      this.createAgendaDay('Lunes', 'MON', true),
      this.createAgendaDay('Martes', 'TUE', true),
      this.createAgendaDay('Miercoles', 'WED', false),
      this.createAgendaDay('Jueves', 'THU', false),
      this.createAgendaDay('Viernes', 'FRI', false),
      this.createAgendaDay('Sabado', 'SAT', false),
      this.createAgendaDay('Domingo', 'SUN', false),
    ];

    this.availability = defaults.map((defaultDay) => {
      const current = this.availability.find((item) =>
        item.code === defaultDay.code || item.day === defaultDay.day
      );

      return {
        ...defaultDay,
        ...current,
        code: current?.code || defaultDay.code,
        scheduleMode: current?.scheduleMode || 'CONTINUOUS',
        specificSlots: current?.specificSlots || [],
        blockedRanges: current?.blockedRanges || [],
      };
    });
  }

  createAgendaDay(day: string, code: string, enabled: boolean): AgendaDay {
    return {
      day,
      code,
      enabled,
      scheduleMode: 'CONTINUOUS',
      start: '09:00',
      end: '18:00',
      specificSlots: [],
      blockedRanges: [],
    };
  }

  addBlockedRange(item: AgendaDay): void {
    const start = this.timeToMinutes(item.start);
    const end = Math.min(start + Number(this.profile.duration || 60), 1440);

    item.blockedRanges.push({
      start: item.start,
      end: this.minutesToTime(end),
    });
  }

  removeBlockedRange(item: AgendaDay, index: number): void {
    item.blockedRanges.splice(index, 1);
  }

  addSpecificSlot(item: AgendaDay): void {
    item.specificSlots.push({ time: '' });
  }

  removeSpecificSlot(item: AgendaDay, index: number): void {
    item.specificSlots.splice(index, 1);
    this.sortSpecificSlots(item);
  }

  sortSpecificSlots(item: AgendaDay): void {
    item.specificSlots = item.specificSlots
      .filter((slot) => slot.time)
      .sort((a, b) => this.timeToMinutes(a.time) - this.timeToMinutes(b.time));
  }

  toAvailabilityPayload(item: AgendaDay): AvailabilityPayload {
    const specificSlots = item.specificSlots
      .map((slot) => this.timeToMinutes(slot.time))
      .sort((a, b) => a - b);

    const blockedRanges = item.blockedRanges
      .map((range) => ({
        startMinute: this.timeToMinutes(range.start),
        endMinute: this.timeToMinutes(range.end),
      }))
      .sort((a, b) => a.startMinute - b.startMinute);

    return {
      day: item.code,
      scheduleMode: item.scheduleMode,
      startMinute: item.scheduleMode === 'SPECIFIC'
        ? 0
        : this.timeToMinutes(item.start),
      endMinute: item.scheduleMode === 'SPECIFIC'
        ? 1440
        : this.timeToMinutes(item.end),
      breakMinute: Number(this.profile.interval) || 0,
      specificSlots,
      blockedRanges,
    };
  }

  validateAgenda(): string[] {
    const errors: string[] = [];
    const duration = Number(this.profile.duration);
    const breakMinute = Number(this.profile.interval);

    if (!Number.isInteger(duration) || duration < 15 || duration > 240) {
      errors.push('La duracion de sesion debe estar entre 15 y 240 minutos.');
    }

    if (!Number.isInteger(breakMinute) || breakMinute < 0 || breakMinute > 240) {
      errors.push('El descanso debe estar entre 0 y 240 minutos.');
    }

    if (
      ['PRESENTIAL', 'BOTH'].includes(this.profile.attentionMode) &&
      (!this.profile.officeAddress || !this.profile.officeCity || !this.profile.officeCountry)
    ) {
      errors.push('Para atencion presencial debes indicar direccion, ciudad y pais.');
    }

    if (['PRESENTIAL', 'BOTH'].includes(this.profile.attentionMode)) {
      const address = this.normalizeText(this.profile.officeAddress);
      const city = this.normalizeText(this.profile.officeCity);
      const region = this.normalizeText(this.profile.officeRegion);
      const country = this.normalizeText(this.profile.officeCountry);
      const instructions = this.normalizeText(this.profile.arrivalInstructions);

      if (address && (address.length < 8 || address.length > 140)) {
        errors.push('La direccion debe tener entre 8 y 140 caracteres.');
      }

      if (city && (city.length < 2 || city.length > 60)) {
        errors.push('La ciudad debe tener entre 2 y 60 caracteres.');
      }

      if (region.length > 60) {
        errors.push('La region debe tener maximo 60 caracteres.');
      }

      if (country && (country.length < 2 || country.length > 40)) {
        errors.push('El pais debe tener entre 2 y 40 caracteres.');
      }

      if (instructions.length > 300) {
        errors.push('Las instrucciones de llegada deben tener maximo 300 caracteres.');
      }

      if (this.containsDirectContact([address, city, region, country, instructions].join(' '))) {
        errors.push('No incluyas telefono, correo, enlaces ni redes sociales en la direccion presencial.');
      }
    }

    if (
      this.profile.attentionMode !== 'PRESENTIAL' &&
      this.profile.videoProvider === 'CUSTOM' &&
      !this.profile.customVideoUrl
    ) {
      errors.push('Para enlace propio debes indicar el enlace de videollamada.');
    }

    if (this.profile.documentAutomationEnabled && !this.isProfessionalTaxReady) {
      errors.push('Completa tus datos tributarios para activar la emision automatica.');
    }

    for (const item of this.availability as AgendaDay[]) {
      if (!item.enabled) continue;

      if (item.scheduleMode === 'CONTINUOUS') {
        const start = this.timeToMinutes(item.start);
        const end = this.timeToMinutes(item.end);

        if (start >= end) {
          errors.push(`${item.day}: la hora de inicio debe ser menor al termino.`);
        }

        const ranges = item.blockedRanges
          .map((range) => ({
            startMinute: this.timeToMinutes(range.start),
            endMinute: this.timeToMinutes(range.end),
          }))
          .sort((a, b) => a.startMinute - b.startMinute);

        for (const range of ranges) {
          if (range.startMinute >= range.endMinute) {
            errors.push(`${item.day}: hay un bloqueo con rango invalido.`);
          }

          if (range.startMinute < start || range.endMinute > end) {
            errors.push(`${item.day}: hay bloqueos fuera del rango definido.`);
          }
        }

        for (let i = 1; i < ranges.length; i += 1) {
          if (ranges[i].startMinute < ranges[i - 1].endMinute) {
            errors.push(`${item.day}: los bloqueos no pueden solaparse.`);
          }
        }
      }

      if (item.scheduleMode === 'SPECIFIC') {
        const slots = item.specificSlots.map((slot) => slot.time);

        if (slots.length === 0 || slots.some((slot) => !this.isValidTime(slot))) {
          errors.push(`${item.day}: agrega al menos un horario especifico valido.`);
        }

        if (new Set(slots).size !== slots.length) {
          errors.push(`${item.day}: no se permiten horarios duplicados.`);
        }
      }
    }

    return errors;
  }

  private normalizeText(value?: string | null): string {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  private containsDirectContact(value: string): boolean {
    const text = this.normalizeText(value).toLowerCase();

    if (!text) return false;

    const patterns = [
      /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
      /(https?:\/\/|www\.|[a-z0-9-]+\.(com|cl|es|net|org))/i,
      /(\+?\d[\d\s().-]{7,}\d)/,
      /(@[a-z0-9._-]{3,})/i,
      /(whatsapp|instagram|facebook|linkedin|telegram|wa\.me|t\.me)/i,
    ];

    return patterns.some((pattern) => pattern.test(text));
  }

  isValidTime(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
  }

  timeToMinutes(value: string): number {
    if (!this.isValidTime(value)) return -1;

    const [hour, minute] = value.split(':').map(Number);

    return hour * 60 + minute;
  }

  minutesToTime(value: number): string {
    const safeValue = Math.max(0, Math.min(1439, Number(value) || 0));
    const hour = Math.floor(safeValue / 60).toString().padStart(2, '0');
    const minute = (safeValue % 60).toString().padStart(2, '0');

    return `${hour}:${minute}`;
  }

  loadPendingTaxDocuments(): void {
    this.taxDocumentsService.getPendingDocuments().subscribe({
      next: (documents) => {
        this.pendingTaxDocuments = documents.map((document) =>
          this.prepareDocumentView(document)
        );
        this.updateDashboardView();
      },
      error: (err) => {
        console.error('Error cargando documentos pendientes:', err);
        this.pendingTaxDocuments = [];
        this.finishDashboardRequest();
      },
      complete: () => {
        this.finishDashboardRequest();
      }
    });
  }

  loadTaxDocuments(): void {
    this.taxDocumentsService.getProfessionalDocuments().subscribe({
      next: (documents) => {
        this.taxDocuments = documents.map((document) =>
          this.prepareDocumentView(document)
        );
        this.updateDashboardView();
      },
      error: (err) => {
        console.error('Error cargando documentos tributarios:', err);
        this.taxDocuments = [];
        this.finishDashboardRequest();
      },
      complete: () => {
        this.finishDashboardRequest();
      }
    });
  }

  loadProfessionalAccess(): void {
    this.professionalPlanService.getAccess().subscribe({
      next: (access) => {
        this.professionalAccess = access;
        if (access.canViewStats) {
          this.loadProfessionalStats();
        } else {
          this.resetProfessionalStats();
        }
      },
      error: (err) => {
        console.error('Error cargando plan profesional:', err);
        this.resetProfessionalStats();
        this.finishDashboardRequest();
      },
      complete: () => {
        this.finishDashboardRequest();
      }
    });
  }

  loadAppointmentRequests(): void {
    this.professionalPlanService.getAppointmentRequests().subscribe({
      next: (requests) => {
        this.appointmentRequests = Array.isArray(requests) ? requests : [];
      },
      error: (err) => {
        console.error('Error cargando solicitudes de pacientes:', err);
        this.appointmentRequests = [];
        this.finishDashboardRequest();
      },
      complete: () => {
        this.finishDashboardRequest();
      }
    });
  }

  showPlanComingSoon(): void {
    this.planActionMessage = 'Proximamente podras activar tu plan desde la app. Por ahora esta funcion esta en preparacion.';
    alert(this.planActionMessage);
  }

  loadPlanPricing(country?: string | null): void {
    this.professionalPlanService.getPricing(country || 'CL').subscribe({
      next: (pricing) => {
        this.planPricing = pricing;
      },
      error: (err) => {
        console.error('Error cargando precio del plan:', err);
      }
    });
  }

  activatePlanManualDemo(): void {
    if (!this.isDevelopmentMode || this.subscriptionActionRunning) return;

    this.subscriptionActionRunning = true;
    this.professionalPlanService.activateManual().subscribe({
      next: () => {
        this.planActionMessage = 'Plan activado manualmente para demo.';
        this.refreshPlanAndRequests();
      },
      error: (err) => {
        console.error('Error activando plan manual:', err);
        alert(err?.error?.message || 'No se pudo activar el plan manualmente');
      },
      complete: () => {
        this.subscriptionActionRunning = false;
      }
    });
  }

  deactivatePlanManualDemo(): void {
    if (!this.isDevelopmentMode || this.subscriptionActionRunning) return;

    this.subscriptionActionRunning = true;
    this.professionalPlanService.deactivateManual().subscribe({
      next: () => {
        this.planActionMessage = 'Plan cancelado manualmente para demo.';
        this.refreshPlanAndRequests();
      },
      error: (err) => {
        console.error('Error cancelando plan manual:', err);
        alert(err?.error?.message || 'No se pudo cancelar el plan manualmente');
      },
      complete: () => {
        this.subscriptionActionRunning = false;
      }
    });
  }

  refreshPlanAndRequests(): void {
    this.professionalPlanService.getAccess().subscribe({
      next: (access) => {
        this.professionalAccess = access;
        if (access.canViewStats) {
          this.loadProfessionalStats();
        } else {
          this.resetProfessionalStats();
        }
      },
      error: (err) => console.error('Error refrescando plan:', err),
    });

    this.professionalPlanService.getAppointmentRequests().subscribe({
      next: (requests) => {
        this.appointmentRequests = Array.isArray(requests) ? requests : [];
      },
      error: (err) => console.error('Error refrescando solicitudes:', err),
    });
  }

  loadProfessionalStats(): void {
    this.statsLoading = true;

    this.professionalPlanService.getStats().subscribe({
      next: (stats) => {
        this.professionalStats = stats;
      },
      error: (err) => {
        console.error('Error cargando estadisticas:', err);
        this.resetProfessionalStats();
      },
      complete: () => {
        this.statsLoading = false;
      }
    });
  }

  resetProfessionalStats(): void {
    this.statsLoading = false;
    this.professionalStats = {
      profileViews: 0,
      profileShares: 0,
      linkCopies: 0,
      appointmentRequests: 0,
      acceptedRequests: 0,
      conversionRate: 0,
    };
  }

  acceptAppointmentRequest(request: ProfessionalAppointmentRequest): void {
    if (!this.canManageRequest(request) || this.requestActionIds[request.id]) return;

    this.requestActionIds[request.id] = true;

    this.professionalPlanService.acceptRequest(request.id).subscribe({
      next: () => {
        this.loadAppointmentRequests();
      },
      error: (err) => {
        console.error('Error aceptando solicitud:', err);
        alert(err?.error?.message || 'No se pudo aceptar la solicitud');
      },
      complete: () => {
        this.requestActionIds[request.id] = false;
      }
    });
  }

  rejectAppointmentRequest(request: ProfessionalAppointmentRequest): void {
    if (!this.canManageRequest(request) || this.requestActionIds[request.id]) return;

    this.requestActionIds[request.id] = true;

    this.professionalPlanService.rejectRequest(request.id).subscribe({
      next: () => {
        this.loadAppointmentRequests();
      },
      error: (err) => {
        console.error('Error rechazando solicitud:', err);
        alert(err?.error?.message || 'No se pudo rechazar la solicitud');
      },
      complete: () => {
        this.requestActionIds[request.id] = false;
      }
    });
  }

  canManageRequest(request: ProfessionalAppointmentRequest): boolean {
    return this.professionalAccess.canManageRequests === true &&
      request.locked !== true &&
      request.status === 'PENDING';
  }

  isRequestActionRunning(requestId: string): boolean {
    return this.requestActionIds[requestId] === true;
  }

  getPlanStatusLabel(): string {
    const labels: Record<string, string> = {
      TRIAL: 'Gratis / Trial',
      ACTIVE: 'Activo',
      PAST_DUE: 'Vencido',
      CANCELLED: 'Cancelado',
      EXPIRED: 'Vencido',
    };

    return labels[this.professionalAccess.subscriptionStatus] || 'Gratis / Trial';
  }

  getPlanBadgeLabel(): string {
    return this.isPlanActive ? 'Plan activo' : 'Plan gratis';
  }

  getPlanEndDateLabel(): string {
    const value = this.professionalAccess.currentPeriodEnd;

    if (!value) return '';

    return new Date(value).toLocaleDateString('es-CL');
  }

  getRequestStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente',
      LOCKED_PENDING_SUBSCRIPTION: 'Solicitud bloqueada',
      ACCEPTED: 'Aceptada',
      REJECTED: 'Rechazada',
      EXPIRED: 'Vencida',
      CANCELLED: 'Cancelada',
    };

    return labels[status] || status;
  }

  getRequestModeLabel(mode?: string | null): string {
    if (mode === 'PRESENTIAL') return 'Presencial';
    if (mode === 'BOTH') return 'Online o presencial';
    return 'Online';
  }

  finishDashboardRequest(): void {
    this.dashboardRequestsPending = Math.max(0, this.dashboardRequestsPending - 1);

    if (this.dashboardRequestsPending === 0) {
      this.loading = false;
      this.loaded = true;
      this.cdr.detectChanges();
    }
  }

  get filteredTaxDocuments(): DashboardTaxDocument[] {
    if (this.selectedDocumentFilter === 'ALL') {
      return this.taxDocuments;
    }

    return this.taxDocuments.filter(
      (document) => document.status === this.selectedDocumentFilter
    );
  }

  get pendingDocumentsCount(): number {
    return this.taxDocuments.filter(
      (document) => document.status === 'DOCUMENT_PENDING'
    ).length;
  }

  get sentDocumentsCount(): number {
    return this.taxDocuments.filter(
      (document) => document.status === 'DOCUMENT_SENT'
    ).length;
  }

  get emittedThisMonthCount(): number {
    const now = new Date();

    return this.taxDocuments.filter((document) => {
      const dateValue = document.generatedAt || document.uploadedAt || document.sentAt;

      if (!dateValue) return false;

      const date = new Date(dateValue);

      return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
    }).length;
  }

  setDocumentFilter(filter: string): void {
    this.selectedDocumentFilter = filter;
    this.updateDashboardView();
  }

  updateDashboardView(): void {
    const filteredTaxDocuments = this.selectedDocumentFilter === 'ALL'
      ? this.taxDocuments
      : this.taxDocuments.filter(
        (document) => document.status === this.selectedDocumentFilter
      );

    this.dashboardView = {
      pendingDocumentsCount: this.pendingDocumentsCount,
      sentDocumentsCount: this.sentDocumentsCount,
      emittedThisMonthCount: this.emittedThisMonthCount,
      filteredTaxDocuments,
    };
  }

  prepareDocumentView(document: DashboardTaxDocument): DashboardTaxDocument {
    return {
      ...document,
      view: {
        customerName: this.getDocumentCustomerName(document),
        appointmentDate: this.getDocumentAppointmentDate(document),
        issueDate: this.getDocumentIssueDate(document),
        sentDate: this.getDocumentSentDate(document),
        statusLabel: this.getDocumentStatusLabel(document.status),
        typeLabel: this.getDocumentTypeLabel(document.type),
      },
    };
  }

  onTaxDocumentFileSelected(documentId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    if (!this.allowedTaxDocumentTypes.includes(file.type)) {
      input.value = '';
      delete this.selectedDocumentFiles[documentId];
      alert('Solo puedes subir PDF, JPG, JPEG o PNG');
      return;
    }

    this.selectedDocumentFiles[documentId] = file;
  }

  getSelectedDocumentFileName(documentId: string): string {
    return this.selectedDocumentFiles[documentId]?.name || '';
  }

  uploadTaxDocument(documentId: string): void {
    const file = this.selectedDocumentFiles[documentId];

    if (!file || this.uploadingDocumentIds[documentId]) return;

    this.uploadingDocumentIds[documentId] = true;

    this.taxDocumentsService.uploadDocument(documentId, file).subscribe({
      next: () => {
        delete this.selectedDocumentFiles[documentId];
        this.loadPendingTaxDocuments();
        this.loadTaxDocuments();
      },
      error: (err) => {
        console.error('Error subiendo documento tributario:', err);
        this.uploadingDocumentIds[documentId] = false;
        alert('No se pudo subir el documento');
      },
      complete: () => {
        this.uploadingDocumentIds[documentId] = false;
      }
    });
  }

  markDocumentGenerated(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.markGenerated(documentId),
      'No se pudo marcar como generado'
    );
  }

  markDocumentSent(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.markSent(documentId),
      'No se pudo marcar como enviado'
    );
  }

  resendDocumentEmail(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.resendEmail(documentId),
      'No se pudo reenviar el correo'
    );
  }

  issueLibreDteDocument(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.issueLibreDte(documentId),
      'No se pudo emitir con LibreDTE'
    );
  }

  syncProviderStatus(documentId: string): void {
    this.runDocumentAction(
      documentId,
      () => this.taxDocumentsService.syncProviderStatus(documentId),
      'No se pudo sincronizar el estado'
    );
  }

  runDocumentAction(
    documentId: string,
    action: () => Observable<TaxDocument>,
    errorMessage: string
  ): void {
    if (this.documentActionIds[documentId]) return;

    this.documentActionIds[documentId] = true;

    action().subscribe({
      next: () => {
        this.loadPendingTaxDocuments();
        this.loadTaxDocuments();
      },
      error: (err: unknown) => {
        console.error(errorMessage, err);
        this.documentActionIds[documentId] = false;
        alert(errorMessage);
      },
      complete: () => {
        this.documentActionIds[documentId] = false;
      }
    });
  }

  isDocumentActionRunning(documentId: string): boolean {
    return this.documentActionIds[documentId] === true;
  }

  isUploadingDocument(documentId: string): boolean {
    return this.uploadingDocumentIds[documentId] === true;
  }

  openDocument(document: DashboardTaxDocument): void {
    if (!document.pdfUrl) return;

    const url = document.pdfUrl.startsWith('http')
      ? document.pdfUrl
      : `${API_URL}${document.pdfUrl}`;

    window.open(url, '_blank', 'noopener');
  }

  openDocumentXml(document: DashboardTaxDocument): void {
    if (!document.xmlUrl) return;

    const url = document.xmlUrl.startsWith('http')
      ? document.xmlUrl
      : `${API_URL}${document.xmlUrl}`;

    window.open(url, '_blank', 'noopener');
  }

  getDocumentCustomerName(document: DashboardTaxDocument): string {
    return document?.customer?.name ||
      document?.customer?.email ||
      document?.appointment?.customer?.name ||
      document?.appointment?.customer?.email ||
      'Cliente';
  }

  getDocumentAppointmentDate(document: DashboardTaxDocument): string | null {
    return document?.appointmentDate || document?.appointment?.date || null;
  }

  getDocumentIssueDate(document: DashboardTaxDocument): string | null {
    return document?.generatedAt || document?.uploadedAt || document?.createdAt || null;
  }

  getDocumentSentDate(document: DashboardTaxDocument): string | null {
    return document?.sentAt || document?.emailSentAt || null;
  }

  getDocumentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DOCUMENT_PENDING: 'Pendiente',
      DOCUMENT_UPLOADED: 'Documento cargado',
      DOCUMENT_GENERATED: 'Generado',
      DOCUMENT_SENT: 'Enviado',
      DOCUMENT_FAILED: 'Falló',
      DOCUMENT_NOT_REQUIRED: 'No requerido',
    };

    return labels[status] || status || 'Sin estado';
  }

  getDocumentTypeLabel(type?: string): string {
    const labels: Record<string, string> = {
      BOLETA: 'Boleta',
      FACTURA: 'Factura',
      INVOICE: 'Invoice',
      RECEIPT: 'Recibo',
    };

    return type ? labels[type] || type : 'Documento';
  }

  scrollToProfessionalProfile(): void {
    document
      .getElementById('professional-profile-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async copyPublicProfileLink(): Promise<void> {
    if (!this.publicProfileUrl || !this.profile.slug) return;

    await this.copyToClipboard(this.publicProfileUrl);
    this.publicProfileMessage = 'Enlace copiado correctamente';
    this.recordProfileEvent('COPY_LINK');
  }

  async sharePublicProfile(): Promise<void> {
    if (!this.publicProfileUrl || !this.profile.slug) return;

    const shareData = {
      title: 'Mi perfil en Conecta',
      text: 'Reserva una cita conmigo en Conecta.',
      url: this.publicProfileUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        this.publicProfileMessage = 'Perfil compartido correctamente';
        this.recordProfileEvent('SHARE');
        return;
      }
    } catch (error) {
      console.warn('No se pudo compartir el perfil:', error);
      return;
    }

    await this.copyToClipboard(this.publicProfileUrl);
    this.publicProfileMessage = 'Enlace copiado correctamente';
    this.recordProfileEvent('COPY_LINK');
  }

  private buildPublicProfileUrl(slug: string): string {
    if (!slug) return '';

    return `https://conecta.app/profesional/${this.getReadablePublicSlug(slug)}`;
  }

  private getReadablePublicSlug(slug: string): string {
    const cleanNameSlug = this.toPublicSlug(this.profile.name || '');

    if (!cleanNameSlug || !slug.startsWith(`${cleanNameSlug}-`)) {
      return slug;
    }

    const suffix = slug.replace(`${cleanNameSlug}-`, '');

    return /^[a-z0-9]{6,}$/.test(suffix) ? cleanNameSlug : slug;
  }

  private toPublicSlug(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 70);
  }

  private async copyToClipboard(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  private recordProfileEvent(type: 'COPY_LINK' | 'SHARE'): void {
    if (!this.profile.slug) return;

    this.http.post(
      `${API_URL}/users/professionals/public/${this.profile.slug}/events`,
      { type }
    ).subscribe({
      error: (err) => console.warn('No se pudo registrar evento de perfil:', err),
    });
  }
  

}
