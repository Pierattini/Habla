import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthRequest } from '../auth/auth-request.interface';
import { AppointmentRequestsService } from './appointment-requests.service';

@Controller('appointment-requests')
export class AppointmentRequestsController {
  constructor(private readonly appointmentRequests: AppointmentRequestsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @Post()
  create(
    @Request() req: AuthRequest,
    @Body()
    body: {
      professionalId: string;
      requestedDate?: string;
      requestedMode?: 'ONLINE' | 'PRESENTIAL' | 'BOTH';
      message?: string;
    },
  ) {
    return this.appointmentRequests.create(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Get('professional')
  findForProfessional(@Request() req: AuthRequest) {
    return this.appointmentRequests.findForProfessional(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.appointmentRequests.findOne(id, req.user.id, req.user.role);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post(':id/accept')
  accept(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.appointmentRequests.accept(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.appointmentRequests.reject(id, req.user.id);
  }
}
