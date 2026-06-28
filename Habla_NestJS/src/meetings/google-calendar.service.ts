import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'crypto';
import { Appointment, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AppointmentWithUsers = Appointment & {
  customer: User;
  professional: User & {
    professional?: {
      name?: string | null;
      duration?: number | null;
    } | null;
  };
};

@Injectable()
export class GoogleCalendarService {
  private readonly scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  constructor(private prisma: PrismaService) {}

  getConnectionStatus(professionalUserId: string) {
    return this.prisma.googleCalendarConnection
      .findUnique({
        where: { professionalUserId },
        select: {
          googleAccountId: true,
          googleEmail: true,
          connectedAt: true,
          tokenExpiresAt: true,
        },
      })
      .then((connection) => ({
        connected: !!connection,
        googleAccountId: connection?.googleAccountId || null,
        googleEmail: connection?.googleEmail || null,
        connectedAt: connection?.connectedAt || null,
        tokenExpiresAt: connection?.tokenExpiresAt || null,
      }));
  }

  buildAuthUrl(professionalUserId: string): string {
    this.ensureGoogleConfig();

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: this.scopes.join(' '),
      state: this.encodeState(professionalUserId),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, state: string) {
    this.ensureGoogleConfig();

    const professionalUserId = this.decodeState(state);
    const tokenResponse = await this.exchangeCodeForTokens(code);
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      throw new BadRequestException('Google no entrego access token');
    }

    const profile = await this.fetchGoogleProfile(accessToken);

    await this.prisma.googleCalendarConnection.upsert({
      where: { professionalUserId },
      create: {
        professionalUserId,
        googleAccountId: profile.id,
        googleEmail: profile.email,
        encryptedAccessToken: this.encrypt(accessToken),
        encryptedRefreshToken: tokenResponse.refresh_token
          ? this.encrypt(tokenResponse.refresh_token)
          : null,
        tokenExpiresAt: this.buildExpirationDate(tokenResponse.expires_in),
      },
      update: {
        googleAccountId: profile.id,
        googleEmail: profile.email,
        encryptedAccessToken: this.encrypt(accessToken),
        ...(tokenResponse.refresh_token && {
          encryptedRefreshToken: this.encrypt(tokenResponse.refresh_token),
        }),
        tokenExpiresAt: this.buildExpirationDate(tokenResponse.expires_in),
      },
    });

    return { professionalUserId, googleEmail: profile.email };
  }

  async disconnect(professionalUserId: string) {
    await this.prisma.googleCalendarConnection.deleteMany({
      where: { professionalUserId },
    });

    return { connected: false };
  }

  async createMeetEventForAppointment(appointment: AppointmentWithUsers) {
    const accessToken = await this.getValidAccessToken(appointment.professionalId);
    const duration = appointment.professional.professional?.duration || 60;
    const start = appointment.date;
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const requestId = `conecta-${appointment.id}-${Date.now()}`;

    const event = await this.googleRequest<any>(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      accessToken,
      {
        method: 'POST',
        body: {
          summary: `Conecta - cita con ${
            appointment.customer.name || appointment.customer.email
          }`,
          description: 'Cita online generada automaticamente por Conecta.',
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          attendees: [
            { email: appointment.professional.email },
            ...(appointment.customer.email
              ? [{ email: appointment.customer.email }]
              : []),
          ],
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      },
    );

    const meetingUrl =
      event.hangoutLink ||
      event.conferenceData?.entryPoints?.find(
        (entry: any) => entry.entryPointType === 'video',
      )?.uri;

    if (!meetingUrl) {
      throw new BadRequestException('Google no genero enlace de Meet');
    }

    return {
      meetingUrl,
      meetingId: event.conferenceData?.conferenceId || event.id,
      calendarEventId: event.id,
    };
  }

  async updateCalendarEventForAppointment(appointment: AppointmentWithUsers) {
    if (!appointment.calendarEventId) return;

    const accessToken = await this.getValidAccessToken(appointment.professionalId);
    const duration = appointment.professional.professional?.duration || 60;
    const start = appointment.date;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    await this.googleRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointment.calendarEventId}?sendUpdates=all`,
      accessToken,
      {
        method: 'PATCH',
        body: {
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      },
    );
  }

  async deleteCalendarEventForAppointment(appointment: Pick<Appointment, 'professionalId' | 'calendarEventId'>) {
    if (!appointment.calendarEventId) return;

    const accessToken = await this.getValidAccessToken(appointment.professionalId);

    await this.googleRequest(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointment.calendarEventId}?sendUpdates=all`,
      accessToken,
      { method: 'DELETE' },
    );
  }

  private async getValidAccessToken(professionalUserId: string): Promise<string> {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { professionalUserId },
    });

    if (!connection) {
      throw new BadRequestException(
        'El profesional debe conectar su cuenta Google',
      );
    }

    const shouldRefresh =
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (!shouldRefresh) {
      return this.decrypt(connection.encryptedAccessToken);
    }

    if (!connection.encryptedRefreshToken) {
      throw new BadRequestException('Google requiere reconectar la cuenta');
    }

    const refreshed = await this.refreshAccessToken(
      this.decrypt(connection.encryptedRefreshToken),
    );

    await this.prisma.googleCalendarConnection.update({
      where: { professionalUserId },
      data: {
        encryptedAccessToken: this.encrypt(refreshed.access_token),
        tokenExpiresAt: this.buildExpirationDate(refreshed.expires_in),
      },
    });

    return refreshed.access_token;
  }

  private async exchangeCodeForTokens(code: string) {
    return this.googleTokenRequest({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
      grant_type: 'authorization_code',
    });
  }

  private async refreshAccessToken(refreshToken: string) {
    return this.googleTokenRequest({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    });
  }

  private async googleTokenRequest(body: Record<string, string>) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      throw new BadRequestException('No se pudo autenticar con Google');
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>;
  }

  private async fetchGoogleProfile(accessToken: string) {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new BadRequestException('No se pudo obtener cuenta Google');
    }

    return response.json() as Promise<{ id: string; email: string }>;
  }

  private async googleRequest<T>(
    url: string,
    accessToken: string,
    options: { method: string; body?: unknown },
  ): Promise<T> {
    const response = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    if (!response.ok && response.status !== 204) {
      throw new BadRequestException('Google Calendar no pudo procesar la cita');
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private encodeState(professionalUserId: string): string {
    const payload = JSON.stringify({
      professionalUserId,
      exp: Date.now() + 10 * 60 * 1000,
    });
    const encodedPayload = Buffer.from(payload).toString('base64url');
    const signature = this.signState(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  private decodeState(state: string): string {
    try {
      const [encodedPayload, signature] = state.split('.');

      if (!encodedPayload || !signature || this.signState(encodedPayload) !== signature) {
        throw new Error('invalid state signature');
      }

      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      );

      if (!payload.professionalUserId || payload.exp < Date.now()) {
        throw new Error('invalid state');
      }

      return payload.professionalUserId;
    } catch {
      throw new BadRequestException('Estado OAuth invalido');
    }
  }

  private signState(encodedPayload: string): string {
    return createHmac('sha256', this.getEncryptionKey())
      .update(encodedPayload)
      .digest('base64url');
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
    const [ivRaw, tagRaw, encryptedRaw] = value.split('.');

    if (!ivRaw || !tagRaw || !encryptedRaw) {
      throw new NotFoundException('Token Google invalido');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(ivRaw, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const secret =
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'conecta-dev-token-key';

    return createHash('sha256').update(secret).digest();
  }

  private buildExpirationDate(expiresIn?: number): Date | null {
    return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  }

  private ensureGoogleConfig(): void {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REDIRECT_URI
    ) {
      throw new BadRequestException('Falta configuracion OAuth de Google');
    }
  }
}
