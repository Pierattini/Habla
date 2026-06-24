import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { NotificationTemplate } from './notification.types';

@Injectable()
export class NotificationEmailService {
  async send(to: string, template: NotificationTemplate) {
    if (process.env.EMAIL_ENABLED !== 'true') {
      return {
        channel: 'EMAIL' as const,
        sent: false,
        skipped: true,
        reason: 'EMAIL_DISABLED',
        provider: 'gmail-smtp',
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        process.env.MAIL_FROM ||
        process.env.SMTP_USER ||
        process.env.EMAIL_USER,
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return {
      channel: 'EMAIL' as const,
      sent: true,
      provider: 'gmail-smtp',
    };
  }

  async verifyConnection() {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();

    return {
      channel: 'EMAIL' as const,
      sent: false,
      provider: 'gmail-smtp',
      verified: true,
    };
  }
}
