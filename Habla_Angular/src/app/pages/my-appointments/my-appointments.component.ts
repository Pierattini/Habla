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
  private route: ActivatedRoute 
) {}

getHeaders() {
  const token = localStorage.getItem('token') || '';

  return new HttpHeaders({
    Authorization: `Bearer ${token}`
  });
}

 role: string | null = null;
 loadingId: string | null = null;

//ngOnInit() {
 // this.role = localStorage.getItem('role');
//}

ionViewDidEnter() {
  this.role = localStorage.getItem('role');

  // 🔥 fuerza render inicial limpio
  this.groupedAppointments = [];

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
  const token = localStorage.getItem('token') || '';

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  let url = 'http://localhost:3000/appointments/mine';

  if (this.role === 'PROFESSIONAL') {
    url = 'http://localhost:3000/appointments/professional';
  }

  if (this.role === 'ADMIN') {
    url = 'http://localhost:3000/appointments/all';
  }

  this.http.get<any[]>(url, { headers }).subscribe({
  next: (res: any[]) => {
    console.log('RESPUESTA REAL:', res);

    this.appointments = res ?? [];
this.appointments = [...(res ?? [])];

setTimeout(() => {
  this.groupAppointments();
  this.cd.detectChanges();
}, 0);
  },
  error: (err) => {
    console.error(err);
  }
});
}

  cancelAppointment(id: string) {
  const headers = this.getHeaders();

  this.loadingId = id;

  this.http.patch(
    `http://localhost:3000/appointments/${id}/cancel`,
    {},
    { headers }
  ).subscribe({
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

  this.http.patch(
    `http://localhost:3000/appointments/${id}/resolve-penalty`,
    {
      option,
      ...data
    },
    { headers: this.getHeaders() }
  ).subscribe({
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
groupedAppointments: any[] = [];

groupAppointments() {
  const groups: any = {};

  this.appointments.forEach(appt => {

    if (!appt.date) return;

    const dateStr = appt.date.split('T')[0];

    if (!groups[dateStr]) {
      groups[dateStr] = [];
    }

    groups[dateStr].push(appt);
  });

  this.groupedAppointments = [...Object.keys(groups).map(key => ({
  date: new Date(key + 'T00:00:00'),
  items: groups[key]
}))];

  console.log('GROUPED:', this.groupedAppointments);
}
getNombre(appt: any): string {
  if (this.role === 'PROFESSIONAL') {
    return appt.customer?.email?.split('@')[0] || 'Cliente';
  }

  return (
    appt.professional?.professional?.name ||
    appt.professional?.email?.split('@')[0] ||
    'Profesional'
  );
}

getLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Hoy';
  }

  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Mañana';
  }

  return date.toLocaleDateString();
}
goHome() {
  this.router.navigate(['/tabs/home']);
}
getStatusLabel(status: string): string {
  const map: any = {
  PENDING: 'Pendiente',
  PENDING_PAYMENT: 'Pendiente de pago',
  PAYMENT_REVIEW: 'Pago en revisión',
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  RESCHEDULED: 'Reagendada', 
  REFUNDED: 'Reembolsado'
};

  return map[status] || status;
}
getStatusColor(status: string): string {
  const map: any = {
  PENDING: 'warning',
  PENDING_PAYMENT: 'medium',
  PAYMENT_REVIEW: 'warning',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'tertiary',
  REFUNDED: 'medium'
};

  return map[status] || 'medium';
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
  const token = localStorage.getItem('token');

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  this.http.patch(
    `http://localhost:3000/appointments/${id}/pay`,
    {},
    { headers }
  ).subscribe({
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
  const headers = this.getHeaders();

  this.loadingId = id;

  this.http.patch(
    `http://localhost:3000/appointments/${id}/confirm`,
    {},
    { headers }
  ).subscribe({
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
  console.log('📥 data del modal:', data);

  if (!data) return;
// 🔥 CASO NUEVO: ENVIAR MENSAJE + CRÉDITO
if (data?.action === 'SEND_MESSAGE') {

  // 🔥 1. VALIDACIÓN (PUNTO 3)
  if (!data.message || !data.message.trim()) {
    await this.presentToast('Escribe un mensaje', 'warning');
    return;
  }

  // 🔥 2. UX: mensaje previo (PUNTO 4)
  await this.presentToast('Enviando mensaje...', 'medium');

  // 🔥 3. ENVIAR MENSAJE
  this.http.post(
    `http://localhost:3000/messages/send`,
    {
      receiverId: appt.professionalId,
      content: data.message
    },
    { headers: this.getHeaders() }
  ).subscribe({
    next: async () => {

      // 🔥 4. APLICAR CRÉDITO DESPUÉS
      this.http.patch(
        `http://localhost:3000/appointments/${appt.id}/resolve-penalty`,
        {
          option: 'CREDIT'
        },
        { headers: this.getHeaders() }
      ).subscribe({
        next: async () => {
          await this.presentToast('Mensaje enviado y saldo abonado', 'success');
          this.loadAppointments();
        },
        error: async () => {
          await this.presentToast('Error aplicando crédito', 'danger');
        }
      });

    },
    error: async () => {
      await this.presentToast('Error enviando mensaje', 'danger');
    }
  });

  return;
}
  // 🔥 CASO 1: DEJAR COMO CRÉDITO
  if (data?.action === 'CREDIT_ONLY') {

    this.http.patch(
      `http://localhost:3000/appointments/${appt.id}/resolve-penalty`,
      {
        option: 'CREDIT'
      },
      { headers: this.getHeaders() }
    ).subscribe({
      next: async () => {
        await this.presentToast('Saldo guardado como crédito', 'success');
        this.loadAppointments();
      },
      error: async () => {
        await this.presentToast('Error al guardar crédito', 'danger');
      }
    });

    return;
  }

  // 🔥 CASO 2: REAGENDAR NORMAL

  const fechaBase = data.date.split('T')[0];
  const nuevaFecha = `${fechaBase}T${data.hour}:00`;

  this.http.patch(
    `http://localhost:3000/appointments/${appt.id}/reschedule`,
    {
      date: nuevaFecha
    },
    { headers: this.getHeaders() }
  ).subscribe({
    next: async () => {

      if (data.payRequired) {

  await this.presentToast('Debes pagar para confirmar la cita', 'warning');

  // 🔥 abrir modal de pago automáticamente
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
    event.target.src = 'https://via.placeholder.com/100';
  }
 canPay(appt: any): boolean {
  return appt.status === 'PENDING';
}

canShowPaymentWaiting(appt: any): boolean {
  return appt.status === 'PAYMENT_REVIEW';
}

canProfessionalConfirm(appt: any): boolean {
  return this.role === 'PROFESSIONAL' && appt.status === 'PAYMENT_REVIEW';
}

canReschedule(appt: any): boolean {

  if (
    appt.status === 'CANCELLED' ||
    appt.status === 'REFUNDED'
  ) {
    return false;
  }

  return true;
}
canCancel(appt: any): boolean {

  if (
    appt.status === 'CANCELLED' ||
    appt.status === 'REFUNDED'
  ) {
    return false;
  }

  return true;
}
}