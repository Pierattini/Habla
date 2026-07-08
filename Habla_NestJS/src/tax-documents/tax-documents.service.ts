import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentMode, DocumentStatus, Prisma, Role, TaxProvider } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { EmailService } from '../email/email.service';
import { LibreDteService } from '../libredte/libredte.service';
import { LibreDteDocumentKind, LibreDteResourceFormat } from '../libredte/libredte.types';
import { PrismaService } from '../prisma/prisma.service';
import { TaxProviderService } from '../tax-provider/tax-provider.service';
import { CreateTaxDocumentDto } from './dto/create-tax-document.dto';
import { TaxDocumentUser } from './interfaces/tax-document-user.interface';
import { SiiDteDraftService } from './sii-dte-draft.service';

type AdminTaxDocumentFilters = {
  status?: string;
  professionalId?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
};

type ProfessionalTaxDocumentFilters = {
  search?: string;
  status?: string;
  patient?: string;
  fromDate?: string;
  toDate?: string;
  page?: string;
  limit?: string;
};

type AutomaticIssueOptions = {
  finalAttempt?: boolean;
  jobId?: string;
};

type SiiFolioReservation = {
  id: string;
  dteCode: number;
  startFolio: number;
  endFolio: number;
  assignedFolio: number;
  cafFileName: string | null;
  cafFingerprint: string | null;
};

