import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

interface TaxDocumentEmailParams {
  customerName: string;
  customerEmail: string;
  fileName: string;
  pdfUrl: string;
  uploadedAt: Date;
}

interface SupportTicketEmailParams {
  adminEmail: string;
  adminName: string;
  customerName: string;
  customerEmail: string;
  ticketId: string;
  conversationId: string;
  message?: string;
}

@Injectable()
export class EmailService {
  async sendSupportTicketCreatedEmail(params: SupportTicketEmailParams) {
    const transporter = nodemailer.createTransport(this.getTransportConfig());
    const adminName = this.escapeHtml(params.adminName);
    const customerName = this.escapeHtml(params.customerName);
    const customerEmail = this.escapeHtml(params.customerEmail);
    const ticketId = this.escapeHtml(params.ticketId);
    const conversationId = this.escapeHtml(params.conversationId);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.EMAIL_USER,
      to: params.adminEmail,
      subject: 'Nuevo ticket de soporte en Conecta',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; color: #20172f;">
          <h2 style="margin: 0 0 18px; color: #6d4aff;">Nuevo ticket de soporte</h2>
          <p>Hola ${adminName},</p>
          <p>Se ha creado un nuevo ticket de soporte en Conecta.</p>
          <div style="margin: 20px 0; padding: 16px; border: 1px solid #e6dcff; border-radius: 10px; background: #fbf8ff;">
            <p style="margin: 0 0 10px;"><strong>Cliente:</strong><br>${customerName}</p>
            <p style="margin: 0 0 10px;"><strong>Email:</strong><br>${customerEmail}</p>
            <p style="margin: 0 0 10px;"><strong>Ticket:</strong><br>${ticketId}</p>
            <p style="margin: 0;"><strong>Conversacion:</strong><br>${conversationId}</p>
          </div>
          <p>Ingresa a Conecta para revisar la conversacion y gestionar el estado del ticket.</p>
          <p>Equipo Conecta</p>
        </div>
      `,
    });

    return { sent: true };
  }

  async sendSupportTicketMessageEmail(params: SupportTicketEmailParams) {
    const transporter = nodemailer.createTransport(this.getTransportConfig());
    const adminName = this.escapeHtml(params.adminName);
    const customerName = this.escapeHtml(params.customerName);
    const customerEmail = this.escapeHtml(params.customerEmail);
    const ticketId = this.escapeHtml(params.ticketId);
    const message = this.escapeHtml(
      this.truncateText(params.message || 'Mensaje sin texto', 600),
    );

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.EMAIL_USER,
      to: params.adminEmail,
      subject: 'Nuevo mensaje de soporte en Conecta',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; color: #20172f;">
          <h2 style="margin: 0 0 18px; color: #6d4aff;">Nuevo mensaje de soporte</h2>
          <p>Hola ${adminName},</p>
          <p>${customerName} envio un nuevo mensaje en soporte.</p>
          <div style="margin: 20px 0; padding: 16px; border: 1px solid #e6dcff; border-radius: 10px; background: #fbf8ff;">
            <p style="margin: 0 0 10px;"><strong>Email:</strong><br>${customerEmail}</p>
            <p style="margin: 0 0 10px;"><strong>Ticket:</strong><br>${ticketId}</p>
            <p style="margin: 0;"><strong>Mensaje:</strong><br>${message}</p>
          </div>
          <p>Ingresa a Conecta para responder desde la bandeja de soporte.</p>
          <p>Equipo Conecta</p>
        </div>
      `,
    });

    return { sent: true };
  }

  async sendTaxDocumentEmail(params: TaxDocumentEmailParams) {
    const transporter = nodemailer.createTransport(this.getTransportConfig());
    const uploadedAt = this.formatDate(params.uploadedAt);
    const customerName = this.escapeHtml(params.customerName);
    const fileName = this.escapeHtml(params.fileName);
    const pdfUrl = this.escapeHtml(params.pdfUrl);

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.EMAIL_USER,
      to: params.customerEmail,
      subject: 'Documento disponible en Conecta',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; padding: 24px; color: #20172f;">
          <h2 style="margin: 0 0 18px; color: #6d4aff;">Documento disponible en Conecta</h2>

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

          <p>Gracias por utilizar Conecta.</p>

          <p>Equipo Conecta</p>
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

  private truncateText(value: string, maxLength: number) {
    if (value.length <= maxLength) return value;

    return `${value.slice(0, maxLength)}...`;
  }
}
