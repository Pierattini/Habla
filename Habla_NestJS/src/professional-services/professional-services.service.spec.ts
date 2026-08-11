import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ProfessionalServiceMode,
  ProfessionalServicePriceType,
  ProfessionalServiceStatus,
} from '@prisma/client';
import { ProfessionalServicesService } from './professional-services.service';

describe('ProfessionalServicesService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    professional: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    professionalService: {
      aggregate: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: ProfessionalServicesService;

  const ownProfessional = {
    role: 'PROFESSIONAL',
    country: 'CL',
    professional: {
      id: 'professional-1',
      serviceMode: ProfessionalServiceMode.SINGLE_PRICE,
      officeCountry: 'CL',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProfessionalServicesService(prisma as never);
    prisma.user.findUnique.mockResolvedValue(ownProfessional);
    prisma.professionalService.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation((operation: unknown) =>
      typeof operation === 'function'
        ? (operation as (tx: typeof prisma) => Promise<unknown>)(prisma)
        : Promise.resolve(operation),
    );
  });

  it('uses SINGLE_PRICE without creating or deleting services', async () => {
    prisma.professionalService.findMany.mockResolvedValue([]);

    await expect(service.listOwnServices('user-1')).resolves.toEqual({
      serviceMode: ProfessionalServiceMode.SINGLE_PRICE,
      data: [],
    });
    expect(prisma.professionalService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          professionalId: 'professional-1',
          deletedAt: null,
        },
      }),
    );
  });

  it('rejects users that are not professionals', async () => {
    prisma.user.findUnique.mockResolvedValue({
      role: 'CUSTOMER',
      professional: null,
    });

    await expect(service.listOwnServices('customer-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates a fixed-price service for the authenticated professional', async () => {
    prisma.professionalService.aggregate.mockResolvedValue({
      _max: { sortOrder: 2 },
    });
    prisma.professionalService.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'service-1', ...data }),
    );

    await service.createService('user-1', {
      name: ' Evaluación ',
      durationMinutes: 60,
      priceType: ProfessionalServicePriceType.FIXED,
      priceAmount: 45000,
    });

    expect(prisma.professionalService.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        professionalId: 'professional-1',
        name: 'Evaluación',
        priceAmount: 45000,
        currency: 'CLP',
        sortOrder: 3,
      }),
    });
  });

  it('rejects fixed prices without an amount', async () => {
    await expect(
      service.createService('user-1', {
        name: 'Evaluación',
        durationMinutes: 60,
        priceType: ProfessionalServicePriceType.FIXED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.professionalService.create).not.toHaveBeenCalled();
  });

  it('rejects creation when the professional already has ten active catalog records', async () => {
    prisma.professionalService.count.mockResolvedValue(10);
    prisma.professionalService.aggregate.mockResolvedValue({
      _max: { sortOrder: 9 },
    });

    await expect(
      service.createService('user-1', {
        name: 'Servicio once',
        durationMinutes: 60,
        priceType: ProfessionalServicePriceType.CONSULT,
      }),
    ).rejects.toThrow('Puedes registrar un máximo de 10 servicios.');

    expect(prisma.professionalService.count).toHaveBeenCalledWith({
      where: { professionalId: 'professional-1', deletedAt: null },
    });
    expect(prisma.professionalService.create).not.toHaveBeenCalled();
  });

  it('retries a serializable transaction after a Prisma write conflict', async () => {
    prisma.professionalService.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    });
    prisma.professionalService.create.mockResolvedValue({ id: 'service-1' });
    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce((operation: (tx: typeof prisma) => Promise<unknown>) =>
        operation(prisma),
      );

    await service.createService('user-1', {
      name: 'Diagnóstico',
      durationMinutes: 30,
      priceType: ProfessionalServicePriceType.CONSULT,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('normalizes CONSULT to a null amount', async () => {
    prisma.professionalService.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    });
    prisma.professionalService.create.mockResolvedValue({ id: 'service-1' });

    await service.createService('user-1', {
      name: 'Diagnóstico',
      durationMinutes: 30,
      priceType: ProfessionalServicePriceType.CONSULT,
    });

    expect(prisma.professionalService.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ priceAmount: null }),
    });
  });

  it('does not expose whether a service belongs to another professional', async () => {
    prisma.professionalService.findFirst.mockResolvedValue(null);

    await expect(
      service.getOwnService('user-1', 'foreign-service'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('changes mode without touching existing services', async () => {
    prisma.professional.update.mockResolvedValue({
      serviceMode: ProfessionalServiceMode.SERVICE_CATALOG,
    });

    await service.changeMode('user-1', ProfessionalServiceMode.SERVICE_CATALOG);

    expect(prisma.professional.update).toHaveBeenCalledWith({
      where: { id: 'professional-1' },
      data: { serviceMode: ProfessionalServiceMode.SERVICE_CATALOG },
      select: { serviceMode: true },
    });
    expect(prisma.professionalService.update).not.toHaveBeenCalled();
  });

  it('returns no public services while mode is SINGLE_PRICE', async () => {
    prisma.professional.findUnique.mockResolvedValue({
      id: 'professional-1',
      serviceMode: ProfessionalServiceMode.SINGLE_PRICE,
    });

    await expect(
      service.listPublicServices('professional-slug'),
    ).resolves.toEqual({
      serviceMode: ProfessionalServiceMode.SINGLE_PRICE,
      data: [],
    });
    expect(prisma.professionalService.findMany).not.toHaveBeenCalled();
  });

  it('only requests active and visible public services', async () => {
    prisma.professional.findUnique.mockResolvedValue({
      id: 'professional-1',
      serviceMode: ProfessionalServiceMode.SERVICE_CATALOG,
    });
    prisma.professionalService.findMany.mockResolvedValue([]);

    await service.listPublicServices('professional-slug');

    expect(prisma.professionalService.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          professionalId: 'professional-1',
          status: ProfessionalServiceStatus.ACTIVE,
          showInProfile: true,
          deletedAt: null,
        },
        select: expect.not.objectContaining({
          professionalId: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
        }),
      }),
    );
  });

  it('archives instead of physically deleting a service', async () => {
    prisma.professionalService.findFirst.mockResolvedValue({
      id: 'service-1',
    });
    prisma.professionalService.update.mockResolvedValue({
      id: 'service-1',
      deletedAt: new Date(),
    });

    await service.archiveService('user-1', 'service-1');

    expect(prisma.professionalService.update).toHaveBeenCalledWith({
      where: { id: 'service-1' },
      data: {
        deletedAt: expect.any(Date),
        status: ProfessionalServiceStatus.INACTIVE,
        showInProfile: false,
      },
    });
  });
});
