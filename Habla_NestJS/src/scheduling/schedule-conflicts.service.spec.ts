import { ConflictException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { ScheduleConflictsService } from './schedule-conflicts.service';

describe('ScheduleConflictsService', () => {
  const startAt = new Date('2026-08-18T15:00:00.000Z');
  const endAt = new Date('2026-08-18T16:00:00.000Z');

  function createClient(options: {
    block?: { id: string } | null;
    appointment?: { id: string; date: Date; serviceDurationMinutesSnapshot?: number | null } | null;
  } = {}) {
    return {
      professionalTimeBlock: {
        findFirst: jest.fn().mockResolvedValue(options.block ?? null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue(options.appointment ? [options.appointment] : []),
      },
      professional: {
        findUnique: jest.fn().mockResolvedValue({
          duration: 60,
          user: { sessionDuration: 60 },
        }),
      },
    } as any;
  }

  it('accepts a normal free slot', async () => {
    const service = new ScheduleConflictsService({} as any);
    await expect(
      service.assertRangeAvailable(
        createClient(),
        { professionalId: 'professional-1', startAt, endAt },
        60,
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects a slot covered by ProfessionalTimeBlock', async () => {
    const service = new ScheduleConflictsService({} as any);
    await expect(
      service.assertRangeAvailable(
        createClient({ block: { id: 'block-1' } }),
        { professionalId: 'professional-1', startAt, endAt },
        60,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('keeps a contiguous range available', async () => {
    const service = new ScheduleConflictsService({} as any);
    const client = createClient();
    await service.assertRangeAvailable(
      client,
      {
        professionalId: 'professional-1',
        startAt: new Date('2026-08-18T16:00:00.000Z'),
        endAt: new Date('2026-08-18T17:00:00.000Z'),
      },
      60,
    );
    expect(client.professionalTimeBlock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          startAt: { lt: new Date('2026-08-18T17:00:00.000Z') },
          endAt: { gt: new Date('2026-08-18T16:00:00.000Z') },
        }),
      }),
    );
  });

  it('rejects a block or reservation when an active appointment overlaps', async () => {
    const service = new ScheduleConflictsService({} as any);
    await expect(
      service.assertRangeAvailable(
        createClient({
          appointment: {
            id: 'appointment-1',
            date: new Date('2026-08-18T15:30:00.000Z'),
          },
        }),
        { professionalId: 'professional-1', startAt, endAt },
        60,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('excludes the appointment being rescheduled and rejects other conflicts', async () => {
    const service = new ScheduleConflictsService({} as any);
    const client = createClient({
      appointment: {
        id: 'appointment-2',
        date: new Date('2026-08-18T15:30:00.000Z'),
      },
    });

    await expect(
      service.assertRangeAvailable(
        client,
        {
          professionalId: 'professional-1',
          startAt,
          endAt,
          excludeAppointmentId: 'appointment-1',
        },
        60,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(client.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'appointment-1' } }),
      }),
    );
  });

  it('serializes two reservations so only one can occupy the range', async () => {
    const appointments: Array<{ id: string; date: Date }> = [];
    let queue = Promise.resolve();
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      professionalTimeBlock: { findFirst: jest.fn().mockResolvedValue(null) },
      appointment: {
        findMany: jest.fn(async () => appointments.slice(0, 1)),
      },
    };
    const prisma: any = {
      $transaction: jest.fn((operation) => {
        const result = queue.then(() => operation(tx));
        queue = result.then(() => undefined, () => undefined);
        return result;
      }),
    };
    const service = new ScheduleConflictsService(prisma);
    const reserve = (id: string) =>
      service.runExclusive('professional-1', async (client) => {
        await service.assertRangeAvailable(
          client,
          { professionalId: 'professional-1', startAt, endAt },
          60,
        );
        appointments.push({ id, date: startAt });
        return id;
      });

    const results = await Promise.allSettled([reserve('a'), reserve('b')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(appointments).toHaveLength(1);
  });

  it('serializes a reservation and a block over the same range', async () => {
    const state: { appointment?: { id: string; date: Date }; block?: { id: string } } = {};
    let queue = Promise.resolve();
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      professionalTimeBlock: {
        findFirst: jest.fn(async () => state.block ?? null),
      },
      appointment: {
        findMany: jest.fn(async () => (state.appointment ? [state.appointment] : [])),
      },
    };
    const prisma: any = {
      $transaction: jest.fn((operation) => {
        const result = queue.then(() => operation(tx));
        queue = result.then(() => undefined, () => undefined);
        return result;
      }),
    };
    const service = new ScheduleConflictsService(prisma);
    const occupy = (kind: 'appointment' | 'block') =>
      service.runExclusive('professional-1', async (client) => {
        await service.assertRangeAvailable(
          client,
          { professionalId: 'professional-1', startAt, endAt },
          60,
        );
        if (kind === 'appointment') {
          state.appointment = { id: 'appointment-1', date: startAt };
        } else {
          state.block = { id: 'block-1' };
        }
      });

    const results = await Promise.allSettled([
      occupy('appointment'),
      occupy('block'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('uses every active appointment state as occupying', async () => {
    const service = new ScheduleConflictsService({} as any);
    const client = createClient();
    await service.assertRangeAvailable(
      client,
      { professionalId: 'professional-1', startAt, endAt },
      60,
    );
    expect(client.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              AppointmentStatus.PENDING,
              AppointmentStatus.PENDING_PAYMENT,
              AppointmentStatus.PAYMENT_REVIEW,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.RESCHEDULED,
            ],
          },
        }),
      }),
    );
  });

  it('uses each appointment duration snapshot when checking overlap', async () => {
    const service = new ScheduleConflictsService({} as any);
    const client = createClient({
      appointment: {
        id: 'appointment-90',
        date: new Date('2026-08-18T14:00:00.000Z'),
        serviceDurationMinutesSnapshot: 90,
      },
    });

    await expect(
      service.assertRangeAvailable(
        client,
        {
          professionalId: 'professional-1',
          startAt: new Date('2026-08-18T15:00:00.000Z'),
          endAt: new Date('2026-08-18T16:00:00.000Z'),
        },
        60,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the current professional duration only for appointments without a snapshot', () => {
    const service = new ScheduleConflictsService({} as any);

    expect(service.resolveAppointmentDuration(90, 60)).toBe(90);
    expect(service.resolveAppointmentDuration(null, 60)).toBe(60);
  });
});