@Injectable()
export class TaxDocumentsService {
  private readonly allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly emailService: EmailService,
    private readonly libreDteService: LibreDteService,
    private readonly taxProviderService: TaxProviderService,
    private readonly siiDteDraftService: SiiDteDraftService,
  ) {}

  async createDocument(user: TaxDocumentUser, dto: CreateTaxDocumentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: dto.appointmentId },
      include: {
        customer: true,
        professional: {
          include: {
            professional: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    this.ensureAppointmentAccess(appointment, user.id);

    const taxDocument = await this.prisma.taxDocument.upsert({
      where: { appointmentId: appointment.id },
      update: {},
      create: {
        appointmentId: appointment.id,
        status: DocumentStatus.DOCUMENT_PENDING,
        mode: dto.mode ?? DocumentMode.MANUAL,
        type: dto.type,
        amount: appointment.documentAmount,
        currency: dto.currency ?? appointment.documentCurrency,
        customerTaxId: appointment.customer.taxId,
        customerTaxName: appointment.customer.taxName,
        customerTaxEmail: appointment.customer.taxEmail,
        customerTaxAddress: appointment.customer.taxAddress,
        customerTaxCountry: appointment.customer.taxCountry,
        customerTaxCity: appointment.customer.taxCity,
        customerTaxPhone: null,
        customerTaxComment: null,
        professionalTaxId: appointment.professional.professional?.taxId,
        professionalTaxName: appointment.professional.professional?.taxName,
        professionalTaxEmail: appointment.professional.professional?.taxEmail,
        professionalTaxAddress:
          appointment.professional.professional?.taxAddress ||
          appointment.professional.professional?.officeAddress,
        professionalTaxCountry:
          appointment.professional.professional?.taxCountry ||
          appointment.professional.professional?.officeCountry,
        professionalTaxCity:
          appointment.professional.professional?.taxCity ||
          appointment.professional.professional?.officeCity,
        professionalTaxNote:
          appointment.professional.professional?.taxDocumentNote ||
          'Servicios profesionales prestados a traves de Conecta.',
        events: {
          create: {
            actorId: user.id,
            type: 'DOCUMENT_CREATED',
            message: 'Tax document created from document request',
          },
        },
      },
    });

    await this.syncAppointmentDocumentStatus(
      taxDocument.appointmentId,
      taxDocument.status,
    );

    return taxDocument;
  }

  async getDocumentById(id: string, user: TaxDocumentUser) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureAppointmentAccess(document.appointment, user.id);

    return document;
  }

  async getDocumentByAppointment(appointmentId: string, user: TaxDocumentUser) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    this.ensureAppointmentAccess(appointment, user.id);

    return this.prisma.taxDocument.findUnique({
      where: { appointmentId },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async getDocumentsByUser(user: TaxDocumentUser) {
    return this.prisma.taxDocument.findMany({
      where: {
        appointment: {
          customerId: user.id,
        },
      },
      include: {
        appointment: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getDocumentsByProfessional(
    user: TaxDocumentUser,
    filters: ProfessionalTaxDocumentFilters = {},
  ) {
    const hasPagedQuery = Object.values(filters).some(
      (value) => value !== undefined && value !== null && String(value).trim() !== '',
    );
    const where = this.buildProfessionalDocumentWhere(user.id, filters);

    if (!hasPagedQuery) {
      return this.prisma.taxDocument.findMany({
        where,
        include: this.getProfessionalDocumentInclude(),
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    const page = this.parsePositiveInt(filters.page, 1, 1, 100000);
    const limit = this.parsePositiveInt(filters.limit, 20, 1, 100);
    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.taxDocument.count({ where }),
      this.prisma.taxDocument.findMany({
        where,
        include: this.getProfessionalDocumentInclude(),
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getPendingDocumentsByProfessional(user: TaxDocumentUser) {
    const documents = await this.prisma.taxDocument.findMany({
      where: {
        status: DocumentStatus.DOCUMENT_PENDING,
        appointment: {
          professionalId: user.id,
        },
      },
      include: {
        appointment: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return documents.map((document) => ({
      id: document.id,
      appointmentId: document.appointmentId,
      customer: document.appointment.customer,
      appointmentDate: document.appointment.date,
      amount: document.amount,
      currency: document.currency,
      status: document.status,
      createdAt: document.createdAt,
      customerTax: {
        name: document.customerTaxName,
        taxId: document.customerTaxId,
        email: document.customerTaxEmail,
        address: document.customerTaxAddress,
        country: document.customerTaxCountry,
        city: document.customerTaxCity,
        phone: document.customerTaxPhone,
        comment: document.customerTaxComment,
      },
    }));
  }

  async getAdminSummary() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
      totalDocuments,
      pendingDocuments,
      uploadedDocuments,
      sentDocuments,
      failedDocuments,
      generatedDocuments,
      monthDocuments,
      emailSentDocuments,
      emailNotSentDocuments,
    ] = await this.prisma.$transaction([
      this.prisma.taxDocument.count(),
      this.prisma.taxDocument.count({
        where: { status: DocumentStatus.DOCUMENT_PENDING },
      }),
      this.prisma.taxDocument.count({
        where: { status: DocumentStatus.DOCUMENT_UPLOADED },
      }),
      this.prisma.taxDocument.count({
        where: { status: DocumentStatus.DOCUMENT_SENT },
      }),
      this.prisma.taxDocument.count({
        where: { status: DocumentStatus.DOCUMENT_FAILED },
      }),
      this.prisma.taxDocument.count({
        where: { status: DocumentStatus.DOCUMENT_GENERATED },
      }),
      this.prisma.taxDocument.count({
        where: {
          createdAt: {
            gte: monthStart,
            lt: nextMonthStart,
          },
        },
      }),
      this.prisma.taxDocument.count({
        where: { emailSent: true },
      }),
      this.prisma.taxDocument.count({
        where: { emailSent: false },
      }),
    ]);

    return {
      totalDocuments,
      pendingDocuments,
      uploadedDocuments,
      sentDocuments,
      failedDocuments,
      generatedDocuments,
      monthDocuments,
      emailSentDocuments,
      emailNotSentDocuments,
    };
  }

  async getAdminDocuments(filters: AdminTaxDocumentFilters) {
    const where = this.buildAdminDocumentWhere(filters);

    const documents = await this.prisma.taxDocument.findMany({
      where,
      include: {
        appointment: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            professional: {
              select: {
                id: true,
                email: true,
                name: true,
                professional: {
                  select: {
                    name: true,
                    specialty: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return documents.map((document) => ({
      document: {
        id: document.id,
        appointmentId: document.appointmentId,
        type: document.type,
        mode: document.mode,
        fileName: document.fileName,
        createdAt: document.createdAt,
        generatedAt: document.generatedAt,
      },
      customer: document.appointment.customer,
      professional: {
        id: document.appointment.professional.id,
        email: document.appointment.professional.email,
        name:
          document.appointment.professional.professional?.name ||
          document.appointment.professional.name ||
          document.appointment.professional.email,
        specialty: document.appointment.professional.professional?.specialty,
      },
      appointment: {
        id: document.appointment.id,
        date: document.appointment.date,
        status: document.appointment.status,
      },
      amount: document.amount,
      currency: document.currency,
      status: document.status,
      uploadedAt: document.uploadedAt,
      sentAt: document.sentAt,
      emailSentAt: document.emailSentAt,
      emailSent: document.emailSent,
      pdfUrl: document.pdfUrl,
    }));
  }

  markAsUploaded(id: string, user: TaxDocumentUser, message?: string) {
    return this.updateStatus(
      id,
      user,
      DocumentStatus.DOCUMENT_UPLOADED,
      'DOCUMENT_UPLOADED',
      message,
      { uploadedAt: new Date(), uploadedById: user.id },
    );
  }

  async uploadDocumentFile(id: string, user: TaxDocumentUser, file: any) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only PDF, JPG, JPEG and PNG are allowed');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size must be 10MB or less');
    }

    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureProfessionalAccess(document.appointment, user);

    const uploaded = await this.cloudinaryService.uploadTaxDocument(id, file);

    const uploadedAt = new Date();

    const uploadedDocument = await this.prisma.taxDocument.update({
      where: { id },
      data: {
        status: DocumentStatus.DOCUMENT_UPLOADED,
        fileName: file.originalname,
        localFilePath: null,
        pdfUrl: uploaded.secure_url,
        pdfPublicId: uploaded.public_id,
        uploadedAt,
        uploadedById: user.id,
        emailSent: false,
        emailSentAt: null,
        events: {
          create: {
            actorId: user.id,
            type: 'DOCUMENT_UPLOADED',
            message: 'Documento cargado correctamente',
          },
        },
      },
      include: {
        appointment: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    await this.syncAppointmentDocumentStatus(
      uploadedDocument.appointmentId,
      DocumentStatus.DOCUMENT_UPLOADED,
    );

    return this.sendUploadedDocumentEmail(uploadedDocument, user.id);
  }

  markAsGenerated(id: string, user: TaxDocumentUser, message?: string) {
    return this.updateStatus(
      id,
      user,
      DocumentStatus.DOCUMENT_GENERATED,
      'DOCUMENT_GENERATED',
      message,
      { generatedAt: new Date() },
    );
  }

  markAsSent(id: string, user: TaxDocumentUser, message?: string) {
    return this.updateStatus(
      id,
      user,
      DocumentStatus.DOCUMENT_SENT,
      'DOCUMENT_SENT',
      message,
      { sentAt: new Date() },
    );
  }

  markAsFailed(id: string, user: TaxDocumentUser, message?: string) {
    return this.updateStatus(
      id,
      user,
      DocumentStatus.DOCUMENT_FAILED,
      'DOCUMENT_FAILED',
      message,
    );
  }

  markAsCancelled(id: string, user: TaxDocumentUser, message?: string) {
    return this.updateStatus(
      id,
      user,
      DocumentStatus.DOCUMENT_CANCELLED,
      'DOCUMENT_CANCELLED',
      message,
    );
  }

  async prepareSiiDraft(id: string, user: TaxDocumentUser) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureProfessionalAccess(document.appointment, user);

    if (document.providerDocumentId || document.siiTrackId) {
      throw new BadRequestException(
        'Este documento ya tiene datos de emision tributaria',
      );
    }

    const existingSiiDraft = this.getSiiDirectPayload(document.providerPayload);

    if (
      document.provider === TaxProvider.SII &&
      document.folio &&
      existingSiiDraft?.status === 'DRAFT_READY'
    ) {
      return {
        ...document,
        siiDraft: {
          dteCode: existingSiiDraft.dteCode,
          environment: existingSiiDraft.environment,
          folio: Number(document.folio),
          generatedAt: existingSiiDraft.generatedAt,
          warnings: existingSiiDraft.warnings || [],
        },
      };
    }

    const credential = await this.prisma.professionalTaxProviderCredential.findUnique({
      where: {
        professionalId_provider: {
          professionalId: document.appointment.professionalId,
          provider: TaxProvider.SII,
        },
      },
    });

    if (!credential?.encryptedCertificate) {
      throw new BadRequestException(
        'El profesional debe configurar su certificado SII antes de preparar el XML',
      );
    }

    const dteCode = this.siiDteDraftService.resolveDteCode(document.type);
    const folioReservation = document.folio
      ? null
      : await this.reserveSiiFolio(
          document.appointment.professionalId,
          dteCode,
        );
    const folio = document.folio
      ? Number(document.folio)
      : folioReservation?.assignedFolio;

    if (!folio) {
      throw new BadRequestException('No se pudo reservar un folio SII');
    }

    const draft = this.siiDteDraftService.buildDraft(document, folio);
    const providerPayload = this.mergeProviderPayload(document.providerPayload, {
      siiDirect: {
        status: 'DRAFT_READY',
        environment: credential.environment,
        dteCode: draft.dteCode,
        folio: draft.folio,
        folioRangeId: folioReservation?.id,
        cafFileName: folioReservation?.cafFileName,
        cafFingerprint: folioReservation?.cafFingerprint,
        generatedAt: draft.generatedAt.toISOString(),
        xml: draft.xml,
        warnings: draft.warnings,
      },
    });

    const updatedDocument = await this.prisma.taxDocument.update({
      where: { id },
      data: {
        provider: TaxProvider.SII,
        providerPayload,
        folio: String(draft.folio),
        dteCode: draft.dteCode,
        events: {
          create: {
            actorId: user.id,
            type: 'SII_DTE_DRAFT_CREATED',
            message: 'Borrador XML SII preparado. Aun no fue enviado al SII.',
            metadata: {
              environment: credential.environment,
              dteCode: draft.dteCode,
              folio: draft.folio,
              folioRangeId: folioReservation?.id,
              warnings: draft.warnings,
            },
          },
        },
      },
      include: {
        appointment: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return {
      ...updatedDocument,
      siiDraft: {
        dteCode: draft.dteCode,
        environment: credential.environment,
        folio: draft.folio,
        generatedAt: draft.generatedAt,
        warnings: draft.warnings,
      },
    };
  }

  async issueAutomaticForConfirmedPayment(
    appointmentId: string,
    options: AutomaticIssueOptions = {},
  ) {
    const finalAttempt = options.finalAttempt !== false;
    const document = await this.prisma.taxDocument.findUnique({
      where: { appointmentId },
      include: {
        appointment: {
          include: {
            professional: {
              include: {
                professional: true,
              },
            },
          },
        },
      },
    });

    if (!document) return null;

    const appointment = document.appointment;
    const professional = appointment.professional.professional;

    if (!appointment.documentRequested) return document;
    if (!professional?.documentAutomationEnabled) return document;
    if (document.mode !== DocumentMode.AUTOMATED) return document;

    const alreadyIssued = !!(
      document.providerDocumentId ||
      document.folio ||
      document.status === DocumentStatus.DOCUMENT_GENERATED ||
      document.status === DocumentStatus.DOCUMENT_SENT ||
      document.status === DocumentStatus.DOCUMENT_UPLOADED
    );

    if (alreadyIssued) return document;

    const credential =
      await this.taxProviderService.getLibreDteTokenForProfessional(
        appointment.professionalId,
      );

    if (!credential) {
      const error = new BadRequestException(
        'Credenciales LibreDTE no configuradas',
      );

      if (!options.jobId) return document;

      if (!finalAttempt) {
        await this.registerDocumentEvent(
          document.id,
          appointment.professionalId,
          'LIBREDTE_AUTO_ATTEMPT_FAILED',
          'Credenciales LibreDTE no configuradas',
          {
            jobId: options.jobId,
            appointmentId,
            code: 'MISSING_TAX_PROVIDER_CREDENTIALS',
          },
        );
        throw error;
      }

      const failedDocument = await this.prisma.taxDocument.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.DOCUMENT_FAILED,
          siiStatus: 'MISSING_TAX_PROVIDER_CREDENTIALS',
          siiStatusDetail: 'Credenciales LibreDTE no configuradas',
          events: {
            create: {
              actorId: appointment.professionalId,
              type: 'LIBREDTE_AUTO_DOCUMENT_FAILED',
              message: 'Credenciales LibreDTE no configuradas',
              metadata: {
                jobId: options.jobId,
                appointmentId,
              },
            },
          },
        },
      });

      await this.syncAppointmentDocumentStatus(
        failedDocument.appointmentId,
        DocumentStatus.DOCUMENT_FAILED,
      );

      return failedDocument;
    }

    const claim = await this.prisma.taxDocument.updateMany({
      where: {
        id: document.id,
        status: DocumentStatus.DOCUMENT_PENDING,
        providerDocumentId: null,
        folio: null,
      },
      data: {
          provider: TaxProvider.LIBREDTE,
          lastProviderSyncAt: new Date(),
      },
    });

    if (claim.count === 0) {
      return this.prisma.taxDocument.findUnique({
        where: { id: document.id },
      });
    }

    await this.prisma.taxDocumentEvent.create({
      data: {
        documentId: document.id,
        actorId: appointment.professionalId,
        type: 'LIBREDTE_AUTO_ISSUE_STARTED',
        message: 'Emision automatica iniciada al confirmar pago',
              metadata: {
                jobId: options.jobId,
                appointmentId,
                provider: TaxProvider.LIBREDTE,
              },
      },
    });

    try {
      const result = await this.libreDteService.issueDocument(
        document,
        undefined,
        credential.apiToken,
      );
      const status = this.libreDteService.getSuccessStatus(result.siiStatus);
      const issuedAt = new Date();

      const updatedDocument = await this.prisma.taxDocument.update({
        where: { id: document.id },
        data: {
          status,
          mode: DocumentMode.AUTOMATED,
          type: this.libreDteService.getDocumentType(undefined, document.type),
          provider: TaxProvider.LIBREDTE,
          providerDocumentId: result.providerDocumentId,
          providerPayload: result.providerPayload as Prisma.InputJsonValue,
          providerResponse: result.providerResponse as Prisma.InputJsonValue,
          dteCode: result.dteCode,
          folio: result.folio,
          siiTrackId: result.siiTrackId,
          siiStatus: result.siiStatus,
          siiStatusDetail: result.siiStatusDetail,
          pdfUrl: result.pdfUrl || document.pdfUrl,
          xmlUrl: result.xmlUrl || document.xmlUrl,
          generatedAt:
            status === DocumentStatus.DOCUMENT_GENERATED
              ? issuedAt
              : document.generatedAt,
          lastProviderSyncAt: issuedAt,
          fileName: document.fileName || `documento-${result.folio || document.id}.pdf`,
          events: {
            create: {
              actorId: appointment.professionalId,
              type:
                status === DocumentStatus.DOCUMENT_GENERATED
                  ? 'LIBREDTE_AUTO_DOCUMENT_ISSUED'
                  : 'LIBREDTE_AUTO_DOCUMENT_FAILED',
              message:
                status === DocumentStatus.DOCUMENT_GENERATED
                  ? 'Documento emitido automaticamente con LibreDTE'
                  : 'LibreDTE no pudo emitir automaticamente el documento',
              metadata: {
                appointmentId,
                folio: result.folio,
                siiTrackId: result.siiTrackId,
                siiStatus: result.siiStatus,
                siiStatusDetail: result.siiStatusDetail,
              },
            },
          },
        },
      });

      await this.syncAppointmentDocumentStatus(
        updatedDocument.appointmentId,
        status,
      );

      if (status === DocumentStatus.DOCUMENT_GENERATED) {
        return this.finalizeLibreDteDocumentDelivery(
          updatedDocument.id,
          appointment.professionalId,
          credential.apiToken,
          { finalAttempt, jobId: options.jobId },
        );
      }

      return updatedDocument;
    } catch (error) {
      const errorPayload = this.serializeLibreDteError(error);

      if (!finalAttempt) {
        await this.registerDocumentEvent(
          document.id,
          appointment.professionalId,
          'LIBREDTE_AUTO_ATTEMPT_FAILED',
          errorPayload.message,
          {
            jobId: options.jobId,
            appointmentId,
            ...errorPayload,
          } as Prisma.InputJsonValue,
        );
        throw error;
      }

      const failedDocument = await this.prisma.taxDocument.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.DOCUMENT_FAILED,
          provider: TaxProvider.LIBREDTE,
          providerResponse: errorPayload as Prisma.InputJsonValue,
          siiStatus: errorPayload.code,
          siiStatusDetail: errorPayload.message,
          lastProviderSyncAt: new Date(),
          events: {
            create: {
              actorId: appointment.professionalId,
              type: 'LIBREDTE_AUTO_DOCUMENT_FAILED',
              message: errorPayload.message,
              metadata: errorPayload as Prisma.InputJsonValue,
            },
          },
        },
      });

      await this.syncAppointmentDocumentStatus(
        failedDocument.appointmentId,
        DocumentStatus.DOCUMENT_FAILED,
      );

      return failedDocument;
    }
  }

  async issueLibreDteDocument(
    id: string,
    user: TaxDocumentUser,
    kind?: LibreDteDocumentKind,
  ) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureProfessionalAccess(document.appointment, user);

    const result = await this.libreDteService.issueDocument(document, kind);
    const status = this.libreDteService.getSuccessStatus(result.siiStatus);
    const issuedAt = new Date();
    const pdfUrl =
      result.pdfUrl ||
      (result.providerDocumentId
        ? await this.libreDteService.getResourceUrl(
            result.providerDocumentId,
            'pdf',
          )
        : document.pdfUrl);
    const xmlUrl =
      result.xmlUrl ||
      (result.providerDocumentId
        ? await this.libreDteService.getResourceUrl(
            result.providerDocumentId,
            'xml',
          )
        : document.xmlUrl);

    const updatedDocument = await this.prisma.taxDocument.update({
      where: { id },
      data: {
        status,
        mode: DocumentMode.AUTOMATED,
        type: this.libreDteService.getDocumentType(kind, document.type),
        provider: TaxProvider.LIBREDTE,
        providerDocumentId: result.providerDocumentId,
        providerPayload: result.providerPayload as Prisma.InputJsonValue,
        providerResponse: result.providerResponse as Prisma.InputJsonValue,
        dteCode: result.dteCode,
        folio: result.folio,
        siiTrackId: result.siiTrackId,
        siiStatus: result.siiStatus,
        siiStatusDetail: result.siiStatusDetail,
        pdfUrl,
        xmlUrl,
        generatedAt:
          status === DocumentStatus.DOCUMENT_GENERATED
            ? issuedAt
            : document.generatedAt,
        lastProviderSyncAt: issuedAt,
        fileName: document.fileName || `documento-${result.folio || id}.pdf`,
        events: {
          create: {
            actorId: user.id,
            type:
              status === DocumentStatus.DOCUMENT_GENERATED
                ? 'LIBREDTE_DOCUMENT_ISSUED'
                : 'LIBREDTE_DOCUMENT_FAILED',
            message:
              status === DocumentStatus.DOCUMENT_GENERATED
                ? 'Documento emitido con LibreDTE'
                : 'LibreDTE no pudo emitir el documento correctamente',
            metadata: {
              folio: result.folio,
              siiTrackId: result.siiTrackId,
              siiStatus: result.siiStatus,
            },
          },
        },
      },
      include: {
        appointment: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    await this.syncAppointmentDocumentStatus(
      updatedDocument.appointmentId,
      status,
    );

    return updatedDocument;
  }

  async syncLibreDteStatus(id: string, user: TaxDocumentUser) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureProfessionalAccess(document.appointment, user);

    if (!document.providerDocumentId) {
      throw new BadRequestException('Provider document id is not available');
    }

    const result = await this.libreDteService.syncStatus(
      document.providerDocumentId,
    );
    const status = this.libreDteService.getSuccessStatus(result.siiStatus);

    const updatedDocument = await this.prisma.taxDocument.update({
      where: { id },
      data: {
        status,
        siiTrackId: result.siiTrackId || document.siiTrackId,
        siiStatus: result.siiStatus,
        siiStatusDetail: result.siiStatusDetail,
        providerResponse: result.providerResponse as Prisma.InputJsonValue,
        lastProviderSyncAt: new Date(),
        events: {
          create: {
            actorId: user.id,
            type: 'LIBREDTE_STATUS_SYNCED',
            message: 'Estado de LibreDTE sincronizado',
            metadata: {
              siiTrackId: result.siiTrackId,
              siiStatus: result.siiStatus,
            },
          },
        },
      },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    await this.syncAppointmentDocumentStatus(
      updatedDocument.appointmentId,
      status,
    );

    return updatedDocument;
  }

  async finalizeLibreDteDocument(id: string, user: TaxDocumentUser) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureProfessionalAccess(document.appointment, user);

    const credential =
      await this.taxProviderService.getLibreDteTokenForProfessional(
        document.appointment.professionalId,
      );

    return this.finalizeLibreDteDocumentDelivery(
      document.id,
      user.id,
      credential?.apiToken,
    );
  }

  async getLibreDteResource(
    id: string,
    user: TaxDocumentUser,
    format: LibreDteResourceFormat,
  ) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureAppointmentAccess(document.appointment, user.id);

    const existingUrl = format === 'pdf' ? document.pdfUrl : document.xmlUrl;
    if (existingUrl) {
      return { url: existingUrl };
    }

    if (!document.providerDocumentId) {
      throw new BadRequestException('Provider document id is not available');
    }

    return {
      url: await this.libreDteService.getResourceUrl(
        document.providerDocumentId,
        format,
      ),
    };
  }

  async resendTaxDocumentEmail(id: string, user: TaxDocumentUser) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            professional: {
              include: {
                professional: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureProfessionalAccess(document.appointment, user);

    if (!document.pdfUrl) {
      throw new BadRequestException('Document file is not available');
    }

    const customer = document.appointment.customer;
    const customerEmail = document.customerTaxEmail || customer.email;
    const customerName =
      document.customerTaxName || customer.name || customer.email;
    const emailSentAt = new Date();

    await this.emailService.sendTaxDocumentEmail({
      customerName,
      customerEmail,
      fileName: document.fileName || 'Documento',
      pdfUrl: document.pdfUrl,
      xmlUrl: document.xmlUrl,
      uploadedAt: document.uploadedAt || document.generatedAt || emailSentAt,
      appointmentDate: document.appointment.date,
      professionalName:
        document.appointment.professional.professional?.name ||
        document.appointment.professional.name ||
        document.appointment.professional.email,
      professionalEmail: document.appointment.professional.email,
    });

    return this.prisma.taxDocument.update({
      where: { id: document.id },
      data: {
        emailSent: true,
        emailSentAt,
        events: {
          create: {
            actorId: user.id,
            type: 'DOCUMENT_EMAIL_RESENT',
            message: 'Correo de documento reenviado al cliente',
            metadata: {
              customerEmail,
            },
          },
        },
      },
      include: {
        appointment: {
          include: {
            customer: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  private async finalizeLibreDteDocumentDelivery(
    documentId: string,
    actorId: string,
    apiToken?: string,
    options: AutomaticIssueOptions = {},
  ) {
    const finalAttempt = options.finalAttempt !== false;
    let document = await this.getDocumentForDelivery(documentId);

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    if (!document.providerDocumentId) {
      await this.registerDocumentEvent(
        document.id,
        actorId,
        'LIBREDTE_STORAGE_FAILED',
        'No se pudo almacenar el documento: falta identificador de LibreDTE',
        { jobId: options.jobId, reason: 'missing_provider_document_id' },
      );
      return document;
    }

    if (!document.pdfUrl || !document.xmlUrl) {
      try {
        const storageData: Prisma.TaxDocumentUpdateInput = {};

        if (!document.pdfUrl) {
          const pdf = await this.storeLibreDteResource(
            document,
            'pdf',
            apiToken,
          );
          storageData.pdfUrl = pdf.secure_url;
          storageData.pdfPublicId = pdf.public_id;
        }

        if (!document.xmlUrl) {
          const xml = await this.storeLibreDteResource(
            document,
            'xml',
            apiToken,
          );
          storageData.xmlUrl = xml.secure_url;
          storageData.xmlPublicId = xml.public_id;
        }

        storageData.uploadedAt = document.uploadedAt || new Date();
        storageData.events = {
          create: {
            actorId,
            type: 'LIBREDTE_DOCUMENT_STORED',
            message: 'PDF y XML almacenados correctamente',
            metadata: {
              providerDocumentId: document.providerDocumentId,
            },
          },
        };

        document = await this.prisma.taxDocument.update({
          where: { id: document.id },
          data: storageData,
          include: this.getDeliveryInclude(),
        });
      } catch (error) {
        await this.registerDocumentEvent(
          document.id,
          actorId,
          'LIBREDTE_STORAGE_FAILED',
          'No se pudieron almacenar los archivos emitidos',
          {
            jobId: options.jobId,
            ...this.serializeLibreDteError(error),
          } as Prisma.InputJsonValue,
        );

        if (!finalAttempt) {
          throw error;
        }

        await this.markDocumentFailedAfterJobError(
          document.id,
          actorId,
          'Fallo definitivo al almacenar PDF/XML emitidos',
          error,
          options.jobId,
        );
        return document;
      }
    }

    if (!document.pdfUrl || document.emailSent) {
      return document;
    }

    try {
      const customer = document.appointment.customer;
      const customerEmail = document.customerTaxEmail || customer.email;
      const customerName =
        document.customerTaxName || customer.name || customer.email;
      const emailSentAt = new Date();
      const professional =
        document.appointment.professional.professional?.name ||
        document.appointment.professional.name ||
        document.appointment.professional.email;

      await this.emailService.sendTaxDocumentEmail({
        customerName,
        customerEmail,
        fileName: document.fileName || 'Documento',
        pdfUrl: document.pdfUrl,
        xmlUrl: document.xmlUrl,
        uploadedAt: document.uploadedAt || document.generatedAt || emailSentAt,
        appointmentDate: document.appointment.date,
        professionalName: professional,
        professionalEmail: document.appointment.professional.email,
      });

      const sentDocument = await this.prisma.taxDocument.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.DOCUMENT_SENT,
          sentAt: emailSentAt,
          emailSent: true,
          emailSentAt,
          events: {
            create: {
              actorId,
              type: 'DOCUMENT_SENT',
              message: 'Documento enviado automaticamente al paciente',
              metadata: {
                customerEmail,
                pdfUrl: document.pdfUrl,
                xmlUrl: document.xmlUrl,
              },
            },
          },
        },
        include: this.getDeliveryInclude(),
      });

      await this.syncAppointmentDocumentStatus(
        sentDocument.appointmentId,
        DocumentStatus.DOCUMENT_SENT,
      );

      return sentDocument;
    } catch (error) {
      await this.registerDocumentEvent(
        document.id,
        actorId,
        'DOCUMENT_EMAIL_FAILED',
        'No se pudo enviar el documento al paciente',
        {
          jobId: options.jobId,
          ...this.serializeLibreDteError(error),
        } as Prisma.InputJsonValue,
      );

      if (!finalAttempt) {
        throw error;
      }

      await this.markDocumentFailedAfterJobError(
        document.id,
        actorId,
        'Fallo definitivo al enviar correo del documento',
        error,
        options.jobId,
      );
      return document;
    }
  }

  private async markDocumentFailedAfterJobError(
    documentId: string,
    actorId: string,
    message: string,
    error: unknown,
    jobId?: string,
  ) {
    const errorPayload = this.serializeLibreDteError(error);
    const failedDocument = await this.prisma.taxDocument.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.DOCUMENT_FAILED,
        siiStatus: errorPayload.code,
        siiStatusDetail: errorPayload.message,
        events: {
          create: {
            actorId,
            type: 'DOCUMENT_FAILED',
            message,
            metadata: {
              jobId,
              ...errorPayload,
            } as Prisma.InputJsonValue,
          },
        },
      },
    });

    await this.syncAppointmentDocumentStatus(
      failedDocument.appointmentId,
      DocumentStatus.DOCUMENT_FAILED,
    );
  }

  private async storeLibreDteResource(
    document: {
      id: string;
      folio?: string | null;
      providerDocumentId?: string | null;
    },
    format: LibreDteResourceFormat,
    apiToken?: string,
  ) {
    if (!document.providerDocumentId) {
      throw new BadRequestException('Provider document id is not available');
    }

    const resource = await this.libreDteService.downloadResource(
      document.providerDocumentId,
      format,
      apiToken,
    );
    const fileBase = document.folio || document.providerDocumentId || document.id;

    return this.cloudinaryService.uploadTaxDocumentBuffer(
      document.id,
      resource.buffer,
      `documento-${fileBase}.${format}`,
      resource.contentType,
    );
  }

  private getDocumentForDelivery(documentId: string) {
    return this.prisma.taxDocument.findUnique({
      where: { id: documentId },
      include: this.getDeliveryInclude(),
    });
  }

  private getDeliveryInclude() {
    return {
      appointment: {
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          professional: {
            include: {
              professional: true,
            },
          },
        },
      },
    };
  }

  private registerDocumentEvent(
    documentId: string,
    actorId: string | null,
    type: string,
    message: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.taxDocumentEvent.create({
      data: {
        documentId,
        actorId,
        type,
        message,
        metadata,
      },
    });
  }

  private serializeLibreDteError(error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'getResponse' in error &&
      typeof (error as { getResponse?: unknown }).getResponse === 'function'
    ) {
      const response = (error as { getResponse: () => unknown }).getResponse();
      const record = response && typeof response === 'object'
        ? response as Record<string, unknown>
        : {};

      return {
        code: String(record['status'] || record['code'] || 'LIBREDTE_ERROR'),
        message: String(record['message'] || 'LibreDTE no pudo emitir el documento'),
        response,
      };
    }

    return {
      code: 'LIBREDTE_ERROR',
      message: error instanceof Error
        ? error.message
        : 'LibreDTE no pudo emitir el documento',
      response: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error: String(error) },
    };
  }

  private async updateStatus(
    id: string,
    user: TaxDocumentUser,
    status: DocumentStatus,
    eventType: string,
    message?: string,
    extraData: Record<string, unknown> = {},
  ) {
    const document = await this.prisma.taxDocument.findUnique({
      where: { id },
      include: {
        appointment: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Tax document not found');
    }

    this.ensureAppointmentAccess(document.appointment, user.id);

    const updatedDocument = await this.prisma.taxDocument.update({
      where: { id },
      data: {
        status,
        ...extraData,
        events: {
          create: {
            actorId: user.id,
            type: eventType,
            message,
          },
        },
      },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    await this.syncAppointmentDocumentStatus(
      updatedDocument.appointmentId,
      status,
    );

    return updatedDocument;
  }

  private buildProfessionalDocumentWhere(
    professionalId: string,
    filters: ProfessionalTaxDocumentFilters,
  ): Prisma.TaxDocumentWhereInput {
    const where: Prisma.TaxDocumentWhereInput = {
      appointment: {
        professionalId,
      },
    };

    if (filters.status) {
      if (!Object.values(DocumentStatus).includes(filters.status as DocumentStatus)) {
        throw new BadRequestException('Invalid document status filter');
      }

      where.status = filters.status as DocumentStatus;
    }

    const createdAt: Prisma.DateTimeFilter = {};

    if (filters.fromDate) {
      createdAt.gte = this.parseAdminDate(filters.fromDate, 'fromDate');
    }

    if (filters.toDate) {
      createdAt.lte = this.parseAdminDate(filters.toDate, 'toDate');
    }

    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const searchTerms = [filters.search, filters.patient]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);

    if (searchTerms.length > 0) {
      const search = searchTerms.join(' ');
      const appointment = where.appointment as Prisma.AppointmentWhereInput;

      appointment.customer = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    return where;
  }

  private getProfessionalDocumentInclude() {
    return {
      appointment: {
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    };
  }

  private parsePositiveInt(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return fallback;

    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }

  private buildAdminDocumentWhere(
    filters: AdminTaxDocumentFilters,
  ): Prisma.TaxDocumentWhereInput {
    const where: Prisma.TaxDocumentWhereInput = {};
    const appointment: Prisma.AppointmentWhereInput = {};

    if (filters.status) {
      if (!Object.values(DocumentStatus).includes(filters.status as DocumentStatus)) {
        throw new BadRequestException('Invalid document status filter');
      }

      where.status = filters.status as DocumentStatus;
    }

    if (filters.professionalId) {
      appointment.professionalId = filters.professionalId;
    }

    if (filters.customerId) {
      appointment.customerId = filters.customerId;
    }

    const createdAt: Prisma.DateTimeFilter = {};

    if (filters.fromDate) {
      createdAt.gte = this.parseAdminDate(filters.fromDate, 'fromDate');
    }

    if (filters.toDate) {
      createdAt.lte = this.parseAdminDate(filters.toDate, 'toDate');
    }

    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    if (appointment.professionalId || appointment.customerId) {
      where.appointment = appointment;
    }

    return where;
  }

  private parseAdminDate(value: string, field: string) {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field} filter`);
    }

    return date;
  }

  private mergeProviderPayload(
    current: Prisma.JsonValue | null,
    next: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const currentObject =
      current && typeof current === 'object' && !Array.isArray(current)
        ? (current as Record<string, unknown>)
        : {};

    return {
      ...currentObject,
      ...next,
    } as Prisma.InputJsonValue;
  }

  private getProviderPayloadObject(
    current: Prisma.JsonValue | null,
  ): Record<string, any> {
    return current && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, any>)
      : {};
  }

  private getSiiDirectPayload(current: Prisma.JsonValue | null) {
    const payload = this.getProviderPayloadObject(current);
    const siiDirect = payload['siiDirect'];

    return siiDirect && typeof siiDirect === 'object' && !Array.isArray(siiDirect)
      ? (siiDirect as Record<string, any>)
      : null;
  }

  private async reserveSiiFolio(
    professionalId: string,
    dteCode: number,
  ): Promise<SiiFolioReservation> {
    const [reservation] = await this.prisma.$transaction((tx) =>
      tx.$queryRaw<SiiFolioReservation[]>`
        UPDATE "ProfessionalTaxFolioRange"
        SET "nextFolio" = "nextFolio" + 1,
            "updatedAt" = NOW()
        WHERE "id" = (
          SELECT "id"
          FROM "ProfessionalTaxFolioRange"
          WHERE "professionalId" = ${professionalId}
            AND "provider" = ${TaxProvider.SII}::"TaxProvider"
            AND "dteCode" = ${dteCode}
            AND "status" = 'ACTIVE'
            AND "nextFolio" <= "endFolio"
          ORDER BY "nextFolio" ASC, "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING
          "id",
          "dteCode",
          "startFolio",
          "endFolio",
          "nextFolio" - 1 AS "assignedFolio",
          "cafFileName",
          "cafFingerprint"
      `,
    );

    if (!reservation) {
      throw new BadRequestException(
        `No hay folios CAF disponibles para el tipo DTE ${dteCode}`,
      );
    }

    return reservation;
  }

  private async syncAppointmentDocumentStatus(
    appointmentId: string,
    status: DocumentStatus,
  ) {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true },
      });

      if (!appointment) {
        console.warn('Appointment not found while syncing tax document status.');
        return;
      }

      await this.prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          documentStatus: status,
          ...(status === DocumentStatus.DOCUMENT_SENT
            ? { documentSentAt: new Date() }
            : {}),
        },
      });
    } catch {
      console.warn('Could not sync appointment document status.');
    }
  }

  private ensureAppointmentAccess(
    appointment: { customerId: string; professionalId: string },
    userId: string,
  ) {
    if (
      appointment.customerId !== userId &&
      appointment.professionalId !== userId
    ) {
      throw new ForbiddenException('You do not have access to this document');
    }
  }

  private ensureProfessionalAccess(
    appointment: { professionalId: string },
    user: TaxDocumentUser,
  ) {
    if (user.role !== Role.PROFESSIONAL || appointment.professionalId !== user.id) {
      throw new ForbiddenException('Only the professional can upload this document');
    }
  }

  private async sendUploadedDocumentEmail(document: any, actorId: string) {
    const customer = document.appointment.customer;
    const customerEmail = document.customerTaxEmail || customer.email;
    const customerName =
      document.customerTaxName || customer.name || customer.email;

    try {
      await this.emailService.sendTaxDocumentEmail({
        customerName,
        customerEmail,
        fileName: document.fileName || 'Documento',
        pdfUrl: document.pdfUrl,
        uploadedAt: document.uploadedAt,
      });

      return this.prisma.taxDocument.update({
        where: { id: document.id },
        data: {
          emailSent: true,
          emailSentAt: new Date(),
          events: {
            create: {
              actorId,
              type: 'DOCUMENT_EMAIL_SENT',
              message: 'Correo de documento enviado al cliente',
              metadata: {
                customerEmail,
              },
            },
          },
        },
        include: {
          appointment: {
            include: {
              customer: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          events: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch (error) {
      await this.prisma.taxDocumentEvent.create({
        data: {
          documentId: document.id,
          actorId,
          type: 'DOCUMENT_EMAIL_FAILED',
          message: 'No se pudo enviar el correo de documento al cliente',
          metadata: {
            customerEmail,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        },
      });

      return this.prisma.taxDocument.findUnique({
        where: { id: document.id },
        include: {
          appointment: {
            include: {
              customer: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          events: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }
  }
}
