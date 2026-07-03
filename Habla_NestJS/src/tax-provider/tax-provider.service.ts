import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, TaxProvider, TaxProviderCredentialStatus } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { createSecureContext } from 'tls';
import { PrismaService } from '../prisma/prisma.service';
import { SaveTaxProviderCredentialDto } from './dto/save-tax-provider-credential.dto';
import { SiiDirectAuthService } from './sii-direct-auth.service';

type TaxProviderUser = {
  id: string;
  role: Role | string;
};

type UploadedCertificateFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class TaxProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly siiDirectAuth: SiiDirectAuthService,
  ) {}

  async getMyCredential(user: TaxProviderUser) {
    this.ensureProfessional(user);

    const credential =
      await this.prisma.professionalTaxProviderCredential.findUnique({
        where: {
          professionalId_provider: {
            professionalId: user.id,
            provider: TaxProvider.SII,
          },
        },
      });

    if (!credential) {
      return {
        configured: false,
        provider: TaxProvider.SII,
        rut: null,
        status: null,
        lastValidatedAt: null,
        createdAt: null,
        updatedAt: null,
        environment: null,
        certificateFileName: null,
        certificateFingerprint: null,
        certificateUploadedAt: null,
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
      environment: credential.environment,
      certificateFileName: credential.certificateFileName,
      certificateFingerprint: credential.certificateFingerprint,
      certificateUploadedAt: credential.certificateUploadedAt,
    };
  }

  async saveMyCredential(
    user: TaxProviderUser,
    dto: SaveTaxProviderCredentialDto,
    certificate?: UploadedCertificateFile,
  ) {
    this.ensureProfessional(user);

    const rut = this.normalizeRut(dto.rut);
    const certificatePassword = dto.certificatePassword?.trim();

    if (!certificatePassword) {
      throw new BadRequestException('Clave del certificado requerida');
    }

    this.ensureCertificateFile(certificate);
    this.validateCertificate(certificate!.buffer, certificatePassword);
    const validatedAt = new Date();

    const credential =
      await this.prisma.professionalTaxProviderCredential.upsert({
        where: {
          professionalId_provider: {
            professionalId: user.id,
            provider: TaxProvider.SII,
          },
        },
        update: {
          rut,
          encryptedCertificate: this.encrypt(certificate!.buffer.toString('base64')),
          encryptedCertificatePassword: this.encrypt(certificatePassword),
          certificateFileName: certificate!.originalname,
          certificateMimeType: certificate!.mimetype || 'application/octet-stream',
          certificateFingerprint: this.fingerprint(certificate!.buffer),
          certificateUploadedAt: new Date(),
          environment: dto.environment || 'PRODUCTION',
          status: TaxProviderCredentialStatus.CONFIGURED,
          lastValidatedAt: validatedAt,
        },
        create: {
          professionalId: user.id,
          provider: TaxProvider.SII,
          rut,
          encryptedCertificate: this.encrypt(certificate!.buffer.toString('base64')),
          encryptedCertificatePassword: this.encrypt(certificatePassword),
          certificateFileName: certificate!.originalname,
          certificateMimeType: certificate!.mimetype || 'application/octet-stream',
          certificateFingerprint: this.fingerprint(certificate!.buffer),
          certificateUploadedAt: new Date(),
          environment: dto.environment || 'PRODUCTION',
          status: TaxProviderCredentialStatus.CONFIGURED,
          lastValidatedAt: validatedAt,
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
      environment: credential.environment,
      certificateFileName: credential.certificateFileName,
      certificateFingerprint: credential.certificateFingerprint,
      certificateUploadedAt: credential.certificateUploadedAt,
    };
  }

  async deleteMyCredential(user: TaxProviderUser) {
    this.ensureProfessional(user);

    await this.prisma.professionalTaxProviderCredential.deleteMany({
      where: {
        professionalId: user.id,
        provider: TaxProvider.SII,
      },
    });

    return {
      configured: false,
      provider: TaxProvider.SII,
    };
  }

  async testMySiiAuthentication(user: TaxProviderUser) {
    this.ensureProfessional(user);

    const credential =
      await this.prisma.professionalTaxProviderCredential.findUnique({
        where: {
          professionalId_provider: {
            professionalId: user.id,
            provider: TaxProvider.SII,
          },
        },
      });

    if (
      !credential ||
      credential.status !== TaxProviderCredentialStatus.CONFIGURED ||
      !credential.encryptedCertificate ||
      !credential.encryptedCertificatePassword
    ) {
      throw new BadRequestException('Primero debes guardar tu certificado SII');
    }

    const result = await this.siiDirectAuth.requestToken({
      certificateBuffer: Buffer.from(
        this.decrypt(credential.encryptedCertificate),
        'base64',
      ),
      passphrase: this.decrypt(credential.encryptedCertificatePassword),
      environment: credential.environment,
    });

    const updated =
      await this.prisma.professionalTaxProviderCredential.update({
        where: {
          professionalId_provider: {
            professionalId: user.id,
            provider: TaxProvider.SII,
          },
        },
        data: {
          status: TaxProviderCredentialStatus.CONFIGURED,
          lastValidatedAt: result.requestedAt,
        },
      });

    return {
      ok: true,
      provider: updated.provider,
      environment: result.environment,
      tokenPreview: result.tokenPreview,
      lastValidatedAt: updated.lastValidatedAt,
      message: 'Conexion con SII validada correctamente',
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

    if (
      !credential ||
      credential.status !== TaxProviderCredentialStatus.CONFIGURED ||
      !credential.encryptedApiToken
    ) {
      return null;
    }

    return {
      rut: credential.rut,
      apiToken: this.decrypt(credential.encryptedApiToken),
    };
  }

  private ensureProfessional(user: TaxProviderUser) {
    if (user.role !== Role.PROFESSIONAL) {
      throw new ForbiddenException('Solo profesionales pueden configurar credenciales tributarias');
    }
  }

  private ensureCertificateFile(certificate?: UploadedCertificateFile): void {
    if (!certificate?.buffer?.length) {
      throw new BadRequestException('Certificado digital requerido');
    }

    const fileName = certificate.originalname?.toLowerCase() || '';
    const isAllowed = fileName.endsWith('.pfx') || fileName.endsWith('.p12');

    if (!isAllowed) {
      throw new BadRequestException('El certificado debe ser un archivo .pfx o .p12');
    }

    if (certificate.size > 2 * 1024 * 1024) {
      throw new BadRequestException('El certificado no puede superar 2MB');
    }
  }

  private validateCertificate(buffer: Buffer, passphrase: string): void {
    try {
      createSecureContext({
        pfx: buffer,
        passphrase,
      });
    } catch {
      throw new BadRequestException(
        'No pudimos abrir el certificado. Revisa que el archivo y la clave sean correctos.',
      );
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

  private fingerprint(value: Buffer): string {
    return createHash('sha256').update(value).digest('hex');
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
      this.config.get<string>('SII_CERTIFICATE_ENCRYPTION_KEY') ||
      this.config.get<string>('LIBREDTE_TOKEN_ENCRYPTION_KEY') ||
      this.config.get<string>('GOOGLE_TOKEN_ENCRYPTION_KEY') ||
      this.config.get<string>('JWT_SECRET');

    if (!source) {
      throw new BadRequestException(
        'SII_CERTIFICATE_ENCRYPTION_KEY no esta configurada',
      );
    }

    return createHash('sha256').update(source).digest();
  }
}
