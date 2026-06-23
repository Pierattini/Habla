import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalsPublicController } from './professionals-public.controller';

@Module({
  imports: [PrismaModule],
  providers: [UsersService],
  controllers: [UsersController, ProfessionalsPublicController],
  exports: [UsersService],
})
export class UsersModule {}
