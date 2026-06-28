import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import {
  AppointmentStatus,
  AttentionModality,
  VideoProvider,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftTeamsService } from './microsoft-teams.service';
import { ZoomService } from './zoom.service';

@Injectable()
export class MeetingService {
  constructor(
    private prisma: PrismaService,
    private googleCalendarService: GoogleCalendarService,
    private zoomService: ZoomService,
    private microsoftTeamsService: MicrosoftTeamsService,
  ) {}

  async generateMeetingForAppointment(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        professional: {
          include: {
            professional: true,
          },
        },
        customer: true,
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.attentionMode !== AttentionModality.ONLINE) {
      return appointment;
    }

    const professional = appointment.professional.professional;
    const provider = this.normalizeProvider(professional?.videoProvider);

    if (provider === VideoProvider.CUSTOM) {
      if (!professional?.customVideoUrl) {
        throw new BadRequestException(
          'El profesional debe configurar un enlace propio de videollamada',
        );
      }

      return this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          videoProvider: provider,
          meetingProvider: provider,
          meetingUrl: professional.customVideoUrl,
          meetLink: professional.customVideoUrl,
          meetingId: null,
          meetingAccessToken: null,
          meetingCreatedAt: new Date(),
          calendarEventId: null,
        },
      });
    }

    if (provider === VideoProvider.GOOGLE_MEET) {
      if (
        appointment.meetingProvider === VideoProvider.GOOGLE_MEET &&
        appointment.meetingUrl &&
        appointment.calendarEventId
      ) {
        return appointment;
      }

      const googleMeeting =
        await this.googleCalendarService.createMeetEventForAppointment(
          appointment,
        );

      return this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          videoProvider: VideoProvider.GOOGLE_MEET,
          meetingProvider: VideoProvider.GOOGLE_MEET,
          meetingUrl: googleMeeting.meetingUrl,
          meetLink: googleMeeting.meetingUrl,
          meetingId: googleMeeting.meetingId,
          meetingAccessToken: null,
          calendarEventId: googleMeeting.calendarEventId,
          meetingCreatedAt: new Date(),
        },
      });
    }

    if (provider === VideoProvider.ZOOM) {
      if (
        appointment.meetingProvider === VideoProvider.ZOOM &&
        appointment.meetingUrl &&
        appointment.meetingId
      ) {
        return appointment;
      }

      const zoomMeeting = await this.zoomService.createMeetingForAppointment(
        appointment,
      );

      return this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          videoProvider: VideoProvider.ZOOM,
          meetingProvider: VideoProvider.ZOOM,
          meetingUrl: zoomMeeting.meetingUrl,
          meetLink: zoomMeeting.meetingUrl,
          meetingId: zoomMeeting.meetingId,
          meetingAccessToken: null,
          calendarEventId: null,
          meetingCreatedAt: new Date(),
        },
      });
    }

    if (provider === VideoProvider.MICROSOFT_TEAMS) {
      if (
        appointment.meetingProvider === VideoProvider.MICROSOFT_TEAMS &&
        appointment.meetingUrl &&
        appointment.calendarEventId
      ) {
        return appointment;
      }

      const teamsMeeting =
        await this.microsoftTeamsService.createTeamsEventForAppointment(
          appointment,
        );

      return this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          videoProvider: VideoProvider.MICROSOFT_TEAMS,
          meetingProvider: VideoProvider.MICROSOFT_TEAMS,
          meetingUrl: teamsMeeting.meetingUrl,
          meetLink: teamsMeeting.meetingUrl,
          meetingId: teamsMeeting.meetingId,
          meetingAccessToken: null,
          calendarEventId: teamsMeeting.calendarEventId,
          meetingCreatedAt: new Date(),
        },
      });
    }

    if (
      appointment.meetingProvider === VideoProvider.CONNECTA_AUTO &&
      appointment.meetingUrl &&
      appointment.meetingId &&
      appointment.meetingAccessToken
    ) {
      return appointment;
    }

    const meetingId = `conecta-${randomUUID()}`;
    const meetingAccessToken = this.buildSecureToken();
    const meetingUrl = this.buildConectaRoomUrl(
      appointment.id,
      meetingAccessToken,
    );

    return this.prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        videoProvider: VideoProvider.CONNECTA_AUTO,
        meetingProvider: VideoProvider.CONNECTA_AUTO,
        meetingUrl,
        meetLink: meetingUrl,
        meetingId,
        meetingAccessToken,
        meetingCreatedAt: new Date(),
        calendarEventId: null,
      },
    });
  }

  private async markExternalProviderPending(
    appointmentId: string,
    provider: VideoProvider,
  ) {
    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        videoProvider: provider,
        meetingProvider: provider,
        meetingUrl: null,
        meetLink: null,
        meetingId: null,
        meetingAccessToken: null,
        meetingCreatedAt: null,
        calendarEventId: null,
      },
    });
  }

  async getConectaMeetingRoom(
    appointmentId: string,
    token: string,
    userId: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        professional: {
          select: {
            id: true,
            name: true,
            email: true,
            professional: {
              select: {
                name: true,
                duration: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Sala no encontrada');
    }

    if (
      appointment.meetingProvider !== VideoProvider.CONNECTA_AUTO ||
      appointment.meetingAccessToken !== token
    ) {
      throw new ForbiddenException('Acceso denegado a la sala');
    }

    if (
      appointment.customerId !== userId &&
      appointment.professionalId !== userId
    ) {
      throw new ForbiddenException('Acceso denegado a la sala');
    }

    const duration = appointment.professional.professional?.duration || 60;
    const startsAt = appointment.date;
    const availableFrom = new Date(startsAt.getTime() - 15 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + duration * 60 * 1000);
    const availableUntil = new Date(endsAt.getTime() + 2 * 60 * 60 * 1000);
    const now = new Date();
    const isAvailable = now >= availableFrom && now <= availableUntil;

    let availabilityMessage = 'La sala esta disponible.';

    if (now < availableFrom) {
      availabilityMessage =
        'La sala estara disponible 15 minutos antes de la cita.';
    }

    if (now > availableUntil) {
      availabilityMessage = 'La sala ya no esta disponible.';
    }

    return {
      appointmentId: appointment.id,
      meetingId: appointment.meetingId,
      meetingProvider: appointment.meetingProvider,
      meetingUrl: appointment.meetingUrl,
      professionalName:
        appointment.professional.professional?.name ||
        appointment.professional.name ||
        'Profesional',
      customerName:
        appointment.customer.name || appointment.customer.email || 'Paciente',
      date: appointment.date,
      status: appointment.status,
      isConfirmed: appointment.status === AppointmentStatus.CONFIRMED,
      isAvailable,
      availabilityMessage,
      availableFrom,
      availableUntil,
    };
  }

  private normalizeProvider(provider?: VideoProvider | null): VideoProvider {
    if (!provider || provider === VideoProvider.JITSI) {
      return VideoProvider.CONNECTA_AUTO;
    }

    return provider;
  }

  private buildConectaRoomUrl(
    appointmentId: string,
    meetingAccessToken: string,
  ): string {
    const baseUrl =
      process.env.PUBLIC_FRONTEND_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:4200';
    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

    return `${normalizedBaseUrl}/meeting/${appointmentId}/${meetingAccessToken}`;
  }

  private buildSecureToken(): string {
    return randomBytes(32).toString('base64url');
  }
}
