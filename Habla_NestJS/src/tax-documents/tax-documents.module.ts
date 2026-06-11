import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { TaxDocumentsController } from './tax-documents.controller';
import { TaxDocumentsService } from './tax-documents.service';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [TaxDocumentsController],
  providers: [TaxDocumentsService],
  exports: [TaxDocumentsService],
})
export class TaxDocumentsModule {}
