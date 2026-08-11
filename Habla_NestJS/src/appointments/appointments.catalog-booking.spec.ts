import { BadRequestException } from '@nestjs/common';
import {
  AttentionModality,
  ProfessionalServiceMode,
  ProfessionalServicePriceType,
  ProfessionalServiceStatus,
  Role,
  ScheduleMode,
  WeekDay,
} from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService customer catalog booking', () => {
  const availability = {
    scheduleMode: ScheduleMode.CONTINUOUS,
    startMinute: 540,
    endMinute: 720,
    breakMinute: 0,
    specificSlots: null,
    blockedRanges: [],
    day: WeekDay.TUE,
  };
  const profile = {
    id: 'profile-1',
    userId: 'professional-1',
    serviceMode: ProfessionalServiceMode.SERVICE_CATALOG,
    price: 45_000,
    duration: 60,
    attentionMode: AttentionModality.ONLINE,
    documentAutomationEnabled: false,
    firstLeadReceivedAt: new Date(),
    videoProvider: null,
    user: {
      role: Role.PROFESSIONAL,
      sessionDuration: 60,
      email: 'professional@example.com',
    },
  };
  const catalogService = {
    id: 'service-1',
    name: 'Evaluación extendida',
    priceType: ProfessionalServicePriceType.FIXED,
    priceAmount: 60_000,
    currency: 'CLP',
    durationMinutes: 90,
  };

  let prisma: any;
  let conflicts: any;
  let appointments: AppointmentsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-11T00:00:00.000Z'));
    prisma = {
      professional: {
        findUnique: jest.fn().mockResolvedValue(profile),
        update: jest.fn(),
      },
      professionalService: {
        findFirst: jest.fn().mockResolvedValue(catalogService),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'customer-1',
          name: 'Paciente',
          email: 'customer@example.com',
        }),
      },
      availability: {
        findFirst: jest.fn().mockResolvedValue(availability),
        findMany: jest.fn().mockResolvedValue([availability]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    conflicts = {
      findTimeBlocks: jest.fn().mockResolvedValue([]),
      rangesOverlap: jest.fn(
        (startA: Date, endA: Date, startB: Date, endB: Date) =>
          startA < endB && endA > startB,
      ),
      resolveAppointmentDuration: jest.fn(
        (snapshot: number | null | undefined, fallback: number) => snapshot ?? fallback,
      ),
      assertRangeAvailable: jest.fn().mockResolvedValue(undefined),
    };
    appointments = new AppointmentsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { assertCanReceiveRequests: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
      conflicts,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('requires a service in catalog mode', async () => {
    await expect(
      appointments.getAvailableSlots('professional-1', '2026-08-18'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.professionalService.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a service that is not active, public and bookable for this professional', async () => {
    prisma.professionalService.findFirst.mockResolvedValue(null);

    await expect(
      appointments.getAvailableSlots(
        'professional-1',
        '2026-08-18',
        'unavailable-service',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.professionalService.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'unavailable-service',
          professionalId: 'profile-1',
          status: ProfessionalServiceStatus.ACTIVE,
          showInProfile: true,
          allowBooking: true,
          deletedAt: null,
        },
      }),
    );
  });

  it('generates slots using the selected service duration', async () => {
    await expect(
      appointments.getAvailableSlots(
        'professional-1',
        '2026-08-18',
        'service-1',
      ),
    ).resolves.toEqual(['09:00', '10:30']);
  });

  it('revalidates the service inside the transaction and persists immutable snapshots', async () => {
    const created = { id: 'appointment-1' };
    const tx = {
      professional: { findUnique: jest.fn().mockResolvedValue(profile) },
      professionalService: {
        findFirst: jest.fn().mockResolvedValue(catalogService),
      },
      availability: { findMany: jest.fn().mockResolvedValue([availability]) },
      appointment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn(),
      },
    };
    conflicts.runExclusive = jest.fn((_professionalId, operation) => operation(tx));
    jest
      .spyOn(appointments as any, 'sendAppointmentNotificationById')
      .mockResolvedValue(undefined);

    await expect(
      appointments.create(
        'customer-1',
        'professional-1',
        new Date('2026-08-18T13:00:00.000Z'),
        { serviceId: 'service-1' },
      ),
    ).resolves.toEqual(created);

    expect(tx.professionalService.findFirst).toHaveBeenCalled();
    expect(conflicts.assertRangeAvailable).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        startAt: new Date('2026-08-18T13:00:00.000Z'),
        endAt: new Date('2026-08-18T14:30:00.000Z'),
      }),
      60,
    );
    expect(tx.appointment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId: 'service-1',
        serviceNameSnapshot: 'Evaluación extendida',
        servicePriceTypeSnapshot: ProfessionalServicePriceType.FIXED,
        servicePriceAmountSnapshot: 60_000,
        serviceCurrencySnapshot: 'CLP',
        serviceDurationMinutesSnapshot: 90,
        penalty: 60_000,
      }),
    });
  });
});
