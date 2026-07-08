import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AttentionModality, Role } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { NotificationService } from '../notifications/notification.service';
import { RecaptchaService } from './recaptcha.service';

type RegisterInput = {
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
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
    private recaptchaService: RecaptchaService,
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

  async checkEmailAvailability(email: string) {
    const normalizedEmail = this.normalizeEmail(email);

    if (!this.isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Email invalido');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    return {
      available: !existingUser,
    };
  }

  // REGISTER
  async register(data: RegisterInput) {
    const normalizedName = this.normalizeName(data.name);
    const normalizedEmail = this.normalizeEmail(data.email);

    this.validateRegisterPayload({
      ...data,
      name: normalizedName,
      email: normalizedEmail,
    });

    await this.recaptchaService.verify(data.recaptchaToken, 'register');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('Este correo ya esta registrado.');
    }

    const role = data.role ?? Role.CUSTOMER;
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const customerInterests = Array.isArray(data.customerInterests)
      ? data.customerInterests.filter(Boolean)
      : [];
    const customProfession = this.normalizeProfessionText(data.customProfession || '');
    const professionalSpecialty = role === Role.PROFESSIONAL
      ? this.normalizeProfessionText(data.professionId ? data.specialty || '' : customProfession || data.specialty || '')
      : '';
    const professionalSlug = role === Role.PROFESSIONAL
      ? await this.buildUniqueProfessionalSlug(normalizedName)
      : null;

    const user = await this.prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
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
              name: normalizedName,
              slug: professionalSlug,
              specialty: professionalSpecialty || null,
              professionId: data.professionId || null,
              customProfession: data.professionId ? null : customProfession || null,
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

  async deleteMyAccount(id: string, confirmation: string) {
    const cleanConfirmation = String(confirmation || '').trim().toUpperCase();

    if (cleanConfirmation !== 'ELIMINAR') {
      throw new BadRequestException(
        'Debes escribir ELIMINAR para confirmar la solicitud.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        professional: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const now = new Date();
    const anonymizedEmail = `deleted-${user.id}@deleted.conecta.local`;
    const anonymizedPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.userDeviceToken.deleteMany({
        where: { userId: user.id },
      });

      await tx.googleCalendarConnection.deleteMany({
        where: { professionalUserId: user.id },
      });

      await tx.zoomConnection.deleteMany({
        where: { professionalUserId: user.id },
      });

      await tx.microsoftTeamsConnection.deleteMany({
        where: { professionalUserId: user.id },
      });

      await tx.professionalTaxProviderCredential.deleteMany({
        where: { professionalId: user.id },
      });

      await tx.professionalTaxFolioRange.deleteMany({
        where: { professionalId: user.id },
      });

      if (user.professional) {
        await tx.professional.update({
          where: { userId: user.id },
          data: {
            slug: null,
            professionId: null,
            customProfession: null,
            specialty: null,
            description: null,
            rules: null,
            name: 'Cuenta eliminada',
            price: null,
            duration: null,
            image: null,
            officeAddress: null,
            officeCity: null,
            officeRegion: null,
            officeCountry: null,
            officeLatitude: null,
            officeLongitude: null,
            arrivalInstructions: null,
            customVideoUrl: null,
            bankName: null,
            accountType: null,
            accountNumber: null,
            accountHolder: null,
            accountEmail: null,
            documentAutomationEnabled: false,
            manualDocumentMode: true,
            taxProvider: null,
            taxId: null,
            taxName: null,
            taxEmail: null,
            taxAddress: null,
            taxCountry: null,
            taxCity: null,
            taxDocumentNote: null,
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          email: anonymizedEmail,
          name: 'Cuenta eliminada',
          image: null,
          password: anonymizedPassword,
          isActive: false,
          deletionRequestedAt: now,
          deletedAt: now,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          country: null,
          timezone: null,
          taxId: null,
          taxName: null,
          taxEmail: null,
          taxAddress: null,
          taxCountry: null,
          taxCity: null,
          taxDocumentNote: null,
          wantsTaxDocumentByDefault: false,
          customerInterests: [],
          preferredAttentionMode: null,
          preferredCity: null,
          preferredRegion: null,
          credit: 0,
        },
      });
    });

    return {
      ok: true,
      deletedAt: now,
    };
  }

  private buildProfessionalSlug(name: string): string {
    const base = String(name || 'profesional')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 70);

    return base || 'profesional';
  }

  private async buildUniqueProfessionalSlug(name: string): Promise<string> {
    const base = this.buildProfessionalSlug(name);

    for (let index = 1; index <= 50; index += 1) {
      const candidate = index === 1 ? base : `${base}-${index}`;
      const existing = await this.prisma.professional.findFirst({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${base}-${Date.now().toString(36)}`;
  }

  private validateRegisterPayload(data: RegisterInput): void {
    if (!this.isValidFullName(data.name)) {
      throw new BadRequestException('Debes ingresar nombre y apellido.');
    }

    if (!this.isValidEmail(data.email)) {
      throw new BadRequestException('Correo electronico invalido.');
    }

    if (!this.isStrongPassword(data.password)) {
      throw new BadRequestException(
        'La contrasena debe tener minimo 8 caracteres, mayuscula, minuscula, numero y caracter especial.',
      );
    }

    if (data.acceptedTerms !== true) {
      throw new BadRequestException(
        'Debes aceptar terminos y politica de privacidad.',
      );
    }

    if (data.role === Role.PROFESSIONAL) {
      const professionId = String(data.professionId || '').trim();
      const customProfession = this.normalizeProfessionText(data.customProfession || '');
      const specialty = this.normalizeProfessionText(data.specialty || '');

      if (!professionId && !customProfession && !specialty) {
        throw new BadRequestException('Selecciona o escribe el servicio que ofreces.');
      }

      if (!professionId && !this.isValidCustomProfession(customProfession || specialty)) {
        throw new BadRequestException(
          'La profesion personalizada debe tener entre 3 y 50 caracteres y solo puede incluir letras, espacios, tildes y guiones.',
        );
      }
    }
  }

  private normalizeName(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  private normalizeEmail(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeProfessionText(value: string): string {
    return String(value || '').trim().replace(/\s+/g, ' ');
  }

  private isValidFullName(value: string): boolean {
    const name = this.normalizeName(value);

    if (name.length < 5 || name.length > 80) {
      return false;
    }

    if (!/^[A-Za-zÀ-ÿÑñ]+(?:[ -][A-Za-zÀ-ÿÑñ]+)+$/.test(name)) {
      return false;
    }

    return name.split(/\s+/).length >= 2;
  }

  private isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.normalizeEmail(value));
  }

  private isStrongPassword(value: string): boolean {
    const password = String(value || '');

    return password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
  }

  private isValidCustomProfession(value: string): boolean {
    const profession = this.normalizeProfessionText(value);

    return profession.length >= 3 &&
      profession.length <= 50 &&
      /^[\p{L}\s-]+$/u.test(profession);
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

