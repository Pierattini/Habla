import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfessionalService } from '../models/professional-service.models';
import { ProfessionalServicesStore } from './professional-services.store';

describe('ProfessionalServicesStore', () => {
  const serviceFixture: ProfessionalService = {
    id: 'service-1',
    professionalId: 'professional-1',
    name: 'Evaluación',
    description: null,
    durationMinutes: 60,
    priceType: 'FIXED',
    priceAmount: 45000,
    currency: 'CLP',
    status: 'ACTIVE',
    sortOrder: 0,
    icon: null,
    imageUrl: null,
    color: null,
    showInProfile: true,
    allowBooking: true,
    createdAt: '2026-07-30T00:00:00.000Z',
    updatedAt: '2026-07-30T00:00:00.000Z',
    deletedAt: null,
  };
  const api = {
    getOwnCatalog: vi.fn(),
    getPublicCatalog: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    changeMode: vi.fn(),
    changeStatus: vi.fn(),
    changeVisibility: vi.fn(),
    reorder: vi.fn(),
    archive: vi.fn(),
  };
  let store: ProfessionalServicesStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ProfessionalServicesStore(api as never);
  });

  it('loads and caches the private catalog', async () => {
    api.getOwnCatalog.mockReturnValue(
      of({
        serviceMode: 'SERVICE_CATALOG',
        data: [serviceFixture],
      }),
    );

    await firstValueFrom(store.loadServices());
    await firstValueFrom(store.loadServices());

    expect(api.getOwnCatalog).toHaveBeenCalledTimes(1);
    expect(store.services()).toEqual([serviceFixture]);
    expect(store.isCatalogMode()).toBe(true);
    expect(store.initialized()).toBe(true);
  });

  it('keeps services when switching back to single price', async () => {
    api.getOwnCatalog.mockReturnValue(
      of({
        serviceMode: 'SERVICE_CATALOG',
        data: [serviceFixture],
      }),
    );
    api.changeMode.mockReturnValue(of({ serviceMode: 'SINGLE_PRICE' }));

    await firstValueFrom(store.loadServices());
    await firstValueFrom(store.changeServiceMode('SINGLE_PRICE'));

    expect(store.serviceMode()).toBe('SINGLE_PRICE');
    expect(store.services()).toEqual([serviceFixture]);
  });

  it('derives active and visible services', async () => {
    api.getOwnCatalog.mockReturnValue(
      of({
        serviceMode: 'SERVICE_CATALOG',
        data: [
          serviceFixture,
          {
            ...serviceFixture,
            id: 'service-2',
            status: 'INACTIVE',
            sortOrder: 1,
          },
          {
            ...serviceFixture,
            id: 'service-3',
            showInProfile: false,
            sortOrder: 2,
          },
        ],
      }),
    );

    await firstValueFrom(store.loadServices());

    expect(store.activeServices().map((item) => item.id)).toEqual(['service-1', 'service-3']);
    expect(store.visibleServices().map((item) => item.id)).toEqual(['service-1']);
  });

  it('keeps public services separate from private state', async () => {
    api.getPublicCatalog.mockReturnValue(
      of({
        serviceMode: 'SERVICE_CATALOG',
        data: [
          {
            id: serviceFixture.id,
            name: serviceFixture.name,
            description: serviceFixture.description,
            durationMinutes: serviceFixture.durationMinutes,
            priceType: serviceFixture.priceType,
            priceAmount: serviceFixture.priceAmount,
            currency: serviceFixture.currency,
            sortOrder: serviceFixture.sortOrder,
            icon: serviceFixture.icon,
            imageUrl: serviceFixture.imageUrl,
            color: serviceFixture.color,
            allowBooking: serviceFixture.allowBooking,
          },
        ],
      }),
    );

    await firstValueFrom(store.loadPublicServices('professional-slug'));

    expect(store.publicServices()).toHaveLength(1);
    expect(store.services()).toEqual([]);
    expect(store.hasVisiblePublicServices()).toBe(true);
  });

  it('prevents an eleventh service before calling the API', async () => {
    api.getOwnCatalog.mockReturnValue(
      of({
        serviceMode: 'SERVICE_CATALOG',
        data: Array.from({ length: 10 }, (_, index) => ({
          ...serviceFixture,
          id: `service-${index + 1}`,
          sortOrder: index,
        })),
      }),
    );

    await firstValueFrom(store.loadServices());

    expect(store.canCreateService()).toBe(false);
    expect(store.remainingServiceSlots()).toBe(0);
    await expect(
      firstValueFrom(
        store.createService({
          name: 'Servicio once',
          durationMinutes: 60,
          priceType: 'CONSULT',
        }),
      ),
    ).rejects.toThrow('Puedes registrar un máximo de 10 servicios.');
    expect(api.create).not.toHaveBeenCalled();
  });
});
