import { ConflictException } from '@nestjs/common';
import {
  AppointmentStatus,
  AttentionModality,
  ScheduleMode,
  WeekDay,
} from '@prisma/client';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService availability integration', () => {
  const availability = {
    scheduleMode: ScheduleMode.CONTINUOUS,
    startMinute: 540,
    endMinute: 720,
    breakMinute: 0,
    specificSlots: null,
    blockedRanges: [],
    day: WeekDay.TUE,
  };

  let prisma: any;
  let conflicts: any;
  let service: AppointmentsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-11T00:00:00.000Z'));
    prisma = {
      professional: {
        findUnique: jest.fn().mockResolvedValue({
          duration: 60,
          user: { sessionDuration: 60 },
        }),
      },
      availability: { findMany: jest.fn().mockResolvedValue([availability]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    conflicts = {
      findTimeBlocks: jest.fn().mockResolvedValue([]),
      resolveAppointmentDuration: jest.fn(
        (snapshot: number | null | undefined, fallback: number) => snapshot ?? fallback,
      ),
      rangesOverlap: jest.fn(
        (startA: Date, endA: Date, startB: Date, endB: Date) =>
          startA < endB && endA > startB,
      ),
    };
    service = new AppointmentsService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      conflicts,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('returns normal weekly slots when there are no appointments or point blocks', async () => {
    await expect(
      service.getAvailableSlots('professional-1', '2026-08-18'),
    ).resolves.toEqual(['09:00', '10:00', '11:00']);
  });

  it('removes a slot covered by ProfessionalTimeBlock', async () => {
    conflicts.findTimeBlocks.mockResolvedValue([
      {
        startAt: new Date('2026-08-18T14:00:00.000Z'),
        endAt: new Date('2026-08-18T15:00:00.000Z'),
      },
    ]);

    await expect(
      service.getAvailableSlots('professional-1', '2026-08-18'),
    ).resolves.toEqual(['09:00', '11:00']);
  });

  it('uses an existing appointment snapshot when filtering available slots', async () => {
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 'appointment-90',
        date: new Date('2026-08-18T13:00:00.000Z'),
        serviceDurationMinutesSnapshot: 90,
      },
    ]);

    await expect(
      service.getAvailableSlots('professional-1', '2026-08-18'),
    ).resolves.toEqual(['11:00']);
  });

  it('keeps existing recurring blockedRanges behavior unchanged', async () => {
    prisma.availability.findMany.mockResolvedValue([
      { ...availability, blockedRanges: [{ startMinute: 600, endMinute: 660 }] },
    ]);

    await expect(
      service.getAvailableSlots('professional-1', '2026-08-18'),
    ).resolves.toEqual(['09:00', '11:00']);
  });

  it('hides a disabled specific slot without removing it from the weekly schedule', async () => {
    prisma.availability.findMany.mockResolvedValue([{
      ...availability,
      scheduleMode: ScheduleMode.SPECIFIC,
      specificSlots: [540, 600, 660],
      blockedRanges: [{ startMinute: 600, endMinute: 601 }],
    }]);

    await expect(
      service.getAvailableSlots('professional-1', '2026-08-18'),
    ).resolves.toEqual(['09:00', '11:00']);
  });

  it('rejects rescheduling into an occupied range before updating the appointment', async () => {
    const tx = {
      professional: { findUnique: jest.fn().mockResolvedValue({
        id: 'profile-1',
        serviceMode: 'SINGLE_PRICE',
        price: 45_000,
        duration: 60,
        user: { sessionDuration: 60 },
      }) },
      availability: { findMany: jest.fn().mockResolvedValue([availability]) },
      appointment: { update: jest.fn() },
    };
    prisma.appointment.findUnique = jest.fn().mockResolvedValue({
      id: 'appointment-1',
      customerId: 'customer-1',
      professionalId: 'professional-1',
      date: new Date('2026-08-20T14:00:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
      penalty: 0,
    });
    prisma.professional.findUnique.mockResolvedValue({
      duration: 60,
      price: 45_000,
      user: { sessionDuration: 60 },
    });
    prisma.availability.findFirst = jest.fn().mockResolvedValue(availability);
    conflicts.runExclusive = jest.fn((_professionalId, operation) => operation(tx));
    conflicts.assertRangeAvailable = jest
      .fn()
      .mockRejectedValue(new ConflictException('Horario ocupado'));

    await expect(
      service.rescheduleAppointment('appointment-1', 'customer-1', {
        date: '2026-08-18T14:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(conflicts.assertRangeAvailable).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        professionalId: 'professional-1',
        excludeAppointmentId: 'appointment-1',
      }),
      60,
    );
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it('rejects a normal reservation when a point block occupies the range', async () => {
    const tx = {
      professional: { findUnique: jest.fn().mockResolvedValue({
        id: 'profile-1',
        serviceMode: 'SINGLE_PRICE',
        price: 45_000,
        duration: 60,
        user: { sessionDuration: 60 },
      }) },
      availability: { findMany: jest.fn().mockResolvedValue([availability]) },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    prisma.professional.findUnique.mockResolvedValue({
      userId: 'professional-1',
      duration: 60,
      price: 45_000,
      attentionMode: AttentionModality.ONLINE,
      documentAutomationEnabled: false,
      firstLeadReceivedAt: new Date(),
      user: { role: 'PROFESSIONAL', sessionDuration: 60 },
    });
    prisma.user = {
      findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }),
    };
    prisma.availability.findFirst = jest.fn().mockResolvedValue(availability);
    (service as any).professionalAccess = {
      assertCanReceiveRequests: jest.fn().mockResolvedValue(undefined),
    };
    conflicts.runExclusive = jest.fn((_professionalId, operation) => operation(tx));
    conflicts.assertRangeAvailable = jest
      .fn()
      .mockRejectedValue(new ConflictException('Horario bloqueado'));

    await expect(
      service.create(
        'customer-1',
        'professional-1',
        new Date('2026-08-18T14:00:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(conflicts.assertRangeAvailable).toHaveBeenCalled();
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });
});
