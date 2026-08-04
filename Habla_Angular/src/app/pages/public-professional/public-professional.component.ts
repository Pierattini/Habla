import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
import { timeout } from 'rxjs';
import {
  IonAvatar,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonDatetime,
  IonSpinner,
  IonText,
} from '@ionic/angular/standalone';
import { API_URL } from '../../core/config/api.config';
import { environment } from '../../../environments/environment';
import { isZonedDateTimeInPast, zonedDateTimeToIso } from '../../utils/timezone.util';
import {
  PublicProfessional,
  PublicProfessionalService,
} from '../../services/public-professional.service';

@Component({
  selector: 'app-public-professional',
  standalone: true,
  templateUrl: './public-professional.component.html',
  styleUrls: ['./public-professional.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonAvatar,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonDatetime,
    IonSpinner,
    IonText,
  ],
})
export class PublicProfessionalComponent implements OnInit, OnDestroy {
  professional: PublicProfessional | null = null;
  slug = '';
  publicUrl = '';
  selectedDate = new Date().toISOString().split('T')[0];
  minBookingDate = this.toDateInputValue(new Date());
  maxBookingDate = this.toDateInputValue(this.addMonths(new Date(), 6));
  selectedHour: string | null = null;
  selectedAttentionMode: 'ONLINE' | 'PRESENTIAL' = 'ONLINE';
  availableHours: string[] = [];
  loading = true;
  loadingHours = false;
  isBooking = false;
  statusMessage = '';
  readonly profileUnavailable = signal(false);
  showRegistrationPrompt = false;
  private viewRecorded = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private publicProfessionalService: PublicProfessionalService,
    private title: Title,
    private meta: Meta,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    const publicAppUrl = environment.publicAppUrl.replace(/\/$/, '');
    this.publicUrl = `${publicAppUrl}/profesional/${encodeURIComponent(this.slug)}`;
    console.log('[PublicProfile] URL generada desde perfil público', {
      origin: publicAppUrl,
      slug: this.slug,
      url: this.publicUrl,
    });
    this.loadProfile();
  }

  ngOnDestroy(): void {
    this.title.setTitle('Conecta');
  }

  private addMonths(date: Date, months: number): Date {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private toDateInputValue(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  loadProfile(): void {
    if (!this.isValidSlug(this.slug)) {
      this.loading = false;
      this.showProfileUnavailable();
      return;
    }

    this.loading = true;
    this.profileUnavailable.set(false);

    this.publicProfessionalService
      .getBySlug(this.slug)
      .pipe(timeout(15000))
      .subscribe({
      next: (professional) => {
        if (!professional?.id) {
          this.showProfileUnavailable();
          return;
        }

        this.professional = professional;
        this.showRegistrationPrompt = false;
        this.selectedAttentionMode =
          professional.attentionMode === 'PRESENTIAL' ? 'PRESENTIAL' : 'ONLINE';
        this.loading = false;
        this.cdr.markForCheck();
        this.updateSeo();
        this.recordEvent('VIEW');
        this.loadAvailability();
      },
      error: () => {
        this.showProfileUnavailable();
        this.cdr.markForCheck();
      },
      });
  }

  onDateChange(event: any): void {
    const value = event.detail.value;
    if (!value) return;

    this.selectedDate = value.split('T')[0];
    this.selectedHour = null;
    this.loadAvailability();
  }

  loadAvailability(): void {
    if (!this.professional?.id || !this.selectedDate) {
      this.loading = false;
      this.loadingHours = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadingHours = true;

    this.http
      .get<string[]>(
        `${API_URL}/appointments/available-slots?professionalId=${this.professional.id}&date=${this.selectedDate}`,
      )
      .subscribe({
        next: (hours) => {
          this.availableHours = Array.isArray(hours) ? hours : [];
          this.loading = false;
          this.loadingHours = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.availableHours = [];
          this.loading = false;
          this.loadingHours = false;
          this.cdr.markForCheck();
        },
      });
  }

  toggleHour(hour: string): void {
    if (this.isHourDisabled(hour)) return;
    this.selectedHour = this.selectedHour === hour ? null : hour;
  }

  isHourDisabled(hour: string): boolean {
    return isZonedDateTimeInPast(this.selectedDate, hour);
  }

  async shareProfile(): Promise<void> {
    if (!this.professional) return;

    const shareData = {
      title: `${this.professional.name} en Conecta`,
      text: `Agenda con ${this.professional.name}, ${this.professional.specialty}, en Conecta.`,
      url: this.publicUrl,
    };

    console.log('[PublicProfile] URL final compartida', shareData.url);

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        this.recordEvent('SHARE');
        return;
      }

      await this.copyProfileLink();
    } catch {
      await this.copyProfileLink();
    }
  }

  async copyProfileLink(): Promise<void> {
    try {
      console.log('[PublicProfile] URL final copiada', this.publicUrl);
      await navigator.clipboard.writeText(this.publicUrl);
      this.statusMessage = 'Enlace copiado correctamente';
      this.recordEvent('COPY_LINK');
    } catch {
      this.statusMessage = this.publicUrl;
    }
  }

  bookAppointment(): void {
    if (!this.professional || !this.selectedHour || this.isBooking) return;

    const token = localStorage.getItem('token');

    if (!token) {
      this.showRegistrationPrompt = true;
      this.cdr.markForCheck();
      return;
    }

    this.isBooking = true;
    this.statusMessage = '';

    this.http
      .post(`${API_URL}/appointments`, {
        professionalId: this.professional.id,
        date: zonedDateTimeToIso(this.selectedDate, this.selectedHour),
        documentRequested: false,
        attentionMode: this.selectedAttentionMode,
      })
      .subscribe({
        next: () => {
          this.statusMessage = 'Cita solicitada correctamente';
          this.selectedHour = null;
          this.isBooking = false;
          window.setTimeout(() => this.router.navigate(['/tabs/appointments']), 700);
        },
        error: (err) => {
          this.statusMessage = err?.error?.message || 'No se pudo solicitar la cita.';
          this.isBooking = false;
        },
      });
  }

  goToLogin(): void {
    this.navigateToAuthentication('login');
  }

  goToRegistration(): void {
    this.navigateToAuthentication('register');
  }

  dismissRegistrationPrompt(): void {
    this.showRegistrationPrompt = false;
  }

  goToHome(): void {
    this.router.navigate(['/login']);
  }

  contactSupport(): void {
    const supportUrl = environment.supportUrl?.trim();

    if (supportUrl) {
      window.open(supportUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    this.router.navigate(['/login'], {
      queryParams: { redirect: '/tabs/support' },
    });
  }

  private navigateToAuthentication(mode: 'login' | 'register'): void {
    this.router.navigate(['/login'], {
      queryParams: {
        mode,
        redirect: `/profesional/${this.slug}`,
      },
    });
  }

  onAttentionModeChange(mode: 'ONLINE' | 'PRESENTIAL'): void {
    if (!this.professional) return;

    if (this.professional.attentionMode === 'ONLINE') {
      this.selectedAttentionMode = 'ONLINE';
      return;
    }

    if (this.professional.attentionMode === 'PRESENTIAL') {
      this.selectedAttentionMode = 'PRESENTIAL';
      return;
    }

    this.selectedAttentionMode = mode;
  }

  getModeLabel(): string {
    if (!this.professional) return '';
    if (this.professional.attentionMode === 'PRESENTIAL') return 'Presencial';
    if (this.professional.attentionMode === 'BOTH') return 'Online o presencial';
    return 'Online';
  }

  getLocationLabel(): string {
    if (!this.professional) return '';
    const countryLabel = this.professional.country === 'ES'
      ? 'Espana'
      : this.professional.country === 'CL'
        ? 'Chile'
        : this.professional.country;

    return [this.professional.city, this.professional.region, countryLabel]
      .filter(Boolean)
      .join(', ');
  }

  getSpecialties(): string[] {
    return [...new Set(this.professional?.specialties?.filter(Boolean) || [])];
  }

  private updateSeo(): void {
    if (!this.professional) return;

    const title = `${this.professional.name} - ${this.professional.specialty} | Conecta`;
    const description =
      this.professional.shortDescription ||
      `Agenda una cita con ${this.professional.name}, ${this.professional.specialty}, en Conecta.`;

    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
  }

  private isValidSlug(slug: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  }

  private showProfileUnavailable(): void {
    this.professional = null;
    this.loading = false;
    this.loadingHours = false;
    this.statusMessage = '';
    this.profileUnavailable.set(true);
    this.title.setTitle('Perfil no disponible | Conecta');
    this.meta.updateTag({
      name: 'description',
      content: 'No pudimos encontrar el perfil que intentas abrir.',
    });
  }

  private recordEvent(type: 'VIEW' | 'COPY_LINK' | 'SHARE'): void {
    if (!this.slug) return;
    if (type === 'VIEW' && this.viewRecorded) return;

    if (type === 'VIEW') {
      this.viewRecorded = true;
    }

    this.publicProfessionalService.recordEvent(this.slug, type).subscribe({
      error: () => undefined,
    });
  }
}
