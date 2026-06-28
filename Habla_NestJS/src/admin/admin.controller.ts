import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthRequest } from '../auth/auth-request.interface';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('summary')
  getSummary() {
    return this.adminService.getSummary();
  }

  @Get('users')
  listUsers(@Query() query: Record<string, string>) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() body: Record<string, any>,
    @Request() req: AuthRequest,
  ) {
    return this.adminService.updateUser(id, body, req.user.id);
  }

  @Patch('users/:id/activate')
  activateUser(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.adminService.setUserActive(id, true, req.user.id);
  }

  @Patch('users/:id/deactivate')
  deactivateUser(@Param('id') id: string, @Request() req: AuthRequest) {
    return this.adminService.setUserActive(id, false, req.user.id);
  }

  @Get('professionals')
  listProfessionals(@Query() query: Record<string, string>) {
    return this.adminService.listProfessionals(query);
  }

  @Patch('professionals/:id')
  updateProfessional(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.adminService.updateProfessional(id, body);
  }

  @Patch('professionals/:id/suspend')
  suspendProfessional(@Param('id') id: string) {
    return this.adminService.suspendProfessional(id);
  }

  @Patch('professionals/:id/activate')
  activateProfessional(@Param('id') id: string) {
    return this.adminService.activateProfessional(id);
  }
}
