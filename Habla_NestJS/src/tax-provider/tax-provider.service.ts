import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, TaxProvider, TaxProviderCredentialStatus } from '@prisma/client';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SaveTaxFolioRangeDto } from './dto/save-tax-folio-range.dto';
import { SaveTaxProviderCredentialDto } from './dto/save-tax-provider-credential.dto';
import { SiiBoletaClient } from '../sii/sii-boleta-client';
import { extractCertificateKeys, SiiCertificateKeys } from '../sii/sii-certificate';

const forge = require('node-forge');

export type SiiSendingProfile = {
  keys: SiiCertificateKeys;
  emitterRut: string;
  signerRut: string;
  taxActivity: string;
  resolutionNumber: number;
  resolutionDate: string;
  environment: 'CERTIFICATION' | 'PRODUCTION';
};

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

type TaxFolioRangeRecord = {
  id: string;
  provider: TaxProvider;
  dteCode: number;
  startFolio: number;
  endFolio: number;
  nextFolio: number;
  cafFileName: string | null;
  cafFingerprint: string | null;
  status: string;
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class TaxProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly siiBoletaClient: SiiBoletaClient,
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
        certificateExpiresAt: null,
        signerRut: null,
        taxActivity: null,
        resolutionNumber: null,
        resolutionDate: null,
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
      certificateExpiresAt: credential.certificateExpiresAt,
      signerRut: credential.signerRut,
      taxActivity: credential.taxActivity,
      resolutionNumber: credential.resolutionNumber,
      resolutionDate: credential.resolutionDate,
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
    const siiData = {
      certificateExpiresAt: this.readCertificateExpiry(certificate!.buffer, certificatePassword),
      signerRut: dto.signerRut ? this.normalizeRut(dto.signerRut) : null,
      taxActivity: dto.taxActivity?.trim() || null,
      resolutionNumber: dto.resolutionNumber ? Number(dto.resolutionNumber) : null,
      resolutionDate: dto.resolutionDate || null,
    };

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
          ...siiData,
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
          ...siiData,
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
      certificateExpiresAt: credential.certificateExpiresAt,
      signerRut: credential.signerRut,
      taxActivity: credential.taxActivity,
      resolutionNumber: credential.resolutionNumber,
      resolutionDate: credential.resolutionDate,
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

    // Se prueba contra la API de boletas, que es la que se usa al emitir.
    const environment =
      credential.environment === 'CERTIFICATION' ? 'CERTIFICATION' : 'PRODUCTION';
    let token: string;

    try {
      token = await this.siiBoletaClient.getToken(
        extractCertificateKeys(
          Buffer.from(this.decrypt(credential.encryptedCertificate), 'base64'),
          this.decrypt(credential.encryptedCertificatePassword),
        ),
        environment,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'No se pudo conectar con el SII',
      );
    }

    const result = {
      environment,
      tokenPreview: `${token.slice(0, 4)}...`,
      requestedAt: new Date(),
    };

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
      message: 'Conexión con SII validada correctamente',
    };
  }

  async getMyFolioRanges(user: TaxProviderUser) {
    this.ensureProfessional(user);

    const ranges = await this.prisma.$queryRaw<Array<TaxFolioRangeRecord>>`
      SELECT
        "id",
        "provider",
        "dteCode",
        "startFolio",
        "endFolio",
        "nextFolio",
        "cafFileName",
        "cafFingerprint",
        "status",
        "uploadedAt",
        "createdAt",
        "updatedAt"
      FROM "ProfessionalTaxFolioRange"
      WHERE "professionalId" = ${user.id}
        AND "provider" = ${TaxProvider.SII}::"TaxProvider"
      ORDER BY "status" ASC, "dteCode" ASC, "startFolio" ASC
    `;

    return ranges.map((range) => this.toFolioRangeResponse(range));
  }

  async saveMyFolioRange(
    user: TaxProviderUser,
    dto: SaveTaxFolioRangeDto,
    caf?: UploadedCertificateFile,
  ) {
    this.ensureProfessional(user);
    this.ensureCafFile(caf);

    const cafXml = caf!.buffer.toString('utf8');
    const parsed = this.parseCafXml(cafXml);
    const fingerprint = this.fingerprint(caf!.buffer);
    const status = dto.status || 'ACTIVE';

    const encryptedCafXml = this.encrypt(cafXml);
    const id = randomUUID();
    const range = await this.prisma.$queryRaw<Array<TaxFolioRangeRecord>>`
      INSERT INTO "ProfessionalTaxFolioRange" (
        "id",
        "professionalId",
        "provider",
        "dteCode",
        "startFolio",
        "endFolio",
        "nextFolio",
        "encryptedCafXml",
        "cafFileName",
        "cafFingerprint",
        "status",
        "uploadedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${id},
        ${user.id},
        ${TaxProvider.SII}::"TaxProvider",
        ${parsed.dteCode},
        ${parsed.startFolio},
        ${parsed.endFolio},
        ${parsed.startFolio},
        ${encryptedCafXml},
        ${caf!.originalname},
        ${fingerprint},
        ${status},
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT (
        "professionalId",
        "provider",
        "dteCode",
        "startFolio",
        "endFolio"
      )
      DO UPDATE SET
        "encryptedCafXml" = EXCLUDED."encryptedCafXml",
        "cafFileName" = EXCLUDED."cafFileName",
        "cafFingerprint" = EXCLUDED."cafFingerprint",
        "status" = EXCLUDED."status",
        "uploadedAt" = NOW(),
        "nextFolio" = EXCLUDED."nextFolio",
        "updatedAt" = NOW()
      RETURNING
        "id",
        "provider",
        "dteCode",
        "startFolio",
        "endFolio",
        "nextFolio",
        "cafFileName",
        "cafFingerprint",
        "status",
        "uploadedAt",
        "createdAt",
        "updatedAt"
    `;

    return this.toFolioRangeResponse(range[0]);
  }

  async deleteMyFolioRange(user: TaxProviderUser, id: string) {
    this.ensureProfessional(user);

    await this.prisma.$executeRaw`
      DELETE FROM "ProfessionalTaxFolioRange"
      WHERE "id" = ${id}
        AND "professionalId" = ${user.id}
        AND "provider" = ${TaxProvider.SII}::"TaxProvider"
    `;

    return { deleted: true, id };
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

  // Todo lo necesario para firmar y enviar boletas directo al SII, o null si falta
  // configurar algo (en ese caso la emisión automática queda como fallida y avisa).
  async getSiiSendingProfile(professionalId: string): Promise<SiiSendingProfile | null> {
    const credential =
      await this.prisma.professionalTaxProviderCredential.findUnique({
        where: {
          professionalId_provider: {
            professionalId,
            provider: TaxProvider.SII,
          },
        },
      });

    if (
      !credential ||
      credential.status !== TaxProviderCredentialStatus.CONFIGURED ||
      !credential.encryptedCertificate ||
      !credential.encryptedCertificatePassword ||
      !credential.signerRut ||
      !credential.taxActivity ||
      credential.resolutionNumber === null ||
      !credential.resolutionDate
    ) {
      return null;
    }

    return {
      keys: extractCertificateKeys(
        Buffer.from(this.decrypt(credential.encryptedCertificate), 'base64'),
        this.decrypt(credential.encryptedCertificatePassword),
      ),
      emitterRut: credential.rut,
      signerRut: credential.signerRut,
      taxActivity: credential.taxActivity,
      resolutionNumber: credential.resolutionNumber,
      resolutionDate: credential.resolutionDate,
      environment: credential.environment === 'CERTIFICATION' ? 'CERTIFICATION' : 'PRODUCTION',
    };
  }

  // Archivo CAF descifrado del rango que contiene ese folio.
  async getCafXmlForFolio(professionalId: string, dteCode: number, folio: number) {
    const range = await this.prisma.professionalTaxFolioRange.findFirst({
      where: {
        professionalId,
        provider: TaxProvider.SII,
        dteCode,
        startFolio: { lte: folio },
        endFolio: { gte: folio },
      },
    });

    return range ? this.decrypt(range.encryptedCafXml) : null;
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

  private ensureCafFile(caf?: UploadedCertificateFile): void {
    if (!caf?.buffer?.length) {
      throw new BadRequestException('Archivo CAF requerido');
    }

    const fileName = caf.originalname?.toLowerCase() || '';

    if (!fileName.endsWith('.xml')) {
      throw new BadRequestException('El CAF debe ser un archivo .xml');
    }

    if (caf.size > 1024 * 1024) {
      throw new BadRequestException('El archivo CAF no puede superar 1MB');
    }
  }

  private parseCafXml(xml: string) {
    const dteCode = Number(this.extractXmlValue(xml, 'TD'));
    const startFolio = Number(this.extractXmlValue(xml, 'D'));
    const endFolio = Number(this.extractXmlValue(xml, 'H'));

    if (!Number.isInteger(dteCode) || dteCode <= 0) {
      throw new BadRequestException('El CAF no contiene tipo de DTE válido');
    }

    if (
      !Number.isInteger(startFolio) ||
      !Number.isInteger(endFolio) ||
      startFolio <= 0 ||
      endFolio < startFolio
    ) {
      throw new BadRequestException('El CAF no contiene un rango de folios válido');
    }

    return {
      dteCode,
      startFolio,
      endFolio,
    };
  }

  private extractXmlValue(xml: string, tagName: string): string | null {
    const pattern = new RegExp(
      `<(?:\\w+:)?${tagName}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tagName}>`,
      'i',
    );
    const match = xml.match(pattern);
    return match?.[1]?.trim() || null;
  }

  private toFolioRangeResponse(range: {
    id: string;
    provider: TaxProvider;
    dteCode: number;
    startFolio: number;
    endFolio: number;
    nextFolio: number;
    cafFileName: string | null;
    cafFingerprint: string | null;
    status: string;
    uploadedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: range.id,
      provider: range.provider,
      dteCode: range.dteCode,
      startFolio: range.startFolio,
      endFolio: range.endFolio,
      nextFolio: range.nextFolio,
      availableFolios: Math.max(0, range.endFolio - range.nextFolio + 1),
      cafFileName: range.cafFileName,
      cafFingerprint: range.cafFingerprint,
      status: range.status,
      uploadedAt: range.uploadedAt,
      createdAt: range.createdAt,
      updatedAt: range.updatedAt,
    };
  }

  // Se valida con node-forge (el mismo que firma): acepta los .pfx con cifrado antiguo
  // (RC2/3DES) que entregan varias empresas chilenas y que OpenSSL 3 ya no abre.
  private validateCertificate(buffer: Buffer, passphrase: string): void {
    try {
      extractCertificateKeys(buffer, passphrase);
    } catch {
      throw new BadRequestException(
        'No pudimos abrir el certificado. Revisa que el archivo y la clave sean correctos.',
      );
    }
  }

  private readCertificateExpiry(buffer: Buffer, passphrase: string): Date | null {
    try {
      const { certificatePem } = extractCertificateKeys(buffer, passphrase);
      return forge.pki.certificateFromPem(certificatePem).validity.notAfter;
    } catch {
      return null;
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
        'SII_CERTIFICATE_ENCRYPTION_KEY no está configurada',
      );
    }

    return createHash('sha256').update(source).digest();
  }
}
