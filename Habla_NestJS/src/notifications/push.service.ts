import { Injectable } from '@nestjs/common';
import type { NotificationTemplate } from './notification.types';

@Injectable()
export class NotificationPushService {
  async send(_to: string, _template: NotificationTemplate) {
    if (process.env.PUSH_ENABLED !== 'true') {
      return {
        channel: 'PUSH' as const,
        sent: false,
        skipped: true,
        reason: 'PUSH_DISABLED',
        provider: 'pending-provider',
      };
    }

    return {
      channel: 'PUSH' as const,
      sent: false,
      skipped: true,
      reason: 'PUSH_PROVIDER_NOT_CONFIGURED',
      provider: 'pending-provider',
    };
  }
}
