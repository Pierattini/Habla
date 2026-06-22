import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LibreDteClient } from './libredte.client';
import { LibreDteMapper } from './libredte.mapper';
import { LibreDteService } from './libredte.service';

@Module({
  imports: [ConfigModule],
  providers: [LibreDteClient, LibreDteMapper, LibreDteService],
  exports: [LibreDteService],
})
export class LibreDteModule {}
