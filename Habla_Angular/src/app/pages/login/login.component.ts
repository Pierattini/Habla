import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type OnboardingMode = 'intro' | 'login' | 'register';
type AccountRole = 'CUSTOMER' | 'PROFESSIONAL';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [
    FormsModule,
    RouterLink,
  ]
})
export class LoginComponent implements OnInit {
  public mode: OnboardingMode = 'intro';
  public selectedRole: AccountRole = 'CUSTOMER';
  public isSubmitting = false;
  public errorMessage = '';

  public email = '';
  public password = '';

  public registerForm = {
    name: '',
    email: '',
    password: '',
    country: 'CL',
    timezone: 'America/Santiago',
    motivation: '',
    specialty: '',
    description: '',
    price: 30000,
    duration: 45,
    taxId: '',
    taxName: '',
    taxEmail: '',
    taxAddress: '',
    taxCity: '',
    wantsTaxDocumentByDefault: false,
    documentAutomationEnabled: false,
    manualDocumentMode: true,
    acceptedTerms: false,
  };

  public countries = [
    { label: 'Chile', value: 'CL', timezone: 'America/Santiago' },
    { label: 'Espana', value: 'ES', timezone: 'Europe/Madrid' },
    { label: 'Argentina', value: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
    { label: 'Colombia', value: 'CO', timezone: 'America/Bogota' },
    { label: 'Estados Unidos', value: 'US', timezone: 'America/New_York' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    window.setTimeout(() => {
      if (this.mode === 'intro') {
        this.mode = 'register';
      }
    }, 1000);
  }

  public selectRole(role: AccountRole): void {
    this.selectedRole = role;
    this.errorMessage = '';
  }

  public showLogin(): void {
    this.mode = 'login';
    this.errorMessage = '';
  }

  public showRegister(): void {
    this.mode = 'register';
    this.errorMessage = '';
  }

  public onCountryChange(): void {
    const country = this.countries.find((item) => item.value === this.registerForm.country);

    if (country) {
      this.registerForm.timezone = country.timezone;
    }
  }

  public login(): void {
    if (!this.email || !this.password || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.auth.login(this.email, this.password).subscribe({
      next: (res: any) => {
        this.saveSession(res);
        this.router.navigateByUrl('/tabs/home');
      },
      error: () => {
        this.errorMessage = 'No pudimos iniciar sesion con esos datos.';
        this.isSubmitting = false;
      }
    });
  }

  public register(): void {
    if (this.isSubmitting || !this.isRegisterValid()) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.auth.register({
      name: this.registerForm.name.trim(),
      email: this.registerForm.email.trim(),
      password: this.registerForm.password,
      role: this.selectedRole,
    }).subscribe({
      next: () => this.loginAfterRegister(),
      error: (err) => {
        this.errorMessage = err?.error?.message || 'No pudimos crear la cuenta.';
        this.isSubmitting = false;
      }
    });
  }

  private loginAfterRegister(): void {
    this.auth.login(this.registerForm.email.trim(), this.registerForm.password).subscribe({
      next: (res: any) => {
        this.saveSession(res);
        this.completeOnboardingProfile();
      },
      error: () => {
        this.errorMessage = 'Cuenta creada. Inicia sesion para continuar.';
        this.mode = 'login';
        this.email = this.registerForm.email.trim();
        this.password = '';
        this.isSubmitting = false;
      }
    });
  }

  private completeOnboardingProfile(): void {
    const profilePayload: any = {
      name: this.registerForm.name.trim(),
      country: this.registerForm.country,
      timezone: this.registerForm.timezone,
      taxId: this.cleanOptional(this.registerForm.taxId),
      taxName: this.cleanOptional(this.registerForm.taxName),
      taxEmail: this.cleanOptional(this.registerForm.taxEmail),
      taxAddress: this.cleanOptional(this.registerForm.taxAddress),
      taxCountry: this.registerForm.country,
      taxCity: this.cleanOptional(this.registerForm.taxCity),
      wantsTaxDocumentByDefault: this.registerForm.wantsTaxDocumentByDefault,
    };

    if (this.selectedRole === 'PROFESSIONAL') {
      profilePayload.specialty = this.registerForm.specialty.trim();
      profilePayload.description = this.registerForm.description.trim();
      profilePayload.price = Number(this.registerForm.price);
      profilePayload.duration = Number(this.registerForm.duration);
      profilePayload.documentAutomationEnabled = this.registerForm.documentAutomationEnabled;
      profilePayload.manualDocumentMode = this.registerForm.manualDocumentMode;
    }

    this.auth.updateProfile(profilePayload).subscribe({
      next: () => {
        this.router.navigateByUrl(
          this.selectedRole === 'PROFESSIONAL'
            ? '/tabs/professional-dashboard'
            : '/tabs/home'
        );
      },
      error: () => {
        this.router.navigateByUrl('/tabs/home');
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }

  private isRegisterValid(): boolean {
    if (!this.registerForm.name.trim()) {
      this.errorMessage = 'Ingresa tu nombre.';
      return false;
    }

    if (!this.registerForm.email.trim() || !this.registerForm.password) {
      this.errorMessage = 'Ingresa email y contrasena.';
      return false;
    }

    if (this.registerForm.password.length < 6) {
      this.errorMessage = 'La contrasena debe tener al menos 6 caracteres.';
      return false;
    }

    if (this.selectedRole === 'PROFESSIONAL') {
      if (!this.registerForm.specialty.trim() || !this.registerForm.description.trim()) {
        this.errorMessage = 'Completa tu especialidad y descripcion profesional.';
        return false;
      }

      if (Number(this.registerForm.duration) < 15 || Number(this.registerForm.duration) > 240) {
        this.errorMessage = 'La duracion debe estar entre 15 y 240 minutos.';
        return false;
      }
    }

    if (!this.registerForm.acceptedTerms) {
      this.errorMessage = 'Debes aceptar terminos y politica de privacidad.';
      return false;
    }

    return true;
  }

  private saveSession(res: any): void {
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('role', res.user.role);
    localStorage.setItem('email', res.user.email);
    localStorage.setItem('name', res.user.name || 'Usuario');
  }

  private cleanOptional(value: string): string | undefined {
    const cleaned = value?.trim();
    return cleaned ? cleaned : undefined;
  }
}
