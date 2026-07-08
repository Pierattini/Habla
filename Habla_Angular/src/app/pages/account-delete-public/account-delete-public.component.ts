import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-account-delete-public',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './account-delete-public.component.html',
  styleUrls: ['./account-delete-public.component.scss'],
})
export class AccountDeletePublicComponent {
  readonly supportEmail = 'app.info.conect@gmail.com';
  readonly mailto =
    'mailto:app.info.conect@gmail.com?subject=Solicitud%20de%20eliminacion%20de%20cuenta%20Conecta';
}
