import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SiiBoletaClient } from '../sii/sii-boleta-client';
import { TaxProviderController } from './tax-provider.controller';
import { TaxProviderService } from './tax-provider.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TaxProviderController],
  providers: [
    TaxProviderService,
    { provide: SiiBoletaClient, useValue: new SiiBoletaClient() },
  ],
  exports: [TaxProviderService, SiiBoletaClient],
})
export class TaxProviderModule {}
