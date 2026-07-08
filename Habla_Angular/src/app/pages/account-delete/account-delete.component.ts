import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  arrowBackOutline,
  trashOutline,
} from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-account-delete',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, IonContent, IonIcon],
  templateUrl: './account-delete.component.html',
  styleUrls: ['./account-delete.component.scss'],
})
export class AccountDeleteComponent {
  confirmation = '';
  isSubmitting = false;
  message = '';
  error = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    addIcons({
      'alert-circle-outline': alertCircleOutline,
      'arrow-back-outline': arrowBackOutline,
      'trash-outline': trashOutline,
    });
  }

  get canSubmit() {
    return this.confirmation.trim().toUpperCase() === 'ELIMINAR';
  }

  goBack() {
    this.router.navigate(['/tabs/profile']);
  }

  deleteAccount() {
    if (!this.canSubmit || this.isSubmitting) return;

    this.isSubmitting = true;
    this.error = '';
    this.message = '';

    this.auth.deleteMyAccount(this.confirmation).subscribe({
      next: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.message = 'Tu cuenta fue eliminada correctamente.';

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 900);
      },
      error: () => {
        this.error =
          'No pudimos eliminar la cuenta en este momento. Intenta nuevamente.';
        this.isSubmitting = false;
      },
    });
  }
}
