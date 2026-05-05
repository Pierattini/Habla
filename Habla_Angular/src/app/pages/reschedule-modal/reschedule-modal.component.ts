import { Component, Input } from '@angular/core';
import { IonicModule, ModalController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-reschedule-modal',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './reschedule-modal.component.html',
  styleUrls: ['./reschedule-modal.component.scss'],
})
export class RescheduleModalComponent {

  @Input() appointment: any;

  selectedDate: string = '';
  selectedHour: string | null = null;
  availableSlots: string[] = [];
  noSlots: boolean = false;
  userRejectedSlots: boolean = false;
  message: string = '';

  constructor(
    private modalCtrl: ModalController,
    private auth: AuthService,
    private alertCtrl: AlertController,
  //  private cd: ChangeDetectorRef 
  ) {}

  // ❌ cerrar
  close() {
    this.modalCtrl.dismiss();
  }

  // ⏰ seleccionar hora
  toggleHour(slot: string) {
    this.selectedHour = this.selectedHour === slot ? null : slot;
  }

  // 📅 cargar horarios
  loadSlots(event: any) {
    const date = new Date(event.detail.value);
    date.setHours(12, 0, 0, 0);

    this.selectedDate = date.toISOString();

    const professionalId = this.appointment.professionalId;

    this.auth.getAvailableSlots(professionalId, this.selectedDate)
      .subscribe((slots: string[]) => {

  // 🔥 detectar si no hay horarios
  this.availableSlots = slots;

// 🔥 RESET TOTAL DEL ESTADO
this.userRejectedSlots = false;
this.message = '';

if (!slots || slots.length === 0) {
  this.noSlots = true; // 🔴 no hay horarios en BD
} else {
  this.noSlots = false; // ✅ hay horarios normales
}
});
  }

  // 💰 penalización
get penaltyAmount(): number {
  const price = this.appointment?.professional?.professional?.price || 0;
  return price * 0.5;
}

// 🧠 FUNCIÓN ÚNICA (LA IMPORTANTE)
isWithin48Hours(): boolean {
  const now = new Date();
  const apptDate = new Date(this.appointment.date);

  const diffHours =
    (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  return diffHours < 48;
}

// 💳 pago restante
get remainingPayment(): number {
  const price = this.appointment?.professional?.professional?.price || 0;

  if (this.isWithin48Hours()) {
    return price * 0.5;
  }

  return 0;
}

  // ✅ confirmar reagendamiento
  async confirm() {

    if (!this.selectedDate || !this.selectedHour) return;

    const newDate = new Date(this.selectedDate);
    const [hour, minute] = this.selectedHour.split(':');

    newDate.setHours(Number(hour), Number(minute), 0, 0);

    if (this.isWithin48Hours()) {

      const alert = await this.alertCtrl.create({
        header: '⚠️ Cambio con costo',
        message: `
Se aplicará una penalización del 50%.

💸 Penalización: $${this.penaltyAmount.toLocaleString()} CLP  
💳 Debes pagar adicional: $${this.remainingPayment.toLocaleString()} CLP

Para confirmar tu nueva cita.
`,
        buttons: [
          {
            text: 'Volver',
            role: 'cancel',
          },
          {
            text: 'Pagar y confirmar',
            handler: () => {
              this.sendReschedule(true);
            },
          },
        ],
      });

      await alert.present();
      return;
    }

    // ✅ SIN PENALIZACIÓN
    this.sendReschedule(false);
  }
  showMessageBox() {
  this.noSlots = true;
}
  // 🔥 NUEVO: dejar como crédito (sin elegir hora)
  async leaveAsCredit() {
  this.noSlots = false;
  this.userRejectedSlots = false;
  this.message = '';

  let message = ''; // 🔥 FALTABA ESTO

  if (this.isWithin48Hours()) {
    message = `
Se aplicará una penalización del 50%.

💰 Solo se abonará la mitad del monto pagado.

¿Deseas continuar?
    `;
  } else {
    message = `
✅ Se abonará el monto completo como crédito.

¿Deseas continuar?
    `;
  }

  const alert = await this.alertCtrl.create({
    header: 'Confirmar acción',
    message,
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel'
      },
      {
        text: 'Continuar',
        handler: () => {
          this.noSlots = true;
          this.userRejectedSlots = true;
         // this.cd.detectChanges();
        }
      }
    ]
  });

  await alert.present();
}

  // 📤 enviar datos
  sendReschedule(withPayment: boolean) {
    this.modalCtrl.dismiss({
      date: this.selectedDate,
      hour: this.selectedHour,
      payRequired: withPayment
    });
  }
  sendMessage() {
  if (!this.message.trim()) return;

  this.modalCtrl.dismiss({
    action: 'SEND_MESSAGE',
    message: this.message
  });
}
}