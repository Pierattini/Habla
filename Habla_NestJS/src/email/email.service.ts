import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendTaxDocumentEmail() {
    if (process.env.ENABLE_DOCUMENT_EMAILS !== 'true') {
      return { skipped: true };
    }

    // Future SMTP implementation will use:
    // MAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.
    return { skipped: false };
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
}
