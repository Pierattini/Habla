import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TaxDocumentsController } from './tax-documents.controller';
import { TaxDocumentsService } from './tax-documents.service';

@Module({
  imports: [PrismaModule, CloudinaryModule, EmailModule],
  controllers: [TaxDocumentsController],
  providers: [TaxDocumentsService],
  exports: [TaxDocumentsService],
})
export class TaxDocumentsModule {}
