import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MessagesGateway } from './messages.gateway';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MessagesGateway,
    PrismaService,
    CloudinaryService,
  ],
})
export class MessagesModule {}
