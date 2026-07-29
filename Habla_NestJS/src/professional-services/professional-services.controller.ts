import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { AuthRequest } from '../auth/auth-request.interface';
import { CreateProfessionalServiceDto } from './dto/create-professional-service.dto';
import { ReorderProfessionalServicesDto } from './dto/reorder-professional-services.dto';
import { UpdateProfessionalServiceDto } from './dto/update-professional-service.dto';
import { UpdateServiceModeDto } from './dto/update-service-mode.dto';
import { UpdateServiceStatusDto } from './dto/update-service-status.dto';
import { UpdateServiceVisibilityDto } from './dto/update-service-visibility.dto';
import { ProfessionalServicesService } from './professional-services.service';

@Controller('professional-services')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PROFESSIONAL)
export class ProfessionalServicesController {
  constructor(
    private readonly professionalServices: ProfessionalServicesService,
  ) {}

  @Get()
  list(@Request() req: AuthRequest) {
    return this.professionalServices.listOwnServices(req.user.id);
  }

  @Post()
  create(
    @Request() req: AuthRequest,
    @Body() dto: CreateProfessionalServiceDto,
  ) {
    return this.professionalServices.createService(req.user.id, dto);
  }

  @Patch('mode')
  changeMode(@Request() req: AuthRequest, @Body() dto: UpdateServiceModeDto) {
    return this.professionalServices.changeMode(req.user.id, dto.serviceMode);
  }

  @Patch('reorder')
  reorder(
    @Request() req: AuthRequest,
    @Body() dto: ReorderProfessionalServicesDto,
  ) {
    return this.professionalServices.reorderServices(req.user.id, dto);
  }

  @Get(':id')
  getOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.professionalServices.getOwnService(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalServiceDto,
  ) {
    return this.professionalServices.updateService(req.user.id, id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServiceStatusDto,
  ) {
    return this.professionalServices.changeStatus(req.user.id, id, dto.status);
  }

  @Patch(':id/visibility')
  changeVisibility(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateServiceVisibilityDto,
  ) {
    return this.professionalServices.changeVisibility(
      req.user.id,
      id,
      dto.showInProfile,
    );
  }

  @Delete(':id')
  archive(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.professionalServices.archiveService(req.user.id, id);
  }
}
