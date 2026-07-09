import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {
  buildConectaEmail,
  conectaInfoCard,
  emailRow,
  escapeEmailHtml,
} from './conecta-email-template';

const CONECTA_EMAIL = 'app.info.conect@gmail.com';
const CONECTA_PUBLIC_EMAIL = 'soporte@turedpro.com';
const CONECTA_EMAIL_FROM = `Conecta <${CONECTA_PUBLIC_EMAIL}>`;

interface TaxDocumentEmailParams {
  customerName: string;
  customerEmail: string;
  fileName: string;
  pdfUrl: string;
  xmlUrl?: string | null;
  uploadedAt: Date;
  appointmentDate?: Date | string | null;
  professionalName?: string | null;
  professionalEmail?: string | null;
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

    await transporter.sendMail({
      from: this.getMailFrom(),
      to: params.adminEmail,
      subject: 'Nuevo ticket de soporte en Conecta',
      html: buildConectaEmail({
        title: 'Nuevo ticket de soporte',
        preview: 'Se ha creado un nuevo ticket de soporte en Conecta.',
        body: `
          <p>Hola ${adminName},</p>
          <p>Se ha creado un nuevo ticket de soporte en Conecta.</p>
          ${conectaInfoCard(`
            ${emailRow('Cliente', params.customerName)}
            ${emailRow('Email', params.customerEmail)}
            ${emailRow('Ticket', params.ticketId)}
            ${emailRow('Conversacion', params.conversationId)}
          `)}
          <p>Ingresa a Conecta para revisar la conversacion y gestionar el estado del ticket.</p>
        `,
      }),
    });

    return { sent: true };
  }

  async sendSupportTicketMessageEmail(params: SupportTicketEmailParams) {
    const transporter = nodemailer.createTransport(this.getTransportConfig());
    const adminName = this.escapeHtml(params.adminName);
    const customerName = this.escapeHtml(params.customerName);

    await transporter.sendMail({
      from: this.getMailFrom(),
      to: params.adminEmail,
      subject: 'Nuevo mensaje de soporte en Conecta',
      html: buildConectaEmail({
        title: 'Nuevo mensaje de soporte',
        preview: `${customerName} envio un nuevo mensaje en soporte.`,
        body: `
          <p>Hola ${adminName},</p>
          <p>${customerName} envio un nuevo mensaje en soporte.</p>
          ${conectaInfoCard(`
            ${emailRow('Email', params.customerEmail)}
            ${emailRow('Ticket', params.ticketId)}
            ${emailRow('Mensaje', this.truncateText(params.message || 'Mensaje sin texto', 600))}
          `)}
          <p>Ingresa a Conecta para responder desde la bandeja de soporte.</p>
        `,
      }),
    });

    return { sent: true };
  }

  async sendTaxDocumentEmail(params: TaxDocumentEmailParams) {
    const transporter = nodemailer.createTransport(this.getTransportConfig());
    const uploadedAt = this.formatDate(params.uploadedAt);
    const appointmentDate = params.appointmentDate
      ? this.formatDate(new Date(params.appointmentDate))
      : null;
    const customerName = this.escapeHtml(params.customerName);
    const pdfUrl = this.escapeHtml(params.pdfUrl);
    const xmlUrl = params.xmlUrl ? this.escapeHtml(params.xmlUrl) : null;
    const professionalName = params.professionalName
      ? this.escapeHtml(params.professionalName)
      : null;

    await transporter.sendMail({
      from: this.getMailFrom(),
      to: params.customerEmail,
      subject: 'Documento disponible en Conecta',
      html: buildConectaEmail({
        title: 'Documento disponible en Conecta',
        preview: 'Tu documento asociado a tu cita ya se encuentra disponible.',
        body: `
          <p>Hola ${customerName},</p>
          <p>Tu documento asociado a tu cita ya se encuentra disponible.</p>
          ${conectaInfoCard(`
            ${emailRow('Documento', params.fileName)}
            ${appointmentDate ? emailRow('Cita', appointmentDate) : ''}
            ${professionalName ? emailRow('Profesional', professionalName) : ''}
            ${emailRow('Fecha', uploadedAt)}
          `)}
          <p>Puedes revisar el PDF desde el siguiente boton.</p>
          <p style="word-break:break-all; color:#6f6780; font-size:13px;">${pdfUrl}</p>
          ${
            xmlUrl
              ? `<p style="word-break:break-all; color:#6f6780; font-size:13px;">XML: ${xmlUrl}</p>`
              : ''
          }
        `,
        action: {
          label: 'Ver documento',
          url: pdfUrl,
        },
      }),
    });

    return { sent: true };
  }

  sendTaxDocumentPendingEmail() {
    if (process.env.ENABLE_DOCUMENT_EMAILS !== 'true') {
      return { skipped: true };
    }

    return { skipped: false };
  }

  sendTaxDocumentGeneratedEmail() {
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
          user: this.getMailUser(),
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
        },
      };
    }

    return {
      service: 'gmail',
      auth: {
        user: this.getMailUser(),
        pass: process.env.EMAIL_PASS,
      },
    };
  }

  private getMailUser() {
    return process.env.SMTP_USER || process.env.EMAIL_USER || CONECTA_EMAIL;
  }

  private getMailFrom() {
    return (
      process.env.EMAIL_FROM || process.env.MAIL_FROM || CONECTA_EMAIL_FROM
    );
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  private escapeHtml(value: string) {
    return escapeEmailHtml(value);
  }

  private truncateText(value: string, maxLength: number) {
    if (value.length <= maxLength) return value;

    return `${value.slice(0, maxLength)}...`;
  }
}
