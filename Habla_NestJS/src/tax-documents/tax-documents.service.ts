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
import { CreateTaxDocumentDto } from './dto/create-tax-document.dto';
import { TaxDocumentUser } from './interfaces/tax-document-user.interface';

type AdminTaxDocumentFilters = {
  status?: string;
  professionalId?: string;
  customerId?: string;
  fromDate?: string;
  toDate?: string;
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
          appointment.professional.professional?.taxAddress,
        professionalTaxCountry:
          appointment.professional.professional?.taxCountry,
        professionalTaxCity: appointment.professional.professional?.taxCity,
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

  async getDocumentsByProfessional(user: TaxDocumentUser) {
    return this.prisma.taxDocument.findMany({
      where: {
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
      uploadedAt: document.uploadedAt || document.generatedAt || emailSentAt,
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
        console.warn(
          `Appointment ${appointmentId} not found while syncing tax document status ${status}`,
        );
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
    } catch (error) {
      console.warn(
        `Could not sync appointment ${appointmentId} document status ${status}:`,
        error,
      );
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
