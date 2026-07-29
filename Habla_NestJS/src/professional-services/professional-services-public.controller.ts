import { Controller, Get, Param } from '@nestjs/common';
import { ProfessionalServicesService } from './professional-services.service';

@Controller('professionals/public')
export class ProfessionalServicesPublicController {
  constructor(
    private readonly professionalServices: ProfessionalServicesService,
  ) {}

  @Get(':slug/services')
  list(@Param('slug') slug: string) {
    return this.professionalServices.listPublicServices(slug);
  }
}
