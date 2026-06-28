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

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type MicrosoftProfile = {
  id: string;
  mail?: string | null;
  userPrincipalName?: string | null;
};

@Injectable()
export class MicrosoftTeamsService {
  private readonly scopes = ['offline_access', 'User.Read', 'Calendars.ReadWrite'];
  private readonly tenant = 'common';

  constructor(private prisma: PrismaService) {}

  getConnectionStatus(professionalUserId: string) {
    return this.prisma.microsoftTeamsConnection
      .findUnique({
        where: { professionalUserId },
        select: {
          microsoftAccountId: true,
          microsoftEmail: true,
          connectedAt: true,
          tokenExpiresAt: true,
        },
      })
      .then((connection) => ({
        connected: !!connection,
        microsoftAccountId: connection?.microsoftAccountId || null,
        microsoftEmail: connection?.microsoftEmail || null,
        connectedAt: connection?.connectedAt || null,
        tokenExpiresAt: connection?.tokenExpiresAt || null,
      }));
  }

  buildAuthUrl(professionalUserId: string): string {
    this.ensureMicrosoftConfig();

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      response_type: 'code',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
      response_mode: 'query',
      scope: this.scopes.join(' '),
      state: this.encodeState(professionalUserId),
      prompt: 'select_account',
    });

    return `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, state: string) {
    this.ensureMicrosoftConfig();

    const professionalUserId = this.decodeState(state);
    const tokenResponse = await this.exchangeCodeForTokens(code);
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      throw new BadRequestException('Microsoft no entrego access token');
    }

    const profile = await this.fetchMicrosoftProfile(accessToken);
    const email = profile.mail || profile.userPrincipalName;

    if (!email) {
      throw new BadRequestException('Microsoft no entrego email de cuenta');
    }

    await this.prisma.microsoftTeamsConnection.upsert({
      where: { professionalUserId },
      create: {
        professionalUserId,
        microsoftAccountId: profile.id,
        microsoftEmail: email,
        encryptedAccessToken: this.encrypt(accessToken),
        encryptedRefreshToken: tokenResponse.refresh_token
          ? this.encrypt(tokenResponse.refresh_token)
          : null,
        tokenExpiresAt: this.buildExpirationDate(tokenResponse.expires_in),
      },
      update: {
        microsoftAccountId: profile.id,
        microsoftEmail: email,
        encryptedAccessToken: this.encrypt(accessToken),
        ...(tokenResponse.refresh_token && {
          encryptedRefreshToken: this.encrypt(tokenResponse.refresh_token),
        }),
        tokenExpiresAt: this.buildExpirationDate(tokenResponse.expires_in),
      },
    });

    return { professionalUserId, microsoftEmail: email };
  }

  async disconnect(professionalUserId: string) {
    await this.prisma.microsoftTeamsConnection.deleteMany({
      where: { professionalUserId },
    });

    return { connected: false };
  }

  async createTeamsEventForAppointment(appointment: AppointmentWithUsers) {
    const accessToken = await this.getValidAccessToken(appointment.professionalId);
    const duration = appointment.professional.professional?.duration || 60;
    const start = appointment.date;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const event = await this.microsoftRequest<any>(
      'https://graph.microsoft.com/v1.0/me/events',
      accessToken,
      {
        method: 'POST',
        body: {
          subject: `Conecta - cita con ${
            appointment.customer.name || appointment.customer.email
          }`,
          body: {
            contentType: 'HTML',
            content: 'Cita online generada automaticamente por Conecta.',
          },
          start: {
            dateTime: start.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: end.toISOString(),
            timeZone: 'UTC',
          },
          attendees: [
            {
              emailAddress: {
                address: appointment.professional.email,
                name:
                  appointment.professional.professional?.name ||
                  appointment.professional.name ||
                  'Profesional',
              },
              type: 'required',
            },
            ...(appointment.customer.email
              ? [
                  {
                    emailAddress: {
                      address: appointment.customer.email,
                      name: appointment.customer.name || 'Paciente',
                    },
                    type: 'required',
                  },
                ]
              : []),
          ],
          isOnlineMeeting: true,
          onlineMeetingProvider: 'teamsForBusiness',
        },
      },
    );

    const meetingUrl = event.onlineMeeting?.joinUrl || event.webLink;

    if (!meetingUrl || !event.id) {
      throw new BadRequestException('Microsoft Teams no genero la reunion');
    }

    return {
      meetingUrl,
      meetingId: event.onlineMeeting?.conferenceId || event.id,
      calendarEventId: event.id,
    };
  }

  async updateTeamsEventForAppointment(appointment: AppointmentWithUsers) {
    if (!appointment.calendarEventId) return;

    const accessToken = await this.getValidAccessToken(appointment.professionalId);
    const duration = appointment.professional.professional?.duration || 60;
    const start = appointment.date;
    const end = new Date(start.getTime() + duration * 60 * 1000);

    await this.microsoftRequest(
      `https://graph.microsoft.com/v1.0/me/events/${appointment.calendarEventId}`,
      accessToken,
      {
        method: 'PATCH',
        body: {
          start: {
            dateTime: start.toISOString(),
            timeZone: 'UTC',
          },
          end: {
            dateTime: end.toISOString(),
            timeZone: 'UTC',
          },
        },
      },
    );
  }

  async deleteTeamsEventForAppointment(
    appointment: Pick<Appointment, 'professionalId' | 'calendarEventId'>,
  ) {
    if (!appointment.calendarEventId) return;

    const accessToken = await this.getValidAccessToken(appointment.professionalId);

    await this.microsoftRequest(
      `https://graph.microsoft.com/v1.0/me/events/${appointment.calendarEventId}`,
      accessToken,
      { method: 'DELETE' },
    );
  }

  private async getValidAccessToken(professionalUserId: string): Promise<string> {
    const connection = await this.prisma.microsoftTeamsConnection.findUnique({
      where: { professionalUserId },
    });

    if (!connection) {
      throw new BadRequestException(
        'El profesional debe conectar su cuenta Microsoft',
      );
    }

    const shouldRefresh =
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (!shouldRefresh) {
      return this.decrypt(connection.encryptedAccessToken);
    }

    if (!connection.encryptedRefreshToken) {
      throw new BadRequestException('Microsoft requiere reconectar la cuenta');
    }

    const refreshed = await this.refreshAccessToken(
      this.decrypt(connection.encryptedRefreshToken),
    );

    await this.prisma.microsoftTeamsConnection.update({
      where: { professionalUserId },
      data: {
        encryptedAccessToken: this.encrypt(refreshed.access_token),
        ...(refreshed.refresh_token && {
          encryptedRefreshToken: this.encrypt(refreshed.refresh_token),
        }),
        tokenExpiresAt: this.buildExpirationDate(refreshed.expires_in),
      },
    });

    return refreshed.access_token;
  }

  private exchangeCodeForTokens(code: string) {
    return this.microsoftTokenRequest({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      code,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI || '',
      grant_type: 'authorization_code',
      scope: this.scopes.join(' '),
    });
  }

  private refreshAccessToken(refreshToken: string) {
    return this.microsoftTokenRequest({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: this.scopes.join(' '),
    });
  }

  private async microsoftTokenRequest(
    body: Record<string, string>,
  ): Promise<MicrosoftTokenResponse> {
    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      },
    );

    if (!response.ok) {
      throw new BadRequestException('No se pudo autenticar con Microsoft');
    }

    return response.json() as Promise<MicrosoftTokenResponse>;
  }

  private async fetchMicrosoftProfile(accessToken: string) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException('No se pudo obtener cuenta Microsoft');
    }

    return response.json() as Promise<MicrosoftProfile>;
  }

  private async microsoftRequest<T>(
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
      throw new BadRequestException('Microsoft Graph no pudo procesar la cita');
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
      throw new NotFoundException('Token Microsoft invalido');
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
      process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY ||
      process.env.ZOOM_TOKEN_ENCRYPTION_KEY ||
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'conecta-dev-token-key';

    return createHash('sha256').update(secret).digest();
  }

  private buildExpirationDate(expiresIn?: number): Date | null {
    return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  }

  private ensureMicrosoftConfig(): void {
    if (
      !process.env.MICROSOFT_CLIENT_ID ||
      !process.env.MICROSOFT_CLIENT_SECRET ||
      !process.env.MICROSOFT_REDIRECT_URI
    ) {
      throw new BadRequestException('Falta configuracion OAuth de Microsoft');
    }
  }
}
