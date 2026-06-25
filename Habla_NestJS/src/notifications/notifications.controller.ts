import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterDeviceTokenDto } from './register-device-token.dto';

type AuthRequest = {
  user: {
    id: string;
  };
};

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('device-token')
  async registerDeviceToken(
    @Req() req: AuthRequest,
    @Body() dto: RegisterDeviceTokenDto,
  ) {
    const token = dto.token.trim();

    await this.prisma.userDeviceToken.upsert({
      where: { token },
      update: {
        userId: req.user.id,
        platform: dto.platform,
        isActive: true,
      },
      create: {
        userId: req.user.id,
        token,
        platform: dto.platform,
      },
    });

    return { ok: true };
  }
}
