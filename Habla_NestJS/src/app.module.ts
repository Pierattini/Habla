import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule'; // 👈 NUEVO

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AvailabilityModule } from './availability/availability.module';
import { MessagesModule } from './messages/messages.module';
import { TaxDocumentsModule } from './tax-documents/tax-documents.module';
import { ProfessionsModule } from './professions/professions.module';
import { AppointmentRequestsModule } from './appointment-requests/appointment-requests.module';
import { ProfessionalSubscriptionsModule } from './professional-subscriptions/professional-subscriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MeetingsModule } from './meetings/meetings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AdminModule } from './admin/admin.module';
import { TaxProviderModule } from './tax-provider/tax-provider.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(), // 👈 🔥 CLAVE
    AuthModule,
    PrismaModule,
    UsersModule,
    AppointmentsModule,
    AvailabilityModule,
    MessagesModule,
    TaxDocumentsModule,
    ProfessionsModule,
    AppointmentRequestsModule,
    ProfessionalSubscriptionsModule,
    NotificationsModule,
    MeetingsModule,
    ReviewsModule,
    AdminModule,
    TaxProviderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
