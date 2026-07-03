import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TaxProviderController } from './tax-provider.controller';
import { TaxProviderService } from './tax-provider.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TaxProviderController],
  providers: [TaxProviderService],
  exports: [TaxProviderService],
})
export class TaxProviderModule {}
