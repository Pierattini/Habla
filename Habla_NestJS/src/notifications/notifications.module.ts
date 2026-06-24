import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationEmailService } from './email.service';
import { NotificationService } from './notification.service';
import { NotificationPushService } from './push.service';
import { NotificationSmsService } from './sms.service';
import { NotificationWhatsappService } from './whatsapp.service';

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationEmailService,
    NotificationWhatsappService,
    NotificationSmsService,
    NotificationPushService,
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
