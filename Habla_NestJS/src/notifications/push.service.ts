import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { NotificationTemplate } from './notification.types';

@Injectable()
export class NotificationPushService {
  private firebaseApp?: import('firebase-admin/app').App;

  constructor(private readonly prisma: PrismaService) {}

  async send(userId: string, template: NotificationTemplate) {
    if (process.env.PUSH_ENABLED !== 'true') {
      return {
        channel: 'PUSH' as const,
        sent: false,
        skipped: true,
        reason: 'PUSH_DISABLED',
        provider: 'pending-provider',
      };
    }

    if (!userId) {
      return this.skipped('MISSING_USER');
    }

    const tokens = await this.prisma.userDeviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        token: true,
      },
    });

    if (tokens.length === 0) {
      return this.skipped('NO_DEVICE_TOKENS');
    }

    const app = await this.getFirebaseApp();

    if (!app) {
      return this.skipped('FIREBASE_NOT_CONFIGURED');
    }

    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging(app);
    let sentCount = 0;

    for (const item of tokens) {
      try {
        await messaging.send({
          token: item.token,
          notification: {
            title: template.subject,
            body: template.text,
          },
          data: {
            type: 'APPOINTMENT_REMINDER',
          },
        });
        sentCount += 1;
      } catch {
        await this.prisma.userDeviceToken.updateMany({
          where: { token: item.token },
          data: { isActive: false },
        });
      }
    }

    return {
      channel: 'PUSH' as const,
      sent: sentCount > 0,
      skipped: sentCount === 0,
      reason: sentCount > 0 ? undefined : 'NO_VALID_DEVICE_TOKENS',
      provider: 'firebase-cloud-messaging',
    };
  }

  private async getFirebaseApp() {
    if (this.firebaseApp) return this.firebaseApp;

    const { cert, getApps, initializeApp } = await import(
      'firebase-admin/app'
    );

    const existing = getApps()[0];
    if (existing) {
      this.firebaseApp = existing;
      return existing;
    }

    const serviceAccount = this.getServiceAccount();

    if (!serviceAccount) {
      return null;
    }

    this.firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });

    return this.firebaseApp;
  }

  private getServiceAccount():
    | { projectId: string; clientEmail: string; privateKey: string }
    | null {
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

    if (base64) {
      const parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: String(parsed.private_key).replace(/\\n/g, '\n'),
      };
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return { projectId, clientEmail, privateKey };
  }

  private skipped(reason: string) {
    return {
      channel: 'PUSH' as const,
      sent: false,
      skipped: true,
      reason,
      provider: 'firebase-cloud-messaging',
    };
  }
}
