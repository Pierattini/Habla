import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { AppointmentRequestsModule } from '../appointment-requests/appointment-requests.module';
import { TaxDocumentsModule } from '../tax-documents/tax-documents.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    MeetingsModule,
    AppointmentRequestsModule,
    TaxDocumentsModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
