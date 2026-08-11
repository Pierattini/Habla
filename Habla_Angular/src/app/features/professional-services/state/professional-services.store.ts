import { computed, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import {
  CreateProfessionalServicePayload,
  ProfessionalService,
  ProfessionalServiceMode,
  ProfessionalServicesCatalog,
  PublicProfessionalService,
  PublicProfessionalServicesCatalog,
  UpdateProfessionalServicePayload,
} from '../models/professional-service.models';
import { ProfessionalServicesApiService } from '../services/professional-services-api.service';

export const MAX_PROFESSIONAL_SERVICES = 10;

@Injectable({ providedIn: 'root' })
export class ProfessionalServicesStore {
  private readonly servicesState = signal<ProfessionalService[]>([]);
  private readonly publicServicesState = signal<PublicProfessionalService[]>([]);
  private readonly selectedServiceState = signal<ProfessionalService | null>(null);
  private readonly serviceModeState = signal<ProfessionalServiceMode>('SINGLE_PRICE');
  private readonly publicServiceModeState = signal<ProfessionalServiceMode>('SINGLE_PRICE');
  private readonly loadingState = signal(false);
  private readonly publicLoadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly deletingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly publicErrorState = signal<string | null>(null);
  private readonly initializedState = signal(false);
  private readonly publicInitializedSlugState = signal<string | null>(null);

  private ownCatalogRequest?: Observable<ProfessionalServicesCatalog>;
  private publicCatalogRequest?: Observable<PublicProfessionalServicesCatalog>;

  readonly services = this.servicesState.asReadonly();
  readonly publicServices = this.publicServicesState.asReadonly();
  readonly selectedService = this.selectedServiceState.asReadonly();
  readonly serviceMode = this.serviceModeState.asReadonly();
  readonly publicServiceMode = this.publicServiceModeState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly publicLoading = this.publicLoadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly deleting = this.deletingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly publicError = this.publicErrorState.asReadonly();
  readonly initialized = this.initializedState.asReadonly();
  readonly publicInitializedSlug = this.publicInitializedSlugState.asReadonly();

  readonly orderedServices = computed(() =>
    [...this.servicesState()].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt),
    ),
  );
  readonly activeServices = computed(() =>
    this.orderedServices().filter((service) => service.status === 'ACTIVE'),
  );
  readonly visibleServices = computed(() =>
    this.activeServices().filter((service) => service.showInProfile),
  );
  readonly orderedPublicServices = computed(() =>
    [...this.publicServicesState()].sort((left, right) => left.sortOrder - right.sortOrder),
  );
  readonly isCatalogMode = computed(() => this.serviceModeState() === 'SERVICE_CATALOG');
  readonly canCreateService = computed(
    () => this.servicesState().length < MAX_PROFESSIONAL_SERVICES,
  );
  readonly remainingServiceSlots = computed(() =>
    Math.max(0, MAX_PROFESSIONAL_SERVICES - this.servicesState().length),
  );
  readonly hasVisiblePublicServices = computed(
    () =>
      this.publicServiceModeState() === 'SERVICE_CATALOG' && this.publicServicesState().length > 0,
  );

  constructor(private readonly api: ProfessionalServicesApiService) {}

  loadServices(force = false): Observable<ProfessionalServicesCatalog> {
    if (this.initializedState() && !force) {
      return of(this.ownCatalogSnapshot());
    }

    if (this.ownCatalogRequest) {
      return this.ownCatalogRequest;
    }

    this.loadingState.set(true);
    this.errorState.set(null);

    const request = this.api.getOwnCatalog().pipe(
      tap((catalog) => {
        this.servicesState.set(Array.isArray(catalog.data) ? catalog.data : []);
        this.serviceModeState.set(catalog.serviceMode || 'SINGLE_PRICE');
        this.initializedState.set(true);
      }),
      catchError((error) => {
        this.errorState.set(this.getFriendlyError(error));
        return throwError(() => error);
      }),
      finalize(() => {
        this.loadingState.set(false);
        this.ownCatalogRequest = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.ownCatalogRequest = request;
    return request;
  }

  loadPublicServices(slug: string, force = false): Observable<PublicProfessionalServicesCatalog> {
    const cleanSlug = slug.trim();

    if (this.publicInitializedSlugState() === cleanSlug && !force) {
      return of(this.publicCatalogSnapshot());
    }

    if (this.publicCatalogRequest) {
      return this.publicCatalogRequest;
    }

    this.publicLoadingState.set(true);
    this.publicErrorState.set(null);

    const request = this.api.getPublicCatalog(cleanSlug).pipe(
      tap((catalog) => {
        this.publicServicesState.set(Array.isArray(catalog.data) ? catalog.data : []);
        this.publicServiceModeState.set(catalog.serviceMode || 'SINGLE_PRICE');
        this.publicInitializedSlugState.set(cleanSlug);
      }),
      catchError((error) => {
        this.publicServicesState.set([]);
        this.publicServiceModeState.set('SINGLE_PRICE');
        this.publicErrorState.set(this.getFriendlyError(error));
        return throwError(() => error);
      }),
      finalize(() => {
        this.publicLoadingState.set(false);
        this.publicCatalogRequest = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.publicCatalogRequest = request;
    return request;
  }

  createService(payload: CreateProfessionalServicePayload): Observable<ProfessionalService> {
    if (!this.canCreateService()) {
      const message = `Puedes registrar un máximo de ${MAX_PROFESSIONAL_SERVICES} servicios.`;
      this.errorState.set(message);
      return throwError(() => new Error(message));
    }

    this.savingState.set(true);
    this.errorState.set(null);

    return this.api.create(payload).pipe(
      tap((created) => {
        this.servicesState.update((services) => [...services, created]);
        this.selectedServiceState.set(created);
      }),
      catchError((error) => this.handleMutationError(error)),
      finalize(() => this.savingState.set(false)),
    );
  }

  updateService(
    id: string,
    payload: UpdateProfessionalServicePayload,
  ): Observable<ProfessionalService> {
    this.savingState.set(true);
    this.errorState.set(null);

    return this.api.update(id, payload).pipe(
      tap((updated) => this.replaceService(updated)),
      catchError((error) => this.handleMutationError(error)),
      finalize(() => this.savingState.set(false)),
    );
  }

  changeServiceMode(
    serviceMode: ProfessionalServiceMode,
  ): Observable<{ serviceMode: ProfessionalServiceMode }> {
    this.savingState.set(true);
    this.errorState.set(null);

    return this.api.changeMode(serviceMode).pipe(
      tap((response) => this.serviceModeState.set(response.serviceMode || 'SINGLE_PRICE')),
      catchError((error) => this.handleMutationError(error)),
      finalize(() => this.savingState.set(false)),
    );
  }

  toggleStatus(service: ProfessionalService): Observable<ProfessionalService> {
    const status = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.savingState.set(true);
    this.errorState.set(null);

    return this.api.changeStatus(service.id, status).pipe(
      tap((updated) => this.replaceService(updated)),
      catchError((error) => this.handleMutationError(error)),
      finalize(() => this.savingState.set(false)),
    );
  }

  toggleVisibility(service: ProfessionalService): Observable<ProfessionalService> {
    this.savingState.set(true);
    this.errorState.set(null);

    return this.api.changeVisibility(service.id, !service.showInProfile).pipe(
      tap((updated) => this.replaceService(updated)),
      catchError((error) => this.handleMutationError(error)),
      finalize(() => this.savingState.set(false)),
    );
  }

  reorderServices(orderedIds: string[]): Observable<ProfessionalService[]> {
    this.savingState.set(true);
    this.errorState.set(null);

    return this.api.reorder(orderedIds).pipe(
      tap((services) => this.servicesState.set(services)),
      catchError((error) => this.handleMutationError(error)),
      finalize(() => this.savingState.set(false)),
    );
  }

  archiveService(id: string): Observable<ProfessionalService> {
    this.deletingState.set(true);
    this.errorState.set(null);

    return this.api.archive(id).pipe(
      tap(() => {
        this.servicesState.update((services) => services.filter((service) => service.id !== id));
        if (this.selectedServiceState()?.id === id) {
          this.selectedServiceState.set(null);
        }
      }),
      catchError((error) => this.handleMutationError(error)),
      finalize(() => this.deletingState.set(false)),
    );
  }

  selectService(service: ProfessionalService | null): void {
    this.selectedServiceState.set(service);
  }

  clearError(): void {
    this.errorState.set(null);
    this.publicErrorState.set(null);
  }

  clearPublicCatalog(): void {
    this.publicServicesState.set([]);
    this.publicServiceModeState.set('SINGLE_PRICE');
    this.publicLoadingState.set(false);
    this.publicErrorState.set(null);
    this.publicInitializedSlugState.set(null);
    this.publicCatalogRequest = undefined;
  }

  resetState(): void {
    this.servicesState.set([]);
    this.publicServicesState.set([]);
    this.selectedServiceState.set(null);
    this.serviceModeState.set('SINGLE_PRICE');
    this.publicServiceModeState.set('SINGLE_PRICE');
    this.loadingState.set(false);
    this.publicLoadingState.set(false);
    this.savingState.set(false);
    this.deletingState.set(false);
    this.errorState.set(null);
    this.publicErrorState.set(null);
    this.initializedState.set(false);
    this.publicInitializedSlugState.set(null);
    this.ownCatalogRequest = undefined;
    this.publicCatalogRequest = undefined;
  }

  private replaceService(updated: ProfessionalService): void {
    this.servicesState.update((services) =>
      services.map((service) => (service.id === updated.id ? updated : service)),
    );

    if (this.selectedServiceState()?.id === updated.id) {
      this.selectedServiceState.set(updated);
    }
  }

  private handleMutationError(error: unknown): Observable<never> {
    this.errorState.set(this.getFriendlyError(error));
    return throwError(() => error);
  }

  private getFriendlyError(error: unknown): string {
    const response = error as {
      status?: number;
      error?: { message?: string | string[] };
    };
    const message = response?.error?.message;

    if (Array.isArray(message)) {
      return message[0] || 'No pudimos completar la operación.';
    }

    if (typeof message === 'string' && message.trim()) {
      return message;
    }

    if (response?.status === 0) {
      return 'No pudimos conectarnos. Revisa tu conexión e inténtalo nuevamente.';
    }

    return 'No pudimos completar la operación. Inténtalo nuevamente.';
  }

  private ownCatalogSnapshot(): ProfessionalServicesCatalog {
    return {
      serviceMode: this.serviceModeState(),
      data: this.servicesState(),
    };
  }

  private publicCatalogSnapshot(): PublicProfessionalServicesCatalog {
    return {
      serviceMode: this.publicServiceModeState(),
      data: this.publicServicesState(),
    };
  }
}
