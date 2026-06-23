import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalSubscriptionsController } from './professional-subscriptions.controller';
import { ProfessionalSubscriptionsService } from './professional-subscriptions.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProfessionalSubscriptionsController],
  providers: [ProfessionalSubscriptionsService],
})
export class ProfessionalSubscriptionsModule {}
