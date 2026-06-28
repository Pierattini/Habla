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
export class ZoomService {
  constructor(private prisma: PrismaService) {}

  getConnectionStatus(professionalUserId: string) {
    return this.prisma.zoomConnection
      .findUnique({
        where: { professionalUserId },
        select: {
          zoomUserId: true,
          zoomEmail: true,
          connectedAt: true,
          tokenExpiresAt: true,
        },
      })
      .then((connection) => ({
        connected: !!connection,
        zoomUserId: connection?.zoomUserId || null,
        zoomEmail: connection?.zoomEmail || null,
        connectedAt: connection?.connectedAt || null,
        tokenExpiresAt: connection?.tokenExpiresAt || null,
      }));
  }

  buildAuthUrl(professionalUserId: string): string {
    this.ensureZoomConfig();

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.ZOOM_CLIENT_ID || '',
      redirect_uri: process.env.ZOOM_REDIRECT_URI || '',
      state: this.encodeState(professionalUserId),
    });

    return `https://zoom.us/oauth/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string, state: string) {
    this.ensureZoomConfig();

    const professionalUserId = this.decodeState(state);
    const tokenResponse = await this.exchangeCodeForTokens(code);
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      throw new BadRequestException('Zoom no entrego access token');
    }

    const profile = await this.fetchZoomProfile(accessToken);

    await this.prisma.zoomConnection.upsert({
      where: { professionalUserId },
      create: {
        professionalUserId,
        zoomUserId: profile.id,
        zoomEmail: profile.email,
        encryptedAccessToken: this.encrypt(accessToken),
        encryptedRefreshToken: tokenResponse.refresh_token
          ? this.encrypt(tokenResponse.refresh_token)
          : null,
        tokenExpiresAt: this.buildExpirationDate(tokenResponse.expires_in),
      },
      update: {
        zoomUserId: profile.id,
        zoomEmail: profile.email,
        encryptedAccessToken: this.encrypt(accessToken),
        ...(tokenResponse.refresh_token && {
          encryptedRefreshToken: this.encrypt(tokenResponse.refresh_token),
        }),
        tokenExpiresAt: this.buildExpirationDate(tokenResponse.expires_in),
      },
    });

    return { professionalUserId, zoomEmail: profile.email };
  }

  async disconnect(professionalUserId: string) {
    await this.prisma.zoomConnection.deleteMany({
      where: { professionalUserId },
    });

    return { connected: false };
  }

  async createMeetingForAppointment(appointment: AppointmentWithUsers) {
    const accessToken = await this.getValidAccessToken(appointment.professionalId);
    const duration = appointment.professional.professional?.duration || 60;

    const meeting = await this.zoomRequest<any>(
      'https://api.zoom.us/v2/users/me/meetings',
      accessToken,
      {
        method: 'POST',
        body: {
          topic: `Conecta - cita con ${
            appointment.customer.name || appointment.customer.email
          }`,
          type: 2,
          start_time: appointment.date.toISOString(),
          duration,
          timezone:
            appointment.professional.timezone ||
            appointment.customer.timezone ||
            'America/Santiago',
          agenda: 'Cita online generada automaticamente por Conecta.',
          settings: {
            join_before_host: true,
            waiting_room: true,
            approval_type: 0,
            meeting_authentication: false,
          },
        },
      },
    );

    if (!meeting.join_url || !meeting.id) {
      throw new BadRequestException('Zoom no genero la reunion');
    }

    return {
      meetingUrl: meeting.join_url,
      meetingId: String(meeting.id),
    };
  }

  async updateMeetingForAppointment(appointment: AppointmentWithUsers) {
    if (!appointment.meetingId) return;

    const accessToken = await this.getValidAccessToken(appointment.professionalId);
    const duration = appointment.professional.professional?.duration || 60;

    await this.zoomRequest(
      `https://api.zoom.us/v2/meetings/${appointment.meetingId}`,
      accessToken,
      {
        method: 'PATCH',
        body: {
          start_time: appointment.date.toISOString(),
          duration,
          timezone:
            appointment.professional.timezone ||
            appointment.customer.timezone ||
            'America/Santiago',
        },
      },
    );
  }

  async deleteMeetingForAppointment(
    appointment: Pick<Appointment, 'professionalId' | 'meetingId'>,
  ) {
    if (!appointment.meetingId) return;

    const accessToken = await this.getValidAccessToken(appointment.professionalId);

    await this.zoomRequest(
      `https://api.zoom.us/v2/meetings/${appointment.meetingId}`,
      accessToken,
      { method: 'DELETE' },
    );
  }

  private async getValidAccessToken(professionalUserId: string): Promise<string> {
    const connection = await this.prisma.zoomConnection.findUnique({
      where: { professionalUserId },
    });

    if (!connection) {
      throw new BadRequestException(
        'El profesional debe conectar su cuenta Zoom',
      );
    }

    const shouldRefresh =
      !connection.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() < Date.now() + 60_000;

    if (!shouldRefresh) {
      return this.decrypt(connection.encryptedAccessToken);
    }

    if (!connection.encryptedRefreshToken) {
      throw new BadRequestException('Zoom requiere reconectar la cuenta');
    }

    const refreshed = await this.refreshAccessToken(
      this.decrypt(connection.encryptedRefreshToken),
    );

    await this.prisma.zoomConnection.update({
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
    return this.zoomTokenRequest({
      code,
      redirect_uri: process.env.ZOOM_REDIRECT_URI || '',
      grant_type: 'authorization_code',
    });
  }

  private refreshAccessToken(refreshToken: string) {
    return this.zoomTokenRequest({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
  }

  private async zoomTokenRequest(body: Record<string, string>) {
    const clientId = process.env.ZOOM_CLIENT_ID || '';
    const clientSecret = process.env.ZOOM_CLIENT_SECRET || '';
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      throw new BadRequestException('No se pudo autenticar con Zoom');
    }

    return response.json() as Promise<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    }>;
  }

  private async fetchZoomProfile(accessToken: string) {
    const response = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new BadRequestException('No se pudo obtener cuenta Zoom');
    }

    return response.json() as Promise<{ id: string; email: string }>;
  }

  private async zoomRequest<T>(
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
      throw new BadRequestException('Zoom no pudo procesar la reunion');
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
      throw new NotFoundException('Token Zoom invalido');
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
      process.env.ZOOM_TOKEN_ENCRYPTION_KEY ||
      process.env.GOOGLE_TOKEN_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'conecta-dev-token-key';

    return createHash('sha256').update(secret).digest();
  }

  private buildExpirationDate(expiresIn?: number): Date | null {
    return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
  }

  private ensureZoomConfig(): void {
    if (
      !process.env.ZOOM_CLIENT_ID ||
      !process.env.ZOOM_CLIENT_SECRET ||
      !process.env.ZOOM_REDIRECT_URI
    ) {
      throw new BadRequestException('Falta configuracion OAuth de Zoom');
    }
  }
}
