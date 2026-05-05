import { Component, Input } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
  templateUrl: './payment-modal.component.html',
  styleUrls: ['./payment-modal.component.scss'],
})
export class PaymentModalComponent {

  @Input() paymentData: any;
  @Input() appointmentId: string = '';
  @Input() mode: 'PAYMENT' | 'REFUND' = 'PAYMENT';

  // 🔥 datos para reembolso
  bank: string = '';
  account: string = '';
  accountType: string = '';

  constructor(private modalCtrl: ModalController) {}

  close() {
    this.modalCtrl.dismiss();
  }

  // 💳 confirmar pago
  confirmarPago() {
    this.modalCtrl.dismiss({
      paid: true,
      id: this.appointmentId
    });
  }

  // 💸 confirmar reembolso
  confirmRefund() {

    if (!this.bank || !this.account || !this.accountType) {
      return;
    }

    this.modalCtrl.dismiss({
      refund: true,
      bank: this.bank,
      account: this.account,
      accountType: this.accountType
    });
  }
}