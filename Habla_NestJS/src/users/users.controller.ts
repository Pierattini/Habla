import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  Param,
  Delete,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';
import type { AuthRequest } from '../auth/auth-request.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // 🔹 SOLO ADMIN CREA
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  // 🔹 LISTAR PROFESIONALES (PARA EL FRONTEND)
  @Get('professionals')
  getProfessionals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('specialty') specialty?: string,
    @Query('professionId') professionId?: string,
    @Query('professionSlug') professionSlug?: string,
    @Query('categorySlug') categorySlug?: string,
    @Query('attentionMode') attentionMode?: string,
  ) {
    return this.usersService.findProfessionals({
      page: Number(page) || 1,
      limit: Number(limit) || 12,
      search,
      specialty,
      professionId,
      professionSlug,
      categorySlug,
      attentionMode,
    });
  }

  // 🔹 SOLO ADMIN VE TODOS
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // 🔹 SOLO ADMIN ELIMINA
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // 🔹 PERFIL PROPIO
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: AuthRequest) {
    return this.usersService.getProfile(req.user.id);
  }

  // 🔹 PROFESIONAL ACTUALIZA SU DURACIÓN
  @UseGuards(JwtAuthGuard)
  @Patch('session-duration')
  updateSessionDuration(
    @Body() body: { duration: number },
    @Request() req: AuthRequest,
  ) {
    if (req.user.role !== Role.PROFESSIONAL) {
      throw new ForbiddenException(
        'Only professionals can set session duration',
      );
    }
    return this.usersService.updateSessionDuration(req.user.id, body.duration);
  }

  // 🔹 TEST ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin-test')
  adminTest() {
    return { message: 'Only admin can see this' };
  }
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(@Body() dto: UpdateProfileDto, @Request() req: AuthRequest) {
    return this.usersService.updateProfile(req.user.id, dto);
  }
}
