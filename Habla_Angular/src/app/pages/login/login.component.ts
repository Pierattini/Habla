import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { ProfessionItem, ProfessionService } from '../../services/profession.service';
import {
  RecaptchaClientError,
  RecaptchaService,
} from '../../services/recaptcha.service';
import { GoogleAuthService, GoogleSignInCancelledError } from '../../services/google-auth.service';
import { finalize, timeout } from 'rxjs';

type OnboardingMode = 'intro' | 'login' | 'register' | 'forgot' | 'reset';
type AccountRole = 'CUSTOMER' | 'PROFESSIONAL';
type AttentionMode = 'ONLINE' | 'PRESENTIAL' | 'BOTH';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [FormsModule, RouterLink],
})
export class LoginComponent implements OnInit {
  public mode: OnboardingMode = 'intro';
  public selectedRole: AccountRole = 'CUSTOMER';
  public registerStep = 1;
  public isSubmitting = false;
  public errorMessage = '';
  public successMessage = '';

  public email = '';
  public password = '';
  public resetEmail = '';
  public resetToken = '';
  public resetPasswordValue = '';
  public resetPasswordConfirm = '';

  public registerForm = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: 'CL',
    timezone: 'America/Santiago',
    interest: 'Salud',
    specialty: '',
    professionId: '',
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

  public professionSearch = '';
  public professionSuggestions: ProfessionItem[] = [];
  public selectedProfession: ProfessionItem | null = null;
  public customProfessionMode = false;
  public customProfession = '';
  public professionSearchFocused = false;
  public showRegisterPassword = false;
  public showRegisterConfirmPassword = false;
  public emailCheckStatus:
    | 'idle'
    | 'checking'
    | 'available'
    | 'taken'
    | 'invalid'
    | 'unavailable' = 'idle';
  private professionSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private emailCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private errorMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private redirectAfterAuth = '';

  public countries = [
    { label: 'Chile', value: 'CL', timezone: 'America/Santiago' },
    { label: 'Espana', value: 'ES', timezone: 'Europe/Madrid' },
    { label: 'Argentina', value: 'AR', timezone: 'America/Argentina/Buenos_Aires' },
    { label: 'Colombia', value: 'CO', timezone: 'America/Bogota' },
    { label: 'Estados Unidos', value: 'US', timezone: 'America/New_York' },
  ];

