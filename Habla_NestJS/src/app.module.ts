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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
