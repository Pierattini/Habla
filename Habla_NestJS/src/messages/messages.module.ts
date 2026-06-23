import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MessagesGateway } from './messages.gateway';
import { EmailModule } from '../email/email.module';
import { AppointmentRequestsModule } from '../appointment-requests/appointment-requests.module';
import { ContactProtectionService } from './contact-protection.service';

@Module({
  imports: [EmailModule, AppointmentRequestsModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    ContactProtectionService,
    MessagesGateway,
    PrismaService,
    CloudinaryService,
  ],
})
export class MessagesModule {}
