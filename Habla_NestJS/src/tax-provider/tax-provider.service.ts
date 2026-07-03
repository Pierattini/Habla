import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, TaxProvider, TaxProviderCredentialStatus } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SaveTaxProviderCredentialDto } from './dto/save-tax-provider-credential.dto';

type TaxProviderUser = {
  id: string;
  role: Role | string;
};

@Injectable()
export class TaxProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getMyCredential(user: TaxProviderUser) {
    this.ensureProfessional(user);

    const credential =
      await this.prisma.professionalTaxProviderCredential.findUnique({
        where: {
          professionalId_provider: {
            professionalId: user.id,
            provider: TaxProvider.LIBREDTE,
          },
        },
      });

    if (!credential) {
      return {
        configured: false,
        provider: TaxProvider.LIBREDTE,
        rut: null,
        status: null,
        lastValidatedAt: null,
        createdAt: null,
        updatedAt: null,
      };
    }

    return {
      configured: true,
      provider: credential.provider,
      rut: credential.rut,
      status: credential.status,
      lastValidatedAt: credential.lastValidatedAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  async saveMyCredential(user: TaxProviderUser, dto: SaveTaxProviderCredentialDto) {
    this.ensureProfessional(user);

    const rut = this.normalizeRut(dto.rut);
    const token = dto.apiToken?.trim();

    if (!token) {
      throw new BadRequestException('Token LibreDTE requerido');
    }

    const credential =
      await this.prisma.professionalTaxProviderCredential.upsert({
        where: {
          professionalId_provider: {
            professionalId: user.id,
            provider: TaxProvider.LIBREDTE,
          },
        },
        update: {
          rut,
          encryptedApiToken: this.encrypt(token),
          status: TaxProviderCredentialStatus.CONFIGURED,
          lastValidatedAt: null,
        },
        create: {
          professionalId: user.id,
          provider: TaxProvider.LIBREDTE,
          rut,
          encryptedApiToken: this.encrypt(token),
          status: TaxProviderCredentialStatus.CONFIGURED,
        },
      });

    return {
      configured: true,
      provider: credential.provider,
      rut: credential.rut,
      status: credential.status,
      lastValidatedAt: credential.lastValidatedAt,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    };
  }

  async deleteMyCredential(user: TaxProviderUser) {
    this.ensureProfessional(user);

    await this.prisma.professionalTaxProviderCredential.deleteMany({
      where: {
        professionalId: user.id,
        provider: TaxProvider.LIBREDTE,
      },
    });

    return {
      configured: false,
      provider: TaxProvider.LIBREDTE,
    };
  }

  async getLibreDteTokenForProfessional(professionalId: string) {
    const credential =
      await this.prisma.professionalTaxProviderCredential.findUnique({
        where: {
          professionalId_provider: {
            professionalId,
            provider: TaxProvider.LIBREDTE,
          },
        },
      });

    if (!credential || credential.status !== TaxProviderCredentialStatus.CONFIGURED) {
      return null;
    }

    return {
      rut: credential.rut,
      apiToken: this.decrypt(credential.encryptedApiToken),
    };
  }

  private ensureProfessional(user: TaxProviderUser) {
    if (user.role !== Role.PROFESSIONAL) {
      throw new ForbiddenException('Solo profesionales pueden configurar LibreDTE');
    }
  }

  private normalizeRut(value: string) {
    const rut = value.trim();

    if (!/^[a-zA-Z0-9.\-\s]{6,20}$/.test(rut)) {
      throw new BadRequestException('RUT emisor invalido');
    }

    return rut;
  }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decrypt(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split('.');

    if (!ivValue || !tagValue || !encryptedValue) {
      throw new BadRequestException('Credencial LibreDTE invalida');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivValue, 'base64url'),
    );

    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const source =
      this.config.get<string>('LIBREDTE_TOKEN_ENCRYPTION_KEY') ||
      this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_SECRET');

    if (!source) {
      throw new BadRequestException(
        'LIBREDTE_TOKEN_ENCRYPTION_KEY no esta configurada',
      );
    }

    return createHash('sha256').update(source).digest();
  }
}
