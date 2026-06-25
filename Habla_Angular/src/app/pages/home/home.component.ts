import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProfessionCategory, ProfessionItem, ProfessionService } from '../../services/profession.service';

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
  availableSpecialties: string[] = [];
  loading = true;
  profileLoading = false;
  savingPreferences = false;
  userRole = '';
  selectedMode: 'ALL' | 'ONLINE' | 'PRESENTIAL' | 'BOTH' = 'ALL';
  selectedCountry: 'CL' | 'ES' = 'CL';
  selectedInterests: string[] = [];
  preferredCity = '';
  preferredRegion = '';
  profileCompletionItems: string[] = [];
  preferenceNotice = '';
  showPreferenceEditor = false;
  interestSearch = '';
  dismissedQuickFilters: string[] = [];
  currentPage = 1;
  pageSize = 12;
  totalProfessionals = 0;
  totalPages = 1;
  professionCategories: ProfessionCategory[] = [];
  selectedCategorySlug = '';
  selectedProfessionSlug = '';
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private professionalsRequestId = 0;
  private initialized = false;

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
    private professionService: ProfessionService,
    private router: Router,
    //private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initializeHome();
  }

  ionViewWillEnter() {
    this.initializeHome();

    if (!this.professionCategories.length) {
      this.loadProfessionCatalog();
    }

    if (!this.loading && this.filteredProfessionals.length === 0 && this.totalProfessionals === 0) {
      this.loadProfessionals();
    }
  }

  private initializeHome() {
    if (this.initialized) return;

    this.initialized = true;
    this.loadProfessionCatalog();
    this.loadProfessionals();

    if (localStorage.getItem('token')) {
      this.loadProfilePreferences();
      return;
    }
  }

  loadProfessionCatalog() {
    const cachedCategories = localStorage.getItem('professionCategoriesCache');

    if (cachedCategories && this.professionCategories.length === 0) {
      try {
        this.professionCategories = JSON.parse(cachedCategories) || [];
        this.updateQuickFilters();
      } catch {
        localStorage.removeItem('professionCategoriesCache');
      }
    }

    this.professionService.getCategories().subscribe({
      next: (categories) => {
        this.professionCategories = categories || [];
        localStorage.setItem(
          'professionCategoriesCache',
          JSON.stringify(this.professionCategories),
        );
        this.updateQuickFilters();
      },
      error: (err) => {
        console.error('Error cargando profesiones:', err);
      },
    });
  }

  loadProfilePreferences() {
    const token = localStorage.getItem('token');

    if (!token) return;

    this.profileLoading = true;

    this.auth.getProfile().subscribe({
      next: (user: any) => {
        const previousMode = this.selectedMode;
        const previousCountry = this.selectedCountry;

        this.userRole = user?.role || '';
        this.selectedInterests = Array.isArray(user?.customerInterests)
          ? user.customerInterests
          : [];
        this.selectedMode = user?.preferredAttentionMode || 'ALL';
        this.selectedCountry = user?.country === 'ES' ? 'ES' : 'CL';
        this.preferredCity = user?.preferredCity || '';
        this.preferredRegion = user?.preferredRegion || '';
        this.profileCompletionItems = this.getCustomerProfileMissingItems(user);
        this.updateQuickFilters();

        if (previousMode !== this.selectedMode || previousCountry !== this.selectedCountry) {
          this.currentPage = 1;
          this.loadProfessionals();
        }
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
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    this.loading = true;
    const requestId = ++this.professionalsRequestId;

    this.auth.getProfessionals({
      page: this.currentPage,
      limit: this.pageSize,
      search: this.search.trim(),
      professionSlug: this.selectedProfessionSlug,
      categorySlug: this.selectedCategorySlug && !this.selectedProfessionSlug
        ? this.selectedCategorySlug
        : undefined,
      attentionMode: this.selectedMode,
      country: this.selectedCountry,
    }).subscribe({
      next: (res: any) => {
        if (requestId !== this.professionalsRequestId) return;

        const items = Array.isArray(res) ? res : res?.data || [];

        this.professionals = items;
        this.availableSpecialties = Array.isArray(res?.specialties)
          ? res.specialties
          : this.availableSpecialties;
        this.totalProfessionals = Array.isArray(res) ? items.length : Number(res?.total || 0);
        this.currentPage = Array.isArray(res) ? 1 : Number(res?.page || this.currentPage);
        this.totalPages = Array.isArray(res) ? 1 : Number(res?.totalPages || 1);
        this.applyFilters();
        this.updateQuickFilters();

        this.loading = false;
       // this.cd.detectChanges();
      },

      error: () => {
        if (requestId !== this.professionalsRequestId) return;

        this.professionals = [];
        this.filteredProfessionals = [];
        this.loading = false;
      //  this.cd.detectChanges();
      }
    });
  }

  onSearch() {
    if (this.search.trim()) {
      this.selectedCategorySlug = '';
      this.selectedProfessionSlug = '';
    }

    this.currentPage = 1;

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.loadProfessionals();
    }, 350);
  }

  applyFilters() {
    this.filteredProfessionals = [...this.professionals]
      .sort((a, b) => this.getRecommendationScore(b) - this.getRecommendationScore(a));
  }

  filterCategory(category: string) {
    this.search = category;
    this.selectedCategorySlug = '';
    this.selectedProfessionSlug = '';
    this.currentPage = 1;
    this.loadProfessionals();
  }

  selectCategory(category: ProfessionCategory) {
    this.search = '';
    this.selectedProfessionSlug = '';
    this.selectedCategorySlug = this.selectedCategorySlug === category.slug ? '' : category.slug;
    this.currentPage = 1;
    this.loadProfessionals();
  }

  selectProfession(profession: ProfessionItem) {
    this.search = '';
    this.selectedProfessionSlug = profession.slug;
    this.selectedCategorySlug = this.selectedCategorySlug || this.getCategoryByProfession(profession)?.slug || '';
    this.currentPage = 1;
    this.loadProfessionals();
  }

  clearProfessionalFilters() {
    this.search = '';
    this.selectedCategorySlug = '';
    this.selectedProfessionSlug = '';
    this.currentPage = 1;
    this.loadProfessionals();
  }

  filterMode(mode: 'ALL' | 'ONLINE' | 'PRESENTIAL' | 'BOTH') {
    this.selectedMode = mode;
    this.currentPage = 1;
    this.loadProfessionals();
  }

  toggleInterest(interest: string) {
    this.preferenceNotice = '';
    const normalizedInterest = this.normalizeText(interest);
    const existingInterest = this.selectedInterests.find(
      item => this.normalizeText(item) === normalizedInterest
    );

    if (existingInterest) {
      this.selectedInterests = this.selectedInterests.filter(
        item => this.normalizeText(item) !== normalizedInterest
      );
    } else {
      if (this.selectedInterests.length >= 9) {
        this.preferenceNotice = 'Ya tienes 9 sectores. Saca alguno para agregar otro.';
        return;
      }

      this.dismissedQuickFilters = this.dismissedQuickFilters.filter(
        item => this.normalizeText(item) !== normalizedInterest
      );
      this.selectedInterests = [...this.selectedInterests, interest];
    }

    this.updateQuickFilters();
    this.applyFilters();
  }

  removeInterest(item: string, event?: Event): void {
    event?.stopPropagation();
    const normalizedItem = this.normalizeText(item);

    this.selectedInterests = this.selectedInterests.filter(
      interest => this.normalizeText(interest) !== normalizedItem
    );
    this.preferenceNotice = '';
    this.updateQuickFilters();
    this.applyFilters();
  }

  savePreferences() {
    this.savingPreferences = true;
    this.selectedInterests = this.getUniqueInterests(this.selectedInterests).slice(0, 9);

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
        this.savingPreferences = false;
      },
      error: (err) => {
        console.error('Error guardando preferencias:', err);
        this.savingPreferences = false;
        this.preferenceNotice = 'No se pudieron guardar las preferencias. Intenta nuevamente.';
      }
    });
  }

  getCategoriesFromData(): string[] {
    const catalogProfessions = this.getCatalogProfessions().map(item => item.name);

    return catalogProfessions.length
      ? catalogProfessions
      : this.availableSpecialties.length
      ? this.availableSpecialties
      : [...new Set(this.professionals.map(p => p.specialty).filter(Boolean))];
  }

  updateQuickFilters(): void {
    this.quickFilters = [
      ...this.selectedInterests.filter(Boolean),
      ...this.getCategoriesFromData(),
      ...this.interestOptions,
    ].filter((item, index, list) =>
      item && list.findIndex((value) => this.normalizeText(value) === this.normalizeText(item)) === index
    )
      .filter(item => !this.dismissedQuickFilters.some(
        dismissed => this.normalizeText(dismissed) === this.normalizeText(item)
      ))
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

  getCatalogProfessions(): ProfessionItem[] {
    return this.professionCategories.flatMap(category => category.professions || []);
  }

  getSelectedCategory(): ProfessionCategory | undefined {
    return this.professionCategories.find(category => category.slug === this.selectedCategorySlug);
  }

  getVisibleProfessions(): ProfessionItem[] {
    return this.getSelectedCategory()?.professions || [];
  }

  getCategoryByProfession(profession: ProfessionItem): ProfessionCategory | undefined {
    return this.professionCategories.find(category =>
      (category.professions || []).some(item => item.slug === profession.slug)
    );
  }

  getProfessionalSpecialty(prof: any): string {
    return prof?.professionName || prof?.specialty || 'Especialidad por definir';
  }

  getProfessionalLocation(prof: any): string {
    const countryLabel = prof?.country === 'ES'
      ? 'Espana'
      : prof?.country === 'CL'
        ? 'Chile'
        : prof?.country;

    return [prof?.city, countryLabel].filter(Boolean).join(', ');
  }

  isInterestSelected(interest: string): boolean {
    return this.selectedInterests.some(
      item => this.normalizeText(item) === this.normalizeText(interest)
    );
  }

  getUniqueInterests(items: string[]): string[] {
    return items.filter((item, index, list) =>
      item && list.findIndex((value) => this.normalizeText(value) === this.normalizeText(item)) === index
    );
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
      salud: '\u{1F49C}',
      'belleza y estetica': '\u{2728}',
      'deporte y rehabilitacion': '\u{1F4AA}',
      'asesoria profesional': '\u{1F4BC}',
      'educacion y coaching': '\u{1F393}',
      veterinaria: '\u{1F43E}',
      peluquero: '\u{2702}\u{FE0F}',
      estilista: '\u{2728}',
      barbero: '\u{1FA92}',
      depilacion: '\u{2728}',
      manicure: '\u{1F485}',
      pedicure: '\u{1F9B6}',
      maquillaje: '\u{1F484}',
      masajes: '\u{1F486}',
      abogado: '\u{2696}\u{FE0F}',
      contador: '\u{1F9EE}',
      veterinario: '\u{1F43E}',
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
    const specialty = this.normalizeText(this.getProfessionalSpecialty(prof));
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

  goToDetail(professional: any) {
    if (professional?.slug) {
      this.router.navigate(['/profesional', professional.slug]);
      return;
    }

    this.router.navigate(['/tabs/professional', professional?.id]);
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

  getPages(): number[] {
    const maxVisible = 5;
    const half = Math.floor(maxVisible / 2);
    const start = Math.max(1, Math.min(this.currentPage - half, this.totalPages - maxVisible + 1));
    const end = Math.min(this.totalPages, start + maxVisible - 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;

    this.currentPage = page;
    this.loadProfessionals();
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
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

