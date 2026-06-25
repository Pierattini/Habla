import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastController, IonicModule, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { RescheduleModalComponent } from '../reschedule-modal/reschedule-modal.component';
import { ViewWillEnter } from '@ionic/angular';
import { AppointmentsService } from '../../services/appointments.service';
import { TaxDocumentsService } from '../../services/tax-documents.service';
import { API_URL } from '../../core/config/api.config';
import {
  canCancel as canCancelHelper,
  canPay as canPayHelper,
  canReschedule as canRescheduleHelper,
  canShowPaymentWaiting as canShowPaymentWaitingHelper,
  getLabel as getLabelHelper,
  getStatusColor as getStatusColorHelper,
  getStatusLabel as getStatusLabelHelper,
  groupByDate as groupByDateHelper
} from './my-appointments.helpers';
@Component({
  selector: 'app-my-appointments',
  standalone: true,
  templateUrl: './my-appointments.component.html',
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    
  ]
})
export class MyAppointmentsComponent {

  appointments: any[] = [];
  loading = true;
  loaded = false;

  constructor(
  private http: HttpClient,
  private toastCtrl: ToastController,
  private alertCtrl: AlertController,
  private cdr: ChangeDetectorRef,
  private router: Router,
  private modalCtrl: ModalController,
  private route: ActivatedRoute,
  private appointmentsService: AppointmentsService,
  private taxDocumentsService: TaxDocumentsService
) {}

getHeaders() {
  const token = localStorage.getItem('token') || '';

  return new HttpHeaders({
    Authorization: `Bearer ${token}`
  });
}

