import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthRequest } from '../auth/auth-request.interface';
import { ProfessionalAccessService } from './professional-access.service';

@Controller('professionals')
export class ProfessionalsAccessController {
  constructor(private readonly professionalAccess: ProfessionalAccessService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROFESSIONAL)
  @Get('me/access')
  getAccess(@Request() req: AuthRequest) {
    return this.professionalAccess.getAccessByUserId(req.user.id);
  }
}
