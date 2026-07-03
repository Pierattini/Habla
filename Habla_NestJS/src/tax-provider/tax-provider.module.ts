import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SiiDirectAuthService } from './sii-direct-auth.service';
import { TaxProviderController } from './tax-provider.controller';
import { TaxProviderService } from './tax-provider.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TaxProviderController],
  providers: [TaxProviderService, SiiDirectAuthService],
  exports: [TaxProviderService, SiiDirectAuthService],
})
export class TaxProviderModule {}
