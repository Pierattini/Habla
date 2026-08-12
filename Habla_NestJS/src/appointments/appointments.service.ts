import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttentionModality,
  AppointmentSource,
  AppointmentStatus,
  DocumentMode,
  DocumentStatus,
  Prisma,
  ScheduleMode,
  VideoProvider,
  WeekDay,
  Role,
  ProfessionalServiceMode,
  ProfessionalServiceStatus,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { NotificationService } from '../notifications/notification.service';
import type {
  NotificationChannel,
  NotificationType,
} from '../notifications/notification.types';
import { MeetingService } from '../meetings/meeting.service';
import { GoogleCalendarService } from '../meetings/google-calendar.service';
import { MicrosoftTeamsService } from '../meetings/microsoft-teams.service';
import { ZoomService } from '../meetings/zoom.service';
import { ProfessionalAccessService } from '../appointment-requests/professional-access.service';
import { TaxDocumentJobsService } from '../tax-documents/tax-document-jobs.service';
import {
  OCCUPYING_APPOINTMENT_STATUSES,
  ScheduleConflictsService,
} from '../scheduling/schedule-conflicts.service';
import {
  buildConectaEmail,
  conectaInfoCard,
  emailRow,
  escapeEmailHtml,
} from '../email/conecta-email-template';

type AvailabilityConfig = {
  scheduleMode: ScheduleMode;
  startMinute: number;
  endMinute: number;
  breakMinute: number;
  specificSlots: unknown;
  blockedRanges: unknown;
};

type AppointmentActionTokenPurpose = 'CONFIRM_PAYMENT' | 'REFUND_DONE';

type AppointmentActionTokenPayload = {
  appointmentId: string;
  purpose: AppointmentActionTokenPurpose;
  nonce: string;
  exp: number;
};

type TimeRange = {
  startMinute: number;
  endMinute: number;
};

type AppointmentDatabaseClient = PrismaService | Prisma.TransactionClient;

const RESERVED_APPOINTMENT_STATUSES = [...OCCUPYING_APPOINTMENT_STATUSES];

