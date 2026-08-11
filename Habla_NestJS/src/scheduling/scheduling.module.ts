import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ScheduleConflictsService } from './schedule-conflicts.service';

@Module({
  imports: [PrismaModule],
  providers: [ScheduleConflictsService],
  exports: [ScheduleConflictsService],
})
export class SchedulingModule {}
