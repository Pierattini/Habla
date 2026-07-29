import { ProfessionalServiceMode } from '@prisma/client';
import { ProfessionalServicesController } from './professional-services.controller';

describe('ProfessionalServicesController', () => {
  const professionalServices = {
    listOwnServices: jest.fn(),
    changeMode: jest.fn(),
    archiveService: jest.fn(),
  };
  let controller: ProfessionalServicesController;

  const request = {
    user: {
      id: 'professional-user-1',
      email: 'professional@example.com',
      role: 'PROFESSIONAL',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProfessionalServicesController(
      professionalServices as never,
    );
  });

  it('uses the authenticated user when listing services', async () => {
    professionalServices.listOwnServices.mockResolvedValue({
      serviceMode: ProfessionalServiceMode.SINGLE_PRICE,
      data: [],
    });

    await controller.list(request as never);

    expect(professionalServices.listOwnServices).toHaveBeenCalledWith(
      'professional-user-1',
    );
  });

  it('does not accept a professionalId when changing mode', async () => {
    professionalServices.changeMode.mockResolvedValue({
      serviceMode: ProfessionalServiceMode.SERVICE_CATALOG,
    });

    await controller.changeMode(request as never, {
      serviceMode: ProfessionalServiceMode.SERVICE_CATALOG,
    });

    expect(professionalServices.changeMode).toHaveBeenCalledWith(
      'professional-user-1',
      ProfessionalServiceMode.SERVICE_CATALOG,
    );
  });

  it('archives a service for the authenticated user', async () => {
    professionalServices.archiveService.mockResolvedValue({
      id: 'service-1',
    });

    await controller.archive(request as never, 'service-1');

    expect(professionalServices.archiveService).toHaveBeenCalledWith(
      'professional-user-1',
      'service-1',
    );
  });
});
