import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleMode, WeekDay } from '@prisma/client';
import { CreateAvailabilityDto } from './create-availability.dto';

type TimeRange = {
  startMinute: number;
  endMinute: number;
};

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async create(professionalId: string, dto: CreateAvailabilityDto) {
    const data = this.normalizeAvailability(dto);

    return this.prisma.$transaction(async (tx) => {
      await tx.availability.deleteMany({
        where: {
          professionalId,
          day: dto.day,
        },
      });

      return tx.availability.create({
        data: {
          professionalId,
          day: dto.day,
          scheduleMode: data.scheduleMode,
          startMinute: data.startMinute,
          endMinute: data.endMinute,
          breakMinute: data.breakMinute,
          specificSlots: data.specificSlots,
          blockedRanges: data.blockedRanges,
        },
      });
    });
  }

  async removeDay(professionalId: string, day: string) {
    if (!Object.values(WeekDay).includes(day as WeekDay)) {
      throw new ForbiddenException('Invalid day');
    }

    return this.prisma.availability.deleteMany({
      where: {
        professionalId,
        day: day as WeekDay,
      },
    });
  }

  normalizeAvailability(dto: CreateAvailabilityDto) {
    const scheduleMode = dto.scheduleMode ?? ScheduleMode.CONTINUOUS;
    const startMinute = dto.startMinute;
    const endMinute = dto.endMinute;
    const breakMinute = dto.breakMinute ?? 0;
    const specificSlots = this.uniqueSorted(dto.specificSlots ?? []);
    const blockedRanges = this.sortRanges(dto.blockedRanges ?? []);

    if (startMinute < 0 || endMinute > 1440 || startMinute >= endMinute) {
      throw new ForbiddenException('Invalid time range');
    }

    if (breakMinute < 0 || breakMinute > 240) {
      throw new ForbiddenException('Invalid break duration');
    }

    if (scheduleMode === ScheduleMode.SPECIFIC && specificSlots.length === 0) {
      throw new ForbiddenException('Specific schedules cannot be empty');
    }

    if ((dto.specificSlots ?? []).length !== specificSlots.length) {
      throw new ForbiddenException('Duplicated specific schedules are not allowed');
    }

    if (scheduleMode === ScheduleMode.CONTINUOUS) {
      this.validateBlockedRanges(blockedRanges, startMinute, endMinute);
    }

    return {
      scheduleMode,
      startMinute,
      endMinute,
      breakMinute,
      specificSlots,
      blockedRanges,
    };
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

  private validateBlockedRanges(
    ranges: TimeRange[],
    startMinute: number,
    endMinute: number,
  ) {
    for (const range of ranges) {
      if (range.startMinute >= range.endMinute) {
        throw new ForbiddenException('Invalid blocked range');
      }

      if (range.startMinute < startMinute || range.endMinute > endMinute) {
        throw new ForbiddenException('Blocked range outside availability');
      }
    }

    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i].startMinute < ranges[i - 1].endMinute) {
        throw new ForbiddenException('Blocked ranges cannot overlap');
      }
    }
  }

  private uniqueSorted(minutes: number[]) {
    return [...new Set(minutes)].sort((a, b) => a - b);
  }

  private sortRanges(ranges: TimeRange[]) {
    return [...ranges].sort((a, b) => a.startMinute - b.startMinute);
  }
}
