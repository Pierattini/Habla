import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Query,
  UseGuards,
  Request,
  Delete,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AttentionModality, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // 🔐 LOGIN
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(
    @Body()
    body: {
      email: string;
      password: string;
      recaptchaToken?: string;
    },
  ) {
    return this.authService.login(
      body.email,
      body.password,
      body.recaptchaToken,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  googleLogin(
    @Body()
    body: {
      idToken: string;
      role?: Role;
      acceptedTerms?: boolean;
      customerInterests?: string[];
      preferredAttentionMode?: AttentionModality;
      professionId?: string;
      customProfession?: string;
      specialty?: string;
      attentionMode?: AttentionModality;
    },
  ) {
    return this.authService.googleLogin(body);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('email-available')
  emailAvailable(@Query('email') email: string) {
    return this.authService.checkEmailAvailability(email);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request-password-reset')
  requestPasswordReset(
    @Body()
    body: {
      email: string;
      recaptchaToken?: string;
    },
  ) {
    return this.authService.requestPasswordReset(
      body.email,
      body.recaptchaToken,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  resetPassword(
    @Body()
    body: {
      token: string;
      password: string;
      recaptchaToken?: string;
    },
  ) {
    return this.authService.resetPassword(
      body.token,
      body.password,
      body.recaptchaToken,
    );
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

  @Delete('me/delete-account')
  @UseGuards(JwtAuthGuard)
  deleteMyAccount(@Request() req: any, @Body() body: { confirmation: string }) {
    return this.authService.deleteMyAccount(req.user.id, body.confirmation);
  }

  // 📝 REGISTER
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
