import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthRequest } from '../auth/auth-request.interface';
import { CreateProfessionalTimeBlockDto } from './dto/create-professional-time-block.dto';
import { ProfessionalTimeBlocksService } from './professional-time-blocks.service';

@Controller('professional-time-blocks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSIONAL)
export class ProfessionalTimeBlocksController {
  constructor(private readonly timeBlocks: ProfessionalTimeBlocksService) {}

  @Get()
  findMine(@Request() req: AuthRequest) {
    return this.timeBlocks.findMine(req.user.id);
  }

  @Post()
  create(
    @Body() body: CreateProfessionalTimeBlockDto,
    @Request() req: AuthRequest,
  ) {
    return this.timeBlocks.create(req.user.id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.timeBlocks.remove(req.user.id, id);
  }
}
