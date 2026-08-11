import { Role } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { ROLES_KEY } from '../auth/roles.decorator';
import { ProfessionalTimeBlocksController } from './professional-time-blocks.controller';
import { ProfessionalTimeBlocksService } from './professional-time-blocks.service';

describe('ProfessionalTimeBlocksController', () => {
  let controller: ProfessionalTimeBlocksController;
  let service: any;

  beforeEach(async () => {
    service = {
      findMine: jest.fn(),
      create: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfessionalTimeBlocksController],
      providers: [
        { provide: ProfessionalTimeBlocksService, useValue: service },
      ],
    }).compile();

    controller = module.get(ProfessionalTimeBlocksController);
  });

  it('restricts every endpoint in the controller to PROFESSIONAL', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ProfessionalTimeBlocksController)).toEqual([
      Role.PROFESSIONAL,
    ]);
  });

  it('uses the authenticated professional id when creating a block', async () => {
    const request = { user: { id: 'professional-1' } } as any;
    const body = {
      startAt: '2026-08-18T15:00:00.000Z',
      endAt: '2026-08-18T16:00:00.000Z',
      type: 'TIME_RANGE',
    } as any;

    await controller.create(body, request);

    expect(service.create).toHaveBeenCalledWith('professional-1', body);
  });

  it('uses both authenticated owner id and block id when deleting', async () => {
    await controller.remove('block-1', {
      user: { id: 'professional-1' },
    } as any);

    expect(service.remove).toHaveBeenCalledWith('professional-1', 'block-1');
  });
});
