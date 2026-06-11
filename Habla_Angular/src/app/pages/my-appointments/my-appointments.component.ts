import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastController, IonicModule, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { PaymentModalComponent } from '../payment-modal/payment-modal.component';
import { RescheduleModalComponent } from '../reschedule-modal/reschedule-modal.component';
import { ChangeDetectorRef } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { AppointmentsService } from '../../services/appointments.service';
import { TaxDocumentsService } from '../../services/tax-documents.service';
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

  constructor(
  private http: HttpClient,
  private toastCtrl: ToastController,
  private alertCtrl: AlertController,
  private cd: ChangeDetectorRef,
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
 selectedFilter = 'today';


setFilter(filter: string) {
  this.selectedFilter = filter;
}
//ngOnInit() {
 // this.role = localStorage.getItem('role');
//}

ionViewDidEnter() {
  this.role = localStorage.getItem('role');


  // 🔥 deja que Angular pinte primero
  setTimeout(() => {
    this.loadAppointments();
  }, 0);
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
  this.appointmentsService.getAppointmentsByRole(this.role).subscribe({
  next: (res: any[]) => {
    console.log('RESPUESTA REAL:', res);

    this.appointments = res ?? [];
this.appointments = [...(res ?? [])];

this.loadTaxDocumentsForAppointments();
  },
  error: (err) => {
    console.error(err);
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
  setTimeout(() => {
    this.groupAppointments();
    this.cd.detectChanges();
  }, 0);
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
    : `http://localhost:3000${url}`;
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
    `http://localhost:3000/messages/send`,
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




