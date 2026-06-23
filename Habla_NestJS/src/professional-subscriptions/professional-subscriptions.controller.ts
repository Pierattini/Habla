import { Controller, Post, Request, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthRequest } from '../auth/auth-request.interface';
import { ProfessionalSubscriptionsService } from './professional-subscriptions.service';

@Controller('professional-subscriptions')
export class ProfessionalSubscriptionsController {
  constructor(
    private readonly professionalSubscriptions: ProfessionalSubscriptionsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post('activate-manual')
  activateManual(@Request() req: AuthRequest) {
    return this.professionalSubscriptions.activateManual(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Post('deactivate-manual')
  deactivateManual(@Request() req: AuthRequest) {
    return this.professionalSubscriptions.deactivateManual(req.user.id);
  }
}
