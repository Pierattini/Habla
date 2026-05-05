import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth-request.interface';
import { CreateAvailabilityDto } from './create-availability.dto';

@Controller('availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  // 🔐 Crear disponibilidad (solo profesionales)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateAvailabilityDto, @Request() req: AuthRequest) {
    if (req.user.role !== Role.PROFESSIONAL) {
      throw new ForbiddenException(
        'Only professionals can define availability',
      );
    }

    return this.availabilityService.create(
      req.user.id,
      body.day,
      body.startMinute,
      body.endMinute,
    );
  }

  // 📅 Obtener disponibilidad de un profesional
  @Get(':professionalId')
  getByProfessional(@Param('professionalId') id: string) {
    return this.availabilityService.getByProfessional(id);
  }
}
