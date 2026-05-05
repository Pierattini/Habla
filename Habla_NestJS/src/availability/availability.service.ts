import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WeekDay } from '@prisma/client';

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async create(
    professionalId: string,
    day: string,
    startMinute: number,
    endMinute: number,
  ) {
    if (startMinute < 0 || endMinute > 1440 || startMinute >= endMinute) {
      throw new ForbiddenException('Invalid time range');
    }

    return await this.prisma.availability.create({
      data: {
        professionalId,
        day: day as WeekDay,
        startMinute,
        endMinute,
      },
    });
  }

  async getByProfessional(professionalId: string) {
    return this.prisma.availability.findMany({
      where: {
        professionalId,
      },
      orderBy: {
        day: 'asc',
      },
    });
  }
}
