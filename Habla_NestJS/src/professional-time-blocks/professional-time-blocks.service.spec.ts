import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProfessionalTimeBlockType, Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleConflictsService } from '../scheduling/schedule-conflicts.service';
import { ProfessionalTimeBlocksService } from './professional-time-blocks.service';

describe('ProfessionalTimeBlocksService', () => {
  let service: ProfessionalTimeBlocksService;
  let prisma: any;
  let tx: any;
  let scheduleConflicts: any;

  const dto = {
    startAt: '2026-08-18T15:00:00.000Z',
    endAt: '2026-08-18T16:00:00.000Z',
    type: ProfessionalTimeBlockType.TIME_RANGE,
    reason: '  Reunión privada  ',
  };

  beforeEach(async () => {
    tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: Role.PROFESSIONAL,
          isActive: true,
        }),
      },
      professionalTimeBlock: {
        create: jest.fn().mockImplementation(({ data }) => ({
          id: 'block-1',
          ...data,
        })),
      },
    };
    prisma = {
      professionalTimeBlock: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    scheduleConflicts = {
      runExclusive: jest.fn((_professionalId, operation) => operation(tx)),
      getProfessionalDuration: jest.fn().mockResolvedValue(60),
      assertRangeAvailable: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfessionalTimeBlocksService,
        { provide: PrismaService, useValue: prisma },
        { provide: ScheduleConflictsService, useValue: scheduleConflicts },
      ],
    }).compile();

    service = module.get(ProfessionalTimeBlocksService);
  });

  it('creates a block inside the shared professional transaction', async () => {
    const result = await service.create('professional-1', dto);

    expect(scheduleConflicts.runExclusive).toHaveBeenCalledWith(
      'professional-1',
      expect.any(Function),
    );
    expect(scheduleConflicts.assertRangeAvailable).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ professionalId: 'professional-1' }),
      60,
    );
    expect(tx.professionalTimeBlock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        professionalId: 'professional-1',
        reason: 'Reunión privada',
      }),
    });
    expect(result.id).toBe('block-1');
  });

  it('rejects an invalid date range before opening a transaction', async () => {
    await expect(
      service.create('professional-1', { ...dto, startAt: dto.endAt }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scheduleConflicts.runExclusive).not.toHaveBeenCalled();
  });

  it('lists only blocks belonging to the authenticated professional', async () => {
    await service.findMine('professional-1');
    expect(prisma.professionalTimeBlock.findMany).toHaveBeenCalledWith({
      where: { professionalId: 'professional-1' },
      orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('deletes only a block owned by the authenticated professional', async () => {
    await expect(service.remove('professional-1', 'block-1')).resolves.toEqual({
      deleted: true,
    });
    expect(prisma.professionalTimeBlock.deleteMany).toHaveBeenCalledWith({
      where: { id: 'block-1', professionalId: 'professional-1' },
    });
  });

  it('does not reveal whether another professional owns the block', async () => {
    prisma.professionalTimeBlock.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      service.remove('professional-1', 'foreign-block'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
