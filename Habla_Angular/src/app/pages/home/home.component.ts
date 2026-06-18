import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

import {
  IonContent,
  IonCard,
  IonItem,
  IonAvatar,
  IonLabel,
  IonButton,
  IonSearchbar,
  IonSpinner,
  IonCardContent
} from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonCard,
    IonItem,
    IonAvatar,
    IonLabel,
    IonButton,
    IonSearchbar,
    IonSpinner,
    IonCardContent,
  ]
})
export class HomePage implements OnInit {

  search = '';
  professionals: any[] = [];
  filteredProfessionals: any[] = [];
  loading = true;
  profileLoading = false;
  savingPreferences = false;
  userRole = '';
  selectedMode: 'ALL' | 'ONLINE' | 'PRESENTIAL' | 'BOTH' = 'ALL';
  selectedInterests: string[] = [];
  preferredCity = '';
  preferredRegion = '';
  profileCompletionItems: string[] = [];
  preferenceNotice = '';
  showPreferenceEditor = false;
  interestSearch = '';

  quickFilters: string[] = [];
  interestOptions = [
    'Psicologo',
    'Nutricionista',
    'Kinesiologo',
    'Terapeuta',
    'Cardiologo',
    'Dentista',
    'Coach',
    'Psiquiatra',
    'Estetica',
  ];
  modalityFilters = [
    { label: 'Todos', value: 'ALL' },
    { label: 'Online', value: 'ONLINE' },
    { label: 'Presencial', value: 'PRESENTIAL' },
    { label: 'Mixto', value: 'BOTH' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    //private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadProfilePreferences();
    this.loadProfessionals();
  }

  loadProfilePreferences() {
    const token = localStorage.getItem('token');

    if (!token) return;

    this.profileLoading = true;

    this.auth.getProfile().subscribe({
      next: (user: any) => {
        this.userRole = user?.role || '';
        this.selectedInterests = Array.isArray(user?.customerInterests)
          ? user.customerInterests
          : [];
        this.selectedMode = user?.preferredAttentionMode || 'ALL';
        this.preferredCity = user?.preferredCity || '';
        this.preferredRegion = user?.preferredRegion || '';
        this.profileCompletionItems = this.getCustomerProfileMissingItems(user);
        this.updateQuickFilters();
        this.applyFilters();
      },
      error: () => {
        this.userRole = '';
      },
      complete: () => {
        this.profileLoading = false;
      }
    });
  }

  loadProfessionals() {
    this.loading = true;

    this.auth.getProfessionals().subscribe({
      next: (res: any) => {
        this.professionals = res || [];
        this.applyFilters();
        this.updateQuickFilters();

        this.loading = false;
       // this.cd.detectChanges();
      },

      error: () => {
        this.professionals = [];
        this.filteredProfessionals = [];
        this.loading = false;
      //  this.cd.detectChanges();
      }
    });
  }

  onSearch() {
    this.applyFilters();
  }

  applyFilters() {
    const s = this.normalizeText(this.search);

    this.filteredProfessionals = this.professionals.filter(p => {
      const matchesText = !s ||
        this.normalizeText(p.name).includes(s) ||
        this.normalizeText(p.specialty).includes(s) ||
        this.normalizeText(p.email).includes(s) ||
        this.normalizeText(p.officeCity).includes(s) ||
        this.normalizeText(p.officeRegion).includes(s);

      const mode = p.attentionMode || 'ONLINE';
      const matchesMode = this.selectedMode === 'ALL' || mode === this.selectedMode;
      const matchesCity = !this.preferredCity.trim() ||
        this.normalizeText(p.officeCity).includes(this.normalizeText(this.preferredCity)) ||
        mode === 'ONLINE';

      return matchesText && matchesMode && matchesCity;
    }).sort((a, b) => this.getRecommendationScore(b) - this.getRecommendationScore(a));
  }

  filterCategory(category: string) {
    this.search = category;
    this.applyFilters();
  }

  filterMode(mode: 'ALL' | 'ONLINE' | 'PRESENTIAL' | 'BOTH') {
    this.selectedMode = mode;
    this.applyFilters();
  }

  toggleInterest(interest: string) {
    this.preferenceNotice = '';

    if (this.selectedInterests.includes(interest)) {
      this.selectedInterests = this.selectedInterests.filter(item => item !== interest);
    } else {
      if (this.selectedInterests.length >= 9) {
        this.preferenceNotice = 'Puedes elegir hasta 9 sectores directos.';
        return;
      }

      this.selectedInterests = [...this.selectedInterests, interest];
    }

    this.updateQuickFilters();
    this.applyFilters();
  }

  savePreferences() {
    this.savingPreferences = true;

    this.auth.updateProfile({
      customerInterests: this.selectedInterests,
      preferredAttentionMode: this.selectedMode === 'ALL' ? null : this.selectedMode,
      preferredCity: this.preferredCity,
      preferredRegion: this.preferredRegion,
    }).subscribe({
      next: () => {
        this.profileCompletionItems = this.getCustomerProfileMissingItems({
          role: this.userRole,
          name: localStorage.getItem('name'),
          customerInterests: this.selectedInterests,
          preferredAttentionMode: this.selectedMode === 'ALL' ? null : this.selectedMode,
          preferredCity: this.preferredCity,
          preferredRegion: this.preferredRegion,
        });
        this.preferenceNotice = 'Preferencias guardadas.';
        this.updateQuickFilters();
        this.applyFilters();
      },
      error: (err) => {
        console.error('Error guardando preferencias:', err);
      },
      complete: () => {
        this.savingPreferences = false;
      }
    });
  }

  getCategoriesFromData(): string[] {
    return [...new Set(this.professionals.map(p => p.specialty).filter(Boolean))];
  }

  updateQuickFilters(): void {
    this.quickFilters = [
      ...this.selectedInterests.filter(Boolean),
      ...this.getCategoriesFromData(),
      ...this.interestOptions,
    ].filter((item, index, list) =>
      item && list.findIndex((value) => this.normalizeText(value) === this.normalizeText(item)) === index
    )
      .slice(0, 9);
  }

  getFilteredInterestOptions(): string[] {
    const query = this.normalizeText(this.interestSearch);

    return [
      ...this.interestOptions,
      ...this.getCategoriesFromData(),
    ].filter((item, index, list) =>
      item && list.findIndex((value) => this.normalizeText(value) === this.normalizeText(item)) === index
    )
      .filter((item) => !query || this.normalizeText(item).includes(query));
  }

  getIcon(category: string): string {
    const map: Record<string, string> = {
      psicologo: '\u{1F9E0}',
      nutricionista: '\u{1F957}',
      kinesiologo: '\u{1F9B4}',
      terapeuta: '\u{1F9D8}',
      cardiologo: '\u{1F49C}',
      dentista: '\u{1F9B7}',
      coach: '\u{1F9D1}\u200D\u{1F4BC}',
      psiquiatra: '\u{1F9E0}',
      estetica: '\u{2728}',
    };

    return map[this.normalizeText(category)] || '\u{1F9D1}\u200D\u{2695}\u{FE0F}';
  }

  getModeLabel(prof: any): string {
    const mode = prof?.attentionMode || 'ONLINE';

    if (mode === 'PRESENTIAL') return 'Presencial';
    if (mode === 'BOTH') return 'Online + presencial';

    return 'Online';
  }

  getModeDetail(prof: any): string {
    const mode = prof?.attentionMode || 'ONLINE';

    if (mode === 'PRESENTIAL') {
      return [prof.officeCity, prof.officeRegion].filter(Boolean).join(', ') || 'Atencion presencial';
    }

    if (mode === 'BOTH') {
      const city = [prof.officeCity, prof.officeRegion].filter(Boolean).join(', ');
      return city ? `Online o ${city}` : 'Elige online o presencial';
    }

    if (prof?.videoProvider === 'GOOGLE_MEET') return 'Google Meet';
    if (prof?.videoProvider === 'ZOOM') return 'Zoom';
    if (prof?.videoProvider === 'CUSTOM') return 'Enlace personalizado';

    return 'Sala online';
  }

  getRecommendationScore(prof: any): number {
    let score = 0;
    const specialty = this.normalizeText(prof?.specialty);
    const description = this.normalizeText(prof?.description);

    for (const interest of this.selectedInterests) {
      const normalized = this.normalizeText(interest);
      if (specialty.includes(normalized) || description.includes(normalized)) {
        score += 4;
      }
    }

    if (this.selectedMode !== 'ALL' && (prof?.attentionMode || 'ONLINE') === this.selectedMode) {
      score += 2;
    }

    if (this.preferredCity && this.normalizeText(prof?.officeCity).includes(this.normalizeText(this.preferredCity))) {
      score += 2;
    }

    return score;
  }

  normalizeText(value: any): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  goToDetail(id: string) {
    this.router.navigate(['/tabs/professional', id]);
  }

  goToProfile() {
    this.router.navigate(['/tabs/profile']);
  }

  scrollToPreferences(): void {
    this.showPreferenceEditor = true;

    window.setTimeout(() => {
      document
        .getElementById('preference-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  closePreferences(): void {
    this.showPreferenceEditor = false;
    this.preferenceNotice = '';
    this.interestSearch = '';
  }

  get shouldShowProfileCompletion(): boolean {
    return !this.profileLoading &&
      this.userRole !== 'PROFESSIONAL' &&
      this.profileCompletionItems.length > 0;
  }

  getProfileCompletionPercent(): number {
    const total = 4;
    return Math.max(0, Math.round(((total - this.profileCompletionItems.length) / total) * 100));
  }

  private getCustomerProfileMissingItems(user: any): string[] {
    const missing: string[] = [];

    if (!user?.name) {
      missing.push('Agrega tu nombre');
    }

    if (!Array.isArray(user?.customerInterests) || user.customerInterests.length === 0) {
      missing.push('Selecciona tus intereses');
    }

    if (!user?.preferredAttentionMode) {
      missing.push('Elige modalidad preferida');
    }

    if (!user?.preferredCity && !user?.preferredRegion) {
      missing.push('Agrega ciudad o region preferida');
    }

    return missing;
  }
}

