import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEmailService } from './email.service';
import { buildNotificationTemplate } from './notification-templates';
import { NotificationPushService } from './push.service';
import { NotificationSmsService } from './sms.service';
import { NotificationWhatsappService } from './whatsapp.service';
import type {
  NotificationChannel,
  NotificationPayload,
  NotificationResult,
  NotificationTemplate,
} from './notification.types';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: NotificationEmailService,
    private readonly whatsappService: NotificationWhatsappService,
    private readonly smsService: NotificationSmsService,
    private readonly pushService: NotificationPushService,
  ) {}

  async notify(payload: NotificationPayload): Promise<NotificationResult[]> {
    const channels: NotificationChannel[] = payload.channels?.length
      ? payload.channels
      : ['EMAIL'];
    const template = buildNotificationTemplate(
      payload.type,
      payload.data || {},
      payload.locale || 'es',
    );
    const results: NotificationResult[] = [];

    for (const channel of channels) {
      const result = await this.sendByChannel(channel, payload, template);
      await this.logNotification(payload, result);
      results.push(result);
    }

    return results;
  }

  async verifyEmailConnection() {
    return this.emailService.verifyConnection();
  }

  private async sendByChannel(
    channel: NotificationChannel,
    payload: NotificationPayload,
    template: NotificationTemplate,
  ): Promise<NotificationResult> {
    if (channel === 'EMAIL') {
      if (!payload.recipient.email) {
        return this.skipped('EMAIL', 'MISSING_EMAIL');
      }

      return this.emailService.send(payload.recipient.email, template);
    }

    if (channel === 'WHATSAPP') {
      if (!payload.recipient.phone) {
        return this.skipped('WHATSAPP', 'MISSING_PHONE');
      }

      return this.whatsappService.send(payload.recipient.phone, template);
    }

    if (channel === 'PUSH') {
      if (!payload.recipient.phone && !payload.recipient.email) {
        return this.skipped('PUSH', 'MISSING_RECIPIENT');
      }

      return this.pushService.send(
        payload.recipient.phone || payload.recipient.email || '',
        template,
      );
    }

    if (!payload.recipient.phone) {
      return this.skipped('SMS', 'MISSING_PHONE');
    }

    return this.smsService.send(payload.recipient.phone, template);
  }

  private skipped(
    channel: NotificationChannel,
    reason: string,
  ): NotificationResult {
    return {
      channel,
      sent: false,
      skipped: true,
      reason,
    };
  }

  private async logNotification(
    payload: NotificationPayload,
    result: NotificationResult,
  ) {
    await (this.prisma as any).notificationLog.create({
      data: {
        type: payload.type,
        channel: result.channel,
        status: result.sent ? 'SENT' : result.skipped ? 'SKIPPED' : 'FAILED',
        provider: result.provider || null,
        reason: result.reason || null,
        recipientHash: this.hashRecipient(
          payload.recipient.email || payload.recipient.phone || '',
        ),
      },
    });
  }

  private hashRecipient(value: string): string | null {
    if (!value) return null;

    return createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex');
  }
}