 role: string | null = null;
 loadingId: string | null = null;
 videoContinuationLoadingId: string | null = null;
 selectedFilter = 'today';


setFilter(filter: string) {
  this.selectedFilter = filter;
}
//ngOnInit() {
 // this.role = localStorage.getItem('role');
//}

ionViewWillEnter() {
  this.role = localStorage.getItem('role');
  this.loadAppointments();
}

async presentToast(message: string, color: string = 'success') {
  const toast = await this.toastCtrl.create({
    message,
    duration: 2000,
    color,
    position: 'top'
  });

  await toast.present();
}
  loadAppointments() {
  this.loading = true;
  this.loaded = false;

  this.appointmentsService.getAppointmentsByRole(this.role).subscribe({
  next: (res: any[]) => {
    console.log('RESPUESTA REAL:', res);

    this.appointments = res ?? [];
this.appointments = [...(res ?? [])];

this.loadTaxDocumentsForAppointments();
  },
  error: (err) => {
    console.error(err);
    this.appointments = [];
    this.groupAppointments();
    this.loading = false;
    this.loaded = true;
    this.cdr.detectChanges();
  }
});
}

loadTaxDocumentsForAppointments() {
  if (this.role === 'PROFESSIONAL') {
    this.finishAppointmentsLoad();
    return;
  }

  this.taxDocumentsService.getMyDocuments().subscribe({
    next: (documents: any[]) => {
      const documentsByAppointment = new Map(
        documents.map((document: any) => [document.appointmentId, document])
      );

      this.appointments = this.appointments.map((appointment) => ({
        ...appointment,
        taxDocument: documentsByAppointment.get(appointment.id) || appointment.taxDocument,
        documentView: this.buildDocumentView(
          appointment,
          documentsByAppointment.get(appointment.id) || appointment.taxDocument
        )
      }));

      this.finishAppointmentsLoad();
    },
    error: (err: any) => {
      console.error('Error cargando documentos tributarios:', err);
      this.appointments = this.appointments.map((appointment) => ({
        ...appointment,
        documentView: this.buildDocumentView(appointment, appointment.taxDocument)
      }));
      this.finishAppointmentsLoad();
    }
  });
}

finishAppointmentsLoad() {
  this.groupAppointments();
  this.loading = false;
  this.loaded = true;
  this.cdr.detectChanges();
}
  cancelAppointment(id: string) {
  this.loadingId = id;

  this.appointmentsService.cancelAppointment(id).subscribe({
    next: async (res: any) => {

      this.loadingId = null;

      // 🔥 SI ES MENOS DE 48H → MOSTRAR OPCIONES
     if (
  res.status === 'PENDING_PAYMENT' ||
  res.penalty !== undefined
) {

  this.showCancelOptions(id);
  return;
}
      await this.presentToast('Cita cancelada correctamente', 'danger');
      this.loadAppointments();
    },

    error: async () => {
      this.loadingId = null;
      await this.presentToast('Error al cancelar la cita', 'danger');
    }
  });
}
resolvePenalty(id: string, option: 'CREDIT' | 'REFUND', data?: any) {

  this.appointmentsService.resolvePenalty(id, option, data).subscribe({
    next: async () => {
      await this.presentToast(
        option === 'CREDIT'
          ? 'Saldo guardado como crédito'
          : 'Solicitud de reembolso enviada',
        'success'
      );

      this.loadAppointments();
    },
    error: async () => {
      await this.presentToast('Error en la operación', 'danger');
    }
  });
}
async showCancelOptions(id: string) {
  const alert = await this.alertCtrl.create({
    header: 'Cancelación con penalización',
    message: `
      Cancelaste con menos de 48 horas.
      Se retendrá el 50%.
      ¿Qué deseas hacer?
    `,
    buttons: [
      {
        text: '💰 Crédito',
        handler: () => {
          this.resolvePenalty(id, 'CREDIT');
        }
      },
      {
        text: '💸 Reembolso',
        handler: () => {
          this.askRefundData(id);
        }
      }
    ]
  });

  await alert.present();
}
async askRefundData(id: string) {
  const alert = await this.alertCtrl.create({
    header: 'Solicitud de reembolso',
    message: 'Ingresa tus datos bancarios',
    inputs: [
      {
        name: 'bank',
        type: 'text',
        placeholder: 'Banco'
      },
      {
        name: 'account',
        type: 'text',
        placeholder: 'Número de cuenta'
      },
      {
        name: 'accountType',
        type: 'text',
        placeholder: 'Tipo de cuenta'
      }
    ],
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Enviar',
        handler: (data) => {

          if (!data.bank || !data.account || !data.accountType) {
            this.presentToast('Datos incompletos', 'danger');
            return false;
          }

          this.resolvePenalty(id, 'REFUND', {
            bank: data.bank,
            account: data.account,
            accountType: data.accountType
          });

          return true;
        }
      }
    ]
  });

  await alert.present();
}
todayAppointments: any[] = [];
futureAppointments: any[] = [];
completedAppointments: any[] = [];
historyAppointments: any[] = [];
upcomingAppointments: any[] = [];
pastAppointments: any[] = [];

groupAppointments() {

  this.todayAppointments = this.groupByDate(this.appointments);

  this.futureAppointments = this.groupByDate(this.appointments);

  this.completedAppointments = this.groupByDate(this.appointments);

  this.historyAppointments = this.groupByDate(this.appointments);

  this.upcomingAppointments = this.groupByDate(this.appointments);

  this.pastAppointments = this.groupByDate(this.appointments);

}

groupByDate(list: any[]) {
  return groupByDateHelper(list);
}
getNombre(appt: any): string {
  if (this.role === 'PROFESSIONAL') {
    return (
      appt.customer?.name ||
      appt.customer?.email?.split('@')[0] ||
      'Cliente'
    );
  }

  return (
    appt.professional?.professional?.name ||
    appt.professional?.name ||
    appt.professional?.email?.split('@')[0] ||
    'Profesional'
  );
}

getLabel(date: Date): string {
  return getLabelHelper(date);
}
goHome() {
  this.router.navigate(['/tabs/home']);
}
getStatusLabel(status: string): string {
  return getStatusLabelHelper(status);
}
getStatusColor(status: string): string {
  return getStatusColorHelper(status);
}


