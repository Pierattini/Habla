import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DocumentMode, DocumentStatus, Role } from '@prisma/client';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxDocumentDto } from './dto/create-tax-document.dto';
import { TaxDocumentUser } from './interfaces/tax-document-user.interface';

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
