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
  AppointmentStatus,
  DocumentMode,
  DocumentStatus,
  ScheduleMode,
  VideoProvider,
  WeekDay,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
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

type AvailabilityConfig = {
  scheduleMode: ScheduleMode;
  startMinute: number;
  endMinute: number;
  breakMinute: number;
  specificSlots: unknown;
  blockedRanges: unknown;
};

type TimeRange = {
  startMinute: number;
  endMinute: number;
};

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
  ) {}
  async create(
    customerId: string,
    professionalId: string,
    date: Date,
    options: {
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
        'Este profesional debe completar direccion, ciudad y pais antes de recibir reservas presenciales',
      );
    }

    const appointmentDurationInMinutes =
      professional.duration ?? professional.user.sessionDuration ?? 60;
    const endDate = new Date(
      date.getTime() + appointmentDurationInMinutes * 60000,
    );
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
    const cleanDate = new Date(date);
    cleanDate.setHours(0, 0, 0, 0);

    const appointmentDay = dayMap[cleanDate.getDay()] as WeekDay;

    console.log('DATE RAW:', date);
    console.log('DAY CALCULADO:', appointmentDay);

    const minutesFromMidnight = date.getHours() * 60 + date.getMinutes();

    const availability = await this.prisma.availability.findFirst({
      where: {
        professionalId,
        day: appointmentDay,
        startMinute: {
          lte: minutesFromMidnight,
        },
        endMinute: {
          gte: minutesFromMidnight + appointmentDurationInMinutes,
        },
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
    const overlappingAppointment = await this.prisma.appointment.findFirst({
      where: {
        professionalId, // ← user id
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.REFUNDED],
        },
        AND: [
          {
            date: {
              lt: endDate,
            },
          },
          {
            date: {
              gt: new Date(
                date.getTime() - appointmentDurationInMinutes * 60000,
              ),
            },
          },
        ],
      },
    });
    if (overlappingAppointment) {
      throw new ForbiddenException(
        'This time slot overlaps with another appointment',
      );
    }
    const exists = await this.prisma.appointment.findFirst({
      where: {
        professionalId, // ← user id
        date,
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.REFUNDED],
        },
      },
    });

    if (exists) {
      throw new ForbiddenException('Horario ya reservado');
    }

    let finalPrice = professional.price || 0;

    // 🔥 BUSCAR CRÉDITO DISPONIBLE
    const creditAppointment = await this.prisma.appointment.findFirst({
      where: {
        customerId,
        penaltyResolved: true,
        penaltyOption: 'CREDIT',
      },
    });

    if (creditAppointment) {
      const discount = creditAppointment.penalty || 0;

      finalPrice = finalPrice - discount;

      // 🔥 marcar crédito como usado
      await this.prisma.appointment.update({
        where: { id: creditAppointment.id },
        data: {
          penaltyResolved: false,
          penaltyOption: null,
        },
      });
    }

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
    const appointment = await this.prisma.appointment.create({
      data: {
        date,
        customerId,
        professionalId,
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
          professionalTaxAddress: professional.taxAddress,
          professionalTaxCountry:
            professional.taxCountry || professional.user.country,
          professionalTaxCity: professional.taxCity,
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

    if (meetLink) {
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

    const duration =
      appointment.professional.professional?.duration ??
      appointment.professional.sessionDuration ??
      60;
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

    const now = new Date();
    const appointmentDate = new Date(appointment.date);

    const diffHours =
      (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const professional = await this.prisma.professional.findUnique({
      where: { userId: appointment.professionalId },
    });

    const price = professional?.price || 0;

    // 🔥 SI YA PAGÓ
    if (
      appointment.status === AppointmentStatus.PAYMENT_REVIEW ||
      appointment.status === AppointmentStatus.CONFIRMED
    ) {
      const penalty = diffHours < 48 ? price * 0.5 : 0;

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
          penalty: price * 0.5,
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
  async getAvailableSlots(professionalId: string, date: Date) {
    const professional = await this.prisma.professional.findUnique({
      where: { userId: professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Professional not found');
    }

    const duration =
      professional.duration ?? professional.user.sessionDuration ?? 60;

    const dayMap = [
      WeekDay.SUN,
      WeekDay.MON,
      WeekDay.TUE,
      WeekDay.WED,
      WeekDay.THU,
      WeekDay.FRI,
      WeekDay.SAT,
    ];

    const cleanDate = new Date(date);

    if (isNaN(cleanDate.getTime())) {
      throw new ForbiddenException('Fecha inválida');
    }

    cleanDate.setHours(0, 0, 0, 0);

    const appointmentDay = dayMap[cleanDate.getDay()] as WeekDay;

    console.log('DATE RAW:', date);
    console.log('CLEAN DATE:', cleanDate);
    console.log('DAY CALCULADO:', appointmentDay);
    console.log('PROFESSIONAL ID:', professionalId);
    console.log('DURATION:', duration);

    const availability = await this.prisma.availability.findMany({
      where: {
        professionalId,
        day: appointmentDay,
      },
    });

    console.log('AVAILABILITY:', availability);

    const startOfDay = new Date(cleanDate);
    const endOfDay = new Date(cleanDate);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        professionalId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.REFUNDED],
        },
      },
    });

    const now = new Date();
    const slots = new Set<string>();

    for (const block of availability) {
      const candidates =
        block.scheduleMode === ScheduleMode.SPECIFIC
          ? this.getSpecificSlots(block.specificSlots)
          : this.buildContinuousSlots(block, duration);

      for (const minute of candidates) {
        const slotDate = new Date(cleanDate);
        slotDate.setHours(Math.floor(minute / 60), minute % 60, 0, 0);

        if (slotDate <= now) continue;

        const slotEnd = new Date(slotDate.getTime() + duration * 60000);
        const isBooked = appointments.some((appt) => {
          const appointmentEnd = new Date(
            appt.date.getTime() + duration * 60000,
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
  private async isDateAvailableForProfessional(
    professionalId: string,
    date: Date,
    duration: number,
  ) {
    const minute = date.getHours() * 60 + date.getMinutes();
    const availability = await this.prisma.availability.findMany({
      where: {
        professionalId,
        day: this.getWeekDay(date),
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
      appointment.status === AppointmentStatus.PAYMENT_REVIEW
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

    const duration =
      professional.duration ?? professional.user.sessionDuration ?? 60;

    const startDate = newDate;
    const endDate = new Date(newDate.getTime() + duration * 60000);

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

    const appointmentDay = dayMap[newDate.getDay()] as WeekDay;
    const minutesFromMidnight = newDate.getHours() * 60 + newDate.getMinutes();

    const availability = await this.prisma.availability.findFirst({
      where: {
        professionalId: appointment.professionalId,
        day: appointmentDay,
        startMinute: { lte: minutesFromMidnight },
        endMinute: { gte: minutesFromMidnight + duration },
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

    // 🔎 EVITAR SOLAPAMIENTO
    const overlapping = await this.prisma.appointment.findFirst({
      where: {
        professionalId: appointment.professionalId,
        id: { not: id },
        status: {
          notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.REFUNDED],
        },
        AND: [
          { date: { lt: endDate } },
          {
            date: {
              gt: new Date(startDate.getTime() - duration * 60000),
            },
          },
        ],
      },
    });

    if (overlapping) {
      throw new ForbiddenException('Horario ocupado');
    }

    // ⚠️ PENALIZACIÓN
    // 🔥 SOLO aplicar penalización si NUNCA se ha reagendado antes
    const alreadyPenalized =
      (appointment.penalty ?? 0) > 0 &&
      appointment.status === AppointmentStatus.PENDING_PAYMENT;
    const oldDate = new Date(appointment.date);

    const diffHours = (oldDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (!alreadyPenalized && diffHours < 48) {
      const price = professional.price || 0;
      const penalty = price * 0.5;

      const updated = await this.prisma.appointment.update({
        where: { id },
        data: {
          date: newDate,
          status: AppointmentStatus.PENDING_PAYMENT,
          penalty,
        },
      });

      await this.sendAppointmentNotificationById(
        updated.id,
        'APPOINTMENT_RESCHEDULE',
      );
      await this.syncExternalMeetingRescheduleIfNeeded(updated.id);

      return updated;
    }

    // 🔥 CASO >48h → GRATIS
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        date: newDate,
        status: AppointmentStatus.RESCHEDULED,
        penalty: 0,
      },
    });

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
    } catch (error) {
      console.error('Error enviando correo de pago:', error);
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
    if (meetLink) {
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
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const confirmLink = `${this.getPublicApiUrl()}/appointments/${appointmentId}/confirm-payment-link`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: 'Pago recibido - Confirmar cita',
      html: `
    <h2>💳 Pago recibido</h2>
    <p>Un cliente indicó que ya realizó el pago.</p>

    <table cellspacing="0" cellpadding="0" style="margin-top:15px;">
      <tr>
        <td align="center" bgcolor="#16a34a" style="border-radius:6px;">
          <a href="${confirmLink}"
             style="
               display:inline-block;
               padding:14px 24px;
               font-family: Arial, sans-serif;
               font-size:16px;
               font-weight:bold;
               color:#ffffff;
               text-decoration:none;
             ">
             Confirmar pago
          </a>
        </td>
      </tr>
    </table>
  `,
    });
  }

  async sendMeetEmail(to: string, meetLink: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '📹 Tu videollamada está lista',
      html: `
      <h2>📅 Recordatorio de cita</h2>
      <p>Tu sesión comenzará en 10 minutos.</p>

      <a href="${meetLink}" 
         style="padding:10px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:8px;">
         Unirse a la videollamada
      </a>
    `,
    });
  }
  async confirmPaymentFromLink(id: string) {
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

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CONFIRMED,
      },
    });

    if (appointment.attentionMode === AttentionModality.ONLINE) {
      const meetingAppointment =
        await this.meetingService.generateMeetingForAppointment(updated.id);

      await this.sendAppointmentNotificationById(
        meetingAppointment.id,
        'APPOINTMENT_CONFIRMATION',
      );

      return meetingAppointment;
    }

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
      console.log('PRICE:', price);
      console.log('PENALTY:', penalty);
      console.log('REFUND AMOUNT:', refundAmount);
      // 🔥 ENVIAR CORREO AL PROFESIONAL
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
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const confirmLink = `${this.getPublicApiUrl()}/appointments/${appointmentId}/refund-done`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '💸 Solicitud de reembolso',
      html: `
  <div style="font-family:Arial,sans-serif; max-width:520px; padding:20px;">
    <h2 style="margin-bottom:16px;">💸 Solicitud de reembolso</h2>

    <p>Un cliente solicitó un reembolso.</p>

    <div style="font-size:16px; line-height:1.7; margin-top:16px;">
      <p><strong>Nombre:</strong> ${customerName}</p>
      <p><strong>Correo:</strong> ${customerEmail}</p>
      <p><strong>Banco:</strong> ${bank}</p>
      <p><strong>Tipo de cuenta:</strong> ${accountType}</p>
      <p><strong>Número de cuenta:</strong> ${account}</p>
      <p><strong>Monto:</strong> $${amount}</p>
    </div>

    <div style="margin-top:24px;">
      <a href="${confirmLink}"
         style="
           display:inline-block;
           background-color:#16a34a;
           color:#ffffff;
           padding:14px 22px;
           text-decoration:none;
           border-radius:8px;
           font-size:16px;
           font-weight:bold;
           line-height:20px;
           min-width:180px;
           text-align:center;
         ">
        Reembolso realizado
      </a>
    </div>
  </div>
`,
    });
  }
  async refundDone(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    // 📧 enviar correo
    await this.sendRefundConfirmedEmail(
      appointment.customer.email,
      appointment.customer.name || appointment.customer.email,
    );
    // 🔥 CAMBIAR ESTADO
    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.REFUNDED,
      },
    });
  }
  async sendRefundConfirmedEmail(to: string, name: string) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: '💸 Reembolso realizado',
      html: `
      <div style="font-family:Arial; padding:20px;">
        <h2>💸 Reembolso confirmado</h2>

        <p>Hola ${name},</p>

        <p>El profesional ya ha realizado tu reembolso.</p>

        <p>El dinero debería verse reflejado en tu cuenta según tu banco.</p>

        <br/>

        <p>Gracias por usar Conecta 👋</p>
      </div>
    `,
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
        .catch((error) =>
          console.error('Error enviando correos de videollamada:', error),
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

    if (!appointment) {
      return;
    }

    if (
      appointment.meetingProvider === VideoProvider.GOOGLE_MEET &&
      appointment.calendarEventId
    ) {
      await this.googleCalendarService
        .updateCalendarEventForAppointment(appointment)
        .catch(() => undefined);
    }

    if (appointment.meetingProvider === VideoProvider.ZOOM && appointment.meetingId) {
      await this.zoomService
        .updateMeetingForAppointment(appointment)
        .catch(() => undefined);
    }

    if (
      appointment.meetingProvider === VideoProvider.MICROSOFT_TEAMS &&
      appointment.calendarEventId
    ) {
      await this.microsoftTeamsService
        .updateTeamsEventForAppointment(appointment)
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
        appointment.customer.timezone ||
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
        appointment.customer.name || appointment.customer.email || 'Paciente';
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

      await Promise.allSettled([
        this.notificationService.notify({
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
        }),
        this.notificationService.notify({
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
        }),
      ]);
    } catch {
      // Las notificaciones no deben bloquear el flujo de citas.
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
        'Selecciona si quieres atencion online o presencial',
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
      !address ? 'direccion' : null,
      !phone ? 'telefono' : null,
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
        'La direccion debe tener entre 5 y 160 caracteres',
      );
    }

    if (!phone || !phonePattern.test(phone)) {
      throw new BadRequestException(
        'El telefono debe tener entre 6 y 30 caracteres y usar un formato valido',
      );
    }

    if (comment && comment.length > 300) {
      throw new BadRequestException(
        'El comentario para la boleta o factura debe tener maximo 300 caracteres',
      );
    }
  }

  private ensureProfessionalTaxDataReady(professional: any): void {
    const professionalMissing = [
      !professional.taxId ? 'RUT profesional' : null,
      !professional.taxName ? 'razon social profesional' : null,
      !(professional.taxEmail || professional.user?.email)
        ? 'email tributario profesional'
        : null,
      !professional.taxAddress ? 'direccion tributaria profesional' : null,
      !professional.taxCity ? 'ciudad/comuna profesional' : null,
    ].filter(Boolean);

    if (professionalMissing.length > 0) {
      throw new BadRequestException(
        `Faltan datos tributarios del profesional para emision automatica: ${professionalMissing.join(', ')}`,
      );
    }
  }
}