buildDocumentView(appt: any, document: any): any {
  const status = document?.status || appt?.documentStatus || 'DOCUMENT_NOT_REQUIRED';
  const issueDate = document?.generatedAt || document?.uploadedAt || document?.createdAt || null;
  const sentDate = document?.sentAt || document?.emailSentAt || null;
  const pdfUrl = this.normalizeDocumentUrl(document?.pdfUrl);
  const requested = appt?.documentRequested === true ||
    !!document ||
    status !== 'DOCUMENT_NOT_REQUIRED';

  return {
    document,
    status,
    statusLabel: this.getDocumentStatusLabel(status),
    typeLabel: this.getDocumentTypeLabel(document?.type),
    issueDate,
    sentDate,
    fileName: document?.fileName || 'Sin archivo',
    requested,
    requestedLabel: requested ? 'Si' : 'No',
    emailSent: document?.emailSent === true,
    emailSentAt: document?.emailSentAt || null,
    pdfUrl,
    timeline: this.getDocumentTimeline(appt, document, status),
    emptyMessage: requested
      ? 'Documento pendiente de emisi�n'
      : 'No se ha solicitado documento tributario',
  };
}
getTaxDocument(appt: any): any {
  return appt?.taxDocument || null;
}

getDocumentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DOCUMENT_NOT_REQUIRED: 'No requerido',
    DOCUMENT_PENDING: 'Pendiente',
    DOCUMENT_UPLOADED: 'Documento cargado',
    DOCUMENT_GENERATED: 'Generado',
    DOCUMENT_SENT: 'Enviado',
    DOCUMENT_FAILED: 'Fall�',
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

getDocumentIssueDate(document: any): string | null {
  return document?.generatedAt || document?.uploadedAt || document?.createdAt || null;
}

getDocumentSentDate(document: any): string | null {
  return document?.sentAt || document?.emailSentAt || null;
}
normalizeDocumentUrl(url?: string | null): string | null {
  if (!url) return null;

  return url.startsWith('http')
    ? url
    : `${API_URL}${url}`;
}

getDocumentTimeline(appt: any, document: any, status: string): any[] {
  const existingEvents = Array.isArray(document?.events)
    ? document.events
    : [];

  if (existingEvents.length > 0) {
    return existingEvents
      .slice()
      .reverse()
      .map((event: any) => ({
        type: event.type,
        label: this.getDocumentEventLabel(event.type),
        date: event.createdAt,
        active: true,
        failed: event.type === 'DOCUMENT_FAILED',
      }));
  }

  const order = [
    'DOCUMENT_CREATED',
    'DOCUMENT_PENDING',
    'DOCUMENT_UPLOADED',
    'DOCUMENT_GENERATED',
    'DOCUMENT_SENT',
  ];
  const statusIndex = order.indexOf(status);
  const activeUntil = statusIndex >= 0 ? statusIndex : -1;
  const createdAt = document?.createdAt || appt?.documentRequestedAt || null;
  const dates: Record<string, string | null> = {
    DOCUMENT_CREATED: createdAt,
    DOCUMENT_PENDING: appt?.documentRequestedAt || createdAt,
    DOCUMENT_UPLOADED: document?.uploadedAt || null,
    DOCUMENT_GENERATED: document?.generatedAt || null,
    DOCUMENT_SENT: document?.sentAt || appt?.documentSentAt || document?.emailSentAt || null,
  };
  const timeline = order.map((eventType, index) => ({
    type: eventType,
    label: this.getDocumentEventLabel(eventType),
    date: dates[eventType],
    active: index <= activeUntil,
    failed: false,
  }));

  if (status === 'DOCUMENT_FAILED') {
    timeline.push({
      type: 'DOCUMENT_FAILED',
      label: this.getDocumentEventLabel('DOCUMENT_FAILED'),
      date: document?.updatedAt || null,
      active: true,
      failed: true,
    });
  }

  return timeline;
}

