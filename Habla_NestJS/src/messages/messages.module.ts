import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { MessagesGateway } from './messages.gateway';

@Module({
  controllers: [MessagesController],
  providers: [
    MessagesService,
    MessagesGateway,
    PrismaService,
    CloudinaryService,
  ],
})
export class MessagesModule {}
