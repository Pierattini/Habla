import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type OnboardingMode = 'intro' | 'login' | 'register';
type AccountRole = 'CUSTOMER' | 'PROFESSIONAL';
type AttentionMode = 'ONLINE' | 'PRESENTIAL' | 'BOTH';

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
  public registerStep = 1;
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
    interest: 'Salud',
    specialty: '',
    attentionMode: 'ONLINE' as AttentionMode,
    acceptedTerms: false,
  };

  public customerInterests = [
    'Salud',
    'Belleza y estetica',
    'Deporte y rehabilitacion',
    'Asesoria profesional',
    'Educacion/coaching',
    'Otro',
  ];

  public professionalServices = [
    'Psicologia',
    'Nutricion',
    'Kinesiologia',
    'Peluqueria',
    'Barberia',
    'Depilacion',
    'Estetica',
    'Abogado',
    'Otro',
  ];

  public countries = [
    { label: 'Chile', value: 'CL', timezone: 'America/Santiago' },
    { label: 'Espana', value: 'ES', timezone: 'Europe/Madrid' },
    { label: 'Argentina', value: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
    { label: 'Colombia', value: 'CO', timezone: 'America/Bogota' },
    { label: 'Estados Unidos', value: 'US', timezone: 'America/New_York' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    window.setTimeout(() => {
      if (this.mode === 'intro') {
        this.mode = 'register';
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  public selectRole(role: AccountRole): void {
    this.selectedRole = role;
    this.registerForm.interest = role === 'CUSTOMER' ? 'Salud' : 'Psicologia';
    this.registerForm.specialty = role === 'PROFESSIONAL' ? 'Psicologia' : '';
    this.errorMessage = '';
  }

  public showLogin(): void {
    this.mode = 'login';
    this.errorMessage = '';
  }

  public showRegister(): void {
    this.mode = 'register';
    this.registerStep = 1;
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
      customerInterests: this.selectedRole === 'CUSTOMER'
        ? [this.registerForm.interest]
        : undefined,
      preferredAttentionMode: this.selectedRole === 'CUSTOMER'
        ? this.registerForm.attentionMode
        : undefined,
      specialty: this.selectedRole === 'PROFESSIONAL'
        ? this.registerForm.specialty.trim()
        : undefined,
      attentionMode: this.selectedRole === 'PROFESSIONAL'
        ? this.registerForm.attentionMode
        : undefined,
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
    };

    if (this.selectedRole === 'CUSTOMER') {
      profilePayload.customerInterests = [this.registerForm.interest];
      profilePayload.preferredAttentionMode = this.registerForm.attentionMode;
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
    if (this.registerStep < 4) {
      this.errorMessage = 'Completa los pasos del registro.';
      return false;
    }

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
      if (!this.registerForm.specialty.trim()) {
        this.errorMessage = 'Selecciona el servicio que ofreces.';
        return false;
      }
    }

    if (!this.registerForm.acceptedTerms) {
      this.errorMessage = 'Debes aceptar terminos y politica de privacidad.';
      return false;
    }

    return true;
  }

  public nextRegisterStep(): void {
    if (!this.isCurrentStepValid()) return;

    this.registerStep = Math.min(this.registerStep + 1, 4);
    this.errorMessage = '';
  }

  public previousRegisterStep(): void {
    this.registerStep = Math.max(this.registerStep - 1, 1);
    this.errorMessage = '';
  }

  public getStepTitle(): string {
    if (this.registerStep === 1) return 'Elige como quieres usar Conecta';
    if (this.registerStep === 2) return 'Crea tu acceso';
    if (this.registerStep === 3) {
      return this.selectedRole === 'CUSTOMER'
        ? 'Que estas buscando?'
        : 'Que servicio ofreces?';
    }

    return 'Como prefieres atenderte?';
  }

  public getStepSubtitle(): string {
    if (this.registerStep === 1) return 'Configuraremos tu experiencia segun tu rol.';
    if (this.registerStep === 2) return 'Solo pedimos lo minimo para crear tu cuenta.';
    if (this.registerStep === 3) return 'Esto nos ayuda a mostrar mejores recomendaciones.';
    return 'Puedes cambiarlo despues desde tu perfil.';
  }

  public selectInterest(value: string): void {
    this.registerForm.interest = value;

    if (this.selectedRole === 'PROFESSIONAL') {
      this.registerForm.specialty = value;
    }
  }

  public selectAttentionMode(value: AttentionMode): void {
    this.registerForm.attentionMode = value;
  }

  public getSelectedOptions(): string[] {
    return this.selectedRole === 'CUSTOMER'
      ? this.customerInterests
      : this.professionalServices;
  }

  private isCurrentStepValid(): boolean {
    if (this.registerStep === 1) return true;

    if (this.registerStep === 2) {
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
    }

    if (this.registerStep === 3 && !this.registerForm.interest) {
      this.errorMessage = 'Selecciona una opcion.';
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
