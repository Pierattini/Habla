import { Injectable } from '@nestjs/common';
import type { NotificationTemplate } from './notification.types';

@Injectable()
export class NotificationWhatsappService {
  async send(to: string, _template: NotificationTemplate) {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      return {
        channel: 'WHATSAPP' as const,
        sent: false,
        skipped: true,
        reason: 'WHATSAPP_DISABLED',
        provider: 'pending-provider',
      };
    }

    return {
      channel: 'WHATSAPP' as const,
      sent: false,
      skipped: true,
      reason: 'WHATSAPP_PROVIDER_NOT_CONFIGURED',
      provider: 'pending-provider',
      from: process.env.WHATSAPP_NUMBER,
      to,
    };
  }
}
