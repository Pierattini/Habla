import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AttentionModality, Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 🔐 LOGIN
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Get('email-available')
  emailAvailable(@Query('email') email: string) {
    return this.authService.checkEmailAvailability(email);
  }

  @Post('request-password-reset')
  requestPasswordReset(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  // 👤 PERFIL
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    const userId: string = req.user?.id;

    if (!userId) {
      return { error: 'Token inválido' };
    }

    return this.authService.getUserById(userId);
  }

  // ✏️ ACTUALIZAR PERFIL (🔥 ESTE FALTABA)
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(@Request() req: any, @Body() body: any) {
    return this.authService.updateUser(req.user.id, body);
  }

  // 📝 REGISTER
  @Post('register')
  register(
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      role: Role;
      customerInterests?: string[];
      preferredAttentionMode?: AttentionModality;
      specialty?: string;
      professionId?: string;
      customProfession?: string;
      attentionMode?: AttentionModality;
      acceptedTerms?: boolean;
      recaptchaToken?: string;
    },
  ) {
    return this.authService.register(body);
  }
}
