import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalServicesPublicController } from './professional-services-public.controller';
import { ProfessionalServicesController } from './professional-services.controller';
import { ProfessionalServicesService } from './professional-services.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ProfessionalServicesController,
    ProfessionalServicesPublicController,
  ],
  providers: [ProfessionalServicesService],
  exports: [ProfessionalServicesService],
})
export class ProfessionalServicesModule {}
