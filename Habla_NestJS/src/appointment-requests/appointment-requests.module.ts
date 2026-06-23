import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppointmentRequestsController } from './appointment-requests.controller';
import { AppointmentRequestsService } from './appointment-requests.service';
import { ProfessionalAccessService } from './professional-access.service';
import { ProfessionalsAccessController } from './professionals-access.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    AppointmentRequestsController,
    ProfessionalsAccessController,
  ],
  providers: [
    AppointmentRequestsService,
    ProfessionalAccessService,
  ],
  exports: [
    ProfessionalAccessService,
  ],
})
export class AppointmentRequestsModule {}
