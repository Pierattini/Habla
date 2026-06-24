import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AttentionModality, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { NotificationService } from '../notifications/notification.service';

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  customerInterests?: string[];
  preferredAttentionMode?: AttentionModality;
  specialty?: string;
  professionId?: string;
  attentionMode?: AttentionModality;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) {}

  // ðŸ” LOGIN
  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return { ok: true };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    const resetUrl = `${this.getFrontendUrl()}/login?resetToken=${token}`;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    await this.notificationService.notify({
      type: 'PASSWORD_RESET',
      recipient: {
        email: user.email,
        name: user.name || 'Usuario',
      },
      channels: ['EMAIL'],
      data: {
        name: user.name || 'Usuario',
        resetUrl,
      },
    });

    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    const cleanToken = String(token || '').trim();

    if (!cleanToken || !password) {
      throw new BadRequestException('Token and password are required');
    }

    if (password.length < 6) {
      throw new BadRequestException('Password must have at least 6 characters');
    }

    const tokenHash = this.hashResetToken(cleanToken);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
        isActive: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    return { ok: true };
  }

  // REGISTER
  async register(data: RegisterInput) {
    const role = data.role ?? Role.CUSTOMER;
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const customerInterests = Array.isArray(data.customerInterests)
      ? data.customerInterests.filter(Boolean)
      : [];

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role,
        isActive: true,
        ...(role === Role.CUSTOMER && {
          customerInterests,
          preferredAttentionMode: data.preferredAttentionMode ?? null,
        }),
        ...(role === Role.PROFESSIONAL && {
          professional: {
            create: {
              name: data.name,
              slug: this.buildProfessionalSlug(data.name),
              specialty: data.specialty || null,
              professionId: data.professionId || null,
              attentionMode: data.attentionMode ?? AttentionModality.ONLINE,
            },
          },
        }),
      },
    });

    await this.sendRegistrationNotification(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
  }

  // OBTENER USUARIO REAL
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        createdAt: true,
        isActive: true,
        sessionDuration: true,
        country: true,
        timezone: true,
        taxId: true,
        taxName: true,
        taxEmail: true,
        taxAddress: true,
        taxCountry: true,
        taxCity: true,
        wantsTaxDocumentByDefault: true,
        customerInterests: true,
        preferredAttentionMode: true,
        preferredCity: true,
        preferredRegion: true,
        professional: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
  async updateUser(id: string, data: any) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  private buildProfessionalSlug(name: string): string {
    const base = String(name || 'profesional')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 70);

    return `${base || 'profesional'}-${Date.now().toString(36)}`;
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getFrontendUrl(): string {
    return (process.env.PUBLIC_FRONTEND_URL || 'http://localhost:4200').replace(
      /\/$/,
      '',
    );
  }

  private async sendRegistrationNotification(user: {
    email: string;
    name: string | null;
    role: Role;
  }) {
    try {
      await this.notificationService.notify({
        type:
          user.role === Role.PROFESSIONAL
            ? 'PROFESSIONAL_WELCOME'
            : 'CUSTOMER_WELCOME',
        recipient: {
          email: user.email,
          name: user.name || 'Usuario',
        },
        channels: ['EMAIL'],
        data: {
          name: user.name || 'Usuario',
        },
      });
    } catch {
      // El registro no debe fallar si el proveedor de correo no responde.
    }
  }
}

