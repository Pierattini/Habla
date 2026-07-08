import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppointmentRequestsModule } from './appointment-requests/appointment-requests.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { MeetingsModule } from './meetings/meetings.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfessionalSubscriptionsModule } from './professional-subscriptions/professional-subscriptions.module';
import { ProfessionsModule } from './professions/professions.module';
import { ReviewsModule } from './reviews/reviews.module';
import { TaxDocumentsModule } from './tax-documents/tax-documents.module';
import { TaxProviderModule } from './tax-provider/tax-provider.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: Number(process.env.RATE_LIMIT_TTL_MS || 60_000),
          limit: Number(process.env.RATE_LIMIT_MAX || 120),
        },
      ],
    }),
    ScheduleModule.forRoot(),
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
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