getDocumentEventLabel(type: string): string {
  const labels: Record<string, string> = {
    DOCUMENT_CREATED: 'Documento creado',
    DOCUMENT_PENDING: 'Pendiente',
    DOCUMENT_UPLOADED: 'Documento cargado',
    DOCUMENT_GENERATED: 'Generado',
    DOCUMENT_SENT: 'Enviado',
    DOCUMENT_FAILED: 'Fall�',
    DOCUMENT_EMAIL_SENT: 'Correo enviado',
    DOCUMENT_EMAIL_FAILED: 'Error de correo',
    DOCUMENT_EMAIL_RESENT: 'Correo reenviado',
  };

  return labels[type] || type;
}
shouldShowPenalty(appt: any): boolean {
  if (!appt.penalty || appt.penalty <= 0) return false;

  const validStatus =
  appt.status === 'CANCELLED' ||
  appt.status === 'RESCHEDULED' ||
  appt.status === 'PENDING_PAYMENT';

  const now = new Date();
  const apptDate = new Date(appt.date);

  const diffHours =
    (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  return validStatus && diffHours < 48;
}

// 💳 CLIENTE → marca como pagado
markAsPaid(id: string) {
  this.appointmentsService.markAsPaid(id).subscribe({
    next: async () => {
      await this.presentToast('Pago enviado para revisión', 'warning');
      this.loadAppointments();
    },
    error: async () => {
      await this.presentToast('Error al enviar pago', 'danger');
    }
  });
}
confirmAppointment(id: string) {
  this.loadingId = id;

  this.appointmentsService.confirmAppointment(id).subscribe({
    next: async () => {
      this.loadingId = null;
      await this.presentToast('Pago confirmado', 'success');
      this.loadAppointments();
    },
    error: async () => {
      this.loadingId = null;
      await this.presentToast('Error al confirmar pago', 'danger');
    }
  });
}

// 💳 ABRIR MODAL DE PAGO
canAddToCalendar(appt: any): boolean {
  return appt?.status === 'CONFIRMED' && !!appt?.date;
}

async addToCalendar(appt: any) {
  if (!this.canAddToCalendar(appt)) {
    await this.presentToast('La cita debe estar confirmada para agregarla al calendario', 'warning');
    return;
  }

  const alert = await this.alertCtrl.create({
    header: 'Agregar al calendario',
    message: 'Elige como quieres guardar esta cita.',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Google Calendar',
        handler: () => {
          window.open(this.buildGoogleCalendarUrl(appt), '_blank', 'noopener');
          return true;
        }
      },
      {
        text: 'Archivo .ics',
        handler: () => {
          this.downloadIcsFile(appt);
          return true;
        }
      }
    ]
  });

  await alert.present();
}