  constructor(
    private auth: AuthService,
    private professionService: ProfessionService,
    private recaptchaService: RecaptchaService,
    private googleAuth: GoogleAuthService,
    private pushNotifications: PushNotificationService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.recaptchaService.preload().catch((error: unknown) => {
      console.warn('[Auth][reCAPTCHA preload]', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
    void this.googleAuth.preload().catch((error: unknown) => {
      console.warn('[Auth][Google preload]', {
        message: error instanceof Error ? error.message : String(error),
      });
    });

    const resetToken = this.route.snapshot.queryParamMap.get('resetToken');
    this.redirectAfterAuth = this.getSafeRedirect(
      this.route.snapshot.queryParamMap.get('redirect'),
    );
    const requestedMode = this.route.snapshot.queryParamMap.get('mode');

    if (requestedMode === 'login' || requestedMode === 'register') {
      this.mode = requestedMode;
    }

    if (resetToken) {
      this.resetToken = resetToken;
      this.mode = 'reset';
      return;
    }

    window.setTimeout(() => {
      if (this.mode === 'intro') {
        this.mode = 'register';
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  public selectRole(role: AccountRole): void {
    this.selectedRole = role;
    this.registerForm.interest = role === 'CUSTOMER' ? 'Salud' : '';
    this.registerForm.specialty = '';
    this.registerForm.professionId = '';
    this.selectedProfession = null;
    this.professionSearch = '';
    this.customProfession = '';
    this.customProfessionMode = false;
    this.errorMessage = '';

    if (role === 'PROFESSIONAL') {
      this.loadProfessionSuggestions('');
    }
  }

  public showLogin(): void {
    this.mode = 'login';
    this.errorMessage = '';
    this.successMessage = '';
  }

  public showRegister(): void {
    this.mode = 'register';
    this.registerStep = 1;
    this.errorMessage = '';
    this.successMessage = '';
  }

  public showForgotPassword(): void {
    this.mode = 'forgot';
    this.errorMessage = '';
    this.successMessage = '';
    this.resetEmail = this.email;
  }

  public onCountryChange(): void {
    const country = this.countries.find((item) => item.value === this.registerForm.country);

    if (country) {
      this.registerForm.timezone = country.timezone;
    }
  }

  public onRegisterNameChange(value: string): void {
    this.registerForm.name = value;
    this.errorMessage = '';
  }

  public onRegisterEmailChange(value: string): void {
    this.registerForm.email = String(value || '')
      .trim()
      .toLowerCase();
    this.errorMessage = '';

    if (this.emailCheckTimer) {
      clearTimeout(this.emailCheckTimer);
    }

    if (!this.registerForm.email) {
      this.emailCheckStatus = 'idle';
      return;
    }

    if (!this.isEmailValid()) {
      this.emailCheckStatus = 'invalid';
      return;
    }

    this.emailCheckStatus = 'checking';
    this.emailCheckTimer = setTimeout(() => {
      this.auth.checkEmailAvailability(this.registerForm.email).subscribe({
        next: (res) => {
          this.emailCheckStatus = res.available ? 'available' : 'taken';
          this.cdr.detectChanges();
        },
        error: () => {
          this.emailCheckStatus = 'unavailable';
          this.cdr.detectChanges();
        },
      });
    }, 350);
  }

  public onRegisterPasswordChange(value: string): void {
    this.registerForm.password = value;
    this.errorMessage = '';
  }

  public onRegisterConfirmPasswordChange(value: string): void {
    this.registerForm.confirmPassword = value;
    this.errorMessage = '';
  }

  public login(): void {
    if (!this.email || !this.password || this.isSubmitting) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.recaptchaService
      .execute('login')
      .then((recaptchaToken) => {
        this.auth
          .login(this.email, this.password, recaptchaToken)
          .pipe(
            timeout(30000),
            finalize(() => {
              this.isSubmitting = false;
              this.cdr.detectChanges();
            }),
          )
          .subscribe({
            next: (res: any) => {
              void this.completeLogin(res);
            },
            error: (error) => {
              const apiMessage = Array.isArray(error?.error?.message)
                ? error.error.message.join(' ')
                : error?.error?.message;

              console.error('[Auth][Login API]', {
                status: error?.status,
                message: apiMessage || error?.message || 'Unknown API error',
              });

              this.errorMessage = error?.name === 'TimeoutError'
                ? 'El servidor tardó demasiado. Inténtalo nuevamente.'
                : typeof apiMessage === 'string' && apiMessage.trim()
                  ? apiMessage
                  : 'No pudimos iniciar sesión con esos datos.';
            },
          });
      })
      .catch((error: unknown) => {
        const recaptchaError =
          error instanceof RecaptchaClientError ? error : null;

        console.error('[Auth][reCAPTCHA]', {
          code: recaptchaError?.code || 'UNKNOWN',
          message:
            recaptchaError?.message ||
            (error instanceof Error ? error.message : String(error)),
        });

        this.errorMessage = recaptchaError
          ? `${recaptchaError.message} Inténtalo nuevamente.`
          : 'No pudimos verificar tu solicitud. Inténtalo nuevamente.';
        this.isSubmitting = false;
        this.cdr.detectChanges();
      });
  }

  public async continueWithGoogle(fromRegistration = false): Promise<void> {
    if (this.isSubmitting) return;

    if (localStorage.getItem('token')) {
      this.navigateAfterLogin({ user: { role: localStorage.getItem('role') } });
      return;
    }

    if (fromRegistration && !this.registerForm.acceptedTerms) {
      this.errorMessage = 'Debes aceptar términos y política de privacidad.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const idToken = await this.googleAuth.signIn();
      const registration = fromRegistration
        ? {
            role: this.selectedRole,
            acceptedTerms: this.registerForm.acceptedTerms,
            customerInterests:
              this.selectedRole === 'CUSTOMER' ? [this.registerForm.interest] : undefined,
            preferredAttentionMode:
              this.selectedRole === 'CUSTOMER' ? this.registerForm.attentionMode : undefined,
            specialty:
              this.selectedRole === 'PROFESSIONAL' ? this.registerForm.specialty.trim() : undefined,
            professionId:
              this.selectedRole === 'PROFESSIONAL' && this.registerForm.professionId
                ? this.registerForm.professionId
                : undefined,
            customProfession:
              this.selectedRole === 'PROFESSIONAL' && this.customProfessionMode
                ? this.customProfession.trim()
                : undefined,
            attentionMode:
              this.selectedRole === 'PROFESSIONAL' ? this.registerForm.attentionMode : undefined,
          }
        : undefined;

      this.auth.loginWithGoogle(idToken, registration).subscribe({
        next: (res: any) => {
          this.saveSession(res);
          void this.pushNotifications.registerDevice();
          this.navigateAfterLogin(res);
        },
        error: (err) => {
          this.showTemporaryError(
            err?.error?.message || 'No pudimos validar tu cuenta de Google. Inténtalo nuevamente.',
          );
          this.isSubmitting = false;
          this.cdr.detectChanges();
        },
      });
    } catch (error) {
      if (error instanceof GoogleSignInCancelledError) {
        this.showTemporaryError('Inicio con Google cancelado.');
      } else {
        this.showTemporaryError(this.getGoogleSignInErrorMessage(error));
      }
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  public register(): void {
    if (this.isSubmitting || !this.isRegisterValid()) return;

    this.isSubmitting = true;
    this.errorMessage = '';

    this.recaptchaService
      .execute('register')
      .then((recaptchaToken) => {
        this.auth
          .register({
            name: this.registerForm.name.trim(),
            email: this.registerForm.email.trim(),
            password: this.registerForm.password,
            role: this.selectedRole,
            country: this.registerForm.country,
            timezone: this.registerForm.timezone,
            customerInterests:
              this.selectedRole === 'CUSTOMER' ? [this.registerForm.interest] : undefined,
            preferredAttentionMode:
              this.selectedRole === 'CUSTOMER' ? this.registerForm.attentionMode : undefined,
            specialty:
              this.selectedRole === 'PROFESSIONAL' ? this.registerForm.specialty.trim() : undefined,
            professionId:
              this.selectedRole === 'PROFESSIONAL' && this.registerForm.professionId
                ? this.registerForm.professionId
                : undefined,
            customProfession:
              this.selectedRole === 'PROFESSIONAL' && this.customProfessionMode
                ? this.customProfession.trim()
                : undefined,
            attentionMode:
              this.selectedRole === 'PROFESSIONAL' ? this.registerForm.attentionMode : undefined,
            acceptedTerms: this.registerForm.acceptedTerms,
            recaptchaToken,
          })
          .pipe(timeout(30000))
          .subscribe({
            next: (res: any) => {
              this.saveSession(res);
              void this.pushNotifications.registerDevice();
              this.navigateAfterLogin(res);
            },
            error: (err) => {
              this.errorMessage =
                err?.name === 'TimeoutError'
                  ? 'La creación de la cuenta tardó demasiado. Comprueba tu conexión e inténtalo nuevamente.'
                  : err?.error?.message || 'No pudimos crear la cuenta.';
              this.isSubmitting = false;
              this.cdr.detectChanges();
            },
          });
      })
      .catch(() => {
        this.errorMessage = 'No pudimos verificar tu solicitud. Inténtalo nuevamente.';
        this.isSubmitting = false;
      });
  }

  public requestPasswordReset(): void {
    if (this.isSubmitting) return;

    if (!this.resetEmail.trim()) {
      this.errorMessage = 'Ingresa tu email.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.recaptchaService
      .execute('password_reset_request')
      .then((recaptchaToken) => {
        this.auth
          .requestPasswordReset(this.resetEmail.trim(), recaptchaToken)
          .pipe(
            timeout(30000),
            finalize(() => {
              this.isSubmitting = false;
              this.cdr.detectChanges();
            }),
          )
          .subscribe({
            next: () => {
              this.successMessage =
                'Si el email existe, enviaremos un enlace para restablecer tu contraseña.';
            },
            error: (error) => {
              this.errorMessage =
                error?.name === 'TimeoutError'
                  ? 'El servidor tardó demasiado. Inténtalo nuevamente.'
                  : 'No pudimos procesar la solicitud. Intenta nuevamente.';
            },
          });
      })
      .catch(() => {
        this.errorMessage = 'No pudimos verificar tu solicitud. Inténtalo nuevamente.';
        this.isSubmitting = false;
      });
  }

  public resetPassword(): void {
    if (this.isSubmitting) return;

    if (!this.resetPasswordValue || !this.resetPasswordConfirm) {
      this.errorMessage = 'Ingresa y confirma tu nueva contraseña.';
      return;
    }

    if (this.resetPasswordValue.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    if (this.resetPasswordValue !== this.resetPasswordConfirm) {
      this.errorMessage = 'Las contrasenas no coinciden.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.recaptchaService
      .execute('password_reset')
      .then((recaptchaToken) => {
        this.auth
          .resetPassword(this.resetToken, this.resetPasswordValue, recaptchaToken)
          .subscribe({
            next: () => {
              this.successMessage = 'Contraseña actualizada. Ya puedes iniciar sesión.';
              this.mode = 'login';
              this.password = '';
              this.resetPasswordValue = '';
              this.resetPasswordConfirm = '';
              this.router.navigate(['/login'], { replaceUrl: true });
              this.isSubmitting = false;
            },
            error: (err) => {
              this.errorMessage = err?.error?.message || 'El enlace no es válido o expiró.';
              this.isSubmitting = false;
            },
          });
      })
      .catch(() => {
        this.errorMessage = 'No pudimos verificar tu solicitud. Inténtalo nuevamente.';
        this.isSubmitting = false;
      });
  }

  private isRegisterValid(): boolean {
    if (this.registerStep < 4) {
      this.errorMessage = 'Completa los pasos del registro.';
      return false;
    }

    if (!this.isFullNameValid()) {
      this.errorMessage = 'Debes ingresar nombre y apellido.';
      return false;
    }

    if (!this.isEmailValid()) {
      this.errorMessage = 'Ingresa un correo válido.';
      return false;
    }

    if (this.emailCheckStatus === 'taken') {
      this.errorMessage = 'Este correo ya está registrado.';
      return false;
    }

    if (this.emailCheckStatus !== 'available') {
      this.errorMessage = 'Espera la validación del correo.';
      return false;
    }

    if (!this.isPasswordStrong()) {
      this.errorMessage =
        'La contraseña debe tener mayúscula, minúscula, número y carácter especial.';
      return false;
    }

    if (!this.doPasswordsMatch()) {
      this.errorMessage = 'Las contrasenas no coinciden.';
      return false;
    }

    if (this.selectedRole === 'PROFESSIONAL') {
      if (!this.registerForm.specialty.trim()) {
        this.errorMessage = 'Selecciona el servicio que ofreces.';
        return false;
      }
    }

    if (!this.registerForm.acceptedTerms) {
      this.errorMessage = 'Debes aceptar términos y política de privacidad.';
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
    if (this.registerStep === 1) return 'Elige cómo quieres usar Conecta';
    if (this.registerStep === 2) return 'Crea tu acceso';
    if (this.registerStep === 3) {
      return this.selectedRole === 'CUSTOMER'
        ? '¿Qué estás buscando?'
        : '¿Qué servicio ofreces?';
    }

    return '¿Cómo prefieres atender?';
  }

  public getStepSubtitle(): string {
    if (this.registerStep === 1) return 'Configuraremos tu experiencia según tu rol.';
    if (this.registerStep === 2) return 'Solo pedimos lo mínimo para crear tu cuenta.';
    if (this.registerStep === 3) return 'Esto nos ayuda a mostrar mejores recomendaciones.';
    return 'Puedes cambiarlo después desde tu perfil.';
  }

  public selectInterest(value: string): void {
    this.registerForm.interest = value;

    if (this.selectedRole === 'PROFESSIONAL') {
      this.registerForm.specialty = value;
    }
  }

  public onProfessionSearchChange(): void {
    this.errorMessage = '';
    this.customProfessionMode = false;
    this.selectedProfession = null;
    this.registerForm.professionId = '';
    this.registerForm.specialty = '';

    const query = this.professionSearch.trim();

    if (this.professionSearchTimer) {
      clearTimeout(this.professionSearchTimer);
    }

    this.professionSearchTimer = setTimeout(() => {
      this.loadProfessionSuggestions(query);
    }, 160);
  }

  public selectProfession(profession: ProfessionItem): void {
    this.selectedProfession = profession;
    this.customProfessionMode = false;
    this.customProfession = '';
    this.professionSearch = profession.name;
    this.registerForm.specialty = profession.name;
    this.registerForm.professionId = profession.id;
    this.errorMessage = '';
  }

  public useCustomProfession(): void {
    this.customProfessionMode = true;
    this.selectedProfession = null;
    this.registerForm.professionId = '';
    this.customProfession = this.professionSearch.trim();
    this.registerForm.specialty = this.customProfession;
    this.errorMessage = '';
  }

  public onCustomProfessionChange(): void {
    const value = this.customProfession.trim();
    const existing = this.findExistingProfession(value);

    if (existing) {
      this.selectProfession(existing);
      return;
    }

    this.registerForm.specialty = value;
    this.registerForm.professionId = '';
  }

  public getCustomProfessionMessage(): string {
    if (!this.customProfessionMode) return '';

    const value = this.customProfession.trim();

    if (!value) return 'Este campo es obligatorio si eliges Otro.';
    if (value.length < 3) return 'Mínimo 3 caracteres.';
    if (value.length > 50) return 'Máximo 50 caracteres.';
    if (!/^[\p{L}\s-]+$/u.test(value)) {
      return 'Usa solo letras, espacios, tildes y guiones.';
    }

    return 'Profesión válida.';
  }

  public isCustomProfessionValid(): boolean {
    const value = this.customProfession.trim();

    return value.length >= 3 && value.length <= 50 && /^[\p{L}\s-]+$/u.test(value);
  }

  public shouldShowProfessionSuggestions(): boolean {
    return (
      this.selectedRole === 'PROFESSIONAL' &&
      this.professionSearchFocused &&
      !this.selectedProfession &&
      !this.customProfessionMode
    );
  }

  public getProfessionCategoryLabel(profession: ProfessionItem): string {
    return (profession as any).category?.name || 'Especialidad';
  }

  public selectAttentionMode(value: AttentionMode): void {
    this.registerForm.attentionMode = value;
  }

  public getSelectedOptions(): string[] {
    return this.selectedRole === 'CUSTOMER' ? this.customerInterests : [];
  }

  private isCurrentStepValid(): boolean {
    if (this.registerStep === 1) return true;

    if (this.registerStep === 2) {
      if (!this.isFullNameValid()) {
        this.errorMessage = 'Debes ingresar nombre y apellido.';
        return false;
      }

      if (!this.isEmailValid()) {
        this.errorMessage = 'Ingresa un correo válido.';
        return false;
      }

      if (this.emailCheckStatus !== 'available') {
        if (this.emailCheckStatus === 'taken') {
          this.errorMessage = 'Este correo ya está registrado.';
        } else if (this.emailCheckStatus === 'unavailable') {
          this.errorMessage =
            'No pudimos comprobar el correo. Revisa tu conexión e intenta nuevamente.';
        } else {
          this.errorMessage = 'Espera la validación del correo.';
        }
        return false;
      }

      if (!this.isPasswordStrong()) {
        this.errorMessage =
          'La contraseña debe tener mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial.';
        return false;
      }

      if (!this.doPasswordsMatch()) {
        this.errorMessage = 'Las contrasenas no coinciden.';
        return false;
      }
    }

    if (this.registerStep === 3) {
      if (this.selectedRole === 'CUSTOMER' && !this.registerForm.interest) {
        this.errorMessage = 'Selecciona una opción.';
        return false;
      }

      if (this.selectedRole === 'PROFESSIONAL') {
        const validationError = this.getProfessionValidationError();

        if (validationError) {
          this.errorMessage = validationError;
          return false;
        }
      }
    }

    return true;
  }

  public canContinueRegister(): boolean {
    if (this.isSubmitting) return false;
    if (this.registerStep === 1) return true;

    if (this.registerStep === 2) {
      return (
        this.isFullNameValid() &&
        this.isEmailValid() &&
        this.emailCheckStatus === 'available' &&
        this.isPasswordStrong() &&
        this.doPasswordsMatch()
      );
    }

    if (this.registerStep === 3) {
      if (this.selectedRole === 'CUSTOMER') return !!this.registerForm.interest;
      return !this.getProfessionValidationError();
    }

    return true;
  }

  public canSubmitRegister(): boolean {
    return (
      this.registerStep === 4 &&
      !this.isSubmitting &&
      this.isFullNameValid() &&
      this.isEmailValid() &&
      this.emailCheckStatus === 'available' &&
      this.isPasswordStrong() &&
      this.doPasswordsMatch() &&
      this.registerForm.acceptedTerms === true
    );
  }

  public isFullNameValid(): boolean {
    const name = this.registerForm.name.trim().replace(/\s+/g, ' ');
    return name.length >= 5 && name.length <= 80 && /^[\p{L}]+(?:[ -][\p{L}]+)+$/u.test(name);
  }

  public isEmailValid(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.registerForm.email.trim());
  }

  public isPasswordStrong(): boolean {
    return this.getPasswordScore() === 5;
  }

  public getPasswordScore(): number {
    const password = this.registerForm.password || '';
    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return score;
  }

  public getPasswordStrengthLabel(): string {
    const score = this.getPasswordScore();

    if (!this.registerForm.password) return 'Ingresa una contraseña segura.';
    if (score <= 2) return 'Debil';
    if (score <= 4) return 'Media';
    return 'Fuerte';
  }

  public doPasswordsMatch(): boolean {
    return (
      !!this.registerForm.confirmPassword &&
      this.registerForm.password === this.registerForm.confirmPassword
    );
  }

  public getFieldState(valid: boolean, touchedValue: string): 'valid' | 'invalid' | '' {
    if (!String(touchedValue || '').length) return '';
    return valid ? 'valid' : 'invalid';
  }

  public getEmailMessage(): string {
    if (!this.registerForm.email) return 'Ingresa tu correo.';
    if (this.emailCheckStatus === 'checking') return 'Validando correo...';
    if (this.emailCheckStatus === 'taken') return 'Este correo ya está registrado.';
    if (this.emailCheckStatus === 'available') return 'Correo disponible.';
    if (this.emailCheckStatus === 'unavailable') {
      return 'No pudimos comprobar el correo. Intenta nuevamente.';
    }
    return 'Ingresa un correo válido.';
  }

  private saveSession(res: any): void {
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('role', String(res.user.role || '').trim().toUpperCase());
    localStorage.setItem('email', res.user.email);
    localStorage.setItem('name', res.user.name || 'Usuario');
  }

  private async completeLogin(res: any): Promise<void> {
    try {
      this.saveSession(res);
      void this.pushNotifications.registerDevice();
      await this.navigateAfterLogin(res);
    } catch (error) {
      console.error('[Auth][Post-login navigation]', error);
      this.errorMessage =
        'La sesión se inició, pero no pudimos abrir la página correspondiente.';
      this.cdr.detectChanges();
    }
  }

  private async navigateAfterLogin(res: any): Promise<void> {
    const role = String(
      res?.user?.role || localStorage.getItem('role') || '',
    )
      .trim()
      .toUpperCase();
    let destination: string;

    if (role === 'CUSTOMER' && this.redirectAfterAuth) {
      destination = this.redirectAfterAuth;
    } else {
      switch (role) {
        case 'ADMIN':
          destination = '/admin/dashboard';
          break;
        case 'PROFESSIONAL':
          destination = '/tabs/professional-dashboard';
          break;
        case 'CUSTOMER':
          destination = '/tabs/home';
          break;
        default:
          throw new Error(`Unsupported user role: ${role || 'missing'}`);
      }
    }

    const navigated = await this.router.navigateByUrl(destination);
    if (!navigated) {
      throw new Error(`Angular Router rejected navigation to ${destination}`);
    }

    this.isSubmitting = false;
  }

  private getSafeRedirect(value: string | null): string {
    const redirect = String(value || '').trim();

    if (!redirect.startsWith('/') || redirect.startsWith('//')) return '';
    if (!redirect.startsWith('/profesional/')) return '';

    return redirect;
  }

  private showTemporaryError(message: string): void {
    if (this.errorMessageTimer) clearTimeout(this.errorMessageTimer);

    this.errorMessage = message;
    this.errorMessageTimer = setTimeout(() => {
      this.errorMessage = '';
      this.cdr.detectChanges();
    }, 6000);
  }

  private getGoogleSignInErrorMessage(error: unknown): string {
    const rawError = error as { code?: string | number; message?: string };
    const details = `${rawError?.code || ''} ${rawError?.message || ''}`.toLowerCase();

    if (
      details.includes('developer_error') ||
      details.includes('12500') ||
      details.includes('code: 10') ||
      details.includes('status code: 10')
    ) {
      return 'Google Sign-In aún no está configurado para esta versión de la aplicación.';
    }

    if (details.includes('network') || details.includes('status code: 7')) {
      return 'No pudimos conectar con Google. Revisa tu conexión e inténtalo nuevamente.';
    }

    return 'No pudimos abrir Google en este momento. Inténtalo nuevamente.';
  }

  private cleanOptional(value: string): string | undefined {
    const cleaned = value?.trim();
    return cleaned ? cleaned : undefined;
  }

  public loadProfessionSuggestions(search: string): void {
    this.professionService
      .getProfessions({
        search,
      })
      .subscribe({
        next: (professions) => {
          this.professionSuggestions = professions.slice(0, 12);

          const existing = this.findExistingProfession(search);

          if (existing && search.length > 0) {
            this.selectProfession(existing);
          }
        },
        error: () => {
          this.professionSuggestions = [];
        },
      });
  }

  private findExistingProfession(value: string): ProfessionItem | null {
    const normalized = this.normalizeProfession(value);

    if (!normalized) return null;

    return (
      this.professionSuggestions.find((profession) => {
        const names = [profession.name, profession.slug, ...(profession.aliases || [])];

        return names.some((item) => this.normalizeProfession(item) === normalized);
      }) || null
    );
  }

  private getProfessionValidationError(): string | null {
    const value = this.customProfessionMode
      ? this.customProfession.trim()
      : this.registerForm.specialty.trim();

    if (!value) return 'Selecciona o escribe el servicio que ofreces.';

    const existing = this.findExistingProfession(value);

    if (existing) {
      this.selectProfession(existing);
      return null;
    }

    if (this.customProfessionMode) {
      if (value.length < 3) return 'La profesión debe tener al menos 3 caracteres.';
      if (value.length > 50) return 'La profesión no puede superar 50 caracteres.';
      if (!/^[\p{L}\s-]+$/u.test(value)) {
        return 'Usa solo letras, espacios, tildes y guiones.';
      }
    }

    if (!this.customProfessionMode && !this.registerForm.professionId) {
      return 'Selecciona una profesión del catálogo o usa Otra profesión.';
    }

    return null;
  }

  private normalizeProfession(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
