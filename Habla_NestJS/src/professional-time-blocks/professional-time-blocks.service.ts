import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleConflictsService } from '../scheduling/schedule-conflicts.service';
import { CreateProfessionalTimeBlockDto } from './dto/create-professional-time-block.dto';

@Injectable()
export class ProfessionalTimeBlocksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleConflicts: ScheduleConflictsService,
  ) {}

  findMine(professionalId: string) {
    return this.prisma.professionalTimeBlock.findMany({
      where: { professionalId },
      orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(
    professionalId: string,
    dto: CreateProfessionalTimeBlockDto,
  ) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      startAt >= endAt
    ) {
      throw new BadRequestException(
        'La fecha de término debe ser posterior a la fecha de inicio.',
      );
    }

    const reason = dto.reason?.trim() || null;

    return this.scheduleConflicts.runExclusive(professionalId, async (tx) => {
      await this.assertActiveProfessional(tx, professionalId);
      const duration = await this.scheduleConflicts.getProfessionalDuration(
        tx,
        professionalId,
      );
      await this.scheduleConflicts.assertRangeAvailable(
        tx,
        { professionalId, startAt, endAt },
        duration,
      );

      return tx.professionalTimeBlock.create({
        data: {
          professionalId,
          startAt,
          endAt,
          type: dto.type,
          reason,
        },
      });
    });
  }

  async remove(professionalId: string, id: string) {
    const result = await this.prisma.professionalTimeBlock.deleteMany({
      where: { id, professionalId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Bloqueo no encontrado.');
    }

    return { deleted: true };
  }

  private async assertActiveProfessional(
    tx: Prisma.TransactionClient,
    professionalId: string,
  ) {
    const professional = await tx.user.findUnique({
      where: { id: professionalId },
      select: { role: true, isActive: true },
    });

    if (!professional || professional.role !== Role.PROFESSIONAL) {
      throw new ForbiddenException('Solo profesionales pueden crear bloqueos.');
    }

    if (!professional.isActive) {
      throw new ForbiddenException('La cuenta profesional no está activa.');
    }
  }
}