private buildGoogleCalendarUrl(appt: any): string {
  const start = new Date(appt.date);
  const end = new Date(start.getTime() + this.getAppointmentDuration(appt) * 60000);
  const details = this.getCalendarDescription(appt);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: this.getCalendarTitle(appt),
    dates: `${this.formatGoogleDate(start)}/${this.formatGoogleDate(end)}`,
    details,
    location: this.getCalendarLocation(appt),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

private downloadIcsFile(appt: any): void {
  const start = new Date(appt.date);
  const end = new Date(start.getTime() + this.getAppointmentDuration(appt) * 60000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Conecta//Appointments//ES',
    'BEGIN:VEVENT',
    `UID:${appt.id}@conecta`,
    `DTSTAMP:${this.formatIcsDate(new Date())}`,
    `DTSTART:${this.formatIcsDate(start)}`,
    `DTEND:${this.formatIcsDate(end)}`,
    `SUMMARY:${this.escapeIcsText(this.getCalendarTitle(appt))}`,
    `DESCRIPTION:${this.escapeIcsText(this.getCalendarDescription(appt))}`,
    `LOCATION:${this.escapeIcsText(this.getCalendarLocation(appt))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `conecta-cita-${appt.id}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

private getCalendarTitle(appt: any): string {
  return `Cita Conecta con ${this.getNombre(appt)}`;
}

private getCalendarDescription(appt: any): string {
  const parts = [
    `Cita confirmada en Conecta.`,
    `Participante: ${this.getNombre(appt)}.`,
  ];

  if (appt.meetLink) {
    parts.push(`Videollamada: ${appt.meetLink}`);
  }

  return parts.join('\n');
}

private getCalendarLocation(appt: any): string {
  if (appt?.attentionMode === 'PRESENTIAL') {
    return [
      appt.appointmentAddress,
      appt.appointmentCity,
      appt.appointmentRegion,
      appt.appointmentCountry,
    ].filter(Boolean).join(', ') || 'Atencion presencial';
  }

  return appt?.meetLink || 'Conecta';
}
private getAppointmentDuration(appt: any): number {
  return Number(
    appt?.professional?.professional?.duration ||
    appt?.professional?.professional?.sessionDuration ||
    60
  );
}

private formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

private formatIcsDate(date: Date): string {
  return this.formatGoogleDate(date);
}

private escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
getAppointmentModeLabel(appt: any): string {
  if (appt?.attentionMode === 'PRESENTIAL') return 'Presencial';
  return 'Online';
}

getAppointmentModeDetail(appt: any): string {
  if (appt?.attentionMode === 'PRESENTIAL') {
    return [
      appt.appointmentAddress,
      appt.appointmentCity,
      appt.appointmentRegion,
      appt.appointmentCountry,
    ].filter(Boolean).join(', ') || 'Direccion presencial pendiente';
  }

  if (appt?.meetLink) return 'Videollamada disponible';
  return 'Videollamada al confirmar';
}

getAppointmentArrivalInstructions(appt: any): string {
  return appt?.arrivalInstructions || '';
}
canJoinVideoCall(appt: any): boolean {
  return appt?.status === 'CONFIRMED' && !!appt?.meetLink;
}

openVideoCall(appt: any): void {
  if (!this.canJoinVideoCall(appt)) {
    this.presentToast('La videollamada estara disponible cuando la cita este confirmada', 'warning');
    return;
  }

  window.open(appt.meetLink, '_blank', 'noopener');
}

async askContinueVideoCall(appt: any): Promise<void> {
  if (!this.canJoinVideoCall(appt)) {
    await this.presentToast('La videollamada estara disponible cuando la cita este confirmada', 'warning');
    return;
  }

  const alert = await this.alertCtrl.create({
    header: 'Termino la sesion?',
    message:
      'Si aun necesitan continuar, Conecta generara un nuevo enlace gratuito y lo enviara por correo al paciente y al profesional.',
    buttons: [
      {
        text: 'Si, termino',
        role: 'cancel',
      },
      {
        text: 'No, continuar',
        handler: () => {
          this.generateContinuationLink(appt);
        },
      },
    ],
  });

  await alert.present();
}

generateContinuationLink(appt: any): void {
  if (!appt?.id || this.videoContinuationLoadingId) return;

  this.videoContinuationLoadingId = appt.id;

  this.http
    .post<{ meetLink: string; message: string }>(
      `${API_URL}/appointments/${appt.id}/continue-video-call`,
      {},
      { headers: this.getHeaders() },
    )
    .subscribe({
      next: async (response) => {
        appt.meetLink = response.meetLink;
        this.videoContinuationLoadingId = null;
        await this.presentToast(
          'Nuevo enlace generado y enviado por correo',
          'success',
        );
        window.open(response.meetLink, '_blank', 'noopener');
      },
      error: async () => {
        this.videoContinuationLoadingId = null;
        await this.presentToast(
          'No se pudo generar el nuevo enlace',
          'danger',
        );
      },
    });
}
async openPayment(appt: any) {

  const data = {
  ...appt.professional?.professional,
  name: appt.professional?.name
};

  if (!data) {
    await this.presentToast('No hay datos de pago disponibles', 'danger');
    return;
  }

  const modal = await this.modalCtrl.create({
    component: PaymentModalComponent,
    componentProps: {
      paymentData: data,
      appointmentId: appt.id
    }
  });

  await modal.present();

  const { data: result } = await modal.onDidDismiss();

  if (result?.paid) {
    this.markAsPaid(result.id);
  }
}
async reschedule(appt: any) {

  const modal = await this.modalCtrl.create({
    component: RescheduleModalComponent,
    componentProps: {
      appointment: appt
    },
    cssClass: 'reschedule-modal'
  });

  await modal.present();

  const { data } = await modal.onDidDismiss();
  console.log('?? data del modal:', data);

  if (!data) return;

  if (data?.action === 'SEND_MESSAGE') {
    await this.handleRescheduleMessage(appt, data);
    return;
  }

  if (data?.action === 'CREDIT_ONLY') {
    this.handleCreditOnly(appt);
    return;
  }

  this.handleNormalReschedule(appt, data);
}

private async handleRescheduleMessage(appt: any, data: any) {
  if (!data.message || !data.message.trim()) {
    await this.presentToast('Escribe un mensaje', 'warning');
    return;
  }

  await this.presentToast('Enviando mensaje...', 'medium');

  this.http.post(
    `${API_URL}/messages/send`,
    {
      receiverId: appt.professionalId,
      content: data.message
    },
    { headers: this.getHeaders() }
  ).subscribe({
    next: async () => {
      this.appointmentsService.resolvePenalty(appt.id, 'CREDIT').subscribe({
        next: async () => {
          await this.presentToast('Mensaje enviado y saldo abonado', 'success');
          this.loadAppointments();
        },
        error: async () => {
          await this.presentToast('Error aplicando cr�dito', 'danger');
        }
      });

    },
    error: async () => {
      await this.presentToast('Error enviando mensaje', 'danger');
    }
  });
}

private handleCreditOnly(appt: any) {
  this.appointmentsService.resolvePenalty(appt.id, 'CREDIT').subscribe({
    next: async () => {
      await this.presentToast('Saldo guardado como cr�dito', 'success');
      this.loadAppointments();
    },
    error: async () => {
      await this.presentToast('Error al guardar cr�dito', 'danger');
    }
  });
}

private handleNormalReschedule(appt: any, data: any) {
  const fechaBase = data.date.split('T')[0];
  const nuevaFecha = `${fechaBase}T${data.hour}:00`;

  this.appointmentsService.rescheduleAppointment(appt.id, nuevaFecha).subscribe({
    next: async () => {
      if (data.payRequired) {
        await this.presentToast('Debes pagar para confirmar la cita', 'warning');
        this.openPayment(appt);
      } else {
        await this.presentToast('Cita reagendada', 'success');
      }

      this.loadAppointments();
    },
    error: async () => {
      await this.presentToast('Error al reagendar', 'danger');
    }
  });
}
  onImgError(event: any) {
  event.target.src = '/default-avatar.png';
}
 canPay(appt: any): boolean {
  return canPayHelper(appt);
}

canShowPaymentWaiting(appt: any): boolean {
  return canShowPaymentWaitingHelper(appt);
}

canProfessionalConfirm(appt: any): boolean {
  return this.role === 'PROFESSIONAL' && appt.status === 'PAYMENT_REVIEW';
}

canReschedule(appt: any): boolean {
  return canRescheduleHelper(appt);
}
canCancel(appt: any): boolean {
  return canCancelHelper(appt);
}
openChat(appt: any) {

  const professionalId =
    this.role === 'PROFESSIONAL'
      ? appt.customerId
      : appt.professionalId;

  this.router.navigate(
    ['/tabs/messages'],
    {
      queryParams: {
        professionalId
      }
    }
  );
}
}








