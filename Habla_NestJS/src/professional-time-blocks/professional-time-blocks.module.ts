import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalTimeBlocksController } from './professional-time-blocks.controller';
import { ProfessionalTimeBlocksService } from './professional-time-blocks.service';
import { SchedulingModule } from '../scheduling/scheduling.module';

@Module({
  imports: [PrismaModule, SchedulingModule],
  controllers: [ProfessionalTimeBlocksController],
  providers: [ProfessionalTimeBlocksService],
  exports: [ProfessionalTimeBlocksService],
})
export class ProfessionalTimeBlocksModule {}
