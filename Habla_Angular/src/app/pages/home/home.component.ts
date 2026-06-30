import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, Subscription, timeout } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ProfessionCategory, ProfessionItem, ProfessionService } from '../../services/profession.service';

import {
  IonContent,
  IonButton,
  IonSearchbar,
  IonSpinner,
} from '@ionic/angular/standalone';

type SearchSuggestion = {
  type: 'profession' | 'professional';
  id: string;
  slug?: string;
  label: string;
  specialty?: string;
  categoryName?: string | null;
  categorySlug?: string | null;
  city?: string | null;
};

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonButton,
    IonSearchbar,
    IonSpinner,
  ]
})
export class HomePage implements OnInit, OnDestroy {


  search = '';
  professionals: any[] = [];
  filteredProfessionals: any[] = [];
  availableSpecialties: string[] = [];
  loading = false;
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
  searchSuggestions: SearchSuggestion[] = [];
  suggestionsLoading = false;
  showSuggestions = false;
  activeSuggestionIndex = -1;
  professionCategories: ProfessionCategory[] = [];
  selectedCategorySlug = '';
  selectedProfessionSlug = '';
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private suggestionsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private suggestionsSubscription?: Subscription;
  private loadingFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private professionalsSubscription?: Subscription;
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
    private cdr: ChangeDetectorRef,
  ) {}

  private refreshView(): void {
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.initializeHome();
  }

  ngOnDestroy() {
    this.professionalsSubscription?.unsubscribe();
    this.suggestionsSubscription?.unsubscribe();

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    if (this.suggestionsDebounceTimer) {
      clearTimeout(this.suggestionsDebounceTimer);
    }

    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
    }
  }

  ionViewWillEnter() {
    this.initializeHome();

    if (!this.professionCategories.length) {
      this.loadProfessionCatalog();
    }

  }

  private initializeHome() {
    if (this.initialized) return;

    this.initialized = true;
    this.loadProfessionCatalog();

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
        const previousCountry = this.selectedCountry;

        this.userRole = user?.role || '';
        this.selectedInterests = Array.isArray(user?.customerInterests)
          ? user.customerInterests
          : [];
        this.selectedCountry = user?.country === 'ES' ? 'ES' : 'CL';
        this.preferredCity = user?.preferredCity || '';
        this.preferredRegion = user?.preferredRegion || '';
        this.profileCompletionItems = this.getCustomerProfileMissingItems(user);
        this.updateQuickFilters();

        if (previousCountry !== this.selectedCountry && this.hasActiveProfessionalSearch()) {
          this.currentPage = 1;
          this.loadProfessionals();
        }
      },
      error: () => {
        this.userRole = '';
      },
      complete: () => {
        this.profileLoading = false;
        this.refreshView();
      }
    });
  }

  loadProfessionals() {
    if (!this.hasActiveProfessionalSearch()) {
      this.clearProfessionalResults();
      return;
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    this.professionalsSubscription?.unsubscribe();

    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
      this.loadingFallbackTimer = null;
    }

    this.loading = true;
    this.professionals = [];
    this.filteredProfessionals = [];
    this.totalProfessionals = 0;
    this.totalPages = 1;
    this.refreshView();
    const requestId = ++this.professionalsRequestId;
    const requestParams = {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.search.trim(),
      professionSlug: this.selectedProfessionSlug,
      categorySlug: this.selectedCategorySlug && !this.selectedProfessionSlug
        ? this.selectedCategorySlug
        : undefined,
      attentionMode: this.selectedMode,
      country: this.selectedCountry,
    };

    this.loadingFallbackTimer = setTimeout(() => {
      if (requestId === this.professionalsRequestId && this.loading) {
        this.loading = false;
        this.refreshView();
      }
    }, 2500);

    this.professionalsSubscription = this.auth.getProfessionals(requestParams).pipe(
      timeout(8000),
      finalize(() => {
        if (requestId === this.professionalsRequestId && this.loading) {
          this.loading = false;
          this.refreshView();
        }
      }),
    ).subscribe({
      next: (res: any) => {
        if (requestId !== this.professionalsRequestId) return;

        if (this.loadingFallbackTimer) {
          clearTimeout(this.loadingFallbackTimer);
          this.loadingFallbackTimer = null;
        }

        try {
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
        } catch (error) {
          console.error('[Home] flujo detenido dentro de next', error);
        } finally {
          this.loading = false;
          this.refreshView();
        }
      },

      error: (error) => {
        if (requestId !== this.professionalsRequestId) return;

        if (this.loadingFallbackTimer) {
          clearTimeout(this.loadingFallbackTimer);
          this.loadingFallbackTimer = null;
        }

        this.professionals = [];
        this.filteredProfessionals = [];
        this.totalProfessionals = 0;
        this.totalPages = 1;
        this.loading = false;
        this.refreshView();
        console.error('[Conecta][Home professionals error]', error);
      },
      complete: () => {
        if (requestId !== this.professionalsRequestId) return;
        this.loading = false;
        this.refreshView();
      },
    });
  }

  onSearch() {
    if (this.search.trim()) {
      this.selectedCategorySlug = '';
      this.selectedProfessionSlug = '';
    }

    this.currentPage = 1;
    this.queueSearchSuggestions();

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      if (this.search.trim().length === 0) {
        this.clearProfessionalResults();
        return;
      }

      this.loadProfessionals();
    }, 350);
  }

  onSearchFocus(): void {
    this.showSuggestions = this.search.trim().length >= 2;
    this.queueSearchSuggestions();
  }

  onSearchBlur(): void {
    window.setTimeout(() => {
      this.showSuggestions = false;
      this.activeSuggestionIndex = -1;
      this.refreshView();
    }, 140);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.showSuggestions || this.searchSuggestions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex = Math.min(
        this.activeSuggestionIndex + 1,
        this.searchSuggestions.length - 1,
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex = Math.max(this.activeSuggestionIndex - 1, 0);
      return;
    }

    if (event.key === 'Enter' && this.activeSuggestionIndex >= 0) {
      event.preventDefault();
      this.selectSearchSuggestion(this.searchSuggestions[this.activeSuggestionIndex]);
    }

    if (event.key === 'Escape') {
      this.showSuggestions = false;
      this.activeSuggestionIndex = -1;
    }
  }

  queueSearchSuggestions(): void {
    const query = this.search.trim();

    if (this.suggestionsDebounceTimer) {
      clearTimeout(this.suggestionsDebounceTimer);
    }

    if (query.length < 2) {
      this.searchSuggestions = [];
      this.suggestionsLoading = false;
      this.showSuggestions = false;
      this.activeSuggestionIndex = -1;
      return;
    }

    this.showSuggestions = true;
    this.suggestionsLoading = true;

    this.suggestionsDebounceTimer = setTimeout(() => {
      this.loadSearchSuggestions(query);
    }, 300);
  }

  loadSearchSuggestions(query: string): void {
    this.suggestionsSubscription?.unsubscribe();

    this.suggestionsSubscription = this.auth.getSearchSuggestions({
      q: query,
      country: this.selectedCountry,
    }).pipe(
      timeout(5000),
      finalize(() => {
        this.suggestionsLoading = false;
        this.refreshView();
      }),
    ).subscribe({
      next: (suggestions) => {
        if (this.search.trim() !== query) return;

        this.searchSuggestions = suggestions.slice(0, 8);
        this.activeSuggestionIndex = this.searchSuggestions.length ? 0 : -1;
        this.showSuggestions = true;
      },
      error: () => {
        this.searchSuggestions = [];
        this.activeSuggestionIndex = -1;
      },
    });
  }

  selectSearchSuggestion(suggestion: SearchSuggestion): void {
    this.showSuggestions = false;
    this.activeSuggestionIndex = -1;

    if (suggestion.type === 'professional') {
      this.goToDetail({
        id: suggestion.id,
        slug: suggestion.slug,
      });
      return;
    }

    if (suggestion.slug) {
      this.search = suggestion.label;
      this.selectedProfessionSlug = suggestion.slug;
      this.selectedCategorySlug = suggestion.categorySlug || '';
      this.currentPage = 1;
      this.loadProfessionals();
      return;
    }

    this.search = suggestion.label;
    this.currentPage = 1;
    this.loadProfessionals();
  }

  getSuggestionIcon(suggestion: SearchSuggestion): string {
    if (suggestion.type === 'professional') return '👤';

    return '🔎';
  }

  applyFilters() {
    this.filteredProfessionals = [...this.professionals]
      .sort((a, b) => this.getRecommendationScore(b) - this.getRecommendationScore(a));
  }

  filterCategory(category: string) {
    const profession = this.findCatalogProfessionByName(category);

    if (profession) {
      this.selectProfession(profession);
      return;
    }

    this.search = category;
    this.selectedCategorySlug = '';
    this.selectedProfessionSlug = '';
    this.currentPage = 1;
    this.loadProfessionals();
  }

  isQuickFilterActive(category: string): boolean {
    const profession = this.findCatalogProfessionByName(category);

    if (profession) {
      return this.selectedProfessionSlug === profession.slug;
    }

    return this.normalizeText(this.search) === this.normalizeText(category);
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
    this.clearProfessionalResults();
  }

  filterMode(mode: 'ALL' | 'ONLINE' | 'PRESENTIAL' | 'BOTH') {
    this.selectedMode = mode;
    this.currentPage = 1;

    if (this.hasActiveProfessionalSearch()) {
      this.loadProfessionals();
    }
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
  const items = [
    ...this.selectedInterests.filter(Boolean),
    ...this.getCategoriesFromData(),
    ...this.interestOptions,
  ]
    .filter(
      (item, index, list) =>
        item &&
        list.findIndex(
          value => this.normalizeText(value) === this.normalizeText(item)
        ) === index
    )
    .filter(
      item =>
        !this.dismissedQuickFilters.some(
          dismissed =>
            this.normalizeText(dismissed) === this.normalizeText(item)
        )
    );

  this.quickFilters = items.slice(0, 6);
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

  findCatalogProfessionByName(name: string): ProfessionItem | undefined {
    const normalizedName = this.normalizeText(name);

    return this.getCatalogProfessions().find((profession) => {
      const aliases = Array.isArray(profession.aliases) ? profession.aliases : [];

      return [
        profession.name,
        profession.slug,
        ...aliases,
      ].some((value) => this.normalizeText(value) === normalizedName);
    });
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
    if (prof?.videoProvider === 'MICROSOFT_TEAMS') return 'Microsoft Teams';
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

  hasActiveProfessionalSearch(): boolean {
    return Boolean(
      this.search.trim() ||
      this.selectedCategorySlug ||
      this.selectedProfessionSlug
    );
  }

  private clearProfessionalResults(): void {
    this.professionalsSubscription?.unsubscribe();

    if (this.loadingFallbackTimer) {
      clearTimeout(this.loadingFallbackTimer);
      this.loadingFallbackTimer = null;
    }

    this.loading = false;
    this.professionals = [];
    this.filteredProfessionals = [];
    this.totalProfessionals = 0;
    this.totalPages = 1;
    this.currentPage = 1;
    this.refreshView();
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







