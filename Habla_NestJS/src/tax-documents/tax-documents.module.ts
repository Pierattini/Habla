import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { EmailModule } from '../email/email.module';
import { LibreDteModule } from '../libredte/libredte.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TaxProviderModule } from '../tax-provider/tax-provider.module';
import { TaxDocumentJobsService } from './tax-document-jobs.service';
import { TaxDocumentsController } from './tax-documents.controller';
import { TaxDocumentsService } from './tax-documents.service';

@Module({
  imports: [PrismaModule, CloudinaryModule, EmailModule, LibreDteModule, TaxProviderModule],
  controllers: [TaxDocumentsController],
  providers: [TaxDocumentsService, TaxDocumentJobsService],
  exports: [TaxDocumentsService, TaxDocumentJobsService],
})
export class TaxDocumentsModule {}
