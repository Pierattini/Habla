import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  TaxDocumentsService
} from '../../services/tax-documents.service';
import {
  AvailabilityPayload,
  ProfessionalProfileService,
  ScheduleMode
} from '../../services/professional-profile.service';
import { API_URL } from '../../core/config/api.config';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
  IonButton,
  IonInput,
  IonTextarea,
  IonItem,
  IonLabel,
  IonIcon
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';

import {
  imageOutline
} from 'ionicons/icons';

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

@Component({
  selector: 'app-professional-dashboard',
  standalone: true,
  templateUrl: './professional-dashboard.component.html',
  styleUrls: ['./professional-dashboard.component.scss'],
  imports: [
    CommonModule,
    FormsModule,

    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardContent,
    IonButton,
    IonInput,
    IonTextarea,
    IonItem,
    IonLabel,
    IonIcon
  ]
})
export class ProfessionalDashboardComponent {
  loading = true;
  loaded = false;
  imageVersion = Date.now();
  selectedDocumentFiles: Record<string, File> = {};
  uploadingDocumentIds: Record<string, boolean> = {};
  documentActionIds: Record<string, boolean> = {};
  selectedDocumentFilter = 'ALL';
  scheduleMode = 'automatic';
  isSaving = false;
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

  constructor(
    private professionalProfileService: ProfessionalProfileService,
    private taxDocumentsService: TaxDocumentsService
  ) {

    addIcons({
      'image-outline': imageOutline
    });

  }

  ionViewWillEnter() {
    this.loading = true;
    this.loaded = false;
    this.dashboardRequestsPending = 3;

    this.loadProfile();
    this.loadPendingTaxDocuments();
    this.loadTaxDocuments();
  }

  profile = {
    name: '',
    specialty: '',
    description: '',
    price: 0,

    // duración real sesión
    duration: 90,

    // cada cuánto aparece una nueva hora
    interval: 15,

    rules: '',
    image: ''
  };

  // 🔥 BLOQUES HORARIOS
  availability: any[] = [

    {
      day: 'Lunes',
      enabled: true,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Martes',
      enabled: true,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Miércoles',
      enabled: false,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Jueves',
      enabled: false,
      start: '09:00',
      end: '18:00'
    },

    {
      day: 'Viernes',
      enabled: false,
      start: '09:00',
      end: '18:00'
    }

  ];

  pendingTaxDocuments: any[] = [];
  taxDocuments: any[] = [];
  dashboardView = {
    pendingDocumentsCount: 0,
    sentDocumentsCount: 0,
    emittedThisMonthCount: 0,
    filteredTaxDocuments: [] as any[],
  };

  saveProfile() {
    const validationErrors = this.validateAgenda();

    if (validationErrors.length > 0) {
      alert(validationErrors[0]);
      return;
    }

    this.isSaving = true;

    const availabilityRequests = this.availability.map((item: any) => {
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
        price: Number(this.profile.price),
        duration: Number(this.profile.duration),
      }),
      ...availabilityRequests,
    ]).subscribe({
      next: () => {
        alert('Perfil y agenda actualizados');
        this.loadProfile();
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Error actualizando perfil');
      },
      complete: () => {
        this.isSaving = false;
      }
    });
  }
onFileSelected(event: any) {

  console.log('INPUT OK');

  const file = event.target.files[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = (e: any) => {

    console.log('IMAGEN CARGADA');

    this.profile = {
      ...this.profile,
      image: e.target.result
    };
    //this.imageVersion = Date.now();
  };

  reader.readAsDataURL(file);

  }
  loadProfile() {

    this.professionalProfileService.getProfile().subscribe({
      next: (res: any) => {

      console.log('PROFILE:', res);
      this.professionalUserId = res.id;
      this.ensureAgendaDefaults();

      this.profile = {
        name: res.professional?.name || '',
        specialty: res.professional?.specialty || '',
        description: res.professional?.description || '',
        price: res.professional?.price || 0,
        duration: res.professional?.duration || 90,
        interval: res.professional?.interval || 15,
        rules: res.professional?.rules || '',
        image: res.professional?.image || ''
      };

      this.loadAvailability(() => this.finishDashboardRequest());

    },
      error: (err) => {
        console.error('Error cargando perfil:', err);
        this.finishDashboardRequest();
      }
    });

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

          for (const item of this.availability as any[]) {
            item.enabled = false;
          }

          for (const item of items) {
            const agendaDay = (this.availability as any[]).find(
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
              ? item.blockedRanges.map((range: any) => ({
                start: this.minutesToTime(range.startMinute),
                end: this.minutesToTime(range.endMinute),
              }))
              : [];

            if (Number.isInteger(item.breakMinute)) {
              this.profile.interval = item.breakMinute;
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
      const current = (this.availability as any[]).find((item) =>
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

  finishDashboardRequest(): void {
    this.dashboardRequestsPending = Math.max(0, this.dashboardRequestsPending - 1);

    if (this.dashboardRequestsPending === 0) {
      this.loading = false;
      this.loaded = true;
    }
  }

  get filteredTaxDocuments(): any[] {
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

  prepareDocumentView(document: any): any {
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

  runDocumentAction(
    documentId: string,
    action: () => any,
    errorMessage: string
  ): void {
    if (this.documentActionIds[documentId]) return;

    this.documentActionIds[documentId] = true;

    action().subscribe({
      next: () => {
        this.loadPendingTaxDocuments();
        this.loadTaxDocuments();
      },
      error: (err: any) => {
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

  openDocument(document: any): void {
    if (!document.pdfUrl) return;

    const url = document.pdfUrl.startsWith('http')
      ? document.pdfUrl
      : `${API_URL}${document.pdfUrl}`;

    window.open(url, '_blank', 'noopener');
  }

  getDocumentCustomerName(document: any): string {
    return document?.customer?.name ||
      document?.customer?.email ||
      document?.appointment?.customer?.name ||
      document?.appointment?.customer?.email ||
      'Cliente';
  }

  getDocumentAppointmentDate(document: any): string | null {
    return document?.appointmentDate || document?.appointment?.date || null;
  }

  getDocumentIssueDate(document: any): string | null {
    return document?.generatedAt || document?.uploadedAt || document?.createdAt || null;
  }

  getDocumentSentDate(document: any): string | null {
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
  

}