const CONECTA_EMAIL = 'app.info.conect@gmail.com';
const CONECTA_EMAIL_FROM = `Conecta <${CONECTA_EMAIL}>`;
const BOOKING_TIMEZONE = 'America/Santiago';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private meetingService: MeetingService,
    private googleCalendarService: GoogleCalendarService,
    private zoomService: ZoomService,
    private microsoftTeamsService: MicrosoftTeamsService,
    private professionalAccess: ProfessionalAccessService,
    private taxDocumentJobsService: TaxDocumentJobsService,
    private scheduleConflicts: ScheduleConflictsService,
  ) {}

  private getActionTokenSecret(): string {
    const secret =
      process.env.ACTION_LINK_SECRET ||
      process.env.JWT_SECRET ||
      process.env.RECAPTCHA_SECRET_KEY;

    if (!secret) {
      throw new Error('ACTION_LINK_SECRET o JWT_SECRET debe estar configurado.');
    }

    return secret;
  }

  private hashActionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private timingSafeStringEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);

    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return timingSafeEqual(aBuffer, bBuffer);
  }

  private signActionPayload(payload: string): string {
    return createHmac('sha256', this.getActionTokenSecret())
      .update(payload)
      .digest('base64url');
  }

  private createAppointmentActionToken(
    appointmentId: string,
    purpose: AppointmentActionTokenPurpose,
    ttlMinutes = 60 * 24 * 7,
  ) {
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const payload: AppointmentActionTokenPayload = {
      appointmentId,
      purpose,
      nonce: randomBytes(16).toString('hex'),
      exp: expiresAt.getTime(),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.signActionPayload(encodedPayload);
    const token = `${encodedPayload}.${signature}`;

    return {
      token,
      tokenHash: this.hashActionToken(token),
      expiresAt,
    };
  }

  private validateAppointmentActionToken(
    token: string,
    expectedAppointmentId: string,
    expectedPurpose: AppointmentActionTokenPurpose,
    expectedHash?: string | null,
    expiresAt?: Date | null,
  ): void {
    if (!token || !expectedHash || !expiresAt) {
      throw new BadRequestException('Enlace no válido o ya utilizado.');
    }

    if (expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El enlace expiro.');
    }

    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw new BadRequestException('Enlace no válido.');
    }

    if (
      !this.timingSafeStringEqual(
        signature,
        this.signActionPayload(encodedPayload),
      )
    ) {
      throw new BadRequestException('Enlace no válido.');
    }

    let payload: AppointmentActionTokenPayload;

    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as AppointmentActionTokenPayload;
    } catch {
      throw new BadRequestException('Enlace no válido.');
    }

    if (
      payload.appointmentId !== expectedAppointmentId ||
      payload.purpose !== expectedPurpose ||
      payload.exp !== expiresAt.getTime()
    ) {
      throw new BadRequestException('Enlace no válido.');
    }

    if (!this.timingSafeStringEqual(this.hashActionToken(token), expectedHash)) {
      throw new BadRequestException('Enlace no válido o ya utilizado.');
    }
  }

  private createMailTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER || CONECTA_EMAIL,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    });
  }

  private getMailFrom() {
    return (
      process.env.EMAIL_FROM ||
      process.env.MAIL_FROM ||
      process.env.SMTP_USER ||
      process.env.EMAIL_USER ||
      CONECTA_EMAIL_FROM
    );
  }

  async create(
    customerId: string,
    professionalId: string,
    date: Date,
    options: {
      serviceId?: string;
      documentRequested?: boolean;
      documentCurrency?: string;
      documentMode?: DocumentMode;
      attentionMode?: AttentionModality;
      customerTaxData?: {
        name?: string;
        taxId?: string;
        address?: string;
        phone?: string;
        comment?: string;
      };
    } = {},
  ) {
    const now = new Date();

    if (date <= now) {
      throw new ForbiddenException(
        'You cannot book an appointment in the past',
      );
    }

    if (customerId === professionalId) {
      throw new ForbiddenException(
        'You cannot book an appointment with yourself',
      );
    }

    // 👇 Primero buscamos al professional
    const professional = await this.prisma.professional.findUnique({
      where: { userId: professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    await this.professionalAccess.assertCanReceiveRequests(professionalId);

    if (professional.user.role !== 'PROFESSIONAL') {
      throw new ForbiddenException('Selected user is not a professional');
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const attentionMode = this.resolveAttentionMode(
      options.attentionMode,
      professional.attentionMode,
    );

    if (
      attentionMode === AttentionModality.PRESENTIAL &&
      !this.hasPresentialData(professional)
    ) {
      throw new BadRequestException(
        'Este profesional debe completar dirección, ciudad y país antes de recibir reservas presenciales',
      );
    }

    const initialSelection = await this.resolveCustomerBookingSelection(
      this.prisma,
      professionalId,
      options.serviceId,
    );
    const appointmentDurationInMinutes = initialSelection.durationMinutes;
    this.assertDateWithinBookingWindow(date);
    // 🔎 Verificar disponibilidad del profesional

    const dayMap = [
      WeekDay.SUN,
      WeekDay.MON,
      WeekDay.TUE,
      WeekDay.WED,
      WeekDay.THU,
      WeekDay.FRI,
      WeekDay.SAT,
    ];
    // 🔥 FORZAR fecha local sin desfase
    const appointmentDay = this.getWeekDayInBookingTimezone(date);

    const availability = await this.prisma.availability.findFirst({
      where: {
        professionalId,
        day: appointmentDay,
      },
    });

    if (!availability) {
      throw new ForbiddenException(
        'Professional is not available at this time',
      );
    }

    const matchesScheduleConfig = await this.isDateAvailableForProfessional(
      professionalId,
      date,
      appointmentDurationInMinutes,
    );

    if (!matchesScheduleConfig) {
      throw new ForbiddenException(
        'Professional is not available at this time',
      );
    }
    let finalPrice = initialSelection.priceAmount;

    // 👇 crear cita con precio final
    const documentRequested = options.documentRequested === true;
    const documentCurrency = options.documentCurrency ?? 'CLP';
    const requestedMode = documentRequested && professional.documentAutomationEnabled
      ? DocumentMode.AUTOMATED
      : DocumentMode.MANUAL;

    if (documentRequested) {
      this.ensureCustomerTaxDataReady(options.customerTaxData);

      if (requestedMode === DocumentMode.AUTOMATED) {
        this.ensureProfessionalTaxDataReady(professional);
      }
    }

    if (!professional.firstLeadReceivedAt) {
      await this.prisma.professional.update({
        where: { userId: professionalId },
        data: {
          firstLeadReceivedAt: new Date(),
        },
      });
    }
    const appointment = await this.scheduleConflicts.runExclusive(
      professionalId,
      async (tx) => {
        const selection = await this.resolveCustomerBookingSelection(
          tx,
          professionalId,
          options.serviceId,
        );
        const lockedEndDate = new Date(
          date.getTime() + selection.durationMinutes * 60_000,
        );
        const stillMatchesSchedule = await this.isDateAvailableForProfessional(
          professionalId,
          date,
          selection.durationMinutes,
          tx,
        );

        if (!stillMatchesSchedule) {
          throw new ForbiddenException(
            'Professional is not available at this time',
          );
        }

        await this.scheduleConflicts.assertRangeAvailable(
          tx,
          { professionalId, startAt: date, endAt: lockedEndDate },
          professional.duration ?? professional.user.sessionDuration ?? 60,
        );

        finalPrice = selection.priceAmount;

        const creditAppointment = await tx.appointment.findFirst({
          where: {
            customerId,
            penaltyResolved: true,
            penaltyOption: 'CREDIT',
          },
        });

        if (creditAppointment) {
          const discount = creditAppointment.penalty || 0;
          finalPrice -= discount;
          await tx.appointment.update({
            where: { id: creditAppointment.id },
            data: {
              penaltyResolved: false,
              penaltyOption: null,
            },
          });
        }

        return tx.appointment.create({
          data: {
        date,
        customerId,
        professionalId,
        serviceId: selection.serviceId,
        serviceNameSnapshot: selection.name,
        servicePriceTypeSnapshot: selection.priceType,
        servicePriceAmountSnapshot: selection.snapshotPriceAmount,
        serviceCurrencySnapshot: selection.currency,
        serviceDurationMinutesSnapshot: selection.snapshotDurationMinutes,
        penalty: finalPrice, // opcional (puedes usar otro campo si luego haces pricing formal)
        documentRequested,
        attentionMode,
        appointmentAddress:
          attentionMode === AttentionModality.PRESENTIAL
            ? professional.officeAddress
            : null,
        appointmentCity:
          attentionMode === AttentionModality.PRESENTIAL
            ? professional.officeCity
            : null,
        appointmentRegion:
          attentionMode === AttentionModality.PRESENTIAL
            ? professional.officeRegion
            : null,
        appointmentCountry:
          attentionMode === AttentionModality.PRESENTIAL
            ? professional.officeCountry
            : null,
        appointmentLatitude:
          attentionMode === AttentionModality.PRESENTIAL
            ? professional.officeLatitude
            : null,
        appointmentLongitude:
          attentionMode === AttentionModality.PRESENTIAL
            ? professional.officeLongitude
            : null,
        arrivalInstructions:
          attentionMode === AttentionModality.PRESENTIAL
            ? professional.arrivalInstructions
            : null,
        videoProvider:
          attentionMode === AttentionModality.ONLINE
            ? professional.videoProvider
            : null,
        documentStatus: documentRequested
          ? DocumentStatus.DOCUMENT_PENDING
          : DocumentStatus.DOCUMENT_NOT_REQUIRED,
        documentRequestedAt: documentRequested ? new Date() : null,
        documentAmount: finalPrice,
            documentCurrency,
          },
        });
      },
    );

    if (documentRequested) {
      await this.prisma.taxDocument.upsert({
        where: { appointmentId: appointment.id },
        update: {},
        create: {
          appointmentId: appointment.id,
          status: DocumentStatus.DOCUMENT_PENDING,
          mode: requestedMode,
          amount: finalPrice,
          currency: documentCurrency,
          customerTaxId: options.customerTaxData?.taxId,
          customerTaxName:
            options.customerTaxData?.name || customer.name || customer.email,
          customerTaxEmail: customer.taxEmail || customer.email,
          customerTaxAddress: options.customerTaxData?.address,
          customerTaxCountry: customer.taxCountry || customer.country,
          customerTaxCity: customer.taxCity,
          customerTaxPhone: options.customerTaxData?.phone,
          customerTaxComment: options.customerTaxData?.comment,
          professionalTaxId: professional.taxId,
          professionalTaxName:
            professional.taxName ||
            professional.name ||
            professional.user.email,
          professionalTaxEmail:
            professional.taxEmail || professional.user.email,
          professionalTaxAddress:
            professional.taxAddress || professional.officeAddress,
          professionalTaxCountry:
            professional.taxCountry ||
            professional.officeCountry ||
            professional.user.country,
          professionalTaxCity: professional.taxCity || professional.officeCity,
          professionalTaxNote:
            professional.taxDocumentNote ||
            'Servicios profesionales prestados a traves de Conecta.',
          events: {
            create: {
              actorId: customerId,
              type: 'DOCUMENT_CREATED',
              message:
                requestedMode === DocumentMode.AUTOMATED
                  ? 'Tax document requested for Conecta management'
                  : 'Tax document requested for professional manual management',
              metadata: {
                mode: requestedMode,
              },
            },
          },
        },
      });
    }

    await this.sendAppointmentNotificationById(appointment.id, 'APPOINTMENT_BOOKED', [
      'EMAIL',
    ]);
    await this.prisma.appointment.update({
      where: { id: appointment.id },
      data: { bookedEmailSentAt: new Date() },
    });

    return appointment;
  }

  async createManual(
    professionalId: string,
    customerId: string | undefined,
    date: Date,
    serviceId?: string,
    guestCustomerName?: string,
  ) {
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new ForbiddenException('No puedes agendar una cita en el pasado.');
    }

    this.assertDateWithinBookingWindow(date);
    const normalizedGuestName = String(guestCustomerName || '').trim().replace(/\s+/g, ' ');
    if ((!customerId && !normalizedGuestName) || (customerId && normalizedGuestName)) {
      throw new ForbiddenException(
        'Selecciona un paciente registrado o ingresa el nombre del paciente.',
      );
    }

    const [professional, customer] = await Promise.all([
      this.prisma.professional.findUnique({
        where: { userId: professionalId },
        include: { user: true },
      }),
      customerId
        ? this.prisma.user.findUnique({
            where: { id: customerId },
            select: { id: true, role: true, isActive: true, deletedAt: true },
          })
        : Promise.resolve(null),
    ]);

    if (!professional || professional.user.role !== Role.PROFESSIONAL) {
      throw new ForbiddenException('Solo un profesional puede crear esta cita.');
    }
    if (customerId && (
      !customer ||
      customer.role !== Role.CUSTOMER ||
      !customer.isActive ||
      customer.deletedAt
    )) {
      throw new ForbiddenException('El paciente seleccionado no está disponible.');
    }

    const initialSelection = await this.resolveProfessionalManualSelection(
      this.prisma,
      professionalId,
      serviceId,
    );
    const duration = initialSelection.durationMinutes;
    const matchesSchedule = await this.isDateAvailableForProfessional(
      professionalId,
      date,
      duration,
    );
    if (!matchesSchedule) {
      throw new ForbiddenException('Profesional no disponible en ese horario.');
    }

    const appointment = await this.scheduleConflicts.runExclusive(
      professionalId,
      async (tx) => {
        const selection = await this.resolveProfessionalManualSelection(
          tx,
          professionalId,
          serviceId,
        );
        const [lockedCustomer, stillMatchesSchedule] = await Promise.all([
          customerId
            ? tx.user.findUnique({
                where: { id: customerId },
                select: { role: true, isActive: true, deletedAt: true },
              })
            : Promise.resolve(null),
          this.isDateAvailableForProfessional(
            professionalId,
            date,
            selection.durationMinutes,
            tx,
          ),
        ]);

        if (customerId && (
          !lockedCustomer ||
          lockedCustomer.role !== Role.CUSTOMER ||
          !lockedCustomer.isActive ||
          lockedCustomer.deletedAt
        )) {
          throw new ForbiddenException('El paciente seleccionado no está disponible.');
        }
        if (!stillMatchesSchedule) {
          throw new ForbiddenException('Profesional no disponible en ese horario.');
        }

        await this.scheduleConflicts.assertRangeAvailable(
          tx,
          {
            professionalId,
            startAt: date,
            endAt: new Date(
              date.getTime() + selection.durationMinutes * 60_000,
            ),
          },
          professional.duration ?? professional.user.sessionDuration ?? 60,
        );

        return tx.appointment.create({
          data: {
            date,
            customerId,
            guestCustomerName: customerId ? null : normalizedGuestName,
            professionalId,
            serviceId: selection.serviceId,
            serviceNameSnapshot: selection.name,
            servicePriceTypeSnapshot: selection.priceType,
            servicePriceAmountSnapshot: selection.snapshotPriceAmount,
            serviceCurrencySnapshot: selection.currency,
            serviceDurationMinutesSnapshot: selection.snapshotDurationMinutes,
            status: AppointmentStatus.CONFIRMED,
            source: AppointmentSource.PROFESSIONAL_MANUAL,
            penalty: 0,
            creditUsed: null,
            remainingToPay: 0,
            documentRequested: false,
            documentStatus: DocumentStatus.DOCUMENT_NOT_REQUIRED,
            attentionMode:
              professional.attentionMode === AttentionModality.PRESENTIAL
                ? AttentionModality.PRESENTIAL
                : AttentionModality.ONLINE,
          },
        });
      },
    );

    if (customerId) {
      await this.sendAppointmentNotificationById(
        appointment.id,
        'APPOINTMENT_MANUAL_CREATED',
        ['EMAIL', 'PUSH'],
      );
    }
    return appointment;
  }

  async findByProfessional(userId: string) {
    await this.releaseExpiredPayments();

    const professional = await this.prisma.professional.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    return this.prisma.appointment.findMany({
      where: {
        professionalId: userId,
        status: {
          not: AppointmentStatus.REFUNDED,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
        professional: {
          include: {
            professional: true,
          },
        },
        review: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async findByCustomer(userId: string) {
    await this.releaseExpiredPayments();

    return this.prisma.appointment.findMany({
      where: { customerId: userId },
      include: {
        professional: {
          include: {
            professional: true,
          },
        },
        review: true,
      },
      orderBy: {
        date: 'asc',
      },
    });
  }
  async confirmAppointment(id: string, professionalId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
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

    if (appointment.professionalId !== professionalId) {
      throw new ForbiddenException('You cannot confirm this appointment');
    }

    let updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
      },
    });

    if (appointment.attentionMode === AttentionModality.ONLINE) {
      updated = await this.meetingService.generateMeetingForAppointment(
        updated.id,
      );
    }

    const meetLink = updated.meetingUrl || updated.meetLink;

    if (meetLink && appointment.customer) {
      this.scheduleVideoConferenceEmails(
        appointment.customer.email,
        appointment.professional.email,
        appointment.date,
        meetLink,
      );
    }

    await this.sendAppointmentNotificationById(
      updated.id,
      'APPOINTMENT_CONFIRMATION',
    );

    return updated;
  }

  async completeAppointment(id: string, professionalId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: {
          include: {
            professional: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.professionalId !== professionalId) {
      throw new ForbiddenException('No puedes finalizar esta cita');
    }

    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      appointment.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException('Solo se pueden finalizar citas confirmadas');
    }

    const duration = this.scheduleConflicts.resolveAppointmentDuration(
      appointment.serviceDurationMinutesSnapshot,
      appointment.professional.professional?.duration ??
        appointment.professional.sessionDuration ??
        60,
    );
    const endsAt = new Date(appointment.date.getTime() + duration * 60000);

    if (endsAt > new Date()) {
      throw new BadRequestException('La cita aun no ha finalizado');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.COMPLETED,
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
        professional: {
          include: {
            professional: true,
          },
        },
        review: true,
      },
    });
  }

  async cancelAppointment(id: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (
      appointment.customerId !== userId &&
      appointment.professionalId !== userId
    ) {
      throw new ForbiddenException('No puedes cancelar esta cita');
    }

    if (appointment.source === AppointmentSource.PROFESSIONAL_MANUAL) {
      const updated = await this.prisma.appointment.update({
        where: { id },
        data: { status: AppointmentStatus.CANCELLED, penalty: 0 },
      });
      await this.sendAppointmentNotificationById(
        updated.id,
        'APPOINTMENT_CANCELLATION',
      );
      await this.deleteExternalMeetingIfNeeded(appointment);
      return { ...updated, requiresPenaltyResolution: false };
    }

    const now = new Date();
    const appointmentDate = new Date(appointment.date);

    const diffHours =
      (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const professional = await this.prisma.professional.findUnique({
      where: { userId: appointment.professionalId },
    });

    const price = professional?.price || 0;
    const isConfirmedReservation =
      appointment.status === AppointmentStatus.CONFIRMED ||
      appointment.status === AppointmentStatus.RESCHEDULED;
    const isProfessionalActor = appointment.professionalId === userId;

    // 🔥 SI YA PAGÓ
    if (
      isConfirmedReservation
    ) {
      const penalty = !isProfessionalActor && diffHours < 48 ? price * 0.5 : 0;

      const updated = await this.prisma.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.CANCELLED,
          penalty,
        },
      });

      await this.sendAppointmentNotificationById(
        updated.id,
        'APPOINTMENT_CANCELLATION',
      );
      await this.deleteExternalMeetingIfNeeded(appointment);

      return {
        ...updated,
        requiresPenaltyResolution: penalty > 0,
      };
    }

    // 🔥 NO PAGADA Y MENOS DE 48H
    if (diffHours < 48) {
      const updated = await this.prisma.appointment.update({
        where: { id },
        data: {
          status: AppointmentStatus.CANCELLED,
          penalty: 0,
        },
      });

      await this.sendAppointmentNotificationById(
        updated.id,
        'APPOINTMENT_CANCELLATION',
      );
      await this.deleteExternalMeetingIfNeeded(appointment);

      return {
        ...updated,
        requiresPenaltyResolution: false,
      };
    }

    // 🔥 MÁS DE 48H
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        penalty: 0,
      },
    });

    await this.sendAppointmentNotificationById(
      updated.id,
      'APPOINTMENT_CANCELLATION',
    );
    await this.deleteExternalMeetingIfNeeded(appointment);

    return updated;
  }
  async getAvailableSlots(
    professionalId: string,
    date: string,
    serviceId?: string,
    bookingActor: 'CUSTOMER' | 'PROFESSIONAL' = 'CUSTOMER',
  ) {
    const dateKey = this.normalizeBookingDateKey(date);
    const bookingDay = this.zonedDateTimeToUtc(dateKey, 12 * 60);
    this.assertDateWithinBookingWindow(bookingDay);

    const professional = await this.prisma.professional.findUnique({
      where: { userId: professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    const selection =
      bookingActor === 'PROFESSIONAL'
        ? await this.resolveProfessionalManualSelection(
            this.prisma,
            professionalId,
            serviceId,
          )
        : await this.resolveCustomerBookingSelection(
            this.prisma,
            professionalId,
            serviceId,
          );
    const duration = selection.durationMinutes;

    const cleanDate = bookingDay;

    if (isNaN(cleanDate.getTime())) {
      throw new ForbiddenException('Fecha inválida');
    }

    const appointmentDay = this.getWeekDayInBookingTimezone(cleanDate);

    const availability = await this.prisma.availability.findMany({
      where: {
        professionalId,
        day: appointmentDay,
      },
    });

    const startOfDay = this.zonedDateTimeToUtc(dateKey, 0);
    const endOfDay = this.zonedDateTimeToUtc(
      this.addDaysToDateKey(dateKey, 1),
      0,
    );

    const earliestRelevantAppointment = new Date(
      startOfDay.getTime() - Math.max(duration, 480) * 60_000,
    );
    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        date: {
          gte: earliestRelevantAppointment,
          lt: endOfDay,
        },
        status: {
          in: RESERVED_APPOINTMENT_STATUSES,
        },
      },
    });

    const timeBlocks = await this.scheduleConflicts.findTimeBlocks(
      this.prisma,
      professionalId,
      startOfDay,
      endOfDay,
    );

    const now = new Date();
    const slots = new Set<string>();

    for (const block of availability) {
      const candidates =
        block.scheduleMode === ScheduleMode.SPECIFIC
          ? this.getSpecificSlots(block.specificSlots)
          : this.buildContinuousSlots(block, duration);

      for (const minute of candidates) {
        const slotDate = this.zonedDateTimeToUtc(dateKey, minute);

        if (slotDate <= now) continue;

        const slotEnd = new Date(slotDate.getTime() + duration * 60000);
        const isManuallyBlocked = timeBlocks.some((timeBlock) =>
          this.scheduleConflicts.rangesOverlap(
            slotDate,
            slotEnd,
            timeBlock.startAt,
            timeBlock.endAt,
          ),
        );

        if (isManuallyBlocked) continue;

        const isBooked = appointments.some((appt) => {
          const existingDuration =
            this.scheduleConflicts.resolveAppointmentDuration(
              appt.serviceDurationMinutesSnapshot,
              duration,
            );
          const appointmentEnd = new Date(
            appt.date.getTime() + existingDuration * 60000,
          );

          return this.rangesOverlap(
            slotDate,
            slotEnd,
            appt.date,
            appointmentEnd,
          );
        });

        if (!isBooked) {
          slots.add(this.minuteToTime(minute));
        }
      }
    }

    return [...slots].sort();
  }

  private async resolveCustomerBookingSelection(
    client: AppointmentDatabaseClient,
    professionalId: string,
    serviceId?: string,
  ) {
    const professional = await client.professional.findUnique({
      where: { userId: professionalId },
      select: {
        id: true,
        serviceMode: true,
        price: true,
        duration: true,
        user: { select: { sessionDuration: true } },
      },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    const legacyDuration =
      professional.duration ?? professional.user.sessionDuration ?? 60;
    const serviceMode =
      professional.serviceMode ?? ProfessionalServiceMode.SINGLE_PRICE;

    if (serviceMode === ProfessionalServiceMode.SINGLE_PRICE) {
      if (serviceId) {
        throw new BadRequestException(
          'Este profesional utiliza modalidad de precio único.',
        );
      }

      return {
        serviceId: null,
        name: null,
        priceType: null,
        snapshotPriceAmount: null,
        currency: null,
        snapshotDurationMinutes: null,
        priceAmount: professional.price ?? 0,
        durationMinutes: legacyDuration,
      };
    }

    if (!serviceId) {
      throw new BadRequestException(
        'Debes seleccionar un servicio para reservar con este profesional.',
      );
    }

    const service = await client.professionalService.findFirst({
      where: {
        id: serviceId,
        professionalId: professional.id,
        status: ProfessionalServiceStatus.ACTIVE,
        showInProfile: true,
        allowBooking: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        priceType: true,
        priceAmount: true,
        currency: true,
        durationMinutes: true,
      },
    });

    if (!service) {
      throw new BadRequestException(
        'El servicio seleccionado no está disponible para reservar.',
      );
    }

    return {
      serviceId: service.id,
      name: service.name,
      priceType: service.priceType,
      snapshotPriceAmount: service.priceAmount,
      currency: service.currency,
      snapshotDurationMinutes: service.durationMinutes,
      priceAmount: service.priceAmount ?? 0,
      durationMinutes: service.durationMinutes,
    };
  }

  private async resolveProfessionalManualSelection(
    client: AppointmentDatabaseClient,
    professionalId: string,
    serviceId?: string,
  ) {
    const professional = await client.professional.findUnique({
      where: { userId: professionalId },
      select: {
        id: true,
        serviceMode: true,
        price: true,
        duration: true,
        user: { select: { sessionDuration: true } },
      },
    });

    if (!professional) {
      throw new NotFoundException('Perfil profesional no encontrado.');
    }

    const legacyDuration =
      professional.duration ?? professional.user.sessionDuration ?? 60;
    if (
      (professional.serviceMode ?? ProfessionalServiceMode.SINGLE_PRICE) ===
      ProfessionalServiceMode.SINGLE_PRICE
    ) {
      if (serviceId) {
        throw new BadRequestException(
          'Tu perfil utiliza modalidad de precio único.',
        );
      }
      return {
        serviceId: null,
        name: null,
        priceType: null,
        snapshotPriceAmount: null,
        currency: null,
        snapshotDurationMinutes: null,
        durationMinutes: legacyDuration,
      };
    }

    if (!serviceId) {
      throw new BadRequestException(
        'Debes seleccionar un servicio para crear la cita.',
      );
    }

    const service = await client.professionalService.findFirst({
      where: {
        id: serviceId,
        professionalId: professional.id,
        status: ProfessionalServiceStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        priceType: true,
        priceAmount: true,
        currency: true,
        durationMinutes: true,
      },
    });

    if (!service) {
      throw new BadRequestException(
        'El servicio seleccionado no está disponible.',
      );
    }

    return {
      serviceId: service.id,
      name: service.name,
      priceType: service.priceType,
      snapshotPriceAmount: service.priceAmount,
      currency: service.currency,
      snapshotDurationMinutes: service.durationMinutes,
      durationMinutes: service.durationMinutes,
    };
  }

  private async isDateAvailableForProfessional(
    professionalId: string,
    date: Date,
    duration: number,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const minute = this.getMinutesInBookingTimezone(date);
    const availability = await client.availability.findMany({
      where: {
        professionalId,
        day: this.getWeekDayInBookingTimezone(date),
      },
    });

    return availability.some((block) =>
      this.isMinuteAllowedByAvailability(block, minute, duration),
    );
  }

  private isMinuteAllowedByAvailability(
    block: AvailabilityConfig,
    minute: number,
    duration: number,
  ) {
    if (block.scheduleMode === ScheduleMode.SPECIFIC) {
      return this.getSpecificSlots(block.specificSlots).includes(minute);
    }

    if (minute < block.startMinute || minute + duration > block.endMinute) {
      return false;
    }

    return !this.getBlockedRanges(block.blockedRanges).some((range) =>
      this.minuteRangesOverlap(
        minute,
        minute + duration,
        range.startMinute,
        range.endMinute,
      ),
    );
  }

  private buildContinuousSlots(block: AvailabilityConfig, duration: number) {
    const step = duration + (block.breakMinute ?? 0);
    const ranges = this.getBlockedRanges(block.blockedRanges);
    const slots: number[] = [];

    for (
      let minute = block.startMinute;
      minute + duration <= block.endMinute;
      minute += step
    ) {
      const blocked = ranges.some((range) =>
        this.minuteRangesOverlap(
          minute,
          minute + duration,
          range.startMinute,
          range.endMinute,
        ),
      );

      if (!blocked) slots.push(minute);
    }

    return slots;
  }

  private assertDateWithinBookingWindow(date: Date) {
    if (isNaN(date.getTime())) {
      throw new ForbiddenException('Fecha invalida');
    }

    const selectedDay = new Date(date);
    selectedDay.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxDate = new Date(today);
    maxDate.setMonth(maxDate.getMonth() + 6);
    maxDate.setHours(23, 59, 59, 999);

    if (selectedDay < today || date > maxDate) {
      throw new ForbiddenException(
        'Solo puedes agendar dentro de los próximos 6 meses',
      );
    }
  }

  private getSpecificSlots(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
      .filter((minute): minute is number => Number.isInteger(minute))
      .filter((minute) => minute >= 0 && minute < 1440)
      .sort((a, b) => a - b);
  }

  private getBlockedRanges(value: unknown): TimeRange[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter((range): range is TimeRange => {
        if (!range || typeof range !== 'object') return false;

        const candidate = range as TimeRange;

        return (
          Number.isInteger(candidate.startMinute) &&
          Number.isInteger(candidate.endMinute) &&
          candidate.startMinute >= 0 &&
          candidate.endMinute <= 1440 &&
          candidate.startMinute < candidate.endMinute
        );
      })
      .sort((a, b) => a.startMinute - b.startMinute);
  }

  private getWeekDay(date: Date) {
    const dayMap = [
      WeekDay.SUN,
      WeekDay.MON,
      WeekDay.TUE,
      WeekDay.WED,
      WeekDay.THU,
      WeekDay.FRI,
      WeekDay.SAT,
    ];

    return dayMap[date.getDay()] as WeekDay;
  }

  private getWeekDayInBookingTimezone(date: Date) {
    const dayMap: Record<string, WeekDay> = {
      Sun: WeekDay.SUN,
      Mon: WeekDay.MON,
      Tue: WeekDay.TUE,
      Wed: WeekDay.WED,
      Thu: WeekDay.THU,
      Fri: WeekDay.FRI,
      Sat: WeekDay.SAT,
    };
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: BOOKING_TIMEZONE,
      weekday: 'short',
    }).format(date);

    return dayMap[weekday] ?? this.getWeekDay(date);
  }

  private getMinutesInBookingTimezone(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BOOKING_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);

    return hour * 60 + minute;
  }

  private getTimeZoneOffsetMs(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    );

    return asUtc - date.getTime();
  }

  private zonedDateTimeToUtc(dateKey: string, minuteOfDay: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const firstOffset = this.getTimeZoneOffsetMs(
      new Date(utcGuess),
      BOOKING_TIMEZONE,
    );
    let utcTime = utcGuess - firstOffset;
    const secondOffset = this.getTimeZoneOffsetMs(
      new Date(utcTime),
      BOOKING_TIMEZONE,
    );

    if (secondOffset !== firstOffset) {
      utcTime = utcGuess - secondOffset;
    }

    return new Date(utcTime);
  }

  private normalizeBookingDateKey(input: string | Date) {
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input)) {
      return input.slice(0, 10);
    }

    const date = input instanceof Date ? input : new Date(input);

    if (isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: BOOKING_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '';

    return `${value('year')}-${value('month')}-${value('day')}`;
  }

  private addDaysToDateKey(dateKey: string, days: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0, 0));

    return date.toISOString().slice(0, 10);
  }

  private minuteToTime(minute: number) {
    const hour = Math.floor(minute / 60)
      .toString()
      .padStart(2, '0');
    const min = (minute % 60).toString().padStart(2, '0');

    return `${hour}:${min}`;
  }

  private minuteRangesOverlap(
    startA: number,
    endA: number,
    startB: number,
    endB: number,
  ) {
    return startA < endB && endA > startB;
  }

  private rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA < endB && endA > startB;
  }

  async rescheduleAppointment(
    id: string,
    userId: string,
    body: {
      date: string;
    },
  ) {
    const newDate = new Date(body.date);
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // 🔐 VALIDAR DUEÑO
    if (
      appointment.customerId !== userId &&
      appointment.professionalId !== userId
    ) {
      throw new ForbiddenException('No puedes modificar esta cita');
    }

    // 🚫 NO PERMITIR REAGENDAR ESTOS ESTADOS
    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.REFUNDED
    ) {
      throw new ForbiddenException('No se puede reagendar esta cita');
    }

    const now = new Date();

    if (newDate <= now) {
      throw new ForbiddenException('No puedes reagendar al pasado');
    }

    // 🔎 PROFESIONAL
    const professional = await this.prisma.professional.findUnique({
      where: { userId: appointment.professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    const duration = this.scheduleConflicts.resolveAppointmentDuration(
      appointment.serviceDurationMinutesSnapshot,
      professional.duration ?? professional.user.sessionDuration ?? 60,
    );

    const startDate = newDate;
    const endDate = new Date(newDate.getTime() + duration * 60000);
    this.assertDateWithinBookingWindow(newDate);

    // 🔎 DISPONIBILIDAD
    const dayMap = [
      WeekDay.SUN,
      WeekDay.MON,
      WeekDay.TUE,
      WeekDay.WED,
      WeekDay.THU,
      WeekDay.FRI,
      WeekDay.SAT,
    ];

    const appointmentDay = this.getWeekDayInBookingTimezone(newDate);
    const minutesFromMidnight = this.getMinutesInBookingTimezone(newDate);

    const availability = await this.prisma.availability.findFirst({
      where: {
        professionalId: appointment.professionalId,
        day: appointmentDay,
      },
    });

    if (!availability) {
      throw new ForbiddenException('Profesional no disponible');
    }

    const matchesScheduleConfig = await this.isDateAvailableForProfessional(
      appointment.professionalId,
      newDate,
      duration,
    );

    if (!matchesScheduleConfig) {
      throw new ForbiddenException('Profesional no disponible');
    }

    const updated = await this.scheduleConflicts.runExclusive(
      appointment.professionalId,
      async (tx) => {
        const stillMatchesSchedule = await this.isDateAvailableForProfessional(
          appointment.professionalId,
          newDate,
          duration,
          tx,
        );

        if (!stillMatchesSchedule) {
          throw new ForbiddenException('Profesional no disponible');
        }

        await this.scheduleConflicts.assertRangeAvailable(
          tx,
          {
            professionalId: appointment.professionalId,
            startAt: startDate,
            endAt: endDate,
            excludeAppointmentId: id,
          },
          duration,
        );

        // Se conserva íntegramente la regla comercial de penalización existente.
        const alreadyPenalized =
          (appointment.penalty ?? 0) > 0 &&
          appointment.status === AppointmentStatus.PENDING_PAYMENT;
        const isConfirmedReschedule =
          appointment.status === AppointmentStatus.CONFIRMED ||
          appointment.status === AppointmentStatus.RESCHEDULED;
        const isProfessionalActor = appointment.professionalId === userId;
        const oldDate = new Date(appointment.date);
        const diffHours =
          (oldDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (
          !isProfessionalActor &&
          isConfirmedReschedule &&
          !alreadyPenalized &&
          diffHours < 48
        ) {
          const price = professional.price || 0;
          const penalty = price * 0.5;

          return tx.appointment.update({
            where: { id },
            data: {
              date: newDate,
              status: AppointmentStatus.PENDING_PAYMENT,
              penalty,
            },
          });
        }

        const nextStatus = isConfirmedReschedule
          ? AppointmentStatus.RESCHEDULED
          : appointment.status;

        return tx.appointment.update({
          where: { id },
          data: {
            date: newDate,
            status: nextStatus,
            penalty: isConfirmedReschedule ? 0 : appointment.penalty ?? 0,
          },
        });
      },
    );

    await this.sendAppointmentNotificationById(
      updated.id,
      'APPOINTMENT_RESCHEDULE',
    );
    await this.syncExternalMeetingRescheduleIfNeeded(updated.id);

    return updated;
  }
  async markAsPaid(id: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.customerId !== userId) {
      throw new ForbiddenException('No puedes pagar esta cita');
    }

    // ✅ primero actualiza estado
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.PAYMENT_REVIEW,
        paidAt: new Date(), // 🔥 clave para las 48h
      },
    });

    // 🔥 luego intenta enviar correo (sin romper todo si falla)
    try {
      await this.sendPaymentEmail(
        appointment.professional.email,
        appointment.id,
      );
    } catch {
      console.error('Error enviando correo de pago.');
    }

    return updatedAppointment;
  }

  async continueVideoCall(id: string, userId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
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
      throw new NotFoundException('Cita no encontrada');
    }

    const isParticipant =
      appointment.customerId === userId || appointment.professionalId === userId;

    if (!isParticipant) {
      throw new ForbiddenException('No puedes modificar esta cita');
    }

    if (appointment.attentionMode !== AttentionModality.ONLINE) {
      throw new BadRequestException('Esta cita no es online');
    }

    if (
      appointment.status !== AppointmentStatus.CONFIRMED &&
      appointment.status !== AppointmentStatus.RESCHEDULED
    ) {
      throw new BadRequestException(
        'Solo se puede generar un nuevo enlace para citas confirmadas',
      );
    }

    const continuationRoomId = `${appointment.id}-continuacion-${Date.now()}`;
    const meetLink = this.buildVideoConferenceLink(continuationRoomId, {
      videoProvider: VideoProvider.CONNECTA_AUTO,
      customVideoUrl: null,
    });

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { meetLink },
    });

    await this.sendAppointmentNotificationById(
      updated.id,
      'APPOINTMENT_CONTINUATION_LINK',
      ['EMAIL'],
    );

    return {
      meetLink,
      message:
        'Nuevo enlace generado y enviado por correo al paciente y al profesional',
    };
  }

  async releaseExpiredPayments() {
    const expired = await this.prisma.appointment.findMany({
      where: {
        status: AppointmentStatus.PAYMENT_REVIEW,
        paidAt: {
          not: null,
        },
      },
    });

    for (const appt of expired) {
      if (!appt.paidAt) continue;

      const paidDate =
        appt.paidAt instanceof Date ? appt.paidAt : new Date(appt.paidAt);

      const diffHours = (Date.now() - paidDate.getTime()) / (1000 * 60 * 60);

      if (diffHours >= 48) {
        await this.prisma.appointment.update({
          where: { id: appt.id },
          data: {
            status: AppointmentStatus.PENDING,
            paidAt: null,
          },
        });
      }
    }
  }
  async confirmPayment(id: string, professionalId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
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
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.professionalId !== professionalId) {
      throw new ForbiddenException('No puedes confirmar este pago');
    }

    let updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
      },
    });

    if (appointment.attentionMode === AttentionModality.ONLINE) {
      updated = await this.meetingService.generateMeetingForAppointment(
        updated.id,
      );
    }

    const meetLink = updated.meetingUrl || updated.meetLink;
    // 🔥 CALCULAR ENVÍO 10 MIN ANTES
    if (meetLink && appointment.customer) {
      this.scheduleVideoConferenceEmails(
        appointment.customer.email,
        appointment.professional.email,
        appointment.date,
        meetLink,
      );
    }

    await this.sendAppointmentNotificationById(
      updated.id,
      'APPOINTMENT_CONFIRMATION',
    );

    return updated;
  }
  async sendPaymentEmail(to: string, appointmentId: string) {
    const transporter = this.createMailTransporter();
    const actionToken = this.createAppointmentActionToken(
      appointmentId,
      'CONFIRM_PAYMENT',
    );

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        paymentConfirmTokenHash: actionToken.tokenHash,
        paymentConfirmTokenExpiresAt: actionToken.expiresAt,
        paymentConfirmTokenUsedAt: null,
      },
    });

    const confirmLink = `${this.getPublicApiUrl()}/appointments/${appointmentId}/confirm-payment-link/${actionToken.token}`;

    await transporter.sendMail({
      from: this.getMailFrom(),
      to,
      subject: 'Pago recibido - Confirmar cita',
      html: buildConectaEmail({
        title: 'Pago recibido',
        preview: 'Un cliente indicó que ya realizó el pago.',
        body: `
          <p>Un cliente indicó que ya realizó el pago.</p>
          <p>Confirma el pago para continuar con la gestión de la cita.</p>
        `,
        action: {
          label: 'Confirmar pago',
          url: confirmLink,
          variant: 'success',
        },
      }),
    });
  }
  async sendMeetEmail(to: string, meetLink: string) {
    const transporter = this.createMailTransporter();

    await transporter.sendMail({
      from: this.getMailFrom(),
      to,
      subject: 'Tu videollamada está lista',
      html: buildConectaEmail({
        title: 'Tu videollamada está lista',
        preview: 'Tu sesión comenzara pronto.',
        body: `
          <p>Tu sesión comenzara en 10 minutos.</p>
          <p>Ingresa desde el boton cuando sea la hora de tu cita.</p>
        `,
        action: {
          label: 'Unirse a la videollamada',
          url: meetLink,
        },
      }),
    });
  }
  async confirmPaymentFromLink(id: string, token: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        professional: {
          include: {
            professional: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.status === AppointmentStatus.CONFIRMED) {
      return appointment;
    }

    this.validateAppointmentActionToken(
      token,
      appointment.id,
      'CONFIRM_PAYMENT',
      appointment.paymentConfirmTokenHash,
      appointment.paymentConfirmTokenExpiresAt,
    );

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
        paymentConfirmTokenHash: null,
        paymentConfirmTokenExpiresAt: null,
        paymentConfirmTokenUsedAt: new Date(),
      },
    });

    if (appointment.attentionMode === AttentionModality.ONLINE) {
      const meetingAppointment =
        await this.meetingService.generateMeetingForAppointment(updated.id);

      await this.issueAutomaticTaxDocumentAfterPayment(meetingAppointment.id);

      await this.sendAppointmentNotificationById(
        meetingAppointment.id,
        'APPOINTMENT_CONFIRMATION',
      );

      return meetingAppointment;
    }

    await this.issueAutomaticTaxDocumentAfterPayment(updated.id);

    await this.sendAppointmentNotificationById(
      updated.id,
      'APPOINTMENT_CONFIRMATION',
    );

    return updated;
  }
  async resolvePenalty(
    id: string,
    userId: string,
    body: {
      option: 'CREDIT' | 'REFUND';
      bank?: string;
      account?: string;
      accountType?: string;
    },
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
        professional: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.customerId !== userId) {
      throw new ForbiddenException('No autorizado');
    }

    const professional = await this.prisma.professional.findUnique({
      where: { userId: appointment.professionalId },
    });

    const price = professional?.price || 0;
    const penalty = appointment.penalty || 0;

    let refundAmount = 0;

    // 🔥 MENOS DE 48H
    if (penalty > 0) {
      refundAmount = price * 0.5;
    } else {
      // 🔥 MÁS DE 48H
      refundAmount = price;
    }

    // 👉 OPCIÓN CRÉDITO
    if (body.option === 'CREDIT') {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          credit: {
            increment: refundAmount,
          },
        },
      });
    }

    // 👉 OPCIÓN REEMBOLSO
    if (body.option === 'REFUND') {
      // 🔥 VALIDAR DATOS
      if (!body.bank || !body.account || !body.accountType) {
        throw new ForbiddenException('Faltan datos bancarios');
      }
      // 🔥 ENVIAR CORREO AL PROFESIONAL
      if (!appointment.customer) {
        throw new ForbiddenException('Esta cita no tiene pagos asociados.');
      }
      await this.sendRefundRequestEmail(
        appointment.professional.email,
        body.bank,
        body.account,
        body.accountType,
        refundAmount,
        appointment.id,
        appointment.customer.email,
        appointment.customer.name || appointment.customer.email,
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        penaltyResolved: true,
        penaltyOption: body.option,
        refundAccount: body.account || null,
        refundBank: body.bank || null,
      },
    });
  }
  async sendRefundRequestEmail(
    to: string,
    bank: string,
    account: string,
    accountType: string,
    amount: number,
    appointmentId: string,
    customerEmail: string,
    customerName: string,
  ) {
    const transporter = this.createMailTransporter();
    const actionToken = this.createAppointmentActionToken(
      appointmentId,
      'REFUND_DONE',
      60 * 24 * 14,
    );

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        refundDoneTokenHash: actionToken.tokenHash,
        refundDoneTokenExpiresAt: actionToken.expiresAt,
        refundDoneTokenUsedAt: null,
      },
    });

    const confirmLink = `${this.getPublicApiUrl()}/appointments/${appointmentId}/refund-done/${actionToken.token}`;

    await transporter.sendMail({
      from: this.getMailFrom(),
      to,
      subject: 'Solicitud de reembolso',
      html: buildConectaEmail({
        title: 'Solicitud de reembolso',
        preview: 'Un cliente solicito un reembolso.',
        body: `
          <p>Un cliente solicito un reembolso.</p>
          ${conectaInfoCard(`
            ${emailRow('Nombre', customerName)}
            ${emailRow('Correo', customerEmail)}
            ${emailRow('Banco', bank)}
            ${emailRow('Tipo de cuenta', accountType)}
            ${emailRow('Número de cuenta', account)}
            ${emailRow('Monto', `$${amount}`)}
          `)}
        `,
        action: {
          label: 'Reembolso realizado',
          url: confirmLink,
          variant: 'success',
        },
      }),
    });
  }
  async refundDone(id: string, token: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.status === AppointmentStatus.REFUNDED) {
      return appointment;
    }

    this.validateAppointmentActionToken(
      token,
      appointment.id,
      'REFUND_DONE',
      appointment.refundDoneTokenHash,
      appointment.refundDoneTokenExpiresAt,
    );

    // 📧 enviar correo
    if (!appointment.customer) {
      throw new ForbiddenException('Esta cita no tiene pagos asociados.');
    }
    await this.sendRefundConfirmedEmail(
      appointment.customer.email,
      appointment.customer.name || appointment.customer.email,
    );
    // 🔥 CAMBIAR ESTADO
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.REFUNDED,
        refundDoneTokenHash: null,
        refundDoneTokenExpiresAt: null,
        refundDoneTokenUsedAt: new Date(),
      },
    });
  }
  async sendRefundConfirmedEmail(to: string, name: string) {
    const transporter = this.createMailTransporter();

    await transporter.sendMail({
      from: this.getMailFrom(),
      to,
      subject: 'Reembolso realizado',
      html: buildConectaEmail({
        title: 'Reembolso confirmado',
        preview: 'El profesional ya realizó tu reembolso.',
        body: `
          <p>Hola ${escapeEmailHtml(name)},</p>
          <p>El profesional ya realizó tu reembolso.</p>
          <p>El dinero deberia verse reflejado en tu cuenta segun los tiempos de tu banco.</p>
          <p>Gracias por usar Conecta.</p>
        `,
      }),
    });
  }
  private scheduleVideoConferenceEmails(
    customerEmail: string,
    professionalEmail: string,
    appointmentDate: Date,
    meetLink: string,
  ): void {
    const sendTime = new Date(appointmentDate.getTime() - 10 * 60 * 1000);
    const delay = sendTime.getTime() - Date.now();

    const sendEmails = () => {
      this.sendMeetEmail(customerEmail, meetLink)
        .then(() => this.sendMeetEmail(professionalEmail, meetLink))
        .catch(() =>
          console.error('Error enviando correos de videollamada.'),
        );
    };

    if (delay > 0) {
      setTimeout(sendEmails, delay);
      return;
    }

    sendEmails();
  }

  @Cron('*/15 * * * *')
  async sendSameDayAppointmentReminders() {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: [AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED],
        },
        OR: [
          { sameDayEmailSentAt: null },
          { sameDayPushSentAt: null },
        ],
      },
      select: {
        id: true,
        sameDayEmailSentAt: true,
        sameDayPushSentAt: true,
      },
      take: 50,
    });

    for (const appointment of appointments) {
      const channels: NotificationChannel[] = [];

      if (!appointment.sameDayEmailSentAt) channels.push('EMAIL');
      if (!appointment.sameDayPushSentAt) channels.push('PUSH');
      if (channels.length === 0) continue;

      await this.sendAppointmentNotificationById(
        appointment.id,
        'APPOINTMENT_REMINDER_SAME_DAY',
        channels,
      );

      const sentAt = new Date();
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          ...(channels.includes('EMAIL') && { sameDayEmailSentAt: sentAt }),
          ...(channels.includes('PUSH') && { sameDayPushSentAt: sentAt }),
        },
      });
    }
  }

  @Cron('*/5 * * * *')
  async sendAppointmentTimeReminders() {
    await this.sendReminderWindow({
      type: 'APPOINTMENT_REMINDER_24H',
      sentField: 'reminder24hSentAt',
      fromMs: 23.75 * 60 * 60 * 1000,
      toMs: 24 * 60 * 60 * 1000,
    });

    await this.sendReminderWindow({
      type: 'APPOINTMENT_REMINDER_1H',
      sentField: 'reminder1hSentAt',
      fromMs: 55 * 60 * 1000,
      toMs: 60 * 60 * 1000,
    });

    await this.sendReminderWindow({
      type: 'APPOINTMENT_REMINDER_15M',
      sentField: 'reminder15mSentAt',
      fromMs: 10 * 60 * 1000,
      toMs: 15 * 60 * 1000,
    });
  }

  private async sendReminderWindow(options: {
    type: NotificationType;
    sentField: 'reminder24hSentAt' | 'reminder1hSentAt' | 'reminder15mSentAt';
    fromMs: number;
    toMs: number;
  }) {
    const now = new Date();
    const fromDate = new Date(now.getTime() + options.fromMs);
    const toDate = new Date(now.getTime() + options.toMs);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: fromDate,
          lte: toDate,
        },
        status: {
          in: [AppointmentStatus.CONFIRMED, AppointmentStatus.RESCHEDULED],
        },
        [options.sentField]: null,
      },
      select: {
        id: true,
      },
      take: 50,
    });

    for (const appointment of appointments) {
      await this.sendAppointmentNotificationById(appointment.id, options.type, [
        'EMAIL',
      ]);

      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          [options.sentField]: new Date(),
        },
      });
    }
  }

  private async syncExternalMeetingRescheduleIfNeeded(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: true,
        professional: {
          include: {
            professional: true,
          },
        },
      },
    });

    if (!appointment || !appointment.customer) {
      return;
    }
    const appointmentWithCustomer = {
      ...appointment,
      customer: appointment.customer,
    };

    if (
      appointment.meetingProvider === VideoProvider.GOOGLE_MEET &&
      appointment.calendarEventId
    ) {
      await this.googleCalendarService
        .updateCalendarEventForAppointment(appointmentWithCustomer)
        .catch(() => undefined);
    }

    if (appointment.meetingProvider === VideoProvider.ZOOM && appointment.meetingId) {
      await this.zoomService
        .updateMeetingForAppointment(appointmentWithCustomer)
        .catch(() => undefined);
    }

    if (
      appointment.meetingProvider === VideoProvider.MICROSOFT_TEAMS &&
      appointment.calendarEventId
    ) {
      await this.microsoftTeamsService
        .updateTeamsEventForAppointment(appointmentWithCustomer)
        .catch(() => undefined);
    }
  }

  private async deleteExternalMeetingIfNeeded(appointment: {
    id: string;
    professionalId: string;
    meetingProvider?: VideoProvider | null;
    calendarEventId: string | null;
    meetingId: string | null;
  }) {
    if (
      appointment.meetingProvider === VideoProvider.GOOGLE_MEET &&
      appointment.calendarEventId
    ) {
      await this.googleCalendarService
        .deleteCalendarEventForAppointment(appointment)
        .catch(() => undefined);
    }

    if (appointment.meetingProvider === VideoProvider.ZOOM && appointment.meetingId) {
      await this.zoomService
        .deleteMeetingForAppointment(appointment)
        .catch(() => undefined);
    }

    if (
      appointment.meetingProvider === VideoProvider.MICROSOFT_TEAMS &&
      appointment.calendarEventId
    ) {
      await this.microsoftTeamsService
        .deleteTeamsEventForAppointment(appointment)
        .catch(() => undefined);
    }
  }

  private async sendAppointmentNotificationById(
    appointmentId: string,
    type: NotificationType,
    channels: NotificationChannel[] = ['EMAIL'],
  ): Promise<void> {
    try {
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          customer: true,
          professional: {
            include: {
              professional: true,
            },
          },
        },
      });

      if (!appointment) return;

      const timezone =
        appointment.customer?.timezone ||
        appointment.professional.timezone ||
        'America/Santiago';
      const date = new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeZone: timezone,
      }).format(appointment.date);
      const time = new Intl.DateTimeFormat('es-CL', {
        timeStyle: 'short',
        timeZone: timezone,
      }).format(appointment.date);
      const fullAddress = [
        appointment.appointmentAddress,
        appointment.appointmentCity,
        appointment.appointmentRegion,
        appointment.appointmentCountry,
      ]
        .filter(Boolean)
        .join(', ');
      const professionalName =
        appointment.professional.professional?.name ||
        appointment.professional.name ||
        'Profesional Conecta';
      const customerName =
        appointment.customer?.name || appointment.customer?.email || appointment.guestCustomerName || 'Paciente';
      const meetingUrl = appointment.meetingUrl || appointment.meetLink || null;
      const modality =
        appointment.attentionMode === AttentionModality.ONLINE
          ? 'Online'
          : appointment.attentionMode === AttentionModality.PRESENTIAL
            ? 'Presencial'
            : 'Online o presencial';

      const data = {
        appointmentDate: date,
        appointmentTime: time,
        timezone,
        professionalName,
        customerName,
        modality,
        meetingUrl:
          appointment.attentionMode === AttentionModality.ONLINE
            ? meetingUrl
            : null,
        fullAddress:
          appointment.attentionMode === AttentionModality.PRESENTIAL
            ? fullAddress
            : null,
        arrivalInstructions:
          appointment.attentionMode === AttentionModality.PRESENTIAL
            ? appointment.arrivalInstructions
            : null,
      };

      const notifications: Promise<unknown>[] = [];
      if (appointment.customer) {
        notifications.push(this.notificationService.notify({
          type,
          recipient: {
            userId: appointment.customer.id,
            email: appointment.customer.email,
            name: appointment.customer.name || 'Usuario',
          },
          channels,
          data: {
            ...data,
            name: appointment.customer.name || 'Usuario',
          },
        }));
      }
      notifications.push(this.notificationService.notify({
          type,
          recipient: {
            userId: appointment.professional.id,
            email: appointment.professional.email,
            name: professionalName,
          },
          channels,
          data: {
            ...data,
            name: professionalName,
          },
        }));
      await Promise.allSettled(notifications);
    } catch {
      // Las notificaciones no deben bloquear el flujo de citas.
    }
  }

  private async issueAutomaticTaxDocumentAfterPayment(
    appointmentId: string,
  ): Promise<void> {
    try {
      await this.taxDocumentJobsService.enqueueAutomaticIssue(appointmentId);
    } catch {
      console.error('[TaxDocuments] Automatic issue job enqueue failed.');
    }
  }

  private resolveAttentionMode(
    requestedMode: AttentionModality | undefined,
    professionalMode: AttentionModality,
  ): AttentionModality {
    if (professionalMode === AttentionModality.ONLINE) {
      if (requestedMode && requestedMode !== AttentionModality.ONLINE) {
        throw new BadRequestException('Este profesional solo atiende online');
      }

      return AttentionModality.ONLINE;
    }

    if (professionalMode === AttentionModality.PRESENTIAL) {
      if (requestedMode && requestedMode !== AttentionModality.PRESENTIAL) {
        throw new BadRequestException(
          'Este profesional solo atiende presencial',
        );
      }

      return AttentionModality.PRESENTIAL;
    }

    if (!requestedMode || requestedMode === AttentionModality.BOTH) {
      throw new BadRequestException(
        'Selecciona si quieres atención online o presencial',
      );
    }

    return requestedMode;
  }

  private hasPresentialData(professional: {
    officeAddress?: string | null;
    officeCity?: string | null;
    officeCountry?: string | null;
  }): boolean {
    return !!(
      professional.officeAddress &&
      professional.officeCity &&
      professional.officeCountry
    );
  }

  private buildVideoConferenceLink(
    appointmentId: string,
    professional?: {
      videoProvider?: VideoProvider | null;
      customVideoUrl?: string | null;
    } | null,
  ): string {
    if (
      professional?.customVideoUrl &&
      professional.videoProvider === VideoProvider.CUSTOM
    ) {
      return professional.customVideoUrl;
    }

    const baseUrl =
      process.env.VIDEO_CONFERENCE_BASE_URL || 'https://meet.jit.si';
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
    const roomName = `conecta-${appointmentId}`;

    return `${normalizedBaseUrl}/${roomName}`;
  }

  private getPublicApiUrl(): string {
    return (process.env.PUBLIC_API_URL || 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
  }

  private ensureCustomerTaxDataReady(data?: {
    name?: string;
    taxId?: string;
    address?: string;
    phone?: string;
    comment?: string;
  }): void {
    const taxIdPattern = /^[a-zA-Z0-9.\-\s]{6,20}$/;
    const phonePattern = /^[+0-9\s().-]{6,30}$/;
    const name = data?.name?.trim();
    const taxId = data?.taxId?.trim();
    const address = data?.address?.trim();
    const phone = data?.phone?.trim();
    const comment = data?.comment?.trim();

    const missing = [
      !name ? 'nombre o razon social' : null,
      !taxId ? 'RUT / NIF / documento tributario' : null,
      !address ? 'dirección' : null,
      !phone ? 'teléfono' : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new BadRequestException(
        `Faltan datos para documento tributario: ${missing.join(', ')}`,
      );
    }

    if (!name || name.length < 3 || name.length > 120) {
      throw new BadRequestException(
        'El nombre o razon social debe tener entre 3 y 120 caracteres',
      );
    }

    if (!taxId || !taxIdPattern.test(taxId)) {
      throw new BadRequestException(
        'El RUT / NIF / documento tributario debe tener entre 6 y 20 caracteres',
      );
    }

    if (!address || address.length < 5 || address.length > 160) {
      throw new BadRequestException(
        'La dirección debe tener entre 5 y 160 caracteres',
      );
    }

    if (!phone || !phonePattern.test(phone)) {
      throw new BadRequestException(
        'El teléfono debe tener entre 6 y 30 caracteres y usar un formato válido',
      );
    }

    if (comment && comment.length > 300) {
      throw new BadRequestException(
        'El comentario para la boleta o factura debe tener máximo 300 caracteres',
      );
    }
  }

  private ensureProfessionalTaxDataReady(professional: any): void {
    const professionalMissing = [
      !professional.taxId ? 'RUT profesional' : null,
      !(professional.taxEmail || professional.user?.email)
        ? 'email tributario profesional'
        : null,
    ].filter(Boolean);

    if (professionalMissing.length > 0) {
      throw new BadRequestException(
        `Faltan datos tributarios del profesional para emision automatica: ${professionalMissing.join(', ')}`,
      );
    }
  }
}



