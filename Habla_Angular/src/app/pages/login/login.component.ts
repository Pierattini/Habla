import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import {
  IonContent,
  IonItem,
  IonInput,
  IonButton
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    FormsModule,
    IonContent,
    IonItem,
    IonInput,
    IonButton
  ]
})
export class LoginComponent {

  email = '';
  password = '';

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  login() {
  this.auth.login(this.email, this.password).subscribe({
    next: (res: any) => {

      // 🔥 guardar datos correctos
      localStorage.setItem('token', res.access_token);
      localStorage.setItem('role', res.user.role);
      localStorage.setItem('email', res.user.email);
      localStorage.setItem('name', res.user.name || 'Usuario');

      // navegar
      this.router.navigateByUrl('/tabs/home');
    },

    error: () => {
      alert('Login incorrecto');
    }
  });
}}