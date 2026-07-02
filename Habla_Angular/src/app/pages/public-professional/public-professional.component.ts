import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Meta, Title } from '@angular/platform-browser';
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
  private viewRecorded = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private publicProfessionalService: PublicProfessionalService,
    private title: Title,
    private meta: Meta,
  ) {}

  ngOnInit(): void {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    this.publicUrl = `${window.location.origin}/profesional/${this.slug}`;
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
    if (!this.slug) {
      this.loading = false;
      return;
    }

    this.loading = true;

    this.publicProfessionalService.getBySlug(this.slug).subscribe({
      next: (professional) => {
        this.professional = professional;
        this.selectedAttentionMode =
          professional.attentionMode === 'PRESENTIAL' ? 'PRESENTIAL' : 'ONLINE';
        this.updateSeo();
        this.recordEvent('VIEW');
        this.loading = false;
        this.loadAvailability();
      },
      error: () => {
        this.statusMessage = 'No encontramos este perfil profesional.';
        this.loading = false;
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
        },
        error: () => {
          this.availableHours = [];
          this.loading = false;
          this.loadingHours = false;
        },
      });
  }

  toggleHour(hour: string): void {
    if (this.isHourDisabled(hour)) return;
    this.selectedHour = this.selectedHour === hour ? null : hour;
  }

  isHourDisabled(hour: string): boolean {
    const [h, m] = hour.split(':');
    const selected = new Date(`${this.selectedDate}T00:00:00`);
    selected.setHours(Number(h), Number(m), 0, 0);

    return selected < new Date();
  }

  async shareProfile(): Promise<void> {
    if (!this.professional) return;

    const shareData = {
      title: `${this.professional.name} en Conecta`,
      text: `Agenda con ${this.professional.name}, ${this.professional.specialty}, en Conecta.`,
      url: this.publicUrl,
    };

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
      this.router.navigate(['/login'], {
        queryParams: { redirect: `/profesional/${this.slug}` },
      });
      return;
    }

    this.isBooking = true;
    this.statusMessage = '';

    const [hour, minute] = this.selectedHour.split(':');
    const date = new Date(`${this.selectedDate}T12:00:00`);
    date.setHours(Number(hour), Number(minute), 0, 0);

    this.http
      .post(`${API_URL}/appointments`, {
        professionalId: this.professional.id,
        date: date.toISOString(),
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
    this.router.navigate(['/login']);
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
