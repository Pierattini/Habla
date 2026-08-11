import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const OCCUPYING_APPOINTMENT_STATUSES = [
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_PAYMENT,
  AppointmentStatus.PAYMENT_REVIEW,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
] as const;

export const MAX_SERVICE_DURATION_MINUTES = 480;

type ScheduleClient = Prisma.TransactionClient | PrismaService;

type ScheduleRange = {
  professionalId: string;
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string;
};

@Injectable()
export class ScheduleConflictsService {
  constructor(private readonly prisma: PrismaService) {}

  async runExclusive<T>(
    professionalId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${professionalId}))`;
            return operation(tx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        const isSerializationConflict =
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2034';

        if (!isSerializationConflict || attempt === maxAttempts) throw error;
      }
    }

    throw new Error('No fue posible completar la transacción de agenda.');
  }

  async getProfessionalDuration(
    client: ScheduleClient,
    professionalId: string,
  ): Promise<number> {
    const professional = await client.professional.findUnique({
      where: { userId: professionalId },
      select: {
        duration: true,
        user: { select: { sessionDuration: true } },
      },
    });

    if (!professional) {
      throw new NotFoundException('Perfil profesional no encontrado.');
    }

    return professional.duration ?? professional.user.sessionDuration ?? 60;
  }

  async assertRangeAvailable(
    client: ScheduleClient,
    range: ScheduleRange,
    appointmentDuration: number,
  ): Promise<void> {
    const overlappingBlock = await client.professionalTimeBlock.findFirst({
      where: {
        professionalId: range.professionalId,
        startAt: { lt: range.endAt },
        endAt: { gt: range.startAt },
      },
      select: { id: true },
    });

    if (overlappingBlock) {
      throw new ConflictException('El horario está bloqueado por el profesional.');
    }

    const legacyDuration = this.normalizeDuration(appointmentDuration, 60);
    const earliestCandidate = new Date(
      range.startAt.getTime() -
        Math.max(legacyDuration, MAX_SERVICE_DURATION_MINUTES) * 60_000,
    );
    const appointmentCandidates = await client.appointment.findMany({
      where: {
        professionalId: range.professionalId,
        ...(range.excludeAppointmentId
          ? { id: { not: range.excludeAppointmentId } }
          : {}),
        status: { in: [...OCCUPYING_APPOINTMENT_STATUSES] },
        date: {
          gt: earliestCandidate,
          lt: range.endAt,
        },
      },
      select: {
        id: true,
        date: true,
        serviceDurationMinutesSnapshot: true,
      },
    });

    const overlappingAppointment = appointmentCandidates.some((appointment) => {
      const duration = this.resolveAppointmentDuration(
        appointment.serviceDurationMinutesSnapshot,
        legacyDuration,
      );
      const appointmentEnd = new Date(
        appointment.date.getTime() + duration * 60_000,
      );

      return appointment.date < range.endAt && appointmentEnd > range.startAt;
    });

    if (overlappingAppointment) {
      throw new ConflictException('El horario se solapa con otra cita.');
    }
  }

  resolveAppointmentDuration(
    snapshotDuration: number | null | undefined,
    legacyFallbackDuration: number,
  ): number {
    return this.normalizeDuration(
      snapshotDuration,
      this.normalizeDuration(legacyFallbackDuration, 60),
    );
  }

  findTimeBlocks(
    client: ScheduleClient,
    professionalId: string,
    startAt: Date,
    endAt: Date,
  ) {
    return client.professionalTimeBlock.findMany({
      where: {
        professionalId,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { startAt: true, endAt: true },
    });
  }

  rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA < endB && endA > startB;
  }

  private normalizeDuration(value: number | null | undefined, fallback: number) {
    return Number.isFinite(value) && Number(value) > 0 ? Number(value) : fallback;
  }
}
