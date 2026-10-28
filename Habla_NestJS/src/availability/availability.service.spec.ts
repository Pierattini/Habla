import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleMode, WeekDay } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AvailabilityService', () => {
  let service: AvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            availability: {
              deleteMany: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeAvailability', () => {
    const base = {
      day: WeekDay.TUE,
      startMinute: 540,
      endMinute: 720,
    };

    it('keeps disabled specific slots as one-minute marks, including 23:59', () => {
      const result = service.normalizeAvailability({
        ...base,
        scheduleMode: ScheduleMode.SPECIFIC,
        specificSlots: [540, 1439],
        blockedRanges: [
          { startMinute: 1439, endMinute: 1439 },
          { startMinute: 540, endMinute: 541 },
        ],
      });

      expect(result.blockedRanges).toEqual([
        { startMinute: 540, endMinute: 541 },
        { startMinute: 1439, endMinute: 1440 },
      ]);
    });

    it('drops blocks that do not match a specific slot instead of rejecting the save', () => {
      const result = service.normalizeAvailability({
        ...base,
        scheduleMode: ScheduleMode.SPECIFIC,
        specificSlots: [600],
        blockedRanges: [
          { startMinute: 540, endMinute: 660 },
          { startMinute: 600, endMinute: 720 },
        ],
      });

      expect(result.blockedRanges).toEqual([
        { startMinute: 600, endMinute: 601 },
      ]);
    });

    it('still rejects continuous blocks outside the availability window', () => {
      expect(() =>
        service.normalizeAvailability({
          ...base,
          scheduleMode: ScheduleMode.CONTINUOUS,
          blockedRanges: [{ startMinute: 700, endMinute: 760 }],
        }),
      ).toThrow(ForbiddenException);
    });
  });
});
