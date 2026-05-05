import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Patch,
  Param,
  Query,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { Request as ExpressRequest } from 'express';
import { Res } from '@nestjs/common';
import type { Response } from 'express';
interface AuthRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // 🟢 CREAR CITA (CUSTOMER)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateAppointmentDto, @Request() req: AuthRequest) {
    return this.appointmentsService.create(
      req.user.id,
      body.professionalId,
      new Date(body.date),
    );
  }

  // 🟢 CUSTOMER → ver sus citas
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  myAppointments(@Request() req: AuthRequest) {
    return this.appointmentsService.findByCustomer(req.user.id);
  }

  // 🟢 PROFESSIONAL → ver citas de sus clientes
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Get('professional')
  getProfessionalAppointments(@Request() req: AuthRequest) {
    return this.appointmentsService.findByProfessional(req.user.id);
  }

  // 🟢 ADMIN → ver TODAS las citas
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('all')
  getAllAppointments() {
    return this.appointmentsService.findAll();
  }

  // 🟢 PROFESSIONAL → confirmar cita
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.appointmentsService.confirmAppointment(id, req.user.id);
  }

  // 🟢 PROFESSIONAL → cancelar cita
  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  ancel(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.appointmentsService.cancelAppointment(id, req.user.id);
  }

  // 🟢 slots disponibles (público)
  @Get('available-slots')
  getAvailableSlots(
    @Query('professionalId') professionalId: string,
    @Query('date') date: string,
  ) {
    return this.appointmentsService.getAvailableSlots(
      professionalId,
      new Date(date),
    );
  }
  @UseGuards(JwtAuthGuard)
  @Patch(':id/pay')
  markAsPaid(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.appointmentsService.markAsPaid(id, req.user.id);
  }
  @Get(':id/confirm-payment-link')
  async confirmFromEmail(@Param('id') id: string, @Res() res: Response) {
    await this.appointmentsService.confirmPaymentFromLink(id);

    // 🔥 REDIRECCIÓN AL FRONT
    return res.redirect('http://localhost:4200/tabs/appointments?refresh=true');
  }
  // 🟡 REAGENDAR CITA (CUSTOMER o PROFESSIONAL)
  @UseGuards(JwtAuthGuard)
  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() body: { date: string },
    @Request() req: AuthRequest,
  ) {
    return this.appointmentsService.rescheduleAppointment(
      id,
      req.user.id,
      body,
    );
  }
  @UseGuards(JwtAuthGuard)
  @Patch(':id/resolve-penalty')
  resolvePenalty(
    @Param('id') id: string,
    @Body()
    body: {
      option: 'CREDIT' | 'REFUND';
      bank?: string;
      account?: string;
      accountType?: string;
    },
    @Request() req: AuthRequest,
  ) {
    return this.appointmentsService.resolvePenalty(id, req.user.id, body);
  }
  @Get(':id/refund-done')
  async refundDone(@Param('id') id: string, @Res() res: Response) {
    await this.appointmentsService.refundDone(id);

    return res.redirect('http://localhost:4200/refund-success');
  }
}
