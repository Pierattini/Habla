import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface TaxDocumentEmailParams {
  customerName: string;
  customerEmail: string;
  fileName: string;
  pdfUrl: string;
  uploadedAt: Date;
}

@Injectable()
export class EmailService {
  async sendTaxDocumentEmail(params: TaxDocumentEmailParams) {
    const transporter = nodemailer.createTransport(this.getTransportConfig());
    const uploadedAt = this.formatDate(params.uploadedAt);
    const customerName = this.escapeHtml(params.customerName);
    const fileName = this.escapeHtml(params.fileName);
    const pdfUrl = this.escapeHtml(params.pdfUrl);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.EMAIL_USER,
      to: params.customerEmail,
      subject: 'Documento disponible en Habla',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; color: #20172f;">
          <h2 style="margin: 0 0 18px; color: #6d4aff;">Documento disponible en Habla</h2>

          <p>Hola ${customerName},</p>

          <p>Tu documento asociado a tu cita ya se encuentra disponible.</p>

          <div style="margin: 20px 0; padding: 16px; border: 1px solid #e6dcff; border-radius: 10px; background: #fbf8ff;">
            <p style="margin: 0 0 10px;"><strong>Documento:</strong><br>${fileName}</p>
            <p style="margin: 0;"><strong>Fecha:</strong><br>${uploadedAt}</p>
          </div>

          <p>Puedes revisarlo desde:</p>

          <p>
            <a href="${pdfUrl}" style="display: inline-block; padding: 12px 18px; background: #6d4aff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Ver documento
            </a>
          </p>

          <p style="word-break: break-all;">
            ${pdfUrl}
          </p>

          <p>Gracias por utilizar Habla.</p>

          <p>Equipo Habla</p>
        </div>
      `,
    });

    return { sent: true };
  }

  async sendTaxDocumentPendingEmail() {
    if (process.env.ENABLE_DOCUMENT_EMAILS !== 'true') {
      return { skipped: true };
    }

    return { skipped: false };
  }

  async sendTaxDocumentGeneratedEmail() {
    if (process.env.ENABLE_DOCUMENT_EMAILS !== 'true') {
      return { skipped: true };
    }

    return { skipped: false };
  }

  private getTransportConfig() {
    if (process.env.SMTP_HOST) {
      return {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
        },
      };
    }

    return {
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    };
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
