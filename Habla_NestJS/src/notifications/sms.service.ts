import { Injectable } from '@nestjs/common';
import type { NotificationTemplate } from './notification.types';

@Injectable()
export class NotificationSmsService {
  async send(to: string, _template: NotificationTemplate) {
    if (process.env.SMS_ENABLED !== 'true') {
      return {
        channel: 'SMS' as const,
        sent: false,
        skipped: true,
        reason: 'SMS_DISABLED',
        provider: 'pending-provider',
      };
    }

    return {
      channel: 'SMS' as const,
      sent: false,
      skipped: true,
      reason: 'SMS_PROVIDER_NOT_CONFIGURED',
      provider: 'pending-provider',
      to,
    };
  }
}
